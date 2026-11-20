const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")
const jsx = require("react/jsx-runtime")

// Render real dashboard branches and invoke the handlers attached to their buttons.
// Only initial view state and chart readiness are supplied by this harness.
let popup = null, buttons = []
const loaded = new Map()
function load(name) {
  const filename = ["tsx", "ts"].map((ext) => path.resolve(__dirname, "../src", `${name}.${ext}`)).find(fs.existsSync)
  assert.ok(filename, name)
  if (loaded.has(filename)) return loaded.get(filename).exports
  const compiled = new Module(filename, module)
  loaded.set(filename, compiled)
  compiled.filename = filename
  const capture = (type, props) => {
    if (type === "button" && typeof props?.onClick === "function" && !props.disabled) buttons.push(props)
  }
  compiled.require = (id) => {
    if (id.startsWith("./")) return load(id.slice(2))
    if (id === "react") return { ...React,
      createElement(type, props, ...children) { capture(type, props); return React.createElement(type, props, ...children) },
      ...(name === "ParkingDashboard" ? { useState(initial) {
        return React.useState(initial === null ? popup : initial === false ? true : Array.isArray(initial)
          ? ["A", "B", "C", "A:0", "A:1", "A:2", "B:0", "B:1", "B:2", "C:0", "C:1", "C:2"]
          : initial === 20 ? 100 : initial)
      } } : {}),
    }
    if (id === "react/jsx-runtime") return { ...jsx,
      jsx(type, props, key) { capture(type, props); return jsx.jsx(type, props, key) },
      jsxs(type, props, key) { capture(type, props); return jsx.jsxs(type, props, key) },
    }
    return require(id)
  }
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename)
  return compiled.exports
}
const parking = load("parking-model")
const { seedTrips, readSettings } = load("parking-data")
const Dashboard = load("ParkingDashboard").default
const Billing = load("ParkingSupplementBilling").ParkingSupplementBilling
const { ParkingTripList, ParkingTripDetail, TripLookupFields, readTripLookupParams } = load("ParkingTrips")
const { tripExport } = load("parking-export")

test("lookup shows the recorded exit after the reporting cutoff without changing historical status or totals", () => {
  const settings = readSettings(), trips = seedTrips("2026-11-19")
  const filters = { estate: "A", site: "A:0", vehicle: "Ô tô", start: "2026-11-18", end: "2026-11-18" }
  const end = parking.dayStart("2026-11-19")
  const original = trips.find((row) => row.id === "LX-790122")
  assert.equal(original.plate, "30E-922.22")
  assert.equal(parking.displayTime(original.exited), "19/11/2026 00:50")
  for (const exited of [original.exited, end, null, end - 60]) {
    const trip = { ...original, exited }
    const data = parking.buildParkingReport([trip], settings, filters, parking.demoAccess)
    const html = renderToStaticMarkup(React.createElement(ParkingTripList, {
      data, settings, filters, params: new URLSearchParams({ q: trip.plate }),
      update() {}, access: parking.demoAccess, exportFile() {}, changes: [], openTrip() {}, headingActions: null,
    }))
    const detail = renderToStaticMarkup(React.createElement(ParkingTripDetail, {
      trip, settings, filters, cutoff: filters.end, changes: [], back() {}, exportFile() {}, access: parking.demoAccess,
    }))
    const afterCutoff = exited != null && exited >= end
    assert.equal(html.includes("Ra sau mốc tra cứu"), afterCutoff)
    assert.ok(html.includes("Trạng thái tại mốc tra cứu"))
    assert.ok(detail.includes("Trạng thái tại mốc tra cứu"))
    if (exited != null) {
      assert.ok(html.includes(parking.displayTime(exited)))
      assert.ok(detail.includes(parking.displayTime(exited)))
    } else assert.ok(detail.includes("Chưa ghi nhận giờ ra"))
    assert.equal(data.total.closing, exited == null || exited >= end ? 1 : 0)
    assert.equal(data.total.outgoing, exited != null && exited < end ? 1 : 0)
    const exported = tripExport(trip, filters, settings, data.days, undefined, end, true)
    assert.equal(exported["Giờ ra"]?.getTime() ?? null, exited == null ? null : exited * 60000)
    assert.equal(exported["Trạng thái tại mốc tra cứu"], parking.statusAt(trip, end))
    assert.equal(exported["Ghi chú giờ ra"], afterCutoff ? "Ra sau mốc tra cứu" : "")
    // Report exports retain their historical snapshot behavior.
    const reportExport = tripExport(trip, filters, settings, data.days)
    assert.equal(reportExport["Giờ ra"]?.getTime() ?? null, exited != null && exited < end ? exited * 60000 : null)
  }
  const result = parking.supplementTripCandidates(trips, [], parking.demoAccess, original.plate, end + 600)
  assert.ok(result.recorded.some((trip) => trip.id === original.id))
  assert.ok(!result.available.some((trip) => trip.id === original.id))
})

test("disconnected fee UI shows unknown amounts and cannot generate a payment request", () => {
  buttons = []
  const html = renderToStaticMarkup(React.createElement(Billing, {
    fee: { key: "", request: null, quote: undefined, valid: false, busy: false, session: undefined,
      paymentPending: false, payBusy: false, payError: "", error: "", refresh() {}, createPayment() {}, checkPayment() {} },
    service: null, method: "QR", changeMethod() {},
  }))
  assert.ok(html.includes("Tính phí tự động chưa được kết nối"))
  assert.ok(html.includes("Chưa có mã QR"))
  assert.ok(html.includes("Còn phải thanh toán"))
  assert.ok(!html.includes("0 đ"))
  assert.ok(!html.includes("<img"))
  assert.ok(!buttons.some((button) => button.children === "Tạo mã thanh toán"))
})

test("missing-exit filter excludes trips that already exited after the historical cutoff", () => {
  const settings = readSettings()
  const filters = { estate: "A", site: "A:0", vehicle: "Ô tô", start: "2026-11-18", end: "2026-11-18" }
  const base = seedTrips("2026-11-19").find((row) => row.id === "LX-790122")
  const rows = [base,
    { ...base, id: "open-trip", plate: "OPEN-123", exited: null },
    { ...base, id: "future-trip", plate: "FUTURE-123", entered: parking.vnNow() + 60, exited: null },
    { ...base, id: "outside-site", site: "B:2", plate: "OUTSIDE-123", exited: null },
    { ...base, id: "wrong-vehicle", vehicle: "Xe máy", plate: "MOTO-123", exited: null },
  ]
  const params = new URLSearchParams({ state: "missing-exit" })
  const data = parking.buildParkingReport(rows, settings, filters, parking.demoAccess)
  const html = renderToStaticMarkup(React.createElement(ParkingTripList, {
    data, settings, filters, params, update() {}, access: parking.demoAccess, exportFile() {},
    changes: [], openTrip() {}, headingActions: null,
  }))
  assert.ok(html.includes("OPEN-123"))
  for (const plate of [base.plate, "FUTURE-123", "OUTSIDE-123", "MOTO-123"]) assert.ok(!html.includes(plate), plate)
  assert.equal(readTripLookupParams(params).get("state"), "missing-exit")
  const fields = renderToStaticMarkup(React.createElement(TripLookupFields, { params, update() {}, data }))
  assert.ok(fields.includes('value="missing-exit" selected=""'))
  assert.ok(fields.includes("Chưa ghi nhận giờ ra"))
  assert.ok(fields.includes("Đang trong bãi tại mốc tra cứu"))
  // Historical parking status remains available for reconciliation with reports.
  const historical = renderToStaticMarkup(React.createElement(ParkingTripList, {
    data, settings, filters, params: new URLSearchParams({ state: "Đang trong bãi" }),
    update() {}, access: parking.demoAccess, exportFile() {}, changes: [], openTrip() {}, headingActions: null,
  }))
  assert.ok(historical.includes(base.plate))
})

test("dashboard KPI, chart, and detail-table buttons dispatch valid lookup links", (t) => {
  const settings = readSettings(), trips = seedTrips("2026-11-19")
  let linked = 0
  const covered = new Set()
  for (const vehicle of parking.parkingVehicles) {
    const filters = { estate: "", site: "", vehicle, start: "2026-11-12", end: "2026-11-18" }
    const data = parking.buildParkingReport(trips, settings, filters, parking.demoAccess)
    const views = [
      [null, {}], [{ kind: "use" }, {}], [{ kind: "day-type" }, {}],
      [{ kind: "daily" }, {}], [{ kind: "site-day", day: filters.start }, {}],
      [{ kind: "hours" }, {}], [{ kind: "hours" }, { flow: "Ca", flowDay: filters.start }],
      [{ kind: "duration" }, {}], [{ kind: "duration" }, { guest: "Vãng lai" }],
      [{ kind: "duration" }, { guest: "Thuê bao" }], [{ kind: "duration" }, { guest: "VIP" }],
      [{ kind: "exceeded" }, {}],
    ]
    for (const [view, query] of views) {
      popup = view
      buttons = []
      const dispatched = []
      renderToStaticMarkup(React.createElement(Dashboard, {
        data, settings, filters, params: new URLSearchParams(query), access: parking.demoAccess,
        cutoff: "2026-11-18", update() {}, showCapacity() {}, resetFilters() {}, exportFile() {},
        drill(value) { dispatched.push(value) },
      }))
      for (const button of buttons) button.onClick()
      for (const value of dispatched) {
        linked++
        covered.add(value.metric)
        assert.ok(Object.hasOwn(parking.tripLookupModes, value.metric))
        assert.ok(value.end > value.start, JSON.stringify(value))
        if (value.sites) assert.ok(value.sites.every((id) => data.bySite.some((site) => site.id === id)))
        const patch = parking.tripLookupPatch(value, filters, settings)
        assert.equal(patch.vehicle, vehicle)
        assert.equal(patch.group || "", value.group || "")
        const scope = { ...filters, ...Object.fromEntries(["estate", "site", "vehicle", "start", "end"].map((key) => [key, patch[key]])) }
        const params = new URLSearchParams(Object.entries(patch).filter(([, value]) => value != null))
        assert.equal(parking.periodError(scope, "2026-11-18"), "", JSON.stringify(value))
        assert.equal(parking.tripLookupTimeError(params, scope), "", JSON.stringify(value))
        assert.equal(patch.reportMetric, value.metric)
      }
    }
  }
  assert.ok(linked > 500, linked)
  for (const metric of ["incoming", "outgoing", "opening", "closing", "parked", "planned", "duration", "nightly", "unusual", "exceeded"])
    assert.ok(covered.has(metric), metric)
  t.diagnostic(`${linked} rendered button handlers dispatched valid report-to-lookup links`)
})
