const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const jsx = require("react/jsx-runtime")
const { renderToStaticMarkup } = require("react-dom/server")
const loaded = new Map()
let controls = []
let filterSession = null
function load(name) {
  const filename = ["ts", "tsx"].map((ext) => path.resolve(__dirname, "../src", `${name}.${ext}`)).find(fs.existsSync)
  if (loaded.has(filename)) return loaded.get(filename).exports
  const compiled = new Module(filename, module)
  loaded.set(filename, compiled)
  compiled.filename = filename
  const capture = (type, props) => { if (["button", "select", "input", "form"].includes(type)) controls.push({ tag: type, ...props }) }
  compiled.require = (id) => id.startsWith("./") ? load(id.slice(2)) : id === "react/jsx-runtime" ? { ...jsx,
    jsx(type, props, key) { capture(type, props); return jsx.jsx(type, props, key) },
    jsxs(type, props, key) { capture(type, props); return jsx.jsxs(type, props, key) },
  } : id === "react" ? { ...React,
    useState(initial) {
      if (name === "RevenueFilters" && filterSession && initial && typeof initial === "object" && "estate" in initial && "start" in initial) {
        filterSession.value ??= initial
        return [filterSession.value, (next) => { filterSession.value = typeof next === "function" ? next(filterSession.value) : next }]
      }
      return React.useState(initial)
    },
    createElement(type, props, ...children) { capture(type, { ...props, children: children.length ? children : props?.children }); return React.createElement(type, props, ...children) },
  } : require(id)
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename)
  return compiled.exports
}
const vouchers = load("revenue-vouchers"), revenue = load("revenue-model"), parking = load("parking-model")
const operations = load("revenue-operations"), tables = load("revenue-tables")
const { seedTrips, readSettings } = load("parking-data")
const access = { role: "admin", estate: "" }
const now = parking.dayStart("2026-11-19") + 600
function workspace() { return vouchers.initialVoucherWorkspace(revenue.demoUnits, now) }
function draft(purpose = "NEGATIVE_TICKET", extra = {}) {
  return { name: "Đợt phát hành thử", reference: "CP-TEST-001", origin: "MANUAL", unit: "A-DV1", purpose,
    benefit: purpose === "NEGATIVE_TICKET" ? "FULL_FEE" : "AMOUNT", amount: 20000, minutes: 120,
    windowStart: "08:00", windowEnd: "17:00", from: "2026-11-18", until: "2026-12-20", sites: ["A:0"], quantity: 2,
    billAmount: 0, paidAt: "", active: true, ...extra }
}
function issue(purpose, extra) {
  const next = vouchers.issueVoucherSource(workspace(), draft(purpose, extra), access, "Test BQL", undefined, now)
  const source = next.sources[0], code = next.codes.find((row) => row.sourceId === source.id)
  return { next, source, code }
}
function event(source, code, extra = {}) { return { id: "USE-TEST", code: code.code, sourceId: source.id, tripId: "TRIP-TEST", site: "A:0", at: now + 60, status: "USED", amount: 40000, ...extra } }
function charge(extra = {}) { return { id: "TRIP-TEST", site: "A:0", vehicle: "Ô tô", at: now + 60, count: 1, price: 60000,
  source: "VL", discounts: [], payments: [], ...extra } }

test("issuing vouchers creates the requested codes, never revenue, payments, or debt", () => {
  const state = revenue.initialRevenueState(), trips = seedTrips("2026-11-19"), settings = readSettings()
  const before = revenue.totals(revenue.buildLedger(trips, settings, state), true)
  const next = vouchers.issueVoucherSource(workspace(), draft(), access, "Test BQL", undefined, now)
  const codes = next.codes.filter((code) => code.sourceId === next.sources[0].id)
  assert.equal(codes.length, 2)
  assert.equal(new Set(codes.map((code) => code.code)).size, 2)
  assert.deepEqual(revenue.totals(revenue.buildLedger(trips, settings, { ...state, voucherWorkspace: next }), true), before)
})
test("negative tickets cover the full actual fee after policy discounts and create receivables", () => {
  const { next, source, code } = issue("NEGATIVE_TICKET")
  const updated = vouchers.recordVoucherApplication(next, event(source, code))
  const row = vouchers.applyVoucherApplications(charge({ discounts: [{ code: "POLICY", amount: 20000 }] }), updated.applications)
  const money = revenue.moneyLayers(row, 10)
  assert.equal(row.source, "VA")
  assert.equal(money.revenue, 40000)
  assert.equal(money.debt, 40000)
  assert.equal(money.reduction, 20000)
  assert.equal(money.lost, 0)
  const wrong = vouchers.recordVoucherApplication(next, event(source, code, { amount: 30000 }))
  assert.throws(() => vouchers.applyVoucherApplications(charge({ discounts: [{ code: "POLICY", amount: 20000 }] }), wrong.applications), /toàn bộ phí/)
})
test("VCR-funded discounts reduce revenue; reimbursable vouchers preserve revenue and create debt", () => {
  for (const [purpose, expected] of [["VCR_DISCOUNT", { revenue: 40000, debt: 0, reduction: 20000 }], ["REIMBURSABLE", { revenue: 60000, debt: 20000, reduction: 0 }]]) {
    const { next, source, code } = issue(purpose)
    const applied = vouchers.recordVoucherApplication(next, event(source, code, { amount: 20000 }))
    const row = vouchers.applyVoucherApplications(charge({ payments: [{ id: "PAY-TEST", amount: 40000, method: "QR", status: "Thành công", at: now }] }), applied.applications)
    const money = revenue.moneyLayers(row, 10)
    for (const [key, value] of Object.entries(expected)) assert.equal(money[key], value, `${purpose}/${key}`)
    assert.equal(money.lost, 0)
  }
})
test("pending and rejected applications do not create revenue deductions or debt", () => {
  const { next, source, code } = issue("NEGATIVE_TICKET")
  const base = charge()
  for (const status of ["APPLIED", "REJECTED"]) {
    const updated = vouchers.recordVoucherApplication(next, event(source, code, { status }))
    assert.deepEqual(vouchers.applyVoucherApplications(base, updated.applications), base)
  }
})
test("finalized discount amounts cannot exceed the actual fee or be counted twice", () => {
  const { next, source, code } = issue("VCR_DISCOUNT")
  const updated = vouchers.recordVoucherApplication(next, event(source, code, { amount: 20000 }))
  assert.throws(() => vouchers.applyVoucherApplications(charge({ price: 10000 }), updated.applications), /không được vượt/)
  const once = vouchers.applyVoucherApplications(charge(), updated.applications)
  assert.deepEqual(vouchers.applyVoucherApplications(once, updated.applications), once)
})
test("finalized use is idempotent, immutable, and single-use rules reject another trip", () => {
  const { next, source, code } = issue("NEGATIVE_TICKET")
  const input = event(source, code), used = vouchers.recordVoucherApplication(next, input)
  assert.equal(vouchers.recordVoucherApplication(used, input), used)
  assert.throws(() => vouchers.recordVoucherApplication(used, { ...input, amount: 50000 }), /hoàn tất/)
  assert.throws(() => vouchers.recordVoucherApplication(used, { ...input, id: "USE-2", tripId: "TRIP-2" }), /một lần/)
  const other = used.codes.find((row) => row.sourceId === source.id && row.code !== code.code)
  assert.throws(() => vouchers.recordVoucherApplication(used, { ...input, id: "USE-2", code: other.code }), /vé âm khác/)
})
test("time-window codes allow separate trips, while repeated application to one trip is rejected", () => {
  const { next, source, code } = issue("VCR_DISCOUNT", { benefit: "TIME_WINDOW" })
  let used = vouchers.recordVoucherApplication(next, event(source, code, { amount: 15000 }))
  used = vouchers.recordVoucherApplication(used, event(source, code, { id: "USE-2", tripId: "TRIP-2", amount: 17000 }))
  assert.equal(used.applications.length, 2)
  assert.throws(() => vouchers.recordVoucherApplication(used, event(source, code, { id: "USE-3", amount: 15000 })), /voucher này/)
})
test("deactivating sources cancels only unused codes and preserves applied codes and historical amounts", () => {
  const { next, source, code } = issue("NEGATIVE_TICKET")
  const applied = vouchers.recordVoucherApplication(next, event(source, code, { status: "APPLIED" }))
  const stopped = vouchers.setVoucherSourceActive(applied, source.id, false, "Kết thúc đợt thử", "Test BQL", access, now + 120)
  assert.ok(!stopped.codes.find((row) => row.code === code.code).canceled)
  assert.equal(stopped.codes.filter((row) => row.sourceId === source.id && row.canceled).length, 1)
  const used = vouchers.recordVoucherApplication(stopped, event(source, code, { at: now + 180 }))
  assert.equal(used.applications[0].status, "USED")
  assert.throws(() => vouchers.cancelVoucherCode(used, code.code, "Hủy thử", "Test BQL", access), /đã có lượt áp dụng/)
  assert.equal(vouchers.applyVoucherApplications(charge({ discounts: [{ code: "P", amount: 20000 }] }), used.applications).voucher.amount, 40000)
})
test("quota reductions cannot cancel used codes; source financial fields lock after any use", () => {
  const { next, source, code } = issue("NEGATIVE_TICKET")
  const used = vouchers.recordVoucherApplication(next, event(source, code))
  const errors = vouchers.validateVoucherSource({ ...source, purpose: "VCR_DISCOUNT", benefit: "AMOUNT" }, used, access, source, "2026-11-19")
  assert.ok(errors.benefit)
  const reduced = vouchers.issueVoucherSource(used, { ...source, quantity: 1 }, access, "Test BQL", source, now + 120)
  assert.ok(!reduced.codes.find((row) => row.code === code.code).canceled)
  assert.equal(reduced.codes.filter((row) => row.sourceId === source.id && row.canceled).length, 1)
  const extra = vouchers.issueVoucherSource(reduced, { ...reduced.sources[0], quantity: 3 }, access, "Test BQL", reduced.sources[0], now + 180)
  assert.equal(extra.codes.filter((row) => row.sourceId === source.id && !row.canceled).length, 3)
})
test("receiving units share identities with debt and finalized use keeps the original financial snapshot", () => {
  const { next, source, code } = issue("NEGATIVE_TICKET")
  const used = vouchers.recordVoucherApplication(next, event(source, code))
  const unit = used.units.find((row) => row.id === "A-DV1")
  const renamed = vouchers.saveVoucherUnit(used, { ...unit, name: "Tên đơn vị đã cập nhật" }, access)
  assert.equal(renamed.applications[0].recipient.name, unit.name)
  assert.equal(renamed.sources[0].recipient.name, unit.name)
  assert.equal(revenue.revenueUnits({ voucherWorkspace: renamed }).find((row) => row.id === unit.id).name, "Tên đơn vị đã cập nhật")
})
test("legacy issued codes migrate once, preserving code, recipient, purpose and unknown issuance time", () => {
  const state = { vouchers: [{ code: "LEGACY-TEST", unit: "A-DV1", type: "Vé âm", amount: 0, expiry: "2026-12-20", active: true }] }
  const migrated = vouchers.normalizeVoucherWorkspace(state, revenue.demoUnits)
  const source = migrated.sources.find((row) => row.reference === "LEGACY-TEST")
  assert.equal(source.purpose, "NEGATIVE_TICKET")
  assert.equal(source.at, null)
  const again = vouchers.normalizeVoucherWorkspace({ ...state, voucherWorkspace: migrated }, revenue.demoUnits)
  assert.equal(again.codes.filter((row) => row.code === "LEGACY-TEST").length, 1)
})
test("voucher use with an unknown recipient stays visible and retains its receivable amount", () => {
  const row = { ...charge(), estate: "A", debt: 45000, voucher: { code: "UNKNOWN-UNIT-TEST", unit: "", amount: 45000, negative: true } }
  const history = vouchers.voucherHistory(workspace(), [row])
  assert.equal(history.length, 1)
  assert.equal(history[0].recipient.name, "Chưa xác định đơn vị")
  assert.equal(history[0].recipient.estate, "A")
  assert.equal(history[0].amount, 45000)
})
test("role, site, date, invoice and financial validations reject invalid issuance and use", () => {
  const ws = workspace()
  assert.throws(() => vouchers.issueVoucherSource(ws, draft(), { role: "finance", estate: "" }, "Test", undefined, now), /không có quyền/)
  assert.throws(() => vouchers.issueVoucherSource(ws, draft(), { role: "manager", estate: "B" }, "Test", undefined, now), /phạm vi/)
  for (const bad of [draft("NEGATIVE_TICKET", { benefit: "AMOUNT" }), draft("VCR_DISCOUNT", { origin: "BILL", paidAt: "", billAmount: 0 }),
    draft("VCR_DISCOUNT", { benefit: "TIME_WINDOW", windowStart: "08:99", windowEnd: "17:00" }), draft("NEGATIVE_TICKET", { sites: ["B:0"] })]) {
    assert.ok(Object.keys(vouchers.validateVoucherSource(bad, ws, access, undefined, "2026-11-19")).length > 0)
  }
  const { next, source, code } = issue("REIMBURSABLE")
  assert.throws(() => vouchers.recordVoucherApplication(next, event(source, code, { site: "B:0" })), /không hợp lệ/)
  assert.throws(() => vouchers.recordVoucherApplication(next, event(source, code, { amount: 20001 })), /số tiền/)
  assert.throws(() => vouchers.recordVoucherApplication(next, event(source, code, { at: now - 1 })), /Thời điểm/)
})
test("late completed use records an adjustment and preserves closed-shift totals", () => {
  const settings = readSettings(), trips = seedTrips("2026-11-19")
  const state = { ...revenue.initialRevenueState(), voucherWorkspace: vouchers.initialVoucherWorkspace(revenue.demoUnits, parking.dayStart("2026-11-15") + 600) }
  const before = revenue.buildLedger(trips, settings, state)
  const row = before.find((row) => row.site === "A:0" && row.revenue > 0 && !row.voucher && row.revenueDay === "2026-11-19")
  assert.ok(row)
  const source = state.voucherWorkspace.sources.find((source) => source.unit === "A-DV1" && source.purpose === "NEGATIVE_TICKET")
  const code = state.voucherWorkspace.codes.find((code) => code.sourceId === source.id)
  state.closes[row.shiftId] = { at: now, actor: "Test BPAN", note: "", frozen: {} }
  const input = event(source, code, { tripId: row.id, site: row.site, at: row.at, amount: row.revenue })
  assert.throws(() => operations.acceptRevenueVoucherApplication(state, input, trips, settings, "Test", false), /Điều chỉnh sau chốt/)
  const after = operations.acceptRevenueVoucherApplication(state, input, trips, settings, "Test", true)
  assert.equal(after.changes.length, 1)
  assert.equal(after.changes[0].delta.debt, row.revenue)
  assert.equal(revenue.buildLedger(trips, settings, after).find((item) => item.id === row.id).debt, row.debt)
  const Hub = load("RevenueVouchers").default
  const html = renderToStaticMarkup(React.createElement(Hub, { state: after, ledger: revenue.buildLedger(trips, settings, after), access,
    filter: { estate: "A", site: "A:0", vehicle: "", start: "2026-11-19", end: "2026-11-19" }, cutoff: "2026-11-19", actor: "Test",
    params: new URLSearchParams({ voucherTab: "history", q: code.code }), update() {}, navigate() {}, save() {}, notify() {}, exportFile() {}, onDirty() {} }))
  assert.ok(html.includes("Điều chỉnh sau chốt"))
  assert.ok(html.includes("Khấu trừ ghi điều chỉnh (₫)"))
  assert.ok(html.includes("1 lượt ghi điều chỉnh sau chốt riêng"))
  assert.equal(operations.acceptRevenueVoucherApplication(after, input, trips, settings, "Test", true), after)
})
test("voucher pages keep their existing entry points without a replacement hub, and accountants remain read-only", () => {
  const Hub = load("RevenueVouchers").default, SourceForm = load("RevenueVoucherSourceForm").default
  const state = revenue.initialRevenueState()
  const common = { state, ledger: [], access: { role: "finance", estate: "" }, filter: { estate: "", site: "", vehicle: "", start: "2026-11-01", end: "2026-11-30" },
    actor: "Test", params: new URLSearchParams(), update() {}, navigate() {}, save() {}, notify() {}, exportFile() {}, onDirty() {} }
  const html = renderToStaticMarkup(React.createElement(Hub, common))
  assert.ok(!html.includes('role="tablist"'))
  assert.ok(!html.includes(">Tạo voucher</button>"))
  assert.equal(revenue.revenueAccess(common.access, "revenue-voucher"), true)
  const form = renderToStaticMarkup(React.createElement(SourceForm, { workspace: workspace(), access, estate: "A", onDirty() {}, close() {}, save() {} }))
  assert.ok(form.includes("Mã hóa đơn"))
  assert.ok(form.includes("Ngày thanh toán hóa đơn"))
  assert.ok(form.includes("Quyền ưu đãi"))
  assert.ok(form.includes("Đối soát doanh thu"))
  assert.ok(form.includes("Chọn cách ghi nhận"))
  assert.equal(controls.filter((control) => control.tag === "select" && React.Children.toArray(control.children).some((child) => child?.props?.value === "NEGATIVE_TICKET")).at(-1)?.value, "")
  assert.throws(() => vouchers.issueVoucherSource(workspace(), draft("", { origin: "BILL", billAmount: 200000, paidAt: "2026-11-19" }), access, "Test", undefined, now), /loại nghiệp vụ/)
})

test("Voucher has four menus and invoice creation and edits highlight the invoice list", () => {
  const Navigation = load("VoucherNavigation").default
  const nav = load("voucher-navigation")
  assert.deepEqual(nav.voucherPages.map((page) => page.title), ["Quản lý voucher hóa đơn", "Quản lý gian hàng", "Lịch sử voucher", "Báo cáo Voucher"])
  const calls = []
  controls = []
  const html = renderToStaticMarkup(React.createElement(Navigation, { active: true, params: new URLSearchParams({ voucherEdit: "SRC-EXISTING" }), canCreate: true,
    open(patch) { calls.push(patch) } }))
  assert.ok(html.includes('aria-label="Voucher"'))
  const items = controls.filter((control) => control.className?.split(" ").includes("subnav-item"))
  assert.equal(items.length, 4)
  assert.equal(items[0]["aria-current"], "page")
  items.forEach((item) => item.onClick())
  assert.deepEqual(calls, nav.voucherPages.map((page) => nav.voucherPageParams(page.id)))
  assert.equal(nav.voucherPage(new URLSearchParams(calls[0])).id, "sources")
  assert.deepEqual(nav.voucherPageParams("create"), { voucherTab: "sources", voucherEdit: "new" })
  assert.equal(nav.voucherPage(new URLSearchParams(nav.voucherPageParams("create"))).id, "sources")
  assert.equal(nav.voucherPage(new URLSearchParams({ voucherTab: "history" })).title, "Lịch sử voucher")
  assert.equal(nav.voucherPage(new URLSearchParams({ voucherTab: "report" })).title, "Báo cáo Voucher")
  const readOnly = renderToStaticMarkup(React.createElement(Navigation, { active: false, params: new URLSearchParams(), canCreate: false, open() {} }))
  assert.ok(!readOnly.includes("Tạo voucher"))
  assert.equal(revenue.revenueMenus.find((menu) => menu.id === "revenue-voucher").group, "Voucher")
})

test("editing a source after cancellation starts from its actual code count and never silently replaces canceled codes", () => {
  const { next, source, code } = issue("NEGATIVE_TICKET")
  const canceled = vouchers.cancelVoucherCode(next, code.code, "Hủy mã thử", "Test", access, now + 1)
  const SourceForm = load("RevenueVoucherSourceForm").default
  controls = []
  renderToStaticMarkup(React.createElement(SourceForm, { original: source, workspace: canceled, access, estate: "A", onDirty() {}, close() {}, save() {} }))
  const quantity = controls.find((control) => control.tag === "input" && control.max === 999)
  assert.equal(quantity.value, 1)
  const edited = vouchers.issueVoucherSource(canceled, { ...source, name: "Chỉ đổi tên", quantity: quantity.value }, access, "Test", source, now + 2)
  assert.equal(edited.codes.length, canceled.codes.length)
  const stopped = vouchers.setVoucherSourceActive(edited, source.id, false, "Kết thúc", "Test", access, now + 3)
  const stoppedSource = stopped.sources.find((item) => item.id === source.id)
  assert.doesNotThrow(() => vouchers.issueVoucherSource(stopped, { ...stoppedSource, quantity: 0 }, access, "Test", stoppedSource, now + 4))
})

test("legacy source edits preserve unknown issuance time and do not fabricate issuance in the reporting period", () => {
  const migrated = vouchers.normalizeVoucherWorkspace({ vouchers: [{ code: "LEGACY-DATE", unit: "A-DV1", type: "Vé âm", amount: 0, expiry: "2026-12-20", active: true }] }, revenue.demoUnits)
  const source = migrated.sources.find((item) => item.reference === "LEGACY-DATE")
  const edited = vouchers.issueVoucherSource(migrated, { ...source, name: "Tên mới" }, access, "Test", source, now)
  assert.equal(edited.sources[0].at, null)
  assert.equal(edited.sources[0].legacy, true)
  assert.equal(edited.codes.find((item) => item.code === "LEGACY-DATE").at, null)
})

test("issuance reporting includes canceled codes and supplemental batches with the same exact date and permission scope", () => {
  const { next, source, code } = issue("NEGATIVE_TICKET")
  const canceled = vouchers.cancelVoucherCode(next, code.code, "Hủy mã thử", "Test", access, now + 1)
  const added = vouchers.issueVoucherSource(canceled, { ...source, quantity: 2 }, access, "Test", source, now + parking.dayMinutes)
  const filter = { estate: "A", site: "A:0", vehicle: "", start: "2026-11-19", end: "2026-11-19" }
  const initial = vouchers.issuedVoucherCodes(added, filter, access, "NEGATIVE_TICKET", source.unit)
  assert.equal(initial.length, 2)
  assert.equal(initial.filter(({ code }) => code.canceled).length, 1)
  assert.equal(vouchers.issuedVoucherCodes(added, { ...filter, start: "2026-11-20", end: "2026-11-20" }, access, "NEGATIVE_TICKET", source.unit).length, 1)
  assert.equal(vouchers.issuedVoucherCodes(added, filter, { role: "manager", estate: "B" }).length, 0)
  assert.equal(vouchers.issuedVoucherCodes(added, { ...filter, site: "A:1" }, access, "NEGATIVE_TICKET", source.unit).length, 0)
})

test("existing trip funding cannot be silently replaced, and pending events cannot finish before application", () => {
  const { next, source, code } = issue("NEGATIVE_TICKET")
  const used = vouchers.recordVoucherApplication(next, event(source, code))
  assert.throws(() => vouchers.applyVoucherApplications(charge({ voucher: { code: "OTHER", unit: "A-DV1", negative: true, amount: 60000 } }), used.applications), /đã có voucher công nợ khác/)
  const pending = vouchers.recordVoucherApplication(next, event(source, code, { status: "APPLIED" }))
  assert.throws(() => vouchers.recordVoucherApplication(pending, event(source, code, { at: now + 59 })), /Thời điểm/)
  const unknownUnit = { id: "OLD-A", name: "Đơn vị cũ", estate: "A", type: "Gian hàng", active: true, contract: "" }
  assert.throws(() => vouchers.saveVoucherUnit({ ...next, units: [...next.units, unknownUnit] }, { ...unknownUnit, estate: "B" }, { role: "manager", estate: "B" }), /ngoài phạm vi/)
})

test("receivable labels reflect actual voucher purposes and VCR discounts identify the payer", () => {
  const state = revenue.initialRevenueState(), recipient = workspace().units.find((unit) => unit.id === "A-DV1")
  const rows = [true, false].map((negative, i) => {
    const row = charge({ id: `DEBT-${i}`, price: 20000, voucher: { code: `D-${i}`, unit: recipient.id, recipient, amount: 20000, negative } })
    return { ...row, ...revenue.moneyLayers(row, 10), estate: "A", revenueDay: "2026-11-19" }
  })
  const debt = tables.balances(rows, rows, state, "2026-11-19")[0]
  assert.equal(tables.debtRow(debt)["Loại voucher"], "Vé âm · Thu lại tiền")
  const { next, source, code } = issue("VCR_DISCOUNT")
  const used = vouchers.recordVoucherApplication(next, event(source, code, { amount: 20000 }))
  const discounted = { ...rows[0], source: "VL", discounts: [{ code: code.code, amount: 20000 }] }
  assert.equal(tables.discountRows([discounted], { ...state, voucherWorkspace: used })[0].data["Bên chịu chi phí"], "VCR")
})

test("changing the voucher estate clears dependent unit, source and detail filters", () => {
  controls = []
  const calls = [], filter = { estate: "A", site: "", vehicle: "", start: "2026-11-18", end: "2026-11-19" }
  const multi = load("RevenueMultiFilter"), original = multi.default, fields = []
  multi.default = (props) => { fields.push(props); return React.createElement(original, props) }
  filterSession = {}
  const render = () => { controls = []; return renderToStaticMarkup(React.createElement(load("RevenueFilters").default, { screen: "revenue-voucher", filter, cutoff: "2026-11-19", access,
    params: new URLSearchParams({ voucherTab: "history", voucherUnit: "A-DV1", voucherSource: "SOURCE-A" }), state: revenue.initialRevenueState(), ledger: [], update(patch) { calls.push(patch) } })) }
  try {
  render()
  fields.find((field) => field.label === "Khu đô thị").change("B")
  assert.equal(calls.length, 0)
  assert.ok(render().includes("Chưa áp dụng"))
  controls.find((control) => control.tag === "form").onSubmit({ preventDefault() {} })
  assert.equal(calls[0].estate, "B")
  for (const key of ["site", "unit", "voucherUnit", "voucherSource", "voucherDetail"]) assert.equal(calls[0][key], null)
  } finally { filterSession = null; multi.default = original }
})

test("issuance totals open the exact issued-code list, including canceled codes", () => {
  const { next, source, code } = issue("NEGATIVE_TICKET")
  const ws = vouchers.cancelVoucherCode(next, code.code, "Giữ lịch sử hủy", "Test", access, now + 1)
  const common = { state: { ...revenue.initialRevenueState(), voucherWorkspace: ws }, ledger: [], access,
    filter: { estate: "A", site: "A:0", vehicle: "", start: "2026-11-19", end: "2026-11-19" }, cutoff: "2026-11-19", actor: "Test",
    params: new URLSearchParams({ voucherTab: "report", voucherUnit: source.unit, voucherPurpose: source.purpose }),
    navigate() {}, save() {}, notify() {}, exportFile() {}, onDirty() {} }
  const calls = []
  controls = []
  renderToStaticMarkup(React.createElement(load("RevenueVouchers").default, { ...common, update(patch) { calls.push(patch) } }))
  const links = controls.filter((control) => control.className === "parking-link")
  assert.equal(links.length, 2)
  links[0].onClick()
  assert.equal(calls[0].voucherIssued, "NEGATIVE_TICKET")
  const html = renderToStaticMarkup(React.createElement(load("RevenueVouchers").default, { ...common,
    params: new URLSearchParams({ ...Object.fromEntries(common.params), voucherIssued: "NEGATIVE_TICKET" }), update() {} }))
  assert.ok(html.includes(code.code))
  assert.ok(html.includes("Giữ lịch sử hủy"))
  assert.ok(html.includes("2 mã theo ngày cấp"))
})

test("revenue navigation has two entry points and debt belongs to Voucher without granting voucher-creation access", () => {
  assert.deepEqual(revenue.revenueMenus.filter((item) => item.group === "Quản lý doanh thu").map((item) => item.id), ["revenue-lookup", "revenue-close"])
  assert.equal(revenue.revenueMenus.find((item) => item.id === "revenue-debt").group, "Voucher")
  const Navigation = load("VoucherNavigation").default, calls = []
  controls = []
  const html = renderToStaticMarkup(React.createElement(Navigation, { active: false, params: new URLSearchParams(), canCreate: false, canBrowse: false,
    open() {}, debt: { active: true, open() { calls.push("debt") } } }))
  assert.ok(html.includes("Công nợ voucher"))
  assert.ok(!html.includes("Tạo voucher"))
  assert.ok(!html.includes("Quản lý voucher hóa đơn"))
  controls.find((item) => item["aria-current"] === "page").onClick()
  assert.deepEqual(calls, ["debt"])
  assert.equal(revenue.revenueWrite({ role: "finance", estate: "" }, "payment"), false)
  assert.equal(revenue.revenueWrite({ role: "manager", estate: "A" }, "payment"), true)
})

test("source-document panels keep their dates and searches separate and preserve legacy source URLs", () => {
  const entry = load("revenue-entry")
  const parent = new URLSearchParams({ source: "VA", amount: "debt", q: "LX-123", start: "2026-11-18", end: "2026-11-19", origin: "REPORT", entry_q: "OLD" })
  const filter = { estate: "A", site: "A:0", vehicle: "Ô tô", start: "2026-11-18", end: "2026-11-19" }
  const patch = entry.openRevenueEntry(parent, filter, "receipt", true, "2026-11-25")
  assert.equal(patch.entry_start, "2026-11-19")
  assert.equal(patch.entry_end, "2026-11-25")
  assert.equal(patch.entry_q, null)
  for (const key of ["start", "end", "q", "source", "amount", "origin"]) assert.equal(patch[key], undefined)
  assert.deepEqual(entry.updateRevenueEntry({ start: "2026-11-25", q: "PAPER-1", page: null }), { entry_start: "2026-11-25", entry_q: "PAPER-1", entry_page: null })
  const opened = new URLSearchParams({ ...Object.fromEntries(parent), ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value != null)) })
  assert.equal(entry.revenueEntryParams(opened).get("end"), "2026-11-25")
  assert.ok(Object.keys(entry.closeRevenueEntry(opened)).every((key) => key.startsWith("entry")))
  const legacy = entry.revenueEntryRedirect("revenue-paper", new URLSearchParams({ start: "2026-11-20", end: "2026-11-21", q: "IMPORT-OLD", site: "A:0", inputStatus: "Đã hủy" }))
  assert.equal(legacy.entryPanel, "history")
  assert.equal(legacy.entry_start, "2026-11-20")
  assert.equal(legacy.entry_q, "IMPORT-OLD")
  assert.equal(legacy.entry_inputStatus, "Đã hủy")
  assert.equal(legacy.start, undefined)
  assert.equal(entry.revenueEntryRedirect("revenue-lookup", parent), null)
  const paper = entry.openRevenueEntry(parent, filter, "paper", true, "2026-11-25")
  assert.equal(paper.entryPanel, "history")
  assert.equal(paper.entryAction, null)
  assert.equal(paper.entry_start, filter.start)
  assert.equal(paper.entry_end, filter.end)
  const oldAdjustments = new URLSearchParams({ tab: "adjustments", q: "QR-LATE", start: filter.start, end: filter.end, changeDate: "origin" })
  assert.equal(entry.revenueEntryKind(oldAdjustments), "history")
  assert.equal(entry.revenueEntryParams(oldAdjustments).get("q"), "QR-LATE")
  assert.equal(entry.closeRevenueEntry(oldAdjustments).tab, null)
  const history = entry.revenueHistoryParams(filter, "QR-LATE", "origin")
  assert.equal(history.entryPanel, "history")
  assert.equal(history.entry_q, "QR-LATE")
  assert.equal(history.entry_changeDate, "origin")
  assert.equal(history.entry_start, filter.start)
})

test("source actions and direct panel links respect existing read and write permissions", () => {
  const { RevenueSourceActions, default: Documents } = load("RevenueSourceDocuments")
  const forRole = (role) => renderToStaticMarkup(React.createElement(RevenueSourceActions, { access: { role, estate: "" }, open() {} }))
  assert.ok(!forRole("security").includes("Nhập vé giấy"))
  assert.ok(!forRole("security").includes("Lập phiếu thu cấp thẻ"))
  assert.ok(forRole("customer").includes("Lập phiếu thu cấp thẻ"))
  assert.ok(!forRole("customer").includes("Nhập vé giấy"))
  assert.ok(forRole("finance").includes("Chứng từ và lịch sử"))
  assert.ok(!forRole("finance").includes("Lập phiếu thu cấp thẻ"))
  const denied = renderToStaticMarkup(React.createElement(Documents, { access: { role: "security", estate: "" }, params: new URLSearchParams({ entryPanel: "receipt", entryAction: "new" }), update() {} }))
  assert.ok(denied.includes("Bạn không có quyền truy cập"))
  assert.ok(!denied.includes("Lập phiếu thu"))
  const readOnly = renderToStaticMarkup(React.createElement(Documents, { access: { role: "manager", estate: "A" }, params: new URLSearchParams({ entryPanel: "receipt", entryAction: "new" }), update() {} }))
  assert.ok(readOnly.includes("Bạn không có quyền truy cập"))
  assert.ok(!readOnly.includes("Tải lên file vé giấy"))
})

test("shared history retains late records and canceled receipts without exposing paper import, respecting original and recording dates", () => {
  const Documents = load("RevenueSourceDocuments").default
  const state = revenue.initialRevenueState(), at = parking.dayStart("2026-11-25") + 600
  state.papers = [{ id: "PAPER-LATE", actor: "Test", at, canceled: "Hủy đợt kiểm tra", rows: [{ site: "A:0", vehicle: "Ô tô", day: "2026-11-19", shift: "Ca 1", from: 1, to: 2, amount: 50000, method: "Tiền mặt" }] }]
  state.receipts = [{ id: "RECEIPT-CANCELED", actor: "Test", at, site: "A:0", vehicle: "Ô tô", customer: "Khách thử", plate: "30A-12345", card: "CARD-1", kind: "Cấp lần đầu", amount: 50000, method: "Tiền mặt", note: "", canceled: "Hủy phiếu thử" }]
  state.changes = [
    { id: "CHANGE-LATE", reference: "QR-LATE", site: "A:0", estate: "A", recorded: "2026-11-25", origin: "2026-11-19", reason: "Xác nhận thanh toán muộn", actor: "Test", delta: revenue.totals([]) },
    { id: "CHANGE-OTHER", reference: "QR-OTHER", site: "B:0", estate: "B", recorded: "2026-11-25", origin: "2026-11-19", reason: "Khác khu", actor: "Test", delta: revenue.totals([]) },
  ]
  const original = JSON.stringify(state)
  const common = { state, ledger: [], trips: [], parking: readSettings(), access, filter: { estate: "A", site: "A:0", vehicle: "Ô tô", start: "2026-11-18", end: "2026-11-19" },
    cutoff: "2026-11-24", actor: "Test", update() {}, navigate() {}, save() {}, notify() {}, exportFile() {}, operations: load("operations-model").seedOperations() }
  const params = { entryPanel: "history", entry_estate: "A", entry_site: "A:0", entry_start: "2026-11-25", entry_end: "2026-11-25" }
  const paper = renderToStaticMarkup(React.createElement(Documents, { ...common, params: new URLSearchParams(params) }))
  assert.ok(paper.includes("QR-LATE"))
  assert.ok(!paper.includes("QR-OTHER"))
  assert.ok(paper.includes("Ngày ghi nhận"))
  assert.ok(paper.includes("overlay-drawer"))
  assert.ok(!paper.includes("Chỉ tiêu đối chiếu"))
  assert.ok(!paper.includes("Phương tiện"))
  const byOriginal = renderToStaticMarkup(React.createElement(Documents, { ...common, params: new URLSearchParams({ ...params, entry_start: "2026-11-19", entry_end: "2026-11-19", entry_changeDate: "origin" }) }))
  assert.ok(byOriginal.includes("QR-LATE"))
  const byRecording = renderToStaticMarkup(React.createElement(Documents, { ...common, params: new URLSearchParams({ ...params, entry_start: "2026-11-19", entry_end: "2026-11-19" }) }))
  assert.ok(!byRecording.includes("QR-LATE"))
  const receipt = renderToStaticMarkup(React.createElement(Documents, { ...common, params: new URLSearchParams({ ...params, entryPanel: "receipt" }) }))
  assert.ok(receipt.includes("RECEIPT-CANCELED"))
  assert.ok(receipt.includes("Hủy phiếu thử"))
  const create = renderToStaticMarkup(React.createElement(Documents, { ...common, params: new URLSearchParams({ ...params, entryPanel: "paper", entryAction: "new" }) }))
  assert.ok(!create.includes("Tải lên file vé giấy"))
  assert.ok(create.includes("Lịch sử ghi nhận"))
  assert.equal((create.match(/role="dialog"/g) || []).length, 1)
  assert.ok(!create.includes('aria-label="Hồ sơ nguồn thu"'))
  const newReceipt = renderToStaticMarkup(React.createElement(Documents, { ...common, params: new URLSearchParams({ ...params, entryPanel: "receipt", entryAction: "new" }) }))
  assert.equal((newReceipt.match(/role="dialog"/g) || []).length, 1)
  assert.ok(newReceipt.includes("Lập phiếu thu cấp thẻ"))
  assert.equal(JSON.stringify(state), original)
})

test("report debt links preserve scope, recipient and the payment cutoff in the Voucher debt view", () => {
  const { revenueDebtPatch } = load("revenue-lookup"), Debt = load("RevenueOperations").RevenueDebt
  const state = revenue.initialRevenueState(), recipient = workspace().units.find((unit) => unit.id === "A-DV1")
  const fee = charge({ price: 60000, voucher: { code: "VA-REPORT", unit: recipient.id, recipient, amount: 60000, negative: true } })
  const row = { ...fee, ...revenue.moneyLayers(fee, 10), estate: "A", revenueDay: "2026-11-19" }
  state.payments = [{ id: "PAY-BEFORE", unit: recipient.id, amount: 20000, day: "2026-11-20", at: now, document: "DOC-BEFORE" },
    { id: "PAY-AFTER", unit: recipient.id, amount: 10000, day: "2026-11-25", at: now + 1, document: "DOC-AFTER" }]
  const filter = { estate: "A", site: "A:0", vehicle: "Ô tô", start: "2026-11-19", end: "2026-11-19" }
  const patch = revenueDebtPatch(filter, { label: "Còn nợ", unit: recipient.id, amount: "debtRemaining" }, "2026-11-24")
  assert.equal(patch.unit, recipient.id)
  assert.equal(patch.site, "A:0")
  assert.equal(patch.debtPeriod, "1")
  assert.equal(patch.debtAsOf, "2026-11-24")
  const params = new URLSearchParams(Object.entries(patch).filter(([, value]) => value != null))
  const html = renderToStaticMarkup(React.createElement(Debt, { state, ledger: [row], access, filter, cutoff: "2026-11-24", actor: "Test", params,
    update() {}, save() {}, notify() {}, exportFile() {} }))
  assert.ok(html.includes("Voucher còn nợ đối chiếu: 40.000 ₫"))
  assert.ok(html.includes("24/11/2026"))
  assert.ok(!html.includes(">Ghi nhận thanh toán</button>"))
  assert.equal(revenueDebtPatch(filter, { label: "Thất thu", amount: "lost" }, "2026-11-24"), null)
  assert.equal(revenueDebtPatch(filter, { label: "Nguồn có công nợ", amount: "debt", source: "VA" }, "2026-11-24"), null)
})

test("the complete demo is idempotent, preserves edits, and connects voucher uses to balanced revenue", () => {
  const { withRevenueDemo } = load("revenue-demo")
  const at = parking.dayStart("2026-11-25") + 720, settings = readSettings()
  const original = revenue.initialRevenueState()
  original.receipts.push({ id: "USER-RECEIPT", at, customer: "Dữ liệu đã có", amount: 12345, site: "A:0", vehicle: "Ô tô", plate: "", card: "USER-CARD", previous: "", kind: "Cấp lần đầu", reason: "", method: "Tiền mặt", note: "" })
  const before = JSON.stringify(original), demo = withRevenueDemo(original, at, settings)
  assert.equal(JSON.stringify(original), before)
  assert.ok(demo.demoCharges.length >= 100)
  assert.equal(demo.receipts.find((row) => row.id === "USER-RECEIPT").amount, 12345)
  assert.equal(withRevenueDemo(demo, at + 1440, settings), demo)
  const edited = { ...demo, payments: demo.payments.map((row, i) => i ? row : { ...row, canceled: "Người dùng đã hủy" }) }
  assert.equal(withRevenueDemo(edited, at, settings), edited)
  const ledger = revenue.buildLedger([], settings, demo)
  assert.ok(ledger.length > 100)
  for (const row of ledger) {
    assert.equal(row.revenue, row.gross - row.reduction, row.id)
    assert.equal(row.revenue, row.net + row.vat, row.id)
    assert.equal(row.revenue, row.collected + row.debt + row.lost - row.excess, row.id)
    assert.ok(Number.isFinite(row.revenue))
  }
  for (const source of ["VG", "CT", "MT", "VA", "FREE"]) assert.ok(ledger.some((row) => row.source === source), source)
  for (const app of demo.voucherWorkspace.applications) {
    const code = demo.voucherWorkspace.codes.find((code) => code.code === app.code)
    const source = demo.voucherWorkspace.sources.find((source) => source.id === app.sourceId)
    assert.ok(code.at <= app.at, app.code)
    assert.ok(source.at <= code.at, app.code)
    if (app.status === "USED") assert.ok(ledger.some((row) => row.id === app.tripId))
  }
  assert.ok(demo.voucherWorkspace.applications.some((row) => row.status === "APPLIED"))
  assert.ok(demo.voucherWorkspace.applications.some((row) => row.status === "REJECTED"))
  assert.ok(demo.changes.length > 0)
  assert.ok(Object.keys(demo.closes).length > 20)
  assert.ok(Object.keys(demo.periods).length > 0)
  const owed = tables.balances(ledger, ledger, demo, demo.demoAnchor)
  assert.ok(owed.some((row) => row.remaining === 0 && row.paid > 0))
  assert.ok(owed.some((row) => row.remaining > 0 && row.paid > 0))
  assert.ok(owed.some((row) => row.overdue > 0))
  assert.ok(owed.some((row) => row.name === "Chưa xác định đơn vị"))
  assert.ok(demo.papers.some((row) => row.canceled))
  assert.ok(demo.receipts.some((row) => row.canceled))
  assert.ok(demo.payments.some((row) => row.canceled))
  const visibleSources = demo.voucherWorkspace.sources.filter((source) => source.at != null && parking.dayAt(source.at) >= "2026-11-19" && parking.dayAt(source.at) <= "2026-11-25")
  for (const purpose of ["NEGATIVE_TICKET", "REIMBURSABLE", "VCR_DISCOUNT"]) assert.ok(visibleSources.some((source) => source.purpose === purpose && demo.voucherWorkspace.applications.some((app) => app.sourceId === source.id && app.status === "USED")), purpose)
})

test("multi-selection matches a union within each filter and an intersection between filters", () => {
  const { withRevenueDemo } = load("revenue-demo"), values = load("revenue-filter-values")
  const state = withRevenueDemo(revenue.initialRevenueState(), parking.dayStart("2026-11-25") + 720)
  const ledger = revenue.buildLedger([], readSettings(), state), end = state.demoAnchor
  const filter = { estate: "A|B", site: "A:0|B:1", vehicle: "Ô tô|Xe máy", start: parking.shiftDay(end, -6), end }
  const selected = revenue.scopeRows(ledger, filter, access)
  assert.ok(selected.length > 0)
  assert.ok(selected.every((row) => ["A", "B"].includes(row.estate) && ["A:0", "B:1"].includes(row.site) && ["Ô tô", "Xe máy"].includes(row.vehicle)))
  assert.ok(selected.some((row) => row.estate === "A"))
  assert.ok(selected.some((row) => row.estate === "B"))
  const limited = revenue.scopeRows(ledger, filter, { role: "manager", estate: "A" })
  assert.ok(limited.every((row) => row.estate === "A"))
  const lookup = load("revenue-lookup").selectRevenueLookup(ledger, state, filter, access, end, new URLSearchParams({ source: "VA|VG" }))
  assert.ok(lookup.list.length > 0)
  assert.ok(lookup.list.every((row) => ["VA", "VG"].includes(row.source)))
  assert.deepEqual(values.revenueValues("A|B|A"), ["A", "B"])
  const issued = vouchers.issuedVoucherCodes(state.voucherWorkspace, { ...filter, site: "" }, access, "NEGATIVE_TICKET|REIMBURSABLE")
  assert.ok(issued.length > 0)
  assert.ok(issued.every(({ source }) => ["A", "B"].includes(source.recipient.estate) && ["NEGATIVE_TICKET", "REIMBURSABLE"].includes(source.purpose)))
})
