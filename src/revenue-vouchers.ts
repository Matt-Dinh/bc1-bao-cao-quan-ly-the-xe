import { allowedSites, dayAt, dayStart, isDay, shiftDay, siteById, vnNow } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import type { Charge, LedgerRow, RevenueFilter, RevenueState } from "./revenue-model"
import { revenueMatches, revenueIntersects } from "./revenue-filter-values"

export const voucherPurposes = { NEGATIVE_TICKET: "Vé âm", REIMBURSABLE: "Voucher thu lại tiền", VCR_DISCOUNT: "Mã giảm giá VCR" } as const
export const voucherBenefits = { FULL_FEE: "Toàn bộ phí thực tế", AMOUNT: "Theo số tiền", DURATION: "Theo thời lượng", TIME_WINDOW: "Theo khung giờ" } as const
export const voucherOrigins = { BILL: "Theo hóa đơn", MANUAL: "Cấp theo đợt", EVENT: "Theo sự kiện" } as const
export type VoucherPurpose = keyof typeof voucherPurposes
export type VoucherBenefitType = keyof typeof voucherBenefits
export type VoucherOrigin = keyof typeof voucherOrigins
export type VoucherUnit = { id: string; estate: string; name: string; type: string; contract: string; active: boolean }
export type VoucherSource = {
  id: string; reference: string; name: string; origin: VoucherOrigin; unit: string; recipient: VoucherUnit;
  purpose: VoucherPurpose; benefit: VoucherBenefitType; amount: number; minutes: number;
  windowStart: string; windowEnd: string; from: string; until: string; sites: string[];
  quantity: number; billAmount: number; paidAt: string; active: boolean; at: number | null; actor: string;
  legacy?: boolean;
}
export type VoucherCode = { code: string; sourceId: string; at: number | null; canceled?: { at: number; actor: string; reason: string } }
export type VoucherApplication = {
  id: string; code: string; sourceId: string; tripId: string; site: string; at: number;
  status: "APPLIED" | "USED" | "REJECTED"; amount: number; purpose: VoucherPurpose;
  recipient: VoucherUnit; sourceName: string; benefit: VoucherBenefitType; reason?: string;
}
export type VoucherWorkspace = { version: 1; units: VoucherUnit[]; sources: VoucherSource[]; codes: VoucherCode[]; applications: VoucherApplication[] }
export type VoucherSourceDraft = Omit<VoucherSource, "id" | "recipient" | "at" | "actor" | "legacy" | "purpose"> & { purpose: VoucherPurpose | "" }
const purposes = Object.keys(voucherPurposes)
const positive = (value: number) => Number.isSafeInteger(value) && value > 0
const codePattern = /^[A-Za-z0-9_-]{1,100}$/

export function initialVoucherWorkspace(units: Omit<VoucherUnit, "active">[], now = vnNow()): VoucherWorkspace {
  const rows = units.map((unit) => ({ ...unit, active: true }))
  const day = dayAt(now), from = `${day.slice(0, 7)}-01`, until = shiftDay(day, 30)
  const sources: VoucherSource[] = rows.map((unit) => ({
    id: `SRC-DEMO-${unit.id}`, reference: `CP-DEMO-${unit.id}`, name: `${unit.type === "Đối tác" ? "Tài trợ phí gửi xe" : "Vé âm theo đợt"} · ${unit.name}`,
    origin: "MANUAL", unit: unit.id, recipient: { ...unit }, purpose: unit.type === "Đối tác" ? "REIMBURSABLE" : "NEGATIVE_TICKET",
    benefit: unit.type === "Đối tác" ? "AMOUNT" : "FULL_FEE", amount: unit.type === "Đối tác" ? 30000 : 0, minutes: 0,
    windowStart: "", windowEnd: "", from, until, sites: allowedSites({ role: "admin", estate: unit.estate }).map((site) => site.id),
    quantity: 3, billAmount: 0, paidAt: "", active: true, at: dayStart(shiftDay(day, -1)) + 600, actor: "BQL · Dữ liệu minh họa",
  }))
  for (const unit of rows.filter((row) => row.type === "Gian hàng")) sources.push({
    ...sources.find((source) => source.unit === unit.id)!, id: `SRC-DEMO-PROMO-${unit.id}`, reference: `BILL-DEMO-${unit.id}`,
    name: `Ưu đãi hóa đơn · ${unit.name}`, origin: "BILL", purpose: "VCR_DISCOUNT", benefit: "DURATION", minutes: 120,
    billAmount: 500000, paidAt: shiftDay(day, -1), quantity: 2,
  })
  return { version: 1, units: rows, sources, codes: sources.flatMap((source) => Array.from({ length: source.quantity }, (_, i) => ({
    code: `${source.purpose === "NEGATIVE_TICKET" ? "VA" : source.purpose === "REIMBURSABLE" ? "VC" : "MG"}-DEMO-${source.unit}-${i + 1}`,
    sourceId: source.id, at: source.at,
  }))), applications: [] }
}

/** Preserve the former prototype's locally issued codes without guessing an unknown financial purpose. */
export function normalizeVoucherWorkspace(state: Pick<RevenueState, "vouchers" | "voucherWorkspace">, units: Omit<VoucherUnit, "active">[]): VoucherWorkspace {
  const workspace = state.voucherWorkspace ?? initialVoucherWorkspace(units)
  const next = { ...workspace, units: workspace.units ?? [], sources: [...workspace.sources ?? []], codes: [...workspace.codes ?? []], applications: workspace.applications ?? [] }
  for (const old of state.vouchers ?? []) {
    if (next.codes.some((row) => row.code.toUpperCase() === old.code.toUpperCase())) continue
    const recipient = next.units.find((row) => row.id === old.unit)
    const purpose: VoucherPurpose | undefined = old.type === "Vé âm" ? "NEGATIVE_TICKET" : old.type === "Thu lại tiền" ? "REIMBURSABLE" : old.type === "Mã giảm giá" ? "VCR_DISCOUNT" : undefined
    if (!recipient || !purpose) continue
    const id = `SRC-LEGACY-${old.code}`
    next.sources.push({ id, reference: old.code, name: `Voucher đã cấp · ${old.code}`, origin: "MANUAL", unit: old.unit, recipient: { ...recipient },
      purpose, benefit: purpose === "NEGATIVE_TICKET" ? "FULL_FEE" : "AMOUNT", amount: old.amount, minutes: 0, windowStart: "", windowEnd: "",
      from: "2026-01-01", until: old.expiry, sites: allowedSites({ role: "admin", estate: recipient.estate }).map((site) => site.id),
      quantity: 1, billAmount: 0, paidAt: "", active: old.active, at: null, actor: "Dữ liệu chuyển tiếp", legacy: true })
    next.codes.push({ code: old.code, sourceId: id, at: null })
  }
  return next
}

export function voucherBenefitText(source: Pick<VoucherSource, "benefit" | "amount" | "minutes" | "windowStart" | "windowEnd">) {
  if (source.benefit === "FULL_FEE") return "Toàn bộ phí thực tế · không giới hạn số tiền"
  if (source.benefit === "AMOUNT") return `${source.amount.toLocaleString("vi-VN")} ₫ / lượt`
  if (source.benefit === "DURATION") return `Miễn ${source.minutes} phút / lượt`
  return `Miễn từ ${source.windowStart} đến ${source.windowEnd}`
}
export const voucherScope = (source: VoucherSource, access: ParkingAccess) => {
  const sites = new Set(allowedSites(access).map((site) => site.id))
  return source.sites.some((site) => sites.has(site))
}
export const canManageVoucherSource = (source: VoucherSource, access: ParkingAccess) => {
  const sites = new Set(allowedSites(access).map((site) => site.id))
  return source.sites.length > 0 && source.sites.every((site) => sites.has(site))
}

/** Issuance is a historical event: cancellation changes code status, not the number issued. */
export function issuedVoucherCodes(workspace: VoucherWorkspace, filter: RevenueFilter, access: ParkingAccess, purpose = "", unit = "") {
  const sources = new Map(workspace.sources.filter((source) => voucherScope(source, access) &&
    revenueMatches(source.recipient.estate, filter.estate) && revenueIntersects(source.sites, filter.site) &&
    revenueMatches(source.purpose, purpose) && revenueMatches(source.unit, unit)).map((source) => [source.id, source]))
  return workspace.codes.flatMap((code) => {
    const source = sources.get(code.sourceId)
    return source && code.at != null && dayAt(code.at) >= filter.start && dayAt(code.at) <= filter.end ? [{ code, source }] : []
  })
}

export function validateVoucherSource(draft: VoucherSourceDraft, workspace: VoucherWorkspace, access: ParkingAccess, original?: VoucherSource, day = dayAt(vnNow())) {
  const errors: Record<string, string> = {}
  const unit = workspace.units.find((row) => row.id === draft.unit)
  if (!unit?.active || !allowedSites(access).some((site) => site.estate === unit.estate)) errors.unit = "Chọn đơn vị đang hoạt động trong phạm vi được quản lý."
  if (!codePattern.test(draft.reference.trim())) errors.reference = "Nhập mã tham chiếu tối đa 100 ký tự, chỉ dùng chữ không dấu, số, _ và -."
  if (workspace.sources.some((row) => row.id !== original?.id && row.unit === draft.unit && row.reference.toUpperCase() === draft.reference.trim().toUpperCase())) errors.reference = "Đơn vị đã có nguồn phát hành mang mã này."
  if (!draft.name.trim() || draft.name.length > 255) errors.name = "Nhập tên nguồn phát hành, tối đa 255 ký tự."
  if (!purposes.includes(draft.purpose)) errors.purpose = "Chọn loại nghiệp vụ."
  if (!(draft.origin in voucherOrigins)) errors.origin = "Chọn nguồn phát hành hợp lệ."
  if (!(draft.benefit in voucherBenefits)) errors.benefit = "Chọn quyền lợi hợp lệ."
  if (draft.purpose === "NEGATIVE_TICKET" && draft.benefit !== "FULL_FEE") errors.benefit = "Vé âm phải bao toàn bộ phí thực tế, không có mức trần."
  if (draft.benefit === "FULL_FEE" && draft.purpose !== "NEGATIVE_TICKET") errors.benefit = "Toàn bộ phí thực tế chỉ áp dụng cho vé âm."
  if (draft.benefit === "AMOUNT" && !positive(draft.amount)) errors.amount = "Số tiền phải là số nguyên lớn hơn 0."
  if (draft.benefit === "DURATION" && (!positive(draft.minutes) || draft.minutes > 59999)) errors.minutes = "Nhập thời lượng từ 1 đến 59.999 phút."
  if (draft.benefit === "TIME_WINDOW" && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.windowStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.windowEnd) || draft.windowStart >= draft.windowEnd)) errors.windowEnd = "Khung giờ phải hợp lệ và giờ kết thúc sau giờ bắt đầu."
  if (!isDay(draft.from) || !isDay(draft.until) || draft.from > draft.until || draft.until < day) errors.until = "Chọn thời hạn hợp lệ, ngày kết thúc không trước hôm nay."
  if (!Number.isSafeInteger(draft.quantity) || draft.quantity < (original ? 0 : 1) || draft.quantity > 999) errors.quantity = original ? "Tổng số mã chưa hủy từ 0 đến 999." : "Mỗi đợt phát hành từ 1 đến 999 mã."
  const sites = allowedSites(access)
  if (!draft.sites.length || draft.sites.some((id) => !sites.some((site) => site.id === id && site.estate === unit?.estate))) errors.sites = "Chọn ít nhất một bãi thuộc khu đô thị của đơn vị và trong phạm vi được quản lý."
  if (draft.origin === "BILL" && (!isDay(draft.paidAt) || draft.paidAt > day || !positive(draft.billAmount))) errors.billAmount = "Nhập giá trị hóa đơn và ngày thanh toán hợp lệ."
  if (original) {
    if (original.unit !== draft.unit) errors.unit = "Không đổi đơn vị của nguồn đã phát hành."
    if (original.reference.trim().toUpperCase() !== draft.reference.trim().toUpperCase() || original.origin !== draft.origin) errors.reference = "Không đổi mã tham chiếu hoặc nguồn của đợt đã phát hành."
    if (workspace.applications.some((row) => row.sourceId === original.id) &&
      ["purpose", "benefit", "amount", "minutes", "windowStart", "windowEnd"].some((key) => draft[key as keyof VoucherSourceDraft] !== original[key as keyof VoucherSource]))
      errors.benefit = "Nguồn đã có lượt áp dụng; không thay đổi nghiệp vụ hoặc quyền lợi."
  }
  return errors
}

export function issueVoucherSource(workspace: VoucherWorkspace, draft: VoucherSourceDraft, access: ParkingAccess, actor: string, original?: VoucherSource, now = vnNow()): VoucherWorkspace {
  if (access.role !== "admin" && access.role !== "manager") throw new Error("Bạn không có quyền cấp voucher.")
  const errors = validateVoucherSource(draft, workspace, access, original, dayAt(now))
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
  const old = original && workspace.sources.find((row) => row.id === original.id)
  if (original && (!old || JSON.stringify(old) !== JSON.stringify(original) || !canManageVoucherSource(original, access))) throw new Error("Nguồn phát hành đã thay đổi hoặc ngoài phạm vi quyền.")
  const recipient = workspace.units.find((row) => row.id === draft.unit)!
  const source: VoucherSource = { ...draft, purpose: draft.purpose as VoucherPurpose, reference: draft.reference.trim().toUpperCase(), name: draft.name.trim(),
    id: original?.id ?? crypto.randomUUID(), recipient: original?.recipient ?? { ...recipient }, at: original ? original.at : now, actor: original?.actor ?? actor,
    ...(original?.legacy ? { legacy: true } : {}) }
  const codes = [...workspace.codes]
  const live = codes.filter((row) => row.sourceId === source.id && !row.canceled)
  const used = new Set(workspace.applications.filter((row) => row.sourceId === source.id).map((row) => row.code))
  const removable = live.filter((row) => !used.has(row.code)).reverse()
  if (source.quantity < live.length && live.length - source.quantity > removable.length) throw new Error("Không thể giảm số lượng xuống thấp hơn số mã đã có lượt áp dụng.")
  const canceled = new Set(removable.slice(0, Math.max(0, live.length - source.quantity)).map((row) => row.code))
  const updated = codes.map((row) => canceled.has(row.code) ? { ...row, canceled: { at: now, actor, reason: "Giảm số lượng phát hành" } } : row)
  for (let i = live.length; i < source.quantity; i++) updated.push({ code: `VP-${source.reference}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, sourceId: source.id, at: now })
  return { ...workspace, sources: [source, ...workspace.sources.filter((row) => row.id !== source.id)], codes: updated }
}

export function cancelVoucherCode(workspace: VoucherWorkspace, code: string, reason: string, actor: string, access: ParkingAccess, now = vnNow()) {
  const item = workspace.codes.find((row) => row.code === code)
  const source = workspace.sources.find((row) => row.id === item?.sourceId)
  if (!item || item.canceled || !source || !canManageVoucherSource(source, access) || !["admin", "manager"].includes(access.role)) throw new Error("Không thể hủy mã trong phạm vi quyền hiện tại.")
  if (workspace.applications.some((row) => row.code === code)) throw new Error("Mã đã có lượt áp dụng; xử lý tại nghiệp vụ gốc và ghi điều chỉnh sau chốt nếu cần.")
  if (!reason.trim() || reason.length > 500) throw new Error("Nhập lý do hủy từ 1 đến 500 ký tự.")
  return { ...workspace, codes: workspace.codes.map((row) => row.code === code ? { ...row, canceled: { at: now, actor, reason: reason.trim() } } : row) }
}

export function setVoucherSourceActive(workspace: VoucherWorkspace, sourceId: string, active: boolean, reason: string, actor: string, access: ParkingAccess, now = vnNow()) {
  const source = workspace.sources.find((row) => row.id === sourceId)
  if (!source || !canManageVoucherSource(source, access) || !["admin", "manager"].includes(access.role)) throw new Error("Nguồn phát hành ngoài phạm vi quyền.")
  if (!active && !reason.trim()) throw new Error("Nhập lý do ngừng phát hành.")
  if (active && !workspace.units.find((unit) => unit.id === source.unit)?.active) throw new Error("Đơn vị nhận voucher đã ngừng hoạt động.")
  const applied = new Set(workspace.applications.map((row) => row.code))
  return { ...workspace, sources: workspace.sources.map((row) => row.id === sourceId ? { ...row, active } : row), codes: workspace.codes.map((code) =>
    !active && code.sourceId === sourceId && !code.canceled && !applied.has(code.code) ? { ...code, canceled: { at: now, actor, reason: reason.trim() } } : code) }
}

export function saveVoucherUnit(workspace: VoucherWorkspace, unit: VoucherUnit, access: ParkingAccess) {
  if (!["admin", "manager"].includes(access.role) || !allowedSites(access).some((site) => site.estate === unit.estate)) throw new Error("Đơn vị nằm ngoài phạm vi quyền.")
  if (!codePattern.test(unit.id) || !unit.name.trim() || unit.name.length > 255 || !["Gian hàng", "Khối văn phòng", "Đối tác"].includes(unit.type)) throw new Error("Kiểm tra mã, tên và loại đơn vị.")
  const old = workspace.units.find((row) => row.id === unit.id)
  if (old && !allowedSites(access).some((site) => site.estate === old.estate)) throw new Error("Đơn vị nằm ngoài phạm vi quyền.")
  if (old && old.estate !== unit.estate && workspace.sources.some((source) => source.unit === unit.id)) throw new Error("Đơn vị đã có nguồn phát hành; không đổi khu đô thị.")
  if (!unit.active && workspace.sources.some((source) => source.unit === unit.id && source.active)) throw new Error("Ngừng các nguồn phát hành đang hoạt động trước khi ngừng đơn vị.")
  return { ...workspace, units: [...workspace.units.filter((row) => row.id !== unit.id), { ...unit, name: unit.name.trim(), contract: unit.contract.trim() }] }
}

/** Final lane events are immutable snapshots. Issuing a code alone never creates revenue or debt. */
export function recordVoucherApplication(workspace: VoucherWorkspace, input: Omit<VoucherApplication, "recipient" | "purpose" | "sourceName" | "benefit">): VoucherWorkspace {
  const existing = workspace.applications.find((row) => row.id === input.id)
  if (existing) {
    if (["USED", "REJECTED"].includes(existing.status)) {
      if (Object.entries(input).every(([key, value]) => existing[key as keyof VoucherApplication] === value)) return workspace
      throw new Error("Lần áp dụng đã hoàn tất; phải ghi điều chỉnh từ nghiệp vụ gốc.")
    }
    if (["code", "tripId", "site", "sourceId"].some((key) => existing[key as keyof VoucherApplication] !== input[key as keyof typeof input])) throw new Error("Không đổi định danh của lần áp dụng.")
  }
  const code = workspace.codes.find((row) => row.code === input.code)
  const source = workspace.sources.find((row) => row.id === code?.sourceId)
  if (!code || code.canceled || !source || !source.active && !existing || input.sourceId !== source.id || !source.sites.includes(input.site)) throw new Error("Voucher không hợp lệ tại bãi này.")
  const eligibilityAt = existing?.at ?? input.at, eligibilityDay = dayAt(eligibilityAt)
  if (!["APPLIED", "USED", "REJECTED"].includes(input.status) || !Number.isFinite(input.at) || existing && input.at < existing.at || code.at != null && eligibilityAt < code.at || eligibilityDay < source.from || eligibilityDay > source.until || !Number.isSafeInteger(input.amount) || input.amount < 0 || source.benefit === "AMOUNT" && input.amount > source.amount) throw new Error("Thời điểm hoặc số tiền khấu trừ không hợp lệ.")
  if (source.benefit !== "TIME_WINDOW" && workspace.applications.some((row) => row.code === input.code && row.id !== input.id && row.status !== "REJECTED")) throw new Error("Mã này chỉ được sử dụng một lần.")
  if (workspace.applications.some((row) => row.tripId === input.tripId && row.id !== input.id && row.status !== "REJECTED" && (source.purpose === "NEGATIVE_TICKET" && row.purpose === "NEGATIVE_TICKET" || row.code === input.code))) throw new Error("Lượt xe đã có voucher này hoặc một vé âm khác.")
  const application: VoucherApplication = { ...input, recipient: existing?.recipient ?? { ...source.recipient }, purpose: existing?.purpose ?? source.purpose, sourceName: existing?.sourceName ?? source.name, benefit: source.benefit }
  return { ...workspace, applications: [application, ...workspace.applications.filter((row) => row.id !== input.id)] }
}

/** Use the lane's finalized amount; the CMS does not recalculate duration or time-window benefits. */
export function applyVoucherApplications(charge: Charge, applications: VoucherApplication[]): Charge {
  const rows = applications.filter((row) => row.tripId === charge.id && row.site === charge.site && row.status === "USED")
  if (!rows.length) return charge
  const discounts = [...charge.discounts, ...rows.filter((row) => row.purpose === "VCR_DISCOUNT" && !charge.discounts.some((discount) => discount.code === row.code)).map((row) => ({ code: row.code, amount: row.amount }))]
  if (discounts.reduce((sum, row) => sum + row.amount, 0) > charge.price) throw new Error("Tổng miễn / giảm không được vượt giá niêm yết của lượt.")
  const net = Math.max(0, charge.price - discounts.reduce((sum, row) => sum + row.amount, 0))
  const funding = rows.filter((row) => row.purpose !== "VCR_DISCOUNT")
  if (funding.length > 1) throw new Error("Một lượt chỉ hỗ trợ một voucher công nợ trong bản thiết kế.")
  const applied = funding[0]
  if (applied && charge.voucher && charge.voucher.code !== applied.code) throw new Error("Lượt xe đã có voucher công nợ khác; cần đối soát tại nghiệp vụ gốc trước khi thay thế.")
  if (applied && (applied.amount > net || applied.purpose === "NEGATIVE_TICKET" && applied.amount !== net)) throw new Error("Vé âm phải khớp toàn bộ phí thực tế; voucher không được vượt phần phải thu.")
  return { ...charge, discounts, source: net === 0 && charge.price > 0 ? "FREE" : applied?.purpose === "NEGATIVE_TICKET" ? "VA" : charge.source,
    voucher: applied ? { code: applied.code, unit: applied.recipient.id, amount: applied.amount, negative: applied.purpose === "NEGATIVE_TICKET", recipient: applied.recipient } : charge.voucher }
}

export function voucherHistory(workspace: VoucherWorkspace, ledger: LedgerRow[]): VoucherApplication[] {
  const result = [...workspace.applications]
  const recorded = new Set(result.map((row) => `${row.code}/${row.tripId}/${row.site}`))
  for (const row of ledger) {
    if (!row.voucher || recorded.has(`${row.voucher.code}/${row.id}/${row.site}`)) continue
    const recipient = row.voucher.recipient ?? workspace.units.find((unit) => unit.id === row.voucher?.unit) ?? {
      id: row.voucher.unit || "UNKNOWN", estate: row.estate, name: "Chưa xác định đơn vị", type: "Chưa xác định", contract: "", active: false,
    }
    result.push({ id: `SYNC/${row.id}/${row.voucher.code}`, code: row.voucher.code, sourceId: `SYNC/${recipient.id}/${row.voucher.negative ? "VA" : "VC"}`,
      tripId: row.id, site: row.site, at: row.at, status: "USED", amount: row.debt, purpose: row.voucher.negative ? "NEGATIVE_TICKET" : "REIMBURSABLE",
      recipient: { ...recipient }, sourceName: "Voucher đồng bộ từ lượt xe", benefit: row.voucher.negative ? "FULL_FEE" : "AMOUNT" })
  }
  return result.sort((a, b) => b.at - a.at)
}

export function voucherCodeStatus(code: VoucherCode, source: VoucherSource, applications: VoucherApplication[], day = dayAt(vnNow())) {
  if (code.canceled) return "Đã hủy"
  const uses = applications.filter((row) => row.code === code.code)
  if (uses.some((row) => row.status === "USED")) return "Đã sử dụng"
  if (uses.some((row) => row.status === "APPLIED")) return "Đang áp dụng"
  if (uses.some((row) => row.status === "REJECTED")) return "Bị loại khi chốt"
  if (!source.active) return "Ngừng hoạt động"
  if (source.until < day) return "Hết hạn"
  if (source.from > day) return "Chưa hiệu lực"
  return "Chưa sử dụng"
}
