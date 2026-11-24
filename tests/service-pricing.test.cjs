const test = require("node:test")
const assert = require("node:assert/strict")
const {
  newServicePrice,
  servicePrices,
  validateServicePrices,
  estimateServicePrice,
  serviceCoversPeriod,
} = require("/tmp/vparking-model-tests/service-pricing.js")
const {
  seedOperations,
} = require("/tmp/vparking-model-tests/operations-model.js")
const {
  directoryOf,
  saveManagedService,
} = require("/tmp/vparking-model-tests/subscription-model.js")
function fixture(kind = "Theo khung giờ", patch = {}) {
  const p = {
    ...newServicePrice("2026-09-01", kind),
    id: "p1",
    name: "Giá thử",
    amount: 10000,
    windows: [
      { id: "w1", from: "00:00", to: "24:00", price: 10000, minutes: 60 },
    ],
    ...patch,
  }
  return {
    id: "s1",
    parkIds: ["A:0"],
    name: "Dịch vụ thử",
    vehicle: kind === "Theo chu kỳ" ? "Xe máy" : "Ô tô",
    category: kind === "Theo tháng" ? "Thuê bao" : "Vãng lai",
    control: "Biển số và Thẻ",
    pricing: "Theo giờ",
    price: 10000,
    validFrom: "2026-09-01",
    validTo: "",
    active: true,
    note: "",
    prices: [p],
  }
}
const estimate = (service, a, b, opts) =>
  estimateServicePrice(service, `2026-10-${a}`, `2026-10-${b}`, opts)
test("legacy prices migrate without changing amount or the three vehicle groups", () => {
  const s = directoryOf(seedOperations()).services[0],
    prices = servicePrices(s)
  assert.equal(prices[0].amount, s.price)
  assert.equal(prices[0].kind, "Theo tháng")
  assert.equal(prices[0].from, s.validFrom)
  assert.equal(prices[0].to, s.validTo)
  assert.equal(servicePrices(s)[0].id, prices[0].id)
})
test("hour and fixed block estimates round only the partial final unit", () => {
  assert.equal(estimate(fixture(), "29T08:00", "29T09:00").total, 10000)
  assert.equal(estimate(fixture(), "29T08:00", "29T09:00:01").total, 20000)
  const block = fixture("Theo block thời gian", {
    blockMinutes: 30,
    amount: 5000,
  })
  assert.equal(estimate(block, "29T08:00", "29T08:30").total, 5000)
  assert.equal(estimate(block, "29T08:00", "29T08:31").total, 10000)
})
test("adjacent bands have exclusive ends and cumulative versus last-window behavior", () => {
  const service = fixture("Theo khung giờ", {
    windows: [
      { id: "a", from: "00:00", to: "12:00", price: 10000, minutes: 60 },
      { id: "b", from: "12:00", to: "24:00", price: 20000, minutes: 60 },
    ],
  })
  assert.equal(estimate(service, "29T11:00", "29T13:00").total, 30000)
  assert.equal(estimate(service, "29T11:00", "29T12:00").total, 10000)
  service.prices[0].cumulative = false
  assert.equal(estimate(service, "29T11:00", "29T13:00").total, 40000)
  // The last band can be a band already seen the previous day.
  assert.equal(estimate(service, "29T11:00", "30T11:00").total, 240000)
})
test("periodic prices charge each daily cycle once instead of hourly", () => {
  const service = fixture("Theo chu kỳ", {
    windows: [
      { id: "a", from: "06:00", to: "18:00", price: 2000, minutes: 60 },
      { id: "b", from: "18:00", to: "06:00", price: 3000, minutes: 60 },
    ],
  })
  assert.equal(estimate(service, "29T07:00", "29T17:00").total, 2000)
  assert.equal(estimate(service, "29T17:00", "30T07:00").total, 7000)
})
test("overnight prices charge once per night including midnight without double billing", () => {
  const service = fixture("Theo khung giờ", {
    windows: [
      { id: "a", from: "06:00", to: "22:00", price: 10000, minutes: 60 },
    ],
    overnight: true,
    nightStart: "22:00",
    nightEnd: "06:00",
    nightPrice: 50000,
  })
  assert.equal(estimate(service, "29T23:00", "30T05:00").total, 50000)
  assert.equal(estimate(service, "29T21:00", "30T07:00").total, 70000)
  assert.equal(estimate(service, "29T23:00", "31T05:00").total, 260000)
})
test("initial free minutes respect entry window, daily quota and VinFast eligibility", () => {
  const service = fixture("Theo khung giờ", {
    free: true,
    freeMinutes: 15,
    freeStart: "06:00",
    freeEnd: "18:00",
    freeTurns: 2,
    vinfastOnly: true,
  })
  const yes = { vinfast: true, previousFreeTurns: 1 },
    no = { vinfast: false, previousFreeTurns: 1 }
  assert.equal(estimate(service, "29T08:00", "29T09:15", yes).total, 10000)
  assert.equal(estimate(service, "29T08:00", "29T09:15", yes).freeMinutes, 15)
  assert.equal(estimate(service, "29T08:00", "29T08:10", yes).total, 0)
  assert.equal(estimate(service, "29T08:00", "29T09:15", no).total, 20000)
  assert.equal(
    estimate(service, "29T08:00", "29T09:15", { ...yes, previousFreeTurns: 2 })
      .total,
    20000,
  )
  assert.equal(estimate(service, "29T05:00", "29T06:15", yes).total, 20000)
})
test("date and weekday changes select the right schedule and gaps produce an error", () => {
  const s = fixture(),
    p = s.prices[0]
  s.prices = [
    { ...p, to: "2026-10-29" },
    {
      ...p,
      id: "p2",
      from: "2026-10-30",
      amount: 20000,
      windows: [{ ...p.windows[0], price: 20000 }],
    },
  ]
  assert.equal(estimate(s, "29T23:00", "30T01:00").total, 30000)
  s.prices[1].from = "2026-10-31"
  assert.throws(() => estimate(s, "29T23:00", "30T01:00"), /Chưa có biểu giá/)
  s.prices = [
    { ...p, days: [1, 2, 3, 4, 5] },
    {
      ...p,
      id: "p2",
      days: [0, 6],
      windows: [{ ...p.windows[0], price: 20000 }],
    },
  ]
  assert.equal(estimate(s, "31T08:00", "31T09:00").total, 20000)
})
test("monthly estimates use full calendar months and enforce operating hours", () => {
  const s = fixture("Theo tháng", { amount: 1200000 })
  assert.equal(
    estimateServicePrice(s, "2026-10-31T23:00", "2026-11-01T01:00").total,
    2400000,
  )
  s.prices[0].start = "06:00"
  s.prices[0].end = "22:00"
  assert.throws(
    () => estimate(s, "29T05:00", "29T07:00"),
    /ngoài giờ hoạt động/,
  )
})
test("free and per-turn prices produce explicit totals", () => {
  assert.equal(estimate(fixture("Miễn phí"), "29T08:00", "29T10:00").total, 0)
  assert.equal(
    estimate(fixture("Theo lượt"), "29T08:00", "30T10:00").total,
    10000,
  )
})
test("validation blocks ambiguous schedules, overlaps, invalid inputs and incompatible price kinds", () => {
  const s = fixture(),
    p = s.prices[0],
    validate = (rows) => validateServicePrices(rows, s.category, s.vehicle)
  assert.throws(() => validate([]), /1 đến 100/)
  assert.throws(() => validate([{ ...p, days: [] }]), /ngày áp dụng/)
  assert.throws(() => validate([{ ...p, from: "2026-02-31" }]), /hiệu lực/)
  assert.throws(() => validate([p, { ...p, id: "p2" }]), /trùng ngày/)
  assert.throws(
    () =>
      validate([
        { ...p, windows: [...p.windows, { ...p.windows[0], id: "b" }] },
      ]),
    /chồng giờ/,
  )
  assert.throws(() => validate([{ ...p, overnight: true }]), /chồng giờ/)
  assert.throws(
    () => validate([{ ...p, windows: [{ ...p.windows[0], price: -1 }] }]),
    /Giá phải/,
  )
  assert.throws(
    () => validateServicePrices([p], "Thuê bao", "Ô tô"),
    /Theo tháng/,
  )
  assert.throws(
    () => estimateServicePrice(s, "2026-02-31T08:00", "2026-03-04T08:00"),
    /hợp lệ/,
  )
  assert.throws(() => estimate(s, "29T08:00", "29T07:00"), /giờ ra sau/)
  assert.throws(
    () => estimateServicePrice(s, "2026-01-01T08:00", "2028-01-01T08:00"),
    /366 ngày/,
  )
})
test("weekly coverage checks handle open-ended contracts, finite schedules and missing weekdays", () => {
  const s = fixture("Theo tháng")
  assert.equal(serviceCoversPeriod(s, "2026-10-29", ""), true)
  s.prices[0].to = "2026-12-31"
  assert.equal(serviceCoversPeriod(s, "2026-10-29", ""), false)
  assert.equal(serviceCoversPeriod(s, "2026-10-29", "2026-12-31"), true)
  s.prices[0].days = [1, 2, 3, 4, 5]
  assert.equal(serviceCoversPeriod(s, "2026-10-29", "2026-12-31"), false)
})
test("saving service schedules clones nested arrays and rejects invalid price edits atomically", () => {
  const state = seedOperations(),
    s = fixture("Theo tháng"),
    before = JSON.stringify(state)
  const next = saveManagedService(state, {
    ...s,
    id: "",
    pricing: "Theo tháng",
  })
  s.prices[0].days.length = 0
  s.prices[0].windows[0].price = 999
  assert.equal(next.directory.services[0].prices[0].days.length, 7)
  assert.equal(next.directory.services[0].prices[0].windows[0].price, 10000)
  assert.throws(
    () => saveManagedService(state, { ...s, id: "" }),
    /ngày áp dụng/,
  )
  assert.equal(JSON.stringify(state), before)
})
