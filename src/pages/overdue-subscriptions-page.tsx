import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../features/ui/toast-context'
import {
  cancelAdminSubscription,
  fetchAdminSubscriptions,
  fetchTenants,
  suspendAdminSubscription,
  updateTenant,
  type Subscription,
  type Tenant,
} from '../features/super-admin/super-admin-api'
import { fetchAdminInvoices, type Invoice } from '../features/billing/billing-api'
import { buildSearchParams, parseEnum, parseNonNegativeInt, parsePageSize } from '../lib/search-params'

type AgingBucket = '1-7' | '8-30' | '31-60' | '60+'

type OverdueRow = {
  subscription?: Subscription
  tenant: Tenant
  amountDue: number
  currency?: string
  daysOverdue: number
  lastPaymentDate?: string
  oldestDueDate?: string
  nextAction: string
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function bucketFor(days: number): AgingBucket | null {
  if (days <= 0) return null
  if (days <= 7) return '1-7'
  if (days <= 30) return '8-30'
  if (days <= 60) return '31-60'
  return '60+'
}

function formatDate(value?: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toISOString().slice(0, 10)
}

function formatMoney(amount: number, currency?: string): string {
  const safe = Number.isFinite(amount) ? amount : 0
  return `${currency || 'TZS'} ${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function OverdueSubscriptionsPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [bucketFilter, setBucketFilter] = useState<'all' | AgingBucket>(
    parseEnum(searchParams.get('bucket'), ['all', '1-7', '8-30', '31-60', '60+'] as const, 'all'),
  )
  const [sortBy, setSortBy] = useState<'daysOverdue' | 'amountDue' | 'tenant'>(
    parseEnum(searchParams.get('sortBy'), ['daysOverdue', 'amountDue', 'tenant'] as const, 'daysOverdue'),
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    parseEnum(searchParams.get('sortDir'), ['asc', 'desc'] as const, 'desc'),
  )
  const [pageSize, setPageSize] = useState(parsePageSize(searchParams.get('size'), [10, 20, 50], 20))
  const [page, setPage] = useState(parseNonNegativeInt(searchParams.get('page'), 0))

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const tenantRows = await fetchTenants()
        if (cancelled) return
        setTenants(tenantRows)
        const [subs, invPage] = await Promise.all([
          fetchAdminSubscriptions(),
          fetchAdminInvoices({ size: 500 }),
        ])
        if (cancelled) return
        setSubscriptions(subs)
        setInvoices(invPage.content ?? [])
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load overdue view')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const next = buildSearchParams({
      q: search.trim() || undefined,
      bucket: bucketFilter !== 'all' ? bucketFilter : undefined,
      sortBy: sortBy !== 'daysOverdue' ? sortBy : undefined,
      sortDir: sortDir !== 'desc' ? sortDir : undefined,
      page: page !== 0 ? page : undefined,
      size: pageSize !== 20 ? pageSize : undefined,
    })
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [
    bucketFilter,
    page,
    pageSize,
    search,
    searchParams,
    setSearchParams,
    sortBy,
    sortDir,
  ])

  // Build overdue rows. Source of truth is:
  // 1) tenants whose subscriptionStatus === PAST_DUE (always visible),
  // 2) subscriptions whose status === PAST_DUE or EXPIRED,
  // 3) invoices with status === OVERDUE or unpaid past dueDate (for amount + days).
  const rows = useMemo<OverdueRow[]>(() => {
    const now = new Date()
    const tenantById = new Map(tenants.map((t) => [t.id, t]))
    const subsByTenant = new Map<string, Subscription[]>()
    for (const sub of subscriptions) {
      const list = subsByTenant.get(sub.tenantId) ?? []
      list.push(sub)
      subsByTenant.set(sub.tenantId, list)
    }

    const invoicesByTenant = new Map<string, Invoice[]>()
    for (const invoice of invoices) {
      const list = invoicesByTenant.get(invoice.tenantId) ?? []
      list.push(invoice)
      invoicesByTenant.set(invoice.tenantId, list)
    }

    const candidateTenantIds = new Set<string>()
    for (const tenant of tenants) {
      if ((tenant.subscriptionStatus || '').toUpperCase() === 'PAST_DUE') candidateTenantIds.add(tenant.id)
    }
    for (const sub of subscriptions) {
      const status = (sub.status || '').toUpperCase()
      if (status === 'PAST_DUE' || status === 'EXPIRED') candidateTenantIds.add(sub.tenantId)
    }
    for (const invoice of invoices) {
      if (invoice.status === 'OVERDUE') candidateTenantIds.add(invoice.tenantId)
      else if (invoice.status === 'PENDING' && invoice.dueDate) {
        const due = new Date(invoice.dueDate)
        if (!Number.isNaN(due.getTime()) && due < now) candidateTenantIds.add(invoice.tenantId)
      }
    }

    const result: OverdueRow[] = []
    for (const tenantId of candidateTenantIds) {
      const tenant = tenantById.get(tenantId)
      if (!tenant) continue
      const tenantSubs = subsByTenant.get(tenantId) ?? []
      const primarySub =
        tenantSubs.find((sub) => (sub.status || '').toUpperCase() === 'PAST_DUE') ??
        tenantSubs.find((sub) => (sub.status || '').toUpperCase() === 'EXPIRED') ??
        tenantSubs[0]
      const tenantInvoices = invoicesByTenant.get(tenantId) ?? []
      const unpaidInvoices = tenantInvoices.filter(
        (inv) => inv.status === 'OVERDUE' || (inv.status === 'PENDING' && inv.dueDate && new Date(inv.dueDate) < now),
      )
      const paidInvoices = tenantInvoices.filter((inv) => inv.status === 'PAID' && inv.paidDate)
      const lastPayment = paidInvoices
        .map((inv) => new Date(inv.paidDate!))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0]
      const oldestDue = unpaidInvoices
        .map((inv) => (inv.dueDate ? new Date(inv.dueDate) : null))
        .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime())[0]
      const amountDue = unpaidInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
      const currency = unpaidInvoices[0]?.currency
      const daysOverdue = oldestDue ? Math.max(0, daysBetween(oldestDue, now)) : 0

      let nextAction = 'Send reminder'
      if (daysOverdue >= 60) nextAction = 'Escalate / Suspend'
      else if (daysOverdue >= 31) nextAction = 'Final notice'
      else if (daysOverdue >= 8) nextAction = 'Follow-up call'

      result.push({
        subscription: primarySub,
        tenant,
        amountDue,
        currency,
        daysOverdue,
        lastPaymentDate: lastPayment?.toISOString(),
        oldestDueDate: oldestDue?.toISOString(),
        nextAction,
      })
    }
    return result
  }, [invoices, subscriptions, tenants])

  const bucketCounts = useMemo(() => {
    const counts: Record<AgingBucket, number> = { '1-7': 0, '8-30': 0, '31-60': 0, '60+': 0 }
    for (const row of rows) {
      const bucket = bucketFor(row.daysOverdue)
      if (bucket) counts[bucket] += 1
    }
    return counts
  }, [rows])

  const totalOutstanding = useMemo(
    () => rows.reduce((sum, row) => sum + row.amountDue, 0),
    [rows],
  )

  const filteredAndSorted = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = rows.filter((row) => {
      if (query) {
        const name = row.tenant.name.toLowerCase()
        const planName = (row.subscription?.planName || '').toLowerCase()
        if (!name.includes(query) && !planName.includes(query) && !row.tenant.slug.toLowerCase().includes(query)) {
          return false
        }
      }
      if (bucketFilter !== 'all') {
        const bucket = bucketFor(row.daysOverdue)
        if (bucket !== bucketFilter) return false
      }
      return true
    })
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'amountDue') cmp = a.amountDue - b.amountDue
      else if (sortBy === 'tenant') cmp = a.tenant.name.localeCompare(b.tenant.name)
      else cmp = a.daysOverdue - b.daysOverdue
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [bucketFilter, rows, search, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pagedRows = filteredAndSorted.slice(safePage * pageSize, safePage * pageSize + pageSize)

  const handleSendReminder = (row: OverdueRow) => {
    // Backend does not expose a cross-tenant "send reminder" notification endpoint today.
    // Surface a graceful message so this control is discoverable without fabricating calls.
    toast.info(
      `Reminder queued for ${row.tenant.name}. Backend tenant-outreach endpoint not yet available — log this as a manual follow-up.`,
    )
  }

  const handleSuspendSub = async (row: OverdueRow) => {
    if (!row.subscription) {
      toast.error('No subscription loaded for this tenant.')
      return
    }
    if (!window.confirm(`Suspend subscription for "${row.tenant.name}"?`)) return
    setActing(true)
    try {
      await suspendAdminSubscription(row.subscription.id)
      const subs = await fetchAdminSubscriptions()
      setSubscriptions(subs)
      toast.success(`Subscription suspended for ${row.tenant.name}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Suspend failed')
    } finally {
      setActing(false)
    }
  }

  const handleSuspendTenant = async (row: OverdueRow) => {
    if (!window.confirm(`Deactivate tenant "${row.tenant.name}"?`)) return
    setActing(true)
    try {
      await updateTenant(row.tenant.id, { isActive: false })
      const rows = await fetchTenants()
      setTenants(rows)
      toast.success(`Tenant ${row.tenant.name} deactivated.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Tenant suspension failed')
    } finally {
      setActing(false)
    }
  }

  const handleWaive = async (row: OverdueRow) => {
    if (!row.subscription) {
      toast.error('No subscription loaded for this tenant.')
      return
    }
    const reason = window.prompt(`Waive overdue for "${row.tenant.name}"? Enter reason:`, 'Goodwill waiver')
    if (reason === null) return
    setActing(true)
    try {
      await cancelAdminSubscription(row.subscription.id, { cancelReason: reason || 'Waived' })
      const subs = await fetchAdminSubscriptions()
      setSubscriptions(subs)
      toast.success(`Subscription waived/canceled for ${row.tenant.name}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Waive failed')
    } finally {
      setActing(false)
    }
  }

  return (
    <section className="space-y-4">
      {loading ? <p className="text-sm text-slate-500">Loading overdue subscriptions...</p> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.14em] text-rose-800">Overdue Tenants</p>
          <p className="mt-1 font-display text-2xl text-rose-900">{rows.length}</p>
          <p className="mt-1 text-xs text-rose-700">Total outstanding: {formatMoney(totalOutstanding, rows[0]?.currency)}</p>
        </article>
        {(['1-7', '8-30', '31-60', '60+'] as const).map((bucket) => (
          <article
            key={bucket}
            className={`rounded-2xl border p-4 shadow-sm ${
              bucket === '60+'
                ? 'border-rose-300 bg-rose-100'
                : bucket === '31-60'
                  ? 'border-amber-300 bg-amber-100'
                  : bucket === '8-30'
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-blue-100 bg-white'
            }`}
          >
            <p className="text-xs uppercase tracking-[0.14em] text-slate-600">{bucket} days</p>
            <p className="mt-1 font-display text-2xl text-slate-900">{bucketCounts[bucket]}</p>
          </article>
        ))}
      </div>

      <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl text-slate-900">Overdue Accounts</h2>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-6">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
            placeholder="Search tenant"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={bucketFilter}
            onChange={(event) => {
              setBucketFilter(event.target.value as 'all' | AgingBucket)
              setPage(0)
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="all">All Ages</option>
            <option value="1-7">1-7 days</option>
            <option value="8-30">8-30 days</option>
            <option value="31-60">31-60 days</option>
            <option value="60+">60+ days</option>
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="daysOverdue">Sort: Days Overdue</option>
            <option value="amountDue">Sort: Amount Due</option>
            <option value="tenant">Sort: Tenant</option>
          </select>
          <select
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value as 'asc' | 'desc')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
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
                <th className="px-2 py-2 font-medium">Tenant</th>
                <th className="px-2 py-2 font-medium">Plan</th>
                <th className="px-2 py-2 font-medium">Amount Due</th>
                <th className="px-2 py-2 font-medium">Days Overdue</th>
                <th className="px-2 py-2 font-medium">Last Payment</th>
                <th className="px-2 py-2 font-medium">Next Action</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length ? (
                pagedRows.map((row) => (
                  <tr key={row.tenant.id} className="border-b border-slate-100">
                    <td className="px-2 py-3">
                      <p className="font-semibold text-slate-800">{row.tenant.name}</p>
                      <p className="text-xs text-slate-500">{row.tenant.contactEmail || row.tenant.contactPhone || 'No contact'}</p>
                    </td>
                    <td className="px-2 py-3 text-slate-700">{row.subscription?.planName ?? '-'}</td>
                    <td className="px-2 py-3 text-slate-700">
                      {row.amountDue > 0 ? formatMoney(row.amountDue, row.currency) : '-'}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          row.daysOverdue >= 60
                            ? 'bg-rose-200 text-rose-900'
                            : row.daysOverdue >= 31
                              ? 'bg-amber-200 text-amber-900'
                              : row.daysOverdue >= 8
                                ? 'bg-amber-100 text-amber-800'
                                : row.daysOverdue >= 1
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {row.daysOverdue > 0 ? `${row.daysOverdue}d` : 'Status-only'}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-slate-600">{formatDate(row.lastPaymentDate)}</td>
                    <td className="px-2 py-3 text-slate-700">{row.nextAction}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSendReminder(row)}
                          className="rounded-lg border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          Send Reminder
                        </button>
                        <button
                          type="button"
                          disabled={acting || !row.subscription}
                          onClick={() => void handleSuspendSub(row)}
                          title={row.subscription ? 'Suspend subscription' : 'No subscription loaded'}
                          className="rounded-lg border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                        >
                          Suspend Sub
                        </button>
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => void handleSuspendTenant(row)}
                          className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                        >
                          Suspend Tenant
                        </button>
                        <button
                          type="button"
                          disabled={acting || !row.subscription}
                          onClick={() => void handleWaive(row)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Waive
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-sm text-slate-500">
                    No overdue accounts match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm">
          <p className="text-slate-600">
            Showing {pagedRows.length} of {filteredAndSorted.length}
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

        {rows.some((row) => row.oldestDueDate && formatDate(row.oldestDueDate) !== '-') ? (
          <p className="mt-3 text-xs text-slate-500">
            Aging calculated from oldest unpaid invoice due date.
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            Days-overdue precision is limited when no overdue invoice dates are present yet.
          </p>
        )}
      </article>
    </section>
  )
}
