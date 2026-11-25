import { shiftDay } from "./parking-model"
import type { RevenueFilter, RevenueScreen } from "./revenue-model"

export type RevenueEntryKind = "paper" | "receipt" | "history"
export const revenueEntryScreen = (kind: RevenueEntryKind) => kind === "paper" ? "revenue-paper" : kind === "receipt" ? "revenue-receipt" : "revenue-lookup"
export const revenueEntryKind = (params: URLSearchParams): RevenueEntryKind | null => {
  const value = params.get("entryPanel")
  if (value === "paper") return "history"
  return value === "receipt" || value === "history" ? value : params.get("tab") === "adjustments" ? "history" : null
}
export const closeRevenueEntry = (params: URLSearchParams): Record<string, null> =>
  Object.fromEntries([...params.keys()].filter((key) => key.startsWith("entry_") || ["entryPanel", "entryAction"].includes(key) || params.get("tab") === "adjustments" && ["tab", "changeDate"].includes(key)).map((key) => [key, null]))

export function openRevenueEntry(params: URLSearchParams, filter: RevenueFilter, kind: RevenueEntryKind, create: boolean, today: string): Record<string, string | null> {
  return { ...closeRevenueEntry(params), entryPanel: kind === "paper" ? "history" : kind, entryAction: create && kind === "receipt" ? "new" : null,
    entry_estate: filter.estate, entry_site: filter.site, entry_vehicle: filter.vehicle,
    entry_start: kind === "receipt" ? shiftDay(today, -6) : filter.start, entry_end: kind === "receipt" ? today : filter.end }
}

export function revenueEntryParams(params: URLSearchParams) {
  if (!params.get("entryPanel") && params.get("tab") === "adjustments")
    return new URLSearchParams([...params].filter(([key]) => ["estate", "site", "start", "end", "q", "changeDate"].includes(key)))
  return new URLSearchParams([...params].filter(([key]) => key.startsWith("entry_")).map(([key, value]) => [key.slice(6), value]))
}
export const updateRevenueEntry = (patch: Record<string, string | null>) =>
  Object.fromEntries(Object.entries(patch).map(([key, value]) => [`entry_${key}`, value]))

/** Old source-document bookmarks retain their own dates and search inside the lookup workspace. */
export function revenueEntryRedirect(screen: RevenueScreen, params: URLSearchParams): Record<string, string | null> | null {
  if (screen !== "revenue-paper" && screen !== "revenue-receipt") return null
  return { ...Object.fromEntries([...params].map(([key, value]) => [`entry_${key}`, value])),
    estate: params.get("estate"), site: params.get("site"), vehicle: params.get("vehicle"),
    entryPanel: screen === "revenue-paper" ? "history" : "receipt", entryAction: null }
}

export function revenueHistoryParams(filter: RevenueFilter, query = "", basis = "recorded"): Record<string, string | null> {
  return { entryPanel: "history", entryAction: null, entry_estate: filter.estate || null, entry_site: filter.site || null,
    entry_start: filter.start, entry_end: filter.end, entry_q: query || null, entry_changeDate: basis,
    entry_vehicle: null, entry_page: null, tab: null, changeDate: null }
}
