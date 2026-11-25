export const tripLookupScopeKeys = ["estate", "site", "vehicle"] as const
export const tripLookupOptionKeys = [...tripLookupScopeKeys, "state", "group", "lane", "alert", "dayKind"] as const

/** Accept legacy single-value links and repeated params as well as multi-select JSON. */
export function tripLookupValues(params: URLSearchParams, key: string): string[] {
  return [...new Set(params.getAll(key).flatMap((raw) => {
    if (!raw) return []
    if (raw.startsWith("[")) {
      try {
        const values: unknown = JSON.parse(raw)
        if (Array.isArray(values) && values.every((value) => typeof value === "string")) return values.filter(Boolean)
      } catch { /* Invalid selections must not silently broaden the scope. */ }
    }
    return [raw]
  }))]
}
export function tripLookupValue(values: readonly string[]): string | null {
  const unique = [...new Set(values.filter(Boolean))]
  return unique.length > 1 ? JSON.stringify(unique) : unique[0] ?? null
}
