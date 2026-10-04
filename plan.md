# Hollywood Shoe — POST / Admin Product Studio Plan

## Preservation boundary
The approved public Home page and its public future placeholders are **locked**. This work does not alter their layout, media, navigation, typography, colors, animation, spacing, assets, routes or responsive behavior. The new capability is isolated behind authenticated `/post` routes and `/api/admin/*` server endpoints. The public header will continue to expose exactly `HOME | MENS | WOMENS | KIDS`; a POST entry is supplied only after the server verifies an administrator role.

## Secure architecture
- **Authentication:** Manus OAuth is the login provider. The server validates an application session and resolves it to a persisted user. Only identities whose email belongs to the protected `ADMIN_EMAILS` allowlist receive the `admin` role. All non-admin requests to `/post` and `/api/admin/*` return a safe unauthenticated/forbidden response; client-side visibility is never the authorization boundary.
- **Session protection:** OAuth state uses a short-lived, nonce-bound cookie. The callback accepts only the site origin passed from the initiating page, redirects only to `/post`, and establishes an `HttpOnly`, `Secure`, `SameSite=None` app session. A protected `APP_SESSION_SECRET` signs application session data. CSRF-sensitive write endpoints require an origin check and authenticated session.
- **Persistence:** Managed MySQL stores users, product records, product assets, image processing metadata, inventory by size, editable AI text, statuses and timestamps. Additive schema initialization is idempotent and never overwrites existing product edits or assets.
- **Assets:** Originals, isolated results, generated/composited images and optional custom backgrounds are kept as distinct durable storage objects with separate URLs and metadata. No processing overwrites originals.
- **AI pipeline:** The server exposes explicit stages: upload → background isolation request → visual analysis → premium environment match → composition/review. Every stage reports a discrete state or a useful retryable failure. The image result is stored as a candidate and never becomes approved automatically. AI writing suggestions are editable, accept-only drafts.

## Design direction
- **Design movement:** Hollywood Shoe’s private atelier—an editorial product studio rather than a generic software dashboard.
- **Core principles:** quiet hierarchy; product imagery leads; progressive disclosure; polished but restrained system feedback.
- **Color philosophy:** retain the house’s warm paper, ivory, stone, charcoal typography and one oxblood action accent; use color sparingly to signal readiness and errors.
- **Layout paradigm:** a focused creation canvas: left-side studio navigation, a wide image-review worktable, then grouped editorial forms and an end-of-flow final inspection.
- **Signature elements:** thin film-frame image wells; a numbered pipeline ribbon; a split original/result comparison with an editable approval state.
- **Interaction philosophy:** controls respond with short opacity/transform transitions. AI processing uses a visible staged ribbon and does not block unrelated form edits. All motion respects reduced-motion preferences.
- **Typography:** preserve the existing `DM Serif Display` and `Manrope` pairing, used privately for a coherent house experience but with task-focused form hierarchy.
- **Brand essence:** A private, fashion-house product desk where simple product preparation becomes a considered visual release. **Precise, calm, editorial.**
- **Brand voice:** direct and composed: “Make the first impression deliberate.” and “Ready when every detail holds.”
- **Wordmark and signature color:** the existing HOLLYWOOD SHOE wordmark/mark and Hollywood Oxblood `#6E1F2E` remain the private studio’s brand anchors.

## Product studio flow
1. Verified admin selects **Create Product**.
2. Upload accepts JPG/JPEG/PNG/WebP, supports multiple source views, previews each image, and preserves originals.
3. The image studio shows the source, isolation candidate and premium-result candidate. The client can choose **AI Auto Match**, add a custom background, regenerate a candidate, replace a source, and explicitly approve a candidate.
4. Product details include name, editable description, category, product type and SKU. The AI assistant can propose—but never auto-apply—description, highlights, SEO title/description and alt text.
5. Pricing validates values and previews an automatic original-price strike-through. Inventory models quantities per size. Badges and future home metadata are saved as product data only; public Home does not change.
6. Quality inspection reads product completeness and image approval state, marking only publish readiness. Incomplete records can always remain drafts.
7. Final review offers responsive product preview, Save Draft, schedule metadata and a separately confirmed Publish action. Published items remain editable, duplicable, unpublishable and restorable—permanent deletion is not the primary flow.

## Project structure
| Path | Responsibility |
|---|---|
| `server.ts` | Secure Express host, OAuth callback, authenticated API, input validation, rate/error handling, and static application serving |
| `server/db.ts` | Managed MySQL connection and idempotent additive schema initialization |
| `server/auth.ts` | OAuth state/session verification and role resolution |
| `server/product-service.ts` | Product, asset, status, scheduling and inventory persistence |
| `server/ai-service.ts` | Server-side modular image and writing AI pipeline adapters |
| `src/admin/*` | Private POST studio UI, upload flow, review worktable, forms, final inspection and management views |
| `src/main.tsx` | Public router left unchanged in visual behavior; checks role only to mount the protected private experience on `/post` |
| `src/styles.css` | Existing public styles remain unchanged; admin-specific styles are appended under isolated class selectors |
| `public/manus-routes.json` | Adds the protected POST route to the route manifest without exposing it in public navigation |

## Material constraints
The browser never receives database credentials, AI service keys or storage credentials. The actual Manus image service is only invoked by server endpoints after role authorization. Until secure admin configuration is provided, the login screen explains that the private studio requires an approved administrator; it never fabricates a user or bypasses authorization in Preview.
