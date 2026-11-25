const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")
const loaded = new Map()
function load(name) {
  if (name.endsWith(".css")) return {}
  const filename = ["ts", "tsx"].map((ext) => path.resolve(__dirname, "../src", `${name}.${ext}`)).find(fs.existsSync)
  if (loaded.has(filename)) return loaded.get(filename).exports
  const compiled = new Module(filename, module)
  loaded.set(filename, compiled); compiled.filename = filename
  compiled.require = (id) => id.startsWith("./") ? load(id.slice(2)) : require(id)
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename)
  return compiled.exports
}
const model = load("voucher-baseline"), parking = load("parking-model")
const access = { role: "admin", estate: "" }, actor = "BQL"
const now = parking.dayStart("2026-11-25") + 600
function seed() { return model.initialVoucherBaseline(now) }
function draft(state, extra = {}) {
  const merchant = state.merchants.find((row) => row.active)
  return { ...model.benefitDefaults, id: "", merchant: merchant.id, reference: "BILL-TEST", name: "Ưu đãi thử", sites: [...merchant.sites],
    paid: now - 5, bill: 150000, guests: 2, from: now, until: now + 1440, quota: 3, active: true, created: now, updated: now,
    windowStart: "2026-11-25T10:00", windowEnd: "2026-11-25T22:00", ...extra }
}
test("the original voucher baseline has all three benefits and never adds revenue-purpose fields", () => {
  const state = seed()
  assert.deepEqual(Object.keys(model.voucherKinds), ["AMOUNT", "DURATION", "TIME_WINDOW"])
  assert.ok(state.merchants.length >= 6)
  assert.ok(state.sources.length > 30 && state.codes.length > 100)
  assert.ok(state.templates.every((row) => row.name.length <= 20))
  assert.ok(state.codes.some((row) => row.canceled))
  assert.ok(state.uses.some((row) => row.status === "APPLIED") && state.uses.some((row) => row.status === "REJECTED"))
  for (const row of [...state.sources, ...state.merchants]) for (const field of ["purpose", "payer", "negative", "contract", "type"]) assert.ok(!(field in row), field)
  assert.ok(model.voucherStorageKey !== load("revenue-model").revenueStorageKey)
})
test("bill validation retains invoice, guest, quota, datetime, benefit and permission rules", () => {
  const state = seed()
  const saved = model.saveBill(state, draft(state), access, actor, now)
  const bill = saved.sources.at(-1)
  assert.equal(model.sourceCodes(saved, bill.id).length, 3)
  for (const extra of [{ quota: 0 }, { quota: 1000 }, { guests: -1 }, { paid: now + 1 }, { from: now - 20 }, { until: now - 1 }, { name: "X".repeat(21) }, { sites: [] }, { kind: "AMOUNT", amount: 0 }, { minutes: 60 }]) {
    assert.throws(() => model.saveBill(state, draft(state, extra), access, actor, now), JSON.stringify(extra))
  }
  assert.throws(() => model.saveBill(saved, draft(saved), access, actor, now), /đã có hóa đơn/)
  assert.throws(() => model.saveBill(state, draft(state), { ...access, role: "finance" }, actor, now), /quyền/)
  assert.throws(() => model.saveBill(saved, { ...bill, merchant: state.merchants[1].id }, access, actor, now), /gian hàng|mã hóa đơn/)
})
test("changing a bill updates unused codes, preserves applied-code snapshots and refuses excess quota reductions", () => {
  let state = seed()
  state = model.saveBill(state, draft(state), access, actor, now)
  const bill = state.sources.at(-1), [used, unused] = model.sourceCodes(state, bill.id)
  state = { ...state, uses: [...state.uses, { id: "USE", code: used.id, site: used.sites[0], session: "LX", plate: "30A-123.45", at: now, status: "APPLIED" }] }
  const snapshot = JSON.stringify(used)
  const saved = model.saveBill(state, { ...bill, quota: 2, hours: 3 }, access, actor, now)
  assert.equal(JSON.stringify(saved.codes.find((row) => row.id === used.id)), snapshot)
  assert.equal(model.sourceCodes(saved, bill.id).filter((row) => !row.canceled).length, 2)
  assert.ok(model.sourceCodes(saved, bill.id).some((row) => !row.canceled && row.id !== used.id && row.benefit.hours === 3))
  assert.throws(() => model.saveBill(state, { ...bill, kind: "AMOUNT", amount: 20000 }, access, actor, now), /không đổi loại/)
  const exhausted = { ...state, uses: [...state.uses, ...model.sourceCodes(state, bill.id).filter((row) => row.id !== used.id).map((row) => ({ id: row.id, code: row.id, site: row.sites[0], session: "X", plate: "P", at: now, status: "USED", discount: 10000 }))] }
  assert.throws(() => model.saveBill(exhausted, { ...bill, quota: 1 }, access, actor, now), /Không đủ voucher/)
})
test("canceling codes or deactivating a merchant preserves issued history and never regenerates canceled codes", () => {
  const state = seed(), merchant = state.merchants.find((row) => row.active)
  const original = JSON.stringify(state)
  const code = state.codes.find((row) => model.codeUnused(state, row, now))
  assert.throws(() => model.cancelCode(state, code, "", access, actor, now), /lý do/)
  const canceled = model.cancelCode(state, code, "Khách trả hàng", access, actor, now)
  assert.equal(canceled.codes.length, state.codes.length)
  assert.throws(() => model.cancelCode(canceled, code, "Ghi đè", access, actor, now), /Chỉ hủy/)
  const applied = state.codes.find((row) => model.codeUses(state, row.id).length)
  assert.throws(() => model.cancelCode(state, applied, "Không được", access, actor, now), /Chỉ hủy/)
  const inactive = model.saveMerchant(state, { ...merchant, active: false }, access, actor, now)
  assert.equal(inactive.codes.length, state.codes.length)
  assert.ok(inactive.codes.filter((row) => row.source && state.sources.find((source) => source.id === row.source)?.merchant === merchant.id && model.codeUnused(state, row, now)).every((row) => row.canceled))
  assert.deepEqual(inactive.uses, state.uses)
  const reactivated = model.saveMerchant(inactive, merchant, access, actor, now + 1)
  assert.deepEqual(reactivated.codes, inactive.codes)
  assert.equal(JSON.stringify(state), original, "actions are immutable")
})
test("merchant templates keep defaults, local-time validity, multi-lot scope and independent lifecycle", () => {
  let state = seed(), merchant = state.merchants.find((row) => row.active)
  const template = state.templates.find((row) => row.merchant === merchant.id && row.kind === "AMOUNT")
  state = model.saveTemplate(state, { ...template, isDefault: true }, access, now)
  assert.equal(state.templates.filter((row) => row.merchant === merchant.id && row.isDefault).length, 1)
  assert.throws(() => model.saveTemplate(state, { ...template, active: false }, access, now), /mặc định/)
  const future = { ...template, start: "12:00", duration: 48 }
  const applied = model.applyTemplate(draft(state), future, now)
  assert.equal(applied.from, parking.dayStart("2026-11-25") + 720)
  assert.equal(applied.until - applied.from, 48 * 60)
  assert.deepEqual(applied.sites, template.sites)
  assert.equal(model.usageText("TIME_WINDOW"), "Nhiều lần")
  assert.equal(model.usageText("DURATION"), "Một lần")
  const removed = model.removeTemplate(state, template, access)
  assert.deepEqual(removed.sources, state.sources)
  assert.deepEqual(removed.codes, state.codes)
  assert.equal(removed.templates.length, state.templates.length - 1)
  const moved = model.saveMerchant(state, { ...merchant, sites: [parking.allowedSites(access)[1].id] }, access, actor, now)
  assert.deepEqual(moved.merchants.find((row) => row.id === merchant.id).sites, [parking.allowedSites(access)[1].id])
})
test("history retains unused codes and combines code/application filters independently with issuance-time filters", () => {
  const state = seed(), scope = model.readVoucherScope(new URLSearchParams({ vbFrom: "2026-11-19", vbTo: "2026-11-25" }), "history", "2026-11-25")
  const all = model.selectVoucherHistory(state, scope, access, now)
  assert.ok(all.some((row) => !row.use), "unused and canceled codes remain visible")
  const selected = model.selectVoucherHistory(state, { ...scope, status: "NEW", application: "USED|APPLIED" }, access, now)
  assert.ok(selected.length > 0)
  assert.ok(selected.every((row) => !row.code.canceled && ["USED", "APPLIED"].includes(row.use?.status)))
  const sample = selected[0]
  assert.ok(model.selectVoucherHistory(state, { ...scope, session: sample.use.session }, access, now).every((row) => row.use?.session === sample.use.session))
  const oldBill = state.sources.find((row) => row.created < parking.dayStart(scope.from))
  const laterCode = { ...state.codes.find((row) => row.source === oldBill.id), id: "LATER-ISSUE", value: "LATER-ISSUE", created: now }
  const later = model.selectVoucherHistory({ ...state, codes: [...state.codes, laterCode] }, scope, access, now)
  assert.ok(later.some((row) => row.code.id === laterCode.id), "new batches of older bills are filtered by code issue time")
})
test("all report groups reconcile issued codes including cancellations and actual finalized deductions", () => {
  const state = seed(), scope = model.readVoucherScope(new URLSearchParams({ vbFrom: "2026-11-19", vbTo: "2026-11-25" }), "report", "2026-11-25")
  const sources = model.selectVoucherSources(state, { ...scope, from: "", to: "" }, access)
  const all = model.voucherStats(state, sources, scope.from, scope.to, now)
  assert.ok(all.issued > 0 && all.discount > 0)
  assert.equal(all.issued, state.codes.filter((row) => parking.dayAt(row.created) >= scope.from && parking.dayAt(row.created) <= scope.to).length)
  assert.equal(all.discount, all.uses.reduce((sum, row) => sum + row.discount, 0))
  const byMerchant = state.merchants.map((merchant) => model.voucherStats(state, sources.filter((row) => row.merchant === merchant.id), scope.from, scope.to, now))
  const byType = Object.keys(model.voucherKinds).map((kind) => model.voucherStats(state, sources.filter((row) => row.kind === kind), scope.from, scope.to, now))
  for (const key of ["issued", "used", "discount", "benefitAmount", "benefitMinutes"]) {
    assert.equal(byMerchant.reduce((sum, row) => sum + row[key], 0), all[key], key)
    assert.equal(byType.reduce((sum, row) => sum + row[key], 0), all[key], key)
  }
  assert.ok(all.uses.length >= all.used, "repeat time-window use is retained without counting the same code twice")
})
test("the five original screens retain their original fields and shared design-system controls", () => {
  const state = seed(), stored = new Map([[model.voucherStorageKey, JSON.stringify(state)]])
  global.localStorage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) }
  const Management = load("VoucherManagement").default
  const render = (params, role = "admin") => renderToStaticMarkup(React.createElement(Management, {
    access: { ...access, role }, params: new URLSearchParams({ vbFrom: "2026-11-19", vbTo: "2026-11-25", ...params }), update() {}, exportFile() {}, actor, notify() {}, onDirty() {},
  }))
  const units = render({ voucherTab: "units" })
  for (const label of ["Mã gian hàng", "Tên gian hàng", "Ghi chú", "Bãi xe", "Trạng thái", "Tạo gian hàng", "Tùy chỉnh cột"]) assert.ok(units.includes(label), label)
  for (const label of ["Loại đơn vị", "Hợp đồng / vị trí", "Xem công nợ"]) assert.ok(!units.includes(label), label)
  const create = render({ voucherEdit: "new" })
  assert.ok(render({ voucherTab: "sources" }).includes("Tạo voucher"), "creation remains available from the invoice list")
  for (const label of ["Mã hóa đơn", "Số lượng khách", "Gian hàng", "Mẫu voucher", "Tên voucher", "Ngày giờ thanh toán", "Giá trị bill", "Số lượng voucher phát hành", "Loại voucher", "Chế độ sử dụng", "Bãi xe áp dụng", "Chế độ xem trước", "Lịch sử phát hành"]) assert.ok(create.includes(label), label)
  for (const label of ["Đối soát doanh thu", "Loại nghiệp vụ", "Bên chịu chi phí", "Vé âm"]) assert.ok(!create.includes(label), label)
  const merchant = render({ voucherTab: "units", merchantEdit: state.merchants[0].id })
  for (const label of ["Thông tin gian hàng", "Danh sách mẫu voucher", "Thêm mẫu voucher", "Đặt làm mặc định", "Chế độ sử dụng"]) assert.ok(merchant.includes(label), label)
  const history = render({ voucherTab: "history" })
  for (const label of ["Trạng thái mã", "Trạng thái sử dụng", "Ngày phát hành", "Thời gian hiệu lực", "Bill ID", "Biển số", "ID lượt gửi", "Khấu trừ"]) assert.ok(history.includes(label), label)
  const overview = render({ voucherTab: "report" })
  for (const label of ["Tổng quan", "Theo gian hàng", "Theo loại voucher", "Tổng voucher phát hành", "Tổng quyền ưu đãi", "Hết hạn chưa dùng", "Biến động voucher theo ngày"]) assert.ok(overview.includes(label), label)
  assert.ok(render({ voucherTab: "report", vbReport: "merchant" }).includes("Phân bố theo gian hàng"))
  assert.ok(render({ voucherTab: "report", vbReport: "type" }).includes("Báo cáo chi tiết theo ngày"))
  assert.ok(!render({ voucherTab: "units" }, "finance").includes("Tạo gian hàng"))
  assert.ok(!render({ voucherTab: "sources" }, "finance").includes("Tạo voucher"))
  assert.ok(!render({ voucherEdit: "new" }, "finance").includes("Số lượng voucher phát hành"))
  assert.ok(create.includes("parking-form-grid") && history.includes("lookup-filter-panel"), "existing design-system form and filter classes are reused")
})
test("Voucher has four sidebar entries and keeps creation in the invoice list; debt links stay separate", () => {
  const Navigation = load("VoucherNavigation").default
  const html = renderToStaticMarkup(React.createElement(Navigation, { active: true, canCreate: true, canBrowse: true, params: new URLSearchParams(), open() {}, debt: { active: false, open() {} } }))
  for (const label of ["Quản lý voucher hóa đơn", "Quản lý gian hàng", "Lịch sử voucher", "Báo cáo Voucher"]) assert.ok(html.includes(label), label)
  assert.ok(!html.includes("Tạo voucher"))
  assert.ok(!html.includes("Công nợ voucher"))
  const module = fs.readFileSync(path.resolve(__dirname, "../src/Revenue.tsx"), "utf8")
  assert.ok(module.includes('<VoucherManagement access={access}'))
  assert.ok(module.includes('screen === "revenue-debt" && <RevenueDebt'))
})
