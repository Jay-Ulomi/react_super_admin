import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../features/ui/toast-context'
import {
  cancelAdminInvoice,
  fetchAdminInvoices,
  fetchAdminInvoicesBySubscription,
  markAdminInvoicePaid,
  type Invoice,
  type InvoiceStatus,
} from '../features/billing/billing-api'
import {
  fetchAdminSubscriptions,
  fetchTenants,
  type Subscription,
  type Tenant,
} from '../features/super-admin/super-admin-api'
import { buildSearchParams, parseEnum, parseNonNegativeInt, parsePageSize } from '../lib/search-params'

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

function statusBadgeClass(status: InvoiceStatus): string {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-100 text-emerald-800'
    case 'PENDING':
      return 'bg-amber-100 text-amber-800'
    case 'OVERDUE':
      return 'bg-rose-100 text-rose-800'
    case 'CANCELED':
      return 'bg-slate-200 text-slate-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function csvEscape(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return ''
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function downloadCsv(filename: string, rows: string[][]): void {
  const content = rows.map((row) => row.join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function BillingHistoryPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null)
  const [detailRelated, setDetailRelated] = useState<Invoice[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [tenantFilter, setTenantFilter] = useState(searchParams.get('tenantId') ?? '')
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>(
    parseEnum(searchParams.get('status'), ['all', 'PENDING', 'PAID', 'OVERDUE', 'CANCELED'] as const, 'all'),
  )
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>(
    parseEnum(searchParams.get('paid'), ['all', 'paid', 'unpaid'] as const, 'all'),
  )
  const [fromDate, setFromDate] = useState(searchParams.get('from') ?? '')
  const [toDate, setToDate] = useState(searchParams.get('to') ?? '')
  const [sortBy, setSortBy] = useState<'issuedDate' | 'dueDate' | 'amount' | 'status' | 'invoiceNumber'>(
    parseEnum(
      searchParams.get('sortBy'),
      ['issuedDate', 'dueDate', 'amount', 'status', 'invoiceNumber'] as const,
      'issuedDate',
    ),
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    parseEnum(searchParams.get('sortDir'), ['asc', 'desc'] as const, 'desc'),
  )
  const [pageSize, setPageSize] = useState(parsePageSize(searchParams.get('size'), [10, 20, 50, 100], 20))
  const [page, setPage] = useState(parseNonNegativeInt(searchParams.get('page'), 0))

  const tenantById = useMemo(() => {
    const map = new Map<string, Tenant>()
    for (const tenant of tenants) map.set(tenant.id, tenant)
    return map
  }, [tenants])

  const subscriptionById = useMemo(() => {
    const map = new Map<string, Subscription>()
    for (const sub of subscriptions) map.set(sub.id, sub)
    return map
  }, [subscriptions])

  const loadAdminInvoices = async () => {
    const page = await fetchAdminInvoices({ size: 1000 })
    setInvoices(page.content ?? [])
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const [tenantRows, subRows] = await Promise.all([fetchTenants(), fetchAdminSubscriptions()])
        if (cancelled) return
        setTenants(tenantRows)
        setSubscriptions(subRows)
        await loadAdminInvoices()
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load billing data')
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
      tenantId: tenantFilter || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      paid: paidFilter !== 'all' ? paidFilter : undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      sortBy: sortBy !== 'issuedDate' ? sortBy : undefined,
      sortDir: sortDir !== 'desc' ? sortDir : undefined,
      page: page !== 0 ? page : undefined,
      size: pageSize !== 20 ? pageSize : undefined,
    })
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [
    fromDate,
    page,
    pageSize,
    paidFilter,
    search,
    searchParams,
    setSearchParams,
    sortBy,
    sortDir,
    statusFilter,
    tenantFilter,
    toDate,
  ])

  const runAction = async (op: () => Promise<unknown>, successMessage: string) => {
    setActing(true)
    try {
      await op()
      await loadAdminInvoices()
      toast.success(successMessage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invoice action failed.')
    } finally {
      setActing(false)
    }
  }

  const openDetail = async (invoice: Invoice) => {
    setDetailInvoice(invoice)
    setDetailRelated([])
    setDetailLoading(true)
    try {
      const related = await fetchAdminInvoicesBySubscription(invoice.subscriptionId)
      setDetailRelated(related)
    } catch {
      setDetailRelated([])
    } finally {
      setDetailLoading(false)
    }
  }

  const filteredAndSorted = useMemo(() => {
    const query = search.trim().toLowerCase()
    const from = fromDate ? new Date(fromDate).getTime() : null
    const to = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null

    const result = invoices.filter((invoice) => {
      if (query) {
        const tenantName = (tenantById.get(invoice.tenantId)?.name || '').toLowerCase()
        const subPlan = (subscriptionById.get(invoice.subscriptionId)?.planName || '').toLowerCase()
        if (
          !invoice.invoiceNumber.toLowerCase().includes(query) &&
          !tenantName.includes(query) &&
          !subPlan.includes(query) &&
          !(invoice.currency || '').toLowerCase().includes(query)
        ) {
          return false
        }
      }
      if (tenantFilter && invoice.tenantId !== tenantFilter) return false
      if (statusFilter !== 'all' && invoice.status !== statusFilter) return false
      if (paidFilter === 'paid' && invoice.status !== 'PAID') return false
      if (paidFilter === 'unpaid' && invoice.status === 'PAID') return false
      if (from || to) {
        const issued = invoice.issuedDate ? new Date(invoice.issuedDate).getTime() : null
        if (issued === null) return false
        if (from !== null && issued < from) return false
        if (to !== null && issued > to) return false
      }
      return true
    })

    return [...result].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'amount') {
        cmp = (a.amount ?? 0) - (b.amount ?? 0)
      } else if (sortBy === 'issuedDate' || sortBy === 'dueDate') {
        const av = a[sortBy] ? new Date(a[sortBy] as string).getTime() : 0
        const bv = b[sortBy] ? new Date(b[sortBy] as string).getTime() : 0
        cmp = av - bv
      } else {
        const av = String(a[sortBy] ?? '').toLowerCase()
        const bv = String(b[sortBy] ?? '').toLowerCase()
        if (av === bv) cmp = 0
        else cmp = av > bv ? 1 : -1
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [fromDate, invoices, paidFilter, search, sortBy, sortDir, statusFilter, subscriptionById, tenantById, tenantFilter, toDate])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pagedInvoices = filteredAndSorted.slice(safePage * pageSize, safePage * pageSize + pageSize)

  const handleExportCsv = () => {
    const header = [
      'Invoice #',
      'Tenant',
      'Plan',
      'Amount',
      'Currency',
      'Status',
      'Issued',
      'Due',
      'Paid',
    ]
    const body = filteredAndSorted.map((invoice) => [
      csvEscape(invoice.invoiceNumber),
      csvEscape(tenantById.get(invoice.tenantId)?.name ?? invoice.tenantId),
      csvEscape(subscriptionById.get(invoice.subscriptionId)?.planName ?? ''),
      csvEscape(invoice.amount),
      csvEscape(invoice.currency),
      csvEscape(invoice.status),
      csvEscape(formatDate(invoice.issuedDate)),
      csvEscape(formatDate(invoice.dueDate)),
      csvEscape(formatDate(invoice.paidDate)),
    ])
    downloadCsv(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...body])
    toast.success(`Exported ${body.length} invoice${body.length === 1 ? '' : 's'} to CSV.`)
  }

  const totalAmount = useMemo(
    () => filteredAndSorted.reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0),
    [filteredAndSorted],
  )
  const unpaidAmount = useMemo(
    () =>
      filteredAndSorted
        .filter((invoice) => invoice.status !== 'PAID' && invoice.status !== 'CANCELED')
        .reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0),
    [filteredAndSorted],
  )

  return (
    <section className="space-y-4">
      {loading ? <p className="text-sm text-slate-500">Loading billing history...</p> : null}

      <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl text-slate-900">Invoices</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Total: {formatMoney(totalAmount, filteredAndSorted[0]?.currency)}
            </span>
            <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
              Unpaid: {formatMoney(unpaidAmount, filteredAndSorted[0]?.currency)}
            </span>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!filteredAndSorted.length}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-6">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
            placeholder="Search invoice"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={tenantFilter}
            onChange={(event) => {
              setTenantFilter(event.target.value)
              setPage(0)
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All Tenants</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as 'all' | InvoiceStatus)
              setPage(0)
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="PAID">PAID</option>
            <option value="OVERDUE">OVERDUE</option>
            <option value="CANCELED">CANCELED</option>
          </select>
          <select
            value={paidFilter}
            onChange={(event) => {
              setPaidFilter(event.target.value as 'all' | 'paid' | 'unpaid')
              setPage(0)
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
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
            <option value={100}>100 rows</option>
          </select>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value)
                setPage(0)
              }}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            To
            <input
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value)
                setPage(0)
              }}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="issuedDate">Sort: Issued</option>
            <option value="dueDate">Sort: Due</option>
            <option value="amount">Sort: Amount</option>
            <option value="status">Sort: Status</option>
            <option value="invoiceNumber">Sort: Invoice #</option>
          </select>
          <select
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value as 'asc' | 'desc')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>

        {!loading ? (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">Invoice #</th>
                    <th className="px-2 py-2 font-medium">Tenant</th>
                    <th className="px-2 py-2 font-medium">Plan</th>
                    <th className="px-2 py-2 font-medium">Amount</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Issued</th>
                    <th className="px-2 py-2 font-medium">Due</th>
                    <th className="px-2 py-2 font-medium">Paid</th>
                    <th className="px-2 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedInvoices.length ? (
                    pagedInvoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-slate-100">
                        <td className="px-2 py-3 font-semibold text-slate-800">{invoice.invoiceNumber}</td>
                        <td className="px-2 py-3 text-slate-700">
                          {tenantById.get(invoice.tenantId)?.name ?? `${invoice.tenantId.slice(0, 8)}...`}
                        </td>
                        <td className="px-2 py-3 text-slate-600">
                          {subscriptionById.get(invoice.subscriptionId)?.planName ?? '-'}
                        </td>
                        <td className="px-2 py-3 text-slate-700">
                          {formatMoney(invoice.amount, invoice.currency)}
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(invoice.status)}`}
                          >
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-slate-600">{formatDate(invoice.issuedDate)}</td>
                        <td className="px-2 py-3 text-slate-600">{formatDate(invoice.dueDate)}</td>
                        <td className="px-2 py-3 text-slate-600">{formatDate(invoice.paidDate)}</td>
                        <td className="px-2 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void openDetail(invoice)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View
                            </button>
                            {invoice.status !== 'PAID' && invoice.status !== 'CANCELED' ? (
                              <button
                                type="button"
                                disabled={acting}
                                onClick={() =>
                                  void runAction(
                                    async () => void (await markAdminInvoicePaid(invoice.id)),
                                    `Invoice ${invoice.invoiceNumber} marked paid.`,
                                  )
                                }
                                className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-70"
                              >
                                Mark Paid
                              </button>
                            ) : null}
                            {invoice.status !== 'CANCELED' && invoice.status !== 'PAID' ? (
                              <button
                                type="button"
                                disabled={acting}
                                onClick={() => {
                                  if (!window.confirm(`Cancel invoice ${invoice.invoiceNumber}?`)) return
                                  void runAction(
                                    async () => void (await cancelAdminInvoice(invoice.id)),
                                    `Invoice ${invoice.invoiceNumber} canceled.`,
                                  )
                                }}
                                className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-70"
                              >
                                Cancel
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-2 py-6 text-center text-sm text-slate-500">
                        No invoices loaded for the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-sm">
              <p className="text-slate-600">
                Showing {pagedInvoices.length} of {filteredAndSorted.length}
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
        ) : null}
      </article>

      {detailInvoice ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-blue-100 bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl text-slate-900">Invoice {detailInvoice.invoiceNumber}</h3>
              <button
                type="button"
                onClick={() => setDetailInvoice(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Tenant</p>
                <p className="font-semibold text-slate-800">
                  {tenantById.get(detailInvoice.tenantId)?.name ?? detailInvoice.tenantId}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Plan</p>
                <p className="font-semibold text-slate-800">
                  {subscriptionById.get(detailInvoice.subscriptionId)?.planName ?? '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Amount</p>
                <p className="font-semibold text-slate-800">
                  {formatMoney(detailInvoice.amount, detailInvoice.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <p>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(detailInvoice.status)}`}
                  >
                    {detailInvoice.status}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Issued</p>
                <p className="text-slate-700">{formatDate(detailInvoice.issuedDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Due</p>
                <p className="text-slate-700">{formatDate(detailInvoice.dueDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Paid</p>
                <p className="text-slate-700">{formatDate(detailInvoice.paidDate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Subscription</p>
                <p className="text-slate-700">{detailInvoice.subscriptionId.slice(0, 8)}...</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Subscription Invoice History
              </p>
              <p className="mb-2 text-xs text-slate-500">
                Backend does not expose per-invoice line items or payment events; showing sibling invoices on the same subscription.
              </p>
              {detailLoading ? (
                <p className="text-sm text-slate-500">Loading related invoices...</p>
              ) : detailRelated.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead className="border-b border-slate-200 text-left text-slate-500">
                      <tr>
                        <th className="px-2 py-1 font-medium">Invoice #</th>
                        <th className="px-2 py-1 font-medium">Amount</th>
                        <th className="px-2 py-1 font-medium">Status</th>
                        <th className="px-2 py-1 font-medium">Issued</th>
                        <th className="px-2 py-1 font-medium">Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRelated.map((related) => (
                        <tr key={related.id} className="border-b border-slate-100">
                          <td className="px-2 py-1 font-semibold text-slate-700">{related.invoiceNumber}</td>
                          <td className="px-2 py-1">{formatMoney(related.amount, related.currency)}</td>
                          <td className="px-2 py-1">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(related.status)}`}
                            >
                              {related.status}
                            </span>
                          </td>
                          <td className="px-2 py-1 text-slate-600">{formatDate(related.issuedDate)}</td>
                          <td className="px-2 py-1 text-slate-600">{formatDate(related.paidDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No related invoices found.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
