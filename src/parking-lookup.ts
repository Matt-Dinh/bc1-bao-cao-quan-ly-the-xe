import { allowedSites, overCapacityTripAlert, parkedDuringExceededHour, siteById, statusAt, tripAlerts } from "./parking-model"
import type { ParkingAccess, ParkingFilters, ParkingSettings, ParkingTripScope, Trip, Vehicle } from "./parking-model"

export const tripLookupScopeKeys = ["estate", "site", "vehicle"] as const
export const tripLookupOptionKeys = [...tripLookupScopeKeys, "state", "group", "lane", "alert"] as const

/** Keep legacy single-value report links; encode multiple values without delimiter ambiguity. */
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
export function tripLookupScope(params: URLSearchParams): ParkingTripScope {
  return { estates: tripLookupValues(params, "estate"), sites: tripLookupValues(params, "site"),
    vehicles: tripLookupValues(params, "vehicle") as Vehicle[] }
}
export function tripMatchesScope(trip: Trip, scope: ParkingTripScope) {
  return (!scope.estates.length || scope.estates.includes(siteById(trip.site)?.estate ?? "")) &&
    (!scope.sites.length || scope.sites.includes(trip.site)) &&
    (!scope.vehicles.length || scope.vehicles.includes(trip.vehicle))
}
export function tripLookupScopeDenied(scope: ParkingTripScope, access: ParkingAccess) {
  const allowed = allowedSites(access)
  return scope.estates.some((estate) => !allowed.some((site) => site.estate === estate)) ||
    scope.sites.some((id) => !allowed.some((site) => site.id === id && (!scope.estates.length || scope.estates.includes(site.estate))))
}
export function tripMatchesLookup(trip: Trip, params: URLSearchParams, end: number, filters: ParkingFilters,
  settings: ParkingSettings, exceeded: Map<string, number[]>, now: number) {
  const states = tripLookupValues(params, "state"), groups = tripLookupValues(params, "group")
  const lanes = tripLookupValues(params, "lane"), alerts = tripLookupValues(params, "alert")
  return tripMatchesScope(trip, tripLookupScope(params)) &&
    (!states.length || states.some((state) => state === "missing-exit"
      ? trip.exited == null && trip.entered <= now : state === statusAt(trip, end))) &&
    (!groups.length || groups.includes(trip.group)) &&
    (!lanes.length || lanes.some((lane) => lane === trip.laneIn || lane === trip.laneOut)) &&
    (!alerts.length || alerts.some((alert) => alert === overCapacityTripAlert.value
      ? parkedDuringExceededHour(trip, exceeded) : tripAlerts(trip, filters, settings).includes(alert)))
}
