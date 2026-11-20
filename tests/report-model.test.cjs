const test = require("node:test")
const assert = require("node:assert/strict")
const {
  defaults,
  estates,
  cardTypes,
  cardStatuses,
  vehicles,
  today,
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
  lookupSnapshotDay,
  lookupDateError,
  lookupStatuses,
  lookupCardStatus,
  normalizeLookupStatuses,
  circulatingLookupStatuses,
  lookupStatusesForLifecycle,
  defaultCardLookupFilters,
  readCardLookupParams,
  reportLookupFilters,
  setCardLookupParams,
  lookupAlerts,
  isReportCardLookup,
  lookupParkKey,
  lookupSelection,
  lookupSelectionError,
  lookupParkOptions,
  movementKinds,
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
    assert.deepEqual(filters.park, [lookupParkKey(scope.estate, scope.park)])
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
  assert.deepEqual(preset.movement, ["issue"])
  const edited = { ...preset, estate: [], park: [], type: [], movement: ["return"] }
  const params = new URLSearchParams()
  setCardLookupParams(params, edited)
  const restored = readCardLookupParams(params, report)
  assert.deepEqual(restored, edited)
  assert.equal(lookupCards(restored).events.length, metricCards(defaults, 4).count)
  assert.equal(report.estate, "A")
  assert.equal(report.type, "Thuê bao tháng")
  assert.equal(lookupDateError({ ...edited, start: "2026-10-20", end: "2026-10-19" }), "Từ ngày phải trước hoặc bằng Đến ngày.")
  const all = lookupCards({ ...edited, movement: [] }).events
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
  const current = { ...movement, mode: "current", start: today, end: today, movement: [], statuses: ["Khóa"] }
  const params = new URLSearchParams()
  setCardLookupParams(params, current)
  const restored = readCardLookupParams(params, defaults)
  const changedCard = { ...repeatedCard, status: "Khóa" }
  assert.deepEqual(restored, current)
  assert.deepEqual(lookupCards(restored, undefined, [changedCard]).cards, [changedCard])
  assert.equal(lookupCards({ ...restored, statuses: ["Trong kho"] }, undefined, [changedCard]).cards.length, 0)
})

test("stock drilldowns use a single snapshot day or the full movement period and retain scope on reload", () => {
  for (const estate of estates) for (const park of ["", ...estate.parks]) {
    const report = { ...defaults, start: "2026-10-05", end: "2026-10-20", estate: estate.id, park,
      type: "Thuê bao tháng", vehicle: "Xe máy" }
    for (let index = 0; index < 8; index++) {
      const preset = reportLookupFilters(report, { kind: "metric", index })
      const movement = index >= 2 && index <= 5
      const day = index < 2 ? "2026-10-04" : report.end
      assert.equal(preset.start, movement ? report.start : day)
      assert.equal(preset.end, day)
      assert.equal(lookupDateError(preset), "")
      const params = new URLSearchParams()
      setCardLookupParams(params, preset)
      const restored = readCardLookupParams(params, report)
      assert.deepEqual(restored, preset)
      const result = lookupCards(restored)
      const expected = metricCards(report, index)
      assert.equal((result.events || result.cards).length, expected.count)
      assert.deepEqual(result.cards.map((card) => card.id), expected.cards.map((card) => card.id))
      assert.equal(result.asOf, index < 2 ? "2026-10-04" : report.end)
    }
  }
})

test("circulation and alert drilldowns retain their category, status, scope and period", () => {
  for (const groupBy of ["Loại thẻ", "Loại phương tiện", "Nhóm khách hàng"]) {
    for (const estate of estates) {
      const report = { ...defaults, start: "2026-10-03", end: "2026-10-24", estate: estate.id,
        park: estate.parks[0], type: groupBy === "Loại thẻ" ? "" : "Thuê bao tháng",
        vehicle: groupBy === "Loại phương tiện" ? "" : "Ô tô" }
      const data = managementReport(report, undefined, groupBy)
      const selections = [
        ...data.groups.flatMap((group) => [undefined, ...data.statuses.map((status) => status.label)]
          .map((status) => ({ selection: { kind: "circulation", groupBy, group: group.label, status },
            expected: group.cards.filter((card) => !status ||
              data.statuses.find((row) => row.label === status).cards.some((row) => row.id === card.id)) }))),
        ...data.statuses.map((status) => ({ selection: { kind: "circulation", status: status.label }, expected: status.cards })),
        ...data.alerts.map((alert) => ({ selection: { kind: "alert", id: alert.id }, expected: alert.cards })),
      ]
      for (const { selection, expected } of selections) {
        const preset = reportLookupFilters(report, selection)
        const params = new URLSearchParams()
        setCardLookupParams(params, preset)
        const restored = readCardLookupParams(params, report)
        assert.deepEqual(restored, preset)
        assert.equal(restored.start, report.end)
        assert.equal(restored.end, report.end)
        assert.deepEqual(restored.estate, [report.estate])
        assert.deepEqual(restored.park, [lookupParkKey(report.estate, report.park)])
        assert.deepEqual(lookupCards(restored).cards.map((card) => card.id), expected.map((card) => card.id))
      }
    }
  }
})

test("opening balances and older snapshot links resolve to an explicit single-day period", () => {
  const report = { ...defaults, start: "2026-09-01", end: "2026-09-20" }
  for (const index of [0, 1]) {
    const preset = reportLookupFilters(report, { kind: "metric", index })
    assert.equal(lookupSnapshotDay(preset), "2026-09-01")
    assert.equal(preset.start, "2026-09-01")
    assert.equal(preset.end, "2026-09-01")
    assert.equal(lookupDateError(preset), "")
    const params = new URLSearchParams()
    setCardLookupParams(params, preset)
    assert.deepEqual(readCardLookupParams(params, report), preset)
  }
  for (const source of [report, defaults]) {
    const day = source.start === "2026-09-01" ? source.start : "2026-09-30"
    const legacy = new URLSearchParams({ lookupMode: "snapshot", lookupFrom: "report",
      lookupStart: source.start, lookupEnd: day, lookupStatus: "Trong kho" })
    const restored = readCardLookupParams(legacy, source)
    assert.equal(restored.start, day)
    assert.equal(restored.end, day)
    assert.equal(lookupCards(restored).cards.length, metricCards(source, 0).count)
    legacy.set("lookupSnapshotAt", "opening")
    legacy.set("lookupEnd", source.end)
    assert.deepEqual(readCardLookupParams(legacy, source), restored)
  }
  const oneDay = { ...defaultCardLookupFilters, mode: "snapshot", start: "2026-09-01", end: "2026-09-01" }
  const params = new URLSearchParams({ lookupFrom: "report" })
  setCardLookupParams(params, oneDay)
  assert.deepEqual(readCardLookupParams(params, report), oneDay)
})

test("replacing URL lookup filters clears stale movement, category, alert and legacy selections", () => {
  const params = new URLSearchParams({ metric: "3", circulation: "1", groupBy: "Loại thẻ", group: "VIP",
    usage: "Khóa", alertGroup: "0", screen: "stock" })
  const selected = reportLookupFilters(defaults, { kind: "alert", id: 0 })
  setCardLookupParams(params, { ...selected, keyword: "A", group: ["Cư dân"] })
  setCardLookupParams(params, defaultCardLookupFilters)
  assert.equal(params.get("screen"), "stock")
  assert.deepEqual(readCardLookupParams(params, defaults), defaultCardLookupFilters)
  assert.deepEqual([...params.keys()], ["screen"])
})

test("snapshot periods validate both endpoints and ordering", () => {
  const filters = reportLookupFilters(defaults, { kind: "metric", index: 0 })
  assert.equal(lookupDateError({ ...filters, start: "2026-10-21", end: "2026-10-20" }), "Từ ngày phải trước hoặc bằng Đến ngày.")
  assert.ok(lookupDateError({ ...filters, start: "" }))
  assert.ok(lookupDateError({ ...filters, end: "" }))
})

test("movement lookup applies status, customer group and alert filters at the period end", () => {
  const base = reportLookupFilters(defaults, { kind: "metric", index: 3 })
  const unfiltered = lookupCards(base)
  const endCards = snapshot(base.end)
  const cases = [
    { statuses: ["Trong kho"] }, { statuses: ["Đang hoạt động"] }, { statuses: circulatingLookupStatuses },
    { statuses: ["Khóa"] }, { statuses: ["Hết hạn"] }, { statuses: ["Mất / hỏng"] },
    { group: ["Cư dân"] }, { type: ["VIP", "Vãng lai"] },
    { alert: ["Sắp hết hạn"] }, { alert: ["Không khớp thông tin"] }, { alert: ["Cấp nhưng không sử dụng"] },
    { group: ["Cư dân"], statuses: ["Đang hoạt động"], alert: ["Cấp nhưng không sử dụng"] },
  ]
  for (const patch of cases) {
    const filters = { ...base, ...patch }
    const allowed = new Set(lookupCards({ ...filters, mode: "snapshot" }).cards.map((card) => card.id))
    const expected = unfiltered.events.filter((event) => allowed.has(event.cardId))
    const actual = lookupCards(filters)
    assert.deepEqual(actual.events, expected)
    assert.deepEqual(new Set(actual.cards.map((card) => card.id)), new Set(expected.map((event) => event.cardId)))
    const params = new URLSearchParams()
    setCardLookupParams(params, filters)
    assert.deepEqual(readCardLookupParams(params, defaults), filters)
  }
  const returns = { ...base, movement: ["return"] }
  const returnedThenIssued = lookupCards(returns).events.find((event) =>
    endCards.find((card) => card.id === event.cardId)?.status === "Đang hoạt động")
  assert.ok(returnedThenIssued)
  assert.equal(returnedThenIssued.after.status, "Trong kho")
  assert.ok(lookupCards({ ...returns, statuses: ["Đang hoạt động"] }).events.includes(returnedThenIssued))
  assert.ok(!lookupCards({ ...returns, statuses: ["Trong kho"] }).events.includes(returnedThenIssued))
})

test("equal dates on today mean current state and the alert filter still applies", () => {
  assert.equal(lookupDateError(defaultCardLookupFilters), "")
  assert.equal(defaultCardLookupFilters.start, today)
  assert.equal(defaultCardLookupFilters.end, today)
  const cards = snapshot(defaults.end)
  const filters = { ...defaultCardLookupFilters, alert: ["Sắp hết hạn"] }
  assert.deepEqual(lookupCards(filters, undefined, cards).cards, cards.filter((card) => card.alerts.includes(0)))
  assert.ok(lookupDateError({ ...filters, mode: "snapshot", start: defaults.start }))
})

test("five disjoint lookup groups reconcile while lifecycle remains four states", () => {
  assert.deepEqual(cardStatuses, ["Trong kho", "Đang hoạt động", "Khóa", "Mất / hỏng"])
  assert.deepEqual(lookupStatuses, [...cardStatuses, "Hết hạn"])
  const base = { ...defaultCardLookupFilters, mode: "snapshot", start: defaults.end, end: defaults.end }
  const expectedCounts = [60, 1930, 42, 10, 18]
  const allIds = []
  for (const [index, status] of lookupStatuses.entries()) {
    const result = lookupCards({ ...base, statuses: [status] }).cards
    assert.equal(result.length, expectedCounts[index])
    assert.ok(result.every((card) => lookupCardStatus(card, defaults.end) === status))
    assert.ok(result.every((card) => cardStatuses.includes(card.status)))
    allIds.push(...result.map((card) => card.id))
  }
  assert.equal(new Set(allIds).size, allIds.length)
  assert.equal(allIds.length, snapshot(defaults.end).length)
})

test("report links select the corresponding lookup groups and preserve counts on reload", () => {
  const report = managementReport(defaults)
  const selections = [
    { selection: { kind: "metric", index: 7 }, expected: report.circulation },
    ...report.statuses.map((row) => ({ selection: { kind: "circulation", status: row.label }, expected: row.cards })),
  ]
  for (const { selection, expected } of selections) {
    const filters = reportLookupFilters(defaults, selection)
    assert.deepEqual(filters.statuses, selection.status ? [selection.status] : circulatingLookupStatuses)
    const params = new URLSearchParams()
    setCardLookupParams(params, filters)
    const restored = readCardLookupParams(params, defaults)
    assert.deepEqual(restored, filters)
    assert.deepEqual(lookupCards(restored).cards, expected)
  }
})

test("legacy report classifications and the former active lifecycle filter migrate without broadening", () => {
  for (const usage of ["Lưu hành", "Đang sử dụng", "Hết hạn"]) {
    const params = new URLSearchParams({ lookupMode: "snapshot", lookupStart: defaults.end,
      lookupEnd: defaults.end, lookupEstate: "A", lookupStatus: usage })
    const filters = readCardLookupParams(params, defaults)
    const mapped = usage === "Lưu hành" ? circulatingLookupStatuses : [usage === "Đang sử dụng" ? "Đang hoạt động" : usage]
    assert.deepEqual(filters.statuses, mapped)
    assert.deepEqual(filters.estate, ["A"])
    const data = managementReport({ ...defaults, estate: "A" })
    const expected = usage === "Lưu hành" ? data.circulation : data.statuses.find((row) => row.label === mapped[0]).cards
    assert.deepEqual(lookupCards(filters).cards, expected)
    setCardLookupParams(params, filters)
    assert.equal(params.has("lookupStatus"), false)
    assert.equal(params.has("lookupUsage"), false)
    assert.deepEqual(readCardLookupParams(params, defaults), filters)
  }
  const params = new URLSearchParams({ lookupMode: "snapshot", lookupStart: defaults.end, lookupEnd: defaults.end,
    lookupStatus: "Đang hoạt động" })
  const filters = readCardLookupParams(params, defaults)
  assert.deepEqual(filters.statuses, ["Đang hoạt động", "Hết hạn"])
  assert.deepEqual(lookupCards(filters).cards, snapshot(defaults.end).filter((card) => card.status === "Đang hoạt động"))
  for (const oldUsage of ["Đang sử dụng", "Đang hoạt động"]) {
    params.set("lookupUsage", oldUsage)
    assert.deepEqual(readCardLookupParams(params, defaults).statuses, ["Đang hoạt động"])
  }
  params.set("lookupUsage", "Hết hạn")
  assert.deepEqual(readCardLookupParams(params, defaults).statuses, ["Hết hạn"])
  params.set("lookupStatus", "Khóa")
  const none = readCardLookupParams(params, defaults)
  assert.deepEqual(none.statuses, [])
  assert.equal(lookupCards(none).cards.length, 0)
  setCardLookupParams(params, none)
  assert.deepEqual(readCardLookupParams(params, defaults), none)
})

test("all status combinations are unions without duplicates and survive serialization", () => {
  const base = { ...defaultCardLookupFilters, mode: "snapshot", start: defaults.end, end: defaults.end }
  const cards = snapshot(defaults.end)
  for (let mask = 0; mask < 32; mask++) {
    const statuses = lookupStatuses.filter((_, index) => mask & (1 << index))
    const filters = { ...base, statuses }
    const params = new URLSearchParams()
    setCardLookupParams(params, filters)
    const restored = readCardLookupParams(params, defaults)
    assert.deepEqual(restored, filters)
    const expected = cards.filter((card) => statuses.includes(lookupCardStatus(card, defaults.end)))
    assert.deepEqual(lookupCards(restored).cards, expected)
  }
  assert.deepEqual(normalizeLookupStatuses(["Hết hạn", "Khóa", "Khóa", "unknown"]), ["Khóa", "Hết hạn"])
})

test("expiry uses the selected day and never overrides stock, locked or lost lifecycle states", () => {
  const card = { ...snapshot(defaults.end)[0], status: "Đang hoạt động", expiry: "2026-10-20" }
  assert.equal(lookupCardStatus(card, "2026-10-20"), "Đang hoạt động")
  assert.equal(lookupCardStatus(card, "2026-10-21"), "Hết hạn")
  assert.equal(lookupCardStatus({ ...card, expiry: "" }, "2026-10-21"), "Đang hoạt động")
  for (const status of ["Trong kho", "Khóa", "Mất / hỏng"])
    assert.equal(lookupCardStatus({ ...card, status }, "2026-10-21"), status)
  assert.deepEqual(lookupStatusesForLifecycle("Đang hoạt động"), ["Đang hoạt động", "Hết hạn"])
})

test("legacy report usage links keep supporting the former active label", () => {
  const params = new URLSearchParams({ circulation: "1", usage: "Đang sử dụng" })
  const restored = readCardLookupParams(params, defaults)
  assert.deepEqual(restored.statuses, ["Đang hoạt động"])
  assert.equal(lookupCards(restored).cards.length, 1930)
})

test("the overall alert link returns unique warned cards with complete scope and reload support", () => {
  const scopes = [
    defaults,
    { ...defaults, start: "2026-10-05", end: "2026-10-20", estate: "A", type: "Thuê bao tháng", vehicle: "Xe máy" },
    ...estates.map((estate) => ({ ...defaults, estate: estate.id, park: estate.parks[0] })),
    { ...defaults, start: "2026-09-01", end: "2026-09-01" },
  ]
  let foundOverlappingAlerts = false
  for (const applied of scopes) {
    const report = managementReport(applied)
    const expected = report.closing.filter((card) => card.alerts.length > 0)
    const filters = reportLookupFilters(applied, { kind: "alert", id: "all" })
    assert.deepEqual(filters.alert, lookupAlerts)
    assert.equal(filters.start, applied.end)
    assert.equal(filters.end, applied.end)
    for (const key of ["estate", "type", "vehicle"]) assert.deepEqual(filters[key], lookupSelection(applied[key]))
    assert.deepEqual(filters.park, applied.park ? [lookupParkKey(applied.estate, applied.park)] : [])
    const params = new URLSearchParams({ lookupFrom: "report" })
    setCardLookupParams(params, filters)
    const restored = readCardLookupParams(params, applied)
    assert.deepEqual(restored, filters)
    const result = lookupCards(restored)
    assert.deepEqual(result.cards, expected)
    assert.equal(result.cards.length, report.warned)
    assert.equal(new Set(result.cards.map((card) => card.id)).size, result.cards.length)
    foundOverlappingAlerts ||= report.alerts.reduce((total, group) => total + group.cards.length, 0) > report.warned
  }
  assert.ok(foundOverlappingAlerts)
  const empty = { ...defaultCardLookupFilters, mode: "snapshot", start: "2026-09-01", end: "2026-09-01", alert: [...lookupAlerts] }
  assert.equal(lookupCards(empty).cards.length, 0)
})

test("legacy report routes retain their report origin and back-navigation context", () => {
  for (const params of [
    new URLSearchParams({ metric: "1", lookupEstate: "B" }),
    new URLSearchParams({ circulation: "1", usage: "Đang sử dụng" }),
    new URLSearchParams({ alertGroup: "all" }),
    new URLSearchParams({ lookupMode: "snapshot", lookupFrom: "report" }),
  ]) {
    assert.equal(isReportCardLookup(params), true)
    const filters = readCardLookupParams(params, defaults)
    const rewritten = new URLSearchParams({ lookupFrom: "report" })
    setCardLookupParams(rewritten, filters)
    assert.equal(isReportCardLookup(rewritten), true)
    assert.deepEqual(readCardLookupParams(rewritten, defaults), filters)
  }
  assert.equal(isReportCardLookup(new URLSearchParams()), false)
  assert.equal(isReportCardLookup(new URLSearchParams({ metric: "bad" })), false)
  assert.equal(isReportCardLookup(new URLSearchParams({ lookupMode: "current", metric: "3" })), false)
})

test("circulation detail rows preserve the clicked estate, category and status together", () => {
  const applied = { ...defaults, start: "2026-10-07", end: "2026-10-23" }
  for (const estate of estates) for (const groupBy of ["Loại thẻ", "Loại phương tiện", "Nhóm khách hàng"]) {
    const report = managementReport({ ...applied, estate: estate.id }, undefined, groupBy)
    for (const group of report.groups) for (const status of [undefined, ...report.statuses.map((row) => row.label)]) {
      const expected = group.cards.filter((card) => !status ||
        report.statuses.find((row) => row.label === status).cards.some((candidate) => candidate.id === card.id))
      const filters = reportLookupFilters(applied, { kind: "circulation", estate: estate.id, groupBy, group: group.label, status })
      const params = new URLSearchParams()
      setCardLookupParams(params, filters)
      const restored = readCardLookupParams(params, applied)
      assert.deepEqual(restored.estate, [estate.id])
      assert.deepEqual(lookupCards(restored).cards, expected)
    }
  }
})

test("multi selections union within a field and intersect across every lookup field", () => {
  const base = { ...defaultCardLookupFilters, mode: "snapshot", start: "2026-10-20", end: "2026-10-20" }
  const all = snapshot(base.end)
  const fields = [
    ["estate", ["A", "B"]],
    ["park", lookupParkOptions.slice(0, 2).map((option) => option.value)],
    ["type", ["VIP", "Vãng lai"]],
    ["vehicle", ["Ô tô", "Xe máy"]],
    ["group", ["Cư dân", "Gian hàng"]],
    ["alert", ["Sắp hết hạn", "Không khớp thông tin"]],
  ]
  for (const [field, values] of fields) {
    const expected = new Set(values.flatMap((value) => lookupCards({ ...base, [field]: [value] }).cards.map((card) => card.id)))
    const filters = { ...base, [field]: values }
    const actual = lookupCards(filters).cards
    assert.deepEqual(actual, all.filter((card) => expected.has(card.id)), field)
    assert.equal(new Set(actual.map((card) => card.id)).size, actual.length)
    const params = new URLSearchParams()
    setCardLookupParams(params, filters)
    assert.deepEqual(readCardLookupParams(params, defaults), filters)
  }
  const filters = { ...base, estate: ["A", "B"], type: ["Thuê bao tháng", "Vãng lai"],
    vehicle: ["Ô tô", "Xe máy"], statuses: ["Đang hoạt động", "Hết hạn"], group: ["Cư dân", "Gian hàng"],
    alert: ["Sắp hết hạn", "Cấp nhưng không sử dụng"] }
  const constraints = Object.entries(filters).filter(([key]) => fields.some(([field]) => field === key) || key === "statuses")
  const allowed = constraints.map(([key, value]) => new Set(lookupCards({ ...base, [key]: value }).cards.map((card) => card.id)))
  assert.deepEqual(lookupCards(filters).cards, all.filter((card) => allowed.every((ids) => ids.has(card.id))))
})

test("multiple movement kinds preserve event order, repetitions, event parking and end-day filters", () => {
  const base = reportLookupFilters(defaults, { kind: "metric", index: 3 })
  for (let mask = 1; mask < 16; mask++) {
    const movement = movementKinds.filter((_, index) => mask & (1 << index))
    const filters = { ...base, estate: ["A", "B"], movement, vehicle: ["Ô tô", "Xe máy"] }
    const expected = lookupCards({ ...filters, movement: [] }).events.filter((event) => movement.includes(event.kind))
    const actual = lookupCards(filters)
    assert.deepEqual(actual.events, expected)
    assert.deepEqual(new Set(actual.cards.map((card) => card.id)), new Set(expected.map((event) => event.cardId)))
    const params = new URLSearchParams()
    setCardLookupParams(params, filters)
    assert.deepEqual(readCardLookupParams(params, defaults), filters)
  }
  const parks = [lookupParkKey("A", estates[0].parks[0]), lookupParkKey("B", estates[1].parks[0])]
  const filters = { ...base, movement: ["issue", "return"], estate: ["A", "B"], park: parks, statuses: ["Đang hoạt động", "Khóa"] }
  const results = lookupCards(filters)
  assert.ok(results.events.length)
  for (const event of results.events) {
    const card = results.cards.find((card) => card.id === event.cardId)
    assert.ok(parks.includes(lookupParkKey(card.estate, event.park)))
    assert.ok(filters.statuses.includes(lookupCardStatus(card, filters.end)))
  }
})

test("parking names never widen a selected estate and old singular lookup URLs still migrate", () => {
  const sharedPark = estates[0].parks.find((park) => estates[1].parks.includes(park))
  assert.ok(sharedPark)
  const params = new URLSearchParams({ lookupMode: "snapshot", lookupStart: defaults.end,
    lookupEnd: defaults.end, lookupEstate: "A", lookupPark: sharedPark, lookupType: "VIP", lookupVehicle: "Ô tô" })
  const filters = readCardLookupParams(params, defaults)
  assert.deepEqual(filters.park, [lookupParkKey("A", sharedPark)])
  assert.deepEqual(filters.type, ["VIP"])
  assert.deepEqual(filters.vehicle, ["Ô tô"])
  assert.deepEqual(lookupCards(filters).cards, snapshot(defaults.end).filter((card) =>
    card.estate === "A" && card.park === sharedPark && card.type === "VIP" && card.vehicle === "Ô tô"))
  const qualified = { ...filters, estate: ["A", "B"], type: [], vehicle: [] }
  assert.ok(lookupCards(qualified).cards.every((card) => card.estate === "A"))
  const invalid = { ...filters, estate: ["B"] }
  assert.ok(lookupSelectionError(invalid))
  assert.equal(lookupCards(invalid).cards.length, 0)
})

test("VIP and visitor report aggregates map to card types, including legacy URLs and type intersections", () => {
  for (const type of ["", ...cardTypes]) {
    const report = { ...defaults, type }
    const expected = managementReport(report, undefined, "Nhóm khách hàng").groups.find((group) => group.label === "VIP và Vãng lai").cards
    const filters = reportLookupFilters(report, { kind: "circulation", groupBy: "Nhóm khách hàng", group: "VIP và Vãng lai" })
    assert.deepEqual(filters.group, [])
    assert.ok(!filters.type.includes("Thuê bao tháng"))
    assert.deepEqual(lookupCards(filters).cards, expected)
    const params = new URLSearchParams()
    setCardLookupParams(params, filters)
    assert.deepEqual(readCardLookupParams(params, report), filters)
    const legacy = new URLSearchParams({ lookupMode: "snapshot", lookupStart: defaults.end, lookupEnd: defaults.end,
      lookupGroup: "VIP và Vãng lai", lookupType: type, lookupStatuses: circulatingLookupStatuses.join(",") })
    const restored = readCardLookupParams(legacy, report)
    assert.deepEqual(restored.group, [])
    assert.deepEqual(lookupCards(restored).cards, expected)
  }
})

test("legacy any-warning links become explicit warning selections and conflicting monthly groups are explained", () => {
  const base = { ...defaultCardLookupFilters, mode: "snapshot", start: "2026-10-20", end: "2026-10-20" }
  const filters = { ...base, alert: ["any", "Sắp hết hạn"] }
  const expected = snapshot(base.end).filter((card) => card.alerts.length > 0)
  assert.deepEqual(lookupCards(filters).cards, expected)
  const params = new URLSearchParams()
  setCardLookupParams(params, filters)
  assert.deepEqual(params.getAll("lookupAlert"), lookupAlerts)
  assert.deepEqual(readCardLookupParams(params, defaults).alert, lookupAlerts)
  params.set("lookupAlert", "any")
  const legacy = readCardLookupParams(params, defaults)
  assert.deepEqual(legacy.alert, lookupAlerts)
  assert.deepEqual(lookupCards(legacy).cards, expected)
  assert.ok(lookupSelectionError({ ...base, type: ["VIP", "Vãng lai"], group: ["Cư dân"] }))
  assert.equal(lookupSelectionError({ ...base, type: ["VIP", "Thuê bao tháng"], group: ["Cư dân"] }), "")
  assert.equal(lookupSelectionError({ ...base, group: ["Cư dân"] }), "")
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
  assert.deepEqual(readCardLookupParams(new URLSearchParams("alertGroup=1"), defaults).alert, [])
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
