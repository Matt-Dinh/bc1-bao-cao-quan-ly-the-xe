import { estates } from "./data"
import {
  allowedSites, clockTime, dayAt, dayMinutes, dayStart, daysIn, goLive, inWindow, isDay,
  parkingGroups, parkingVehicles, shiftDay, siteById, timeMinutes,
} from "./parking-model"
import type { Holiday, ParkingAccess, Trip } from "./parking-model"

export const unknownBehavior = "Chưa xác định"
export const behaviorGuests = [...parkingGroups, unknownBehavior]
export const behaviorVehicles = [...parkingVehicles, unknownBehavior]
export const eventTypes = ["Triển lãm", "Lễ hội", "Hội thảo", "Khuyến mại", "Biểu diễn", "Khác"] as const
export const eventLabels = ["Sự kiện", "Không sự kiện"] as const
export const dayKinds = ["Ngày thường", "Cuối tuần", "Ngày lễ"] as const
export const weekdays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
export const weekday = (day: string) => (new Date(dayStart(day) * 60_000).getUTCDay() + 6) % 7
export const hours = Array.from({ length: 24 }, (_, hour) => hour)
export const hourOf = (minute: number) => Math.floor((minute % dayMinutes) / 60)
export const hourLabel = (hour: number) => `${clockTime(hour * 60)} – ${hour === 23 ? "24:00" : clockTime((hour + 1) * 60)}`
export const estateName = (id: string) => estates.find((estate) => estate.id === id)?.name ?? id
export const canReadBehavior = (access: ParkingAccess) => ["admin", "manager", "operations", "reviewer", "it"].includes(access.role)
export const canEditEvent = (access: ParkingAccess) => ["admin", "manager"].includes(access.role)
export const canEditHoliday = (access: ParkingAccess) => ["admin", "it"].includes(access.role)
export const canSeePlates = (access: ParkingAccess) => ["admin", "manager"].includes(access.role)
export const canExportBehavior = (access: ParkingAccess) => ["admin", "manager", "operations", "it"].includes(access.role)

export interface EventWindow { day: string; start: string; end: string; overnight: boolean }
export interface BehaviorNote { text: string; actor: string; at: string }
export interface BehaviorEvent {
  id: string
  name: string
  type: typeof eventTypes[number]
  estate: string
  sites: string[]
  windows: EventWindow[]
  description: string
  notes: BehaviorNote[]
  deleted?: boolean
  history: (BehaviorNote & { before?: EventFields; after: EventFields })[]
}
export type EventFields = Omit<BehaviorEvent, "history" | "notes">
export const eventFields = ({ id, name, type, estate, sites, windows, description, deleted }: BehaviorEvent): EventFields =>
  ({ id, name, type, estate, sites, windows, description, deleted })

export interface BehaviorFilters {
  start: string
  end: string
  estates: string[]
  sites: string[]
  vehicles: string[]
  guests: string[]
  type: string
}
export const behaviorPeriod = (yesterday: string) => ({ start: `${yesterday.slice(0, 7)}-01`, end: yesterday })
export function behaviorPeriodError({ start, end }: Pick<BehaviorFilters, "start" | "end">, yesterday: string) {
  if (!isDay(start) || !isDay(end)) return "Vui lòng chọn đầy đủ ngày báo cáo."
  if (start > end) return "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc."
  if (end > yesterday) return "Ngày kết thúc phải trước hôm nay."
  if (dayStart(end) - dayStart(start) >= dayMinutes * 31) return "Kỳ báo cáo tối đa 31 ngày."
  return ""
}
export function behaviorScope(filters: BehaviorFilters, access: ParkingAccess) {
  const allowed = allowedSites(access)
  const estates = allowed.filter((site) => !filters.estates.length || filters.estates.includes(site.estate))
  return {
    denied: !allowed.length || filters.estates.some((id) => !allowed.some((site) => site.estate === id)) ||
      filters.sites.some((id) => !estates.some((site) => site.id === id)),
    sites: estates.filter((site) => !filters.sites.length || filters.sites.includes(site.id)),
  }
}

export const windowStart = (window: EventWindow) => dayStart(window.day) + timeMinutes(window.start)
export const windowEnd = (window: EventWindow) =>
  dayStart(window.day) + timeMinutes(window.end) + (window.overnight ? dayMinutes : 0)

function migrateEventFields<T extends EventFields>(value: T & { early?: number }): T {
  if (!Object.prototype.hasOwnProperty.call(value, "early")) return value
  const { early, ...fields } = value
  const offset = Number.isFinite(early) ? Math.max(0, early!) : 0
  const intervals: { start: number; end: number }[] = []
  for (const window of [...value.windows].sort((a, b) => windowStart(a) - windowStart(b))) {
    const start = windowStart(window) - offset, end = windowEnd(window)
    const previous = intervals.at(-1)
    if (previous && start < previous.end) previous.end = Math.max(previous.end, end)
    else intervals.push({ start, end })
  }
  const windows: EventWindow[] = []
  for (const interval of intervals) {
    for (let start = interval.start; start < interval.end; start += dayMinutes) {
      const end = Math.min(start + dayMinutes, interval.end)
      windows.push({ day: dayAt(start), start: clockTime(start), end: clockTime(end), overnight: dayAt(end) > dayAt(start) })
    }
  }
  return { ...fields, windows } as T
}

export function migrateBehaviorEvent(event: BehaviorEvent & { early?: number }): BehaviorEvent {
  const value = migrateEventFields(event)
  const history = event.history.map((entry) => {
    const before = entry.before && migrateEventFields(entry.before)
    const after = migrateEventFields(entry.after)
    return before === entry.before && after === entry.after ? entry : { ...entry, before, after }
  })
  return value === event && history.every((entry, i) => entry === event.history[i]) ? event : { ...value, history }
}
export const eventStart = (event: BehaviorEvent) => Math.min(...event.windows.map(windowStart))
export const eventEnd = (event: BehaviorEvent) => Math.max(...event.windows.map(windowEnd))
export const eventDays = (event: BehaviorEvent) => [...new Set(event.windows.flatMap((window) =>
  daysIn(dayAt(windowStart(window)), dayAt(windowEnd(window) - 1))))].sort()
export const eventState = (event: BehaviorEvent, now: number) =>
  now < eventStart(event) ? "Sắp diễn ra" : now >= eventEnd(event) ? "Đã diễn ra" : "Đang diễn ra"

export const tripVehicle = (trip: Trip) =>
  trip.ticket.startsWith("QR-") ? "Ô tô" : parkingVehicles.includes(trip.vehicle) ? trip.vehicle : unknownBehavior
export const tripGuest = (trip: Trip) => parkingGroups.includes(trip.group) ? trip.group : unknownBehavior
export const normalizedPlate = (plate: string) => plate.toUpperCase().replace(/[^A-Z0-9]/g, "")
export function validPlate(trip: Trip) {
  const plate = normalizedPlate(trip.plate)
  return tripVehicle(trip) !== "Xe đạp" && /[A-Z]/.test(plate) && /[0-9]/.test(plate) ? plate : ""
}
export function dwellMinutes(trip: Trip, cutoffEnd = Infinity) {
  if (trip.exited === null || trip.exited < trip.entered || trip.exited >= cutoffEnd ||
    trip.sourceIn?.includes("bổ sung") || trip.sourceOut?.includes("bổ sung")) return null
  return Math.floor(trip.exited - trip.entered + 1e-8)
}
export const dwellBands = {
  fine: [[0, 15, "Dưới 15 phút"], [15, 30, "15 – dưới 30 phút"], [30, 60, "30 – dưới 60 phút"],
    [60, 120, "1 – dưới 2 giờ"], [120, 240, "2 – dưới 4 giờ"], [240, 360, "4 – dưới 6 giờ"],
    [360, 480, "6 – dưới 8 giờ"], [480, Infinity, "Từ 8 giờ"]],
  coarse: [[0, 15, "Dưới 15 phút"], [15, 60, "15 – dưới 60 phút"], [60, 240, "1 – dưới 4 giờ"],
    [240, 480, "4 – dưới 8 giờ"], [480, Infinity, "Từ 8 giờ"]],
  compare: [[0, 30, "Dưới 30 phút"], [30, 120, "30 phút – dưới 2 giờ"], [120, 240, "2 – dưới 4 giờ"], [240, Infinity, "Từ 4 giờ"]],
} as const
export type BehaviorBand = readonly [number, number, string]
export const inBand = (minutes: number | null, band: BehaviorBand) => minutes !== null && minutes >= band[0] && minutes < band[1]
export const fineBandIndex = (minutes: number | null) => dwellBands.fine.findIndex((band) => inBand(minutes, band))
export const behaviorDayKind = (day: string, holidays: Set<string>) =>
  holidays.has(day) ? dayKinds[2] : weekday(day) >= 5 ? dayKinds[1] : dayKinds[0]

export function indexEvents(events: BehaviorEvent[]) {
  const bySiteDay = new Map<string, { id: string; start: number; end: number }[]>()
  for (const event of events) {
    if (event.deleted) continue
    for (const window of event.windows) {
      const start = windowStart(window)
      const end = windowEnd(window)
      for (const day of daysIn(dayAt(start), dayAt(end - 1))) {
        for (const site of event.sites) {
          const key = `${site}/${day}`
          const list = bySiteDay.get(key) ?? []
          list.push({ id: event.id, start, end })
          bySiteDay.set(key, list)
        }
      }
    }
  }
  return bySiteDay
}
export type EventIndex = ReturnType<typeof indexEvents>
export function tripEvents(trip: Trip, index: EventIndex, day = dayAt(trip.entered)) {
  return [...new Set((index.get(`${trip.site}/${day}`) ?? [])
    .filter(({ start, end }) => inWindow(trip.entered, start, end)).map(({ id }) => id))]
}

export interface BehaviorArrival {
  trip: Trip
  day: string
  vehicle: string
  guest: string
  events: string[]
  dwell: number | null
  plate: string
  exit: number | null
}
export function buildBehaviorData(trips: Trip[], events: BehaviorEvent[], calendar: Holiday[], filters: BehaviorFilters,
  allowed: ReturnType<typeof behaviorScope>["sites"], cutoff: string) {
  const selectedSites = new Set(allowed.map(({ id }) => id))
  const selectedEstates = new Set(allowed.map(({ estate }) => estate))
  const familiar = new Set<string>(), tripsByDay = new Map<string, BehaviorArrival[]>()
  const arrivalStart = dayStart(filters.start)
  const arrivalEnd = dayStart(shiftDay(filters.end < cutoff ? filters.end : cutoff, 1))
  const cutoffEnd = dayStart(shiftDay(cutoff, 1))
  const earliest = arrivalStart - 90 * dayMinutes
  const index = indexEvents(events)
  const arrivals: BehaviorArrival[] = []
  let availableFrom = Infinity
  for (const trip of trips) {
    const allowedEstate = selectedEstates.has(trip.site.split(":")[0])
    if (!allowedEstate || trip.entered >= arrivalEnd) continue
    availableFrom = Math.min(availableFrom, trip.entered)
    if (trip.entered < earliest) continue
    if (trip.entered >= earliest && trip.entered < arrivalStart) {
      const plate = validPlate(trip)
      if (plate) familiar.add(plate)
    }
    if (!selectedSites.has(trip.site)) continue
    const day = dayAt(trip.entered)
    const vehicle = tripVehicle(trip), guest = tripGuest(trip)
    if (filters.vehicles.length && !filters.vehicles.includes(vehicle) ||
      filters.guests.length && !filters.guests.includes(guest)) continue
    const row = { trip, day, vehicle, guest, events: tripEvents(trip, index, day), dwell: dwellMinutes(trip, cutoffEnd),
      plate: validPlate(trip), exit: trip.exited != null && trip.exited >= trip.entered && trip.exited < cutoffEnd ? trip.exited : null }
    if (trip.entered >= arrivalStart) arrivals.push(row)
    const list = tripsByDay.get(day) ?? []
    list.push(row)
    tripsByDay.set(day, list)
  }
  const dates = daysIn(filters.start, filters.end < cutoff ? filters.end : cutoff)
  const holidays = new Set(calendar.filter((row) => !row.canceled).map((row) => row.effective))
  const selectedEvents = events.filter((event) =>
    !event.deleted && (!filters.type || event.type === filters.type) && event.sites.some((site) => selectedSites.has(site)) &&
    eventStart(event) < arrivalEnd && event.windows.some((w) => windowStart(w) < arrivalEnd && windowEnd(w) > arrivalStart))
    .sort((a, b) => eventStart(a) - eventStart(b))
  const days = dates.map((day) => ({
    day, rows: tripsByDay.get(day) ?? [], kind: behaviorDayKind(day, holidays),
    events: selectedEvents.filter((event) => event.windows.some((w) =>
      windowStart(w) < dayStart(day) + dayMinutes && windowEnd(w) > dayStart(day))),
  }))
  const firstAvailableDay = Number.isFinite(availableFrom) ? dayAt(availableFrom) : filters.start
  const historyDays = Math.max(0, Math.min(90, Math.floor((arrivalStart - dayStart(firstAvailableDay)) / dayMinutes)))
  return { arrivals, tripsByDay, days, holidays, selectedEvents, familiar, historyDays, selectedSites, arrivalStart, arrivalEnd,
    cutoffEnd, firstAvailableDay }
}
export type BehaviorData = ReturnType<typeof buildBehaviorData>

export function peakHours(counts: number[]) {
  const max = Math.max(0, ...counts)
  const first = counts.indexOf(max)
  return max ? `${hourLabel(first)}${counts.lastIndexOf(max) !== first ? " (đồng hạng)" : ""}` : "—"
}
export const proportion = (count: number, total: number) => total ? count / total * 100 : null
export function arrivalStats(rows: BehaviorArrival[]) {
  const durations: number[] = []
  const inCounts = hours.map(() => 0), outCounts = hours.map(() => 0)
  let brief = 0, two = 0, four = 0, exited = 0, total = 0
  for (const row of rows) {
    inCounts[hourOf(row.trip.entered)]++
    if (row.exit !== null) { outCounts[hourOf(row.exit)]++; exited++ }
    if (row.dwell === null) continue
    durations.push(row.dwell)
    total += row.dwell
    if (row.dwell < 30) brief++
    if (row.dwell >= 120) two++
    if (row.dwell >= 240) four++
  }
  durations.sort((a, b) => a - b)
  const n = durations.length
  return {
    count: rows.length, n, exited, min: durations[0] ?? null, max: durations[n - 1] ?? null,
    average: n ? Math.round(total / n) : null,
    median: n ? Math.round((durations[Math.floor((n - 1) / 2)] + durations[Math.floor(n / 2)]) / 2) : null,
    brief: proportion(brief, n), two: proportion(two, n), four: proportion(four, n),
    peakIn: peakHours(inCounts), peakOut: peakHours(outCounts), inCounts, outCounts,
  }
}

export function summarizeEvents(data: BehaviorData, allEvents: BehaviorEvent[]) {
  const rowsByEvent = new Map<string, BehaviorArrival[]>()
  for (const row of data.arrivals) {
    for (const id of row.events) {
      const list = rowsByEvent.get(id) ?? []
      list.push(row)
      rowsByEvent.set(id, list)
    }
  }
  return data.selectedEvents.map((event) => {
    const sites = new Set(event.sites.filter((id) => data.selectedSites.has(id)))
    let previousEnd = -Infinity
    const windows = [...event.windows].sort((a, b) => windowStart(a) - windowStart(b)).flatMap((window) => {
      const start = Math.max(previousEnd, windowStart(window), data.arrivalStart)
      const end = Math.min(windowEnd(window), data.arrivalEnd)
      previousEnd = Math.max(previousEnd, end)
      if (start >= end) return []
      const rows = (rowsByEvent.get(event.id) ?? []).filter(({ trip }) => inWindow(trip.entered, start, end))
      const weeks: { day: string; count: number }[] = []
      for (let week = 1; week <= 8 && weeks.length < 4; week++) {
        const from = start - week * 7 * dayMinutes, to = end - week * 7 * dayMinutes
        const day = dayAt(from)
        const days = daysIn(day, dayAt(to - 1))
        if (day < goLive || day < data.firstAvailableDay || days.some((d) => data.holidays.has(d))) continue
        const clash = allEvents.some((other) => !other.deleted && other.estate === event.estate &&
          other.windows.some((slot) => windowStart(slot) < to && windowEnd(slot) > from))
        if (clash) continue
        const count = days.reduce((sum, d) => sum + (data.tripsByDay.get(d) ?? [])
          .filter(({ trip }) => sites.has(trip.site) && inWindow(trip.entered, from, to)).length, 0)
        weeks.push({ day, count })
      }
      const expected = weeks.length >= 2 ? weeks.reduce((sum, week) => sum + week.count, 0) / weeks.length : null
      return [{ window, start, end, weeks, expected, rows }]
    })
    const rows = rowsByEvent.get(event.id) ?? []
    const expected = windows.every((w) => w.expected !== null)
      ? windows.reduce((sum, w) => sum + (w.expected ?? 0), 0) : null
    return { event, windows, rows, expected, gain: expected === null ? null : rows.length - expected,
      partial: eventStart(event) < data.arrivalStart || eventEnd(event) > data.arrivalEnd }
  })
}
export type EventSummary = ReturnType<typeof summarizeEvents>[number]

export function eventTimeline(summary: EventSummary) {
  return summary.windows.map(({ window, rows }) => {
    const start = Math.floor(windowStart(window) / 60) * 60 - 60
    const end = Math.ceil(windowEnd(window) / 60) * 60 + 120
    const hours = Array.from({ length: (end - start) / 60 }, (_, index) =>
      ({ minute: start + index * 60, incoming: 0, outgoing: 0 }))
    for (const row of rows) {
      const enter = hours[Math.floor((row.trip.entered - start) / 60)]
      if (enter) enter.incoming++
      const exit = row.exit === null ? undefined : hours[Math.floor((row.exit - start) / 60)]
      if (exit) exit.outgoing++
    }
    return { window, hours }
  })
}

export const repeatBands = [
  [1, 2, "1 lần"], [2, 4, "2 – 3 lần"], [4, 8, "4 – 7 lần"], [8, Infinity, "Từ 8 lần"],
] as const
export interface ReturningVehicle { plate: string; vehicle: string; rows: BehaviorArrival[]; first: number; last: number; familiar: boolean }
export function returningVehicles(data: BehaviorData) {
  const groups = new Map<string, ReturningVehicle>()
  for (const row of data.arrivals) {
    if (!row.plate) continue
    const existing = groups.get(row.plate)
    if (existing) {
      existing.rows.push(row)
      if (row.trip.entered < existing.first) {
        existing.first = row.trip.entered
        existing.vehicle = row.vehicle
      }
      existing.last = Math.max(existing.last, row.trip.entered)
    } else groups.set(row.plate, { plate: row.plate, vehicle: row.vehicle, rows: [row], first: row.trip.entered,
      last: row.trip.entered, familiar: data.familiar.has(row.plate) })
  }
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length || a.plate.localeCompare(b.plate))
}

export function validateEvent(event: EventFields, existing: BehaviorEvent | undefined, today: string) {
  if (event.name.trim().length < 3 || event.name.trim().length > 200) return "Tên sự kiện phải có từ 3 đến 200 ký tự."
  if (!event.sites.length || event.sites.some((site) => siteById(site)?.estate !== event.estate)) return "Chọn ít nhất một bãi xe thuộc khu đô thị."
  if (event.description.length > 1000) return "Mô tả tối đa 1.000 ký tự."
  if (!event.windows.length || event.windows.length > 100) return "Sự kiện cần từ 1 đến 100 khung giờ."
  const oldLimit = dayStart(shiftDay(today, -90))
  const windows = [...event.windows].sort((a, b) => windowStart(a) - windowStart(b))
  const windowKey = (window: EventWindow) => [window.day, window.start, window.end, window.overnight].join("/")
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5][05]$/.test(value)
  for (const [index, window] of windows.entries()) {
    if (!isDay(window.day) || !validTime(window.start) || !validTime(window.end)) return "Nhập ngày và giờ theo bước 5 phút."
    const start = windowStart(window), end = windowEnd(window)
    if (end <= start) return "Giờ kết thúc phải sau giờ bắt đầu."
    if (end - start > dayMinutes) return "Một khung giờ không được dài hơn 24 giờ."
    if (index > 0 && windowEnd(windows[index - 1]) > start) return "Các khung giờ của một sự kiện không được chồng nhau."
    if (end <= oldLimit && !existing?.windows.some((old) => windowKey(old) === windowKey(window)))
      return "Chỉ được thêm hoặc sửa khung giờ đã kết thúc trong 90 ngày gần nhất."
  }
  if (existing?.windows.some((old) => windowEnd(old) <= oldLimit &&
      !windows.some((window) => windowKey(old) === windowKey(window)))) return "Không thể bỏ khung giờ đã kết thúc quá 90 ngày."
  if (existing?.windows.some((old) => windowEnd(old) <= oldLimit) &&
      [...event.sites].sort().join() !== [...existing.sites].sort().join())
    return "Không thể đổi phạm vi bãi của khung giờ đã kết thúc quá 90 ngày."
  return ""
}

