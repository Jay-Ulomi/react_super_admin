import { useEffect, useMemo, useState } from 'react'
import {
  fetchTenantFeatures,
  fetchTenants,
  overrideTenantFeature,
  removeTenantFeatureOverride,
  type Tenant,
  type TenantFeature,
} from '../features/super-admin/super-admin-api'
import { useToast } from '../features/ui/toast-context'
import { ApiError } from '../types/api'
import { parseFieldErrors, type FieldErrors } from '../lib/validation'

export function TenantFeaturesPage() {
  const toast = useToast()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [features, setFeatures] = useState<TenantFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState({
    featureName: '',
    featureValue: '',
    isEnabled: true,
  })

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) || null,
    [selectedTenantId, tenants],
  )

  const loadFeatures = async (tenantId: string) => {
    const rows = await fetchTenantFeatures(tenantId)
    setFeatures(rows)
  }

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      try {
        const tenantRows = await fetchTenants()
        if (cancelled) return
        setTenants(tenantRows)
        const firstId = tenantRows[0]?.id
        if (firstId) {
          setSelectedTenantId(firstId)
          const featureRows = await fetchTenantFeatures(firstId)
          if (!cancelled) setFeatures(featureRows)
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load tenant features')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const onTenantChange = async (tenantId: string) => {
    setSelectedTenantId(tenantId)
    setLoading(true)
    try {
      await loadFeatures(tenantId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load tenant features')
    } finally {
      setLoading(false)
    }
  }

  const submitOverride = async () => {
    if (!selectedTenantId) return
    setSubmitting(true)
    setFieldErrors({})
    try {
      await overrideTenantFeature(selectedTenantId, {
        featureName: form.featureName.trim(),
        featureValue: form.featureValue.trim() || undefined,
        isEnabled: form.isEnabled,
      })
      await loadFeatures(selectedTenantId)
      setForm({ featureName: '', featureValue: '', isEnabled: true })
      toast.success('Feature override applied.')
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
        setFieldErrors(parseFieldErrors(err.errors))
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to apply override')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (feature: TenantFeature) => {
    if (!selectedTenantId) return
    if (!window.confirm(`Remove override for ${feature.featureName}?`)) return
    setSubmitting(true)
    try {
      await removeTenantFeatureOverride(selectedTenantId, feature.featureName)
      await loadFeatures(selectedTenantId)
      toast.success(`Override removed for ${feature.featureName}.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove override')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm xl:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl text-slate-900">Tenant Feature Overrides</h2>
          <select
            value={selectedTenantId}
            onChange={(event) => void onTenantChange(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            disabled={!tenants.length}
          >
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </select>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Tenant: {selectedTenant?.name ?? '-'} ({selectedTenantId || 'N/A'})
        </p>
        {loading ? <p className="text-sm text-slate-500">Loading features...</p> : null}
        {!loading ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-2 font-medium">Feature</th>
                  <th className="px-2 py-2 font-medium">Value</th>
                  <th className="px-2 py-2 font-medium">Enabled</th>
                  <th className="px-2 py-2 font-medium">Source</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {features.length ? (
                  features.map((feature) => (
                    <tr key={feature.id} className="border-b border-slate-100">
                      <td className="px-2 py-3 font-semibold text-slate-800">{feature.featureName}</td>
                      <td className="px-2 py-3 text-slate-600">{feature.featureValue || '-'}</td>
                      <td className="px-2 py-3 text-slate-700">{feature.isEnabled ? 'Yes' : 'No'}</td>
                      <td className="px-2 py-3 text-slate-600">{feature.overrideSource || '-'}</td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => void handleRemove(feature)}
                          disabled={submitting}
                          className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-70"
                        >
                          Remove Override
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-sm text-slate-500">
                      No feature overrides found for this tenant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <h3 className="font-display text-lg text-slate-900">Apply Override</h3>
        <div className="mt-3 space-y-2">
          <input
            placeholder="Feature Name"
            value={form.featureName}
            onChange={(event) => setForm((prev) => ({ ...prev, featureName: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          {fieldErrors.featureName ? <p className="text-xs text-rose-700">{fieldErrors.featureName}</p> : null}
          <input
            placeholder="Feature Value (optional)"
            value={form.featureValue}
            onChange={(event) => setForm((prev) => ({ ...prev, featureValue: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(event) => setForm((prev) => ({ ...prev, isEnabled: event.target.checked }))}
            />
            Enabled
          </label>
          <button
            type="button"
            onClick={() => void submitOverride()}
            disabled={submitting || !selectedTenantId || !form.featureName.trim()}
            className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-70"
          >
            Apply Override
          </button>
        </div>
      </section>
    </div>
  )
}
