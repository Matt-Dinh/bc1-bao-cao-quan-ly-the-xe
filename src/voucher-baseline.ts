// Voucher fields and rules follow the reference CMS's services/voucher and features/Voucher.
// This review dataset is separate from the revenue integration; it never rewrites financial records.
import { normalize } from "./data"
import { allowedSites, dayAt, dayStart, isDay, shiftDay, siteById, vnNow } from "./parking-model"
import type { ParkingAccess } from "./parking-model"

export const voucherKinds = { AMOUNT: "Theo tiền", DURATION: "Theo giờ", TIME_WINDOW: "Theo khung giờ" } as const
export type VoucherKind = keyof typeof voucherKinds
export type Benefit = { kind: VoucherKind; amount: number; hours: number; minutes: number; windowStart: string; windowEnd: string }
export type Merchant = { id: string; code: string; name: string; sites: string[]; active: boolean; description: string; created: number; updated: number }
export type Template = Benefit & { id: string; merchant: string; name: string; sites: string[]; start: string; duration: number; active: boolean; isDefault: boolean; updated: number }
export type BillVoucher = Benefit & { id: string; merchant: string; reference: string; name: string; sites: string[]; paid: number; bill: number; guests: number; from: number; until: number; quota: number; active: boolean; created: number; updated: number }
export type IssuedVoucher = { id: string; source: string; value: string; benefit: Benefit; sites: string[]; from: number; until: number; created: number; canceled?: { at: number; by: string; reason: string } }
export type VoucherUse = { id: string; code: string; site: string; session: string; plate: string; at: number; status: "APPLIED" | "USED" | "REJECTED"; discount?: number }
export type VoucherBaseline = { version: 1; merchants: Merchant[]; templates: Template[]; sources: BillVoucher[]; codes: IssuedVoucher[]; uses: VoucherUse[] }
export const benefitDefaults: Benefit = { kind: "DURATION", amount: 0, hours: 1, minutes: 0, windowStart: "08:00", windowEnd: "22:00" }
export const voucherStorageKey = "vparking-voucher-ba-baseline-v1"
export const siteNames = (ids: string[]) => ids.map((id) => siteById(id)?.label ?? id).join(", ")
export const localDateTime = (minute: number) => Number.isFinite(minute) ? new Date((minute + 420) * 60000).toISOString().slice(0, 16) : ""
export const parseLocalDateTime = (value: string) => value ? Date.parse(`${value}+07:00`) / 60000 : NaN
export const benefitText = (row: Benefit) => row.kind === "AMOUNT" ? `Khấu trừ ${row.amount.toLocaleString("vi-VN")} ₫`
  : row.kind === "DURATION" ? `Miễn phí ${row.hours} giờ${row.minutes ? ` ${row.minutes} phút` : ""}`
    : `${row.windowStart.replace("T", " ")} – ${row.windowEnd.replace("T", " ")}`
export const usageText = (kind: VoucherKind) => kind === "TIME_WINDOW" ? "Nhiều lần" : "Một lần"
export const sourceCodes = (state: VoucherBaseline, source: string) => state.codes.filter((row) => row.source === source)
export const codeUses = (state: VoucherBaseline, code: string) => state.uses.filter((row) => row.code === code)
export const codeStatus = (code: IssuedVoucher, now = vnNow()) => code.canceled ? "CANCELLED" : code.until < now ? "EXPIRED" : "NEW"
export const codeUnused = (state: VoucherBaseline, code: IssuedVoucher, now = vnNow()) => codeStatus(code, now) === "NEW" && !codeUses(state, code.id).length
export const codeLabel = (state: VoucherBaseline, code: IssuedVoucher, use?: VoucherUse, now = vnNow()) => {
  if (code.canceled) return "Đã hủy"
  const event = use ?? codeUses(state, code.id).slice(-1)[0]
  return event ? { APPLIED: "Đang sử dụng", USED: "Đã sử dụng", REJECTED: "Bị từ chối" }[event.status] : code.until < now ? "Hết hạn" : "Chưa sử dụng"
}
const id = () => crypto.randomUUID()
const requireRule = (valid: unknown, message: string) => { if (!valid) throw new Error(message) }
const inScope = (sites: string[], access: ParkingAccess) => sites.length > 0 && sites.every((site) => allowedSites(access).some((row) => row.id === site))
// All parking lots in this local review dataset belong to VCR. Estate is not a company ID.
const sameCompany = (sites: string[], access: ParkingAccess) => inScope(sites, access)
export function validateBenefit(row: Benefit, template = false) {
  requireRule(row.kind in voucherKinds, "Vui lòng chọn loại voucher")
  if (row.kind === "AMOUNT") requireRule(Number.isSafeInteger(row.amount) && row.amount > 0, "Số tiền khấu trừ phải là số nguyên lớn hơn 0")
  if (row.kind === "DURATION") requireRule(Number.isSafeInteger(row.hours) && row.hours >= (template ? 1 : 0) && Number.isSafeInteger(row.minutes) && row.minutes >= 0 && row.minutes <= 59 && row.hours * 60 + row.minutes > 0, "Nhập thời lượng miễn phí hợp lệ; phút thêm từ 0 đến 59")
  if (row.kind === "TIME_WINDOW") requireRule(row.windowStart && row.windowEnd && row.windowEnd > row.windowStart, "Giờ kết thúc phải sau giờ bắt đầu")
}
function cancelUnused(state: VoucherBaseline, sources: Set<string>, reason: string, actor: string, now: number) {
  return state.codes.map((row) => sources.has(row.source) && codeUnused(state, row, now) ? { ...row, canceled: { at: now, by: actor, reason } } : row)
}
export function saveMerchant(state: VoucherBaseline, draft: Merchant, access: ParkingAccess, actor: string, now = vnNow()): VoucherBaseline {
  const old = state.merchants.find((row) => row.id === draft.id)
  requireRule(["admin", "manager"].includes(access.role), "Bạn không có quyền chỉnh sửa gian hàng")
  requireRule(inScope(draft.sites, access) && sameCompany(draft.sites, access), "Chọn bãi xe áp dụng trong cùng một công ty và phạm vi quản lý")
  requireRule(draft.code.trim() && draft.code.length <= 50 && draft.name.trim() && draft.name.length <= 255 && draft.description.length <= 500, "Kiểm tra mã (tối đa 50 ký tự), tên và ghi chú gian hàng")
  requireRule(!state.merchants.some((row) => row.id !== draft.id && row.code.toUpperCase() === draft.code.trim().toUpperCase()), "Mã gian hàng đã tồn tại")
  if (old) requireRule(old.code === draft.code, "Không đổi mã gian hàng đã tạo")
  const saved = { ...draft, id: old?.id ?? id(), code: draft.code.trim(), name: draft.name.trim(), created: old?.created ?? now, updated: now }
  const sources = new Set(state.sources.filter((row) => row.merchant === saved.id).map((row) => row.id))
  return { ...state, merchants: old ? state.merchants.map((row) => row.id === old.id ? saved : row) : [...state.merchants, saved],
    codes: !saved.active ? cancelUnused(state, sources, "Gian hàng không hoạt động", actor, now) : state.codes }
}
export function saveTemplate(state: VoucherBaseline, draft: Template, access: ParkingAccess, now = vnNow()): VoucherBaseline {
  const merchant = state.merchants.find((row) => row.id === draft.merchant)
  requireRule(["admin", "manager"].includes(access.role) && merchant?.active && inScope(merchant.sites, access), "Gian hàng không hoạt động hoặc bạn không có quyền chỉnh sửa mẫu")
  requireRule(draft.name.trim() && draft.name.length <= 20, "Tên voucher bắt buộc và tối đa 20 ký tự")
  requireRule(!state.templates.some((row) => row.merchant === draft.merchant && row.id !== draft.id && normalize(row.name) === normalize(draft.name)), "Tên voucher đã tồn tại trong gian hàng này")
  requireRule(inScope(draft.sites, access) && sameCompany(draft.sites, access), "Chọn bãi xe áp dụng trong cùng một công ty")
  requireRule(/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.start) && Number.isInteger(draft.duration) && draft.duration >= 0 && draft.duration <= 8760, "Kiểm tra giờ bắt đầu và số giờ hiệu lực (0–8760)")
  validateBenefit(draft, true)
  const old = state.templates.find((row) => row.id === draft.id)
  requireRule(draft.active || !(draft.isDefault || old?.isDefault), "Mẫu mặc định phải hoạt động; đặt mẫu khác làm mặc định trước")
  const saved = { ...draft, id: old?.id ?? id(), name: draft.name.trim(), updated: now,
    isDefault: draft.isDefault || !state.templates.some((row) => row.merchant === draft.merchant) }
  requireRule(!saved.isDefault || saved.active, "Mẫu mặc định phải hoạt động")
  return { ...state, templates: [...state.templates.filter((row) => row.id !== saved.id).map((row) => saved.isDefault && row.merchant === saved.merchant ? { ...row, isDefault: false } : row), saved] }
}
export function removeTemplate(state: VoucherBaseline, template: Template, access: ParkingAccess): VoucherBaseline {
  const merchant = state.merchants.find((row) => row.id === template.merchant)
  requireRule(["admin", "manager"].includes(access.role) && merchant?.active && inScope(merchant.sites, access), "Bạn không có quyền xóa mẫu voucher")
  return { ...state, templates: state.templates.filter((row) => row.id !== template.id) }
}
export function applyTemplate(draft: BillVoucher, template: Template, now = vnNow()): BillVoucher {
  const start = dayStart(dayAt(now)) + Number(template.start.slice(0, 2)) * 60 + Number(template.start.slice(3))
  const from = Math.max(start, Math.floor(now))
  return { ...draft, name: template.name, kind: template.kind, amount: template.amount, hours: template.hours, minutes: template.minutes,
    windowStart: `${dayAt(now)}T${template.windowStart.slice(-5)}`, windowEnd: `${dayAt(now)}T${template.windowEnd.slice(-5)}`,
    sites: [...template.sites], from, until: from + template.duration * 60 }
}
export function saveBill(state: VoucherBaseline, draft: BillVoucher, access: ParkingAccess, actor: string, now = vnNow()): VoucherBaseline {
  requireRule(["admin", "manager"].includes(access.role), "Bạn không có quyền phát hành voucher")
  const old = state.sources.find((row) => row.id === draft.id)
  const merchant = state.merchants.find((row) => row.id === draft.merchant)
  requireRule(merchant?.active && inScope(merchant.sites, access), "Chọn gian hàng đang hoạt động trong phạm vi quản lý")
  requireRule(draft.reference.trim() && draft.reference.length <= 100 && draft.name.trim() && draft.name.length <= 20, "Mã hóa đơn bắt buộc; tên voucher tối đa 20 ký tự")
  requireRule(!state.sources.some((row) => row.id !== draft.id && row.merchant === draft.merchant && row.reference.toUpperCase() === draft.reference.trim().toUpperCase()), "Gian hàng đã có hóa đơn này; chuyển sang cập nhật hóa đơn có sẵn")
  requireRule(Number.isInteger(draft.quota) && draft.quota >= 1 && draft.quota <= 999, "Phát hành từ 1 đến 999 voucher")
  requireRule(Number.isFinite(draft.paid) && draft.paid <= now && Number.isFinite(draft.from) && draft.from >= draft.paid && draft.until > draft.from && draft.until > now, "Kiểm tra ngày giờ thanh toán và hiệu lực; kết thúc phải sau hiện tại")
  requireRule(Number.isSafeInteger(draft.guests) && draft.guests >= 0 && draft.guests <= 9999 && Number.isSafeInteger(draft.bill) && draft.bill >= 0 && draft.bill <= 9999999999, "Kiểm tra số khách và giá trị bill")
  requireRule(inScope(draft.sites, access) && sameCompany(draft.sites, access), "Chọn bãi áp dụng trong cùng một công ty và phạm vi quản lý")
  validateBenefit(draft)
  const existing = old ? sourceCodes(state, old.id) : []
  const live = existing.filter((row) => !row.canceled)
  const unused = live.filter((row) => codeUnused(state, row, now)).sort((a, b) => b.created - a.created || b.value.localeCompare(a.value))
  if (old) {
    requireRule(old.merchant === draft.merchant && old.reference === draft.reference, "Không đổi gian hàng hoặc mã hóa đơn đã tạo")
    if (existing.some((row) => !codeUnused(state, row, now))) requireRule(old.kind === draft.kind, "Hóa đơn có mã không còn Chưa sử dụng; không đổi loại voucher")
    requireRule(live.length - draft.quota <= unused.length, "Không đủ voucher chưa sử dụng để hủy bớt; số lượng chưa được lưu")
  }
  const saved: BillVoucher = { ...draft, id: old?.id ?? id(), name: draft.name.trim(), reference: draft.reference.trim(), created: old?.created ?? now, updated: now }
  const canceled = new Set(unused.slice(0, Math.max(0, live.length - draft.quota)).map((row) => row.id))
  let codes = state.codes.map((row) => {
    if (row.source !== saved.id || !codeUnused(state, row, now)) return row
    if (canceled.has(row.id) || !saved.active) return { ...row, canceled: { at: now, by: actor, reason: saved.active ? "Giảm số lượng phát hành" : "Hóa đơn không hoạt động" } }
    return { ...row, benefit: { ...saved }, sites: [...saved.sites], from: saved.from, until: saved.until }
  })
  if (saved.active) for (let i = live.length; i < saved.quota; i++) codes.push({ id: id(), source: saved.id,
    value: `VC-${saved.reference}-${id().slice(0, 8).toUpperCase()}`, benefit: { ...saved }, sites: [...saved.sites], from: saved.from, until: saved.until, created: now })
  return { ...state, sources: old ? state.sources.map((row) => row.id === old.id ? saved : row) : [...state.sources, saved], codes }
}
export function setBillActive(state: VoucherBaseline, source: BillVoucher, active: boolean, access: ParkingAccess, actor: string, now = vnNow()): VoucherBaseline {
  requireRule(["admin", "manager"].includes(access.role) && inScope(source.sites, access), "Bạn không có quyền cập nhật voucher hóa đơn")
  return { ...state, sources: state.sources.map((row) => row.id === source.id ? { ...row, active, updated: now } : row),
    codes: active ? state.codes : cancelUnused(state, new Set([source.id]), "Hủy voucher hóa đơn", actor, now) }
}
export function cancelCode(state: VoucherBaseline, code: IssuedVoucher, reason: string, access: ParkingAccess, actor: string, now = vnNow()): VoucherBaseline {
  const current = state.codes.find((row) => row.id === code.id)
  requireRule(["admin", "manager"].includes(access.role) && inScope(code.sites, access), "Bạn không có quyền hủy voucher")
  requireRule(reason.trim() && current && codeUnused(state, current, now), "Chỉ hủy voucher chưa sử dụng và phải nhập lý do")
  return { ...state, codes: state.codes.map((row) => row.id === code.id ? { ...row, canceled: { at: now, by: actor, reason: reason.trim() } } : row) }
}

export function initialVoucherBaseline(now = vnNow()): VoucherBaseline {
  const today = dayAt(now), sites = allowedSites({ role: "admin", estate: "" })
  const state: VoucherBaseline = { version: 1, merchants: [], templates: [], sources: [], codes: [], uses: [] }
  for (const [index, site] of sites.entries()) {
    const merchant: Merchant = { id: `BA-GH-${index + 1}`, code: `GH-${String(index + 1).padStart(3, "0")}`, name: ["Highlands Coffee", "CGV Cinema", "WinMart", "Phúc Long", "Nhà hàng An Nam", "Nhà sách Fahasa"][index % 6] + ` · ${site.name}`,
      sites: [site.id], active: index !== sites.length - 1, description: ["Cà phê & đồ uống", "Giải trí", "Mua sắm"][index % 3], created: dayStart(shiftDay(today, -90)), updated: now - 1440 }
    state.merchants.push(merchant)
    for (const kind of Object.keys(voucherKinds) as VoucherKind[]) state.templates.push({ ...benefitDefaults, id: `${merchant.id}/${kind}`, merchant: merchant.id,
      name: kind === "AMOUNT" ? "Giảm 20K" : kind === "DURATION" ? "Miễn phí 2 giờ" : "Khung giờ ưu đãi", kind,
      amount: 20000, hours: 2, sites: [site.id], start: "00:00", duration: 24, active: true, isDefault: kind === "DURATION", updated: now - 1440 })
    for (let day = -8; day <= 0; day++) {
      const created = day === 0 ? Math.floor(now) - 120 : dayStart(shiftDay(today, day)) + 600 + index
      const kind = (Object.keys(voucherKinds) as VoucherKind[])[Math.abs(day + index) % 3]
      const source: BillVoucher = { ...benefitDefaults, id: `BA-BILL-${index}-${day}`, merchant: merchant.id, reference: `BILL-${today.replace(/-/g, "")}-${index + 1}-${day + 9}`,
        name: kind === "AMOUNT" ? "Ưu đãi 20K" : kind === "DURATION" ? "Miễn phí gửi xe" : "Ưu đãi khung giờ", kind, amount: 20000, hours: 2,
        windowStart: `${dayAt(created)}T08:00`, windowEnd: `${dayAt(created)}T23:00`, sites: [site.id], paid: created - 15, bill: 150000 + index * 75000, guests: 4 + index % 3,
        from: created, until: created + (day === -8 ? 1440 : 7 * 1440), quota: 4 + index % 3, active: merchant.active && day !== -7, created, updated: created }
      state.sources.push(source)
      for (let n = 0; n < source.quota; n++) {
        const code: IssuedVoucher = { id: `${source.id}/VC-${n + 1}`, source: source.id, value: `VP-${index + 1}-${day + 9}-${String(n + 1).padStart(4, "0")}`, benefit: { ...source }, sites: [site.id], from: source.from, until: source.until, created }
        if (!source.active || n === 3 && day % 3 === 0) code.canceled = { at: created + 10, by: "BQL", reason: "Khách hủy hóa đơn" }
        state.codes.push(code)
        if (!code.canceled && n < 2) {
          state.uses.push({ id: `${code.id}/USE`, code: code.id, site: site.id, session: `LX-BA-${index}-${day + 9}-${n}`, plate: `30A-${100 + index}.${20 + n}`,
            at: created + 30, status: n === 0 ? "USED" : day === 0 ? "APPLIED" : "REJECTED", ...(n === 0 ? { discount: kind === "AMOUNT" ? 20000 : 30000 } : {}) })
          if (kind === "TIME_WINDOW" && n === 0) state.uses.push({ id: `${code.id}/USE2`, code: code.id, site: site.id, session: `LX-BA-${index}-${day + 9}-${n}-2`, plate: `30F-${100 + index}.88`, at: created + 90, status: "USED", discount: 15000 })
        }
      }
    }
  }
  return state
}
export function readVoucherBaseline(): VoucherBaseline {
  try { const saved = JSON.parse(localStorage.getItem(voucherStorageKey) || "null"); if (saved?.version === 1 && [saved.merchants, saved.templates, saved.sources, saved.codes, saved.uses].every(Array.isArray)) return saved } catch { /* Initialize a separate review dataset. */ }
  return initialVoucherBaseline()
}
export type VoucherScope = { site: string; merchants: string; kind: string; status: string; application: string; reference: string; from: string; to: string; validFrom: string; validTo: string; query: string; session: string }
export const voucherFilterKeys = ["vbSite", "vbMerchant", "vbType", "vbStatus", "vbApplication", "vbReference", "vbFrom", "vbTo", "vbValidFrom", "vbValidTo", "q", "sessionId"]
export function readVoucherScope(params: URLSearchParams, page: string, today = dayAt(vnNow())): VoucherScope {
  const period = page === "history" || page === "report"
  const readDay = (key: string, fallback: string) => { const value = params.get(key); return value === "" ? "" : value && isDay(value) ? value : fallback }
  return { site: params.get("vbSite") || "", merchants: params.get("vbMerchant") || "", kind: params.get("vbType") || "", status: params.get("vbStatus") || "", application: params.get("vbApplication") || "",
    reference: params.get("vbReference") || "", from: readDay("vbFrom", period ? shiftDay(today, -6) : ""), to: readDay("vbTo", period ? today : ""),
    validFrom: readDay("vbValidFrom", ""), validTo: readDay("vbValidTo", ""), query: params.get("q") || "", session: params.get("sessionId") || "" }
}
const selected = (value: string, scope: string) => !scope || scope.split("|").includes(value)
export function selectVoucherSources(state: VoucherBaseline, scope: VoucherScope, access: ParkingAccess) {
  return state.sources.filter((row) => row.sites.some((site) => allowedSites(access).some((allowed) => allowed.id === site)) &&
    (!scope.site || row.sites.includes(scope.site)) && selected(row.merchant, scope.merchants) && selected(row.kind, scope.kind) &&
    (!scope.status || scope.status === (row.active ? "active" : "inactive")) && (!scope.from || dayAt(row.created) >= scope.from) && (!scope.to || dayAt(row.created) <= scope.to) &&
    (!scope.validFrom || row.until >= dayStart(scope.validFrom)) && (!scope.validTo || row.from < dayStart(scope.validTo) + 1440) &&
    (!scope.reference || normalize(row.reference).includes(normalize(scope.reference))) &&
    (!scope.query || normalize(`${row.reference} ${row.name}`).includes(normalize(scope.query))))
}
export function selectVoucherHistory(state: VoucherBaseline, scope: VoucherScope, access: ParkingAccess, now = vnNow()) {
  const sources = selectVoucherSources(state, { ...scope, status: "", query: "", from: "", to: "", validFrom: "", validTo: "" }, access)
  const ids = new Set(sources.map((row) => row.id))
  return state.codes.filter((row) => ids.has(row.source)).flatMap((code) => {
    const source = sources.find((row) => row.id === code.source)!, merchant = state.merchants.find((row) => row.id === source.merchant)!
    const uses = codeUses(state, code.id)
    return (uses.length ? uses : [undefined]).map((use) => ({ id: `${code.id}/${use?.id ?? "unused"}`, code, source, merchant, use }))
  }).filter(({ code, use }) => (!scope.from || dayAt(code.created) >= scope.from) && (!scope.to || dayAt(code.created) <= scope.to) &&
    (!scope.validFrom || code.until >= dayStart(scope.validFrom)) && (!scope.validTo || code.from < dayStart(scope.validTo) + 1440) &&
    selected(codeStatus(code, now), scope.status) && (!scope.application || !!use && selected(use.status, scope.application)) &&
    (!scope.session || use?.session === scope.session) && (!scope.site || !use || use.site === scope.site) &&
    (!scope.query || normalize(`${code.value} ${use?.plate ?? ""}`).includes(normalize(scope.query))))
}
export function voucherStats(state: VoucherBaseline, sources: BillVoucher[], from: string, to: string, now = vnNow()) {
  const ids = new Set(sources.map((row) => row.id))
  const inPeriod = (at: number) => (!from || dayAt(at) >= from) && (!to || dayAt(at) <= to)
  const codes = state.codes.filter((row) => ids.has(row.source) && inPeriod(row.created))
  const codeIds = new Set(state.codes.filter((row) => ids.has(row.source)).map((row) => row.id))
  const uses = state.uses.filter((row) => codeIds.has(row.code) && row.status === "USED" && inPeriod(row.at))
  const used = new Set(uses.map((row) => row.code)).size
  const benefitAmount = codes.reduce((n, row) => n + (row.benefit.kind === "AMOUNT" ? row.benefit.amount : 0), 0)
  const benefitMinutes = codes.reduce((n, row) => n + (row.benefit.kind === "DURATION" ? row.benefit.hours * 60 + row.benefit.minutes : row.benefit.kind === "TIME_WINDOW" ? Math.max(0, parseLocalDateTime(row.benefit.windowEnd) - parseLocalDateTime(row.benefit.windowStart)) : 0), 0)
  return { issued: codes.length, used, sourceCount: new Set(codes.map((row) => row.source)).size, benefitAmount, benefitMinutes,
    discount: uses.reduce((n, row) => n + (row.discount ?? 0), 0), expired: codes.filter((row) => codeStatus(row, now) === "EXPIRED" && !codeUses(state, row.id).length).length,
    today: codes.filter((row) => dayAt(row.created) === dayAt(now)).length, uses }
}
