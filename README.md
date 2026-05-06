# React Super Admin

Platform-level admin app for SaaS POS operator team.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4

## Run

1. `npm install`
2. `cp .env.example .env`
3. `npm run dev`

## Current Scope

- Tailwind configured with Vite plugin.
- Auth/session flow:
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
- Context switch flow:
  - `POST /api/auth/switch-context`
- Protected routes:
  - `/login`
  - `/app/overview`
  - `/app/tenants`
  - `/app/plans`
  - `/app/subscriptions`
  - `/app/features`
  - `/app/usage`
  - `/app/support`
- Live backend integrations:
  - `GET /api/tenants`
  - `POST /api/tenants`
  - `PATCH /api/tenants/{id}`
  - `DELETE /api/tenants/{id}`
  - `GET /api/plans/admin/all`
  - `POST /api/plans`
  - `PATCH /api/plans/{id}`
  - `DELETE /api/plans/{id}`
  - `GET /api/subscriptions` (tenant-scoped; UI handles limitation for platform-admin tokens)
  - `POST /api/subscriptions`
  - `POST /api/subscriptions/{id}/activate`
  - `POST /api/subscriptions/{id}/suspend`
  - `POST /api/subscriptions/{id}/cancel`
  - `POST /api/subscriptions/{id}/renew`
  - `POST /api/subscriptions/{id}/change-plan`
  - `GET /api/features/tenants/{tenantId}`
  - `PUT /api/features/tenants/{tenantId}`
  - `DELETE /api/features/tenants/{tenantId}/{featureName}`
- List UX and state persistence:
  - URL query persistence for `tenants`, `plans`, `subscriptions` filters/pagination.
  - Consistent empty states and success notices for create/update/delete/actions.
  - Shared query-param helpers in `src/lib/search-params.ts`.
- Platform operations dashboards:
  - Usage analytics dashboard based on tenants/plans/subscriptions aggregates.
  - Support dashboard with actionable tenant queues and operational shortcuts.
  - Optional backend summary endpoints (auto-used when available, with fallback aggregation):
    - `GET /api/admin/usage/summary`
    - `GET /api/admin/support/summary`

## Step 12 Status

- React Super Admin scope is implemented for:
  - tenant management
  - plan management
  - subscription operations
  - tenant feature overrides
  - usage dashboard
  - support dashboard
- API contract for optional summary endpoints:
  - `docs/super-admin-summary-endpoints.openapi.yaml`

## Build

- `npm run build`
