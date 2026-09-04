# QuickDrop — Demo Video Walkthrough Outline

A 5–8 minute screencast showing the required features. Record 1080p, screen-capture your
terminal + Postman, narrate briefly. Script order below maps to the assignment rubric.

---

## 1. Intro & Project Overview (~30s)
- Name: **QuickDrop — Courier & Logistics Platform** (B7A6 assignment)
- Stack: Node.js · Express 5 · TypeScript · Prisma 7 · PostgreSQL (Prisma Postgres) · Zod · JWT · Stripe · Redis · Vercel
- Show the repo + README on GitHub.

## 2. Architecture & Repo Tour (~45s)
- Open the file tree: `src/app/module/{auth,user,shipment,delivery,payment,admin}`.
- Point out: layered pattern (route → controller → service → Prisma), middleware, utils.
- Show `prisma/schema/*.prisma` — the 8 models + enums + relations + indexes.
- Mention shared response `{ success, message, data, meta }` and centralized error handling.

## 3. Auth + RBAC (3 roles) (~60s)
- `POST /api/v1/auth/register` (Customer).
- `POST /api/v1/auth/login` → shows access + refresh tokens (cookies set).
- "Wrong password" → 401; validation error → 400 with `errors[]`.
- Demo the **3 fixed roles**: CUSTOMER / COURIER / ADMIN.
- RBAC: show a `CUSTOMER` hitting an admin-only endpoint → `403 Forbidden`.

## 4. Shipments — create, pricing, tracking (~60s)
- `POST /api/v1/shipments` (Customer) → returns auto `trackingNumber` (e.g. `QD-XXXXXX`) + server-computed `cost`.
- `GET /api/v1/shipments/:id`.
- `GET /api/v1/shipments/track/:trackingNumber` (**public**) → timeline (trackingEvents).
- Search + filter + pagination: `GET /api/v1/shipments?page=1&limit=10&status=IN_TRANSIT&search=rahim` → `meta`.
- Soft delete (`DELETE /shipments/:id`) → hidden from lists but row remains.

## 5. Courier assignment + state machine (~60s)
- Admin `POST /api/v1/deliveries/:shipmentId/assign-courier` → delivery created, courier busy.
- Attempt to assign a **busy** courier → `409` (transaction-safe, concurrency-safe).
- Shipment status state machine — show an invalid transition → `400`.
- `GET /api/v1/deliveries/assigned` (courier).

## 6. Delivery workflow (~45s)
- Courier advances delivery: `PATCH /deliveries/:id/status` PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY.
- `POST /deliveries/:id/confirm` with the **passcode** → shipment DELIVERED, courier freed.
- Wrong passcode → 400.

## 7. Stripe Payment (~60s)
- `POST /api/v1/payments` (Customer) → real Stripe Checkout session URL.
- Open session, pay with test card `4242 4242 4242 4242`.
- Stripe webhook → payment flips PENDING → PAID, shipment `paymentStatus: PAID`.
- Show idempotency: re-pay → "Payment already processed."
- Show webhook handler returns 400 on missing/invalid signature (security).

## 8. Admin dashboard + audit + hardening (~45s)
- `GET /api/v1/admin/dashboard-stats` (Redis-cached) → totals: shipments, revenue, in-transit, etc.
- RBAC: customer/courier hitting `/admin/*` → 403.
- `GET /api/v1/admin/audit-logs` → trail of actions.
- `PATCH /admin/users/:id/role` and `/status`; blocked user cannot log in.
- Security: helmet headers, rate limiting (429 after threshold), JWT expiry + refresh.

## 9. Performance (~15s)
- DB indexes on `@@index` in schema; `select` subset queries; Prisma transactions; Redis cache key (`admin:dashboard:stats`).

## 10. Deployment + Docs + Wrap-up (~30s)
- Vercel live URL (open `/health`).
- Postman collection link.
- Demo credentials:
  - Admin `admin@quickdrop.com / Admin@1234`
  - Customer `customer@quickdrop.com / Customer@1234`
  - Courier `courier@quickdrop.com / Courier@1234`
- Close: link repo, live API, docs, video.

---

## Downloadable demo credentials reminder
| Role | Email | Password |
|---|---|---|
| Admin | admin@quickdrop.com | Admin@1234 |
| Customer | customer@quickdrop.com | Customer@1234 |
| Courier | courier@quickdrop.com | Courier@1234 |
| Courier 2 | courier2@quickdrop.com | Courier@1234 |

## Postman test tips
- Send cookies are enabled for the localhost host (Settings → cookie jar).
- Stripe webhook on localhost requires `stripe listen --forward-to http://localhost:5000/api/v1/payments/webhook`.
- Google login: use the helper `node scripts/google-login-helper.mjs` or paste an idToken into
  `POST /api/v1/auth/google/login { "idToken": "..." }`.