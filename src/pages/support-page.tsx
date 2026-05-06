import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  fetchSubscriptions,
  fetchSupportSummary,
  fetchTenants,
  type Subscription,
  type SupportQueueItem,
  type SupportSummary,
  type Tenant,
} from '../features/super-admin/super-admin-api'
import {
  fetchSupportTicket,
  fetchSupportTickets,
  replyToSupportTicket,
  updateSupportTicket,
  type SupportTicket,
  type SupportTicketDetail,
  type TicketPriority,
  type TicketStatus,
} from '../features/support/support-api'
import { useToast } from '../features/ui/toast-context'
import { buildSearchParams, parseEnum } from '../lib/search-params'

function formatDate(value?: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toISOString().replace('T', ' ').slice(0, 16)
}

function priorityBadge(priority: TicketPriority): string {
  switch (priority) {
    case 'URGENT':
      return 'bg-rose-200 text-rose-900'
    case 'HIGH':
      return 'bg-rose-100 text-rose-800'
    case 'NORMAL':
      return 'bg-slate-100 text-slate-700'
    case 'LOW':
      return 'bg-slate-100 text-slate-500'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

function statusBadge(status: TicketStatus): string {
  switch (status) {
    case 'OPEN':
      return 'bg-blue-100 text-blue-800'
    case 'PENDING':
      return 'bg-amber-100 text-amber-800'
    case 'RESOLVED':
      return 'bg-emerald-100 text-emerald-800'
    case 'CLOSED':
      return 'bg-slate-200 text-slate-700'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

export function SupportPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [supportSummary, setSupportSummary] = useState<SupportSummary | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [ticketsAvailable, setTicketsAvailable] = useState<boolean>(false)
  const [ticketsErrorMessage, setTicketsErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailTicket, setDetailTicket] = useState<SupportTicketDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [acting, setActing] = useState(false)

  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>(
    parseEnum(searchParams.get('status'), ['all', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const, 'all'),
  )
  const [priorityFilter, setPriorityFilter] = useState<'all' | TicketPriority>(
    parseEnum(searchParams.get('priority'), ['all', 'LOW', 'NORMAL', 'HIGH', 'URGENT'] as const, 'all'),
  )
  const [tenantFilter, setTenantFilter] = useState(searchParams.get('tenantId') ?? '')
  const [fromDate, setFromDate] = useState(searchParams.get('from') ?? '')
  const [toDate, setToDate] = useState(searchParams.get('to') ?? '')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const tenantRows = await fetchTenants()
        if (cancelled) return
        setTenants(tenantRows)

        try {
          const summary = await fetchSupportSummary()
          if (!cancelled) setSupportSummary(summary)
        } catch {
          if (!cancelled) setSupportSummary(null)
        }

        try {
          const subRows = await fetchSubscriptions()
          if (!cancelled) setSubscriptions(subRows)
        } catch {
          // tenant-scoped; may be empty
        }

        try {
          const ticketRows = await fetchSupportTickets()
          if (!cancelled) {
            setTickets(ticketRows)
            setTicketsAvailable(true)
            setTicketsErrorMessage(null)
          }
        } catch (err) {
          if (!cancelled) {
            setTickets([])
            setTicketsAvailable(false)
            setTicketsErrorMessage(err instanceof Error ? err.message : 'Ticketing backend unavailable.')
          }
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load support data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [toast])

  useEffect(() => {
    const next = buildSearchParams({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      priority: priorityFilter !== 'all' ? priorityFilter : undefined,
      tenantId: tenantFilter || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    })
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [statusFilter, priorityFilter, tenantFilter, fromDate, toDate, searchParams, setSearchParams])

  const tenantById = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants])

  const filteredTickets = useMemo(() => {
    const from = fromDate ? new Date(fromDate).getTime() : null
    const to = toDate ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null
    return tickets.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false
      if (tenantFilter && ticket.tenantId !== tenantFilter) return false
      if (from || to) {
        const updated = ticket.updatedAt ? new Date(ticket.updatedAt).getTime() : null
        if (updated === null) return false
        if (from !== null && updated < from) return false
        if (to !== null && updated > to) return false
      }
      return true
    })
  }, [tickets, statusFilter, priorityFilter, tenantFilter, fromDate, toDate])

  const pastDueTenants = useMemo(
    () => tenants.filter((tenant) => (tenant.subscriptionStatus || '').toUpperCase() === 'PAST_DUE'),
    [tenants],
  )
  const missingContactTenants = useMemo(
    () => tenants.filter((tenant) => !tenant.contactEmail && !tenant.contactPhone),
    [tenants],
  )
  const inactiveTenants = useMemo(() => tenants.filter((tenant) => !tenant.isActive), [tenants])
  const suspendedSubscriptions = useMemo(
    () => subscriptions.filter((sub) => (sub.status || '').toUpperCase() === 'SUSPENDED'),
    [subscriptions],
  )
  const priorityQueue = useMemo<SupportQueueItem[]>(() => {
    if (supportSummary?.priorityTenants?.length) return supportSummary.priorityTenants
    return pastDueTenants.slice(0, 8).map((tenant) => ({
      tenantId: tenant.id,
      tenantName: tenant.name,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      subscriptionStatus: tenant.subscriptionStatus,
    }))
  }, [pastDueTenants, supportSummary?.priorityTenants])

  const pastDueCount = supportSummary?.pastDueTenants ?? pastDueTenants.length
  const inactiveCount = supportSummary?.inactiveTenants ?? inactiveTenants.length
  const missingContactCount = supportSummary?.missingContactTenants ?? missingContactTenants.length
  const suspendedCount = supportSummary?.suspendedSubscriptions ?? suspendedSubscriptions.length

  const openDetail = async (ticket: SupportTicket) => {
    setDetailLoading(true)
    try {
      const detail = await fetchSupportTicket(ticket.id)
      setDetailTicket(detail)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load ticket detail')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleReply = async () => {
    if (!detailTicket || !replyBody.trim()) return
    setActing(true)
    try {
      await replyToSupportTicket(detailTicket.id, { body: replyBody.trim() })
      const refreshed = await fetchSupportTicket(detailTicket.id)
      setDetailTicket(refreshed)
      setReplyBody('')
      toast.success('Reply sent.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reply')
    } finally {
      setActing(false)
    }
  }

  const handleChangeStatus = async (status: TicketStatus) => {
    if (!detailTicket) return
    setActing(true)
    try {
      await updateSupportTicket(detailTicket.id, { status })
      const refreshed = await fetchSupportTicket(detailTicket.id)
      setDetailTicket(refreshed)
      const updatedList = await fetchSupportTickets()
      setTickets(updatedList)
      toast.success(`Ticket status updated to ${status}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update ticket')
    } finally {
      setActing(false)
    }
  }

  return (
    <section className="space-y-4">
      {loading ? <p className="text-sm text-slate-500">Loading support data...</p> : null}

      {!loading ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-sm text-amber-800">Past Due Tenants</p>
              <p className="mt-1 font-display text-2xl text-amber-900">{pastDueCount}</p>
            </article>
            <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
              <p className="text-sm text-rose-800">Inactive Tenants</p>
              <p className="mt-1 font-display text-2xl text-rose-900">{inactiveCount}</p>
            </article>
            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Missing Contact Info</p>
              <p className="mt-1 font-display text-2xl text-slate-900">{missingContactCount}</p>
            </article>
            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Suspended Subscriptions</p>
              <p className="mt-1 font-display text-2xl text-slate-900">{suspendedCount}</p>
            </article>
          </div>

          <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl text-slate-900">Support Tickets</h2>
              {!ticketsAvailable ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  Ticketing backend not yet available
                </span>
              ) : null}
            </div>

            {!ticketsAvailable ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">Support ticketing is not yet implemented on the backend.</p>
                <p className="mt-1 text-xs">
                  This page will auto-enable once <code className="rounded bg-white px-1">/api/admin/support/tickets</code> lands.
                  Meanwhile, use the derived priority queue below to follow up on at-risk tenants.
                </p>
                {ticketsErrorMessage ? (
                  <p className="mt-2 text-[11px] text-amber-700">Debug: {ticketsErrorMessage}</p>
                ) : null}
              </div>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-5">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as 'all' | TicketStatus)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="all">All Statuses</option>
                    <option value="OPEN">OPEN</option>
                    <option value="PENDING">PENDING</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                  <select
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value as 'all' | TicketPriority)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="all">All Priorities</option>
                    <option value="URGENT">URGENT</option>
                    <option value="HIGH">HIGH</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="LOW">LOW</option>
                  </select>
                  <select
                    value={tenantFilter}
                    onChange={(event) => setTenantFilter(event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">All Tenants</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-slate-200 text-left text-slate-500">
                      <tr>
                        <th className="px-2 py-2 font-medium">ID</th>
                        <th className="px-2 py-2 font-medium">Subject</th>
                        <th className="px-2 py-2 font-medium">Tenant</th>
                        <th className="px-2 py-2 font-medium">Priority</th>
                        <th className="px-2 py-2 font-medium">Status</th>
                        <th className="px-2 py-2 font-medium">Assigned</th>
                        <th className="px-2 py-2 font-medium">Updated</th>
                        <th className="px-2 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.length ? (
                        filteredTickets.map((ticket) => (
                          <tr key={ticket.id} className="border-b border-slate-100">
                            <td className="px-2 py-3 font-semibold text-slate-800">{ticket.id.slice(0, 8)}</td>
                            <td className="px-2 py-3 text-slate-700">{ticket.subject}</td>
                            <td className="px-2 py-3 text-slate-600">
                              {ticket.tenantName ?? tenantById.get(ticket.tenantId)?.name ?? ticket.tenantId}
                            </td>
                            <td className="px-2 py-3">
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${priorityBadge(ticket.priority)}`}>
                                {ticket.priority}
                              </span>
                            </td>
                            <td className="px-2 py-3">
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(ticket.status)}`}>
                                {ticket.status}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-slate-600">{ticket.assignedTo ?? '-'}</td>
                            <td className="px-2 py-3 text-slate-600">{formatDate(ticket.updatedAt)}</td>
                            <td className="px-2 py-3">
                              <button
                                type="button"
                                onClick={() => void openDetail(ticket)}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-2 py-6 text-center text-sm text-slate-500">
                            No tickets match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </article>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-display text-lg text-slate-900">Priority Tenant Queue</h3>
              {priorityQueue.length ? (
                <div className="space-y-2">
                  {priorityQueue.map((tenant) => (
                    <div key={tenant.tenantId} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-sm font-semibold text-amber-900">{tenant.tenantName}</p>
                      <p className="text-xs text-amber-800">
                        {tenant.contactEmail || tenant.contactPhone || 'No contact info'} |{' '}
                        {tenant.subscriptionStatus || tenant.reason || 'Follow-up'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No past-due tenants at the moment.</p>
              )}
            </article>

            <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-display text-lg text-slate-900">Operational Shortcuts</h3>
              <div className="space-y-2">
                <Link
                  to="/app/tenants"
                  className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open Tenant Management
                </Link>
                <Link
                  to="/app/subscriptions"
                  className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open Subscription Operations
                </Link>
                <Link
                  to="/app/overdue"
                  className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open Overdue Workflow
                </Link>
                <Link
                  to="/app/billing"
                  className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open Billing History
                </Link>
                <Link
                  to="/app/features"
                  className="block rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Open Feature Overrides
                </Link>
              </div>
            </article>
          </div>
        </>
      ) : null}

      {detailTicket ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-blue-100 bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-xl text-slate-900">{detailTicket.subject}</h3>
                <p className="text-xs text-slate-500">
                  {detailTicket.tenantName ?? tenantById.get(detailTicket.tenantId)?.name ?? detailTicket.tenantId} | Updated {formatDate(detailTicket.updatedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailTicket(null)
                  setReplyBody('')
                }}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${priorityBadge(detailTicket.priority)}`}>
                {detailTicket.priority}
              </span>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(detailTicket.status)}`}>
                {detailTicket.status}
              </span>
              <select
                value={detailTicket.status}
                onChange={(event) => void handleChangeStatus(event.target.value as TicketStatus)}
                disabled={acting}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
              >
                <option value="OPEN">Set OPEN</option>
                <option value="PENDING">Set PENDING</option>
                <option value="RESOLVED">Set RESOLVED</option>
                <option value="CLOSED">Set CLOSED</option>
              </select>
            </div>

            <div className="mb-3 space-y-2">
              {detailLoading ? (
                <p className="text-sm text-slate-500">Loading ticket messages...</p>
              ) : detailTicket.messages.length ? (
                detailTicket.messages.map((message) => (
                  <div key={message.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-700">
                      {message.authorEmail}
                      {message.authorRole ? ` · ${message.authorRole}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">{formatDate(message.createdAt)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{message.body}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No messages yet.</p>
              )}
            </div>

            <div className="space-y-2">
              <textarea
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                placeholder="Write a reply..."
                rows={4}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleReply()}
                disabled={acting || !replyBody.trim()}
                className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-70"
              >
                Send Reply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
