const test = require("node:test")
const assert = require("node:assert/strict")
const {
  defaults,
  estates,
  cardTypes,
  vehicles,
} = require("/tmp/vparking-model-tests/data.js")
const {
  stockMetrics,
  metricCards,
  snapshot,
  cardEvents,
  recentTrips,
  cardHistory,
  lossBreakdown,
  managementReport,
  openingSnapshotLabel,
  lookupCards,
  lookupDateError,
  defaultCardLookupFilters,
  readCardLookupParams,
  reportLookupFilters,
  setCardLookupParams,
} = require("/tmp/vparking-model-tests/report-model.js")

test("unified report charts reconcile with the ledger and exclusive status groups", () => {
  const report = managementReport(defaults)
  assert.deepEqual(report.metrics, stockMetrics(defaults))
  assert.equal(report.circulation.length, report.metrics[7])
  assert.equal(
    report.groups.reduce((sum, group) => sum + group.cards.length, 0),
    report.circulation.length,
  )
  assert.equal(
    report.statuses.reduce((sum, group) => sum + group.cards.length, 0),
    report.circulation.length,
  )
  const ids = report.statuses.flatMap((group) =>
    group.cards.map((card) => card.id),
  )
  assert.equal(new Set(ids).size, ids.length)
  const alerted = report.alerts.flatMap((group) =>
    group.cards.map((card) => card.id),
  )
  assert.equal(new Set(alerted).size, report.warned)
  assert.ok(alerted.length >= report.warned)
})

test("common period and site/type/vehicle filters drive all report charts", () => {
  for (const f of [
    { ...defaults, start: "2026-10-01", end: "2026-10-04" },
    {
      ...defaults,
      estate: "A",
      park: estates[0].parks[0],
      type: "Thuê bao tháng",
      vehicle: "Ô tô",
    },
    { ...defaults, estate: "B", end: "2026-10-14" },
  ]) {
    for (const groupBy of ["Loại thẻ", "Loại phương tiện", "Nhóm khách hàng"]) {
      const report = managementReport(f, undefined, groupBy)
      assert.deepEqual(report.metrics, stockMetrics(f))
      assert.equal(report.circulation.length, report.metrics[7])
      assert.equal(
        report.groups.reduce((sum, group) => sum + group.cards.length, 0),
        report.circulation.length,
      )
      assert.ok(
        report.closing.every(
          (card) =>
            (!f.estate || card.estate === f.estate) &&
            (!f.park || card.park === f.park) &&
            (!f.type || card.type === f.type) &&
            (!f.vehicle || card.vehicle === f.vehicle),
        ),
      )
    }
  }
  assert.notDeepEqual(
    managementReport(defaults).metrics,
    managementReport({ ...defaults, end: "2026-10-04" }).metrics,
  )
})

test("no-data report scopes produce zero counts and empty chart groups", () => {
  const report = managementReport({
    ...defaults,
    estate: "A",
    park: estates[1].parks[0],
  })
  assert.ok(report.metrics.every((count) => count === 0))
  assert.equal(report.circulation.length, 0)
  assert.equal(report.warned, 0)
  assert.ok(report.groups.every((group) => group.cards.length === 0))
})

test("M1 totals and each estate reconcile with the PRD fixture", () => {
  assert.deepEqual(
    stockMetrics(defaults),
    [162, 1838, 60, 200, 40, 10, 60, 1990],
  )
  for (const estate of estates)
    assert.deepEqual(
      stockMetrics({ ...defaults, estate: estate.id }),
      estate.values,
    )
})
test("each drilldown matches the displayed count and exact occurrences", () => {
  for (const estate of estates)
    for (let i = 0; i < 8; i++) {
      const result = metricCards({ ...defaults, estate: estate.id }, i)
      assert.equal(result.count, estate.values[i])
      assert.equal(result.cards.length, Object.keys(result.occurrences).length)
      assert.equal(
        Object.values(result.occurrences).reduce((a, b) => a + b, 0),
        result.count,
      )
    }
  const issued = metricCards({ ...defaults, estate: "A" }, 3)
  assert.equal(issued.count, 80)
  assert.equal(issued.cards.length, 79)
})
test("report links preserve the clicked scope and each repeated event on reload", () => {
  const scope = { ...defaults, estate: "A", park: estates[0].parks[0] }
  for (const index of [0, 2, 3, 4, 5, 6, 7]) {
    const params = new URLSearchParams()
    const preset = reportLookupFilters(defaults, { kind: "metric", index, estate: scope.estate, park: scope.park })
    setCardLookupParams(params, preset)
    const filters = readCardLookupParams(params, defaults)
    const lookup = lookupCards(filters)
    const expected = metricCards(scope, index)
    assert.equal(filters.park, scope.park)
    assert.equal((lookup.events || lookup.cards).length, expected.count)
    if (index === 3) {
      assert.equal(lookup.events.length, 32)
      assert.equal(lookup.cards.length, 31)
      assert.ok(lookup.events.every((event) => event.kind === "issue" && event.park === scope.park))
    }
  }
  assert.equal(openingSnapshotLabel(defaults.start), "Chốt hết ngày 30/09/2026")
  assert.equal(openingSnapshotLabel("2026-09-01"), "Số dư đầu ngày 01/09/2026")
})

test("report lookup matches circulation groups, usage status and alerts", () => {
  const selection = { kind: "circulation", groupBy: "Nhóm khách hàng", group: "Cư dân", status: "Hết hạn", estate: "A" }
  const params = new URLSearchParams()
  setCardLookupParams(params, reportLookupFilters(defaults, selection))
  const report = managementReport({ ...defaults, estate: "A" }, undefined, selection.groupBy)
  const expiredIds = new Set(report.statuses.find((item) => item.label === selection.status).cards.map((card) => card.id))
  const expected = report.groups.find((item) => item.label === selection.group).cards.filter((card) => expiredIds.has(card.id))
  assert.deepEqual(lookupCards(readCardLookupParams(params, defaults)).cards, expected)
  const applied = { ...defaults, estate: "B", end: "2026-10-14" }
  managementReport(applied).alerts.forEach(({ cards, id }) => {
    assert.deepEqual(lookupCards(reportLookupFilters(applied, { kind: "alert", id })).cards, cards)
  })
})

test("lookup filters can broaden and change the report selection independently", () => {
  const report = { ...defaults, estate: "A", park: estates[0].parks[0], type: "Thuê bao tháng" }
  const preset = reportLookupFilters(report, { kind: "metric", index: 3 })
  assert.equal(preset.movement, "issue")
  const edited = { ...preset, estate: "", park: "", type: "", movement: "return" }
  const params = new URLSearchParams()
  setCardLookupParams(params, edited)
  const restored = readCardLookupParams(params, report)
  assert.deepEqual(restored, edited)
  assert.equal(lookupCards(restored).events.length, metricCards(defaults, 4).count)
  assert.equal(report.estate, "A")
  assert.equal(report.type, "Thuê bao tháng")
  assert.equal(lookupDateError({ ...edited, start: "2026-10-20", end: "2026-10-19" }), "Từ ngày phải trước hoặc bằng Đến ngày.")
  const all = lookupCards({ ...edited, movement: "" }).events
  assert.equal(all.length, stockMetrics(defaults).slice(2, 6).reduce((total, value) => total + value, 0))
})

test("unified lookup uses the current cards and preserves shared filters across modes", () => {
  assert.deepEqual(readCardLookupParams(new URLSearchParams(), defaults), defaultCardLookupFilters)
  const report = { ...defaults, estate: "A", park: estates[0].parks[0] }
  const filters = reportLookupFilters(report, { kind: "metric", index: 3 })
  const issued = lookupCards(filters)
  const repeatedCard = issued.cards.find((card) =>
    issued.events.filter((event) => event.cardId === card.id).length > 1,
  )
  const movement = { ...filters, keyword: repeatedCard.id }
  assert.equal(lookupCards(movement).events.length, 2)
  const current = { ...movement, mode: "current", movement: "", status: "Khóa" }
  const params = new URLSearchParams()
  setCardLookupParams(params, current)
  const restored = readCardLookupParams(params, defaults)
  const changedCard = { ...repeatedCard, status: "Khóa" }
  assert.deepEqual(restored, current)
  assert.deepEqual(lookupCards(restored, undefined, [changedCard]).cards, [changedCard])
  assert.equal(lookupCards({ ...restored, status: "Trong kho" }, undefined, [changedCard]).cards.length, 0)
})
test("parking rows and vehicle/type filters remain additive", () => {
  for (const estate of estates) {
    const totals = Array(8).fill(0)
    for (const park of estate.parks) {
      const f = { ...defaults, estate: estate.id, park }
      const v = stockMetrics(f)
      const losses = lossBreakdown(f)
      assert.equal(
        v[1] + v[3] - v[4] - losses.circulatingLost - losses.circulatingDamaged,
        v[7],
      )
      assert.equal(
        v[0] +
          v[2] +
          v[4] -
          v[3] -
          losses.warehouseLost -
          losses.warehouseDamaged,
        v[6],
      )
      v.forEach((n, i) => (totals[i] += n))
    }
    for (const index of [0, 1, 2, 3, 4, 5, 6, 7])
      assert.equal(totals[index], estate.values[index])
  }
  const total = stockMetrics(defaults)
  for (const [key, options] of [
    ["type", cardTypes],
    ["vehicle", vehicles],
  ]) {
    const sum = Array(8).fill(0)
    for (const value of options)
      stockMetrics({ ...defaults, [key]: value }).forEach(
        (n, i) => (sum[i] += n),
      )
    assert.deepEqual(sum, total)
  }
  assert.deepEqual(
    stockMetrics({ ...defaults, estate: "A", park: estates[0].parks[0] }),
    [12, 300, 20, 32, 6, 2, 5, 325],
  )
})
test("changing dates changes events and start/end snapshots", () => {
  const quiet = stockMetrics({
    ...defaults,
    start: "2026-10-01",
    end: "2026-10-02",
  })
  assert.deepEqual(quiet, [162, 1838, 0, 0, 0, 0, 162, 1838])
  const live = stockMetrics({
    ...defaults,
    start: "2026-09-01",
    end: "2026-09-30",
  })
  assert.deepEqual(live, quiet)
  assert.equal(
    stockMetrics({ ...defaults, start: "2026-10-18", end: "2026-10-28" })[3],
    1,
  )
})
test("M2 classifications and M3 alerts match the same closing snapshot", () => {
  const rows = snapshot(defaults.end)
  const circulating = rows.filter((c) =>
    ["Đang hoạt động", "Khóa"].includes(c.status),
  )
  assert.equal(circulating.length, 1990)
  assert.equal(circulating.filter((c) => c.status === "Khóa").length, 42)
  assert.equal(
    circulating.filter(
      (c) =>
        c.status === "Đang hoạt động" && c.expiry && c.expiry < defaults.end,
    ).length,
    18,
  )
  assert.deepEqual(
    managementReport(defaults).alerts.map(({ id, cards }) => [id, cards.length]),
    [[0, 2], [2, 2], [3, 1]],
  )
  assert.ok(rows.every((card) => !card.alerts.includes(1)))
  assert.equal(readCardLookupParams(new URLSearchParams("alertGroup=1"), defaults).alert, "")
})
test("alert thresholds affect their actual underlying rules", () => {
  const rows = snapshot(defaults.end, () => ({
    expiry: 1,
    loss: 5,
    unused: 60,
    effective: "2026-09-01",
  }))
  assert.equal(rows.filter((c) => c.alerts.includes(0)).length, 0)
  assert.equal(rows.filter((c) => c.alerts.includes(3)).length, 0)
})
test("recent trips do not contradict the card's last-use date", () => {
  const unused = snapshot(defaults.end).find((c) => c.alerts.includes(3))
  assert.ok(unused)
  assert.ok(recentTrips(unused).every((t) => t.day <= unused.lastTrip))
  assert.ok(cardEvents.every((e) => e.before !== null || e.kind === "import"))
})
test("loss splits and history stay consistent with the selected period", () => {
  for (const estate of estates) {
    const f = { ...defaults, estate: estate.id }
    assert.equal(
      Object.values(lossBreakdown(f)).reduce((a, b) => a + b, 0),
      stockMetrics(f)[5],
    )
  }
  const card = snapshot("2026-10-06").find((c) => c.estate === "B")
  assert.ok(
    cardHistory(card, "2026-10-06").every(
      (e) => e.at.slice(0, 10) <= "2026-10-06",
    ),
  )
})
