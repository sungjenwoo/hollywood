export type ProductCategory = 'MENS' | 'WOMENS' | 'KIDS';
export type ProductStatus = 'draft' | 'published' | 'scheduled' | 'unpublished' | 'out_of_stock';
export type BackgroundMode = 'auto' | 'custom';
export type AssetKind = 'original' | 'isolated' | 'candidate' | 'approved' | 'custom_background';

export type InventoryItem = {
  size: string;
  quantity: number;
};

export type AdminUser = {
  id: string;
  openId: string;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
};

export type ProductAsset = {
  id: string;
  productId: string;
  kind: AssetKind;
  storageKey: string;
  url: string;
  mimeType: string;
  originalFilename: string | null;
  metadata: Record<string, unknown>;
  isApproved: boolean;
  createdAt: string;
};

export type ProductRecord = {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  category: ProductCategory | null;
  productType: string;
  sku: string;
  originalPrice: number | null;
  salePrice: number | null;
  inventory: InventoryItem[];
  badges: string[];
  featured: boolean;
  trending: boolean;
  showOnHome: boolean;
  status: ProductStatus;
  backgroundMode: BackgroundMode;
  primaryAssetId: string | null;
  scheduledAt: string | null;
  scheduleTimezone: string | null;
  scheduledTaskUid: string | null;
  aiMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type ProductWithAssets = ProductRecord & {
  assets: ProductAsset[];
};

export type ProductPatch = Partial<Pick<
  ProductRecord,
  | 'name'
  | 'description'
  | 'shortDescription'
  | 'category'
  | 'productType'
  | 'sku'
  | 'originalPrice'
  | 'salePrice'
  | 'inventory'
  | 'badges'
  | 'featured'
  | 'trending'
  | 'showOnHome'
  | 'status'
  | 'backgroundMode'
  | 'scheduledAt'
  | 'scheduleTimezone'
  | 'scheduledTaskUid'
  | 'aiMetadata'
>>;

export type QualityCheck = {
  ready: boolean;
  groups: Array<{
    label: 'IMAGE' | 'PRODUCT' | 'PRICING' | 'INVENTORY';
    checks: Array<{ label: string; passed: boolean; required: boolean }>;
  }>;
};
