import { randomUUID } from 'node:crypto';
import path from 'node:path';

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function api(): { base: string; key: string } {
  const base = process.env.MANUS_API_URL;
  const key = process.env.MANUS_API_KEY;
  if (!base || !key) throw new Error('The managed storage service is not configured.');
  return { base: base.replace(/\/$/, ''), key };
}

async function presign(kind: 'put' | 'get', storageKey: string): Promise<string> {
  const { base, key } = api();
  const response = await fetch(`${base}/v1/storage/presign/${kind}?path=${encodeURIComponent(storageKey)}`, {
    headers: { authorization: `Bearer ${key}` },
  });
  const data = await response.json() as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error || `Storage could not ${kind === 'put' ? 'prepare an upload' : 'prepare the image'}.`);
  return data.url;
}

export function isAcceptedImage(file: { mimetype: string; originalname?: string }): boolean {
  if (!acceptedMimeTypes.has(file.mimetype)) return false;
  const extension = path.extname(file.originalname ?? '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].includes(extension);
}

export function stableAssetUrl(storageKey: string): string {
  return `/manus-storage/${storageKey}`;
}

export async function uploadBuffer(input: {
  productId: string;
  kind: string;
  buffer: Buffer;
  mimeType: string;
  filename?: string | null;
}): Promise<{ storageKey: string; url: string }> {
  const cleanName = (input.filename || 'image').replace(/[^A-Za-z0-9._-]/g, '-').slice(-110) || 'image';
  const storageKey = `hollywood-shoe/products/${input.productId}/${input.kind}/${randomUUID()}-${cleanName}`;
  const uploadUrl = await presign('put', storageKey);
  const upload = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': input.mimeType },
    body: new Uint8Array(input.buffer),
  });
  if (!upload.ok) throw new Error('The original image could not be stored. Please retry the upload.');
  return { storageKey, url: stableAssetUrl(storageKey) };
}

export async function signedDownload(storageKey: string): Promise<string> {
  return presign('get', storageKey);
}

export async function persistGeneratedImage(input: {
  productId: string;
  kind: string;
  result: { url?: string; b64Json?: string; mimeType?: string };
  filename: string;
}): Promise<{ storageKey: string; url: string; mimeType: string }> {
  let bytes: Buffer;
  const mimeType = input.result.mimeType || 'image/png';
  if (input.result.b64Json) {
    const base64 = input.result.b64Json.includes(',') ? input.result.b64Json.split(',').pop() || '' : input.result.b64Json;
    bytes = Buffer.from(base64, 'base64');
  } else if (input.result.url) {
    const response = await fetch(input.result.url);
    if (!response.ok) throw new Error('The AI image result was not available for safe storage.');
    bytes = Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error('The AI image service returned no usable image.');
  }
  const stored = await uploadBuffer({ productId: input.productId, kind: input.kind, buffer: bytes, mimeType, filename: input.filename });
  return { ...stored, mimeType };
}
