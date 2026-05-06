import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthProvider } from '../features/auth/auth-context'
import { ProtectedRoute, PublicOnlyRoute } from '../features/auth/route-guards'
import { SuperAdminShell } from '../layout/super-admin-shell'
import { LoginPage } from '../pages/login-page'
import { OverviewPage } from '../pages/overview-page'
import { TenantsPage } from '../pages/tenants-page'
import { PlansPage } from '../pages/plans-page'
import { SubscriptionsPage } from '../pages/subscriptions-page'
import { TenantFeaturesPage } from '../pages/tenant-features-page'
import { UsagePage } from '../pages/usage-page'
import { SupportPage } from '../pages/support-page'
import { BillingHistoryPage } from '../pages/billing-history-page'
import { OverdueSubscriptionsPage } from '../pages/overdue-subscriptions-page'
import { BusinessTypesPage } from '../pages/business-types-page'

function ProtectedProviders() {
  return (
    <AuthProvider>
      <ProtectedRoute />
    </AuthProvider>
  )
}

function PublicProviders() {
  return (
    <AuthProvider>
      <PublicOnlyRoute />
    </AuthProvider>
  )
}

export const appRouter = createBrowserRouter(
  [
  { path: '/', element: <Navigate to="/app/overview" replace /> },
  {
    element: <PublicProviders />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    element: <ProtectedProviders />,
    children: [
      {
        path: '/app',
        element: <SuperAdminShell />,
        children: [
          { path: '', element: <Navigate to="/app/overview" replace /> },
          { path: 'overview', element: <OverviewPage /> },
          { path: 'tenants', element: <TenantsPage /> },
          { path: 'plans', element: <PlansPage /> },
          { path: 'subscriptions', element: <SubscriptionsPage /> },
          { path: 'overdue-subscriptions', element: <OverdueSubscriptionsPage /> },
          { path: 'billing-history', element: <BillingHistoryPage /> },
          { path: 'tenant-features', element: <TenantFeaturesPage /> },
          { path: 'overdue', element: <Navigate to="/app/overdue-subscriptions" replace /> },
          { path: 'billing', element: <Navigate to="/app/billing-history" replace /> },
          { path: 'features', element: <Navigate to="/app/tenant-features" replace /> },
          { path: 'usage', element: <UsagePage /> },
          { path: 'support', element: <SupportPage /> },
          { path: 'business-types', element: <BusinessTypesPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/app/overview" replace /> },
  ],
  { basename: import.meta.env.VITE_BASE_PATH ?? '/' },
)
