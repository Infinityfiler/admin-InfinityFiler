# Infinity Filer — Admin Portal

A full-stack business management admin portal secured behind Supabase Auth with role-based access.

## Architecture

### Structure
- **Admin Portal** (`/`) — React SPA secured behind Supabase Auth (role-based admin login). Accessed via `https://admin.infinityfiler.com`
- **Customer Portal** (`/portal/:token`) — Public branded portal (no auth required), one link per customer. Tabs: Orders, Invoices, Profile (editable), Documents (upload/delete). All activity tracked.

### Tech Stack
- **Frontend**: React + TypeScript + Vite, Tailwind CSS + shadcn/ui, TanStack React Query, wouter routing
- **Backend**: Express.js (Node.js), TypeScript via `tsx`
- **Database**: Supabase PostgreSQL — accessed via `@supabase/supabase-js` (service role key) and direct PostgreSQL for migrations
- **Auth**: Supabase Auth with JWT validation, role-based access (admin/customer)
- **Storage**: Dropbox integration for order document storage (OAuth callback at `/api/dropbox/callback` — no auth middleware since it's a browser redirect from Dropbox)
- **Security**: Helmet.js, express-rate-limit, RLS on all 24 tables

### Security Architecture
- **Backend uses `SUPABASE_SERVICE_ROLE_KEY`** — bypasses RLS, trusted intermediary for admin operations
- **`supabaseAuth` client** uses anon key — only for auth operations (signIn, signUp, resetPassword)
- **RLS enabled on all 22 tables** — blocks direct anon key access from outside the app
- **RLS policies**: Customers can only see their own data (`auth.uid()::text = auth_user_id`); services/bundles/payment methods readable by all authenticated users
- **Admin routes**: All `/api/` data routes protected by `requireAdmin` middleware (validates JWT + checks `role === 'admin'`)
- **Auth routes**: `/api/auth/*` public but rate-limited (10 requests/minute per IP)

## Project Structure

```
client/                 React admin portal frontend
  src/
    pages/              Page components (Dashboard, Orders, Customers, Invoices, etc.)
    components/         Shared UI components
    hooks/              Custom React hooks
    lib/
      auth.ts           Admin auth state management (token, user, refresh)
      queryClient.ts    TanStack Query client with auth headers
server/
  index.ts              Entry point — Express + Helmet + Vite
  routes.ts             All admin API routes (requireAdmin protected)
  auth.ts               Auth helpers, middleware (requireAuth, requireAdmin)
  auth-routes.ts        Auth API endpoints (/api/auth/*)
  storage.ts            Supabase data access layer
  supabase.ts           Two Supabase clients (service role + anon for auth)
  migrate.ts            Database migrations + RLS setup
  dropbox.ts            Dropbox OAuth + file operations
  vite.ts               Vite dev server (serves admin portal at /)
  static.ts             Production static file serving
shared/
  schema.ts             Shared TypeScript types and Zod schemas
```

## Auth System

### Admin Auth Flow
1. Admin navigates to `/` → sees login page
2. Submits credentials → `POST /api/auth/admin-login`
3. Validates via Supabase Auth, checks `user_metadata.role === 'admin'`
4. Returns JWT (stored in memory) + refresh token (stored in localStorage)
5. All subsequent API calls include `Authorization: Bearer <token>`
6. On 401, auto-refreshes token; if refresh fails, redirects to login

### Customer Auth API Endpoints (for external public website)
- `POST /api/auth/customer-signup` — creates customer via Supabase Auth anon client
- `POST /api/auth/customer-login` — customer sign-in
- `POST /api/auth/verify-callback` — called after email verification, creates customer record
- `POST /api/auth/forgot-password` — triggers password reset
- `POST /api/auth/reset-password` — completes reset

### One-Time Admin Setup
- `POST /api/auth/setup-admin` — creates first admin user (disabled after `admin_setup_complete` flag set in company_settings)

## Customer Schema Notes

- `auth_user_id` TEXT column links Supabase Auth user to `customers` table
- `referral_code` and `referral_username` auto-generated on creation
- `state_province` field (not `state`), `residential_address` (not `address`)
- Phone stored as `{dialCode} {localNumber}` (e.g., "+92 3203682461")
- `CustomerFormFields` component reused across pages

## Profit/Loss System

- When marking an invoice as "Paid" (either via status dropdown or when a payment reaches the full total), a P&L dialog appears
- Admin enters cost per invoice line item; revenue, profit, and margin auto-calculate
- P&L entries stored in `profit_loss_entries` table with full cost breakdown
- **Dedicated P&L Dashboard** at `/profit-loss` (sidebar: "Profit & Loss" with TrendingUp icon, after Compliance):
  - Summary cards: Gross Revenue, Total Expenses, Net Income, Avg Margin, Profitable/Loss counts
  - Tax Summary / Income Statement with quarterly breakdown
  - Monthly Breakdown table with running totals
  - Category Breakdown table (profit by service type)
  - Detailed Entries table — sortable, expandable rows showing cost breakdown per line item, clickable invoice links
  - Date filtering with presets (This Month, Last Month, This Quarter, This Year, Last Year, All Time)
  - Excel export (multi-sheet: Summary, Monthly, Quarterly, Category, Entries, Line Items)
  - PDF export (print-optimized professional layout with company header)
- Summary API (`GET /api/profit-loss?startDate&endDate`) provides monthly and category breakdowns
- Entries API (`GET /api/profit-loss/entries?startDate&endDate`) supports date filtering
- Admin can skip P&L entry if desired

## Environment Variables

Set in `.replit` `[userenv.shared]`:
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_NAME`, `SUPABASE_DB_USER`
- `DROPBOX_APP_KEY` — Dropbox OAuth app key

Required secrets (set in Replit Secrets):
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (bypasses RLS)
- `SUPABASE_ANON_KEY` — Supabase anonymous API key (auth operations only)
- `SUPABASE_DB_PASSWORD` — Database password
- `DROPBOX_APP_SECRET` — Dropbox OAuth (optional)

## Key Features

- Dashboard with stats, auto-overdue marking, compliance sync
- Customer management with referral tracking
- Orders with services, documents, activity logs, compliance
- Invoice creation with partner discount auto-application
- Profit/Loss tracking per invoice (triggered on marking as paid)
- Payment Proof system: customers upload proof via portal (Dropbox + WhatsApp), admin verifies/declines on invoice detail with full/partial payment recording
  - DB table: `payment_proofs` (invoice_id, customer_id, amount_claimed, file_name, dropbox_path, dropbox_view_link, status, admin_note)
  - Portal endpoint: `POST /api/portal/:token/invoices/:invoiceId/payment-proof` (multipart upload)
  - Admin endpoints: `GET /api/invoices/:id/payment-proofs`, `PATCH /api/payment-proofs/:proofId`
  - Dropbox shared links via `createDropboxSharedLink()` in `server/dropbox.ts`
- Compliance tracking (annual reports, federal tax deadlines)
- SMTP email sending, reminders, multi-payment methods
- Dropbox document storage
- Referral Partners with per-service discount rates
- Customer Portal Links (one link per customer, auto-generated on invoice creation)
  - Admin: Generate/revoke/reactivate links, view activity logs, share via WhatsApp/Email
  - Customer: View orders/invoices (click for full detail), edit profile (3 tabs: Orders, Invoices, My Profile — Documents tab removed, documents managed within orders)
  - Invoice detail: full view with line items, payment progress, PKR section, PDF download, "Send Proof of Payment" WhatsApp button (uploads to Dropbox, sends shareable link via wa.me), "Referred By" display (from referral partner or customer.referred_by), clickable order number link (cross-tab navigation to Orders tab)
  - Order detail: service progress tracking (view-only), formation dates, document upload (tagged as Customer/Admin), activity log, clickable invoice link (cross-tab navigation to Invoices tab), "Referred By" display
  - Cross-tab navigation: clicking invoice link in order detail switches to Invoices tab and auto-opens that invoice; clicking order link in invoice detail switches to Orders tab and auto-opens that order (via pendingInvoiceId/pendingOrderId state)
  - Order chat: Floating chat widget (circular button, bottom-right) with popup chatbox — shared `FloatingChat` component used by both admin and customer portal. 5s polling, auth headers via ref, unread badge, file attachments with view/download buttons (programmatic fetch with auth headers), sender badges (Admin/Customer) on messages and file attachments. Chat file uploads also create `order_documents` entries (prefixed with `[Chat]`). Admin FloatingChat is rendered at `App.tsx` level (outside SidebarProvider) via `AdminFloatingChat` component using `useRoute("/orders/:id")` to detect order pages. Portal FloatingChat renders directly inside `customer-portal.tsx`. Scrolling contained within chat popup only.
  - Chat read receipts: `read_at` column on `order_chats` table tracks when messages are read. When chat is opened, other party's unread messages are marked as read via `POST .../chats/read`. Sent messages show single check (sent) or double blue check (read). Unread count badge on floating chat button persists across page loads (database-backed). Admin endpoint: `POST /api/orders/:id/chats/read`; Portal endpoint: `POST /api/portal/:token/orders/:orderId/chats/read`.
  - Activity tracking: page views, profile updates, document uploads/deletes, chat messages
  - Share buttons on Invoice Detail, Order Detail, Customer Detail pages
  - Send Invoice dialog (WhatsApp default + Email) after invoice creation
  - DB tables: `customer_portal_links`, `link_activity_log`, `order_chats`
  - `order_documents` has `uploaded_by` column ('admin' or 'customer') for tagging

## Development

```bash
npm run dev       # Start dev server (port 5000)
npm run build     # Build for production
npm run start     # Run production build
```

## Deployment

- Target: Autoscale
- Build: `npm run build`
- Run: `node ./dist/index.cjs`
