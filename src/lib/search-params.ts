export function parseNonNegativeInt(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export function parseEnum<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  if (value && allowed.includes(value as T)) return value as T
  return fallback
}

export function parsePageSize(value: string | null, allowed: readonly number[], fallback: number): number {
  const parsed = Number(value)
  return allowed.includes(parsed) ? parsed : fallback
}

export function buildSearchParams(values: Record<string, string | number | null | undefined>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  return params
}
