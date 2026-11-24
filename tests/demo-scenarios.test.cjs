const test = require("node:test")
const assert = require("node:assert/strict")
const { seedOperations } = require("/tmp/vparking-model-tests/operations-model.js")
const { addDemoScenarios } = require("/tmp/vparking-model-tests/demo-scenarios.js")
const S = require("/tmp/vparking-model-tests/subscription-model.js")

test("demo scenarios pass every registration rule and cover each case on the list pages", () => {
  const state = addDemoScenarios(seedOperations()), d = S.directoryOf(state)
  assert.deepEqual(S.controlModes.filter((m) => !d.services.some((s) => s.control === m)), [])
  const demo = d.profiles.filter((p) => p.note === "Dữ liệu mẫu")
  const sub = (id) => state.subscriptions.find((s) => s.id === id)
  assert.ok(demo.some((p) => sub(p.id).type === "VIP" && p.vehicleIds.length === 2 && p.lots.length === 3 && p.members.length === 1))
  assert.ok(demo.some((p) => sub(p.id).type === "VIP" && p.anyPlate && sub(p.id).cardId))
  assert.ok(demo.some((p) => p.vehicle === "Xe đạp" && p.noPlate && p.energy === "Điện"))
  assert.ok(demo.some((p) => sub(p.id).group === "CBNV BQL" && !sub(p.id).cardId && S.profileHasFace(d, p)))
  const rfid = (p) => S.profileRfidVehicle(d, p)?.rfid
  assert.ok(demo.some((p) => rfid(p) && S.profileUsesUhf(d, p) && !sub(p.id).cardId))
  assert.ok(demo.some((p) => rfid(p) && S.profileUsesUhf(d, p) && sub(p.id).cardId), "Mifare + UHF on one subscription")
  assert.ok(demo.some((p) => p.status === "Đã hủy"))
  const name = (p) => d.customers.find((c) => c.id === p.customerId)?.name
  const buses = demo.filter((p) => name(p) === "Công ty Sự kiện Ánh Dương")
  const minh = demo.filter((p) => name(p) === "Đinh Công Minh")
  assert.deepEqual(minh.map((p) => [p.vehicle, !!sub(p.id).cardId]).sort(), [["Xe máy", true], ["Ô tô", false]], "case 12")
  const shop = demo.find((p) => name(p) === "Lương Thị Thu")
  assert.ok(shop && sub(shop.id).group === "Gian hàng" && sub(shop.id).contract === "HĐ-GH-S1.2-03" && sub(shop.id).cardId === "DM-XM-04", "shop employee")
  const eMoto = demo.find((p) => name(p) === "Hồ Thị Phương")
  assert.ok(eMoto && sub(eMoto.id).cardId === "DM-XM-05" && eMoto.noPlate && eMoto.energy === "Điện" && !eMoto.vehicleIds.length, "electric motorbike without plate")
  const long = demo.filter((p) => name(p) === "Võ Hoàng Long")
  assert.deepEqual(long.map((p) => [p.vehicle, p.vehicleIds.length, sub(p.id).type]).sort(), [["Xe máy", 1, "VIP"], ["Ô tô", 3, "VIP"]], "VIP household")
  assert.equal(buses.length, 4, "event buses and the event car: one subscription each")
  const eventCar = buses.find((p) => rfid(p))
  assert.ok(eventCar && rfid(eventCar) === "E28011606000029988" && eventCar.vehicleIds.length === 1 && !sub(eventCar.id).cardId && eventCar.lots.every((l) => d.services.find((s) => s.id === l.serviceId).control === "UHF"), "event car passes on its RFID only")
  assert.ok(buses.every((p) => p.vehicleIds.length === 1 && !sub(p.id).cardId && sub(p.id).effectiveFrom === "2026-11-05"))
  const owners = demo.map((p) => p.customerId)
  assert.ok(owners.some((id, i) => owners.indexOf(id) !== i), "one customer holds two subscriptions")
  assert.ok(d.customers.some((c) => !c.active) && d.vehicles.some((v) => !v.active))
  assert.ok(state.cards.every((c) => c.technology !== "Thẻ UHF"))
  const tags = d.vehicles.filter((v) => v.rfid).map((v) => v.rfid)
  assert.ok(tags.length >= 4)
  assert.equal(new Set(tags).size, tags.length)
  // The model seed used by the other tests stays unchanged.
  assert.equal(S.directoryOf(seedOperations()).services.length, 4)
})


test("every parking lot has the complete active demo catalog and each normal/electric vehicle service", () => {
  const seed = seedOperations(), before = JSON.stringify(seed)
  const state = addDemoScenarios(seed), d = S.directoryOf(state)
  const active = d.services.filter(service => service.active)
  for (const park of S.managementParks) {
    const available = active.filter(service => S.serviceMatchesScope(service, park.estate, park.id))
    assert.deepEqual(available.map(service => service.id), active.map(service => service.id), park.label)
    assert.deepEqual(S.controlModes.filter(mode => !available.some(service => service.control === mode)), [], park.label)
    for (const vehicle of ["Ô tô", "Xe máy", "Xe đạp"]) {
      for (const energy of vehicle === "Xe đạp" ? ["Không động cơ", "Điện"] : ["Xăng/dầu", "Điện"]) {
        for (const category of ["Thuê bao", "Vãng lai"]) {
          assert.ok(available.some(service => service.vehicle === vehicle && service.energy === energy && service.category === category),
            `${park.label}: ${category} / ${vehicle} / ${energy}`)
        }
      }
    }
  }
  for (const service of d.services) {
    assert.equal(new Set(service.parkIds).size, S.managementParks.length, service.name)
  }
  // Existing subscriptions keep their valid package associations, including per-lot packages.
  for (const profile of d.profiles) {
    for (const lot of profile.lots) {
      const service = d.services.find(service => service.id === lot.serviceId)
      assert.ok(service && service.parkIds.includes(lot.parkId), profile.id)
      assert.equal(S.serviceMatchesSubscriber(service, d, profile), true, profile.id)
    }
  }
  assert.equal(JSON.stringify(seed), before)
})


test("every warehouse retains spare monthly, visitor and VIP stock for all vehicle groups and stock technologies", () => {
  const state = addDemoScenarios(seedOperations())
  const { cardTypes, vehicles, normalize } = require("/tmp/vparking-model-tests/data.js")
  const { cardTechnologies } = require("/tmp/vparking-model-tests/vehicle-energy.js")
  for (const park of S.managementParks) {
    for (const type of cardTypes) {
      for (const vehicle of vehicles) {
        for (const technology of cardTechnologies) {
          const candidates = state.cards.filter(card => card.estate === park.estate && card.park === park.park &&
            card.type === type && card.vehicle === vehicle && card.technology === technology && card.status === "Trong kho" && !card.subscription)
          assert.ok(candidates.length >= 2, `${park.label}: ${type} / ${vehicle} / ${technology}`)
          if (type !== "Vãng lai") {
            const service = S.directoryOf(state).services.find(service => service.active && service.category === "Thuê bao" && service.vehicle === vehicle && service.parkIds.includes(park.id))
            assert.equal(S.subscriptionCardFits(state, { id: "", estate: park.estate, type, vehicle, vehicleIds: [], noPlate: false,
              anyPlate: type === "VIP", lots: [{ parkId: park.id, serviceId: service.id, active: true }] }, candidates[0], park.id), true)
          }
        }
      }
    }
  }
  assert.equal(new Set(state.cards.map(card => normalize(card.id))).size, state.cards.length)
  assert.equal(new Set(state.cards.map(card => card.frontCode).filter(Boolean)).size, state.cards.filter(card => card.frontCode).length)
  assert.equal(new Set(state.cards.map(card => card.rearCode).filter(Boolean)).size, state.cards.filter(card => card.rearCode).length)
  const reserves = state.cards.filter(card => /^DM-[ABC][0-2]-/.test(card.id))
  assert.equal(reserves.length, S.managementParks.length * cardTypes.length * vehicles.length * cardTechnologies.length * 2)
  for (const card of reserves) {
    assert.ok(card.note && card.unitId && card.createdAt && card.createdBy && card.updatedAt && card.updatedBy)
    assert.equal(card.owner, "—"); assert.equal(card.plate, "—"); assert.equal(card.subscription, "")
    assert.ok(state.lots.some(lot => lot.id === card.batch && lot.ids.includes(card.id)))
  }
})
