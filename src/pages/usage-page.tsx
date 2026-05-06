import { useEffect, useMemo, useState } from 'react'
import {
  fetchPlans,
  fetchSubscriptions,
  fetchTenants,
  fetchUsageSummary,
  type Plan,
  type Subscription,
  type Tenant,
  type UsageSummary,
} from '../features/super-admin/super-admin-api'
import { useToast } from '../features/ui/toast-context'

export function UsagePage() {
  const toast = useToast()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const [tenantRows, planRows] = await Promise.all([fetchTenants(), fetchPlans()])
        if (cancelled) return
        setTenants(tenantRows)
        setPlans(planRows)

        try {
          const summary = await fetchUsageSummary()
          if (!cancelled) setUsageSummary(summary)
        } catch (usageErr) {
          if (!cancelled) {
            setUsageSummary(null)
            toast.info(
              usageErr instanceof Error
                ? `${usageErr.message}. Using derived usage analytics from available endpoints.`
                : 'Using derived usage analytics from available endpoints.',
            )
          }
        }

        try {
          const rows = await fetchSubscriptions()
          if (!cancelled) setSubscriptions(rows)
        } catch (subErr) {
          if (!cancelled) {
            toast.info(
              subErr instanceof Error
                ? `${subErr.message}. Subscription analytics are partial until tenant context is switched.`
                : 'Subscription analytics are partial until tenant context is switched.',
            )
          }
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load usage analytics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const tenantStatus = useMemo(() => {
    if (usageSummary?.tenantStatusMix) {
      return Object.entries(usageSummary.tenantStatusMix).sort((a, b) => b[1] - a[1])
    }
    const map = new Map<string, number>()
    for (const tenant of tenants) {
      const key = (tenant.subscriptionStatus || 'UNKNOWN').toUpperCase()
      map.set(key, (map.get(key) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [tenants, usageSummary?.tenantStatusMix])

  const subscriptionsByPlan = useMemo(() => {
    if (usageSummary?.subscriptionsByPlan) {
      return Object.entries(usageSummary.subscriptionsByPlan).sort((a, b) => b[1] - a[1])
    }
    const map = new Map<string, number>()
    for (const sub of subscriptions) {
      const key = sub.planName || 'Unknown Plan'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [subscriptions, usageSummary?.subscriptionsByPlan])

  const activePlans = usageSummary?.activePlans ?? plans.filter((plan) => plan.isActive).length
  const activeTenants = usageSummary?.activeTenants ?? tenants.filter((tenant) => tenant.isActive).length
  const totalTenants = usageSummary?.totalTenants ?? tenants.length
  const totalPlans = usageSummary?.totalPlans ?? plans.length
  const loadedSubscriptions = usageSummary?.loadedSubscriptions ?? subscriptions.length
  const catalogUtilizationPct = usageSummary?.catalogUtilizationPct
  const fallbackCatalogUtilizationPct = totalPlans ? Math.round((activePlans / totalPlans) * 100) : 0

  return (
    <section className="space-y-4">
      {loading ? <p className="text-sm text-slate-500">Loading usage analytics...</p> : null}

      {!loading ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Total Tenants</p>
              <p className="mt-1 font-display text-2xl text-slate-900">{totalTenants}</p>
              <p className="text-xs text-blue-700">Active: {activeTenants}</p>
            </article>
            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Plans</p>
              <p className="mt-1 font-display text-2xl text-slate-900">{totalPlans}</p>
              <p className="text-xs text-blue-700">Active: {activePlans}</p>
            </article>
            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Loaded Subscriptions</p>
              <p className="mt-1 font-display text-2xl text-slate-900">{loadedSubscriptions}</p>
              <p className="text-xs text-slate-500">Tenant-scoped endpoint</p>
            </article>
            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Catalog Utilization</p>
              <p className="mt-1 font-display text-2xl text-slate-900">
                {Math.round(catalogUtilizationPct ?? fallbackCatalogUtilizationPct)}%
              </p>
              <p className="text-xs text-blue-700">Active plans ratio</p>
            </article>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-display text-lg text-slate-900">Tenant Subscription Status Mix</h3>
              {tenantStatus.length ? (
                <div className="space-y-2">
                  {tenantStatus.map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <span className="text-sm font-medium text-slate-700">{status}</span>
                      <span className="text-sm font-semibold text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No tenant usage data available.</p>
              )}
            </article>

            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-display text-lg text-slate-900">Loaded Subscriptions by Plan</h3>
              {subscriptionsByPlan.length ? (
                <div className="space-y-2">
                  {subscriptionsByPlan.map(([planName, count]) => (
                    <div
                      key={planName}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <span className="text-sm text-slate-700">{planName}</span>
                      <span className="text-sm font-semibold text-slate-900">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No subscription rows loaded yet. Switch tenant context in Subscriptions page to enrich this view.
                </p>
              )}
            </article>
          </div>
        </>
      ) : null}
    </section>
  )
}
