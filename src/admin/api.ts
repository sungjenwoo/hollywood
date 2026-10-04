import type { CopySuggestion, Product, ProductAsset, ProductStatus, Quality, Session } from './types';

type Options = Omit<RequestInit, 'body'> & { body?: BodyInit | Record<string, unknown> | null };

async function request<T>(url: string, options: Options = {}): Promise<T> {
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;
  if (options.body && !(options.body instanceof FormData) && typeof options.body !== 'string') {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(options.body);
  } else {
    body = options.body as BodyInit | undefined;
  }
  const response = await fetch(url, { ...options, headers, body, credentials: 'include' });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || 'The studio could not complete that action.');
  return data;
}

export const api = {
  session: () => request<Session>('/api/auth/me'),
  login: async () => {
    const result = await request<{ url: string }>('/api/auth/login', { method: 'POST', body: { origin: window.location.origin } });
    window.location.assign(result.url);
  },
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  listProducts: (status?: ProductStatus) => request<{ products: Product[] }>(`/api/admin/products${status ? `?status=${status}` : ''}`),
  createProduct: () => request<{ product: Product }>('/api/admin/products', { method: 'POST' }),
  getProduct: (id: string) => request<{ product: Product }>(`/api/admin/products/${id}`),
  updateProduct: (id: string, patch: Partial<Product>) => request<{ product: Product }>(`/api/admin/products/${id}`, { method: 'PATCH', body: patch }),
  upload: (id: string, files: File[], kind: 'original' | 'custom_background') => {
    const form = new FormData();
    form.append('kind', kind);
    files.forEach((file) => form.append('images', file));
    return request<{ assets: ProductAsset[]; product: Product }>(`/api/admin/products/${id}/assets`, { method: 'POST', body: form });
  },
  processImages: (id: string) => request<{ product: Product }>(`/api/admin/products/${id}/ai/process`, { method: 'POST' }),
  generateCopy: (id: string) => request<{ suggestion: CopySuggestion }>(`/api/admin/products/${id}/ai/copy`, { method: 'POST' }),
  approve: (id: string, assetId: string) => request<{ product: Product }>(`/api/admin/products/${id}/approve-image`, { method: 'POST', body: { assetId } }),
  quality: (id: string) => request<{ quality: Quality }>(`/api/admin/products/${id}/quality`),
  schedule: (id: string, dateTime: string, timeZone: string) => request<{ scheduledAt: string; taskUid: string }>(`/api/admin/products/${id}/schedule`, { method: 'POST', body: { dateTime, timeZone } }),
  publish: (id: string) => request<{ product: Product }>(`/api/admin/products/${id}/publish`, { method: 'POST' }),
  unpublish: (id: string) => request<{ product: Product }>(`/api/admin/products/${id}/unpublish`, { method: 'POST' }),
  duplicate: (id: string) => request<{ product: Product }>(`/api/admin/products/${id}/duplicate`, { method: 'POST' }),
};
