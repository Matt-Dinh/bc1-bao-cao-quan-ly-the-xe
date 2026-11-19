import {
  alertNames,
  cardAlertIds,
  cards,
  cardTypes,
  customerGroups,
  date,
  defaults,
  estates,
  initialThresholds,
  maxDate,
  normalize,
  today,
  vehicles,
} from "./data"
import type { Card, Filters, Threshold } from "./data"

interface State {
  status: string
  park: string
}
export interface CardEvent {
  cardId: string
  at: string
  kind: "import" | "issue" | "return" | "loss" | "lock"
  before: State | null
  after: State
  park: string
}
export interface MetricResult {
  cards: Card[]
  occurrences: Record<string, number>
  count: number
  events: CardEvent[]
}
export const stockMetricLabels = [
  "Tồn kho đầu kỳ", "Lưu hành đầu kỳ", "Nhập mới", "Cấp ra", "Thu hồi",
  "Mất / hỏng", "Tồn kho cuối kỳ", "Thẻ lưu hành cuối kỳ",
]
export const movementKinds = ["import", "issue", "return", "loss"] as const
export const lookupStatuses = ["Trong kho", "Đang hoạt động", "Lưu hành", "Đang sử dụng", "Khóa", "Hết hạn", "Mất / hỏng"] as const
export const circulationGroupings = ["Loại thẻ", "Loại phương tiện", "Nhóm khách hàng"] as const
export const circulationStatuses = ["Đang sử dụng", "Khóa", "Hết hạn"] as const
export type CirculationGrouping = typeof circulationGroupings[number]
export type CirculationStatus = typeof circulationStatuses[number]
export type ReportLookupSelection =
  | { kind: "metric"; index: number; estate?: string; park?: string }
  | { kind: "circulation"; groupBy?: CirculationGrouping; group?: string; status?: CirculationStatus; estate?: string }
  | { kind: "alert"; id: number }
export type CardLookupFilters = {
  mode: "current" | "snapshot" | "movement"
  keyword: string
  start: string
  end: string
  estate: string
  park: string
  type: string
  vehicle: string
  status: typeof lookupStatuses[number] | ""
  group: string
  alert: string
  movement: typeof movementKinds[number] | ""
}
export const defaultCardLookupFilters: CardLookupFilters = {
  mode: "current",
  keyword: "",
  start: today,
  end: today,
  estate: "",
  park: "",
  type: "",
  vehicle: "",
  status: "",
  group: "",
  alert: "",
  movement: "",
}
export type ReportLookupResult = {
  period: string
  asOf: string
  cards: Card[]
  events: CardEvent[] | null
}
const initialStates = new Map<string, State>()
export const cardEvents: CardEvent[] = []
const allById = new Map(cards.map((c) => [c.id, c]))
const warehouseAt = (park: string): State => ({ status: "Trong kho", park })
function event(
  card: Card,
  day: string,
  kind: CardEvent["kind"],
  before: State | null,
  after: State,
  park = after.park,
) {
  cardEvents.push({
    cardId: card.id,
    at: `${day}T10:00:00`,
    kind,
    before,
    after,
    park,
  })
}

// Build one deterministic, reconciled demo ledger. All report views use this ledger.
for (const estate of estates) {
  const own = cards.filter((c) => c.estate === estate.id)
  const stock = own.filter((c) => c.status === "Trong kho")
  const lost = own.filter((c) => c.status === "Mất / hỏng")
  const newlyIssued: Card[] = []
  let stockIndex = 0
  let lostIndex = 0
  for (const [pi, park] of estate.parks.entries()) {
    const warehouse = warehouseAt(park)
    const issueCount = estate.id === "A" ? [32, 28, 20][pi] : 20
    const returnCount =
      estate.id === "A" ? [6, 5, 4][pi] : estate.id === "B" ? [3, 3, 4][pi] : 5
    const lossCount = estate.id === "B" && pi === 0 ? 0 : 1
    const repeat = estate.id === "A" && pi === 0
    const active = own.filter(
      (c) => c.park === park && c.status !== "Mất / hỏng",
    )
    const issueCards = active.slice(-(issueCount - (repeat ? 1 : 0)))
    const issuedIds = new Set(issueCards.map((c) => c.id))
    for (const card of active) {
      const state = { status: card.status, park }
      initialStates.set(card.id, issuedIds.has(card.id) ? warehouse : state)
    }
    for (const [i, card] of issueCards.entries()) {
      const activeState = { status: card.status, park }
      newlyIssued.push(card)
      event(card, "2026-10-05", "issue", warehouse, activeState, park)
      if (repeat && i === 0) {
        event(card, "2026-10-12", "return", activeState, warehouse, park)
        event(card, "2026-10-18", "issue", warehouse, activeState, park)
      }
    }
    for (let i = 0; i < returnCount - (repeat ? 1 : 0); i++) {
      const card = stock[stockIndex++]
      const state = { status: "Đang hoạt động", park }
      initialStates.set(card.id, state)
      event(card, "2026-10-12", "return", state, warehouse, park)
    }
    for (let i = 0; i < lossCount; i++) {
      const card = lost[lostIndex++]
      const state = { status: "Đang hoạt động", park }
      initialStates.set(card.id, state)
      event(
        card,
        "2026-10-16",
        "loss",
        state,
        { status: "Mất / hỏng", park },
        park,
      )
    }
  }
  for (const [i, card] of stock.slice(stockIndex).entries())
    initialStates.set(card.id, warehouseAt(estate.parks[i % 3]))
  for (const card of lost.slice(lostIndex)) {
    const warehouse = warehouseAt(estate.parks[0])
    initialStates.set(card.id, warehouse)
    event(card, "2026-10-16", "loss", warehouse, {
      status: "Mất / hỏng",
      park: warehouse.park,
    })
  }
  for (const card of newlyIssued.slice(0, 20)) {
    initialStates.delete(card.id)
    event(card, "2026-10-03", "import", null, warehouseAt(card.park))
  }
}
const blocked = allById.get("B-OT-00001")!
initialStates.set(blocked.id, { status: "Đang hoạt động", park: blocked.park })
event(
  blocked,
  "2026-10-12",
  "lock",
  { status: "Đang hoạt động", park: blocked.park },
  { status: "Khóa", park: blocked.park },
  blocked.park,
)
cardEvents.sort((a, b) => a.at.localeCompare(b.at))
const eventsByCard = new Map<string, CardEvent[]>()
for (const entry of cardEvents)
  eventsByCard.set(entry.cardId, [
    ...(eventsByCard.get(entry.cardId) || []),
    entry,
  ])

export function daysBetween(from: string, to: string) {
  return Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000,
  )
}
export function previousDay(day: string) {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86400000)
    .toISOString()
    .slice(0, 10)
}
export function openingSnapshotDay(start: string) {
  return start <= "2026-09-01" ? "2026-09-01" : previousDay(start)
}
export function openingSnapshotLabel(start: string) {
  const day = openingSnapshotDay(start)
  return day === start ? `Số dư đầu ngày ${date(day)}` : `Chốt hết ngày ${date(day)}`
}
export function snapshot(
  day: string,
  thresholds: (estate: string) => Threshold = (id) => initialThresholds[id],
): Card[] {
  if (day < "2026-09-01") return []
  const states = new Map(initialStates)
  for (const entry of cardEvents)
    if (entry.at.slice(0, 10) <= day) states.set(entry.cardId, entry.after)
  return [...states].map(([id, state]) => {
    const source = allById.get(id)!
    const history = (eventsByCard.get(id) || []).filter(
      (e) => e.at.slice(0, 10) <= day,
    )
    const issued =
      history
        .filter((e) => e.kind === "issue")
        .slice(-1)[0]
        ?.at.slice(0, 10) || source.issued
    const lastTrip = state.status !== "Trong kho" && source.lastTrip <= day ? source.lastTrip : ""
    const unused = daysBetween(
      lastTrip && lastTrip > issued ? lastTrip : issued,
      day,
    )
    const card = {
      ...source,
      ...state,
      issued,
      lastTrip,
      unused: Math.max(0, unused),
      alerts: [] as number[],
    }
    const threshold = thresholds(card.estate)
    const remaining = card.expiry ? daysBetween(day, card.expiry) : Infinity
    if (
      card.status === "Đang hoạt động" &&
      remaining >= 0 &&
      remaining <= threshold.expiry
    )
      card.alerts.push(0)
    if (
      source.alerts.includes(2) &&
      day >= "2026-10-10" &&
      card.status === "Đang hoạt động"
    )
      card.alerts.push(2)
    if (
      card.status === "Đang hoạt động" &&
      card.type !== "Vãng lai" &&
      unused >= threshold.unused
    )
      card.alerts.push(3)
    return card
  })
}
type CardScope = Pick<Filters, "estate" | "park" | "type" | "vehicle">
type CardPeriod = CardScope & Pick<Filters, "start" | "end">
const inScope = (card: Card, f: CardScope, park = card.park) =>
  (!f.estate || card.estate === f.estate) &&
  (!f.park || park === f.park) &&
  (!f.type || card.type === f.type) &&
  (!f.vehicle || card.vehicle === f.vehicle)

function movementsInScope(f: CardPeriod, kind: CardLookupFilters["movement"], thresholds?: (estate: string) => Threshold) {
  const latest = new Map(snapshot(f.end, thresholds).map((card) => [card.id, card]))
  const selected = new Map<string, Card>()
  const occurrences: Record<string, number> = {}
  const events: CardEvent[] = []
  for (const entry of cardEvents) {
    const card = latest.get(entry.cardId)
    const day = entry.at.slice(0, 10)
    if (!card || entry.kind === "lock" || (kind && entry.kind !== kind) ||
        day < f.start || day > f.end || !inScope(card, f, entry.park)) continue
    selected.set(card.id, card)
    events.push(entry)
    occurrences[card.id] = (occurrences[card.id] || 0) + 1
  }
  return { cards: [...selected.values()], events, occurrences, count: events.length }
}

export function metricCards(f: Filters, metric: number, thresholds?: (estate: string) => Threshold): MetricResult {
  if (metric >= 2 && metric <= 5) return movementsInScope(f, movementKinds[metric - 2], thresholds)
  const occurrences: Record<string, number> = {}
  const rows = snapshot(metric < 2 ? openingSnapshotDay(f.start) : f.end, thresholds).filter(
    (card) => inScope(card, f) && (metric === 0 || metric === 6
      ? card.status === "Trong kho"
      : isCirculating(card)),
  )
  rows.forEach((card) => { occurrences[card.id] = 1 })
  return { cards: rows, occurrences, count: rows.length, events: [] }
}
export function stockMetrics(f: Filters) {
  const key = [f.start, f.end, f.estate, f.park, f.type, f.vehicle].join("|")
  const cached = metricsCache.get(key)
  if (cached) return cached
  const values = Array.from(
    { length: 8 },
    (_, metric) => metricCards(f, metric).count,
  )
  if (metricsCache.size > 256) metricsCache.clear()
  metricsCache.set(key, values)
  return values
}
const metricsCache = new Map<string, number[]>()

export function circulationGroups(groupBy: CirculationGrouping) {
  if (groupBy === "Loại thẻ") return cardTypes
  if (groupBy === "Loại phương tiện") return vehicles
  return [...customerGroups, "VIP và Vãng lai"]
}
export function inCirculationGroup(card: Card, groupBy: CirculationGrouping, label: string) {
  if (groupBy === "Loại thẻ") return card.type === label
  if (groupBy === "Loại phương tiện") return card.vehicle === label
  if (label === "VIP và Vãng lai") return card.type !== "Thuê bao tháng"
  return card.type === "Thuê bao tháng" && card.group === label
}
export function circulationStatus(card: Card, day: string): CirculationStatus {
  if (card.status === "Khóa") return "Khóa"
  return card.expiry && card.expiry < day ? "Hết hạn" : "Đang sử dụng"
}
const isCirculating = (card: Card) => card.status === "Đang hoạt động" || card.status === "Khóa"

export function managementReport(
  f: Filters,
  thresholds: (estate: string) => Threshold = (id) => initialThresholds[id],
  groupBy: CirculationGrouping = "Loại thẻ",
) {
  const closing = snapshot(f.end, thresholds).filter((card) => inScope(card, f))
  const circulation = closing.filter(isCirculating)
  const categories = circulationGroups(groupBy)
  return {
    metrics: stockMetrics(f),
    closing,
    circulation,
    groups: categories.map((label) => ({
      label,
      cards: circulation.filter((c) => inCirculationGroup(c, groupBy, label)),
    })),
    statuses: circulationStatuses.map((label) => ({
      label,
      cards: circulation.filter((c) => circulationStatus(c, f.end) === label),
    })),
    alerts: cardAlertIds.map((id) => ({
      id,
      label: alertNames[id],
      cards: closing.filter((c) => c.alerts.includes(id)),
    })),
    warned: closing.filter((c) => c.alerts.length > 0).length,
  }
}

function readReportLookupParams(params: URLSearchParams): ReportLookupSelection | null {
  const estate = estates.find((item) => item.id === params.get("lookupEstate"))
  const park = estate?.parks.find((item) => item === params.get("lookupPark"))
  const metric = stockMetricLabels.findIndex((_, i) => String(i) === params.get("metric"))
  if (metric >= 0) return { kind: "metric", index: metric, estate: estate?.id, park }
  if (params.get("circulation") === "1") {
    const groupBy = circulationGroupings.find((item) => item === params.get("groupBy"))
    const group = groupBy ? circulationGroups(groupBy).find((item) => item === params.get("group")) : undefined
    const status = circulationStatuses.find((item) => item === params.get("usage"))
    return { kind: "circulation", estate: estate?.id, groupBy, group, status }
  }
  const alert = cardAlertIds.find((id) => String(id) === params.get("alertGroup"))
  return alert !== undefined ? { kind: "alert", id: alert } : null
}

export function reportLookupFilters(applied: Filters, selection: ReportLookupSelection): CardLookupFilters {
  const filters: CardLookupFilters = {
    ...defaultCardLookupFilters,
    mode: "snapshot",
    start: applied.start,
    end: applied.end,
    estate: selection.kind !== "alert" ? selection.estate || applied.estate : applied.estate,
    park: selection.kind === "metric" ? selection.park || applied.park : applied.park,
    type: applied.type,
    vehicle: applied.vehicle,
  }
  if (selection.kind === "metric") {
    const { index } = selection
    if (index >= 2 && index <= 5) return { ...filters, mode: "movement", movement: movementKinds[index - 2] }
    const day = index < 2 ? openingSnapshotDay(applied.start) : applied.end
    return { ...filters, start: day, end: day,
      status: index === 0 || index === 6 ? "Trong kho" : "Lưu hành" }
  }
  filters.start = filters.end
  if (selection.kind === "alert") return { ...filters, alert: alertNames[selection.id] }
  if (selection.group) {
    if (selection.groupBy === "Loại thẻ") filters.type = selection.group
    if (selection.groupBy === "Loại phương tiện") filters.vehicle = selection.group
    if (selection.groupBy === "Nhóm khách hàng") filters.group = selection.group
  }
  return { ...filters, status: selection.status || "Lưu hành" }
}

export function lookupDateError(filters: CardLookupFilters) {
  if (filters.mode === "current" && filters.start === today && filters.end === today) return ""
  const valid = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day &&
    day >= "2026-09-01" && day <= maxDate
  if (!valid(filters.end) || !valid(filters.start))
    return `Chọn ngày từ 01/09/2026 đến ${date(maxDate)}.`
  if (filters.start > filters.end)
    return "Từ ngày phải trước hoặc bằng Đến ngày."
  return ""
}

const lookupFields = ["mode", "keyword", "start", "end", "estate", "park", "type", "vehicle", "status", "group", "alert", "movement"] as const
const lookupParam = (field: typeof lookupFields[number]) => `lookup${field[0].toUpperCase()}${field.slice(1)}`

export function setCardLookupParams(params: URLSearchParams, filters: CardLookupFilters) {
  for (const field of ["metric", "circulation", "groupBy", "group", "usage", "alertGroup", "lookupSnapshotAt"])
    params.delete(field)
  for (const field of lookupFields) {
    params.delete(lookupParam(field))
    if (filters[field] && filters[field] !== defaultCardLookupFilters[field])
      params.set(lookupParam(field), filters[field])
  }
}

export function readCardLookupParams(params: URLSearchParams, reportFilters: Filters): CardLookupFilters {
  const mode = params.get(lookupParam("mode"))
  if (!mode) {
    const selection = readReportLookupParams(params)
    if (selection) return reportLookupFilters(reportFilters, selection)
  }
  const value = (field: typeof lookupFields[number]) => params.get(lookupParam(field)) || ""
  const option = <T extends string>(choices: readonly T[], field: typeof lookupFields[number]) =>
    choices.find((item) => item === value(field)) || ""
  const estate = option(estates.map((item) => item.id), "estate")
  const parks = estates.filter((item) => !estate || item.id === estate).flatMap((item) => item.parks)
  const filters: CardLookupFilters = {
    mode: mode === "snapshot" || mode === "movement" ? mode : "current",
    keyword: value("keyword").slice(0, 100),
    start: mode === "snapshot" || mode === "movement" ? value("start") || defaults.start : today,
    end: mode === "snapshot" || mode === "movement" ? value("end") || defaults.end : today,
    estate,
    park: option(parks, "park"),
    type: option(cardTypes, "type"),
    vehicle: option(vehicles, "vehicle"),
    status: option(lookupStatuses, "status"),
    group: option(circulationGroups("Nhóm khách hàng"), "group"),
    alert: option(cardAlertIds.map((id) => alertNames[id]), "alert"),
    movement: option(movementKinds, "movement"),
  }
  // Convert older opening-balance links to an explicit single-day period.
  if (filters.mode === "snapshot") {
    if (params.get("lookupSnapshotAt") === "opening")
      filters.start = filters.end = openingSnapshotDay(filters.start)
    else if (filters.end < filters.start && filters.end === openingSnapshotDay(filters.start))
      filters.start = filters.end
  }
  return lookupDateError(filters) ? { ...filters, start: defaults.start, end: defaults.end } : filters
}

export function lookupSnapshotDay(filters: CardLookupFilters) {
  return filters.mode === "current" ? today : filters.end
}

export function matchesCardKeyword(card: Card, query: string) {
  return !query || [card.id, card.owner, card.plate, card.subscription, card.batch].some((value) =>
    normalize(value).includes(query),
  )
}

export function lookupCards(
  filters: CardLookupFilters,
  thresholds?: (estate: string) => Threshold,
  currentCards: Card[] = [],
): ReportLookupResult {
  const current = filters.mode === "current"
  const asOf = current ? today : lookupSnapshotDay(filters)
  const keyword = normalize(filters.keyword.trim())
  const { status, alert, group } = filters
  const alertId = cardAlertIds.find((id) => alertNames[id] === alert)
  const matchesStatus = (card: Card) => {
    if (!status) return true
    if (status === "Lưu hành") return isCirculating(card)
    if (status === "Hết hạn" || status === "Đang sử dụng")
      return isCirculating(card) && circulationStatus(card, asOf) === status
    return card.status === status
  }
  const matchesCard = (card: Card) => matchesStatus(card) && matchesCardKeyword(card, keyword) &&
    (!group || inCirculationGroup(card, "Nhóm khách hàng", group)) &&
    (!alert || (alertId !== undefined && card.alerts.includes(alertId)))
  if (filters.mode === "movement") {
    const { cards, events } = movementsInScope(filters, filters.movement, thresholds)
    const matches = cards.filter(matchesCard)
    const ids = new Set(matches.map((card) => card.id))
    return {
      asOf,
      period: `Từ ${date(filters.start)} đến hết ${date(filters.end)}`,
      cards: matches,
      events: events.filter((event) => ids.has(event.cardId)),
    }
  }
  return {
    asOf,
    period: current ? "Hiện tại" : `Kỳ ${date(filters.start)} – ${date(filters.end)} · Trạng thái hết ngày ${date(asOf)}`,
    events: null,
    cards: (current ? currentCards : snapshot(asOf, thresholds)).filter((card) =>
      inScope(card, filters) && matchesCard(card),
    ),
  }
}

export function recentTrips(card: Card) {
  if (!card.lastTrip) return []
  return Array.from({ length: 5 }, (_, i) => {
    const day = new Date(
      Date.parse(`${card.lastTrip}T00:00:00Z`) - Math.floor(i / 2) * 86400000,
    )
      .toISOString()
      .slice(0, 10)
    return {
      day,
      time: i % 2 ? "08:15" : "17:42",
    }
  }).filter((trip) => trip.day >= card.issued)
}
export function cardHistory(card: Card, day: string) {
  const entries = (eventsByCard.get(card.id) || [])
    .filter((e) => e.at.slice(0, 10) <= day)
    .map((e) => ({
      name: {
        import: "Nhập kho theo lô",
        issue: "Kích hoạt và cấp thẻ",
        return: "Thu hồi thẻ",
        loss: "Ghi nhận mất / hỏng",
        lock: "Khóa thẻ",
      }[e.kind],
      at: e.at,
      user: "Admin Local",
      reason:
        e.kind === "lock"
          ? "Khách hàng báo mất thẻ, tạm khóa để xác minh."
          : e.kind === "import"
            ? `Nhập lô ${card.batch}.`
            : e.kind === "loss"
              ? `Biên bản BB-${card.id}.`
              : `${e.before?.status || "Chưa nhập kho"} → ${e.after.status}${
                  e.park ? ` · ${e.park}` : ""
                }.`,
      canceled: false,
    }))
  if (initialStates.has(card.id))
    entries.push({
      name: "Ghi nhận số dư đầu",
      at: "2026-09-01T07:45:00",
      user: "Admin Local",
      reason: `Trạng thái kiểm kê: ${initialStates.get(card.id)!.status}.`,
      canceled: false,
    })
  if (card.id === "A-OT-00001" && day >= "2026-10-10")
    entries.push({
      name: "Thu hồi thẻ",
      at: "2026-10-10T09:15:00",
      user: "Trần Thu Hà",
      reason: "Hủy do nhập sai thông tin thẻ; không tính vào báo cáo.",
      canceled: true,
    })
  return entries.sort((a, b) => b.at.localeCompare(a.at))
}
export function lossBreakdown(f: Filters) {
  const values = {
    warehouseLost: 0,
    warehouseDamaged: 0,
    circulatingLost: 0,
    circulatingDamaged: 0,
  }
  for (const entry of cardEvents) {
    const card = allById.get(entry.cardId)!
    if (
      entry.kind !== "loss" ||
      entry.at.slice(0, 10) < f.start ||
      entry.at.slice(0, 10) > f.end ||
      !inScope(card, f, entry.park)
    )
      continue
    const damaged = Number(card.id.slice(-1)) % 2 === 0
    const key =
      entry.before?.status === "Trong kho"
        ? damaged
          ? "warehouseDamaged"
          : "warehouseLost"
        : damaged
          ? "circulatingDamaged"
          : "circulatingLost"
    values[key]++
  }
  return values
}
