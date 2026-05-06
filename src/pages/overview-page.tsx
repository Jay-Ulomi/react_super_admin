import { useEffect, useMemo, useState } from 'react'
import { fetchPlans, fetchSubscriptions, fetchTenants, type Plan, type Subscription, type Tenant } from '../features/super-admin/super-admin-api'
import { useToast } from '../features/ui/toast-context'

export function OverviewPage() {
  const toast = useToast()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
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
          const subs = await fetchSubscriptions()
          if (!cancelled) setSubscriptions(subs)
        } catch (subErr) {
          if (!cancelled)
            toast.info(subErr instanceof Error ? subErr.message : 'Unable to load subscriptions list')
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load overview')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const activeTenants = useMemo(() => tenants.filter((t) => t.isActive).length, [tenants])
  const activePlans = useMemo(() => plans.filter((p) => p.isActive).length, [plans])
  const pastDueCount = useMemo(
    () => tenants.filter((t) => (t.subscriptionStatus ?? '').toUpperCase() === 'PAST_DUE').length,
    [tenants],
  )

  return (
    <section className="space-y-4">
      {loading ? <p className="text-sm text-slate-500">Loading platform overview...</p> : null}

      {!loading ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Tenants</p>
              <p className="mt-1 font-display text-2xl text-slate-900">{tenants.length}</p>
              <p className="text-xs text-blue-700">Active: {activeTenants}</p>
            </article>
            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Plans</p>
              <p className="mt-1 font-display text-2xl text-slate-900">{plans.length}</p>
              <p className="text-xs text-blue-700">Active: {activePlans}</p>
            </article>
            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Past Due Tenants</p>
              <p className="mt-1 font-display text-2xl text-slate-900">{pastDueCount}</p>
              <p className="text-xs text-amber-700">Requires follow-up</p>
            </article>
            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Loaded Subscriptions</p>
              <p className="mt-1 font-display text-2xl text-slate-900">{subscriptions.length}</p>
              <p className="text-xs text-blue-700">Endpoint may need tenant-scoped token</p>
            </article>
          </div>
        </>
      ) : null}
    </section>
  )
}
