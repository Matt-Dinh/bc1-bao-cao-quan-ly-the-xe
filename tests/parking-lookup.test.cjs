const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

// Load the pure TypeScript models with the project's existing compiler.
const loaded = new Map()
function model(name) {
  const filename = path.resolve(__dirname, "../src", `${name}.ts`)
  if (loaded.has(filename)) return loaded.get(filename).exports
  const compiled = new Module(filename, module)
  loaded.set(filename, compiled)
  compiled.filename = filename
  compiled.require = (id) => id.startsWith("./") ? model(id.slice(2)) : require(id)
  compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename)
  return compiled.exports
}
const parking = model("parking-model")
const { readSettings, seedTrips, applyTripCorrections } = model("parking-data")
const settings = readSettings()
const fees = model("parking-fees")
const revenue = model("revenue-model")
const { createDemoParkingFeeService } = model("parking-fees-demo")
const lookup = model("parking-lookup")
const filters = { estate: "A", site: "A:0", vehicle: "Ô tô", start: "2026-11-01", end: "2026-11-02" }
const at = (day, hour) => parking.dayStart(day) + hour * 60
const trip = (id, entered, exited) => ({
  id, entered, exited, site: "A:0", vehicle: "Ô tô", group: "Vãng lai", plate: id, ticket: id,
  laneIn: "Làn vào 1", laneOut: "Làn ra 1", sourceIn: "Làn tự động", sourceOut: "Làn tự động",
  owner: "Khách", phone: "", due: 0, paid: 0, voucher: 0,
})
const trips = [
  trip("still-parked", at("2026-10-31", 20), null),
  trip("first-day", at("2026-11-01", 8), at("2026-11-01", 10)),
  trip("overnight", at("2026-10-31", 22), at("2026-11-02", 9)),
  trip("second-day", at("2026-11-02", 11), at("2026-11-02", 13)),
  trip("next-period", at("2026-11-03", 0), at("2026-11-03", 2)),
]
const report = parking.buildParkingReport(trips, settings, filters, parking.demoAccess)
const start = at(filters.start, 0), end = at("2026-11-03", 0)
function fromReport(metric, options = {}) {
  const patch = parking.tripLookupPatch({ metric, label: metric, start, end, ...options }, filters, settings)
  const params = new URLSearchParams(Object.entries(patch).filter(([, value]) => value != null))
  const scopedFilters = { ...filters, ...Object.fromEntries(["estate", "site", "vehicle", "start", "end"].map((key) => [key, patch[key]])) }
  const data = parking.buildParkingReport(trips, settings, scopedFilters, parking.demoAccess)
  const drill = parking.tripLookupDrill(params, scopedFilters, data)
  const source = (drill ? data.bySite.flatMap((site) => site.trips) : data.periodTrips)
    .filter((row) => (!patch.state || parking.statusAt(row, drill?.end ?? end) === patch.state) &&
      (!patch.group || row.group === patch.group))
  return { patch, params, rows: drill ? parking.drillTrips(source, drill, settings, data.total.exceeded) : source.map((trip) => ({ trip })) }
}

test("only the three supported vehicle types appear in configuration and sample trips", () => {
  assert.deepEqual(parking.parkingVehicles, ["Ô tô", "Xe máy", "Xe đạp"])
  assert.ok(seedTrips("2026-11-19").every((row) => parking.parkingVehicles.includes(row.vehicle)))
})

test("behavior counts overlapping events once and applies the same dwell rules in BC2 drill-down", () => {
  const behavior = model("behavior-model")
  const behaviorLookup = model("behavior-lookup")
  const eventDay = "2026-09-19"
  const selected = { start: eventDay, end: eventDay, estates: ["A"], sites: ["A:0"], vehicles: [], guests: ["Vãng lai"], type: "" }
  const events = behaviorLookup.behaviorEvents(settings)
  const entry = at(eventDay, 18)
  const rows = [
    trip("30A-123.45", entry, entry + 15 - 1 / 60),
    trip("30A12345", entry + 15, entry + 135),
    { ...trip("supplemented", entry + 30, entry + 150), sourceOut: "ANBV bổ sung" },
    trip("exclusive-end", at(eventDay, 20), null),
  ]
  const data = behavior.buildBehaviorData(rows, events, settings.holidays, selected, behavior.behaviorScope(selected, parking.demoAccess).sites, eventDay)
  assert.deepEqual(data.arrivals.map(({ events }) => events), Array(3).fill(["SK-03", "SK-04"]).concat([["SK-03"]]))
  assert.equal(behavior.arrivalStats(data.arrivals).n, 2)
  assert.equal(behavior.arrivalStats(data.arrivals).median, 67)
  assert.equal(behavior.returningVehicles(data).find(({ plate }) => plate === "30A12345").rows.length, 2)
  const reportBand = data.arrivals.filter(({ dwell }) => behavior.inBand(dwell, behavior.dwellBands.fine[0]))
  const params = new URLSearchParams({ bEvent: "SK-03,SK-04", bFrom: "0", bTo: "15" })
  const drill = behaviorLookup.prepareBehaviorLookup(params, at("2026-09-20", 0), behavior.indexEvents(events))
  assert.deepEqual(rows.filter(drill).map(({ id }) => id), reportBand.map(({ trip }) => trip.id))
})

test("behavior demo populates calendar types, event comparisons and every returning cohort from shared trips", () => {
  const behavior = model("behavior-model")
  const demo = model("behavior-demo")
  const today = "2026-11-25"
  const demoSettings = demo.withBehaviorDemoSettings({
    ...settings, behaviorDemoVersion: undefined, behaviorEvents: undefined, holidays: [], history: [],
  }, today)
  const selected = { start: "2026-11-01", end: "2026-11-23", estates: [], sites: [], vehicles: [], guests: ["Vãng lai"], type: "" }
  const rows = seedTrips(today)
  const data = behavior.buildBehaviorData(rows, demoSettings.behaviorEvents, demoSettings.holidays, selected,
    behavior.behaviorScope(selected, parking.demoAccess).sites, selected.end)
  assert.deepEqual(new Set(data.days.map(({ kind }) => kind)), new Set(behavior.dayKinds))
  const vehicles = behavior.returningVehicles(data)
  for (const [min, max] of behavior.repeatBands)
    assert.ok(vehicles.some(({ rows }) => rows.length >= min && rows.length < max), `Visits ${min}–${max}`)
  assert.ok(vehicles.some(({ familiar }) => familiar))
  assert.ok(vehicles.some(({ familiar }) => !familiar))
  const events = behavior.summarizeEvents(data, demoSettings.behaviorEvents)
  assert.ok(events.some(({ gain }) => gain > 0))
  assert.ok(events.some(({ gain }) => gain < 0))
  assert.ok(events.some(({ windows }) => windows.length > 1 && windows.every((slot) => slot.rows.length > 0)))
  assert.ok(events.some(({ event }) => event.notes.length > 1))
  const eventStates = demoSettings.behaviorEvents.filter((event) => !event.deleted)
    .map((event) => behavior.eventState(event, at(today, 12)))
  assert.deepEqual(new Set(eventStates), new Set(["Đã diễn ra", "Đang diễn ra", "Sắp diễn ra"]))
  assert.ok(demoSettings.history.some(({ kind }) => kind === "holidays"))

  const previous = demoSettings.behaviorEvents.find(({ id }) => id === "SK-06")
  const custom = { ...previous, name: "Sự kiện tôi đã sửa", deleted: true }
  const migrated = demo.withBehaviorDemoSettings({ ...demoSettings, behaviorDemoVersion: undefined, behaviorEvents: [custom] }, today)
  assert.equal(migrated.behaviorEvents.find(({ id }) => id === custom.id), custom)
  assert.equal(demo.withBehaviorDemoSettings(migrated, "2026-11-26"), migrated)
})

test("legacy event offsets migrate into explicit windows once, including midnight and overlap", () => {
  const behavior = model("behavior-model")
  const demo = model("behavior-demo")
  const original = demo.demoBehaviorEvents("2026-11-25")[0]
  const legacy = { ...original, early: 30, windows: [
    { day: "2026-11-18", start: "00:15", end: "02:00", overnight: false },
    { day: "2026-11-18", start: "02:10", end: "03:00", overnight: false },
  ], history: [], notes: [{ text: "Chú thích đang có", actor: "BQL", at: "2026-11-19T09:00:00Z" }] }
  const converted = behavior.migrateBehaviorEvent(legacy)
  assert.equal(Object.hasOwn(converted, "early"), false)
  assert.deepEqual(converted.windows, [
    { day: "2026-11-17", start: "23:45", end: "03:00", overnight: true },
  ])
  assert.deepEqual(converted.notes, legacy.notes)
  assert.equal(behavior.migrateBehaviorEvent(converted), converted)
  const saved = { ...settings, behaviorDemoVersion: 1, behaviorEvents: [legacy],
    behaviorSnapshot: { refreshDay: "2026-11-25", days: [], affected: {}, events: [legacy], holidays: [] } }
  const updated = demo.withBehaviorDemoSettings(saved, "2026-11-25")
  assert.deepEqual(updated.behaviorEvents[0].windows, converted.windows)
  assert.deepEqual(updated.behaviorSnapshot.events[0].windows, converted.windows)
  assert.equal(demo.withBehaviorDemoSettings(updated), updated)
})

test("trip multi selections retain legacy links, repeated params, special characters and reloads", () => {
  for (const values of [[], ["Ô tô"], ["Ô tô", "Xe máy"], ["x,y", "a+b", "a:b"]]) {
    const encoded = lookup.tripLookupValue(values)
    const params = new URLSearchParams(encoded ? { vehicle: encoded } : {})
    assert.deepEqual(lookup.tripLookupValues(new URLSearchParams(params.toString()), "vehicle"), values)
  }
  assert.deepEqual(lookup.tripLookupValues(new URLSearchParams('estate=A&estate=B&estate=A'), 'estate'), ['A', 'B'])
  assert.deepEqual(lookup.tripLookupValues(new URLSearchParams({ state: "Đang trong bãi" }), "state"), ["Đang trong bãi"])
  assert.equal(lookup.tripLookupValue(["VIP", "VIP"]), "VIP")
  assert.deepEqual(lookup.tripLookupValues(new URLSearchParams({ site: "[broken" }), "site"), ["[broken"])
})

test("multiple sites, estates and vehicle types form unions while scope fields intersect and respect access", () => {
  const rows = [
    { ...trips[0], id: 'a-car', vehicle: 'Ô tô', site: 'A:0' },
    { ...trips[0], id: 'a-bike', vehicle: 'Xe máy', site: 'A:0' },
    { ...trips[0], id: 'b-car', vehicle: 'Ô tô', site: 'B:2' },
    { ...trips[0], id: 'b-cycle', vehicle: 'Xe đạp', site: 'B:2' },
    { ...trips[0], id: 'c-car', vehicle: 'Ô tô', site: 'C:0' },
  ]
  const params = new URLSearchParams({ estate: lookup.tripLookupValue(['A', 'B']), site: lookup.tripLookupValue(['A:0', 'B:2']),
    vehicle: lookup.tripLookupValue(['Ô tô', 'Xe máy']) })
  const scope = lookup.tripLookupScope(params)
  const report = parking.buildParkingReport(rows, settings, filters, parking.demoAccess, scope)
  assert.deepEqual(report.periodTrips.map((row) => row.id).sort(), ['a-bike', 'a-car', 'b-car'])
  assert.equal(report.total.closing, 3)
  assert.equal(new Set(report.bySite.flatMap((site) => site.trips).map((row) => row.id)).size, 3)
  const all = parking.buildParkingReport(rows, settings, filters, parking.demoAccess, lookup.tripLookupScope(new URLSearchParams()))
  assert.equal(all.periodTrips.length, 5)
  assert.ok(lookup.tripLookupScopeDenied(scope, { role: 'manager', estate: 'A' }))
  assert.ok(!lookup.tripLookupScopeDenied(scope, parking.demoAccess))
  const restricted = parking.buildParkingReport(rows, settings, filters, { role: 'manager', estate: 'A' }, scope)
  assert.deepEqual(restricted.periodTrips.map((row) => row.id).sort(), ['a-bike', 'a-car'])
  assert.ok(lookup.tripLookupScopeDenied({ ...scope, estates: ['A'], sites: ['B:2'] }, parking.demoAccess))
})

test("status, group, lane and alert choices union within each field and intersect across fields", () => {
  const rows = [
    { ...trips[0], id: 'open', group: 'Vãng lai', due: 10000, paid: 0 },
    { ...trips[1], id: 'exited', group: 'VIP', due: 10000, paid: 0 },
    { ...trips[2], id: 'other-lane', group: 'Thuê bao', laneIn: 'Làn vào 2', laneOut: 'Làn ra 2' },
  ]
  const params = new URLSearchParams({ state: lookup.tripLookupValue(['missing-exit', 'Đã ra']),
    group: lookup.tripLookupValue(['Vãng lai', 'VIP']), lane: lookup.tripLookupValue(['Làn vào 1', 'Làn ra 1']) })
  const match = () => rows.filter((row) => lookup.tripMatchesLookup(row, params, end, filters, settings, new Map(), end))
  assert.deepEqual(match().map((row) => row.id), ['open', 'exited'])
  params.set('alert', lookup.tripLookupValue([parking.alertTabs[2], parking.alertTabs[3]]))
  assert.deepEqual(match().map((row) => row.id), ['exited'])
  params.delete('alert'); params.delete('group'); params.delete('state'); params.delete('lane')
  assert.equal(match().length, 3)
})

test("multi-vehicle lookup does not apply a car capacity warning to another vehicle", () => {
  const car = { ...trips[0], vehicle: 'Ô tô' }, bike = { ...car, vehicle: 'Xe máy' }
  const map = parking.exceededHoursBySite([{ site: car.site, vehicle: 'Ô tô', day: filters.start,
    hours: [{ exceeded: true, end: start + 60 }] }])
  assert.ok(parking.parkedDuringExceededHour(car, map))
  assert.ok(!parking.parkedDuringExceededHour(bike, map))
})

test("ordinary lookup includes cars entering before the period and excludes the next period", () => {
  assert.deepEqual(report.periodTrips.map((row) => row.id).sort(), ["first-day", "overnight", "second-day", "still-parked"])
  assert.equal(report.total.opening, 2)
  assert.equal(report.total.incoming, 2)
  assert.equal(report.total.outgoing, 3)
  assert.equal(report.total.closing, 1)
})

test("supplement search accepts plate formatting and explains trips already recorded as exited", () => {
  const open = { ...trips[0], plate: "30A-123.45" }
  const closed = { ...trips[1], plate: "30A-123.45" }
  for (const query of ["30a12345", "30A 123 45", "30A–123.45", "30A-123.45"]) {
    const result = parking.supplementTripCandidates([open, closed], [], parking.demoAccess, query, end)
    assert.deepEqual(result.available.map((row) => row.id), [open.id])
    assert.deepEqual(result.recorded.map((row) => row.id), [closed.id])
  }
  assert.ok(parking.supplementTripCandidates([open], [], parking.demoAccess, "3-", end).tooShort)
})

test("supplement search shows current updated trips and never offers an already-recorded exit again", () => {
  const open = { ...trips[0], plate: "30A-123.45" }
  const corrected = { ...open, plate: "30A-999.99", exited: at("2026-11-02", 12) }
  assert.equal(parking.supplementTripCandidates([open], [corrected], parking.demoAccess, "30A12345", end).available.length, 0)
  const result = parking.supplementTripCandidates([open], [corrected], parking.demoAccess, "30A99999", end)
  assert.equal(result.available.length, 0)
  assert.deepEqual(result.recorded, [corrected])
})

test("supplement candidates respect access and exclude future entries from actionable choices", () => {
  const open = { ...trips[0], plate: "30A-123.45" }
  const outside = { ...open, id: "other-estate", site: "B:2" }
  const future = { ...open, id: "future", entered: end + 60 }
  const result = parking.supplementTripCandidates([open, outside, future], [], { role: "manager", estate: "A" }, "30A12345", end)
  assert.deepEqual(result.available, [open])
  assert.deepEqual(result.recorded, [future])
  assert.deepEqual(parking.supplementTripCandidates([open, outside, future], [], { role: "manager", estate: "A" }, "", end).available, [open])
})

test("the supplied demo plates are searchable as actual open trips, including unformatted input", () => {
  const sample = seedTrips("2026-11-19")
  for (const plate of ["18E112239", "30a12345", "30G 246 80"]) {
    const result = parking.supplementTripCandidates(sample, [], parking.demoAccess, plate, at("2026-11-19", 12))
    assert.ok(result.available.some((row) => parking.normalizeTripSearch(row.plate) === parking.normalizeTripSearch(plate)))
  }
  const legacy = { ...trips[0], exited: undefined }
  assert.deepEqual(parking.supplementTripCandidates([legacy], [], parking.demoAccess, legacy.plate, end).available, [legacy])
})

function demoFeeFixture() {
  const original = { ...trips[0], id: "LX-DEMO-TEST", plate: "18E-112239", entered: at("2026-11-18", 9), paid: null }
  const source = new Map([[original.id, original]])
  const service = createDemoParkingFeeService((id) => source.get(id), { now: () => Date.parse("2026-11-19T12:00:00Z") })
  const request = { direction: "exit", tripId: original.id, siteId: original.site, plate: original.plate,
    ticket: original.ticket, vehicle: original.vehicle, customerGroup: original.group,
    enteredAt: fees.feeLocalTime(original.entered), exitedAt: fees.feeLocalTime(original.entered + 180), voucherCodes: [] }
  return { original, source, service, request, signal: new AbortController().signal }
}

test("demo pricing shows amounts and supports voucher and free-hour scenarios", async () => {
  const { service, request, signal } = demoFeeFixture()
  assert.equal(service.isDemo, true)
  const normal = await service.quote(request, signal)
  assert.equal(normal.gross, 30000)
  assert.equal(normal.amountDue, 30000)
  assert.equal(fees.parkingFeeQuoteError(normal, Date.parse("2026-11-19T12:00:00Z")), "")
  const voucher = await service.quote({ ...request, voucherCodes: ["DEMO10K"] }, signal)
  assert.equal(voucher.customerPayable, 20000)
  const free = await service.quote({ ...request, requestedPolicyCode: "CS-01" }, signal)
  assert.equal(free.amountDue, 0)
  await assert.rejects(() => service.quote({ ...request, voucherCodes: ["UNKNOWN"] }, signal))
})

test("demo payment stays pending until explicit simulation and is never counted twice", async () => {
  const { original, source, service, request, signal } = demoFeeFixture()
  const quote = await service.quote(request, signal)
  const pending = await service.createPayment({ quoteId: quote.id, amount: quote.amountDue, method: "QR", idempotencyKey: "SAME-PAYMENT" }, signal)
  assert.equal(pending.status, "pending")
  assert.ok(decodeURIComponent(pending.qrImageUrl).includes("KHONG DUNG DE CHUYEN TIEN"))
  assert.equal((await service.quote(request, signal)).collected, 0)
  assert.equal((await service.createPayment({ quoteId: quote.id, amount: quote.amountDue, method: "QR", idempotencyKey: "SAME-PAYMENT" }, signal)).id, pending.id)
  assert.equal((await service.createPayment({ quoteId: quote.id, amount: quote.amountDue, method: "QR", idempotencyKey: "DIFFERENT-KEY" }, signal)).id, pending.id)
  const commit = { quoteId: quote.id, request, lane: "Làn ra 1", reason: "Làn lỗi không ghi nhận", reference: "BB-DEMO", note: "Mô phỏng", evidence: [], idempotencyKey: "SAME-SAVE" }
  await assert.rejects(() => service.completeSupplement(commit))
  assert.equal((await service.getPayment(pending.id, signal)).status, "paid")
  await service.getPayment(pending.id, signal)
  const paid = await service.quote(request, signal)
  assert.equal(paid.amountDue, 0)
  assert.equal(paid.collected, 30000)
  assert.equal(paid.payments.length, 1)
  const saved = await service.completeSupplement(commit)
  source.set(original.id, fees.tripWithParkingBilling(saved.trip, saved.billing))
  assert.deepEqual(await service.completeSupplement(commit), saved)
  assert.equal(saved.trip.exited, original.entered + 180)
})

test("demo late entry keeps the prior collection and reports excess without charging again", async () => {
  const { original, source, service, request, signal } = demoFeeFixture()
  source.set(original.id, { ...original, exited: original.entered + 180, paid: 30000 })
  const quote = await service.quote({ ...request, direction: "entry", enteredAt: fees.feeLocalTime(original.entered + 60) }, signal)
  assert.equal(quote.gross, 20000)
  assert.equal(quote.collected, 30000)
  assert.equal(quote.amountDue, 0)
  assert.equal(quote.overpaid, 10000)
  assert.equal(quote.payments.length, 1)
})

test("demo repricing expires an old simulated payment and respects cancelled requests", async () => {
  const { service, request, signal } = demoFeeFixture()
  const quote = await service.quote(request, signal)
  const pending = await service.createPayment({ quoteId: quote.id, amount: quote.amountDue, method: "QR", idempotencyKey: "OLD-PRICE" }, signal)
  const next = await service.quote({ ...request, voucherCodes: ["DEMO10K"] }, signal)
  assert.equal(next.amountDue, 20000)
  assert.equal(next.pendingPayment, undefined)
  assert.equal((await service.getPayment(pending.id, signal)).status, "expired")
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(() => service.quote(request, controller.signal), { name: "AbortError" })
})

test("trip warnings retain the three actionable groups and preserve capacity report links separately", () => {
  assert.equal(parking.tripAlertOptions.length, 3)
  assert.ok(!parking.tripAlertOptions.some((option) => option.value === parking.overCapacityTripAlert.value))
  assert.deepEqual(parking.tripAlertOptions.map((option) => option.value), parking.alertTabs.slice(1))
  const patch = parking.tripLookupPatch({ metric: "exceeded", label: "Vượt sức chứa", start, end }, filters, settings)
  assert.equal(patch.tripMode, "exceeded")
  assert.equal(patch.alert, null)
})

function feeQuote(change = {}) {
  return { id: "QUOTE-TEST", expiresAt: "2099-01-01T00:00:00Z", currency: "VND", pricingName: "Kết quả kiểm thử",
    gross: 100000, discounts: [
      { code: "POLICY-TEST", label: "Miễn giảm kiểm thử", kind: "policy", amount: 20000 },
      { code: "VOUCHER-TEST", label: "Voucher kiểm thử", kind: "voucher", amount: 10000 },
    ], customerPayable: 70000, collected: 50000, amountDue: 20000, overpaid: 0,
    payments: [{ id: "PAY-EXISTING", at: end, method: "QR", amount: 50000, status: "Thành công" }], ...change }
}

test("fee integration is disconnected by default and keeps Vietnam timestamps explicit", () => {
  assert.equal(fees.getParkingFeeService(), null)
  assert.equal(fees.feeLocalTime(at("2026-11-02", 11)), "2026-11-02T11:00:00+07:00")
  assert.equal(fees.feeTripMinute("2026-11-02T11:00:00+07:00"), at("2026-11-02", 11))
})

test("automatic fee quotes preserve prior payment and charge only the remaining balance", () => {
  assert.equal(fees.parkingFeeQuoteError(feeQuote()), "")
  const quote = feeQuote({ collected: 70000, amountDue: 0,
    payments: [{ id: "PAY-EXISTING", at: end, method: "QR", amount: 70000, status: "Thành công" }] })
  assert.equal(fees.parkingFeeQuoteError(quote), "")
  const updated = fees.tripWithParkingBilling(trips[1], quote)
  const charge = revenue.chargeForTrip(updated)
  assert.equal(charge.price, 100000)
  assert.equal(charge.discounts.reduce((sum, row) => sum + row.amount, 0), 30000)
  assert.deepEqual(charge.payments, quote.payments)
  assert.equal(revenue.moneyLayers(charge, 0).collected, 70000)
  assert.equal(revenue.moneyLayers(charge, 0).lost, 0)
})

test("late entry reconciliation can report overpayment without inventing a refund", () => {
  const quote = feeQuote({ gross: 80000, customerPayable: 50000, collected: 70000, amountDue: 0, overpaid: 20000,
    payments: [{ id: "PAY-EXISTING", at: end, method: "Tiền mặt", amount: 70000, status: "Thành công" }] })
  assert.equal(fees.parkingFeeQuoteError(quote), "")
  const charge = revenue.chargeForTrip(fees.tripWithParkingBilling(trips[1], quote))
  assert.equal(charge.payments.length, 1)
  assert.equal(revenue.moneyLayers(charge, 0).excess, 20000)
})

test("voucher funding stays separate from discounts in the revenue ledger", () => {
  const quote = feeQuote({ voucherFunding: { code: "FUND-TEST", unit: "UNIT-TEST", amount: 30000, negative: false },
    customerPayable: 40000, collected: 30000, amountDue: 10000,
    payments: [{ id: "PAY-EXISTING", at: end, method: "QR", amount: 30000, status: "Thành công" }] })
  assert.equal(fees.parkingFeeQuoteError(quote), "")
  const amounts = revenue.moneyLayers(revenue.chargeForTrip(fees.tripWithParkingBilling(trips[1], quote)), 0)
  assert.equal(amounts.revenue, 70000)
  assert.equal(amounts.debt, 30000)
  assert.equal(amounts.collected, 30000)
  assert.equal(amounts.lost, 10000)
  assert.ok(fees.parkingFeeQuoteError({ ...quote, voucherFunding: { ...quote.voucherFunding, negative: true } }))
  const negative = feeQuote({ voucherFunding: { code: "NEGATIVE-TEST", unit: "UNIT-TEST", amount: 70000, negative: true },
    customerPayable: 0, collected: 0, amountDue: 0, payments: [] })
  assert.equal(fees.parkingFeeQuoteError(negative), "")
  const negativeCharge = revenue.chargeForTrip(fees.tripWithParkingBilling(trips[1], negative))
  assert.equal(negativeCharge.source, "VA")
  assert.equal(revenue.moneyLayers(negativeCharge, 0).debt, 70000)
})

test("unconfirmed transactions, inconsistent amounts, duplicate payments and expired quotes cannot be accepted", () => {
  assert.ok(fees.parkingFeeQuoteError(feeQuote({ collected: 60000 })))
  assert.ok(fees.parkingFeeQuoteError(feeQuote({ payments: [{ ...feeQuote().payments[0], status: "Chờ xác nhận" }] })))
  assert.ok(fees.parkingFeeQuoteError(feeQuote({ payments: [...feeQuote().payments, ...feeQuote().payments], collected: 100000, amountDue: 0, overpaid: 30000 })))
  assert.ok(fees.parkingFeeQuoteError(feeQuote({ expiresAt: "2000-01-01T00:00:00Z" })))
  assert.ok(fees.parkingFeeQuoteError(feeQuote({ gross: -1 })))
  assert.ok(fees.parkingFeeQuoteError(feeQuote({ payments: [{ ...feeQuote().payments[0], method: "Unknown" }] })))
})

test("pending payment sessions must match the fee quote and its remaining balance", () => {
  const pendingPayment = { id: "SESSION-TEST", quoteId: "QUOTE-TEST", amount: 20000, status: "pending" }
  assert.equal(fees.parkingFeeQuoteError(feeQuote({ pendingPayment })), "")
  assert.ok(fees.parkingFeeQuoteError(feeQuote({ pendingPayment: { ...pendingPayment, amount: 70000 } })))
  assert.ok(fees.parkingFeeQuoteError(feeQuote({ pendingPayment: { ...pendingPayment, quoteId: "ANOTHER-QUOTE" } })))
})

test("saving a reconciled billing snapshot keeps one trip and the same payment identifiers", () => {
  const updated = fees.tripWithParkingBilling(trips[1], feeQuote())
  const state = { ...revenue.initialRevenueState(), tripUpdates: [{ trip: updated, original: trips[1], reason: "Đối soát", at: end }] }
  const rows = revenue.buildLedger([trips[1]], settings, state)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, trips[1].id)
  assert.deepEqual(rows[0].payments.map((row) => row.id), ["PAY-EXISTING"])
  assert.equal(rows[0].collected, 50000)
})

test("report links keep entry, exit, and opening/closing populations distinct", () => {
  for (const metric of ["incoming", "outgoing", "opening", "closing"]) {
    const result = fromReport(metric)
    assert.equal(result.rows.length, report.total[metric], metric)
    assert.equal(result.params.get("reportMetric"), metric)
  }
})

test("hour-specific report links keep the exact interval without a time-mode selector", () => {
  const { rows, patch } = fromReport("incoming", { start: at("2026-11-02", 11), end: at("2026-11-02", 12) })
  assert.equal(patch.hourStart, "11:00")
  assert.equal(patch.hourEnd, "12:00")
  assert.deepEqual(rows.map((row) => row.trip.id), ["second-day"])
})

test("ordinary lookup can narrow the date range by optional start and end times", () => {
  const oneDay = { ...filters, start: "2026-11-02", end: "2026-11-02" }
  const params = new URLSearchParams({ hourStart: "11:00", hourEnd: "12:00" })
  const window = parking.tripLookupWindow(params, oneDay)
  assert.deepEqual(window, { start: at("2026-11-02", 11), end: at("2026-11-02", 12) })
  assert.deepEqual(trips.filter((row) => parking.touches(row, window.start, window.end)).map((row) => row.id), ["still-parked", "second-day"])
  assert.equal(parking.tripLookupTimeError(params, oneDay), "")
})

test("blank time bounds preserve whole-day lookup and support a single time bound", () => {
  assert.deepEqual(parking.tripLookupWindow(new URLSearchParams(), filters), { start, end })
  assert.deepEqual(parking.tripLookupWindow(new URLSearchParams({ hourStart: "09:00" }), filters), { start: start + 540, end })
  assert.deepEqual(parking.tripLookupWindow(new URLSearchParams({ hourEnd: "17:00" }), filters), { start, end: at(filters.end, 17) })
  assert.equal(parking.tripLookupTimeError(new URLSearchParams(), filters), "")
})

test("time validation rejects reversed same-day bounds and accepts overnight date ranges", () => {
  const params = new URLSearchParams({ hourStart: "22:00", hourEnd: "06:00" })
  assert.ok(parking.tripLookupTimeError(params, { ...filters, end: filters.start }))
  assert.equal(parking.tripLookupTimeError(params, filters), "")
  assert.ok(parking.tripLookupTimeError(new URLSearchParams({ hourStart: "25:00" }), filters))
  assert.ok(parking.tripLookupTimeError(new URLSearchParams({ hourStart: "11:00", hourEnd: "11:00" }), { ...filters, end: filters.start }))
})

test("duration report links use departed cars and preserve the selected duration bucket", () => {
  const stats = parking.durationStats(report.periodTrips, settings, filters, report.days)
  assert.equal(fromReport("duration").rows.length, stats.departed.length)
  assert.deepEqual(fromReport("duration", { bucket: 3 }).rows.map((row) => row.trip.id).sort(), ["first-day", "second-day"])
  assert.equal(fromReport("duration", { bucket: 5 }).rows[0].trip.id, "overnight")
})

test("day-type report links preserve the selected calendar days", () => {
  const kind = parking.dayType("2026-11-01", settings.holidays)
  const { rows } = fromReport("incoming", { dayKind: kind })
  assert.deepEqual(rows.map((row) => row.trip.id), ["first-day"])
})

test("day-type multi-select uses the current holiday calendar for report links and ordinary lookup", () => {
  const filters = { estate: 'A', site: 'A:0', vehicle: 'Ô tô', start: '2026-11-20', end: '2026-11-23' }
  const holiday = { id: 'HOLIDAY', effective: '2026-11-22', name: 'Ngày lễ thử', canceled: false }
  const calendar = { ...settings, holidays: [holiday] }
  const rows = ['20', '21', '22', '23'].map((day) => trip(`DAY-${day}`, at(`2026-11-${day}`, 9), at(`2026-11-${day}`, 10)))
  const overnight = trip('OVERNIGHT', at('2026-11-21', 23), at('2026-11-22', 1))
  const params = new URLSearchParams({ dayKind: lookup.tripLookupValue(['Cuối tuần', 'Lễ tết']) })
  const matches = lookup.prepareTripDayFilter(params, filters, calendar)
  assert.deepEqual([...rows, overnight].filter(matches).map((row) => row.id), ['DAY-21', 'DAY-22', 'OVERNIGHT'])
  params.set('tripMode', 'incoming')
  const data = parking.buildParkingReport(rows, calendar, filters, parking.demoAccess)
  const drill = parking.tripLookupDrill(params, filters, data)
  assert.deepEqual(drill.days, ['2026-11-21', '2026-11-22'])
  assert.deepEqual(parking.drillTrips(rows, drill, calendar).map(({ trip }) => trip.id), ['DAY-21', 'DAY-22'])
  params.delete('tripMode'); params.set('dayKind', 'Lễ tết')
  assert.deepEqual(rows.filter(lookup.prepareTripDayFilter(params, filters, calendar)).map((row) => row.id), ['DAY-22'])
  const canceled = { ...calendar, holidays: [{ ...holiday, canceled: true }] }
  assert.equal(rows.filter(lookup.prepareTripDayFilter(params, filters, canceled)).length, 0)
  params.delete('dayKind')
  assert.equal(rows.filter(lookup.prepareTripDayFilter(params, filters, canceled)).length, 4)
})

test("overnight details retain one row per car per night and reconcile with the report", () => {
  const stats = parking.durationStats(report.periodTrips, settings, filters, report.days)
  const { rows } = fromReport("nightly")
  assert.equal(rows.length, stats.nightly.length)
  assert.equal(rows.length, 4)
  assert.equal(new Set(rows.map((row) => `${row.trip.id}/${row.night}`)).size, 4)
  assert.ok(rows.every((row) => ["overnight", "still-parked"].includes(row.trip.id)))
})

test("late corrections stay in the audit history and do not rewrite locked report totals", () => {
  const before = parking.buildParkingReport(trips, settings, filters, parking.demoAccess).total
  const corrected = { ...trips[1], entered: at("2026-10-31", 8) }
  const correction = { trip: corrected, day: "2026-11-01", at: at("2026-11-06", 10), actor: "ANBV", title: "Bổ sung giờ vào" }
  const ledger = applyTripCorrections(trips, [correction])
  assert.deepEqual(ledger.afterLock, [correction])
  assert.deepEqual(ledger.trips, trips)
  const after = parking.buildParkingReport(ledger.trips, settings, filters, parking.demoAccess).total
  assert.deepEqual([after.opening, after.incoming, after.outgoing, after.closing], [before.opening, before.incoming, before.outgoing, before.closing])
})

test("report-to-lookup links retain the same cars across metrics, sites, days, hours, and overnight shifts", (t) => {
  const sample = applyTripCorrections(seedTrips("2026-11-19"), []).trips
  const cache = new Map()
  const getReport = (scope) => {
    const key = JSON.stringify(scope)
    if (!cache.has(key)) cache.set(key, parking.buildParkingReport(sample, settings, scope, parking.demoAccess))
    return cache.get(key)
  }
  const failures = []
  let checked = 0
  const ids = (rows) => rows.map(({ trip, night }) => `${trip.id}/${night || ""}`).sort()
  function check(scope, value, label) {
    const original = getReport(scope)
    const expectedDrill = { ...value,
      days: value.days || (value.dayKind ? original.daily.filter((row) => row.type === value.dayKind).map((row) => row.day) : undefined),
    }
    const expected = parking.drillTrips(original.bySite.flatMap((site) => site.trips), expectedDrill, settings, original.total.exceeded)
    const patch = parking.tripLookupPatch(value, scope, settings)
    const targetScope = { ...scope, ...Object.fromEntries(["estate", "site", "vehicle", "start", "end"].map((key) => [key, patch[key]])) }
    const target = getReport(targetScope)
    const params = new URLSearchParams(Object.entries(patch).filter(([, value]) => value != null))
    const drill = parking.tripLookupDrill(params, targetScope, target)
    const window = parking.tripLookupWindow(params, targetScope)
    const cutoff = drill?.metric === "opening" ? drill.start : window.end
    const exceeded = parking.exceededHoursBySite(target.total.exceeded)
    const candidates = (drill ? target.bySite.flatMap((site) => site.trips) : target.periodTrips).filter((row) =>
      (!patch.state || parking.statusAt(row, cutoff) === patch.state) &&
      (!patch.group || row.group === patch.group) &&
      (!patch.alert || (patch.alert === parking.overCapacityTripAlert.value
        ? parking.parkedDuringExceededHour(row, exceeded)
        : parking.tripAlerts(row, targetScope, settings).includes(patch.alert))) &&
      (drill || parking.touches(row, window.start, window.end)))
    const actual = drill ? parking.drillTrips(candidates, drill, settings, target.total.exceeded) : candidates.map((trip) => ({ trip }))
    checked++
    if (parking.periodError(targetScope, "2026-11-18") || parking.tripLookupTimeError(params, targetScope) || JSON.stringify(ids(actual)) !== JSON.stringify(ids(expected)))
      failures.push({ label, metric: value.metric, expected: expected.length, actual: actual.length, patch })
  }
  for (const vehicle of parking.parkingVehicles) {
    const scope = { estate: "", site: "", vehicle, start: "2026-11-12", end: "2026-11-18" }
    const data = getReport(scope)
    const base = { start: parking.dayStart(scope.start), end: parking.dayStart(scope.end) + parking.dayMinutes }
    for (const metric of Object.keys(parking.tripLookupModes)) {
      check(scope, { ...base, metric, label: metric }, `${vehicle}/KPI/${metric}`)
      for (const group of parking.parkingGroups)
        check(scope, { ...base, metric, group, label: metric }, `${vehicle}/group/${group}/${metric}`)
      for (const site of data.bySite)
        check(scope, { ...base, metric, sites: [site.id], label: metric }, `${vehicle}/${site.id}/${metric}`)
      for (const estate of data.byEstate)
        check(scope, { ...base, metric, sites: estate.children.map((site) => site.id), label: metric }, `${vehicle}/${estate.id}/${metric}`)
    }
    for (const dayKind of parking.dayTypes)
      for (const metric of ["incoming", "parked", "planned"])
        check(scope, { ...base, metric, dayKind, label: metric }, `${vehicle}/day-kind/${dayKind}/${metric}`)
    for (let bucket = 1; bucket <= parking.durationGroups.length; bucket++)
      check(scope, { ...base, metric: "duration", bucket, label: "duration" }, `${vehicle}/duration/${bucket}`)
    for (const daily of data.daily) {
      for (const metric of ["incoming", "outgoing", "opening", "closing"])
        check(scope, { metric, start: parking.dayStart(daily.day), end: parking.dayStart(daily.day) + parking.dayMinutes, label: metric }, `${vehicle}/${daily.day}/${metric}`)
      if (daily.peakAt)
        check(scope, { metric: "closing", start: parking.dayStart(daily.day), end: daily.peakAt, label: "peak" }, `${vehicle}/${daily.day}/peak`)
    }
    for (const site of data.bySite) {
      for (const daily of site.daily) {
        const intervals = [...daily.hours, ...parking.shiftIntervals(site.trips, settings, site.id, vehicle, daily.day, "2026-11-18")]
        for (const interval of intervals.filter((row) => !row.incomplete))
          for (const metric of ["incoming", "outgoing", "opening", "closing"])
            check(scope, { metric, start: interval.start, end: interval.end, sites: [site.id], label: metric }, `${vehicle}/${interval.id}/${metric}`)
      }
    }
  }
  assert.ok(checked > 1000)
  assert.deepEqual(failures, [], `${failures.length}/${checked} links differ: ${JSON.stringify(failures.slice(0, 8))}`)
  t.diagnostic(`${checked} report-to-lookup populations reconciled`)
})
