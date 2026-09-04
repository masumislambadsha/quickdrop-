# 🚚 QuickDrop — Courier & Logistics Backend

A robust, scalable, and secure REST API backend for a **Courier & Logistics Platform**.
Built for the **B7A6** assignment.

**Stack:** Node.js · Express 5 · TypeScript · Prisma 7 · PostgreSQL · Zod · JWT · Stripe · Redis · Vercel

## ✨ Features

- **3 Roles with strict RBAC:** Customer, Courier, Admin
- **Authentication:** Email/Password + GCP (Google) Social Login, JWT access & refresh tokens
- **Shipment management:** create, track, search, soft-delete, paginated & filterable lists
- **Courier assignment** with transaction-safe, concurrency-safe booking (no double-booking)
- **Shipment status state machine** with strict transition rules
- **Delivery pricing engine** computed server-side
- **Real Stripe payment flow** (Checkout + verified webhook + status tracking)
- **Audit logging** for critical actions (status changes, role changes, assignments)
- **Redis caching** for hot reads (dashboard stats, search)
- **Rate limiting, security headers, validation, centralized error handling**

## 📦 Submission

```
Project Name    : QuickDrop — Courier & Logistics Platform
Backend Repo    : https://github.com/masumislambadsha/quickdrop-
Live API        : <vercel-url>
API Docs        : <postman-url>
Demo Video      : <video-url>
Admin Email     : admin@quickdrop.com
Admin Password  : Admin@1234
```

## 🛠 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Set up your environment file
cp .env.example .env
#  -> fill in DATABASE_URL, JWT secrets, Stripe, Google, Redis

# 3. Generate the Prisma client
npx prisma generate

# 4. Run the migrations
npx prisma migrate dev

# 5. Seed demo data (admin, customer, courier)
npm run db:seed

# 6. Start the server
npm run dev
```

## 🔐 Environment Variables

See `.env.example` for all variables. Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing keys |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe payment |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | GCP social login |
| `REDIS_URL` | Upstash/Redis for caching |
| `BACKEND_URL` / `FRONTEND_URL` | Server + CORS origins |

## 📚 API Documentation

The API is versioned under `/api/v1/`. A Postman collection is included/exported.
See [Postman docs](#) for full interactive documentation.

## ☁️ Deploy to Vercel

The API is pre-configured for Vercel (`vercel.json` + `src/server.ts` exports the Express app).
`npm run postinstall` regenerates the Prisma client automatically during install.

**Steps:**
1. Push the repo to GitHub (`main` branch).
2. Go to [vercel.com/new](https://vercel.com/new) → **Import** the repo → Framework preset **Other**.
3. In **Project Settings → Environment Variables**, add (same as `.env`):
   - `DATABASE_URL` (Prisma Postgres connection string)
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://<your-domain>/api/v1/auth/google/callback`
   - `REDIS_URL=` (optional; leave empty to degrade gracefully)
   - `BACKEND_URL=https://<your-domain>`, `FRONTEND_URL=<frontend-origin>`, `NODE_ENV=production`
4. Deploy. Open the generated URL — you should see the QuickDrop API health JSON.
5. **Run migrations** once (Vercel functions are stateless): from a terminal
   `npx prisma migrate deploy` using the production `DATABASE_URL`, then `npm run db:seed` to load demo data.

**Stripe webhook on production:** in the Stripe Dashboard → Developers → Webhooks, add `https://<your-domain>/api/v1/payments/webhook` and subscribe to `checkout.session.completed` and `checkout.session.async_payment_failed`. Copy the `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET`.

**Google OAuth on production:** in GCP OAuth Client, add `https://<your-domain>/api/v1/auth/google/callback` to **Authorized redirect URIs**.

## Scripts

```bash
npm run dev          # development with auto-reload
npm run build        # typecheck + emit to dist/
npm run start        # run build output
npm run db:migrate   # run prisma migrations
npm run db:seed      # seed demo data
npm run lint:check   # biome lint
npm run lint:fix
npm run format:check # biome format
npm run format:fix
```
