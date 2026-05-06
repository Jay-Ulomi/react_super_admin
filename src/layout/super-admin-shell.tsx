import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../features/auth/auth-context'

const nav = [
  { to: '/app/overview', label: 'Overview' },
  { to: '/app/tenants', label: 'Tenants' },
  { to: '/app/plans', label: 'Plans' },
  { to: '/app/subscriptions', label: 'Subscriptions' },
  { to: '/app/overdue-subscriptions', label: 'Overdue' },
  { to: '/app/billing-history', label: 'Billing History' },
  { to: '/app/tenant-features', label: 'Features' },
  { to: '/app/business-types', label: 'Business Types' },
  { to: '/app/usage', label: 'Usage' },
  { to: '/app/support', label: 'Support' },
]

export function SuperAdminShell() {
  const { session, logout } = useAuth()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex w-full flex-wrap items-center justify-between gap-2 border-b border-blue-100 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Platform Summary</p>
          <h1 className="font-display text-xl text-slate-900 md:text-2xl">SaaS POS Super Admin</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">{session?.email}</div>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex w-full items-start gap-3 px-3 py-3 md:h-[calc(100vh-76px)] md:gap-4 md:overflow-hidden md:px-4 md:py-4">
        <aside className="hidden w-64 shrink-0 self-start rounded-2xl border border-blue-100 bg-white/90 p-4 shadow-sm backdrop-blur md:block md:h-full md:overflow-y-auto">
          <div className="mb-8 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-700 text-sm font-bold text-white">
              SA
            </div>
            <div>
              <p className="font-display text-sm text-blue-700">Super Admin</p>
              <p className="text-xs text-slate-500">Platform Control</p>
            </div>
          </div>
          <nav className="space-y-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-blue-700 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 md:h-full md:overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
