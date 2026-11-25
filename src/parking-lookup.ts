import { allowedSites, dayAt, dayMinutes, dayStart, dayType, daysIn, overCapacityTripAlert, parkedDuringExceededHour, siteById, statusAt, touches, tripAlerts, tripLookupMode, tripLookupWindow } from "./parking-model"
import type { ParkingAccess, ParkingFilters, ParkingSettings, ParkingTripScope, Trip, Vehicle } from "./parking-model"
import { tripGuest, tripVehicle } from "./behavior-model"

import { tripLookupValues } from "./parking-filter-values"
export { tripLookupScopeKeys, tripLookupOptionKeys, tripLookupValues, tripLookupValue } from "./parking-filter-values"

/** Ordinary lookup matches presence on a selected date; report links retain their metric's own semantics. */
export function prepareTripDayFilter(params: URLSearchParams, filters: ParkingFilters, settings: ParkingSettings) {
  const kinds = tripLookupValues(params, "dayKind")
  if (!kinds.length || tripLookupMode(params)) return () => true
  const { start, end } = tripLookupWindow(params, filters)
  const windows = daysIn(dayAt(start), dayAt(end - 1)).filter((day) => kinds.includes(dayType(day, settings.holidays)))
    .map((day) => [Math.max(start, dayStart(day)), Math.min(end, dayStart(day) + dayMinutes)])
  return (trip: Trip) => windows.some(([from, until]) => from < until && touches(trip, from, until))
}
export function tripLookupScope(params: URLSearchParams): ParkingTripScope {
  return { estates: tripLookupValues(params, "estate"), sites: tripLookupValues(params, "site"),
    vehicles: tripLookupValues(params, "vehicle") as Vehicle[] }
}
export function tripMatchesScope(trip: Trip, scope: ParkingTripScope, behavior = false) {
  return (!scope.estates.length || scope.estates.includes(siteById(trip.site)?.estate ?? "")) &&
    (!scope.sites.length || scope.sites.includes(trip.site)) &&
    (!scope.vehicles.length || (scope.vehicles as readonly string[]).includes(behavior ? tripVehicle(trip) : trip.vehicle))
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
  return tripMatchesScope(trip, tripLookupScope(params), params.has("bContext")) &&
    (!states.length || states.some((state) => state === "missing-exit"
      ? trip.exited == null && trip.entered <= now : state === statusAt(trip, end))) &&
    (!groups.length || groups.includes(tripGuest(trip))) &&
    (!lanes.length || lanes.some((lane) => lane === trip.laneIn || lane === trip.laneOut)) &&
    (!alerts.length || alerts.some((alert) => alert === overCapacityTripAlert.value
      ? parkedDuringExceededHour(trip, exceeded) : tripAlerts(trip, filters, settings).includes(alert)))
}
