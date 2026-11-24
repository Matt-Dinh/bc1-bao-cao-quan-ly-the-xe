const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")
const jsx = require("react/jsx-runtime")

// Render the actual App table callbacks and the actual report charts/popups.
// Only unrelated modules, browser storage and report popup visibility are supplied.
const cache = new Map()
let links = [], updates = [], destination = null
const text = (node) => node == null || typeof node === "boolean" ? ""
  : Array.isArray(node) ? node.map(text).join(" ")
  : typeof node === "object" ? text(node.props?.children) : String(node)
const strongValues = (node) => {
  if (!node || typeof node !== "object") return []
  if (Array.isArray(node)) return node.flatMap(strongValues)
  return node.type === "strong" ? [text(node.props.children)] : strongValues(node.props?.children)
}
function capture(type, props) {
  if (!props?.onClick || props.disabled || props["aria-disabled"]) return
  const cls = props.className || "", label = props["aria-label"] || ""
  const candidate = /number-link|report-kpi|movement-column|donut-legend-row|donut-total-link|alert-bar-row/.test(cls)
    || /:\s*[\d.]+\s+(thẻ|lượt)/.test(label)
    || strongValues(props.children).length && /Đang hoạt động|Khóa|Hết hạn/.test(text(props.children))
    || typeof type === "function" && type.name === "Button" && text(props.children).includes("Xem danh sách")
  if (candidate) links.push(props)
}
function load(name) {
  if (["Operations", "Parking", "Revenue", "SubscriptionManagement"].includes(name))
    return { default: () => null }
  if (name === "useParking") return { default: () => ({ notices: [], exports: [], settings: {}, cutoff: "2026-10-28" }) }
  if (name === "useRevenueState") return { useRevenueState: () => ({ state: { receipts: [], closes: {} }, save() {} }) }
  const filename = ["tsx", "ts"].map((ext) => path.resolve(__dirname, "../src", `${name}.${ext}`)).find(fs.existsSync)
  assert.ok(filename, name)
  if (cache.has(filename)) return cache.get(filename).exports
  const compiled = new Module(filename, module)
  cache.set(filename, compiled)
  compiled.filename = filename
  compiled.require = (id) => {
    if (id.endsWith(".css")) return {}
    if (id.startsWith("./")) return load(id.slice(2))
    if (id === "react") return { ...React, useState(initial) {
      const value = name === "ReportDashboard" && initial === false ? true
        : name === "App" && Array.isArray(initial) && initial.length === 1 && initial[0] === "A" ? ["A", "B", "C"] : initial
      const [state] = React.useState(value)
      return [state, (next) => {
        if (name === "App") {
          if (next && typeof next === "object" && "mode" in next && "statuses" in next) updates.push(next)
          if (next === "lookup") destination = next
        }
      }]
    } }
    if (id === "react-dom") return { ...require(id), createPortal: (children) => children }
    if (id === "react/jsx-runtime") return { ...jsx,
      jsx(type, props, key) { if (["App", "ReportDashboard"].includes(name)) capture(type, props); return jsx.jsx(type, props, key) },
      jsxs(type, props, key) { if (["App", "ReportDashboard"].includes(name)) capture(type, props); return jsx.jsxs(type, props, key) },
    }
    return require(id)
  }
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename)
  return compiled.exports
}

test("rendered card report KPI, chart, estate/parking table and popup links reconcile after URL reload", (t) => {
  const previous = { location: global.location, window: global.window, localStorage: global.localStorage, document: global.document }
  global.window = { scrollTo() {} }
  global.document = { body: {} }
  global.localStorage = { getItem: () => null }
  const model = load("report-model")
  const { defaults, estates } = load("data")
  const scopes = [
    {}, { estate: "A" }, { estate: "B" }, { estate: "C" },
    { estate: "A", park: estates[0].parks[0], type: "Thuê bao tháng", vehicle: "Xe máy" },
    { park: "Bãi ngoài trời" }, { type: "VIP", vehicle: "Ô tô" },
    { start: "2026-10-05", end: "2026-10-20", vehicle: "Xe đạp" },
    { start: "2026-09-01", end: "2026-09-01", estate: "B" },
    { estate: "A", park: estates[1].parks[0] },
  ]
  let checked = 0, repeated = 0, keyboard = 0
  const resultsByFilter = new Map()
  try {
    for (const scope of scopes) for (const groupBy of model.circulationGroupings) for (const split of [false, true]) {
      const filters = { ...defaults, ...scope }
      const params = new URLSearchParams({ ...filters, screen: "stock", reportGroupBy: groupBy, splitByEstate: split ? "1" : "0" })
      global.location = { search: `?${params}`, pathname: "/" }
      global.window.location = global.location
      cache.delete(path.resolve(__dirname, "../src/App.tsx"))
      links = []
      renderToStaticMarkup(React.createElement(load("App").default))
      assert.ok(links.length, `No links: ${params}`)
      for (const link of links) {
        updates = []; destination = null
        link.onClick()
        const selected = updates.at(-1)
        assert.ok(selected, `No lookup filters: ${link["aria-label"] || text(link.children)}`)
        assert.equal(destination, "lookup")
        assert.notEqual(selected.mode, "current")
        assert.deepEqual(selected.technology, [], "Report navigation must clear an old technology filter")
        const url = new URLSearchParams("lookupTechnology=Thẻ UHF&lookupEnergy=Điện&lookupKeyword=old-card")
        model.setCardLookupParams(url, selected)
        const restored = model.readCardLookupParams(url, filters)
        assert.deepEqual(restored, selected)
        const key = JSON.stringify(restored)
        if (!resultsByFilter.has(key)) resultsByFilter.set(key, model.lookupCards(restored))
        const result = resultsByFilter.get(key)
        const count = (result.events || result.cards).length
        const label = link["aria-label"] || ""
        const labelled = /:\s*([\d.]+)\s+(?:thẻ|lượt)/.exec(label)
        const value = labelled?.[1] || strongValues(link.children)[0] || (/^[\d.]+$/.test(text(link.children)) ? text(link.children) : null)
        if (value != null) assert.equal(count, Number(value.replace(/[^\d]/g, "")), `${params}: ${label || text(link.children)}`)
        assert.ok(result.cards.every((card) => (!filters.type || card.type === filters.type) && (!filters.vehicle || card.vehicle === filters.vehicle)))
        assert.equal(url.has("lookupEnergy"), false)
        if (link.onKeyDown) for (const key of ["Enter", " "]) {
          updates = []
          let prevented = false
          link.onKeyDown({ key, preventDefault() { prevented = true } })
          assert.equal(prevented, true)
          assert.deepEqual(updates.at(-1), selected)
          keyboard++
        }
        if (result.events && result.events.length > result.cards.length) repeated++
        checked++
      }
    }
    assert.ok(checked > 500, `Insufficient coverage: ${checked}`)
    assert.ok(repeated > 0, "Repeated movements must remain separate rows")
    t.diagnostic(`${checked} report links verified, including ${repeated} links with repeated card movements and ${keyboard} keyboard activations`)
  } finally {
    for (const [key, value] of Object.entries(previous)) value === undefined ? delete global[key] : global[key] = value
  }
})
