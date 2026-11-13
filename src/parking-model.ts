import { estates, normalize } from "./data"

export const parkingVehicles = [
  "Ô tô",
  "Xe máy",
  "Xe đạp",
  "Chưa xác định",
] as const
export const parkingGroups = ["Vãng lai", "Thuê bao", "VIP"] as const
export const durationGroups = [
  "Dưới 15 phút",
  "15 – 60 phút",
  "1 – 4 giờ",
  "4 – 8 giờ",
  "Trên 8 giờ",
]
export const dayTypes = ["Ngày thường", "Cuối tuần", "Lễ tết"] as const
export const alertTabs = [
  "Vượt sức chứa",
  "Tồn bất thường",
  "Ra không thu đủ",
  "Bất thường tại làn",
]
export const laneIssues = [
  "Vào lại khi lượt trước chưa ra",
  "Ra không có lượt vào",
  "Mở barie thủ công bất thường",
  "Không nhận diện biển số",
  "Xe trong danh sách đen",
] as const
export const parkingSites = estates.flatMap((estate) =>
  estate.parks.map((name, index) => ({
    id: `${estate.id}:${index}`,
    estate: estate.id,
    name,
    label: `${name} · ${estate.short}`,
  })),
)
export const parkingMenus = [
  { id: "parking-report", group: "Báo cáo", title: "Báo cáo chỗ đỗ" },
  {
    id: "parking-capacity",
    group: "Quản lý chỗ đỗ",
    title: "Sức chứa và kế hoạch bãi xe",
  },
  { id: "parking-trips", group: "Quản lý chỗ đỗ", title: "Tra cứu lượt xe" },
  {
    id: "parking-alerts",
    group: "Quản lý chỗ đỗ",
    title: "Cảnh báo xe ra vào",
  },
  { id: "parking-settings", group: "Cấu hình", title: "Tham số chỗ đỗ" },
] as const
export type ParkingScreen = typeof parkingMenus[number]["id"]
export const isParkingScreen = (value: string | null): value is ParkingScreen =>
  parkingMenus.some((menu) => menu.id === value)
export type Vehicle = typeof parkingVehicles[number]
export type Guest = typeof parkingGroups[number]
export type Role = "admin" | "manager" | "operations" | "finance" | "reviewer" | "it" | "security"
export const parkingRoles: Record<Role, string> = {
  admin: "Admin Local",
  manager: "Ban quản lý",
  operations: "Ban Vận hành VCR",
  finance: "Kế toán",
  reviewer: "TT / CBLĐ (hậu kiểm)",
  it: "IT VCR",
  security: "Nhân viên an ninh",
}
export type ParkingAccess = { role: Role; estate: string }
export const demoAccess: ParkingAccess = { role: "admin", estate: "" }
export function allowedSites(access: ParkingAccess) {
  return parkingSites.filter(
    (site) =>
      (!access.estate || site.estate === access.estate) &&
      (access.role !== "security" || site.id === `${access.estate || "A"}:0`),
  )
}
export function canOpen(access: ParkingAccess, screen: ParkingScreen) {
  switch (access.role) {
    case "reviewer":
      return screen === "parking-alerts" || screen === "parking-trips"
    case "security":
      return screen === "parking-report"
    case "finance":
      return screen !== "parking-capacity" && screen !== "parking-settings"
    default:
      return true
  }
}
export const canExport = (access: ParkingAccess) => access.role !== "security"
export const canDeclare = (access: ParkingAccess) =>
  access.role === "admin" || access.role === "manager"
export const canConfigure = (access: ParkingAccess) =>
  access.role === "admin" || access.role === "it"
export const canReceiveParkingAlerts = (access: ParkingAccess) =>
  access.role === "admin" || access.role === "manager"

const minuteMs = 60_000
export const dayMinutes = 1440
export const goLive = "2026-09-01"
export const dayStart = (day: string) =>
  Date.parse(`${day}T00:00:00Z`) / minuteMs
export const minuteIso = (minute: number) =>
  new Date(minute * minuteMs).toISOString().slice(0, 19)
export const dayAt = (minute: number) => minuteIso(minute).slice(0, 10)
export const shiftDay = (day: string, offset: number) =>
  dayAt(dayStart(day) + offset * dayMinutes)
export const vnNow = () => Date.now() / minuteMs + 7 * 60
export const vnToday = () => dayAt(vnNow())
export const lastReportDay = () => {
  const now = vnNow()
  const today = dayAt(now)
  return shiftDay(today, now - dayStart(today) < 360 ? -2 : -1)
}
export const displayTime = (minute: number | null, seconds = false) => {
  if (minute === null) return "—"
  const iso = minuteIso(minute)
  return `${iso.slice(0, 10).split("-").reverse().join("/")} ${iso.slice(11, seconds ? 19 : 16)}`
}
export const clockTime = (minutes: number) => {
  const withinDay = ((minutes % dayMinutes) + dayMinutes) % dayMinutes
  return `${String(Math.floor(withinDay / 60)).padStart(2, "0")}:${String(withinDay % 60).padStart(2, "0")}`
}
export const timeMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}
export const timeSpan = (from: string, to: string) =>
  (timeMinutes(to) - timeMinutes(from) + dayMinutes) % dayMinutes || dayMinutes
export const overlap = (a: number, b: number, c: number, d: number) =>
  Math.max(0, Math.min(b, d) - Math.max(a, c))
export const isDay = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) &&
  Number.isFinite(dayStart(day)) &&
  dayAt(dayStart(day)) === day
export function daysIn(start: string, end: string) {
  const count = (dayStart(end) - dayStart(start)) / dayMinutes + 1
  return Array.from({ length: Math.max(0, count) }, (_, index) =>
    shiftDay(start, index),
  )
}
export const lockDay = (day: string) => shiftDay(day, 4)
export const isLocked = (day: string, now = vnNow()) =>
  now >= dayStart(lockDay(day)) + 360

export interface ParkingFilters {
  estate: string
  site: string
  vehicle: Vehicle
  start: string
  end: string
}
export const defaultParkingFilters = (
  cutoff = lastReportDay(),
): ParkingFilters => ({
  estate: "",
  site: "",
  vehicle: "Ô tô",
  start: shiftDay(cutoff, -6),
  end: cutoff,
})
export function periodError(filters: ParkingFilters, cutoff: string) {
  if (!isDay(filters.start) || !isDay(filters.end))
    return "Vui lòng chọn đầy đủ ngày báo cáo."
  if (filters.start > filters.end)
    return "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc."
  if (filters.end > cutoff) return "Ngày kết thúc vượt quá ngày đã có số liệu."
  if (dayStart(filters.end) - dayStart(filters.start) >= 31 * dayMinutes)
    return "Khoảng thời gian không được vượt quá 31 ngày."
  return ""
}
export type Source = "Làn tự động" | "ANBV bổ sung" | "App khi mất điện"
export interface Trip {
  id: string
  site: string
  vehicle: Vehicle
  group: Guest
  plate: string
  ticket: string
  owner: string
  phone: string
  entered: number
  exited: number | null
  laneIn: string
  laneOut: string
  sourceIn: Source
  sourceOut: Source
  cameraIn?: string
  cameraOut?: string
  photoIn?: string
  photoOut?: string
  due: number | null
  paid: number | null
  voucher: number
  policy?: string
  issue?: {
    kind: typeof laneIssues[number]
    at: number
    lane: string
    note: string
    verifiedAt?: number
  }
  actions?: {
    at: number
    actor: string
    title: string
    reason: string
    afterLock?: boolean
  }[]
}
export interface Adjustment {
  trip: Trip
  day: string
  at: number
  actor: string
  title: string
}
interface Version {
  id: string
  effective: string
  updated: string
  actor: string
  canceled?: boolean
}
export interface Capacity extends Version {
  site: string
  vehicle: Vehicle
  planned: number
  actual: number
  design: number
  charging: number
}
export interface Plan extends Version {
  site: string
  vehicle: Vehicle
  month: string
  hours: number
}
export interface Shift {
  name: string
  from: string
  to: string
}
export interface Schedule extends Version {
  site: string
  from: string
  to: string
  shifts: Shift[]
}
export interface Threshold extends Version {
  estate: string
  hours: number
  approval: string
  note: string
}
export interface Holiday extends Version {
  name: string
  substitute: boolean
}
export type Declaration = Capacity | Plan | Schedule | Threshold | Holiday
export type DeclarationKind = "capacities" | "plans" | "schedules" | "thresholds" | "holidays"
export interface Audit {
  id: string
  at: string
  actor: string
  action: string
  scope: string
  detail: string
  before?: Declaration
  after?: Declaration
  kind?: DeclarationKind
}
export interface ParkingSettings {
  capacities: Capacity[]
  plans: Plan[]
  schedules: Schedule[]
  thresholds: Threshold[]
  holidays: Holiday[]
  history: Audit[]
}

export const keyFor = (row: Declaration) => {
  if ("month" in row) return `${row.site}/${row.vehicle}/${row.month}`
  if ("vehicle" in row) return `${row.site}/${row.vehicle}`
  if ("site" in row) return row.site
  if ("estate" in row) return row.estate
  return row.effective
}
export function effectiveRecord<T extends Declaration>(
  rows: T[],
  key: string,
  day: string,
) {
  return rows.reduce<T | undefined>(
    (latest, row) =>
      !row.canceled &&
      keyFor(row) === key &&
      row.effective <= day &&
      (!latest || row.effective > latest.effective)
        ? row
        : latest,
    undefined,
  )
}
export function effectiveEnd(row: Declaration, rows: Declaration[]) {
  const next = rows
    .filter(
      (item) =>
        !item.canceled &&
        keyFor(item) === keyFor(row) &&
        item.effective > row.effective,
    )
    .sort((a, b) => a.effective.localeCompare(b.effective))[0]
  const until = next ? shiftDay(next.effective, -1) : ""
  if (!("month" in row)) return until
  const monthEnd = dayAt(
    Date.UTC(Number(row.month.slice(0, 4)), Number(row.month.slice(5, 7)), 0) /
      minuteMs,
  )
  return until && until < monthEnd ? until : monthEnd
}
export function declarationStatus(
  row: Declaration,
  rows: Declaration[],
  today: string,
) {
  if (row.canceled) return "Đã hủy"
  if (row.effective > today) return "Sắp áp dụng"
  const end = effectiveEnd(row, rows)
  return end && end < today ? "Hết hiệu lực" : "Đang áp dụng"
}
export const thresholdAt = (
  settings: ParkingSettings,
  estate: string,
  day: string,
) => effectiveRecord(settings.thresholds, estate, day)?.hours ?? 72
export function dayType(day: string, holidays: Holiday[]) {
  if (
    holidays.some((holiday) => !holiday.canceled && holiday.effective === day)
  )
    return dayTypes[2]
  const weekday = new Date(dayStart(day) * minuteMs).getUTCDay()
  return weekday === 0 || weekday === 6 ? dayTypes[1] : dayTypes[0]
}
export const siteById = (id: string) =>
  parkingSites.find((site) => site.id === id)
export function durationIndex(minutes: number) {
  const bucket = [15, 60, 240, 480].findIndex((limit) => minutes < limit)
  return bucket < 0 ? durationGroups.length : bucket + 1
}
export const durationHours = (trip: Trip, end: number) =>
  Math.max(0, Math.min(trip.exited ?? end, end) - trip.entered) / 60
export const statusAt = (trip: Trip, end: number) =>
  trip.exited !== null && trip.exited < end ? "Đã ra" : "Đang trong bãi"
export const deficit = (trip: Trip) =>
  trip.due === null || trip.paid === null
    ? 0
    : Math.max(0, trip.due - trip.voucher - trip.paid)
export const searchTrips = (trip: Trip, text: string) => {
  const query = normalize(text)
  return (
    query.length < 3 ||
    [trip.id, trip.plate, trip.ticket].some((value) =>
      normalize(value).includes(query),
    )
  )
}
export const parkedAt = (trip: Trip, minute: number) =>
  trip.entered < minute && (trip.exited === null || trip.exited >= minute)
export const touches = (trip: Trip, start: number, end: number) =>
  trip.entered < end && (trip.exited === null || trip.exited >= start)
export const inWindow = (value: number | null, start: number, end: number) =>
  value !== null && value >= start && value < end
export const nightsFor = (trip: Trip, days: string[]) =>
  days.filter(
    (day) =>
      overlap(
        trip.entered,
        trip.exited ?? Infinity,
        dayStart(day) + 120,
        dayStart(day) + 300,
      ) > 0,
  )
export const unusual = (trip: Trip, settings: ParkingSettings, day: string) => {
  const end = dayStart(day) + dayMinutes
  return (
    trip.group === "Vãng lai" &&
    parkedAt(trip, end) &&
    end - 1 / 60 - trip.entered >
      thresholdAt(settings, siteById(trip.site)?.estate || "", day) * 60
  )
}

export interface Counts {
  opening: number
  incoming: number
  outgoing: number
  closing: number
}
export interface Interval extends Counts {
  id: string
  label: string
  day: string
  start: number
  end: number
  design: number | null
  actual: number | null
  exceeded: boolean
  incomplete?: boolean
}
export function countTrips(trips: Trip[], start: number, end: number): Counts {
  let opening = 0,
    incoming = 0,
    outgoing = 0,
    closing = 0
  for (const trip of trips) {
    if (parkedAt(trip, start)) opening++
    if (inWindow(trip.entered, start, end)) incoming++
    if (inWindow(trip.exited, start, end)) outgoing++
    if (parkedAt(trip, end)) closing++
  }
  return { opening, incoming, outgoing, closing }
}
const sum = <T>(rows: T[], value: (row: T) => number) =>
  rows.reduce((total, row) => total + value(row), 0)
const sumDeclared = <T>(rows: T[], value: (row: T) => number | null) =>
  rows.length && rows.every((row) => value(row) !== null)
    ? sum(rows, (row) => value(row) ?? 0)
    : null
const sumAvailable = <T>(rows: T[], value: (row: T) => number | null) =>
  rows.some((row) => value(row) !== null)
    ? sum(rows, (row) => value(row) ?? 0)
    : null
export const ratio = (value: number | null, base: number | null) =>
  value === null || !base ? null : value / base

function openWindows(day: string, schedule: Schedule, previous?: Schedule) {
  const start = dayStart(day)
  const from = timeMinutes(schedule.from)
  const duration = timeSpan(schedule.from, schedule.to)
  if (duration === dayMinutes) return [[start, start + dayMinutes]]
  const carry = previous
    ? Math.max(
        0,
        timeMinutes(previous.from) +
          timeSpan(previous.from, previous.to) -
          dayMinutes,
      )
    : 0
  return [
    [start, start + Math.min(carry, from)],
    [start + from, start + Math.min(dayMinutes, from + duration)],
  ]
}
export interface SiteDay extends Counts {
  site: string
  day: string
  hours: Interval[]
  capacity?: Capacity
  maxHours: number | null
  plannedMax: number | null
  parkedHours: number | null
  plannedHours: number | null
  planActual: number | null
  windows: number[][]
  peak: Interval
  peakIn: Interval
  peakOut: Interval
  exceeded: number
}
export const peakOf = <T>(rows: T[], getValue: (row: T) => number) =>
  rows.reduce<T | undefined>(
    (peak, row) => (!peak || getValue(row) > getValue(peak) ? row : peak),
    undefined,
  )
function siteDay(
  trips: Trip[],
  settings: ParkingSettings,
  site: string,
  vehicle: Vehicle,
  day: string,
): SiteDay {
  const start = dayStart(day),
    end = start + dayMinutes
  const relevant = trips.filter((trip) => touches(trip, start, end))
  const capacity = effectiveRecord(
    settings.capacities,
    `${site}/${vehicle}`,
    day,
  )
  const schedule = effectiveRecord(settings.schedules, site, day)
  const previous = effectiveRecord(settings.schedules, site, shiftDay(day, -1))
  const plan = effectiveRecord(
    settings.plans,
    `${site}/${vehicle}/${day.slice(0, 7)}`,
    day,
  )
  const monthDays = new Date(
    Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0),
  ).getUTCDate()
  const windows = schedule ? openWindows(day, schedule, previous) : []
  const operatingHours = schedule
    ? timeSpan(schedule.from, schedule.to) / 60
    : null
  const parkedHours = schedule
    ? sum(
        relevant,
        (trip) =>
          sum(windows, ([from, to]) =>
            overlap(trip.entered, trip.exited ?? end, from, to),
          ) / 60,
      )
    : null
  const hours = Array.from({ length: 24 }, (_, hour): Interval => {
    const from = start + hour * 60
    const until = from + 60
    const counts = countTrips(relevant, from, until)
    return {
      ...counts,
      id: `${site}/${day}/${hour}`,
      label: `${clockTime(hour * 60)} – ${
        hour === 23 ? "24:00" : clockTime((hour + 1) * 60)
      }`,
      day,
      start: from,
      end: until,
      design: capacity?.design ?? null,
      actual: capacity?.actual ?? null,
      exceeded: capacity !== undefined && counts.closing > capacity.design,
    }
  })
  return {
    site,
    day,
    hours,
    capacity,
    windows,
    parkedHours,
    maxHours:
      capacity && operatingHours !== null
        ? capacity.actual * operatingHours
        : null,
    plannedMax:
      capacity && operatingHours !== null
        ? capacity.planned * operatingHours
        : null,
    plannedHours: plan ? plan.hours / monthDays : null,
    planActual: plan ? parkedHours : null,
    ...countTrips(relevant, start, end),
    peak: peakOf(hours, (hour) => hour.closing)!,
    peakIn: peakOf(hours, (hour) => hour.incoming)!,
    peakOut: peakOf(hours, (hour) => hour.outgoing)!,
    exceeded: hours.filter((hour) => hour.exceeded).length,
  }
}
export function shiftIntervals(
  trips: Trip[],
  settings: ParkingSettings,
  site: string,
  vehicle: Vehicle,
  day: string,
  cutoff: string,
) {
  const schedule = effectiveRecord(settings.schedules, site, day)
  const capacity = effectiveRecord(
    settings.capacities,
    `${site}/${vehicle}`,
    day,
  )
  const first = schedule?.shifts[0]
  if (!first) return []
  let start = dayStart(day) + timeMinutes(first.from)
  return schedule.shifts.map((shift, index): Interval => {
    const end = start + timeSpan(shift.from, shift.to)
    const incomplete = end > dayStart(cutoff) + dayMinutes
    const counts = incomplete
      ? { opening: 0, incoming: 0, outgoing: 0, closing: 0 }
      : countTrips(trips, start, end)
    const result = {
      ...counts,
      id: `${site}/${day}/shift${index}`,
      label: `${shift.name} · ${shift.from} – ${shift.to}`,
      day,
      start,
      end,
      incomplete,
      design: capacity?.design ?? null,
      actual: capacity?.actual ?? null,
      exceeded:
        !incomplete &&
        capacity !== undefined &&
        counts.closing > capacity.design,
    }
    start = end
    return result
  })
}
export function aggregateDays(rows: SiteDay[]) {
  const days = [...new Set(rows.map((row) => row.day))].sort()
  const last = rows.filter((row) => row.day === days[days.length - 1])
  const first = rows.filter((row) => row.day === days[0])
  const hourly = new Map<number, number>()
  for (const row of rows)
    for (const hour of row.hours)
      hourly.set(hour.end, (hourly.get(hour.end) ?? 0) + hour.closing)
  const peak = peakOf(
    [...hourly].sort(([a], [b]) => a - b),
    ([, count]) => count,
  )
  const parkedHours = sumDeclared(rows, (row) => row.parkedHours)
  const maxHours = sumDeclared(rows, (row) => row.maxHours)
  const plannedHours = sumAvailable(rows, (row) => row.plannedHours)
  const planRows = rows.filter((row) => row.plannedHours !== null)
  const planActual = sumDeclared(planRows, (row) => row.planActual)
  return {
    opening: sum(first, (row) => row.opening),
    incoming: sum(rows, (row) => row.incoming),
    outgoing: sum(rows, (row) => row.outgoing),
    closing: sum(last, (row) => row.closing),
    design: sumDeclared(last, (row) => row.capacity?.design ?? null),
    actual: sumDeclared(last, (row) => row.capacity?.actual ?? null),
    charging: sumDeclared(last, (row) => row.capacity?.charging ?? null),
    planned: sumDeclared(last, (row) => row.capacity?.planned ?? null),
    maxHours,
    parkedHours,
    plannedHours,
    planActual,
    plannedMax: sumDeclared(rows, (row) => row.plannedMax),
    occupancy: ratio(parkedHours, maxHours),
    attainment: ratio(planActual, plannedHours),
    peak: peak?.[1] ?? 0,
    peakAt: peak?.[0],
    exceeded: rows.filter((row) => row.exceeded > 0),
  }
}
export type Aggregate = ReturnType<typeof aggregateDays>
export function durationStats(
  trips: Trip[],
  settings: ParkingSettings,
  filters: ParkingFilters,
  days: string[],
  guest = "",
) {
  const start = dayStart(filters.start),
    end = dayStart(filters.end) + dayMinutes
  const scoped = guest ? trips.filter((trip) => trip.group === guest) : trips
  const departed = scoped.filter(
    (trip) => inWindow(trip.exited, start, end) && trip.exited! >= trip.entered,
  )
  const groups = durationGroups.map((label, index) => ({
    label,
    trips: departed.filter(
      (trip) => durationIndex(trip.exited! - trip.entered) === index + 1,
    ),
  }))
  const nightly = scoped.flatMap((trip) =>
    nightsFor(trip, days).map((day) => ({ trip, day })),
  )
  return {
    groups,
    departed,
    nightly,
    average: ratio(
      sum(departed, (trip) => (trip.exited! - trip.entered) / 60),
      departed.length,
    ),
    remaining: scoped.filter((trip) => parkedAt(trip, end)),
    unusual: scoped.filter((trip) => unusual(trip, settings, filters.end)),
  }
}

export function buildParkingReport(
  trips: Trip[],
  settings: ParkingSettings,
  filters: ParkingFilters,
  access: ParkingAccess,
) {
  const first = filters.start < goLive ? goLive : filters.start
  const days = daysIn(first, filters.end)
  const start = dayStart(first),
    end = dayStart(filters.end) + dayMinutes
  const sites = allowedSites(access).filter(
    (site) =>
      (!filters.estate || filters.estate === site.estate) &&
      (!filters.site || filters.site === site.id),
  )
  const valid = trips.filter(
    (trip) =>
      trip.vehicle === filters.vehicle &&
      (trip.exited === null || trip.exited >= trip.entered),
  )
  const scoped = valid.filter((trip) =>
    sites.some((site) => site.id === trip.site),
  )
  const bySite = sites.flatMap((site) => {
    const trips = scoped.filter(
      (trip) => trip.site === site.id && touches(trip, start, end + dayMinutes),
    )
    const declared = settings.capacities.some(
      (row) =>
        !row.canceled &&
        row.site === site.id &&
        row.vehicle === filters.vehicle &&
        row.effective <= filters.end,
    )
    if (
      !days.length ||
      (!declared && !trips.some((trip) => touches(trip, start, end)))
    )
      return []
    const daily = days.map((day) =>
      siteDay(trips, settings, site.id, filters.vehicle, day),
    )
    return [{ ...site, trips, daily, total: aggregateDays(daily) }]
  })
  const rows = bySite.flatMap((site) => site.daily)
  const daily = days.map((day) => ({
    day,
    type: dayType(day, settings.holidays),
    ...aggregateDays(rows.filter((row) => row.day === day)),
  }))
  const total = aggregateDays(rows)
  const periodTrips = scoped.filter(
    (trip) => days.length && touches(trip, start, end),
  )
  const dayGroups = [...dayTypes, "Cả kỳ"].flatMap((label) => {
    const groupDays = daily.filter(
      (row) => row.type === label || label === "Cả kỳ",
    )
    if (!groupDays.length) return []
    const groupRows = rows.filter((row) =>
      groupDays.some((day) => day.day === row.day),
    )
    return [
      {
        label,
        days: groupDays.map((day) => day.day),
        ...aggregateDays(groupRows),
      },
    ]
  })
  const byEstate = estates.flatMap((estate) => {
    const children = bySite.filter((site) => site.estate === estate.id)
    return children.length
      ? [
          {
            ...estate,
            children,
            total: aggregateDays(children.flatMap((site) => site.daily)),
          },
        ]
      : []
  })
  return { days, daily, total, bySite, byEstate, dayGroups, periodTrips }
}
export type ParkingReportData = ReturnType<typeof buildParkingReport>
export function tripAlerts(
  trip: Trip,
  filters: ParkingFilters,
  settings: ParkingSettings,
) {
  const start = dayStart(filters.start),
    end = dayStart(filters.end) + dayMinutes
  return [
    unusual(trip, settings, filters.end) ? alertTabs[1] : "",
    inWindow(trip.exited, start, end) && deficit(trip) > 0 ? alertTabs[2] : "",
    trip.issue &&
    inWindow(trip.issue.at, start, end) &&
    (!trip.issue.verifiedAt || trip.issue.verifiedAt >= end)
      ? alertTabs[3]
      : "",
  ].filter(Boolean)
}

export type DrillMetric = "incoming" | "outgoing" | "opening" | "closing" | "parked" | "nightly" | "unusual" | "duration" | "issue" | "deficit"
export interface TripDrill {
  metric: DrillMetric
  label: string
  start: number
  end: number
  sites?: string[]
  days?: string[]
  group?: string
  bucket?: number
}
export function drillTrips(
  trips: Trip[],
  drill: TripDrill,
  settings: ParkingSettings,
) {
  return trips.flatMap((trip): { trip: Trip; night?: string }[] => {
    if (drill.sites && !drill.sites.includes(trip.site)) return []
    if (drill.group && trip.group !== drill.group) return []
    const days = drill.days
    const included = (value: number | null) =>
      inWindow(value, drill.start, drill.end) &&
      (!days || days.includes(dayAt(value!)))
    let matches = false
    switch (drill.metric) {
      case "incoming":
        matches = included(trip.entered)
        break
      case "outgoing":
        matches = included(trip.exited)
        break
      case "opening":
        matches = parkedAt(trip, drill.start)
        break
      case "closing":
        matches = parkedAt(trip, drill.end)
        break
      case "parked": {
        const relevantDays =
          days ?? daysIn(dayAt(drill.start), dayAt(drill.end - 1))
        matches = relevantDays.some((day) => {
          const schedule = effectiveRecord(settings.schedules, trip.site, day)
          const previous = effectiveRecord(
            settings.schedules,
            trip.site,
            shiftDay(day, -1),
          )
          return (
            schedule &&
            openWindows(day, schedule, previous).some(
              ([from, to]) =>
                overlap(trip.entered, trip.exited ?? Infinity, from, to) > 0,
            )
          )
        })
        break
      }
      case "nightly":
        return nightsFor(
          trip,
          days ?? daysIn(dayAt(drill.start), dayAt(drill.end - 1)),
        ).map((night) => ({ trip, night }))
      case "unusual":
        matches = unusual(trip, settings, dayAt(drill.end - 1))
        break
      case "duration":
        matches =
          included(trip.exited) &&
          trip.exited! >= trip.entered &&
          (drill.bucket === undefined ||
            durationIndex(trip.exited! - trip.entered) === drill.bucket)
        break
      case "issue":
        matches =
          !!trip.issue &&
          included(trip.issue.at) &&
          (!trip.issue.verifiedAt || trip.issue.verifiedAt >= drill.end)
        break
      case "deficit":
        matches = included(trip.exited) && deficit(trip) > 0
        break
    }
    return matches ? [{ trip }] : []
  })
}
