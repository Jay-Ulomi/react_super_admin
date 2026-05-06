export type FieldErrors = Record<string, string>

export function parseFieldErrors(errors: unknown): FieldErrors {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) {
    return {}
  }
  const entries = Object.entries(errors as Record<string, unknown>)
  const parsed: FieldErrors = {}
  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      parsed[key] = value
    }
  }
  return parsed
}
