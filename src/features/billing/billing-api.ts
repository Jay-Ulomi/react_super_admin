import { apiRequest } from '../../lib/http'

export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED'

export type Invoice = {
  id: string
  subscriptionId: string
  tenantId: string
  invoiceNumber: string
  amount: number
  currency: string
  status: InvoiceStatus
  issuedDate?: string
  dueDate?: string
  paidDate?: string
  createdAt?: string
  updatedAt?: string
}

// Cross-tenant admin list — no context switch required
export async function fetchAdminInvoices(params?: {
  tenantId?: string
  status?: InvoiceStatus
  paid?: boolean
  from?: string
  to?: string
  page?: number
  size?: number
}): Promise<{ content: Invoice[]; totalElements: number }> {
  const query = new URLSearchParams()
  if (params?.tenantId) query.set('tenantId', params.tenantId)
  if (params?.status) query.set('status', params.status)
  if (params?.paid !== undefined) query.set('paid', String(params.paid))
  if (params?.from) query.set('from', params.from)
  if (params?.to) query.set('to', params.to)
  if (params?.page !== undefined) query.set('page', String(params.page))
  if (params?.size !== undefined) query.set('size', String(params.size))
  const qs = query.toString()
  return apiRequest(`/api/admin/invoices${qs ? `?${qs}` : ''}`)
}

export async function fetchAdminInvoicesBySubscription(subscriptionId: string): Promise<Invoice[]> {
  return apiRequest<Invoice[]>(`/api/admin/invoices/subscription/${subscriptionId}`)
}

// Tenant-scoped fallback (requires context switch first)
export async function fetchInvoicesForCurrentContext(): Promise<Invoice[]> {
  return apiRequest<Invoice[]>('/api/invoices')
}

export async function fetchInvoice(invoiceId: string): Promise<Invoice> {
  return apiRequest<Invoice>(`/api/invoices/${invoiceId}`)
}

export async function fetchInvoicesBySubscription(subscriptionId: string): Promise<Invoice[]> {
  return apiRequest<Invoice[]>(`/api/invoices/subscription/${subscriptionId}`)
}

export async function markInvoicePaid(invoiceId: string): Promise<Invoice> {
  return apiRequest<Invoice>(`/api/invoices/${invoiceId}/pay`, { method: 'POST' })
}

export async function cancelInvoice(invoiceId: string): Promise<Invoice> {
  return apiRequest<Invoice>(`/api/invoices/${invoiceId}/cancel`, { method: 'POST' })
}

export async function markAdminInvoicePaid(invoiceId: string): Promise<Invoice> {
  return apiRequest<Invoice>(`/api/admin/invoices/${invoiceId}/pay`, { method: 'POST' })
}

export async function cancelAdminInvoice(invoiceId: string): Promise<Invoice> {
  return apiRequest<Invoice>(`/api/admin/invoices/${invoiceId}/cancel`, { method: 'POST' })
}
