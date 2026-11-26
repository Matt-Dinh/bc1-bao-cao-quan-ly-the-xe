const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")
const React = require("react")
const jsx = require("react/jsx-runtime")
const { renderToStaticMarkup } = require("react-dom/server")
const XLSX = require("xlsx")

const loaded = new Map()
function load(name) {
  const filename = ["tsx", "ts"].map((ext) => path.resolve(__dirname, "../src", `${name}.${ext}`)).find(fs.existsSync)
  if (loaded.has(filename)) return loaded.get(filename).exports
  const compiled = new Module(filename, module)
  loaded.set(filename, compiled)
  compiled.filename = filename
  compiled.require = (id) =>
    id.startsWith("./")
      ? load(id.slice(2))
      : id === "react/jsx-runtime"
        ? jsx
        : id === "react"
          ? React
          : require(id)
  compiled._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    filename,
  )
  return compiled.exports
}

const revenue = load("revenue-model")
const zfi = load("revenue-zfi014")
const workbook = load("parking-workbook")
const { RevenueClose } = load("RevenueOperations")
const { seedTrips, readSettings } = load("parking-data")
const parking = load("parking-model")

test("QR and bank transfer are merged into one payment method while preserving legacy bank-transfer records", () => {
  assert.deepEqual(revenue.methods, ["Tiền mặt", "QR", "Ví", "VinClub"])
  assert.equal(revenue.normalizeMethod("Chuyển khoản"), "QR")
  const layers = revenue.moneyLayers(
    {
      price: 80000,
      discounts: [],
      payments: [
        { id: "P1", at: 1000, method: "Chuyển khoản", amount: 50000, status: "Thành công" },
        { id: "P2", at: 1001, method: "QR", amount: 30000, status: "Thành công" },
      ],
    },
    10,
  )
  assert.equal(layers.moneyByMethod[revenue.methods.indexOf("QR")], 80000)
  assert.equal(layers.collected, 80000)
  assert.equal(layers.lost, 0)
})

test("ZFI014 VAT rounding, contract formatting, and 65-column TEMP DO match VCR official rules", () => {
  const samples = [
    [54642000, 49674546, 4967454],
    [55221000, 50200910, 5020090],
    [16082000, 14620000, 1462000],
    [13222000, 12020000, 1202000],
    [3221364, 2928513, 292851],
  ]
  for (const [total, expectedNet, expectedVat] of samples) {
    const net = zfi.roundUpNet(total, 10)
    assert.equal(net, expectedNet)
    assert.equal(total - net, expectedVat)
  }

  assert.deepEqual(zfi.sapContractFields("300000092"), { assignment: "0000300000092", contract: "300000092" })
  assert.deepEqual(zfi.sapContractFields("0000300000001"), { assignment: "0000300000001", contract: "300000001" })
  assert.deepEqual(zfi.sapContractFields("TGX-VCP T.HOA"), { assignment: "TGX-VCP T.HOA", contract: "TGX-VCP T.HOA" })

  const lines = zfi.buildZfi014DocumentLines({
    day: "2026-10-15",
    reference: 1,
    config: { mall: "421003", company: "1142", branch: "B000", customer: "0000300000001", vat: 10 },
    totalAmount: 54642000,
  })
  assert.equal(lines.length, 3)
  for (const line of lines) assert.equal(line.length, 65)
  assert.equal(lines[0][0], "15102026")
  assert.equal(lines[0][2], "X1")
  assert.equal(lines[0][3], "1142")
  assert.equal(lines[0][5], "B000")
  assert.equal(lines[0][6], "1")
  assert.equal(lines[0][14], "01")
  assert.equal(lines[0][15], "300001749")
  assert.equal(lines[0][17], "1310900000")
  assert.equal(lines[0][19], 54642000)
  assert.equal(lines[0][37], "421003")
  assert.equal(lines[0][48], "421003")
  assert.equal(lines[0][53], "0000300000001")
  assert.equal(lines[0][54], "Doanh Thu TGX 15102026")
  assert.equal(lines[0][56], "421003")
  assert.equal(lines[0][58], "300000001")
  assert.equal(lines[0][59], "9")

  assert.equal(lines[1][14], "50")
  assert.equal(lines[1][15], "5117502702")
  assert.equal(lines[1][19], 49674546)
  assert.equal(lines[1][20], "O4")

  assert.equal(lines[2][14], "50")
  assert.equal(lines[2][15], "3331100000")
  assert.equal(lines[2][19], 4967454)
  assert.equal(lines[2][20], "O4")
  assert.equal(lines[2][22], 49674546)

  const x2 = zfi.buildZfi014DocumentLines({
    day: "2026-10-16",
    reference: 1,
    config: { mall: "421003", company: "1142", branch: "B000", customer: "0000300000001", vat: 10 },
    totalAmount: 110000,
    docType: "X2",
  })
  assert.equal(x2[0][2], "X2")
  assert.equal(x2[0][14], "11")
  assert.equal(x2[1][14], "40")
  assert.equal(x2[2][14], "40")
})

test("ZFI014 workbook serializes cleanly to XLSX with 5-row TEMP DO header and non-zero rows only", () => {
  const state = revenue.initialRevenueState()
  const settings = readSettings()
  const trips = seedTrips("2026-11-19")
  const ledger = revenue.buildLedger(trips, settings, state)
  const scoped = revenue.scopeRows(
    ledger,
    { estate: "A|B|C", site: "", vehicle: "", start: "2026-11-18", end: "2026-11-18" },
    parking.demoAccess,
    false,
  )
  const wb = zfi.buildZfi014Workbook({
    state,
    ledger,
    scopedLedger: scoped,
    estates: ["A", "B", "C"],
    days: ["2026-11-18"],
    adjustments: [],
    actor: "Kế toán",
  })
  assert.ok(wb["TEMP DO"])
  assert.ok(wb["1.so lieu"])
  assert.ok(wb["DanhMuc_TTTM"])
  assert.equal(wb["TEMP DO"].aoa.length, 5 + 3 * 3)

  const bytes = workbook.workbookBytes(wb)
  const parsed = XLSX.read(bytes, { type: "array" })
  assert.deepEqual(parsed.SheetNames.slice(0, 3), ["TEMP DO", "1.so lieu", "DanhMuc_TTTM"])
  const grid = XLSX.utils.sheet_to_json(parsed.Sheets["TEMP DO"], { header: 1, defval: "" })
  assert.equal(grid[0][0], "DOCUMENT HEADER")
  assert.equal(grid[0][14], "DOCUMENT LINE ITEM")
  assert.equal(grid[2][14], "NEWBS")
  assert.equal(grid[5][14], "01")
  assert.equal(grid[5][15], "300001749")
  assert.equal(grid[6][15], "5117502702")
  assert.equal(grid[7][15], "3331100000")
})

test("Doanh thu tổng hợp renders both export buttons without manual Chốt kỳ or Chưa chốt/Đã chốt tabs", () => {
  const state = revenue.initialRevenueState()
  const settings = readSettings()
  const trips = seedTrips("2026-11-19")
  const ledger = revenue.buildLedger(trips, settings, state)
  const html = renderToStaticMarkup(
    React.createElement(RevenueClose, {
      state,
      ledger,
      parking: settings,
      trips,
      access: parking.demoAccess,
      filter: { estate: "", site: "", vehicle: "", start: "2026-11-15", end: "2026-11-18" },
      cutoff: "2026-11-18",
      actor: "Admin Local",
      params: new URLSearchParams(),
      update() {},
      navigate() {},
      exportFile() {},
      save() { return true },
      notify() {},
      operations: load("operations-model").seedOperations(),
    }),
  )
  assert.ok(html.includes("Tải báo cáo doanh thu"))
  assert.ok(html.includes("Tải số liệu ZFI014"))
  assert.ok(html.includes("QR (₫)"))
  assert.ok(!html.includes("Chuyển khoản"))
  assert.ok(!html.includes(">Chốt kỳ<"))
  assert.ok(!html.includes(">Chưa chốt<"))
  assert.ok(!html.includes(">Đã chốt<"))
  assert.ok(!html.includes(">Chốt ca<"))
  assert.ok(html.includes("Tự động chốt theo ngày doanh thu"))
})
