import { dwellBands, dwellMinutes, fineBandIndex, hourOf, inBand, tripEvents, validPlate } from "./behavior-model"
import type { BehaviorEvent, EventIndex } from "./behavior-model"
import { demoBehaviorEvents } from "./behavior-demo"
import { dayAt, dayStart, dayMinutes, inWindow, shiftDay, vnNow } from "./parking-model"
import type { ParkingSettings, Trip } from "./parking-model"

export const behaviorEvents = (settings: ParkingSettings) => settings.behaviorEvents ?? demoBehaviorEvents()

export function behaviorReportInputs(settings: ParkingSettings, cutoff: string, estates?: string[]) {
  const current = behaviorEvents(settings)
  const snapshot = settings.behaviorSnapshot
  if (!snapshot || cutoff >= snapshot.refreshDay) return { events: current, holidays: settings.holidays, pending: [] }
  const latestById = new Map(current.map((event) => [event.id, event]))
  return {
    events: snapshot.events.map((event) => ({ ...event, notes: latestById.get(event.id)?.notes ?? event.notes })),
    holidays: snapshot.holidays,
    pending: estates ? snapshot.days.filter((day) => snapshot.affected[day]?.some((scope) => !scope || estates.includes(scope))) : snapshot.days,
  }
}

export function queueBehaviorRefresh(settings: ParkingSettings, cutoff: string, days: string[], estate = "") {
  if (!days.length) return settings.behaviorSnapshot
  const snapshot = settings.behaviorSnapshot
  const pending = snapshot && cutoff < snapshot.refreshDay ? snapshot : null
  const now = vnNow(), today = dayAt(now)
  const affected = { ...pending?.affected }
  for (const day of days) affected[day] = [...new Set([...(affected[day] ?? []), estate])]
  return {
    refreshDay: now - dayStart(today) < 360 ? shiftDay(today, -1) : today,
    days: [...new Set([...(pending?.days ?? []), ...days])].sort(),
    affected,
    events: pending?.events ?? behaviorEvents(settings),
    holidays: pending?.holidays ?? settings.holidays,
  }
}

export const behaviorLookupKeys = ["bContext", "bCutoff", "bEvent", "bDuration", "bFrom", "bTo", "bExact",
  "bDays", "bHour", "bExitHour", "bPlate", "bValidPlate"] as const
export const clearBehaviorLookup = Object.fromEntries(behaviorLookupKeys.map((key) => [key, null]))
export const noEvent = "none"
export const anyEvent = "any"
export const lookupBandOptions = [
  { value: "eligible", label: "Có lưu trú" },
  ...dwellBands.fine.map((band, index) => ({ value: String(index), label: band[2] })),
]
export const lookupEventOptions = (events: BehaviorEvent[]) => [
  { value: anyEvent, label: "Có sự kiện" }, { value: noEvent, label: "Không sự kiện" },
  ...events.filter((event) => !event.deleted).map(({ id, name }) => ({ value: id, label: `${id} · ${name}` })),
]
const lookupHas = (value: string | null, compare: string) => value?.split(",").includes(compare)

export function lookupCutoff(params: URLSearchParams, fallback: number) {
  const end = params.get("bCutoff")
  return end && Number.isFinite(dayStart(end)) ? Math.min(fallback, dayStart(end) + dayMinutes) : fallback
}
export function prepareBehaviorLookup(params: URLSearchParams, cutoff: number, events: EventIndex) {
  const event = params.get("bEvent"), duration = params.get("bDuration")
  const from = params.get("bFrom"), to = params.get("bTo"), exact = params.get("bExact")
  const hoursIn = params.get("bHour"), hoursOut = params.get("bExitHour")
  const dates = params.get("bDays"), plate = params.get("bPlate"), onlyValid = params.has("bValidPlate")
  if (!event && !duration && from === null && to === null && exact === null &&
      !hoursIn && !hoursOut && !dates && !plate && !onlyValid) return () => true
  return (trip: Trip) => {
    if (dates && !lookupHas(dates, dayAt(trip.entered))) return false
    if (hoursIn && !lookupHas(hoursIn, String(hourOf(trip.entered)))) return false
    if (hoursOut && !(inWindow(trip.exited, trip.entered, cutoff) &&
        lookupHas(hoursOut, String(hourOf(trip.exited!))))) return false
    if (plate || onlyValid) {
      const normalized = validPlate(trip)
      if (!normalized || plate && normalized !== plate) return false
    }
    if (event) {
      const codes = tripEvents(trip, events)
      if (!event.split(",").some((id) => id === anyEvent ? codes.length > 0 :
        id === noEvent ? !codes.length : codes.includes(id))) return false
    }
    if (duration || from !== null || to !== null || exact !== null) {
      const minutes = dwellMinutes(trip, cutoff)
      if (minutes === null) return false
      if (exact !== null && minutes !== Number(exact)) return false
      if (duration && !lookupHas(duration, "eligible") && !lookupHas(duration, String(fineBandIndex(minutes)))) return false
      if ((from !== null || to !== null) && !inBand(minutes, [from === null ? 0 : Number(from), to === null ? Infinity : Number(to), ""])) return false
    }
    return true
  }
}

