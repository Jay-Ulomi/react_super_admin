import { useEffect, useMemo, useState } from 'react'
import {
  createBusinessType,
  deleteBusinessType,
  fetchBusinessTypes,
  updateBusinessType,
  type BusinessTypeDef,
} from '../features/super-admin/super-admin-api'
import { useToast } from '../features/ui/toast-context'
import { ApiError } from '../types/api'
import { parseFieldErrors, type FieldErrors } from '../lib/validation'

export function BusinessTypesPage() {
  const toast = useToast()

  const [types, setTypes] = useState<BusinessTypeDef[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 10

  const [createForm, setCreateForm] = useState({ code: '', label: '', description: '', sortOrder: '0' })
  const [createErrors, setCreateErrors] = useState<FieldErrors>({})

  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ label: '', description: '', isActive: true, sortOrder: '0' })
  const [editErrors, setEditErrors] = useState<FieldErrors>({})

  const load = async () => {
    try {
      const rows = await fetchBusinessTypes()
      setTypes(rows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load business types')
    }
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const rows = await fetchBusinessTypes()
        if (!cancelled) setTypes(rows)
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load business types')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return types
      .filter(t => {
        if (statusFilter === 'active' && !t.isActive) return false
        if (statusFilter === 'inactive' && t.isActive) return false
        return !q || t.code.toLowerCase().includes(q) || t.label.toLowerCase().includes(q)
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
  }, [types, search, statusFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const submitCreate = async () => {
    setSubmitting(true)
    setCreateErrors({})
    try {
      await createBusinessType({
        code: createForm.code.trim().toUpperCase(),
        label: createForm.label.trim(),
        description: createForm.description.trim() || undefined,
        sortOrder: Number(createForm.sortOrder || 0),
      })
      await load()
      setCreateForm({ code: '', label: '', description: '', sortOrder: '0' })
      toast.success('Business type created.')
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
        setCreateErrors(parseFieldErrors(err.errors))
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to create business type')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (t: BusinessTypeDef) => {
    setEditId(t.id)
    setEditForm({ label: t.label, description: t.description ?? '', isActive: t.isActive, sortOrder: String(t.sortOrder) })
    setEditErrors({})
  }

  const submitEdit = async () => {
    if (!editId) return
    setSubmitting(true)
    setEditErrors({})
    try {
      await updateBusinessType(editId, {
        label: editForm.label.trim(),
        description: editForm.description.trim() || undefined,
        isActive: editForm.isActive,
        sortOrder: Number(editForm.sortOrder || 0),
      })
      await load()
      setEditId(null)
      toast.success('Business type updated.')
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
        setEditErrors(parseFieldErrors(err.errors))
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to update business type')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (t: BusinessTypeDef) => {
    if (!window.confirm(`Deactivate business type "${t.label}" (${t.code})?`)) return
    setSubmitting(true)
    try {
      await deleteBusinessType(t.id)
      await load()
      if (editId === t.id) setEditId(null)
      toast.success(`"${t.label}" deactivated.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to deactivate')
    } finally {
      setSubmitting(false)
    }
  }

  const inp = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none'
  const lbl = 'block text-xs font-semibold text-slate-500 mb-1'
  const err = (f: string, errs: FieldErrors) => errs[f] ? <p className="mt-1 text-xs text-red-500">{errs[f]}</p> : null

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">Business Types</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Manage the business type options shown during registration. Each type seeds default categories.
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          {types.filter(t => t.isActive).length} active
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Table ── */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none flex-1 min-w-[160px]"
              placeholder="Search code or label…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
            />
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(0) }}
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No business types found.</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Label</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginated.map(t => (
                    editId === t.id ? (
                      <tr key={t.id} className="bg-blue-50">
                        <td className="px-4 py-3 text-slate-400">{t.sortOrder}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">{t.code}</span>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className={inp + ' text-xs'}
                            value={editForm.label}
                            onChange={e => setEditForm(p => ({ ...p, label: e.target.value }))}
                          />
                          {err('label', editErrors)}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            className={inp + ' text-xs'}
                            value={editForm.description}
                            onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                            placeholder="Description…"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.isActive}
                              onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))}
                              className="accent-blue-600"
                            />
                            <span className="text-xs text-slate-600">Active</span>
                          </label>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={submitEdit}
                              disabled={submitting}
                              className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditId(null)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 text-xs">{t.sortOrder}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">{t.code}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{t.label}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate">{t.description ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            t.isActive
                              ? 'bg-green-50 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {t.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(t)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Edit
                            </button>
                            {t.isActive && (
                              <button
                                type="button"
                                onClick={() => handleDeactivate(t)}
                                disabled={submitting}
                                className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                  <p className="text-xs text-slate-500">
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      ← Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPage(i)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          i === page
                            ? 'bg-blue-700 text-white'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page === totalPages - 1}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Create form ── */}
        <div className="self-start rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-display text-sm font-bold text-slate-800">Add New Type</h3>
          <div className="space-y-3">
            <div>
              <label className={lbl}>Code *</label>
              <input
                className={inp}
                value={createForm.code}
                onChange={e => setCreateForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. FLORIST"
                maxLength={50}
              />
              <p className="mt-1 text-xs text-slate-400">Uppercase, no spaces. Used by the seeding logic.</p>
              {err('code', createErrors)}
            </div>
            <div>
              <label className={lbl}>Label *</label>
              <input
                className={inp}
                value={createForm.label}
                onChange={e => setCreateForm(p => ({ ...p, label: e.target.value }))}
                placeholder="e.g. Flower Shop"
                maxLength={100}
              />
              {err('label', createErrors)}
            </div>
            <div>
              <label className={lbl}>Description</label>
              <textarea
                className={inp}
                rows={2}
                value={createForm.description}
                onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional description…"
                maxLength={500}
              />
              {err('description', createErrors)}
            </div>
            <div>
              <label className={lbl}>Sort Order</label>
              <input
                type="number"
                aria-label="Sort order"
                className={inp}
                value={createForm.sortOrder}
                onChange={e => setCreateForm(p => ({ ...p, sortOrder: e.target.value }))}
                min={0}
              />
            </div>
            <button
              type="button"
              onClick={submitCreate}
              disabled={submitting || !createForm.code.trim() || !createForm.label.trim()}
              className="w-full rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Create Business Type'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
