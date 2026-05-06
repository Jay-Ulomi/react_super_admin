import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  createPlan,
  deletePlan,
  fetchPlans,
  updatePlan,
  type Plan,
} from '../features/super-admin/super-admin-api'
import { useToast } from '../features/ui/toast-context'
import { ApiError } from '../types/api'
import { parseFieldErrors, type FieldErrors } from '../lib/validation'
import { buildSearchParams, parseEnum, parseNonNegativeInt, parsePageSize } from '../lib/search-params'

function currency(value?: number): string {
  if (value === undefined || value === null) return '-'
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 2,
  }).format(value)
}

export function PlansPage() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [createErrors, setCreateErrors] = useState<FieldErrors>({})
  const [editErrors, setEditErrors] = useState<FieldErrors>({})
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    monthlyPrice: '0',
    annualPrice: '0',
    trialDays: '14',
    maxBusinesses: '1',
    maxBranches: '1',
    maxUsers: '5',
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    monthlyPrice: '0',
    annualPrice: '0',
    trialDays: '14',
    maxBusinesses: '1',
    maxBranches: '1',
    maxUsers: '5',
    isActive: true,
    isDefault: false,
  })
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    parseEnum(searchParams.get('status'), ['all', 'active', 'inactive'] as const, 'all'),
  )
  const [sortBy, setSortBy] = useState<'name' | 'monthlyPrice' | 'annualPrice' | 'maxUsers'>(
    parseEnum(searchParams.get('sortBy'), ['name', 'monthlyPrice', 'annualPrice', 'maxUsers'] as const, 'name'),
  )
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(
    parseEnum(searchParams.get('sortDir'), ['asc', 'desc'] as const, 'asc'),
  )
  const [pageSize, setPageSize] = useState(parsePageSize(searchParams.get('size'), [5, 10, 20], 10))
  const [page, setPage] = useState(parseNonNegativeInt(searchParams.get('page'), 0))

  const loadPlans = async () => {
    const rows = await fetchPlans()
    setPlans(rows)
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const rows = await fetchPlans()
        if (!cancelled) setPlans(rows)
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load plans')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

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

  const submitCreate = async () => {
    setSubmitting(true)
    setCreateErrors({})
    try {
      await createPlan({
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        monthlyPrice: Number(createForm.monthlyPrice || 0),
        annualPrice: Number(createForm.annualPrice || 0),
        trialDays: Number(createForm.trialDays || 0),
        maxBusinesses: Number(createForm.maxBusinesses || 0),
        maxBranches: Number(createForm.maxBranches || 0),
        maxUsers: Number(createForm.maxUsers || 0),
      })
      await loadPlans()
      setCreateForm({
        name: '',
        description: '',
        monthlyPrice: '0',
        annualPrice: '0',
        trialDays: '14',
        maxBusinesses: '1',
        maxBranches: '1',
        maxUsers: '5',
      })
      toast.success('Plan created successfully.')
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
        setCreateErrors(parseFieldErrors(err.errors))
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to create plan')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (plan: Plan) => {
    setEditId(plan.id)
    setEditForm({
      name: plan.name,
      description: plan.description || '',
      monthlyPrice: String(plan.monthlyPrice ?? 0),
      annualPrice: String(plan.annualPrice ?? 0),
      trialDays: String(plan.trialDays ?? 0),
      maxBusinesses: String(plan.maxBusinesses ?? -1),
      maxBranches: String(plan.maxBranches ?? -1),
      maxUsers: String(plan.maxUsers ?? -1),
      isActive: plan.isActive,
      isDefault: plan.isDefault,
    })
  }

  const submitEdit = async () => {
    if (!editId) return
    setSubmitting(true)
    setEditErrors({})
    try {
      await updatePlan(editId, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
        monthlyPrice: Number(editForm.monthlyPrice || 0),
        annualPrice: Number(editForm.annualPrice || 0),
        trialDays: Number(editForm.trialDays || 0),
        maxBusinesses: Number(editForm.maxBusinesses || -1),
        maxBranches: Number(editForm.maxBranches || -1),
        maxUsers: Number(editForm.maxUsers || -1),
        isActive: editForm.isActive,
        isDefault: editForm.isDefault,
      })
      await loadPlans()
      setEditId(null)
      toast.success('Plan updated successfully.')
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
        setEditErrors(parseFieldErrors(err.errors))
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to update plan')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (plan: Plan) => {
    if (!window.confirm(`Deactivate plan "${plan.name}"?`)) return
    setSubmitting(true)
    try {
      await deletePlan(plan.id)
      await loadPlans()
      if (editId === plan.id) setEditId(null)
      toast.success(`Plan "${plan.name}" deactivated.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate plan')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredAndSorted = useMemo(() => {
    const searched = plans.filter((plan) => {
      const query = search.trim().toLowerCase()
      if (!query) return true
      return (
        plan.name.toLowerCase().includes(query) ||
        (plan.description || '').toLowerCase().includes(query)
      )
    })

    const statusFiltered = searched.filter((plan) => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'active') return plan.isActive
      return !plan.isActive
    })

    return [...statusFiltered].sort((a, b) => {
      const aRaw = a[sortBy]
      const bRaw = b[sortBy]
      const aValue = typeof aRaw === 'number' ? aRaw : String(aRaw ?? '').toLowerCase()
      const bValue = typeof bRaw === 'number' ? bRaw : String(bRaw ?? '').toLowerCase()
      if (aValue === bValue) return 0
      const cmp = aValue > bValue ? 1 : -1
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [plans, search, sortBy, sortDir, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize))
  const safePage = Math.min(page, totalPages - 1)
  const pagedPlans = filteredAndSorted.slice(safePage * pageSize, safePage * pageSize + pageSize)

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm xl:col-span-2">
        <h2 className="mb-3 font-display text-xl text-slate-900">Plans</h2>
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-5">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(0)
            }}
            placeholder="Search plan"
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
            onChange={(event) =>
              setSortBy(event.target.value as 'name' | 'monthlyPrice' | 'annualPrice' | 'maxUsers')
            }
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="name">Sort: Name</option>
            <option value="monthlyPrice">Sort: Monthly</option>
            <option value="annualPrice">Sort: Annual</option>
            <option value="maxUsers">Sort: Max Users</option>
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
        {loading ? <p className="text-sm text-slate-500">Loading plans...</p> : null}
        {!loading ? (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Plan</th>
                  <th className="px-2 py-2 font-medium">Monthly</th>
                  <th className="px-2 py-2 font-medium">Annual</th>
                  <th className="px-2 py-2 font-medium">Limits</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedPlans.length ? (
                  pagedPlans.map((plan) => (
                    <tr key={plan.id} className="border-b border-slate-100">
                      <td className="px-2 py-3">
                        <p className="font-semibold text-slate-800">{plan.name}</p>
                        <p className="text-xs text-slate-500">{plan.description || '-'}</p>
                      </td>
                      <td className="px-2 py-3 text-slate-700">{currency(plan.monthlyPrice)}</td>
                      <td className="px-2 py-3 text-slate-700">{currency(plan.annualPrice)}</td>
                      <td className="px-2 py-3 text-slate-600">
                        {plan.maxBusinesses} businesses, {plan.maxBranches} branches, {plan.maxUsers} users
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            plan.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {plan.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {plan.isDefault ? (
                          <span className="ml-2 text-xs font-semibold text-blue-700">Default</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(plan)}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeactivate(plan)}
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
                    <td colSpan={6} className="px-2 py-6 text-center text-sm text-slate-500">
                      No plans match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-sm">
              <p className="text-slate-600">
                Showing {pagedPlans.length} of {filteredAndSorted.length}
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

      <section className="space-y-4">
        <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <h3 className="font-display text-lg text-slate-900">Create Plan</h3>
          <div className="mt-3 space-y-2">
            <input
              placeholder="Name"
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            {createErrors.name ? <p className="text-xs text-rose-700">{createErrors.name}</p> : null}
            <textarea
              placeholder="Description"
              value={createForm.description}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Monthly"
                value={createForm.monthlyPrice}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, monthlyPrice: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {createErrors.monthlyPrice ? <p className="text-xs text-rose-700">{createErrors.monthlyPrice}</p> : null}
              <input
                placeholder="Annual"
                value={createForm.annualPrice}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, annualPrice: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {createErrors.annualPrice ? <p className="text-xs text-rose-700">{createErrors.annualPrice}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Trial Days"
                value={createForm.trialDays}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, trialDays: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Max Users"
                value={createForm.maxUsers}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, maxUsers: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Max Businesses"
                value={createForm.maxBusinesses}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, maxBusinesses: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Max Branches"
                value={createForm.maxBranches}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, maxBranches: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => void submitCreate()}
              disabled={submitting || !createForm.name.trim()}
              className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-70"
            >
              Create
            </button>
          </div>
        </article>

        {editId ? (
          <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-lg text-slate-900">Edit Plan</h3>
              <button
                type="button"
                onClick={() => setEditId(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700"
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
              <textarea
                placeholder="Description"
                value={editForm.description}
                onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Monthly"
                  value={editForm.monthlyPrice}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, monthlyPrice: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                {editErrors.monthlyPrice ? <p className="text-xs text-rose-700">{editErrors.monthlyPrice}</p> : null}
                <input
                  placeholder="Annual"
                  value={editForm.annualPrice}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, annualPrice: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                {editErrors.annualPrice ? <p className="text-xs text-rose-700">{editErrors.annualPrice}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Trial Days"
                  value={editForm.trialDays}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, trialDays: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Max Users"
                  value={editForm.maxUsers}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, maxUsers: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Max Businesses"
                  value={editForm.maxBusinesses}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, maxBusinesses: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  placeholder="Max Branches"
                  value={editForm.maxBranches}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, maxBranches: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.isDefault}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
                />
                Default Plan
              </label>
              <button
                type="button"
                onClick={() => void submitEdit()}
                disabled={submitting}
                className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-70"
              >
                Save Changes
              </button>
            </div>
          </article>
        ) : null}
      </section>
    </div>
  )
}
