import { addAsset, findLatestAsset, getProduct, updateProduct } from './db.js';
import { persistGeneratedImage, signedDownload } from './storage.js';
import type { ProductWithAssets } from './types.js';

function api(): { base: string; key: string } {
  const base = process.env.MANUS_API_URL;
  const key = process.env.MANUS_API_KEY;
  if (!base || !key) throw new Error('AI services are not configured for this project.');
  return { base: base.replace(/\/$/, ''), key };
}

async function imageRequest(prompt: string, originals: Array<{ url: string; mimeType: string }>) {
  const { base, key } = api();
  const response = await fetch(`${base}/images.v1.ImageService/GenerateImage`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'connect-protocol-version': '1' },
    body: JSON.stringify({ prompt, originalImages: originals }),
  });
  const body = await response.json() as { image?: { url?: string; b64Json?: string; mimeType?: string }; error?: { message?: string } | string; message?: string };
  if (!response.ok || !body.image) {
    const message = typeof body.error === 'string' ? body.error : body.error?.message || body.message;
    if (message?.toLowerCase().includes('usage exhausted')) {
      throw new Error('The managed premium-image service is currently unavailable. You can use the original product image for this release or retry the premium result later.');
    }
    throw new Error(message || 'AI image processing did not complete. You can use the original product image or retry.');
  }
  return body.image;
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
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } | string };
  const message = typeof body.error === 'string' ? body.error : body.error?.message;
  const output = body.choices?.[0]?.message?.content;
  if (!response.ok || !output) throw new Error(message || 'The AI writing assistant did not return a usable response.');
  return extractJson(output);
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
  const isolatedStored = await persistGeneratedImage({ productId, kind: 'isolated', result: isolation, filename: 'isolated-shoe.png' });
  const isolatedAsset = await addAsset({ productId, kind: 'isolated', ...isolatedStored, originalFilename: null, metadata: { stage: 'background-removal', sourceAssetId: original.id } });
  const analysis = await askModel(
    'Analyze this single shoe image for a premium product studio. Return JSON with exactly mainColors (array of strings), secondaryColors (array of strings), material (string), texture (string), shoeType (string), style (string), shape (string), visualMood (string), luxuryLevel (string), suitableEnvironment (string), backgroundDirection (string). Keep each field concise and visually grounded.',
    originalDownload,
  );
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
  const candidateStored = await persistGeneratedImage({ productId, kind: 'candidate', result: finalCandidate, filename: 'hollywood-premium-result.png' });
  await addAsset({ productId, kind: 'candidate', ...candidateStored, originalFilename: null, metadata: { stage: 'premium-composition', sourceAssetId: original.id, isolatedAssetId: isolatedAsset.id, analysis, backgroundMode: product.backgroundMode } });
  return updateProduct(productId, { aiMetadata: { ...product.aiMetadata, analysis, lastPipelineAt: new Date().toISOString(), state: 'ready_for_review' } });
}

export async function generateCopy(productId: string): Promise<Record<string, unknown>> {
  const product = await getProduct(productId);
  if (!product) throw new Error('Product not found.');
  const analysis = product.aiMetadata.analysis && typeof product.aiMetadata.analysis === 'object' ? JSON.stringify(product.aiMetadata.analysis) : 'No visual analysis is available.';
  return askModel(`Create editable luxury footwear copy for Hollywood Shoe. Product data: name=${product.name || 'Untitled shoe'}; category=${product.category || 'unspecified'}; type=${product.productType || 'unspecified'}; visual analysis=${analysis}. Return JSON with exactly description, shortDescription, highlights (array of 3 strings), seoTitle, seoDescription, altText. Use factual, refined language; do not mention a price, unverified technical specs, or trademarks.`);
}
