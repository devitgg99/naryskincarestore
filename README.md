# 🛒 Wholesale Portal System

A full-featured internal wholesale inventory and invoicing management system built for a small retail/wholesale business. Supports product pricing, supplier management, customer directory, invoice generation, sales logs, stock tracking, and brand categorization.

---

## 📦 Current Tech Stack

### Frontend
| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | **React** | ^19.x | Component-based SPA |
| Build Tool | **Vite** | ^8.x | Fast HMR dev server + production bundler |
| Language | **JavaScript (JSX)** | ES2022+ | No TypeScript currently |
| Styling | **Tailwind CSS v4** | ^4.x | Utility-first CSS, custom `@theme` tokens |
| Icons | **Lucide React** | ^1.x | SVG icon library |
| Animations | **canvas-confetti** | ^1.9.x | Confetti on invoice save |
| Fonts | **Google Fonts** | — | Inter + Outfit via CDN |

### Backend / Data Layer
| Layer | Technology | Notes |
|---|---|---|
| Primary Database | **Supabase** (PostgreSQL) | Cloud-hosted, accessed via REST API |
| Supabase Client | **@supabase/supabase-js** | ^2.x — direct browser-to-database calls |
| Offline Fallback | **Browser LocalStorage** | Full mock data fallback when Supabase is not configured |
| Auth | None (owner-only tool) | Credentials stored in `.env` |

### Database Schema (Supabase / PostgreSQL)
Tables managed in [`supabase_schema.sql`](./supabase_schema.sql):

| Table | Purpose |
|---|---|
| `products` | Product catalog with name (EN + KH), base price, selling price override, brand |
| `suppliers` | Supplier contact info |
| `supplier_prices` | Per-product, per-supplier pricing and stock quantities |
| `customers` | Customer directory with phone and location |
| `orders` | Invoice / order headers |
| `order_items` | Line items per order |
| `brands` | Product brand categories |

### Project Structure
```
WholeSalePortal/
├── src/
│   ├── App.jsx                  # Root layout, global state, routing
│   ├── index.css                # Tailwind theme tokens, utilities, print styles
│   ├── main.jsx                 # React DOM entry point
│   ├── components/
│   │   ├── Sidebar.jsx          # Navigation sidebar
│   │   └── SupabaseSettingsModal.jsx  # DB config modal
│   ├── modules/
│   │   ├── PricingTable.jsx     # Product/supplier pricing CRUD
│   │   ├── CustomerDirectory.jsx# Customer management & order history
│   │   ├── InvoiceBuilder.jsx   # Draft invoices, POS search, receipt preview
│   │   ├── SalesLog.jsx         # Historical orders and revenue view
│   │   ├── StockTracker.jsx     # Low stock alerts and inventory overview
│   │   └── BrandManager.jsx     # Brand CRUD with bulk product association
│   └── services/
│       ├── db.js                # Unified data layer (Supabase + localStorage)
│       └── mockData.js          # Seed data for offline/localStorage mode
├── scripts/
│   ├── seed.js                  # Node.js Supabase data seeder
│   └── generate_seed.js         # CSV-to-seed data transformer
├── supabase_schema.sql          # Full DB schema DDL
├── vite.config.js
├── tailwind.config.js
└── package.json
```

### Dev & Build Scripts
```bash
npm run dev      # Start local dev server (http://localhost:5173)
npm run build    # Production bundle to /dist
npm run lint     # ESLint check
npm run preview  # Preview production build locally
npm run seed     # Run Supabase seed script (requires .env)
```

### Environment Variables (`.env`)
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 🔧 Module Features

| Module | Key Features |
|---|---|
| **Pricing Table** | Add/Edit/Delete products & supplier prices, brand filter, custom selling price override |
| **Customer Directory** | Customer CRUD, per-customer order history and revenue totals |
| **Invoice Builder** | POS-style quick add, batch catalog modal, brand filter, draft receipt preview (with profit analysis), save & print |
| **Sales Log** | Order history, revenue, delivery fees, per-order item breakdown |
| **Stock Tracker** | Low stock alerts (≤2 qty), hide/show alerts, brand filter |
| **Brand Manager** | Create/edit/delete brands, bulk assign products via searchable checklist |

---

## 🚀 Upgrade Path — Migrating to Next.js + New Backend

If you want to scale this system beyond a single-owner tool (e.g., multi-user, server-side auth, custom API layer), here is a recommended migration path:

---

### Option A — Next.js + Supabase (Recommended — Minimal Disruption)

Keep Supabase as the database but move to Next.js with server-side data fetching and Row-Level Security (RLS) for proper auth.

**What changes:**
- Replace `Vite + React SPA` → `Next.js App Router (React Server Components)`
- Move Supabase calls from the browser client into **Next.js Server Actions** or **Route Handlers** (`/app/api/...`)
- Add Supabase Auth (email/password or magic link) for login-protected routes
- Replace `localStorage` fallback with proper server-side state

**Migration steps:**
1. Scaffold: `npx create-next-app@latest wholesale-portal-next --app --js`
2. Install Supabase SSR client: `npm install @supabase/ssr @supabase/supabase-js`
3. Move each module (`PricingTable`, `InvoiceBuilder`, etc.) into `app/(dashboard)/pricing/page.jsx` etc.
4. Replace `db.js` browser calls with server-side `createServerClient()` from `@supabase/ssr`
5. Enable Supabase RLS policies and add auth middleware in `middleware.js`
6. Re-use all existing Tailwind CSS and component logic with minimal changes

---

### Option B — Next.js + Custom REST API Backend

Replace Supabase with your own backend server. Good if you want full control of business logic.

**Recommended backend options:**

| Backend | Language | Best For |
|---|---|---|
| **Node.js + Express** | JavaScript | Easiest migration (same JS stack) |
| **Node.js + Fastify** | JavaScript | Faster, schema-validated APIs |
| **NestJS** | TypeScript | Enterprise-grade, modular architecture |
| **Django REST Framework** | Python | If you prefer Python |
| **Laravel** | PHP | If you prefer PHP ecosystem |

**Database options to pair with your backend:**

| Database | Notes |
|---|---|
| **PostgreSQL** (direct) | Keep the same schema, drop Supabase wrapper |
| **MySQL / MariaDB** | Minor schema adjustments needed |
| **MongoDB** | Schema-less, requires full data layer rewrite |

**Migration steps:**
1. Build a REST API backend with routes matching current db.js operations:
   - `GET/POST/PUT/DELETE /api/products`
   - `GET/POST /api/orders` + `/api/order-items`
   - `GET/POST/DELETE /api/brands`
   - `GET/POST/PUT/DELETE /api/customers`
   - `GET/POST/PUT/DELETE /api/supplier-prices`
2. Scaffold Next.js frontend: `npx create-next-app@latest`
3. Replace `db.js` with a `fetch()`-based API client or use a library like **TanStack Query** (`@tanstack/react-query`) for caching and mutations
4. Add auth layer (e.g., **NextAuth.js** / **Auth.js** with JWT or session cookies)
5. Migrate modules page-by-page into `app/` directory structure

---

### Option C — Full TypeScript Upgrade (Frontend Only)

If staying on Vite + React but want stronger type safety:

1. Rename `*.jsx` → `*.tsx` and `*.js` → `*.ts`
2. Add TypeScript: `npm install -D typescript @types/react @types/react-dom`
3. Create `tsconfig.json` (Vite has a ready-made template)
4. Define interfaces for all data models:
   ```ts
   interface Product { id: string; name_en: string; name_kh: string; base_price: number; selling_price?: number; brand_id?: string; }
   interface Order { id: string; customer_id: string; delivery_fee: number; total_amount: number; ordered_at: string; }
   // etc.
   ```
5. Type the `db.js` service return values

---

## 📝 Notes

- The system currently runs **entirely in the browser** — there is no backend server process. All API calls go directly from the React app to Supabase's REST endpoints.
- When Supabase credentials are not configured, the app automatically falls back to **LocalStorage** with seeded mock data so it remains fully usable offline.
- Print styles are handled via `@media print` in `index.css` — elements with `.no-print` are hidden and `.print-only` elements are shown when printing receipts.
- Khmer language (ភាសាខ្មែរ) is used in product names and receipt headers for local market compatibility.
