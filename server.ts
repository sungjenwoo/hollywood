import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { assertTrustedOrigin, beginLogin, finishLogin, logout, requireAdmin, resolveUser, sessionPublicView } from './server/auth.js';
import { generateCopy, runImagePipeline } from './server/ai-service.js';
import { addAsset, approveAsset, createProduct, duplicateProduct, ensureSchema, getProduct, listProducts, publishProduct, unpublishProduct, updateProduct } from './server/db.js';
import { cancelProductSchedule, executeScheduledPublish, scheduleProduct } from './server/heartbeat.js';
import { isAcceptedImage, uploadBuffer } from './server/storage.js';
import type { ProductPatch, ProductStatus, ProductWithAssets, QualityCheck } from './server/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 8 } });
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

function parseCookies(header: string | undefined): Record<string, string> {
  return Object.fromEntries((header ?? '').split(';').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const separator = entry.indexOf('=');
    return [decodeURIComponent(entry.slice(0, separator)), decodeURIComponent(entry.slice(separator + 1))];
  }));
}

function errorResponse(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  const typed = error as Error & { status?: number; code?: string };
  const message = error instanceof Error ? error.message : 'The private studio could not complete that action.';
  const status = typed.status ?? (message.toLowerCase().includes('not found') ? 404 : 500);
  if (status >= 500) console.error('[POST server]', typed);
  response.status(status).json({ error: { message, code: typed.code || 'POST_REQUEST_FAILED' } });
}

function assertOrigin(request: Request) {
  assertTrustedOrigin(request);
}

async function withAdmin(request: Request, response: Response, run: (user: Awaited<ReturnType<typeof requireAdmin>>) => Promise<void>) {
  assertOrigin(request);
  const user = await requireAdmin(request);
  await run(user);
  if (!response.headersSent) response.status(204).end();
}

function validatePrices(patch: ProductPatch) {
  if (patch.originalPrice !== undefined && patch.originalPrice !== null && (!Number.isFinite(patch.originalPrice) || patch.originalPrice < 0)) throw new Error('Original price must be a valid positive amount.');
  if (patch.salePrice !== undefined && patch.salePrice !== null && (!Number.isFinite(patch.salePrice) || patch.salePrice < 0)) throw new Error('Sale price must be a valid positive amount.');
  if (patch.originalPrice !== undefined && patch.salePrice !== undefined && patch.originalPrice !== null && patch.salePrice !== null && patch.salePrice > patch.originalPrice) throw new Error('Sale price cannot exceed original price.');
}

function productId(request: Request): string {
  const id = request.params.id;
  if (typeof id !== 'string' || !id) throw new Error('A valid product identifier is required.');
  return id;
}

function qualityCheck(product: ProductWithAssets): QualityCheck {
  const hasApproved = product.assets.some((asset) => asset.isApproved);
  const stockCount = product.inventory.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
  const groups: QualityCheck['groups'] = [
    { label: 'IMAGE', checks: [
      { label: 'An approved premium image is selected', passed: hasApproved, required: true },
      { label: 'At least one original image is safely preserved', passed: product.assets.some((asset) => asset.kind === 'original'), required: true },
    ] },
    { label: 'PRODUCT', checks: [
      { label: 'Product name', passed: Boolean(product.name.trim()), required: true },
      { label: 'Description', passed: Boolean(product.description.trim()), required: true },
      { label: 'Category', passed: Boolean(product.category), required: true },
      { label: 'Product type', passed: Boolean(product.productType.trim()), required: true },
    ] },
    { label: 'PRICING', checks: [
      { label: 'Original price', passed: product.originalPrice !== null && product.originalPrice >= 0, required: true },
      { label: 'Sale price is logical', passed: product.salePrice === null || (product.originalPrice !== null && product.salePrice <= product.originalPrice), required: false },
    ] },
    { label: 'INVENTORY', checks: [
      { label: 'At least one size with stock', passed: stockCount > 0, required: true },
    ] },
  ];
  return { ready: groups.flatMap((group) => group.checks).filter((check) => check.required).every((check) => check.passed), groups };
}

app.get('/_app/health', async (_request, response) => {
  try { await ensureSchema(); response.status(200).json({ ok: true }); } catch (error) { response.status(503).json({ ok: false, error: error instanceof Error ? error.message : 'Database unavailable' }); }
});

app.post('/api/auth/login', (request, response, next) => { try { beginLogin(request, response); } catch (error) { next(error); } });
app.get('/api/auth/callback', (request, response, next) => { finishLogin(request, response).catch(next); });
app.post('/api/auth/logout', (_request, response) => logout(response));
app.get('/api/auth/me', async (request, response, next) => { try { response.json(sessionPublicView(await resolveUser(request))); } catch (error) { next(error); } });

app.get('/api/admin/products', (request, response, next) => withAdmin(request, response, async () => {
  const status = typeof request.query.status === 'string' ? request.query.status as ProductStatus : undefined;
  const search = typeof request.query.search === 'string' ? request.query.search.slice(0, 100) : undefined;
  response.json({ products: await listProducts({ status, search }) });
}).catch(next));

app.post('/api/admin/products', (request, response, next) => withAdmin(request, response, async (user) => {
  response.status(201).json({ product: await createProduct(user.id) });
}).catch(next));

app.get('/api/admin/products/:id', (request, response, next) => withAdmin(request, response, async () => {
  const product = await getProduct(productId(request));
  if (!product) { response.status(404).json({ error: { message: 'Product not found.' } }); return; }
  response.json({ product });
}).catch(next));

app.patch('/api/admin/products/:id', (request, response, next) => withAdmin(request, response, async () => {
  const id = productId(request);
  const patch = request.body as ProductPatch;
  validatePrices(patch);
  const product = await getProduct(id);
  if (patch.originalPrice === undefined && patch.salePrice !== undefined && product?.originalPrice !== null && product?.originalPrice !== undefined && patch.salePrice !== null && patch.salePrice > product.originalPrice) throw new Error('Sale price cannot exceed original price.');
  response.json({ product: await updateProduct(id, patch) });
}).catch(next));

app.post('/api/admin/products/:id/assets', upload.array('images', 8), (request, response, next) => withAdmin(request, response, async () => {
  const product = await getProduct(productId(request));
  if (!product) throw new Error('Product not found.');
  const kind = request.body?.kind === 'custom_background' ? 'custom_background' : 'original';
  const files = (request.files ?? []) as Express.Multer.File[];
  if (!files.length) throw new Error('Choose at least one image to upload.');
  const created = [];
  for (const file of files) {
    if (!isAcceptedImage(file)) throw new Error(`${file.originalname} is not JPG, JPEG, PNG or WebP.`);
    const stored = await uploadBuffer({ productId: product.id, kind, buffer: file.buffer, mimeType: file.mimetype, filename: file.originalname });
    created.push(await addAsset({ productId: product.id, kind, ...stored, mimeType: file.mimetype, originalFilename: file.originalname, metadata: { size: file.size, uploadedAt: new Date().toISOString() } }));
  }
  response.status(201).json({ assets: created, product: await getProduct(product.id) });
}).catch(next));

app.post('/api/admin/products/:id/ai/process', (request, response, next) => withAdmin(request, response, async () => {
  response.json({ product: await runImagePipeline(productId(request)) });
}).catch(next));

app.post('/api/admin/products/:id/ai/copy', (request, response, next) => withAdmin(request, response, async () => {
  response.json({ suggestion: await generateCopy(productId(request)) });
}).catch(next));

app.post('/api/admin/products/:id/approve-image', (request, response, next) => withAdmin(request, response, async () => {
  if (typeof request.body?.assetId !== 'string') throw new Error('Choose an image to approve.');
  response.json({ product: await approveAsset(productId(request), request.body.assetId) });
}).catch(next));

app.get('/api/admin/products/:id/quality', (request, response, next) => withAdmin(request, response, async () => {
  const product = await getProduct(productId(request));
  if (!product) throw new Error('Product not found.');
  response.json({ quality: qualityCheck(product) });
}).catch(next));

app.post('/api/admin/products/:id/schedule', (request, response, next) => withAdmin(request, response, async () => {
  const dateTime = String(request.body?.dateTime || '');
  const timeZone = String(request.body?.timeZone || '');
  response.json(await scheduleProduct(productId(request), dateTime, timeZone));
}).catch(next));

app.post('/api/admin/products/:id/publish', (request, response, next) => withAdmin(request, response, async () => {
  const id = productId(request);
  const product = await getProduct(id);
  if (!product) throw new Error('Product not found.');
  const quality = qualityCheck(product);
  if (!quality.ready) {
    const error = new Error('Complete the required quality checks before publishing.') as Error & { status?: number };
    error.status = 422;
    throw error;
  }
  if (product.scheduledTaskUid) await cancelProductSchedule(product.scheduledTaskUid);
  const published = await publishProduct(id);
  response.json({ product: published.scheduledTaskUid ? await updateProduct(id, { scheduledTaskUid: null, scheduleTimezone: null }) : published });
}).catch(next));

app.post('/api/admin/products/:id/unpublish', (request, response, next) => withAdmin(request, response, async () => {
  const product = await getProduct(productId(request));
  if (!product) throw new Error('Product not found.');
  if (product.scheduledTaskUid) await cancelProductSchedule(product.scheduledTaskUid);
  response.json({ product: await unpublishProduct(product.id) });
}).catch(next));

app.post('/api/admin/products/:id/duplicate', (request, response, next) => withAdmin(request, response, async (user) => {
  response.status(201).json({ product: await duplicateProduct(productId(request), user.id) });
}).catch(next));

app.post('/api/scheduled/publish-product', (request, response, next) => {
  const token = parseCookies(request.headers.cookie).app_session_id;
  executeScheduledPublish(token).then((result) => response.json(result)).catch(next);
});

app.use(errorResponse);

async function start() {
  await ensureSchema();
  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.use((_request, response) => response.sendFile(path.join(__dirname, 'dist', 'index.html')));
  }
  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => console.log(`Hollywood Shoe server listening on ${port}`));
}

start().catch((error) => { console.error('Could not start Hollywood Shoe.', error); process.exit(1); });
