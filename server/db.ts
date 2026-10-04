import { randomUUID } from 'node:crypto';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import type {
  AdminUser,
  AssetKind,
  ProductAsset,
  ProductPatch,
  ProductRecord,
  ProductStatus,
  ProductWithAssets,
} from './types.js';

let pool: Pool | undefined;
let schemaReady: Promise<void> | undefined;

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('The managed database is not configured for this project.');
  }
  if (!pool) {
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 6,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

const json = (value: unknown, fallback: unknown) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
};

const toIso = (value: unknown): string | null => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

function mapProduct(row: Record<string, unknown>): ProductRecord {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: String(row.description ?? ''),
    shortDescription: String(row.short_description ?? ''),
    category: row.category ? String(row.category) as ProductRecord['category'] : null,
    productType: String(row.product_type ?? ''),
    sku: String(row.sku ?? ''),
    originalPrice: row.original_price === null || row.original_price === undefined ? null : Number(row.original_price),
    salePrice: row.sale_price === null || row.sale_price === undefined ? null : Number(row.sale_price),
    inventory: json(row.inventory_json, []) as ProductRecord['inventory'],
    badges: json(row.badges_json, []) as string[],
    featured: Boolean(row.featured),
    trending: Boolean(row.trending),
    showOnHome: Boolean(row.show_on_home),
    status: String(row.status) as ProductStatus,
    backgroundMode: String(row.background_mode ?? 'auto') as ProductRecord['backgroundMode'],
    primaryAssetId: row.primary_asset_id ? String(row.primary_asset_id) : null,
    scheduledAt: toIso(row.scheduled_at),
    scheduleTimezone: row.schedule_timezone ? String(row.schedule_timezone) : null,
    scheduledTaskUid: row.scheduled_task_uid ? String(row.scheduled_task_uid) : null,
    aiMetadata: json(row.ai_metadata, {}) as Record<string, unknown>,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
    publishedAt: toIso(row.published_at),
  };
}

function mapAsset(row: Record<string, unknown>): ProductAsset {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    kind: String(row.kind) as AssetKind,
    storageKey: String(row.storage_key),
    url: String(row.url),
    mimeType: String(row.mime_type),
    originalFilename: row.original_filename ? String(row.original_filename) : null,
    metadata: json(row.metadata_json, {}) as Record<string, unknown>,
    isApproved: Boolean(row.is_approved),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const db = getPool();
    await db.query(`CREATE TABLE IF NOT EXISTS hs_users (
      id CHAR(36) PRIMARY KEY,
      open_id VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(320) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(24) NOT NULL DEFAULT 'viewer',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await db.query(`CREATE TABLE IF NOT EXISTS hs_products (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(255) NULL,
      description LONGTEXT NULL,
      short_description TEXT NULL,
      category VARCHAR(20) NULL,
      product_type VARCHAR(80) NULL,
      sku VARCHAR(100) NULL,
      original_price DECIMAL(10,2) NULL,
      sale_price DECIMAL(10,2) NULL,
      inventory_json JSON NOT NULL,
      badges_json JSON NOT NULL,
      featured BOOLEAN NOT NULL DEFAULT FALSE,
      trending BOOLEAN NOT NULL DEFAULT FALSE,
      show_on_home BOOLEAN NOT NULL DEFAULT FALSE,
      status VARCHAR(24) NOT NULL DEFAULT 'draft',
      background_mode VARCHAR(20) NOT NULL DEFAULT 'auto',
      primary_asset_id CHAR(36) NULL,
      scheduled_at DATETIME NULL,
      schedule_timezone VARCHAR(80) NULL,
      scheduled_task_uid VARCHAR(255) NULL,
      ai_metadata JSON NOT NULL,
      created_by CHAR(36) NOT NULL,
      published_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX hs_products_status_idx (status),
      INDEX hs_products_schedule_idx (scheduled_task_uid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await db.query(`CREATE TABLE IF NOT EXISTS hs_product_assets (
      id CHAR(36) PRIMARY KEY,
      product_id CHAR(36) NOT NULL,
      kind VARCHAR(32) NOT NULL,
      storage_key VARCHAR(640) NOT NULL,
      url VARCHAR(1000) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      original_filename VARCHAR(500) NULL,
      metadata_json JSON NOT NULL,
      is_approved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX hs_assets_product_idx (product_id),
      INDEX hs_assets_kind_idx (kind)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  })();
  return schemaReady;
}

export async function upsertUser(input: Omit<AdminUser, 'id'>): Promise<AdminUser> {
  await ensureSchema();
  const db = getPool();
  const id = randomUUID();
  await db.execute(
    `INSERT INTO hs_users (id, open_id, email, name, role) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), name = VALUES(name), role = VALUES(role)`,
    [id, input.openId, input.email.toLowerCase(), input.name, input.role],
  );
  const [rows] = await db.execute<RowDataPacket[]>('SELECT * FROM hs_users WHERE open_id = ? LIMIT 1', [input.openId]);
  const row = rows[0];
  if (!row) throw new Error('Could not create the authenticated user.');
  return { id: String(row.id), openId: String(row.open_id), email: String(row.email), name: String(row.name), role: String(row.role) as AdminUser['role'] };
}

export async function getUserByOpenId(openId: string): Promise<AdminUser | null> {
  await ensureSchema();
  const [rows] = await getPool().execute<RowDataPacket[]>('SELECT * FROM hs_users WHERE open_id = ? LIMIT 1', [openId]);
  const row = rows[0];
  return row ? { id: String(row.id), openId: String(row.open_id), email: String(row.email), name: String(row.name), role: String(row.role) as AdminUser['role'] } : null;
}

async function hydrateProduct(row: Record<string, unknown>): Promise<ProductWithAssets> {
  const [assets] = await getPool().execute<RowDataPacket[]>('SELECT * FROM hs_product_assets WHERE product_id = ? ORDER BY created_at ASC', [String(row.id)]);
  return { ...mapProduct(row), assets: assets.map((asset) => mapAsset(asset)) };
}

export async function createProduct(userId: string): Promise<ProductWithAssets> {
  await ensureSchema();
  const id = randomUUID();
  await getPool().execute(
    `INSERT INTO hs_products (id, inventory_json, badges_json, ai_metadata, created_by)
     VALUES (?, JSON_ARRAY(), JSON_ARRAY(), JSON_OBJECT(), ?)`,
    [id, userId],
  );
  return getProduct(id) as Promise<ProductWithAssets>;
}

export async function getProduct(id: string): Promise<ProductWithAssets | null> {
  await ensureSchema();
  const [rows] = await getPool().execute<RowDataPacket[]>('SELECT * FROM hs_products WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? hydrateProduct(rows[0]) : null;
}

export async function listProducts(filters: { status?: ProductStatus; search?: string } = {}): Promise<ProductWithAssets[]> {
  await ensureSchema();
  const conditions: string[] = [];
  const values: string[] = [];
  if (filters.status) {
    conditions.push('status = ?');
    values.push(filters.status);
  }
  if (filters.search) {
    conditions.push('(name LIKE ? OR sku LIKE ?)');
    values.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  const sql = `SELECT * FROM hs_products ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY updated_at DESC`;
  const [rows] = await getPool().execute<RowDataPacket[]>(sql, values);
  return Promise.all(rows.map((row) => hydrateProduct(row)));
}

export async function updateProduct(id: string, patch: ProductPatch): Promise<ProductWithAssets> {
  const current = await getProduct(id);
  if (!current) throw new Error('Product not found.');
  const next: ProductRecord = { ...current, ...patch };
  await getPool().execute(
    `UPDATE hs_products SET name=?, description=?, short_description=?, category=?, product_type=?, sku=?, original_price=?, sale_price=?, inventory_json=?, badges_json=?, featured=?, trending=?, show_on_home=?, status=?, background_mode=?, scheduled_at=?, schedule_timezone=?, scheduled_task_uid=?, ai_metadata=? WHERE id=?`,
    [
      next.name || null,
      next.description || null,
      next.shortDescription || null,
      next.category,
      next.productType || null,
      next.sku || null,
      next.originalPrice,
      next.salePrice,
      JSON.stringify(next.inventory ?? []),
      JSON.stringify(next.badges ?? []),
      next.featured,
      next.trending,
      next.showOnHome,
      next.status,
      next.backgroundMode,
      next.scheduledAt ? new Date(next.scheduledAt) : null,
      next.scheduleTimezone,
      next.scheduledTaskUid,
      JSON.stringify(next.aiMetadata ?? {}),
      id,
    ],
  );
  const product = await getProduct(id);
  if (!product) throw new Error('Could not update this product.');
  return product;
}

export async function addAsset(input: Omit<ProductAsset, 'id' | 'createdAt' | 'isApproved'> & { isApproved?: boolean }): Promise<ProductAsset> {
  await ensureSchema();
  const id = randomUUID();
  await getPool().execute(
    `INSERT INTO hs_product_assets (id, product_id, kind, storage_key, url, mime_type, original_filename, metadata_json, is_approved)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.productId, input.kind, input.storageKey, input.url, input.mimeType, input.originalFilename, JSON.stringify(input.metadata ?? {}), Boolean(input.isApproved)],
  );
  const [rows] = await getPool().execute<RowDataPacket[]>('SELECT * FROM hs_product_assets WHERE id = ? LIMIT 1', [id]);
  return mapAsset(rows[0]);
}

export async function findLatestAsset(productId: string, kinds: AssetKind[]): Promise<ProductAsset | null> {
  const placeholders = kinds.map(() => '?').join(', ');
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT * FROM hs_product_assets WHERE product_id = ? AND kind IN (${placeholders}) ORDER BY created_at DESC LIMIT 1`,
    [productId, ...kinds],
  );
  return rows[0] ? mapAsset(rows[0]) : null;
}

export async function approveAsset(productId: string, assetId: string): Promise<ProductWithAssets> {
  const asset = (await getProduct(productId))?.assets.find((entry) => entry.id === assetId);
  if (!asset || !['candidate', 'approved'].includes(asset.kind)) throw new Error('Choose a valid generated image to approve.');
  await getPool().execute('UPDATE hs_product_assets SET is_approved = FALSE WHERE product_id = ?', [productId]);
  await getPool().execute('UPDATE hs_product_assets SET is_approved = TRUE WHERE id = ?', [assetId]);
  await getPool().execute('UPDATE hs_products SET primary_asset_id = ? WHERE id = ?', [assetId, productId]);
  const product = await getProduct(productId);
  if (!product) throw new Error('Could not load the approved product image.');
  return product;
}

export async function publishProduct(id: string): Promise<ProductWithAssets> {
  await getPool().execute('UPDATE hs_products SET status = ?, published_at = CURRENT_TIMESTAMP, scheduled_at = NULL WHERE id = ?', ['published', id]);
  const product = await getProduct(id);
  if (!product) throw new Error('Product not found.');
  return product;
}

export async function unpublishProduct(id: string): Promise<ProductWithAssets> {
  return updateProduct(id, { status: 'unpublished', scheduledAt: null, scheduledTaskUid: null, scheduleTimezone: null });
}

export async function duplicateProduct(id: string, userId: string): Promise<ProductWithAssets> {
  const source = await getProduct(id);
  if (!source) throw new Error('Product not found.');
  const copy = await createProduct(userId);
  return updateProduct(copy.id, {
    name: source.name ? `${source.name} — Copy` : '',
    description: source.description,
    shortDescription: source.shortDescription,
    category: source.category,
    productType: source.productType,
    sku: source.sku ? `${source.sku}-COPY` : '',
    originalPrice: source.originalPrice,
    salePrice: source.salePrice,
    inventory: source.inventory,
    badges: source.badges,
    featured: source.featured,
    trending: source.trending,
    showOnHome: source.showOnHome,
    backgroundMode: source.backgroundMode,
    aiMetadata: source.aiMetadata,
    status: 'draft',
  });
}

export async function findProductByScheduleTask(taskUid: string): Promise<ProductWithAssets | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>('SELECT * FROM hs_products WHERE scheduled_task_uid = ? LIMIT 1', [taskUid]);
  return rows[0] ? hydrateProduct(rows[0]) : null;
}
