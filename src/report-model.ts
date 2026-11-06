import {
  alertNames,
  cards,
  cardTypes,
  customerGroups,
  estates,
  initialThresholds,
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
const blocked = cards.find((c) => c.estate === "B" && c.alerts.includes(1))!
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
    const lastTrip =
      state.status === "Trong kho"
        ? ""
        : source.alerts.includes(1)
          ? day >= "2026-10-12"
            ? "2026-10-12"
            : ""
          : source.lastTrip <= day
            ? source.lastTrip
            : ""
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
    if (source.alerts.includes(1) && day >= "2026-10-12") card.alerts.push(1)
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
const inScope = (card: Card, f: Filters, park = card.park) =>
  (!f.estate || card.estate === f.estate) &&
  (!f.park || park === f.park) &&
  (!f.type || card.type === f.type) &&
  (!f.vehicle || card.vehicle === f.vehicle)

export function metricCards(f: Filters, metric: number): MetricResult {
  const occurrences: Record<string, number> = {}
  let rows: Card[]
  if ([0, 1, 6, 7].includes(metric)) {
    rows = snapshot(
      metric < 2
        ? f.start <= "2026-09-01"
          ? "2026-09-01"
          : previousDay(f.start)
        : f.end,
    ).filter(
      (card) =>
        inScope(card, f) &&
        ([0, 6].includes(metric)
          ? card.status === "Trong kho"
          : ["Đang hoạt động", "Khóa"].includes(card.status)),
    )
    rows.forEach((c) => {
      occurrences[c.id] = 1
    })
  } else {
    const kind = ["", "", "import", "issue", "return", "loss"][metric]
    const latest = new Map(snapshot(f.end).map((c) => [c.id, c]))
    const selected = new Map<string, Card>()
    for (const entry of cardEvents) {
      const card = latest.get(entry.cardId)
      if (
        !card ||
        entry.kind !== kind ||
        entry.at.slice(0, 10) < f.start ||
        entry.at.slice(0, 10) > f.end ||
        !inScope(card, f, entry.park)
      )
        continue
      selected.set(card.id, card)
      occurrences[card.id] = (occurrences[card.id] || 0) + 1
    }
    rows = [...selected.values()]
  }
  return {
    cards: rows,
    occurrences,
    count: Object.values(occurrences).reduce((sum, n) => sum + n, 0),
  }
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

export function managementReport(
  f: Filters,
  thresholds: (estate: string) => Threshold = (id) => initialThresholds[id],
  groupBy = "Loại thẻ",
) {
  const closing = snapshot(f.end, thresholds).filter((card) => inScope(card, f))
  const circulation = closing.filter((c) =>
    ["Đang hoạt động", "Khóa"].includes(c.status),
  )
  const categories =
    groupBy === "Loại thẻ"
      ? cardTypes
      : groupBy === "Loại phương tiện"
        ? vehicles
        : [...customerGroups, "VIP và Vãng lai"]
  return {
    metrics: stockMetrics(f),
    closing,
    circulation,
    groups: categories.map((label) => ({
      label,
      cards: circulation.filter((c) =>
        groupBy === "Loại thẻ"
          ? c.type === label
          : groupBy === "Loại phương tiện"
            ? c.vehicle === label
            : label === "VIP và Vãng lai"
              ? c.type !== "Thuê bao tháng"
              : c.type === "Thuê bao tháng" && c.group === label,
      ),
    })),
    statuses: [
      {
        label: "Đang sử dụng",
        cards: circulation.filter(
          (c) =>
            c.status === "Đang hoạt động" && (!c.expiry || c.expiry >= f.end),
        ),
      },
      { label: "Khóa", cards: circulation.filter((c) => c.status === "Khóa") },
      {
        label: "Hết hạn",
        cards: circulation.filter(
          (c) => c.status === "Đang hoạt động" && c.expiry && c.expiry < f.end,
        ),
      },
    ],
    alerts: alertNames.map((label, i) => ({
      label,
      cards: closing.filter((c) => c.alerts.includes(i)),
    })),
    warned: closing.filter((c) => c.alerts.length > 0).length,
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
      time:
        card.alerts.includes(1) && i === 0
          ? "10:30"
          : i % 2
            ? "08:15"
            : "17:42",
      violation: card.alerts.includes(1) && i === 0,
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
