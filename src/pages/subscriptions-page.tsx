import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../features/ui/toast-context'
import {
  activateAdminSubscription,
  cancelAdminSubscription,
  changeAdminSubscriptionPlan,
  createAdminSubscription,
  fetchPlans,
  fetchAdminSubscriptions,
  fetchTenants,
  renewAdminSubscription,
  suspendAdminSubscription,
  type Plan,
  type Subscription,
  type Tenant,
} from '../features/super-admin/super-admin-api'
import { ApiError } from '../types/api'
import { parseFieldErrors, type FieldErrors } from '../lib/validation'
import { buildSearchParams, parseEnum, parseNonNegativeInt, parsePageSize } from '../lib/search-params'

export function SubscriptionsPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState<'all' | Subscription['status']>(
    parseEnum(
      searchParams.get('status'),
      ['all', 'ACTIVE', 'TRIAL', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'EXPIRED'] as const,
      'all',
    ),
  )
  const [sortBy, setSortBy] = useState<'planName' | 'status' | 'billingCycle' | 'id'>(
    parseEnum(searchParams.get('sortBy'), ['planName', 'status', 'billingCycle', 'id'] as const, 'planName'),
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    parseEnum(searchParams.get('sortDir'), ['asc', 'desc'] as const, 'asc'),
  )
  const [pageSize, setPageSize] = useState(parsePageSize(searchParams.get('size'), [10, 20, 50], 10))
  const [page, setPage] = useState(parseNonNegativeInt(searchParams.get('page'), 0))
  const [changePlanBySubId, setChangePlanBySubId] = useState<Record<string, string>>({})
  const [createForm, setCreateForm] = useState({
    tenantId: searchParams.get('tenantId') ?? '',
    planId: '',
    billingCycle: 'MONTHLY',
    startWithTrial: true,
    autoRenew: true,
  })

  const byStatus = useMemo(() => {
    const map = new Map<string, number>()
    for (const tenant of tenants) {
      const status = (tenant.subscriptionStatus || 'UNKNOWN').toUpperCase()
      map.set(status, (map.get(status) || 0) + 1)
    }
    return [...map.entries()]
  }, [tenants])

  const loadSubscriptionData = async () => {
    setLoading(true)
    try {
      const [tenantRows, planRows] = await Promise.all([fetchTenants(), fetchPlans()])
      setTenants(tenantRows)
      setPlans(planRows)
      const subRows = await fetchAdminSubscriptions()
      setSubscriptions(subRows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSubscriptionData()
  }, [])

  useEffect(() => {
    const next = buildSearchParams({
      tenantId: createForm.tenantId.trim() || undefined,
      q: search.trim() || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      sortBy: sortBy !== 'planName' ? sortBy : undefined,
      sortDir: sortDir !== 'asc' ? sortDir : undefined,
      page: page !== 0 ? page : undefined,
      size: pageSize !== 10 ? pageSize : undefined,
    })
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [
    createForm.tenantId,
    page,
    pageSize,
    search,
    searchParams,
    setSearchParams,
    sortBy,
    sortDir,
    statusFilter,
  ])

  useEffect(() => {
    if (plans.length && tenants.length) {
      setCreateForm((prev) => ({
        ...prev,
        tenantId: prev.tenantId || tenants[0].id,
        planId: prev.planId || plans[0].id,
      }))
    }
  }, [plans, tenants])

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setActing(true)
    try {
      await action()
      const subRows = await fetchAdminSubscriptions()
      setSubscriptions(subRows)
      toast.success(successMessage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Subscription action failed')
    } finally {
      setActing(false)
    }
  }

  const handleCreateSubscription = async () => {
    if (!createForm.tenantId || !createForm.planId) return
    setActing(true)
    setFieldErrors({})
    try {
      await createAdminSubscription({
        tenantId: createForm.tenantId,
        subscription: {
          planId: createForm.planId,
          billingCycle: createForm.billingCycle as 'MONTHLY' | 'ANNUAL',
          startWithTrial: createForm.startWithTrial,
          autoRenew: createForm.autoRenew,
        },
      })
      const subRows = await fetchAdminSubscriptions()
      setSubscriptions(subRows)
      toast.success('Subscription created successfully.')
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
        setFieldErrors(parseFieldErrors(err.errors))
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to create subscription')
      }
    } finally {
      setActing(false)
    }
  }

  const filteredAndSorted = useMemo(() => {
    const searched = subscriptions.filter((sub) => {
      const query = search.trim().toLowerCase()
      if (!query) return true
      return (
        sub.id.toLowerCase().includes(query) ||
        (sub.planName || '').toLowerCase().includes(query) ||
        (sub.status || '').toLowerCase().includes(query) ||
        (sub.billingCycle || '').toLowerCase().includes(query)
      )
    })

    const statusFiltered =
      statusFilter === 'all' ? searched : searched.filter((sub) => sub.status === statusFilter)

    return [...statusFiltered].sort((a, b) => {
      const aRaw = String(a[sortBy] ?? '').toLowerCase()
      const bRaw = String(b[sortBy] ?? '').toLowerCase()
      if (aRaw === bRaw) return 0
      const cmp = aRaw > bRaw ? 1 : -1
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [pageSize, search, sortBy, sortDir, statusFilter, subscriptions])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pagedSubscriptions = filteredAndSorted.slice(safePage * pageSize, safePage * pageSize + pageSize)

  return (
    <section className="space-y-4">
      {loading ? <p className="text-sm text-slate-500">Loading subscription insights...</p> : null}

      <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-display text-xl text-slate-900">Tenant Subscription Status (from Tenants)</h2>
        <div className="flex flex-wrap gap-2">
          {byStatus.map(([status, count]) => (
            <span key={status} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              {status}: {count}
            </span>
          ))}
        </div>
      </article>

      <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-display text-lg text-slate-900">Subscription Operations</h3>
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-600">
            This page uses platform-admin subscription endpoints across tenants.
          </p>
        </div>

        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="mb-2 text-sm font-semibold text-blue-900">Create Subscription</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            <select
              value={createForm.tenantId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, tenantId: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Select tenant</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
            <select
              value={createForm.planId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, planId: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
            <select
              value={createForm.billingCycle}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, billingCycle: event.target.value }))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="MONTHLY">MONTHLY</option>
              <option value="ANNUAL">ANNUAL</option>
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={createForm.startWithTrial}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, startWithTrial: event.target.checked }))
                }
              />
              Start with Trial
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={createForm.autoRenew}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, autoRenew: event.target.checked }))}
              />
              Auto Renew
            </label>
          </div>
          {fieldErrors.tenantId ? <p className="mt-2 text-xs text-rose-700">{fieldErrors.tenantId}</p> : null}
          {fieldErrors.planId ? <p className="mt-2 text-xs text-rose-700">{fieldErrors.planId}</p> : null}
          <button
            type="button"
            onClick={() => void handleCreateSubscription()}
            disabled={acting || !createForm.tenantId || !createForm.planId}
            className="mt-3 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-70"
          >
            Create Subscription
          </button>
        </div>

        {subscriptions.length ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(0)
                }}
                placeholder="Search subscription"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as 'all' | Subscription['status'])
                  setPage(0)
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="TRIAL">TRIAL</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PAST_DUE">PAST_DUE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="CANCELED">CANCELED</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
              <select
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as 'planName' | 'status' | 'billingCycle' | 'id')
                  setPage(0)
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="planName">Sort: Plan</option>
                <option value="status">Sort: Status</option>
                <option value="billingCycle">Sort: Billing</option>
                <option value="id">Sort: ID</option>
              </select>
              <select
                value={sortDir}
                onChange={(event) => {
                  setSortDir(event.target.value as 'asc' | 'desc')
                  setPage(0)
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value))
                  setPage(0)
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value={10}>10 rows</option>
                <option value={20}>20 rows</option>
                <option value={50}>50 rows</option>
              </select>
            </div>
            <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-medium">ID</th>
                  <th className="px-2 py-2 font-medium">Tenant</th>
                  <th className="px-2 py-2 font-medium">Plan</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Billing</th>
                  <th className="px-2 py-2 font-medium">Auto Renew</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedSubscriptions.length ? (
                  pagedSubscriptions.map((sub) => (
                    <tr key={sub.id} className="border-b border-slate-100">
                    <td className="px-2 py-3 font-semibold text-slate-800">{sub.id.slice(0, 8)}...</td>
                    <td className="px-2 py-3 text-slate-700">{sub.tenantName || sub.tenantId.slice(0, 8)}</td>
                    <td className="px-2 py-3 text-slate-700">{sub.planName}</td>
                    <td className="px-2 py-3 text-slate-700">{sub.status}</td>
                    <td className="px-2 py-3 text-slate-600">{sub.billingCycle || '-'}</td>
                    <td className="px-2 py-3 text-slate-600">{sub.autoRenew ? 'Yes' : 'No'}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(
                              async () => void activateAdminSubscription(sub.id),
                              'Subscription activated.',
                            )
                          }
                          disabled={acting}
                          className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-70"
                        >
                          Activate
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(
                              async () => void suspendAdminSubscription(sub.id),
                              'Subscription suspended.',
                            )
                          }
                          disabled={acting}
                          className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-70"
                        >
                          Suspend
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const reason = window.prompt('Cancel reason (optional):') || undefined
                            void runAction(
                              async () => void cancelAdminSubscription(sub.id, { cancelReason: reason }),
                              'Subscription canceled.',
                            )
                          }}
                          disabled={acting}
                          className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-70"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runAction(
                              async () => void renewAdminSubscription(sub.id),
                              'Subscription renewed.',
                            )
                          }
                          disabled={acting}
                          className="rounded-lg border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-70"
                        >
                          Renew
                        </button>
                        <select
                          value={changePlanBySubId[sub.id] ?? ''}
                          onChange={(event) =>
                            setChangePlanBySubId((prev) => ({ ...prev, [sub.id]: event.target.value }))
                          }
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="">Select Plan</option>
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const planId = changePlanBySubId[sub.id]
                            if (!planId) return
                            void runAction(
                              async () => void changeAdminSubscriptionPlan(sub.id, planId),
                              'Subscription plan changed.',
                            )
                          }}
                          disabled={acting || !changePlanBySubId[sub.id]}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-70"
                        >
                          Change Plan
                        </button>
                      </div>
                    </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-2 py-6 text-center text-sm text-slate-500">
                      No subscriptions match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            <div className="flex items-center justify-between text-sm">
              <p className="text-slate-600">
                Showing {pagedSubscriptions.length} of {filteredAndSorted.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                  disabled={safePage === 0}
                  className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Prev
                </button>
                <span className="text-slate-600">
                  Page {safePage + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => (prev + 1 < totalPages ? prev + 1 : prev))}
                  disabled={safePage + 1 >= totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No direct subscription rows loaded.</p>
        )}
      </article>
    </section>
  )
}
