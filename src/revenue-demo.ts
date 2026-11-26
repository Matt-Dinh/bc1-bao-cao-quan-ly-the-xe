import { estates } from "./data"
import { allowedSites, dayAt, dayStart, daysIn, goLive, shiftDay, siteById, vnNow } from "./parking-model"
import type { ParkingSettings, Trip } from "./parking-model"
import { readSettings } from "./parking-data"
import { buildLedger, defaultSapConfigs, deltaFor, monthEnd, revenueCutoff, revenueShifts, revenueVoucherWorkspace } from "./revenue-model"
import type { Charge, Closing, LedgerRow, RevenueState } from "./revenue-model"
import type { VoucherApplication, VoucherSource, VoucherUnit } from "./revenue-vouchers"

export const revenueDemoVersion = 4
const actor = "BQL · Dữ liệu minh họa"
const merge = <T,>(existing: T[], added: T[], key: (row: T) => string) => {
  const ids = new Set(existing.map(key))
  return [...existing, ...added.filter((row) => !ids.has(key(row)))]
}

/** Add one coherent demonstration dataset without replacing user-created or edited records. */
export function withRevenueDemo(state: RevenueState, now = vnNow(), settings: ParkingSettings = readSettings()): RevenueState {
  if (state.demoVersion === revenueDemoVersion) return state
  const anchor = revenueCutoff(state, "", now), today = dayAt(now)
  const workspace = revenueVoucherWorkspace(state)
  const units: VoucherUnit[] = estates.flatMap((estate) => [
    { id: `DEMO-${estate.id}-SHOP`, estate: estate.id, name: `Highlands Coffee · ${estate.short}`, type: "Gian hàng", contract: `DEMO-HD-${estate.id}-101`, active: true },
    { id: `DEMO-${estate.id}-OFFICE`, estate: estate.id, name: `Văn phòng An Phát · ${estate.short}`, type: "Khối văn phòng", contract: `DEMO-HD-${estate.id}-102`, active: true },
    { id: `DEMO-${estate.id}-PARTNER`, estate: estate.id, name: `Đối tác sự kiện Minh Anh · ${estate.short}`, type: "Đối tác", contract: `DEMO-HD-${estate.id}-103`, active: true },
    { id: `DEMO-${estate.id}-STOPPED`, estate: estate.id, name: `Gian hàng đã ngừng · ${estate.short}`, type: "Gian hàng", contract: `DEMO-HD-${estate.id}-099`, active: false },
  ])
  const sources: VoucherSource[] = [], applications: VoucherApplication[] = [], charges: Charge[] = []
  const codes: typeof workspace.codes = []
  const sourceFor = (unit: VoucherUnit, suffix: string, purpose: VoucherSource["purpose"], benefit: VoucherSource["benefit"], extra: Partial<VoucherSource> = {}) => {
    const source: VoucherSource = { id: `DEMO-SRC-${unit.estate}-${suffix}`, reference: `DEMO-${unit.estate}-${suffix}`, name: `${suffix === "VA" ? "Vé âm khách mua sắm" : suffix === "VC" ? "Tài trợ phí gửi xe sự kiện" : "Ưu đãi khách gian hàng"} · ${unit.name}`,
      unit: unit.id, recipient: { ...unit }, origin: purpose === "VCR_DISCOUNT" ? "BILL" : "MANUAL", purpose, benefit, amount: benefit === "AMOUNT" ? 20000 : 0,
      minutes: benefit === "DURATION" ? 120 : 0, windowStart: "09:00", windowEnd: "21:00", from: shiftDay(anchor, -60), until: shiftDay(today, 30),
      sites: allowedSites({ role: "admin", estate: unit.estate }).map((site) => site.id), quantity: 12,
      billAmount: purpose === "VCR_DISCOUNT" ? 550000 : 0, paidAt: shiftDay(anchor, -5), active: unit.active,
      at: dayStart(shiftDay(anchor, -6)) + 540, actor, ...extra }
    sources.push(source)
    for (let i = 0; i < source.quantity; i++) codes.push({ code: `${source.reference}-${String(i + 1).padStart(3, "0")}`, sourceId: source.id, at: source.at,
      ...(i === 11 || !source.active ? { canceled: { at: dayStart(anchor) + 600, actor, reason: "Hủy mã chưa dùng trong đợt minh họa" } } : {}) })
    return source
  }
  const makeCharge = (id: string, site: string, day: string, price: number, paid: number, source: Charge["source"] = "VL", discounts: Charge["discounts"] = []): Charge => {
    const at = dayStart(day) + 660
    const trip: Trip = { id, site, vehicle: "Ô tô", group: "Vãng lai", plate: `30A-${10000 + charges.length}`, ticket: `DEMO-THE-${charges.length + 1}`, owner: "Khách minh họa", phone: "", entered: at - 150, exited: at,
      laneIn: "Làn vào 1", laneOut: "Làn ra 1", sourceIn: "Làn tự động", sourceOut: "Làn tự động", due: price, paid, voucher: 0 }
    return { id, site, vehicle: "Ô tô", at, price, count: 1, source, discounts, payments: paid ? [{ id: `DEMO-GD-${id}`, at, method: charges.length % 2 ? "QR" : "Tiền mặt", amount: paid, status: "Thành công" }] : [], trip,
      description: "Lượt xe minh họa phục vụ đối soát doanh thu" }
  }
  for (const estate of estates) {
    const shop = units.find((unit) => unit.id === `DEMO-${estate.id}-SHOP`)!, office = units.find((unit) => unit.id === `DEMO-${estate.id}-OFFICE`)!, partner = units.find((unit) => unit.id === `DEMO-${estate.id}-PARTNER`)!
    const programs = [sourceFor(shop, "VA", "NEGATIVE_TICKET", "FULL_FEE"), sourceFor(partner, "VC", "REIMBURSABLE", "AMOUNT"),
      sourceFor(shop, "MONEY", "VCR_DISCOUNT", "AMOUNT"), sourceFor(shop, "TIME", "VCR_DISCOUNT", "DURATION"), sourceFor(shop, "WINDOW", "VCR_DISCOUNT", "TIME_WINDOW")]
    sourceFor(shop, "EXPIRED", "VCR_DISCOUNT", "AMOUNT", { name: `Ưu đãi đã hết hạn · ${estate.short}`, until: shiftDay(anchor, -1) })
    sourceFor(shop, "UPCOMING", "VCR_DISCOUNT", "DURATION", { name: `Ưu đãi sắp có hiệu lực · ${estate.short}`, from: shiftDay(today, 2) })
    sourceFor(units.find((unit) => unit.id === `DEMO-${estate.id}-STOPPED`)!, "STOPPED", "VCR_DISCOUNT", "AMOUNT")
    const older = sourceFor(office, "OLD-VA", "NEGATIVE_TICKET", "FULL_FEE", { name: `Vé âm kỳ trước · ${estate.short}`, at: dayStart(shiftDay(anchor, -50)) + 540 })
    const use = (source: VoucherSource, index: number, day: string, price: number, amount: number, paid: number, discounts: Charge["discounts"] = []) => {
      const id = `DEMO-LX-${estate.id}-${source.reference}-${index}`, row = makeCharge(id, `${estate.id}:${index % 3}`, day, price, paid, "VL", discounts)
      const code = codes.filter((code) => code.sourceId === source.id)[index]
      applications.push({ id: `DEMO-USE-${id}`, sourceId: source.id, code: code.code, tripId: id, site: row.site, at: row.at,
        status: "USED", amount, purpose: source.purpose, benefit: source.benefit, recipient: { ...source.recipient }, sourceName: source.name })
      charges.push(row)
    }
    for (let i = 0; i < 7; i++) {
      const day = shiftDay(anchor, i - 6)
      // Codes must exist before the lane event, including uses on the first day of the reporting week.
      use(programs[0], i, day, 60000, 50000, 0, [{ code: "CS-02", amount: 10000 }])
      use(programs[1], i, day, 50000, 20000, 30000)
      use(programs[2], i, day, 40000, 20000, 20000)
      use(programs[3], i, day, 50000, 25000, 25000)
      use(programs[4], i, day, 60000, 60000, 0)
    }
    use(older, 0, shiftDay(anchor, -40), 90000, 90000, 0)
    use(older, 1, shiftDay(anchor, -35), 120000, 120000, 0)
    for (const [status, index] of [["APPLIED", 8], ["REJECTED", 9]] as const) {
      const source = programs[2], code = codes.filter((code) => code.sourceId === source.id)[index]
      applications.push({ id: `DEMO-${estate.id}-${status}`, code: code.code, sourceId: source.id, tripId: `DEMO-LX-${estate.id}-${status}`, site: `${estate.id}:0`, at: dayStart(anchor) + 780,
        status, amount: 15000, purpose: source.purpose, recipient: { ...source.recipient }, sourceName: source.name, benefit: source.benefit, reason: status === "REJECTED" ? "Không đáp ứng điều kiện hóa đơn" : undefined })
    }
    charges.push({ ...makeCharge(`DEMO-MT-${estate.id}`, `${estate.id}:0`, anchor, 100000, 100000, "MT"), trip: undefined, description: "Biên bản mất thẻ minh họa · thu phí cấp lại" })
  }
  charges.push({ ...makeCharge("DEMO-VA-UNKNOWN", "A:0", anchor, 35000, 0, "VA"), voucher: { code: "DEMO-VA-CHO-DOI-SOAT", unit: "", amount: 35000, negative: true }, description: "Vé âm đang chờ xác định đơn vị nhận · minh họa" })
  // A recent issuance cohort is visible under the default calendar-date filter too.
  // Keep the earlier cohort intact: it explains uses on the first days of the revenue week.
  for (const original of [...sources].filter((source) => !source.id.endsWith("OLD-VA"))) {
    const issuedAt = Math.min(dayStart(shiftDay(anchor, -1)) + 540, dayStart(original.until) + 540)
    const source = { ...original, id: `${original.id}-RECENT`, reference: `${original.reference}-R`, name: `${original.name} · Đợt mới`, at: issuedAt, quantity: 3 }
    sources.push(source)
    for (let i = 0; i < 3; i++) codes.push({ sourceId: source.id, code: `${source.reference}-${i + 1}`, at: issuedAt,
      ...(!source.active || i === 2 && source.until >= today ? { canceled: { at: dayStart(anchor) + 600, actor, reason: "Hủy mã dự phòng trong đợt minh họa" } } : {}) })
    if (!source.active || source.from > anchor || source.until < anchor) continue
    const amount = source.purpose === "NEGATIVE_TICKET" ? 50000 : source.benefit === "DURATION" ? 25000 : source.benefit === "TIME_WINDOW" ? 60000 : 20000
    const price = source.purpose === "NEGATIVE_TICKET" ? 60000 : source.purpose === "REIMBURSABLE" || source.benefit === "DURATION" ? 50000 : source.benefit === "TIME_WINDOW" ? 60000 : 40000
    const row = makeCharge(`DEMO-LX-${source.reference}`, source.sites[0], anchor, price, source.purpose === "NEGATIVE_TICKET" ? 0 : price - amount, "VL", source.purpose === "NEGATIVE_TICKET" ? [{ code: "CS-02", amount: 10000 }] : [])
    charges.push(row)
    applications.push({ id: `DEMO-USE-${source.reference}`, code: `${source.reference}-1`, sourceId: source.id, tripId: row.id, site: row.site, at: row.at, status: "USED", amount,
      purpose: source.purpose, benefit: source.benefit, recipient: { ...source.recipient }, sourceName: source.name })
  }
  const papers = estates.flatMap((estate, i) => [0, 1, 2].map((offset) => ({ id: `DEMO-NVG-${estate.id}-${offset}`, actor: "BPAN · Dữ liệu minh họa", at: dayStart(shiftDay(today, -offset)) + 540,
    rows: [{ site: `${estate.id}:${offset}`, day: shiftDay(anchor, -offset), shift: "", vehicle: (offset % 2 ? "Xe máy" : "Ô tô") as "Ô tô" | "Xe máy", from: 900000 + i * 10000 + offset * 100, to: 900019 + i * 10000 + offset * 100, amount: offset % 2 ? 100000 : 400000, method: "Tiền mặt" as const }],
    ...(offset === 2 ? { canceled: "Đã nhập nhầm đợt, hủy để nhập lại · minh họa" } : {}) })))
  const receipts = estates.flatMap((estate) => [0, 1, 2].map((offset) => ({ id: `DEMO-PT-${estate.id}-${offset}`, actor: "CSKH · Dữ liệu minh họa", at: dayStart(shiftDay(anchor, -offset)) + 900,
    site: `${estate.id}:${offset}`, vehicle: "Ô tô" as const, customer: ["Nguyễn Minh Anh", "Trần Hải Nam", "Lê Thu Hà"][offset], contract: `DEMO-TB-${estate.id}-${offset}`, plate: `30A-${80000 + offset}`, card: `DEMO-CARD-${estate.id}-${offset}`,
    previous: offset ? `DEMO-CARD-OLD-${estate.id}-${offset}` : "", kind: offset ? "Cấp lại" : "Cấp lần đầu", reason: offset ? "Mất thẻ" : "", amount: offset ? 100000 : 50000,
    method: offset ? "QR" as const : "Tiền mặt" as const, note: "Phiếu thu minh họa, không cấp hoặc khóa thẻ thực tế trong kho",
    ...(offset === 2 ? { canceled: "Khách chưa nhận thẻ, hủy phiếu minh họa" } : {}) })))
  const payments = units.filter((unit) => unit.active).flatMap((unit) => {
    const amount = unit.type === "Gian hàng" ? 350000 : unit.type === "Khối văn phòng" ? 60000 : 0
    return [{ id: `DEMO-TT-${unit.id}`, unit: unit.id, amount: amount || 30000, day: anchor, document: `DEMO-UNC-${unit.id}`, month: "", note: "Thanh toán công nợ minh họa", actor,
      at: dayStart(anchor) + 840, ...(!amount ? { canceled: "Hủy chứng từ nhập sai, giữ lại để minh họa lịch sử" } : {}) }]
  })
  payments.push(...units.filter((unit) => unit.active && unit.type === "Gian hàng").map((unit) => ({ id: `DEMO-TT-RECENT-${unit.id}`, unit: unit.id, amount: 50000, day: anchor,
    document: `DEMO-UNC-RECENT-${unit.id}`, month: "", note: "Thanh toán phần vé âm đợt mới · minh họa", actor, at: dayStart(anchor) + 900 })))
  const upgradedConfigs = state.configs.map((config) => {
    const sap = defaultSapConfigs[config.estate]
    if (!sap) return config
    const isLegacyPlaceholder = (!config.mall && !config.company) || config.company === "VCR"
    return isLegacyPlaceholder ? { ...config, ...sap } : config
  })
  let next: RevenueState = { ...state, configs: upgradedConfigs, demoVersion: revenueDemoVersion, demoAnchor: anchor,
    voucherWorkspace: { ...workspace, units: merge(workspace.units, units, (row) => row.id), sources: merge(workspace.sources, sources, (row) => row.id), codes: merge(workspace.codes, codes, (row) => row.code), applications: merge(workspace.applications, applications, (row) => row.id) },
    demoCharges: merge(state.demoCharges ?? [], charges, (row) => row.id), papers: merge(state.papers, papers, (row) => row.id), receipts: merge(state.receipts, receipts, (row) => row.id), payments: merge(state.payments, payments, (row) => row.id),
    policies: merge(state.policies, [{ ...state.policies[0], code: "DEMO-CS-OLD", name: "Ưu đãi sự kiện đã kết thúc", from: shiftDay(anchor, -50), until: shiftDay(anchor, -8), active: false, note: "Chính sách minh họa đã ngừng" }], (row) => row.code) }
  const ledger = buildLedger([], settings, next), closes: Record<string, Closing> = { ...next.closes }
  const close = (site: string, day: string) => {
    for (const shift of revenueShifts(site, day, settings, next)) if (!closes[shift.id]) closes[shift.id] = { at: dayStart(shiftDay(day, 1)) + 420, actor: "BPAN · Dữ liệu minh họa", note: "Khớp sổ chốt ca · minh họa", frozen: Object.fromEntries(ledger.filter((row) => row.shiftId === shift.id && row.id.startsWith("DEMO-")).map((row) => [row.id, row])) }
  }
  for (const site of allowedSites({ role: "admin", estate: "" })) for (const offset of [-5, -4, -3]) close(site.id, shiftDay(anchor, offset))
  for (const estate of estates) {
    const shift = revenueShifts(`${estate.id}:0`, anchor, settings, next)[0]
    if (shift && !closes[shift.id]) closes[shift.id] = { at: dayStart(shiftDay(anchor, 1)) + 420, actor: "BPAN · Dữ liệu minh họa", note: "Đã đối chiếu tiền mặt · minh họa", frozen: Object.fromEntries(ledger.filter((row) => row.shiftId === shift.id && row.id.startsWith("DEMO-")).map((row) => [row.id, row])) }
  }
  const previousMonth = shiftDay(`${anchor.slice(0, 7)}-01`, -1).slice(0, 7)
  if (`${previousMonth}-01` >= goLive && !next.periods[`A/${previousMonth}`]) {
    for (const day of daysIn(`${previousMonth}-01`, monthEnd(previousMonth))) for (const site of allowedSites({ role: "admin", estate: "A" })) close(site.id, day)
    next = { ...next, periods: { ...next.periods, [`A/${previousMonth}`]: { at: dayStart(`${anchor.slice(0, 7)}-01`) + 600, actor: "Kế toán · Dữ liệu minh họa", note: "Kỳ kế toán minh họa đã chốt", frozen: {} } } }
  }
  next = { ...next, closes }
  const late = ledger.find((row) => row.id.startsWith("DEMO-LX-A-") && row.revenueDay === shiftDay(anchor, -3) && row.debt > 0)
  if (late) {
    const adjusted: LedgerRow = { ...late, lost: late.lost + 5000, debt: late.debt - 5000 }
    next = { ...next, changes: merge(next.changes, [{ id: "DEMO-DC-001", recorded: anchor, origin: late.revenueDay, estate: late.estate, site: late.site, reference: late.id,
      reason: "Đối soát lại phần voucher được tài trợ sau chốt · minh họa", actor: "Kế toán · Dữ liệu minh họa", delta: deltaFor(late, adjusted) }], (row) => row.id) }
  }
  return { ...next, audit: merge(next.audit, [{ at: dayStart(anchor) + 960, actor, action: "Khởi tạo dữ liệu minh họa doanh thu và voucher", scope: "", detail: "Nguồn voucher, sử dụng, vé giấy, phiếu thu, thanh toán, chốt ca/kỳ và điều chỉnh minh họa." },
    ...next.configs.map((config) => ({ at: dayStart(shiftDay(anchor, -10)) + 540, actor: "Kế toán · Dữ liệu minh họa", action: "Sửa cấu hình doanh thu", scope: config.estate,
      detail: JSON.stringify({ before: { ...config, overdue: 45 }, after: config }) })),
    { at: dayStart(shiftDay(anchor, -8)) + 600, actor: "Ban vận hành · Dữ liệu minh họa", action: "Ngừng chính sách miễn / giảm", scope: "", detail: "DEMO-CS-OLD · Kết thúc đợt ưu đãi minh họa" },
  ], (row) => `${row.at}/${row.action}/${row.scope}`) }
}
