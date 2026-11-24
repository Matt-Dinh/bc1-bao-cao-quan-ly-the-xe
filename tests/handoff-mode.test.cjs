const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const { renderToStaticMarkup } = require("react-dom/server")

function loader() {
  const cache = new Map()
  return function load(name) {
    if (name.endsWith(".css")) return {}
    if (["Operations", "Parking", "Revenue", "SubscriptionManagement"].includes(name)) return { default: () => null }
    if (name === "useParking") return { default: () => ({ notices: [], exports: [], settings: {}, cutoff: "2026-10-28" }) }
    if (name === "useRevenueState") return { useRevenueState: () => ({ state: { receipts: [], closes: {} }, save() {} }) }
    const filename = ["ts", "tsx"].map(ext => path.resolve(__dirname, "../src", `${name}.${ext}`)).find(fs.existsSync)
    assert.ok(filename, name)
    if (cache.has(filename)) return cache.get(filename).exports
    const compiled = new Module(filename, module)
    cache.set(filename, compiled)
    compiled.filename = filename
    compiled.require = id => id.startsWith("./") ? load(id.slice(2)) : require(id)
    compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename)
    return compiled.exports
  }
}
const { handoffModes, initialHandoffLocation, modeAllowsScreen, modeHome } = loader()("handoff-mode")

test("handoff scopes keep unrelated CR screens out and retain required detail routes", () => {
  assert.equal(handoffModes.length, 5)
  for (const mode of handoffModes.map(row => row.id)) assert.ok(modeAllowsScreen(mode, modeHome(mode)))
  for (const id of ["stock", "lookup", "inventory", "imports", "handoffs", "incidents", "subscriptions", "customers", "vehicles", "services", "settings"])
    assert.ok(modeAllowsScreen("cards", id), id)
  for (const id of ["parking-report", "parking-settings", "revenue-report", "revenue-voucher", "behavior-report"])
    assert.equal(modeAllowsScreen("cards", id), false, id)
  assert.ok(modeAllowsScreen("revenue", "parking-trips"), "original trip detail remains reachable from revenue")
  assert.equal(modeAllowsScreen("revenue", "parking-report"), false)
  assert.equal(modeAllowsScreen("parking", "revenue-receipt"), false)
  assert.equal(modeAllowsScreen("behavior", "customers"), false)
  assert.equal(modeAllowsScreen("all", "invalid-screen"), false)
})

test("shared mode wins over local preference and preserves report drill-down filters", () => {
  const query = "?mode=cards&module=lookup&lookupFrom=report&lkStart=2026-10-01&lkEnd=2026-10-28&lkTypes=VIP&lkFocus=CARD-1"
  const result = initialHandoffLocation(query, "revenue")
  assert.equal(result.mode, "cards")
  for (const [key, value] of new URLSearchParams(query)) assert.equal(result.params.get(key), value, key)
  const revenue = initialHandoffLocation("?mode=revenue&module=parking-trips&trip=TX-1&start=2026-10-28", "cards")
  assert.equal(revenue.params.get("trip"), "TX-1")
  assert.equal(revenue.mode, "revenue")
})

test("mode-only links land in the right report and incompatible URLs clear foreign filters", () => {
  for (const mode of ["cards", "parking", "revenue", "behavior"]) {
    const result = initialHandoffLocation(`?mode=${mode}`, "all")
    assert.equal(result.params.get("module") || result.params.get("screen"), modeHome(mode))
  }
  const result = initialHandoffLocation("?mode=cards&module=revenue-lookup&detail=RECEIPT-1&site=A:0", "all")
  assert.equal(result.params.get("screen"), "stock")
  assert.equal(result.params.get("module"), null)
  assert.equal(result.params.get("detail"), null)
  assert.equal(result.params.get("site"), null)
})

test("old deep links remain usable when another mode was saved, invalid modes fall back safely", () => {
  const result = initialHandoffLocation("?module=lookup&lkKeyword=CARD-1", "revenue")
  assert.equal(result.mode, "all")
  assert.equal(result.params.get("lkKeyword"), "CARD-1")
  assert.equal(initialHandoffLocation("", "parking").params.get("module"), "parking-report")
  assert.equal(initialHandoffLocation("?mode=bad", "bad").mode, "all")
})

test("the public scope excludes unpublished revenue screens, including direct deep links", () => {
  assert.ok(modeAllowsScreen("revenue", "revenue-report", false))
  for (const mode of ["all", "revenue"]) {
    for (const screen of ["revenue-lookup", "revenue-close", "revenue-receipt", "revenue-voucher", "revenue-settings"])
      assert.equal(modeAllowsScreen(mode, screen, false), false, `${mode}: ${screen}`)
  }
  assert.equal(modeAllowsScreen("revenue", "parking-trips", false), false)
  const result = initialHandoffLocation("?mode=revenue&module=revenue-lookup&detail=PRIVATE-1", "all", false)
  assert.equal(result.params.get("module"), "revenue-report")
  assert.equal(result.params.get("detail"), null)
  assert.equal(result.mode, "revenue")
})

test("each mode renders only its navigation and behavior remains an explicit pending screen", () => {
  const previous = { window: global.window, location: global.location, localStorage: global.localStorage }
  try {
    for (const mode of ["cards", "parking", "revenue", "behavior", "all"]) {
      global.location = { search: `?mode=${mode}`, pathname: "/" }
      global.window = { location: global.location, innerWidth: 1400 }
      global.localStorage = { getItem: () => null }
      const App = loader()("App").default
      const html = renderToStaticMarkup(React.createElement(App))
      const nav = html.match(/<nav class="main-nav"[^>]*>([\s\S]*?)<\/nav>/)[1]
      const present = text => nav.includes(text)
      const revenuePending = html.includes("Giao diện doanh thu chưa được công bố")
      assert.ok(html.includes('aria-label="Mode bàn giao"'))
      assert.equal(present("Danh sách thuê bao"), mode === "cards" || mode === "all", mode)
      assert.equal(present("Báo cáo quản lý thẻ"), mode === "cards" || mode === "all", mode)
      assert.equal(present("Báo cáo chỗ đỗ"), mode === "parking" || mode === "all", mode)
      assert.equal(present("Báo cáo doanh thu"), mode === "revenue" || mode === "all", mode)
      assert.equal(present("Tra cứu lượt xe"), ["parking", "all"].includes(mode) || mode === "revenue" && !revenuePending, mode)
      assert.equal(present("Cấu hình"), mode !== "behavior" && !revenuePending, mode)
      if (revenuePending) assert.equal(present("Tra cứu doanh thu"), false)
      if (mode === "behavior") assert.ok(html.includes("Chưa có giao diện trong bản bàn giao này"))
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete global[key]
      else global[key] = value
    }
  }
})
