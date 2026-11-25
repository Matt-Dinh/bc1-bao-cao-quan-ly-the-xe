export const revenueValues = (value: string | null | undefined) => [...new Set((value || "").split("|").filter(Boolean))]
export const revenueMatches = (value: string | undefined, selected: string | null | undefined) => !selected || revenueValues(selected).includes(value || "")
export const revenueIntersects = (values: readonly string[], selected: string | null | undefined) => !selected || values.some((value) => revenueMatches(value, selected))
export const revenueSelectionLabel = (selected: string, label: (value: string) => string) => revenueValues(selected).map(label).join(", ")
