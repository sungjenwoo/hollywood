import { addAsset, findLatestAsset, getProduct, updateProduct } from './db.js';
import { persistGeneratedImage, signedDownload } from './storage.js';
import type { ProductWithAssets } from './types.js';

type ImageInput = { url: string; mimeType: string };
type ImageResult = { url?: string; b64Json?: string; mimeType?: string; provider?: string; fallbackReason?: string };

type ProviderError = { error?: { message?: string; code?: string } | string; message?: string };

function api(): { base: string; key: string } {
  const base = process.env.MANUS_API_URL;
  const key = process.env.MANUS_API_KEY;
  if (!base || !key) throw new Error('AI services are not configured for this project.');
  return { base: base.replace(/\/$/, ''), key };
}

function openAiImageKey(): string | null {
  return process.env.OPENAI_IMAGE_API_KEY?.trim() || null;
}

function providerMessage(body: ProviderError): string | undefined {
  return typeof body.error === 'string' ? body.error : body.error?.message || body.message;
}

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

async function downloadInput(input: ImageInput, index: number): Promise<File> {
  const response = await fetch(input.url);
  if (!response.ok) throw new Error('The original product image could not be prepared for premium processing. Please upload it again and retry.');
  const mimeType = response.headers.get('content-type')?.split(';')[0] || input.mimeType;
  const bytes = await response.arrayBuffer();
  return new File([bytes], `product-reference-${index + 1}.${extensionFor(mimeType)}`, { type: mimeType });
}

async function openAiImageRequest(prompt: string, originals: ImageInput[]): Promise<ImageResult> {
  const key = openAiImageKey();
  if (!key) throw new Error('A production image provider has not been configured for POST.');

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const form = new FormData();
      form.set('model', process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-1.5');
      form.set('prompt', prompt);
      form.set('size', '1024x1024');
      form.set('output_format', 'webp');
      form.set('output_compression', '90');
      for (const [index, input] of originals.entries()) form.append('image[]', await downloadInput(input, index));

      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}` },
        body: form,
      });
      const body = await response.json().catch(() => ({})) as ProviderError & { data?: Array<{ b64_json?: string | null; url?: string | null }> };
      const result = body.data?.[0];
      if (response.ok && (result?.b64_json || result?.url)) {
        return { b64Json: result.b64_json || undefined, url: result.url || undefined, mimeType: 'image/webp' };
      }

      const message = providerMessage(body) || 'The image provider did not return a usable result.';
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 650 * (attempt + 1)));
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error('The configured production image provider rejected its credentials. Update the protected image-provider key, then retry this result.');
      }
      if (response.status === 429) throw new Error('The connected image provider is temporarily rate-limited. Please retry shortly; POST does not impose a per-product generation cap.');
      throw new Error(`The connected image provider could not create this result: ${message}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('The connected image provider could not create this result.');
      if (lastError.message.includes('rejected its credentials')) throw lastError;
      if (attempt < 2 && !lastError.message.includes('could not create this result:') && !lastError.message.includes('temporarily rate-limited')) {
        await new Promise((resolve) => setTimeout(resolve, 650 * (attempt + 1)));
        continue;
      }
      throw lastError;
    }
  }
  throw lastError || new Error('The connected image provider could not create this result.');
}

async function managedImageRequest(prompt: string, originals: ImageInput[]): Promise<ImageResult> {
  const { base, key } = api();
  const response = await fetch(`${base}/images.v1.ImageService/GenerateImage`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'connect-protocol-version': '1' },
    body: JSON.stringify({ prompt, originalImages: originals }),
  });
  const body = await response.json() as { image?: ImageResult } & ProviderError;
  if (!response.ok || !body.image) {
    const message = providerMessage(body);
    if (message?.toLowerCase().includes('usage exhausted')) {
      throw new Error('The managed premium-image service is currently unavailable. Connect a production image provider for new premium results, or use the original image for this release.');
    }
    throw new Error(message || 'AI image processing did not complete. You can use the original product image or retry.');
  }
  return body.image;
}

async function localStudioImageRequest(originals: ImageInput[], reason: string): Promise<ImageResult> {
  const source = await downloadInput(originals[0], 0);
  const sourceMime = source.type || originals[0].mimeType || 'image/jpeg';
  const sourceData = Buffer.from(await source.arrayBuffer()).toString('base64');
  const background = originals[1] ? await downloadInput(originals[1], 1) : null;
  const backgroundData = background ? Buffer.from(await background.arrayBuffer()).toString('base64') : '';
  const backgroundMime = background?.type || originals[1]?.mimeType || 'image/jpeg';
  const palette = [
    ['#f3eee6', '#d9cbb9', '#b5967a'],
    ['#eeeae4', '#cbd2d0', '#879496'],
    ['#f4eadf', '#d7b9a8', '#9a6d63'],
    ['#f0eee9', '#c4c3be', '#797975'],
  ][Math.floor(Math.random() * 4)];
  const id = `studio-${Date.now()}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200"><defs><linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette[0]}"/><stop offset=".58" stop-color="${palette[1]}"/><stop offset="1" stop-color="${palette[2]}"/></linearGradient><filter id="shadow-${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="22"/><feOffset dy="24"/><feComponentTransfer><feFuncA type="linear" slope=".25"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="1200" height="1200" fill="url(#bg-${id})"/>${backgroundData ? `<image href="data:${backgroundMime};base64,${backgroundData}" x="0" y="0" width="1200" height="1200" preserveAspectRatio="xMidYMid slice" opacity=".28"/>` : ''}<circle cx="980" cy="180" r="250" fill="#fff" opacity=".18"/><path d="M70 1000C310 870 690 1140 1130 920" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/><image href="data:${sourceMime};base64,${sourceData}" x="100" y="115" width="1000" height="880" preserveAspectRatio="xMidYMid meet" filter="url(#shadow-${id})"/><rect x="34" y="34" width="1132" height="1132" fill="none" stroke="#fff" stroke-opacity=".55"/></svg>`;
  return { b64Json: Buffer.from(svg).toString('base64'), mimeType: 'image/svg+xml', provider: 'local-studio', fallbackReason: reason.slice(0, 180) };
}

async function imageRequest(prompt: string, originals: ImageInput[]): Promise<ImageResult> {
  // POST deliberately has no per-admin, per-product, or per-candidate generation cap.
  // Try the configured provider first, then create a durable local studio composition so
  // the button remains functional even when provider quota or credentials are unavailable.
  try {
    const result = openAiImageKey() ? await openAiImageRequest(prompt, originals) : await managedImageRequest(prompt, originals);
    return { ...result, provider: result.provider || (openAiImageKey() ? 'openai' : 'managed') };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'External image provider unavailable.';
    console.warn('[POST image provider fallback]', reason);
    return localStudioImageRequest(originals, reason);
  }
}

function extractJson(text: string): Record<string, unknown> {
  const compact = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(compact) as Record<string, unknown>;
  } catch {
    const start = compact.indexOf('{');
    const end = compact.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(compact.slice(start, end + 1)) as Record<string, unknown>; } catch { /* handled below */ }
    }
  }
  throw new Error('The AI returned an incomplete suggestion. Please regenerate.');
}

async function askModel(prompt: string, imageUrl?: string): Promise<Record<string, unknown>> {
  const { base, key } = api();
  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail: 'high' } }> = [{ type: 'text', text: prompt }];
  if (imageUrl) content.push({ type: 'image_url', image_url: { url: imageUrl, detail: 'high' } });
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'system', content: 'Return only the requested compact JSON. Do not include markdown or commentary.' }, { role: 'user', content }] }),
  });
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> } & ProviderError;
  const output = body.choices?.[0]?.message?.content;
  if (!response.ok || !output) throw new Error(providerMessage(body) || 'The AI writing assistant did not return a usable response.');
  return extractJson(output);
}

function fallbackVisualAnalysis(): Record<string, unknown> {
  return {
    mainColors: [], secondaryColors: [], material: 'Product material retained from source', texture: 'Source photography', shoeType: 'Footwear', style: 'Contemporary sport', shape: 'Low profile', visualMood: 'Precise and restrained', luxuryLevel: 'Premium', suitableEnvironment: 'Warm ivory product studio', backgroundDirection: 'warm ivory architecture', analysisSource: 'fallback',
  };
}

async function analyzeForStudio(imageUrl: string): Promise<Record<string, unknown>> {
  try {
    return await askModel(
      'Analyze this single shoe image for a premium product studio. Return JSON with exactly mainColors (array of strings), secondaryColors (array of strings), material (string), texture (string), shoeType (string), style (string), shape (string), visualMood (string), luxuryLevel (string), suitableEnvironment (string), backgroundDirection (string). Keep each field concise and visually grounded.',
      imageUrl,
    );
  } catch {
    // Copy analysis must never prevent a legitimate premium-image request.
    return fallbackVisualAnalysis();
  }
}

export async function runImagePipeline(productId: string): Promise<ProductWithAssets> {
  const product = await getProduct(productId);
  if (!product) throw new Error('Product not found.');
  const original = await findLatestAsset(productId, ['original']);
  if (!original) throw new Error('Upload a shoe image before starting the image studio.');
  const originalDownload = await signedDownload(original.storageKey);
  const isolation = await imageRequest(
    'Create a clean, high-resolution isolated product cutout of the exact shoe in the supplied reference. Preserve silhouette, laces, sole, material, color, stitching and all product details. Remove the photographed setting. Use a clean neutral studio treatment with crisp edges and no text, no logo, no extra shoe, no watermark. This is a review candidate, not an automatic approval.',
    [{ url: originalDownload, mimeType: original.mimeType }],
  );
  const isolatedStored = await persistGeneratedImage({ productId, kind: 'isolated', result: isolation, filename: 'isolated-shoe.webp' });
  const isolatedAsset = await addAsset({ productId, kind: 'isolated', ...isolatedStored, originalFilename: null, metadata: { stage: 'background-removal', sourceAssetId: original.id } });
  const analysis = await analyzeForStudio(originalDownload);
  const customBackground = product.backgroundMode === 'custom' ? await findLatestAsset(productId, ['custom_background']) : null;
  const backgroundInput = customBackground ? await signedDownload(customBackground.storageKey) : null;
  const finalCandidate = await imageRequest(
    customBackground
      ? 'Compose a refined premium product image by placing the exact shoe from the first reference into the custom background from the second reference. Preserve the shoe exactly, match grounding, contact shadow, scale, perspective and lighting naturally. Do not add text, logos, extra shoes or watermark.'
      : `Create a refined premium footwear product image from the supplied exact shoe. Preserve its silhouette, color, laces, sole and material. Use a calm high-end studio environment aligned with this direction: ${String(analysis.backgroundDirection || analysis.suitableEnvironment || 'warm ivory architecture')}. The result should feel editorial, light-luxury, softly lit, precise and web-ready. Do not add text, logos, extra shoes or watermark.`,
    backgroundInput
      ? [{ url: originalDownload, mimeType: original.mimeType }, { url: backgroundInput, mimeType: customBackground?.mimeType || 'image/jpeg' }]
      : [{ url: originalDownload, mimeType: original.mimeType }],
  );
  const candidateStored = await persistGeneratedImage({ productId, kind: 'candidate', result: finalCandidate, filename: 'hollywood-premium-result.webp' });
  await addAsset({ productId, kind: 'candidate', ...candidateStored, originalFilename: null, metadata: { stage: 'premium-composition', sourceAssetId: original.id, isolatedAssetId: isolatedAsset.id, analysis, backgroundMode: product.backgroundMode, provider: finalCandidate.provider || 'unknown', fallbackReason: finalCandidate.fallbackReason || null } });
  return updateProduct(productId, { aiMetadata: { ...product.aiMetadata, analysis, lastPipelineAt: new Date().toISOString(), state: 'ready_for_review' } });
}

export async function generateCopy(productId: string): Promise<Record<string, unknown>> {
  const product = await getProduct(productId);
  if (!product) throw new Error('Product not found.');
  const analysis = product.aiMetadata.analysis && typeof product.aiMetadata.analysis === 'object' ? JSON.stringify(product.aiMetadata.analysis) : 'No visual analysis is available.';
  return askModel(`Create editable luxury footwear copy for Hollywood Shoe. Product data: name=${product.name || 'Untitled shoe'}; category=${product.category || 'unspecified'}; type=${product.productType || 'unspecified'}; visual analysis=${analysis}. Return JSON with exactly description, shortDescription, highlights (array of 3 strings), seoTitle, seoDescription and altText. Use factual, refined language; do not mention a price, unverified technical specs, or trademarks.`);
}
