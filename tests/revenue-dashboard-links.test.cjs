const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const jsx = require("react/jsx-runtime")
const { renderToStaticMarkup } = require("react-dom/server")

let buttons = [], chartKeys = [], popup = null
const loaded = new Map()
function load(name) {
  const filename = ["tsx", "ts"].map((ext) => path.resolve(__dirname, "../src", `${name}.${ext}`)).find(fs.existsSync)
  if (loaded.has(filename)) return loaded.get(filename).exports
  const compiled = new Module(filename, module)
  loaded.set(filename, compiled)
  const capture = (type, props) => {
    if (type === "button" && props?.onClick && !props.disabled) buttons.push(props)
    if (type === "circle" && props?.role === "button") chartKeys.push(props)
  }
  compiled.filename = filename
  compiled.require = (id) => {
    if (id.startsWith("./")) return load(id.slice(2))
    if (id === "react") return { ...React,
      createElement(type, props, ...children) { capture(type, props); return React.createElement(type, props, ...children) },
      ...(name === "RevenueDashboard" ? { useState(initial) {
        return React.useState(initial === null ? popup : initial === false ? true : initial)
      } } : {}),
    }
    if (id === "react/jsx-runtime") return { ...jsx,
      jsx(type, props, key) { capture(type, props); return jsx.jsx(type, props, key) },
      jsxs(type, props, key) { capture(type, props); return jsx.jsxs(type, props, key) },
    }
    return require(id)
  }
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename)
  return compiled.exports
}
global.window = { location: { search: "?module=revenue-report&vehicle=Ô+tô" } }
const model = load("revenue-model")
const parking = load("parking-model")
const { readSettings, seedTrips } = load("parking-data")
const lookup = load("revenue-lookup")
const tables = load("revenue-tables")
const Dashboard = load("RevenueDashboard").default
const Filters = load("RevenueFilters").default
const state = model.initialRevenueState(), settings = readSettings()
const ledger = model.buildLedger(seedTrips("2026-11-19"), settings, state)
const filter = { estate: "", site: "", vehicle: "Ô tô", start: "2026-11-12", end: "2026-11-18" }
function paramsFor(patch) { return new URLSearchParams(Object.entries({ ...patch, ...(patch.debtMeasure ? { amount: patch.debtMeasure } : {}) }).filter(([, value]) => value != null && value !== "")) }
function render(extra = {}) {
  buttons = []; chartKeys = []
  const calls = []
  const html = renderToStaticMarkup(React.createElement(Dashboard, {
    ledger, state, parking: settings, filter, access: parking.demoAccess, cutoff: filter.end, actor: "Admin", exportFile() {},
    navigate(patch, screen, preserve) { calls.push({ patch, screen, preserve }) }, ...extra,
  }))
  return { html, calls }
}
function select(patch) {
  const scope = { ...filter, ...Object.fromEntries(["estate", "site", "vehicle", "start", "end"].filter((key) => key in patch).map((key) => [key, patch[key] || ""])) }
  return lookup.selectRevenueLookup(ledger, state, scope, parking.demoAccess, filter.end, paramsFor(patch))
}
test("all six KPI handlers open the appropriate revenue or voucher-debt view and reconcile to the displayed amount", () => {
  popup = null
  const { calls } = render()
  const kpis = buttons.filter((button) => button.className?.includes("summary-card"))
  assert.equal(kpis.length, 6)
  const selected = model.scopeRows(ledger, filter, parking.demoAccess)
  const totals = model.totals(selected)
  const expected = [totals.revenue, totals.paid, tables.balances(ledger, selected, state, filter.end).reduce((n, row) => n + row.remaining, 0),
    totals.lost, model.totals(selected, true).reduction, tables.subscriptionRow("", model.subscriptionRevenue("2026-11", filter, parking.demoAccess))["Doanh thu (₫)"]]
  for (const [index, button] of kpis.entries()) {
    button.onClick()
    const { patch, screen, preserve } = calls.at(-1)
    assert.equal(screen, patch.debtMeasure ? "revenue-debt" : "revenue-lookup")
    assert.equal(preserve, false)
    assert.equal(patch.origin, window.location.search)
    assert.equal(patch.drill, null)
    assert.equal(patch.vehicle, filter.vehicle)
    assert.equal(patch.start, filter.start)
    const result = select(patch)
    const actual = result.subscriptions ? result.subscriptions.reduce((n, row) => n + result.subscriptionValue(row), 0)
      : result.list.reduce((n, row) => n + result.valueFor(row), 0)
    assert.equal(actual, expected[index], button.children[0].props.children)
  }
})
test("each daily payment segment preserves its day and method and includes all vehicle types", () => {
  popup = null
  const sample = model.scopeRows(ledger, filter, parking.demoAccess)[0]
  const payment = { id: "VINCLUB", at: sample.at, method: "VinClub", amount: 123000, status: "Thành công" }
  const extra = { ...sample, id: "VINCLUB-ROW", source: "VL", voucher: undefined, price: payment.amount, discounts: [], payments: [payment],
    ...model.moneyLayers({ price: payment.amount, discounts: [], payments: [payment] }, 10) }
  const fixture = [...ledger, extra]
  const { calls } = render({ ledger: fixture })
  const all = model.scopeRows(fixture, filter, parking.demoAccess, false)
  for (const method of [...model.methods, "Voucher"]) {
    const segment = buttons.find((button) => button["aria-label"]?.includes(` · ${method} · `))
    assert.ok(segment, method)
    segment.onClick()
    const { patch } = calls.at(-1)
    assert.equal(patch.vehicle, "")
    assert.equal(patch.start, patch.end)
    assert.equal(patch.debtMeasure || patch.amount, method === "Voucher" ? "debt" : `${method} (₫)`)
    const result = lookup.selectRevenueLookup(fixture, state, { ...filter, vehicle: "", start: patch.start, end: patch.end }, parking.demoAccess, filter.end, paramsFor(patch))
    assert.ok(result.list.every((row) => row.revenueDay === patch.start))
    const dayTotal = model.totals(all.filter((row) => row.revenueDay === patch.start))
    const expected = method === "Voucher" ? dayTotal.debt : dayTotal.moneyByMethod[model.methods.indexOf(method)]
    assert.equal(result.list.reduce((n, row) => n + result.valueFor(row), 0), expected)
  }
})
test("chart labels, bar values, and segments navigate, while all seven detail popups remain available", () => {
  popup = null
  const { calls } = render()
  assert.equal(buttons.filter((button) => button.className?.includes("parking-chart-footer")).length, 7)
  for (const className of ["revenue-bar-name", "revenue-bar-value"]) {
    const items = buttons.filter((button) => button.className === className)
    for (const label of ["gross", "reduction", "revenue", "paid", "debt", "lost"].map((key) => model.amountLabels[key]))
      assert.ok(items.some((item) => className === "revenue-bar-name" ? item.children === label : item["aria-label"]?.startsWith(`${label} · Tổng `)), label)
    for (const day of model.daysFor(filter.start, filter.end)) {
      const label = day.slice(8) + "/" + day.slice(5, 7)
      assert.ok(items.some((item) => className === "revenue-bar-name" ? item.children === label : item["aria-label"]?.startsWith(`${label} · Tổng `)), day)
    }
    for (const item of items) {
      item.onClick()
      const { patch, screen } = calls.at(-1)
      assert.equal(screen, patch.debtMeasure ? "revenue-debt" : "revenue-lookup")
      const result = select(patch)
      assert.ok(result.subscriptions || result.list.every((row) => parking.allowedSites(parking.demoAccess).some((site) => site.id === row.site)))
    }
  }
})
test("every popup continues to render and dispatch ordinary URL filters for numeric links", () => {
  // Server rendering portals needs a small DOM stub; inspect popup element trees through an Overlay substitute.
  const ui = load("ui"), original = ui.Overlay
  ui.Overlay = ({ children }) => React.createElement("div", null, children)
  try {
    for (popup = 0; popup < 7; popup++) {
      const { html, calls } = render()
      assert.ok(html.includes("parking-table"), `popup ${popup}`)
      const links = buttons.filter((button) => button.className === "parking-link")
      for (const link of links) link.onClick()
      assert.ok(calls.length > 0, `popup ${popup} has lookup links`)
      assert.ok(calls.every((call) => call.screen === (call.patch.debtMeasure ? "revenue-debt" : "revenue-lookup") && call.patch.drill === null))
      assert.ok(calls.every((call) => !["gross", "net", "vat"].includes(call.patch.amount)), "PRD keeps price and VAT cells read-only in detail popups")
    }
  } finally { ui.Overlay = original; popup = null }
})

test("daily trend points and ranked loss reasons reconcile to their exact lookup totals", () => {
  popup = null
  const { calls } = render()
  const points = buttons.filter((button) => button.className === "revenue-trend-point")
  assert.equal(points.length, model.daysFor(filter.start, filter.end).length)
  const all = model.scopeRows(ledger, filter, parking.demoAccess, false)
  for (const point of points) {
    point.onClick()
    const { patch } = calls.at(-1)
    assert.equal(patch.vehicle, "")
    assert.equal(patch.start, patch.end)
    const result = select(patch)
    const amounts = model.totals(all.filter((row) => row.revenueDay === patch.start))
    assert.equal(result.list.reduce((sum, row) => sum + result.valueFor(row), 0), amounts.collected + amounts.debt)
  }
  const losses = buttons.filter((button) => button.className === "revenue-loss-row")
  const scope = model.scopeRows(ledger, filter, parking.demoAccess)
  assert.equal(losses.length, model.lossReasons.filter((reason) => model.totals(scope.filter((row) => row.reason === reason)).lost > 0).length)
  for (const loss of losses) {
    loss.onClick()
    const { patch } = calls.at(-1)
    assert.equal(patch.amount, "lost")
    const result = select(patch)
    assert.equal(result.list.reduce((sum, row) => sum + result.valueFor(row), 0), model.totals(scope.filter((row) => row.reason === patch.reason)).lost)
  }
})

test("discount donut groups voucher codes by source, bounds long lists, and preserves every monetary drill including Other", () => {
  const { discountChartGroups, topDiscountGroups } = load("revenue-charts")
  const sample = model.scopeRows(ledger, filter, parking.demoAccess)[0]
  const row = (id, discounts) => ({ ...sample, id, source: "VL", voucher: undefined, price: 1000000, discounts, payments: [],
    ...model.moneyLayers({ price: 1000000, discounts, payments: [] }, 10) })
  const fixture = [row("TWO-CODES", [{ code: "GROUP-A1", amount: 20000 }, { code: "GROUP-A2", amount: 30000 }]),
    row("SAME-NAME-OTHER-SOURCE", [{ code: "GROUP-B", amount: 40000 }]),
    ...Array.from({ length: 8 }, (_, i) => row(`POLICY-${i}`, [{ code: `UNKNOWN-${i}`, amount: 1000 * (i + 1) }]))]
  const application = (code, sourceId) => ({ code, sourceId, purpose: "VCR_DISCOUNT", sourceName: "Cùng tên chương trình", recipient: { name: "Gian hàng A" } })
  const input = { ...state, voucherWorkspace: { ...state.voucherWorkspace, applications: [application("GROUP-A1", "A"), application("GROUP-A2", "A"), application("GROUP-B", "B")] } }
  const groups = discountChartGroups(fixture, input)
  assert.equal(groups.length, 10, "different source identities are never merged by display name")
  const combined = groups.find((group) => group.key === "voucher/A")
  assert.equal(combined.value, 50000)
  assert.equal(combined.count, 1, "a trip with two voucher codes counts once")
  assert.deepEqual([...combined.codes].sort(), ["GROUP-A1", "GROUP-A2"])
  const visible = topDiscountGroups(groups)
  assert.equal(visible.length, 6)
  const expectedTotal = model.totals(fixture, true).reduction
  assert.equal(visible.reduce((sum, item) => sum + item.value, 0), expectedTotal)
  assert.deepEqual(visible.flatMap((item) => item.codes).sort(), groups.flatMap((item) => item.codes).sort())
  popup = null
  const { calls } = render({ ledger: fixture, state: input })
  const legends = buttons.filter((button) => button.className === "revenue-donut-row")
  assert.equal(legends.length, 6)
  assert.equal(chartKeys.length, 6)
  for (const [index, button] of legends.entries()) {
    button.onClick()
    const { patch } = calls.at(-1)
    assert.equal(patch.policy, visible[index].codes.join("|"))
    const result = lookup.selectRevenueLookup(fixture, input, filter, parking.demoAccess, filter.end, paramsFor(patch))
    assert.equal(result.list.reduce((sum, row) => sum + result.valueFor(row), 0), visible[index].value)
    for (const key of ["Enter", " "]) {
      let prevented = false
      chartKeys[index].onKeyDown({ key, preventDefault() { prevented = true } })
      assert.ok(prevented)
      assert.deepEqual(calls.at(-1).patch, patch)
    }
  }
  const center = buttons.find((button) => button.className === "revenue-donut-total")
  center.onClick()
  const total = lookup.selectRevenueLookup(fixture, input, filter, parking.demoAccess, filter.end, paramsFor(calls.at(-1).patch))
  assert.equal(total.list.reduce((sum, row) => sum + total.valueFor(row), 0), expectedTotal)
  buttons = []
  const changes = []
  const other = visible.at(-1).codes.join("|")
  const html = renderToStaticMarkup(React.createElement(Filters, { screen: "revenue-lookup", filter, cutoff: filter.end,
    access: parking.demoAccess, params: paramsFor({ ...filter, policy: other, amount: "reduction" }), state: input, ledger: fixture,
    update(value) { changes.push(value) } }))
  assert.ok(html.includes(`${visible.at(-1).codes.length} mã chính sách / voucher`))
  const chip = buttons.find((button) => button.title === visible.at(-1).codes.join(", "))
  assert.ok(chip, "the compact chip retains all code identities in its tooltip")
  chip.onClick()
  assert.equal(changes[0].policy, null)
  assert.equal(changes[0].amount, "reduction")
})

test("empty financial charts remain explicit and do not create actionable amounts", () => {
  const { html } = render({ ledger: [], filter: { ...filter, end: filter.start } })
  assert.ok(html.includes("Chưa phát sinh miễn / giảm"))
  assert.ok(html.includes("Chưa phát sinh thất thu trong kỳ"))
  assert.equal(buttons.filter((button) => button.className === "revenue-donut-total").length, 0)
  assert.equal(chartKeys.length, 0)
})
test("legacy drill links expose their actual site, vehicle override, day, and method as editable filters", () => {
  const params = paramsFor({ ...filter, drill: JSON.stringify({ label: "QR", site: "A:0", vehicle: "*", day: "2026-11-15", amount: "QR (₫)" }) })
  const result = lookup.selectRevenueLookup(ledger, state, filter, parking.demoAccess, filter.end, params)
  assert.equal(result.scope.site, "A:0")
  assert.equal(result.scope.vehicle, "")
  assert.equal(result.scope.start, "2026-11-15")
  assert.equal(result.scope.end, "2026-11-15")
  assert.equal(result.values.get("amount"), "QR (₫)")
})
test("policy-specific reductions, debt allocations, and subscription VAT reconcile independently", () => {
  const selected = model.scopeRows(ledger, filter, parking.demoAccess)
  const discounted = select({ ...filter, policy: "CS-01", amount: "reduction" })
  assert.equal(discounted.list.reduce((n, row) => n + discounted.valueFor(row), 0), selected.reduce((n, row) => n + row.discounts.filter((d) => d.code === "CS-01").reduce((sum, d) => sum + d.amount, 0), 0))
  const claim = selected.find((row) => row.debt > 0)
  const paidState = { ...state, payments: [{ id: "PAY", unit: claim.voucher.unit, amount: 100000, day: filter.end, document: "CT", month: "", note: "", actor: "BQL", at: claim.at }] }
  const result = lookup.selectRevenueLookup(ledger, paidState, filter, parking.demoAccess, filter.end, paramsFor({ ...filter, amount: "debtRemaining" }))
  assert.equal(result.list.reduce((n, row) => n + result.valueFor(row), 0), tables.balances(ledger, selected, paidState, filter.end).reduce((n, row) => n + row.remaining, 0))
  const subs = select({ ...filter, month: "2026-11", group: "Cư dân", amount: "vat" })
  assert.equal(subs.subscriptions.reduce((n, row) => n + subs.subscriptionValue(row), 0), tables.subscriptionRow("", subs.subscriptions)["VAT (₫)"])
})
test("lookup filters respect scope permissions, can be removed, and share card-management date controls", () => {
  const access = { ...parking.demoAccess, estate: "A" }
  const result = lookup.selectRevenueLookup(ledger, state, filter, access, filter.end, paramsFor({ amount: "lost" }))
  assert.ok(result.list.length > 0)
  assert.ok(result.list.every((row) => row.estate === "A"))
  const html = renderToStaticMarkup(React.createElement(Filters, { screen: "revenue-lookup", filter, cutoff: filter.end,
    access: parking.demoAccess, params: paramsFor({ ...filter, amount: "lost", reason: "Thu thiếu" }), state, ledger, update() {} }))
  for (const label of ["Tất cả khu đô thị", "Tất cả bãi xe", "Phương tiện", "Chọn nhiều", "Áp dụng", "date-range", "Tháng này", "Tháng trước", "7 ngày trước", "Số liệu từ báo cáo: Thất thu", "Lý do thất thu: Thu thiếu", "Nguồn thu", "Tình trạng thu tiền"]) assert.ok(html.includes(label), label)
  assert.ok(!html.includes("Chỉ tiêu đối chiếu"))
  assert.ok(!html.includes("30 ngày trước"))
  const cleared = select({ ...filter })
  assert.ok(cleared.list.length > result.list.length)
})
test("payment-status filters separate fully collected, outstanding and free rows while preserving report measures", () => {
  const all = select({}).list
  for (const [status, matches] of [
    ["paid", (row) => row.revenue > 0 && row.paid >= row.revenue],
    ["unpaid", (row) => row.debt + row.lost > 0],
  ]) {
    const result = select({ balance: status })
    assert.ok(result.list.length > 0)
    assert.deepEqual(result.list.map((row) => row.id).sort(), all.filter(matches).map((row) => row.id).sort())
  }
  const result = select({ balance: "unpaid", amount: "lost" })
  assert.ok(result.list.length > 0)
  assert.ok(result.list.every((row) => row.lost > 0))
  assert.equal(result.list.reduce((sum, row) => sum + result.valueFor(row), 0), result.list.reduce((sum, row) => sum + row.lost, 0))
})
test("shift links make the underlying site and date visible, and clearing one chip removes only that condition", () => {
  const patch = lookup.revenueLookupPatch(filter, { label: "Ca 1", shift: "B:0/2026-11-15/Ca 1", day: "2026-11-15", amount: "paid" })
  assert.equal(patch.estate, "B")
  assert.equal(patch.site, "B:0")
  buttons = []
  const changes = []
  renderToStaticMarkup(React.createElement(Filters, { screen: "revenue-lookup", filter, cutoff: filter.end,
    access: parking.demoAccess, params: paramsFor({ ...filter, amount: "lost", reason: "Thu thiếu" }), state, ledger,
    update(value) { changes.push(value) } }))
  const chip = buttons.find((button) => typeof button.children === "object" && JSON.stringify(button.children).includes("Lý do thất thu"))
  assert.ok(chip)
  chip.onClick()
  assert.equal(changes[0].reason, null)
  assert.equal(changes[0].amount, "lost")
  assert.equal(changes[0].page, null)
})
test("paper imports filter by import time and vehicle; card receipts filter by site and vehicle", () => {
  const { RevenuePaper, RevenueReceipts } = load("RevenueInputs")
  const { seedOperations } = load("operations-model")
  const common = { ledger, parking: settings, trips: [], access: parking.demoAccess,
    filter: { ...filter, estate: "A", site: "A:0" }, cutoff: filter.end, actor: "Admin", params: new URLSearchParams(),
    update() {}, navigate() {}, exportFile() {}, save() {}, notify() {}, operations: seedOperations() }
  const at = parking.dayStart("2026-11-17") + 600
  const row = { site: "A:0", day: "2026-09-15", shift: "Ca 1", vehicle: "Ô tô", from: 1, to: 10, amount: 100000, method: "Tiền mặt" }
  const input = { ...state, papers: [{ id: "IMPORT-CAR", at, actor: "BPAN", rows: [row] },
    { id: "IMPORT-MOTOR", at, actor: "BPAN", rows: [{ ...row, vehicle: "Xe máy" }] }] }
  const paper = renderToStaticMarkup(React.createElement(RevenuePaper, { ...common, state: input }))
  assert.ok(paper.includes("IMPORT-CAR"), "late imports appear according to import time")
  assert.ok(!paper.includes("IMPORT-MOTOR"))
  const receipt = { id: "RECEIPT-CAR", at, site: "A:0", vehicle: "Ô tô", customer: "Khách A", plate: "30A-123.45", card: "THE", previous: "", kind: "Cấp lần đầu", reason: "", amount: 50000, method: "Tiền mặt", note: "" }
  const receipts = renderToStaticMarkup(React.createElement(RevenueReceipts, { ...common, state: { ...state, receipts: [receipt,
    { ...receipt, id: "RECEIPT-OTHER-SITE", site: "A:1" }, { ...receipt, id: "RECEIPT-MOTOR", vehicle: "Xe máy" }] } }))
  assert.ok(receipts.includes("RECEIPT-CAR"))
  assert.ok(!receipts.includes("RECEIPT-OTHER-SITE"))
  assert.ok(!receipts.includes("RECEIPT-MOTOR"))
})
