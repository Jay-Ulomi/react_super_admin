import { apiRequest } from '../../lib/http'

/**
 * Support Ticketing API module.
 *
 * BACKEND STATUS (verified 2026-04):
 *   - The backend does NOT currently implement a support ticket system.
 *   - Only a derived "support summary" exists at /api/admin/support/summary
 *     which reports counts of past-due / inactive / missing-contact tenants
 *     plus a priorityTenants queue. No threads, no tickets, no replies.
 *
 * This module is structured to mirror a conventional ticketing surface so
 * when the backend adds it, wiring is drop-in. Every TODO call below will
 * throw with a clear "not implemented" message at runtime.
 */

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type TicketStatus = 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'

export type SupportTicket = {
  id: string
  tenantId: string
  tenantName?: string
  subject: string
  priority: TicketPriority
  status: TicketStatus
  assignedTo?: string
  createdAt: string
  updatedAt: string
}

export type SupportTicketMessage = {
  id: string
  ticketId: string
  authorEmail: string
  authorRole?: string
  body: string
  createdAt: string
}

export type SupportTicketDetail = SupportTicket & {
  messages: SupportTicketMessage[]
}

export type SupportTicketFilter = {
  status?: TicketStatus
  tenantId?: string
  priority?: TicketPriority
  from?: string
  to?: string
}

export type CreateSupportReplyRequest = {
  body: string
}

export type UpdateSupportTicketRequest = {
  status?: TicketStatus
  assignedTo?: string
  priority?: TicketPriority
}

function notImplemented<T>(op: string): Promise<T> {
  return Promise.reject(
    new Error(
      `Support ticketing not yet available on the backend (${op}). ` +
        'Once /api/admin/support/tickets lands, these stubs will be wired automatically.',
    ),
  )
}

// TODO: replace with real endpoint when backend ticket system lands
export async function fetchSupportTickets(filter?: SupportTicketFilter): Promise<SupportTicket[]> {
  try {
    const params = new URLSearchParams()
    if (filter?.status) params.set('status', filter.status)
    if (filter?.tenantId) params.set('tenantId', filter.tenantId)
    if (filter?.priority) params.set('priority', filter.priority)
    if (filter?.from) params.set('from', filter.from)
    if (filter?.to) params.set('to', filter.to)
    const query = params.toString()
    return await apiRequest<SupportTicket[]>(
      `/api/admin/support/tickets${query ? `?${query}` : ''}`,
    )
  } catch {
    return notImplemented<SupportTicket[]>('fetchSupportTickets')
  }
}

export async function fetchSupportTicket(ticketId: string): Promise<SupportTicketDetail> {
  try {
    return await apiRequest<SupportTicketDetail>(`/api/admin/support/tickets/${ticketId}`)
  } catch {
    return notImplemented<SupportTicketDetail>(`fetchSupportTicket(${ticketId})`)
  }
}

export async function replyToSupportTicket(
  ticketId: string,
  payload: CreateSupportReplyRequest,
): Promise<SupportTicketMessage> {
  try {
    return await apiRequest<SupportTicketMessage>(
      `/api/admin/support/tickets/${ticketId}/messages`,
      { method: 'POST', body: payload },
    )
  } catch {
    return notImplemented<SupportTicketMessage>(`replyToSupportTicket(${ticketId})`)
  }
}

export async function updateSupportTicket(
  ticketId: string,
  payload: UpdateSupportTicketRequest,
): Promise<SupportTicket> {
  try {
    return await apiRequest<SupportTicket>(`/api/admin/support/tickets/${ticketId}`, {
      method: 'PUT',
      body: payload,
    })
  } catch {
    return notImplemented<SupportTicket>(`updateSupportTicket(${ticketId})`)
  }
}
