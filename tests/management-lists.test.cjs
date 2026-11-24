const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const jsx = require("react/jsx-runtime")
const { renderToStaticMarkup } = require("react-dom/server")

const cache = new Map()
let buttons = []
function load(name) {
  const filename = ["tsx", "ts"].map(ext => path.resolve(__dirname, "../src", `${name}.${ext}`)).find(fs.existsSync)
  assert.ok(filename, name)
  if (cache.has(filename)) return cache.get(filename).exports
  const compiled = new Module(filename, module)
  cache.set(filename, compiled)
  compiled.require = id => {
    if (id.startsWith("./")) return load(id.slice(2))
    if (id === "react/jsx-runtime") return { ...jsx,
      jsx(type, props, key) { if (name === "ManagementListTable" && type.name === "Button") buttons.push(props); return jsx.jsx(type, props, key) },
      jsxs(type, props, key) { if (name === "ManagementListTable" && type.name === "Button") buttons.push(props); return jsx.jsxs(type, props, key) },
    }
    return require(id)
  }
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename)
  return compiled.exports
}
const { seedOperations } = load("operations-model")
const { directoryOf, subscriberCards } = load("subscription-model")
const Table = load("ManagementListTable").default
const { matchesVehicleChoices, vehicleChoiceOptions } = load("vehicle-energy")
const state = seedOperations(), directory = directoryOf(state)
function render(screen, ids, selected) {
  const calls = []
  const before = global.localStorage
  global.localStorage = { getItem: key => {
    if (selected) assert.ok(key.includes(`:${screen}:`))
    return selected ? JSON.stringify(selected) : null
  } }
  buttons = []
  try {
    const html = renderToStaticMarkup(React.createElement(Table, { screen, state, directory, ids,
      onDetail: id => calls.push(["detail", id]), onEdit: id => calls.push(["edit", id]),
      onIssue: id => calls.push(["issue", id]), onCopyService: id => calls.push(["copy", id]),
      onRelated: (kind, id) => calls.push([kind, id]), onCard: (card, id) => calls.push(["card", card.id, id]),
    }))
    const header = [...html.matchAll(/<th\b[^>]*>(.*?)<\/th>/g)].map(match => match[1])
    const cells = [...html.matchAll(/<td\b[^>]*>(.*?)<\/td>/g)].map(match => match[1].replace(/<[^>]+>/g, ""))
    return { html, header, cells, calls, buttons: [...buttons] }
  } finally { global.localStorage = before }
}

test("management lists render independent columns and preserve edit and cross-screen actions", () => {
  const fixtures = [
    ["subscriptions", state.subscriptions[0].id, "Mã thuê bao", "Chủ thuê bao"],
    ["customers", directory.customers[0].id, "Mã khách hàng", "Tên khách hàng"],
    ["vehicles", directory.vehicles[0].id, "Mã xe", "Biển số"],
    ["services", directory.services[0].id, "Mã dịch vụ", "Tên dịch vụ"],
  ]
  for (const [screen, id, first, second] of fixtures) {
    const result = render(screen, [id])
    assert.equal(result.header[0], first)
    assert.ok(result.header.includes(second))
    assert.ok(result.header.includes("Thao tác"))
    assert.equal(result.cells[0], id)
    assert.equal(result.cells.length, result.header.length)
    assert.ok(!result.html.includes("sm-secondary"))
    const edit = result.buttons.find(button => /^(Sửa|Chỉnh sửa) /.test(button["aria-label"] || ""))
    assert.ok(edit)
    edit.onClick()
    assert.deepEqual(result.calls.pop(), ["edit", id])
    if (screen !== "subscriptions") {
      const related = result.buttons.find(button => typeof button.children === "number")
      related.onClick()
      assert.deepEqual(result.calls.pop(), [screen === "customers" ? "customer" : screen === "vehicles" ? "vehicle" : "service", id])
    } else {
      const card = subscriberCards(state).get(id)
      result.buttons.find(button => button.children === card.id).onClick()
      assert.deepEqual(result.calls.pop(), ["card", card.id, id])
    }
  }
})

test("saved column order exposes optional information without removing identity or actions", () => {
  const customer = directory.customers[0]
  const result = render("customers", [customer.id], ["phone", "identity", "name", "invalid-old-column"])
  assert.deepEqual(result.header, ["Mã khách hàng", "Số điện thoại", "CCCD", "Tên khách hàng", "Thao tác"])
  assert.equal(result.cells[1], customer.phone || "—")
  assert.ok(!result.header.includes("Nguồn"))
  const vehicle = directory.vehicles[0]
  const next = render("vehicles", [vehicle.id])
  assert.equal(next.header[0], "Mã xe")
  assert.ok(!next.header.includes("CCCD"))
})

test("vehicle filters OR selected variants while keeping broad service scopes and unknown vehicles truthful", () => {
  const selected = ["Ô tô|Xăng/dầu", "Ô tô|Điện"]
  assert.equal(matchesVehicleChoices("Ô tô", "Xăng/dầu", selected), true)
  assert.equal(matchesVehicleChoices("Ô tô", "Điện", selected), true)
  assert.equal(matchesVehicleChoices("Xe máy", "Điện", selected), false)
  assert.equal(matchesVehicleChoices("Ô tô", undefined, selected), false)
  assert.equal(matchesVehicleChoices("Ô tô", undefined, ["Ô tô|Chưa xác định"]), true)
  assert.equal(matchesVehicleChoices("Xe máy", undefined, ["Ô tô|Chưa xác định"]), false)
  assert.equal(matchesVehicleChoices("Ô tô", undefined, ["Ô tô|Điện"], true), true)
  assert.equal(matchesVehicleChoices("Ô tô", "Xăng/dầu", ["Ô tô|Điện"], true), false)
  assert.equal(matchesVehicleChoices("Xe đạp", "Điện", []), true)
  assert.equal(vehicleChoiceOptions().length, 6)
  assert.ok(vehicleChoiceOptions().every(option => !option.label.includes("Tất cả")))
})
