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
    [0, 1, 2, 3].map((a) => rows.filter((c) => c.alerts.includes(a)).length),
    [2, 1, 2, 1],
  )
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
