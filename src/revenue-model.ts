import { estates, normalize } from "./data"
import { allowedSites, dayAt, dayMinutes, daysIn, dayStart, effectiveRecord, isDay, minuteIso, shiftDay, siteById, timeMinutes, timeSpan, vnNow } from "./parking-model"
import type { ParkingAccess, ParkingSettings, Trip, Vehicle } from "./parking-model"
import type { OperationState } from "./operations-model"
import { applyVoucherApplications, initialVoucherWorkspace, normalizeVoucherWorkspace } from "./revenue-vouchers"
import type { VoucherUnit, VoucherWorkspace } from "./revenue-vouchers"
import { withRevenueDemo } from "./revenue-demo"
import { revenueMatches, revenueIntersects } from "./revenue-filter-values"

export const revenueMenus = [
  { id: "revenue-report", title: "Báo cáo doanh thu", group: "Báo cáo" },
  { id: "revenue-lookup", title: "Đối soát doanh thu", group: "Quản lý doanh thu" },
  { id: "revenue-close", title: "Doanh thu tổng hợp", group: "Quản lý doanh thu" },
  { id: "revenue-debt", title: "Công nợ voucher", group: "Voucher" },
  { id: "revenue-paper", title: "Thu tiền tại bãi", group: "Chứng từ và lịch sử" },
  { id: "revenue-receipt", title: "Phiếu thu cấp thẻ", group: "Chứng từ và lịch sử" },
  { id: "revenue-voucher", title: "Voucher", group: "Voucher" },
  { id: "revenue-policies", title: "Chính sách miễn / giảm", group: "Cấu hình" },
  { id: "revenue-settings", title: "Cấu hình doanh thu", group: "Cấu hình" },
] as const
export type RevenueScreen = typeof revenueMenus[number]["id"]
export const isRevenueScreen = (id: string | null): id is RevenueScreen => revenueMenus.some((menu) => menu.id === id)
export function revenueAccess(access: ParkingAccess, screen: RevenueScreen) {
  switch (access.role) {
    case "admin": return true
    case "reviewer": return screen === "revenue-lookup"
    case "security": return ["revenue-report", "revenue-lookup", "revenue-close", "revenue-paper"].includes(screen)
    case "customer": return ["revenue-lookup", "revenue-receipt"].includes(screen)
    case "manager": return !["revenue-policies", "revenue-receipt"].includes(screen)
    case "finance": return !["revenue-paper", "revenue-receipt"].includes(screen)
    case "it": return ["revenue-settings", "revenue-report", "revenue-lookup"].includes(screen)
    default: return ["revenue-report", "revenue-lookup", "revenue-policies", "revenue-close", "revenue-debt"].includes(screen)
  }
}
export const revenueWrite = (access: ParkingAccess, action: "shift" | "period" | "reopen" | "adjust" | "payment" | "paper" | "receipt" | "policy" | "settings" | "trip" | "voucher") => {
  const roles: Record<typeof action, string[]> = {
    shift: ["security"], period: ["finance"], reopen: ["manager"], adjust: ["finance", "manager"],
    payment: ["manager"], paper: ["security"], receipt: ["customer"], policy: ["operations"],
    settings: ["finance", "it"], trip: ["customer"], voucher: ["manager"],
  }
  return access.role === "admin" || roles[action].includes(access.role)
}
export const methods = ["Tiền mặt", "QR", "Ví", "VinClub"] as const
export type Method = typeof methods[number]
export const normalizeMethod = (method: string): Method =>
  method === "Chuyển khoản" ? "QR" : methods.includes(method as Method) ? method as Method : "Tiền mặt"
export const sources = {
  VL: "Tại làn", APP: "SOS App (khi mất điện)", VG: "Vé giấy (SOS App)", MT: "Mất / hỏng thẻ, vé",
  CT: "Cấp thẻ thuê bao", VA: "Công nợ voucher", FREE: "Miễn phí toàn bộ", SUB: "Lượt thuê bao",
} as const
export type RevenueSource = keyof typeof sources
export const lossReasons = ["Mở barrier thủ công", "Lỗi thanh toán", "Thu thiếu", "Chờ xác nhận thanh toán", "Không xác định"] as const
export const unitTypes = ["Gian hàng", "Khối văn phòng", "Đối tác"] as const
export const subscriptionGroups = ["Cư dân", "Gian hàng", "Khối văn phòng", "Đơn vị cung cấp dịch vụ", "CBNV BQL", "Xe kích cầu", "Nội bộ", "Chưa phân nhóm"]
export const policyTypes = ["Miễn toàn bộ", "Miễn số giờ đầu", "Giảm theo %", "Giảm số tiền"] as const
export const demoUnits = estates.flatMap((estate) => unitTypes.map((type, index) => ({
  id: `${estate.id}-DV${index + 1}`, estate: estate.id, type,
  name: `${type} ${String.fromCharCode(65 + index)} · ${estate.short}`,
  contract: `HD-${estate.id}-00${index + 1}`,
})))
export type Policy = { code: string; name: string; kind: string; value: number; order: number; from: string; until: string; sites: string[]; vehicle: string; payer: string; note: string; active: boolean }
export type Config = { estate: string; from: string; hour: string; vat: number; vatFrom: string; overdue: number; mall: string; company: string; branch: string; customer: string }
export type Transaction = { id: string; at: number; method: Method; amount: number; status: "Thành công" | "Chờ xác nhận" | "Thất bại" | "Đã hoàn"; original?: string }
export type Discount = { code: string; amount: number; review?: boolean }
export type Charge = {
  id: string; site: string; vehicle: Vehicle; at: number; day?: string; shift?: string; source: RevenueSource;
  count: number; price: number; discounts: Discount[]; payments: Transaction[]; voucher?: { code: string; unit: string; amount: number; negative: boolean; recipient?: VoucherUnit };
  reason?: typeof lossReasons[number]; trip?: Trip; description?: string; missing?: boolean
}
export type LedgerRow = Charge & {
  estate: string; revenueDay: string; shiftId: string; shiftName: string; gross: number; reduction: number;
  revenue: number; net: number; vat: number; paid: number; collected: number; debt: number; lost: number; excess: number;
  moneyByMethod: number[];
}
export type PaperRow = { site: string; day: string; shift: string; vehicle: Vehicle; from: number; to: number; amount: number; method: Method }
export type PaperBatch = { id: string; at: number; actor: string; rows: PaperRow[]; canceled?: string }
export type Receipt = { id: string; at: number; site: string; vehicle: Vehicle; customer: string; contract?: string; plate: string; card: string; previous: string; kind: string; reason: string; amount: number; method: Method; note: string; canceled?: string }
export type Payment = { id: string; unit: string; amount: number; day: string; document: string; month: string; note: string; actor: string; at: number; canceled?: string }
export type Voucher = { code: string; unit: string; type: string; amount: number; expiry: string; active: boolean }
export type Closing = { at: number; actor: string; note: string; frozen: Record<string, LedgerRow | null> }
export type RevenueChange = { id: string; recorded: string; origin: string; estate: string; reference: string; reason: string; actor: string; delta: Totals; site?: string }
export type RevenueAudit = { at: number; actor: string; action: string; scope: string; detail: string }
export type TripUpdate = { trip: Trip; original?: Trip; reason: string; at: number }
export type RevenueState = {
  configs: Config[]; policies: Policy[]; papers: PaperBatch[]; receipts: Receipt[]; payments: Payment[];
  vouchers: Voucher[]; closes: Record<string, Closing>; periods: Record<string, Closing>;
  changes: RevenueChange[]; audit: RevenueAudit[]; tripUpdates: TripUpdate[];
  voucherWorkspace?: VoucherWorkspace;
  demoVersion?: number; demoAnchor?: string; demoCharges?: Charge[];
}
export const revenueVoucherWorkspace = (state: RevenueState) => normalizeVoucherWorkspace(state, demoUnits)
export const revenueUnits = (state: RevenueState) => state.voucherWorkspace?.units ?? demoUnits.map((unit) => ({ ...unit, active: true }))
const fallbackConfig = { from: "2026-01-01", hour: "07:00", vat: 10, vatFrom: "2026-01-01", overdue: 30, mall: "", company: "", branch: "", customer: "" }
export const configAt = (state: RevenueState, estate: string, day: string) => {
  const versions = state.configs.filter((row) => row.estate === estate)
  const current = versions.filter((row) => row.from <= day).sort((a, b) => b.from.localeCompare(a.from))[0]
  const vat = versions.filter((row) => row.vatFrom <= day).sort((a, b) => b.vatFrom.localeCompare(a.vatFrom))[0]
  const latest = versions[0]
  return { ...fallbackConfig, ...current, estate, vat: vat?.vat ?? fallbackConfig.vat,
    overdue: latest?.overdue ?? fallbackConfig.overdue, mall: latest?.mall ?? "", company: latest?.company ?? "",
    branch: latest?.branch ?? "", customer: latest?.customer ?? "" }
}
export const monthEnd = (month: string) => dayAt(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0) / 60000)
export function revenueDay(at: number, estate: string, state: RevenueState) {
  const day = dayAt(at)
  return at - dayStart(day) < timeMinutes(configAt(state, estate, day).hour) ? shiftDay(day, -1) : day
}
export function revenueCutoff(state: RevenueState, estate = "", now = vnNow()) {
  const active = estates.filter((item) => revenueMatches(item.id, estate))
  return active.map((item) => shiftDay(revenueDay(now - 30, item.id, state), -1)).sort()[0] ?? shiftDay(dayAt(now), -1)
}
export type RevenueFilter = { estate: string; site: string; vehicle: string; start: string; end: string }
export function revenuePeriodError(filters: RevenueFilter, cutoff: string) {
  if (!isDay(filters.start) || !isDay(filters.end)) return "Vui lòng chọn đầy đủ ngày doanh thu."
  if (filters.start > filters.end) return "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc."
  if (filters.end > cutoff) return "Ngày kết thúc vượt quá ngày đã có số liệu."
  if (dayStart(filters.end) - dayStart(filters.start) >= 31 * dayMinutes) return "Khoảng thời gian không được vượt quá 31 ngày."
  return ""
}
export function revenueShifts(site: string, day: string, settings: ParkingSettings, state: RevenueState) {
  const estate = siteById(site)?.estate ?? ""
  const start = dayStart(day) + timeMinutes(configAt(state, estate, day).hour)
  const end = dayStart(shiftDay(day, 1)) + timeMinutes(configAt(state, estate, shiftDay(day, 1)).hour)
  const schedule = effectiveRecord(settings.schedules, site, day)
  const make = (name: string, from: number, until: number) => ({
    id: `${site}/${day}/${name}`, name, site, day, estate, from, until, parts: [{ from, until }],
  })
  if (!schedule?.shifts.length) return [make("Cả ngày", start, end)]
  const intervals = [-1, 0, 1].flatMap((offset) => schedule.shifts.map((shift) => {
    const from = dayStart(day) + offset * dayMinutes + timeMinutes(shift.from)
    return { name: shift.name, from: Math.max(from, start), until: Math.min(from + timeSpan(shift.from, shift.to), end) }
  })).filter((shift) => shift.from < shift.until)
  const names = [...new Set(intervals.sort((a, b) => a.from - b.from).map((shift) => shift.name))]
  return names.map((name) => {
    const parts = intervals.filter((shift) => shift.name === name)
    return { ...make(name, parts[0].from, parts[parts.length - 1].until), parts }
  })
}
export type RevenueShift = ReturnType<typeof revenueShifts>[number]
export function moneyLayers(charge: Pick<Charge, "price" | "discounts" | "payments" | "voucher">, rate: number) {
  const gross = Math.max(0, charge.price)
  const reduction = Math.min(gross, charge.discounts.reduce((total, item) => total + item.amount, 0))
  const revenue = gross - reduction
  const net = Math.round(revenue / (1 + rate / 100))
  const moneyByMethod = methods.map((method) => charge.payments.reduce((sum, payment) =>
    sum + (normalizeMethod(payment.method) === method && (payment.status === "Thành công" || (payment.status === "Đã hoàn" && payment.amount < 0)) ? payment.amount : 0), 0))
  const collected = moneyByMethod.reduce((total, value) => total + value, 0)
  const debt = Math.min(revenue, charge.voucher?.negative ? revenue : charge.voucher?.amount ?? 0)
  const difference = revenue - collected - debt
  const lost = Math.max(0, difference), excess = Math.max(0, -difference)
  return { gross, reduction, revenue, net, vat: revenue - net, paid: collected - excess, collected, debt, lost, excess, moneyByMethod }
}
export const amountKeys = ["gross", "reduction", "revenue", "net", "vat", "paid", "collected", "debt", "lost", "excess"] as const
export type AmountKey = typeof amountKeys[number]
export const amountLabels: Record<AmountKey, string> = {
  gross: "Giá niêm yết", reduction: "Miễn / giảm", revenue: "Doanh thu", net: "Chưa VAT", vat: "VAT",
  paid: "Đã thu", collected: "Tiền thực nhận", debt: "Công nợ", lost: "Thất thu", excess: "Thu thừa",
}
export type Totals = ReturnType<typeof moneyLayers> & { count: number }
export function totals(rows: LedgerRow[], includeExcluded = false): Totals {
  const result = { ...moneyLayers({ price: 0, discounts: [], payments: [] }, 0), count: 0 }
  for (const row of rows) {
    if (!includeExcluded && (row.source === "FREE" || row.source === "SUB")) continue
    result.count += row.count
    for (const key of amountKeys) result[key] += row[key]
    row.moneyByMethod.forEach((value, index) => { result.moneyByMethod[index] += value })
  }
  return result
}
export function deltaFor(before?: LedgerRow, after?: LedgerRow): Totals {
  const old = totals(before ? [before] : [])
  const next = totals(after ? [after] : [])
  for (const key of amountKeys) next[key] -= old[key]
  next.count -= old.count
  next.moneyByMethod = next.moneyByMethod.map((amount, index) => amount - old.moneyByMethod[index])
  return next
}
export const defaultSapConfigs: Record<string, Pick<Config, "mall" | "company" | "branch" | "customer">> = {
  A: { mall: "421020", company: "1142", branch: "B000", customer: "0000300000092" },
  B: { mall: "421021", company: "1142", branch: "B000", customer: "0000300001279" },
  C: { mall: "421004", company: "1142", branch: "B000", customer: "0000300000003" },
}
export function initialRevenueState(): RevenueState {
  return {
    configs: estates.map((estate) => ({
      estate: estate.id, ...fallbackConfig,
      ...(defaultSapConfigs[estate.id] ?? { mall: "", company: "", branch: "", customer: "" }),
    })),
    policies: [
      ["CS-01", "VinFast miễn 5 giờ đầu", policyTypes[1], 5],
      ["CS-02", "Giảm giá khối văn phòng", policyTypes[2], 20],
      ["CS-03", "Khách VIP miễn phí", policyTypes[0], 0],
      ["CS-04", "Mã giảm giá VCR", policyTypes[3], 5000],
    ].map(([code, name, kind, value], index) => ({
      code: String(code), name: String(name), kind: String(kind), value: Number(value), order: index + 1,
      from: "2026-09-01", until: "", sites: [], vehicle: "", payer: "VCR", note: "", active: true,
    })),
    papers: [], receipts: [], payments: [], vouchers: [], closes: {}, periods: {}, changes: [], audit: [], tripUpdates: [], voucherWorkspace: initialVoucherWorkspace(demoUnits),
  }
}
export const revenueStorageKey = "vparking:revenue:v1"
export function readRevenueState() {
  try {
    const state = JSON.parse(localStorage.getItem(revenueStorageKey) || "null") as RevenueState | null ?? initialRevenueState()
    const normalized = { ...state, voucherWorkspace: revenueVoucherWorkspace(state) }
    const ready = withRevenueDemo(normalized)
    if (ready !== normalized) { try { localStorage.setItem(revenueStorageKey, JSON.stringify(ready)) } catch { /* Keep the demonstration usable when storage is full. */ } }
    return ready
  }
  catch { return initialRevenueState() }
}
export const estateName = (id: string) => estates.find((estate) => estate.id === id)?.name ?? "—"
export const chargeMatches = (row: LedgerRow, text: string) => {
  const query = normalize(text)
  return !query || [row.id, row.trip?.id, row.trip?.plate, row.trip?.ticket, row.voucher?.code, ...row.payments.map((p) => p.id)]
    .some((value) => value && normalize(value).includes(query))
}
export const scopeRows = (rows: LedgerRow[], filter: RevenueFilter, access: ParkingAccess, byVehicle = true) => {
  const sites = new Set(allowedSites(access).map((site) => site.id))
  return rows.filter((row) => sites.has(row.site) && revenueMatches(row.site, filter.site) &&
    revenueMatches(row.estate, filter.estate) && (!byVehicle || revenueMatches(row.vehicle, filter.vehicle)) &&
    row.revenueDay >= filter.start && row.revenueDay <= filter.end)
}
const demoTransaction = (id: string, amount: number, at: number, method: Method): Transaction =>
  ({ id, at, method, amount, status: "Thành công" })
export function chargeForTrip(trip: Trip): Charge | null {
  if (trip.exited === null || trip.exited < trip.entered) return null
  if (trip.supplementalBilling) {
    const billing = trip.supplementalBilling
    return { id: trip.id, site: trip.site, vehicle: trip.vehicle, at: trip.exited,
      source: billing.source ?? (billing.voucherFunding?.negative ? "VA" : billing.customerPayable === 0 && !billing.voucherFunding
        ? trip.group === "Thuê bao" ? "SUB" : "FREE" : "VL"), count: 1, price: billing.gross,
      discounts: billing.discounts.map((row) => ({ code: row.code, amount: row.amount })),
      voucher: billing.voucherFunding, payments: billing.payments, trip,
      description: `Lượt bổ sung · Đối soát ${billing.id}`,
      reason: billing.amountDue > 0 ? "Thu thiếu" : undefined }
  }
  if (trip.supplementalExit) {
    const { method, reference } = trip.supplementalExit
    const amount = trip.paid ?? 0
    return {
      id: trip.id,
      site: trip.site,
      vehicle: trip.vehicle,
      at: trip.exited,
      source: "VL",
      count: 1,
      price: trip.due ?? 0,
      discounts: [],
      payments: amount ? [demoTransaction(`GD-${trip.id}`, amount, trip.exited, method)] : [],
      description: `Bổ sung giờ ra · Biên bản ${reference}`,
      reason: amount < (trip.due ?? 0) ? "Thu thiếu" : undefined,
      trip,
    }
  }
  const index = Number(trip.id.replace(/\D/g, "").slice(-6)) || 0
  const noCharge = trip.group === "Thuê bao" && index % 7 !== 0
  const price = noCharge ? 0 : (trip.due ?? 0) || 30000
  const isSupplement = trip.sourceOut === "CSKH bổ sung"
  const full = price > 0 && !isSupplement && (trip.group === "VIP" || trip.due === 0)
  const discounts: Discount[] = full ? [{ code: "CS-03", amount: price }] :
    price > 0 && !isSupplement && index % 9 === 0 ? [{ code: "CS-01", amount: Math.min(20000, price), review: index % 171 === 0 }]
    : price > 0 && !isSupplement && index % 17 === 0 ? [{ code: "CS-02", amount: Math.round(price / 5) }]
    : price > 0 && !isSupplement && index % 23 === 0 ? [{ code: "CS-04", amount: 5000 }] : []
  const afterDiscount = price - discounts.reduce((sum, row) => sum + row.amount, 0)
  const estate = siteById(trip.site)?.estate ?? ""
  const hasVoucher = afterDiscount > 0 && !isSupplement && (trip.voucher > 0 || index % 41 === 0)
  const negative = hasVoucher && index % 3 !== 0
  const unitId = `${estate}-DV${negative ? index % 2 + 1 : 3}`
  const recipient = demoUnits.find((unit) => unit.id === unitId)
  const voucher = hasVoucher ? { code: `VC-${trip.id}`, unit: unitId, negative,
    amount: negative ? afterDiscount : Math.round(afterDiscount / 2), ...(recipient ? { recipient: { ...recipient, active: true } } : {}) } : undefined
  const payable = afterDiscount - (voucher?.amount ?? 0)
  const amount = payable <= 0 || isSupplement ? 0 : trip.paid === 0 && !trip.voucher ? 0 : payable + (index % 401 === 0 ? 5000 : 0)
  const method = methods[index % 10 < 7 ? 1 : index % 10 < 9 ? 0 : Math.floor(index / 10) % 2 ? 2 : 3]
  const payments = amount ? [demoTransaction(`GD-${trip.id}`, amount, trip.exited, method)] : []
  if (amount > 0 && index % 127 === 0) {
    const first = Math.floor(amount / 2)
    payments.splice(0, 1, demoTransaction(`WEB-${trip.id}`, first, trip.entered, "QR"),
      demoTransaction(`GD-${trip.id}`, amount - first, trip.exited, "QR"))
  }
  const pending = payable > 0 && amount === 0 && !isSupplement && index % 2 === 0
  if (pending) payments.push({ ...demoTransaction(`GD-${trip.id}`, payable, trip.exited, "QR"), status: "Chờ xác nhận" })
  const source = noCharge ? "SUB" : full || (price > 0 && afterDiscount === 0) ? "FREE" : negative ? "VA" :
    trip.sourceOut === "App khi mất điện" ? "APP" : "VL"
  return { id: trip.id, site: trip.site, vehicle: trip.vehicle, at: trip.exited, source, count: 1,
    price, discounts, voucher, payments, trip, reason: isSupplement ? "Không xác định" : pending ? "Chờ xác nhận thanh toán" : lossReasons[index % lossReasons.length], missing: trip.due === null }
}
export function tripRevenueAmounts(trip: Trip): Trip {
  const charge = chargeForTrip(trip)
  if (!charge) return trip
  const value = moneyLayers(charge, 0)
  return { ...trip, due: value.revenue, paid: value.collected, voucher: value.debt,
    policy: charge.discounts.map((row) => row.code).join(", ") || trip.policy }
}
export function buildLedger(trips: Trip[], settings: ParkingSettings, state: RevenueState, incidents: Charge[] = []) {
  const changes = new Map(state.tripUpdates.map((update) => [update.trip.id, update.trip]))
  const currentTrips = trips.map((trip) => changes.get(trip.id) ?? trip)
  const existing = new Set(trips.map((trip) => trip.id))
  for (const trip of changes.values()) if (!existing.has(trip.id)) currentTrips.push(trip)
  const charges: Charge[] = currentTrips.flatMap((trip) => {
    const charge = chargeForTrip(trip)
    return charge ? [applyVoucherApplications(charge, state.voucherWorkspace?.applications ?? [])] : []
  })
  charges.push(...(state.demoCharges ?? []).map((charge) => applyVoucherApplications(charge, state.voucherWorkspace?.applications ?? [])))
  for (const batch of state.papers) if (!batch.canceled) batch.rows.forEach((row, i) => {
    const at = dayStart(row.day) + 720
    charges.push({ id: `${batch.id}-${i + 1}`, site: row.site, vehicle: row.vehicle, at, day: row.day,
      shift: row.shift || revenueShifts(row.site, row.day, settings, state).slice(-1)[0].name, source: "VG", count: row.to - row.from + 1,
      price: row.amount, discounts: [], payments: [demoTransaction(batch.id, row.amount, at, row.method)],
      description: `Đồng bộ SOS App · Series ${row.from} – ${row.to}` })
  })
  for (const row of state.receipts) if (!row.canceled) charges.push({
    id: row.id, site: row.site, vehicle: row.vehicle, at: row.at, source: "CT", count: 0, price: row.amount, discounts: [],
    payments: [demoTransaction(row.id, row.amount, row.at, row.method)], description: `${row.customer} · ${row.card} · ${row.kind}`,
  })
  charges.push(...incidents)
  const cache = new Map<string, RevenueShift[]>()
  const configCache = new Map<string, Config>()
  const getConfig = (estate: string, day: string) => {
    const key = `${estate}/${day}`
    const saved = configCache.get(key)
    if (saved) return saved
    const value = configAt(state, estate, day)
    configCache.set(key, value)
    return value
  }
  const byId = new Map<string, LedgerRow>()
  for (const charge of charges) {
    const estate = siteById(charge.site)?.estate ?? ""
    const calendarDay = dayAt(charge.at)
    const day = charge.day ?? (charge.at - dayStart(calendarDay) < timeMinutes(getConfig(estate, calendarDay).hour)
      ? shiftDay(calendarDay, -1) : calendarDay)
    const key = `${charge.site}/${day}`
    let shifts = cache.get(key)
    if (!shifts) { shifts = revenueShifts(charge.site, day, settings, state); cache.set(key, shifts) }
    const shift = shifts.find((item) => charge.shift ? item.name === charge.shift :
      item.parts.some((part) => charge.at >= part.from && charge.at < part.until)) ?? shifts[0]
    const config = getConfig(estate, day)
    byId.set(charge.id, { ...charge, ...moneyLayers(charge, config.vat), estate, revenueDay: day, shiftId: shift.id, shiftName: shift.name })
  }
  const incidentIds = new Set(incidents.map((row) => row.id))
  for (const [id, row] of byId) {
    if (!incidentIds.has(id) || !state.closes[row.shiftId]) continue
    if (!Object.prototype.hasOwnProperty.call(state.closes[row.shiftId].frozen, id)) byId.delete(id)
  }
  for (const closing of Object.values(state.closes)) for (const [id, row] of Object.entries(closing.frozen)) {
    if (row) byId.set(id, row)
    else byId.delete(id)
  }
  return [...byId.values()]
}
export function incidentCharges(operations: OperationState): Charge[] {
  return operations.incidents.flatMap((incident) => {
    const card = operations.cards.find((item) => item.id === incident.cardId)
    const site = card && allowedSites({ role: "admin", estate: card.estate }).find((item) => item.name === card.park)
    if (!card || !site || card.type !== "Vãng lai" || incident.fee <= 0) return []
    const at = dayStart(incident.date) + 9 * 60
    const vehicle = card.vehicle as Vehicle
    return [{ id: incident.id, site: site.id, vehicle, at, source: "MT", count: 0, price: incident.fee, discounts: [],
      payments: [demoTransaction(incident.id, incident.fee, at, "Tiền mặt")], description: `${card.id} · ${incident.reason}` }]
  })
}
export function cardsWithReceipts(operations: OperationState, receipts: Receipt[]): OperationState {
  const active = receipts.filter((row) => !row.canceled)
  if (!active.length) return operations
  const issued = new Map(active.map((row) => [row.card, row]))
  const byContract = new Map<string, Receipt>()
  for (const receipt of active) {
    if (receipt.contract && !byContract.has(receipt.contract)) byContract.set(receipt.contract, receipt)
  }
  const locked = new Set(active.map((row) => row.previous).filter(Boolean))
  return { ...operations, subscriptions: operations.subscriptions.map((row) => {
    const receipt = byContract.get(row.id)
    return receipt && row.cardId !== receipt.card ? { ...row, cardId: receipt.card } : row
  }), cards: operations.cards.map((card) => {
    if (locked.has(card.id) && card.status !== "Mất / hỏng") return { ...card, status: "Khóa" }
    const receipt = issued.get(card.id)
    return receipt && card.status === "Trong kho" ? {
      ...card, status: "Đang hoạt động", type: "Thuê bao tháng", owner: receipt.customer,
      plate: receipt.plate || "—", subscription: receipt.contract || card.subscription,
      issued: dayAt(receipt.at),
    } : card
  }) }
}
export function recordChange(state: RevenueState, oldRow: LedgerRow | undefined, newRow: LedgerRow | undefined,
  reason: string, actor: string, at = vnNow()) {
  const row = oldRow ?? newRow
  if (!row) return state
  const closingKey = oldRow && state.closes[oldRow.shiftId] ? oldRow.shiftId : newRow?.shiftId
  const closing = closingKey ? state.closes[closingKey] : undefined
  if (!closing || !closingKey) return state
  const saved = Object.prototype.hasOwnProperty.call(closing.frozen, row.id) ? closing.frozen[row.id] : oldRow ?? null
  return { ...state, closes: { ...state.closes, [closingKey]: { ...closing, frozen: { ...closing.frozen, [row.id]: saved } } },
    changes: [{ id: crypto.randomUUID(), recorded: revenueDay(at, row.estate, state), origin: row.revenueDay, estate: row.estate,
      reference: row.id, reason, actor, delta: deltaFor(oldRow, newRow), site: row.site }, ...state.changes] }
}
export const isPeriodClosed = (state: RevenueState, estate: string, month: string, cutoff?: string) =>
  Boolean(state.periods[`${estate}/${month}`]) || Boolean(cutoff && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && monthEnd(month) <= cutoff)
export const closeStatus = (state: RevenueState, estate: string, day: string, shifts: RevenueShift[], cutoff?: string) => {
  if (isPeriodClosed(state, estate, day.slice(0, 7), cutoff)) return "Đã chốt kỳ"
  const count = shifts.filter((shift) => state.closes[shift.id]).length
  return shifts.length && count === shifts.length ? "Đã chốt" : `Tạm tính · ${count}/${shifts.length} ca`
}
export function auditRevenue(state: RevenueState, actor: string, action: string, scope: string, detail: string): RevenueState {
  return { ...state, audit: [{ at: vnNow(), actor, action, scope, detail }, ...state.audit] }
}
export function subscriptionRevenue(month: string, filter: RevenueFilter, access: ParkingAccess) {
  if (!/^2026-(09|10|11|12)$/.test(month)) return []
  const sites = allowedSites(access)
  return estates.flatMap((estate, estateIndex) => {
    if (!revenueMatches(estate.id, filter.estate) || !sites.some((site) => site.estate === estate.id)) return []
    return Array.from({ length: 46 + estateIndex * 7 }, (_, i) => {
      const locations = i % 3 === 0 ? [`${estate.id}:0`, `${estate.id}:1`] : [`${estate.id}:${i % 3}`]
      return { id: `HD-${estate.id}-${1000 + i}`, estate: estate.id, sites: locations, vehicle: i % 4 ? "Ô tô" : "Xe máy",
        group: subscriptionGroups[i % subscriptionGroups.length], month, gross: 440000 + i % 5 * 220000, paid: i % 9 !== 0,
        customer: `Thuê bao ${estate.short} ${i + 1}` }
    }).filter((row) => revenueIntersects(row.sites, filter.site) && revenueMatches(row.vehicle, filter.vehicle))
  })
}
export type SubscriptionRevenue = ReturnType<typeof subscriptionRevenue>[number]
export const dateCell = (day: string) => isDay(day) ? new Date(dayStart(day) * 60000) : null
export const timestampCell = (at: number) => new Date(at * 60000)
export const timeInput = (value: string) => Date.parse(`${value}:00Z`) / 60000
export const inputTime = (at: number) => minuteIso(at).slice(0, 16)
export const daysFor = (start: string, end: string) => start <= end ? daysIn(start, end) : []
