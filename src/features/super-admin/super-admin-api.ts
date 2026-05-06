import { apiRequest } from '../../lib/http'

export type Tenant = {
  id: string
  name: string
  slug: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  isActive: boolean
  subscriptionStatus?: string
  createdAt?: string
  updatedAt?: string
}

export const BUSINESS_TYPES = [
  'GROCERY', 'SUPERMARKET', 'RESTAURANT', 'CAFE', 'BAKERY', 'BUTCHERY',
  'PHARMACY', 'CLINIC', 'SALON', 'ELECTRONICS', 'HARDWARE', 'CLOTHING',
  'AGRICULTURE', 'WHOLESALE', 'HOTEL', 'SCHOOL', 'RETAIL', 'LAUNDRY', 'GENERAL',
] as const
export type BusinessType = typeof BUSINESS_TYPES[number]

// ── Business Type management ─────────────────────────────────────────────────

export type BusinessTypeDef = {
  id: string
  code: string
  label: string
  description?: string
  isActive: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export type CreateBusinessTypeRequest = {
  code: string
  label: string
  description?: string
  sortOrder?: number
}

export type UpdateBusinessTypeRequest = {
  label?: string
  description?: string
  isActive?: boolean
  sortOrder?: number
}

function mapBusinessType(row: unknown): BusinessTypeDef {
  const src = (row ?? {}) as Record<string, unknown> & BoolLike
  return {
    id: String(src.id ?? ''),
    code: String(src.code ?? ''),
    label: String(src.label ?? ''),
    description: src.description ? String(src.description) : undefined,
    isActive: boolFrom(src.isActive ?? src.active, true),
    sortOrder: Number(src.sortOrder ?? 0),
    createdAt: src.createdAt ? String(src.createdAt) : undefined,
    updatedAt: src.updatedAt ? String(src.updatedAt) : undefined,
  }
}

export async function fetchBusinessTypes(): Promise<BusinessTypeDef[]> {
  const rows = await apiRequest<unknown[]>('/api/business-types/admin/all')
  return rows.map(mapBusinessType)
}

export async function createBusinessType(req: CreateBusinessTypeRequest): Promise<BusinessTypeDef> {
  const row = await apiRequest<unknown>('/api/business-types', { method: 'POST', body: req })
  return mapBusinessType(row)
}

export async function updateBusinessType(id: string, req: UpdateBusinessTypeRequest): Promise<BusinessTypeDef> {
  const row = await apiRequest<unknown>(`/api/business-types/${id}`, { method: 'PUT', body: req })
  return mapBusinessType(row)
}

export async function deleteBusinessType(id: string): Promise<void> {
  await apiRequest<void>(`/api/business-types/${id}`, { method: 'DELETE' })
}

export type CreateTenantRequest = {
  name: string
  slug: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  /** Determines which default categories/subcategories are seeded for the initial business. */
  businessType?: BusinessType
  ownerUser?: {
    firstName: string
    lastName: string
    email: string
    password: string
    phone?: string
  }
}

export type UpdateTenantRequest = {
  name?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  isActive?: boolean
  subscriptionStatus?: string
}

export type Plan = {
  id: string
  name: string
  description?: string
  monthlyPrice?: number
  annualPrice?: number
  trialDays: number
  isActive: boolean
  isDefault: boolean
  maxBusinesses: number
  maxBranches: number
  maxUsers: number
  sortOrder?: number
  features?: PlanFeature[]
  createdAt?: string
  updatedAt?: string
}

export type PlanFeature = {
  featureName: string
  featureValue?: string
  isEnabled: boolean
}

export type CreatePlanRequest = {
  name: string
  description?: string
  monthlyPrice: number
  annualPrice: number
  trialDays?: number
  isActive?: boolean
  isDefault?: boolean
  maxBusinesses?: number
  maxBranches?: number
  maxUsers?: number
  sortOrder?: number
  features?: PlanFeature[]
}

export type UpdatePlanRequest = {
  name?: string
  description?: string
  monthlyPrice?: number
  annualPrice?: number
  trialDays?: number
  isActive?: boolean
  isDefault?: boolean
  maxBusinesses?: number
  maxBranches?: number
  maxUsers?: number
  sortOrder?: number
  features?: PlanFeature[]
}

export type Subscription = {
  id: string
  tenantId: string
  tenantName?: string
  planId: string
  planName: string
  status: string
  startDate?: string
  endDate?: string
  autoRenew: boolean
  billingCycle?: string
}

export type CreateSubscriptionRequest = {
  planId: string
  billingCycle?: 'MONTHLY' | 'ANNUAL'
  startWithTrial?: boolean
  autoRenew?: boolean
}

export type AdminCreateSubscriptionRequest = {
  tenantId: string
  subscription: CreateSubscriptionRequest
}

export type CancelSubscriptionRequest = {
  cancelReason?: string
}

export type TenantFeature = {
  id: string
  tenantId: string
  featureName: string
  featureValue?: string
  isEnabled: boolean
  overrideSource?: string
}

export type Business = {
  id: string
  tenantId: string
  name: string
  isActive: boolean
}

export type Branch = {
  id: string
  businessId: string
  tenantId: string
  name: string
  isActive: boolean
  isMainBranch: boolean
  isWarehouse?: boolean
}

export type UpdateTenantFeatureRequest = {
  featureName: string
  featureValue?: string
  isEnabled: boolean
}

export type UsageSummary = {
  totalTenants: number
  activeTenants: number
  totalPlans: number
  activePlans: number
  loadedSubscriptions?: number
  catalogUtilizationPct?: number
  tenantStatusMix?: Record<string, number>
  subscriptionsByPlan?: Record<string, number>
}

export type SupportQueueItem = {
  tenantId: string
  tenantName: string
  contactEmail?: string
  contactPhone?: string
  subscriptionStatus?: string
  reason?: string
}

export type SupportSummary = {
  pastDueTenants: number
  inactiveTenants: number
  missingContactTenants: number
  suspendedSubscriptions: number
  priorityTenants?: SupportQueueItem[]
}

type BoolLike = {
  isActive?: boolean
  active?: boolean
  isDefault?: boolean
  default?: boolean
  isEnabled?: boolean
  enabled?: boolean
  isMainBranch?: boolean
  mainBranch?: boolean
  isWarehouse?: boolean
  warehouse?: boolean
}

function boolFrom(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function mapFeature(row: unknown): PlanFeature {
  const src = (row ?? {}) as Record<string, unknown> & BoolLike
  return {
    featureName: String(src.featureName ?? ''),
    featureValue: src.featureValue ? String(src.featureValue) : undefined,
    isEnabled: boolFrom(src.isEnabled ?? src.enabled, false),
  }
}

function mapTenant(row: unknown): Tenant {
  const src = (row ?? {}) as Record<string, unknown> & BoolLike
  return {
    id: String(src.id ?? ''),
    name: String(src.name ?? ''),
    slug: String(src.slug ?? ''),
    contactEmail: src.contactEmail ? String(src.contactEmail) : undefined,
    contactPhone: src.contactPhone ? String(src.contactPhone) : undefined,
    address: src.address ? String(src.address) : undefined,
    subscriptionStatus: src.subscriptionStatus ? String(src.subscriptionStatus) : undefined,
    isActive: boolFrom(src.isActive ?? src.active, false),
    createdAt: src.createdAt ? String(src.createdAt) : undefined,
    updatedAt: src.updatedAt ? String(src.updatedAt) : undefined,
  }
}

function mapPlan(row: unknown): Plan {
  const src = (row ?? {}) as Record<string, unknown> & BoolLike
  const features = Array.isArray(src.features) ? src.features.map(mapFeature) : []
  return {
    id: String(src.id ?? ''),
    name: String(src.name ?? ''),
    description: src.description ? String(src.description) : undefined,
    monthlyPrice: src.monthlyPrice === undefined ? undefined : Number(src.monthlyPrice),
    annualPrice: src.annualPrice === undefined ? undefined : Number(src.annualPrice),
    trialDays: Number(src.trialDays ?? 0),
    maxBusinesses: Number(src.maxBusinesses ?? 0),
    maxBranches: Number(src.maxBranches ?? 0),
    maxUsers: Number(src.maxUsers ?? 0),
    sortOrder: src.sortOrder === undefined ? undefined : Number(src.sortOrder),
    isActive: boolFrom(src.isActive ?? src.active, false),
    isDefault: boolFrom(src.isDefault ?? src.default, false),
    features,
    createdAt: src.createdAt ? String(src.createdAt) : undefined,
    updatedAt: src.updatedAt ? String(src.updatedAt) : undefined,
  }
}

function mapTenantFeature(row: unknown): TenantFeature {
  const src = (row ?? {}) as Record<string, unknown> & BoolLike
  return {
    id: String(src.id ?? ''),
    tenantId: String(src.tenantId ?? ''),
    featureName: String(src.featureName ?? ''),
    featureValue: src.featureValue ? String(src.featureValue) : undefined,
    isEnabled: boolFrom(src.isEnabled ?? src.enabled, false),
    overrideSource: src.overrideSource ? String(src.overrideSource) : undefined,
  }
}

function mapBusiness(row: unknown): Business {
  const src = (row ?? {}) as Record<string, unknown> & BoolLike
  return {
    id: String(src.id ?? ''),
    tenantId: String(src.tenantId ?? ''),
    name: String(src.name ?? ''),
    isActive: boolFrom(src.isActive ?? src.active, false),
  }
}

function mapBranch(row: unknown): Branch {
  const src = (row ?? {}) as Record<string, unknown> & BoolLike
  return {
    id: String(src.id ?? ''),
    businessId: String(src.businessId ?? ''),
    tenantId: String(src.tenantId ?? ''),
    name: String(src.name ?? ''),
    isActive: boolFrom(src.isActive ?? src.active, false),
    isMainBranch: boolFrom(src.isMainBranch ?? src.mainBranch, false),
    isWarehouse: boolFrom(src.isWarehouse ?? src.warehouse, false),
  }
}

function mapSubscription(row: unknown): Subscription {
  const src = (row ?? {}) as Record<string, unknown>
  return {
    id: String(src.id ?? ''),
    tenantId: String(src.tenantId ?? ''),
    tenantName: src.tenantName ? String(src.tenantName) : undefined,
    planId: String(src.planId ?? ''),
    planName: String(src.planName ?? ''),
    status: String(src.status ?? ''),
    startDate: src.startDate ? String(src.startDate) : undefined,
    endDate: src.endDate ? String(src.endDate) : undefined,
    autoRenew: boolFrom(src.autoRenew, false),
    billingCycle: src.billingCycle ? String(src.billingCycle) : undefined,
  }
}

function toPlanFeaturePayload(feature: PlanFeature): Record<string, unknown> {
  return {
    featureName: feature.featureName,
    featureValue: feature.featureValue,
    enabled: feature.isEnabled,
    isEnabled: feature.isEnabled,
  }
}

function toTenantFeaturePayload(payload: UpdateTenantFeatureRequest): Record<string, unknown> {
  return {
    featureName: payload.featureName,
    featureValue: payload.featureValue,
    enabled: payload.isEnabled,
    isEnabled: payload.isEnabled,
  }
}

export async function fetchTenants(): Promise<Tenant[]> {
  const rows = await apiRequest<unknown[]>('/api/tenants')
  return rows.map(mapTenant)
}

export async function createTenant(payload: CreateTenantRequest): Promise<Tenant> {
  const row = await apiRequest<unknown>('/api/tenants', {
    method: 'POST',
    body: payload,
  })
  return mapTenant(row)
}

export async function updateTenant(tenantId: string, payload: UpdateTenantRequest): Promise<Tenant> {
  const row = await apiRequest<unknown>(`/api/tenants/${tenantId}`, {
    method: 'PUT',
    body: payload,
  })
  return mapTenant(row)
}

export async function deleteTenant(tenantId: string): Promise<void> {
  await apiRequest<null>(`/api/tenants/${tenantId}`, {
    method: 'DELETE',
  })
}

export async function fetchPlans(): Promise<Plan[]> {
  const rows = await apiRequest<unknown[]>('/api/plans/admin/all')
  return rows.map(mapPlan)
}

export async function createPlan(payload: CreatePlanRequest): Promise<Plan> {
  const row = await apiRequest<unknown>('/api/plans', {
    method: 'POST',
    body: {
      ...payload,
      active: payload.isActive,
      default: payload.isDefault,
      features: payload.features?.map(toPlanFeaturePayload),
    },
  })
  return mapPlan(row)
}

export async function updatePlan(planId: string, payload: UpdatePlanRequest): Promise<Plan> {
  const row = await apiRequest<unknown>(`/api/plans/${planId}`, {
    method: 'PUT',
    body: {
      ...payload,
      active: payload.isActive,
      default: payload.isDefault,
      features: payload.features?.map(toPlanFeaturePayload),
    },
  })
  return mapPlan(row)
}

export async function deletePlan(planId: string): Promise<void> {
  await apiRequest<null>(`/api/plans/${planId}`, {
    method: 'DELETE',
  })
}

export async function fetchSubscriptions(): Promise<Subscription[]> {
  const rows = await apiRequest<unknown[]>('/api/subscriptions')
  return rows.map(mapSubscription)
}

export async function createSubscription(payload: CreateSubscriptionRequest): Promise<Subscription> {
  const row = await apiRequest<unknown>('/api/subscriptions', {
    method: 'POST',
    body: payload,
  })
  return mapSubscription(row)
}

export async function activateSubscription(subscriptionId: string): Promise<Subscription> {
  const row = await apiRequest<unknown>(`/api/subscriptions/${subscriptionId}/activate`, {
    method: 'POST',
  })
  return mapSubscription(row)
}

export async function suspendSubscription(subscriptionId: string): Promise<Subscription> {
  const row = await apiRequest<unknown>(`/api/subscriptions/${subscriptionId}/suspend`, {
    method: 'POST',
  })
  return mapSubscription(row)
}

export async function cancelSubscription(
  subscriptionId: string,
  payload?: CancelSubscriptionRequest,
): Promise<Subscription> {
  const row = await apiRequest<unknown>(`/api/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    body: payload ?? {},
  })
  return mapSubscription(row)
}

export async function renewSubscription(subscriptionId: string): Promise<Subscription> {
  const row = await apiRequest<unknown>(`/api/subscriptions/${subscriptionId}/renew`, {
    method: 'POST',
  })
  return mapSubscription(row)
}

export async function changeSubscriptionPlan(
  subscriptionId: string,
  planId: string,
): Promise<Subscription> {
  const row = await apiRequest<unknown>(`/api/subscriptions/${subscriptionId}/change-plan/${planId}`, {
    method: 'POST',
  })
  return mapSubscription(row)
}

type AdminSubscriptionsPage = {
  content?: unknown[]
}

export async function fetchAdminSubscriptions(): Promise<Subscription[]> {
  const page = await apiRequest<AdminSubscriptionsPage>('/api/admin/subscriptions?size=200')
  return (page.content ?? []).map(mapSubscription)
}

export async function createAdminSubscription(payload: AdminCreateSubscriptionRequest): Promise<Subscription> {
  const row = await apiRequest<unknown>('/api/admin/subscriptions', {
    method: 'POST',
    body: payload,
  })
  return mapSubscription(row)
}

export async function activateAdminSubscription(subscriptionId: string): Promise<Subscription> {
  const row = await apiRequest<unknown>(`/api/admin/subscriptions/${subscriptionId}/activate`, {
    method: 'POST',
  })
  return mapSubscription(row)
}

export async function suspendAdminSubscription(subscriptionId: string): Promise<Subscription> {
  const row = await apiRequest<unknown>(`/api/admin/subscriptions/${subscriptionId}/suspend`, {
    method: 'POST',
  })
  return mapSubscription(row)
}

export async function cancelAdminSubscription(
  subscriptionId: string,
  payload?: CancelSubscriptionRequest,
): Promise<Subscription> {
  const row = await apiRequest<unknown>(`/api/admin/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
    body: payload ?? {},
  })
  return mapSubscription(row)
}

export async function renewAdminSubscription(subscriptionId: string): Promise<Subscription> {
  const row = await apiRequest<unknown>(`/api/admin/subscriptions/${subscriptionId}/renew`, {
    method: 'POST',
  })
  return mapSubscription(row)
}

export async function changeAdminSubscriptionPlan(
  subscriptionId: string,
  planId: string,
): Promise<Subscription> {
  const row = await apiRequest<unknown>(`/api/admin/subscriptions/${subscriptionId}/change-plan/${planId}`, {
    method: 'POST',
  })
  return mapSubscription(row)
}

export async function fetchTenantFeatures(tenantId: string): Promise<TenantFeature[]> {
  const rows = await apiRequest<unknown[]>(`/api/tenant-features/admin/${tenantId}`)
  return rows.map(mapTenantFeature)
}

export async function overrideTenantFeature(
  tenantId: string,
  payload: UpdateTenantFeatureRequest,
): Promise<TenantFeature> {
  const row = await apiRequest<unknown>(`/api/tenant-features/admin/${tenantId}/override`, {
    method: 'POST',
    body: toTenantFeaturePayload(payload),
  })
  return mapTenantFeature(row)
}

export async function removeTenantFeatureOverride(
  tenantId: string,
  featureName: string,
): Promise<void> {
  await apiRequest<null>(`/api/tenant-features/admin/${tenantId}/override/${featureName}`, {
    method: 'DELETE',
  })
}

export async function fetchBusinesses(): Promise<Business[]> {
  const rows = await apiRequest<unknown[]>('/api/businesses')
  return rows.map(mapBusiness)
}

export async function fetchBranches(businessId: string): Promise<Branch[]> {
  const rows = await apiRequest<unknown[]>(`/api/businesses/${businessId}/branches`)
  return rows.map(mapBranch)
}

export async function fetchUsageSummary(): Promise<UsageSummary> {
  return apiRequest<UsageSummary>('/api/admin/usage/summary')
}

export async function fetchSupportSummary(): Promise<SupportSummary> {
  return apiRequest<SupportSummary>('/api/admin/support/summary')
}
