import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  createTenant,
  deleteTenant,
  fetchTenants,
  updateTenant,
  BUSINESS_TYPES,
  type BusinessType,
  type Tenant,
} from '../features/super-admin/super-admin-api'
import { useToast } from '../features/ui/toast-context'
import { ApiError } from '../types/api'
import { parseFieldErrors, type FieldErrors } from '../lib/validation'
import { buildSearchParams, parseEnum, parseNonNegativeInt, parsePageSize } from '../lib/search-params'

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function TenantsPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [createErrors, setCreateErrors] = useState<FieldErrors>({})
  const [editErrors, setEditErrors] = useState<FieldErrors>({})
  const [createOpen, setCreateOpen] = useState(false)
  const [slugEdited, setSlugEdited] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    businessType: 'GENERAL' as BusinessType,
    ownerFirstName: '',
    ownerLastName: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerPhone: '',
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    contactEmail: '',
    contactPhone: '',
    address: '',
    isActive: true,
  })
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    parseEnum(searchParams.get('status'), ['all', 'active', 'inactive'] as const, 'all'),
  )
  const [sortBy, setSortBy] = useState<'name' | 'slug' | 'subscriptionStatus'>(
    parseEnum(searchParams.get('sortBy'), ['name', 'slug', 'subscriptionStatus'] as const, 'name'),
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    parseEnum(searchParams.get('sortDir'), ['asc', 'desc'] as const, 'asc'),
  )
  const [pageSize, setPageSize] = useState(parsePageSize(searchParams.get('size'), [5, 10, 20], 10))
  const [page, setPage] = useState(parseNonNegativeInt(searchParams.get('page'), 0))

  const loadTenants = async () => {
    const rows = await fetchTenants()
    setTenants(rows)
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const rows = await fetchTenants()
        if (!cancelled) setTenants(rows)
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load tenants')
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
      q: search || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      sortBy: sortBy !== 'name' ? sortBy : undefined,
      sortDir: sortDir !== 'asc' ? sortDir : undefined,
      page: page !== 0 ? page : undefined,
      size: pageSize !== 10 ? pageSize : undefined,
    })
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [page, pageSize, search, searchParams, setSearchParams, sortBy, sortDir, statusFilter])

  const openCreate = () => {
    setCreateErrors({})
    setSlugEdited(false)
    setCreateForm({
      name: '',
      slug: '',
      contactEmail: '',
      contactPhone: '',
      address: '',
      businessType: 'GENERAL' as BusinessType,
      ownerFirstName: '',
      ownerLastName: '',
      ownerEmail: '',
      ownerPassword: '',
      ownerPhone: '',
    })
    setCreateOpen(true)
  }

  const submitCreate = async () => {
    if (submitting) return
    if (!createForm.name.trim()) {
      toast.error('Tenant name is required.')
      return
    }
    if (!createForm.slug.trim()) {
      toast.error('Tenant slug is required.')
      return
    }
    setSubmitting(true)
    setCreateErrors({})
    try {
      await createTenant({
        name: createForm.name.trim(),
        slug: createForm.slug.trim(),
        contactEmail: createForm.contactEmail.trim() || undefined,
        contactPhone: createForm.contactPhone.trim() || undefined,
        address: createForm.address.trim() || undefined,
        businessType: createForm.businessType,
        ownerUser: createForm.ownerEmail.trim()
          ? {
              firstName: createForm.ownerFirstName.trim(),
              lastName: createForm.ownerLastName.trim(),
              email: createForm.ownerEmail.trim(),
              password: createForm.ownerPassword,
              phone: createForm.ownerPhone.trim() || undefined,
            }
          : undefined,
      })
      await loadTenants()
      setCreateOpen(false)
      toast.success(
        createForm.ownerEmail.trim()
          ? 'Tenant and owner user created successfully.'
          : 'Tenant created successfully.',
      )
    } catch (err) {
      if (err instanceof ApiError) {
        setCreateErrors(parseFieldErrors(err.errors))
        toast.error(err.message)
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to create tenant')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (tenant: Tenant) => {
    setEditErrors({})
    setEditId(tenant.id)
    setEditForm({
      name: tenant.name,
      contactEmail: tenant.contactEmail || '',
      contactPhone: tenant.contactPhone || '',
      address: tenant.address || '',
      isActive: tenant.isActive,
    })
  }

  const submitEdit = async () => {
    if (!editId) return
    setSubmitting(true)
    setEditErrors({})
    try {
      await updateTenant(editId, {
        name: editForm.name.trim() || undefined,
        contactEmail: editForm.contactEmail.trim() || undefined,
        contactPhone: editForm.contactPhone.trim() || undefined,
        address: editForm.address.trim() || undefined,
        isActive: editForm.isActive,
      })
      await loadTenants()
      setEditId(null)
      toast.success('Tenant updated successfully.')
    } catch (err) {
      if (err instanceof ApiError) {
        setEditErrors(parseFieldErrors(err.errors))
        toast.error(err.message)
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to update tenant')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (tenant: Tenant) => {
    if (!window.confirm(`Deactivate tenant "${tenant.name}"?`)) return
    setSubmitting(true)
    try {
      await deleteTenant(tenant.id)
      await loadTenants()
      if (editId === tenant.id) setEditId(null)
      toast.success(`Tenant "${tenant.name}" deactivated.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate tenant')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredAndSorted = useMemo(() => {
    const searched = tenants.filter((tenant) => {
      const query = search.trim().toLowerCase()
      if (!query) return true
      return (
        tenant.name.toLowerCase().includes(query) ||
        tenant.slug.toLowerCase().includes(query) ||
        (tenant.contactEmail || '').toLowerCase().includes(query)
      )
    })

    const statusFiltered = searched.filter((tenant) => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'active') return tenant.isActive
      return !tenant.isActive
    })

    return [...statusFiltered].sort((a, b) => {
      const aValue = String(a[sortBy] ?? '').toLowerCase()
      const bValue = String(b[sortBy] ?? '').toLowerCase()
      if (aValue === bValue) return 0
      const cmp = aValue > bValue ? 1 : -1
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [search, sortBy, sortDir, statusFilter, tenants])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pagedTenants = filteredAndSorted.slice(safePage * pageSize, safePage * pageSize + pageSize)

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl text-slate-900">Tenants</h2>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Create Tenant
          </button>
        </div>
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-5">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
            placeholder="Search tenant"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')
              setPage(0)
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as 'name' | 'slug' | 'subscriptionStatus')}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="name">Sort: Name</option>
            <option value="slug">Sort: Slug</option>
            <option value="subscriptionStatus">Sort: Subscription</option>
          </select>
          <select
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value as 'asc' | 'desc')}
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
            <option value={5}>5 rows</option>
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
          </select>
        </div>
        {loading ? <p className="text-sm text-slate-500">Loading tenants...</p> : null}
        {!loading ? (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-500">
                  <tr>
                    <th className="px-2 py-2 font-medium">Name</th>
                    <th className="px-2 py-2 font-medium">Slug</th>
                    <th className="px-2 py-2 font-medium">Subscription</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTenants.length ? (
                    pagedTenants.map((tenant) => (
                      <tr key={tenant.id} className="border-b border-slate-100">
                        <td className="px-2 py-3 font-semibold text-slate-800">{tenant.name}</td>
                        <td className="px-2 py-3 text-slate-600">{tenant.slug}</td>
                        <td className="px-2 py-3 text-slate-700">{tenant.subscriptionStatus || '-'}</td>
                        <td className="px-2 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              tenant.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {tenant.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(tenant)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeactivate(tenant)}
                              disabled={submitting}
                              className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-70"
                            >
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-sm text-slate-500">
                        No tenants match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-sm">
              <p className="text-slate-600">
                Showing {pagedTenants.length} of {filteredAndSorted.length}
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
      </section>

      {/* ── Edit modal ── */}
      {editId ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-blue-100 bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl text-slate-900">Edit Tenant</h3>
              <button
                type="button"
                onClick={() => !submitting && setEditId(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="space-y-2">
              <input
                placeholder="Name"
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {editErrors.name ? <p className="text-xs text-rose-700">{editErrors.name}</p> : null}
              <input
                placeholder="Contact Email"
                value={editForm.contactEmail}
                onChange={(event) => setEditForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {editErrors.contactEmail ? <p className="text-xs text-rose-700">{editErrors.contactEmail}</p> : null}
              <input
                placeholder="Contact Phone"
                value={editForm.contactPhone}
                onChange={(event) => setEditForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {editErrors.contactPhone ? <p className="text-xs text-rose-700">{editErrors.contactPhone}</p> : null}
              <textarea
                placeholder="Address"
                value={editForm.address}
                onChange={(event) => setEditForm((prev) => ({ ...prev, address: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                Active
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditId(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitEdit()}
                disabled={submitting}
                className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-70"
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Create modal ── */}
      {createOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-blue-100 bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl text-slate-900">Create Tenant</h3>
              <button
                type="button"
                onClick={() => !submitting && setCreateOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                placeholder="Name"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => {
                    const nextName = event.target.value
                    return {
                      ...prev,
                      name: nextName,
                      slug: slugEdited ? prev.slug : toSlug(nextName),
                    }
                  })
                }
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <input
                  placeholder="Slug"
                  value={createForm.slug}
                  onChange={(event) => {
                    setSlugEdited(true)
                    setCreateForm((prev) => ({ ...prev, slug: toSlug(event.target.value) }))
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSlugEdited(false)
                    setCreateForm((prev) => ({ ...prev, slug: toSlug(prev.name) }))
                  }}
                  className="rounded-lg border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Auto
                </button>
              </div>
              {createErrors.name ? <p className="text-xs text-rose-700">{createErrors.name}</p> : <span />}
              {createErrors.slug ? <p className="text-xs text-rose-700">{createErrors.slug}</p> : <span />}
              <input
                placeholder="Contact Email"
                value={createForm.contactEmail}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Contact Phone"
                value={createForm.contactPhone}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Address"
                value={createForm.address}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, address: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              />
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Business Type (determines default categories & units)
                </label>
                <select
                  value={createForm.businessType}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, businessType: event.target.value as BusinessType }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Optional: Create Tenant Owner User
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <input
                placeholder="Owner First Name"
                value={createForm.ownerFirstName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, ownerFirstName: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Owner Last Name"
                value={createForm.ownerLastName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, ownerLastName: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Owner Email"
                value={createForm.ownerEmail}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, ownerEmail: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Owner Password"
                type="password"
                value={createForm.ownerPassword}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, ownerPassword: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Owner Phone (optional)"
                value={createForm.ownerPhone}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, ownerPhone: event.target.value }))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => !submitting && setCreateOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitCreate()}
                disabled={submitting || !createForm.name.trim() || !createForm.slug.trim()}
                className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-70"
              >
                {submitting ? 'Creating...' : 'Create Tenant'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
