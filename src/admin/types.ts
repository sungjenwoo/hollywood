export type ProductStatus = 'draft' | 'published' | 'scheduled' | 'unpublished' | 'out_of_stock';
export type AssetKind = 'original' | 'isolated' | 'candidate' | 'approved' | 'custom_background';

export type InventoryItem = { size: string; quantity: number };

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

export type Product = {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  category: 'MENS' | 'WOMENS' | 'KIDS' | null;
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
  backgroundMode: 'auto' | 'custom';
  primaryAssetId: string | null;
  scheduledAt: string | null;
  scheduleTimezone: string | null;
  scheduledTaskUid: string | null;
  aiMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  assets: ProductAsset[];
};

export type Session = {
  authenticated: boolean;
  isAdmin: boolean;
  user: { name: string; email: string; role: string } | null;
};

export type Quality = {
  ready: boolean;
  groups: Array<{
    label: 'IMAGE' | 'PRODUCT' | 'PRICING' | 'INVENTORY';
    checks: Array<{ label: string; passed: boolean; required: boolean }>;
  }>;
};

export type CopySuggestion = {
  description?: string;
  shortDescription?: string;
  highlights?: string[];
  seoTitle?: string;
  seoDescription?: string;
  altText?: string;
};
