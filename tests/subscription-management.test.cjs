const test = require("node:test")
const assert = require("node:assert/strict")
const {
  seedOperations,
  applyOperation,
} = require("/tmp/vparking-model-tests/operations-model.js")
const {
  lookupCards,
  defaultCardLookupFilters,
  stockMetrics,
} = require("/tmp/vparking-model-tests/report-model.js")
const { today, defaults } = require("/tmp/vparking-model-tests/data.js")
const {
  directoryOf,
  saveManagedCustomer,
  saveManagedVehicle,
  saveManagedService,
  saveSubscriber,
  subscriberInput,
  issueSubscriberCard,
  changeSubscriberState,
  assignedCard,
  subscriberCards,
  parseManagementRelation,
  serviceMatchesScope,
  managementParks,
  subscriptionCardState,
  controlRequiresPlate,
  vipIdentificationMissing,
  subscriptionIdentificationMissing,
  subscriptionPlateControlConflict,
  saveSubscriberRegistration,
  controlRequiresCard,
  subscriptionCardFits,
  subscriberRequiresCard,
  registrationInput,
  registrationForCard,
  customerSubscriptionGroup,
  synchronizeCustomerGroups,
  subscriptionGroupWarnings,
  updateRegistrationDraft,
  registrationControlError,
  controlRequiresUhf,
  profileUsesCard,
} = require("/tmp/vparking-model-tests/subscription-model.js")
test("cross-screen links preserve complete service and entity identifiers containing colons", () => {
  assert.deepEqual(parseManagementRelation("service:DV-A:0-0"), { kind: "service", id: "DV-A:0-0" })
  assert.deepEqual(parseManagementRelation("customer:KH-00001"), { kind: "customer", id: "KH-00001" })
  assert.equal(parseManagementRelation("DV-A:0-0"), null)
})

function setup(type = "Thuê bao tháng") {
  let state = seedOperations()
  state = saveManagedCustomer(state, {
    id: "",
    estate: "A",
    name: "Khách hàng kiểm thử",
    unitId: "BQL-A",
    block: "S1.1",
    phone: "0912345678",
    email: "",
    identity: "",
    apartment: "S1.1-1205",
    address: "",
    active: true,
    source: "Hệ thống",
    note: "",
  })
  const customerId = state.directory.customers[0].id
  state = saveManagedVehicle(state, {
    id: "",
    estate: "A",
    plate: "30A-999.91",
    energy: "Xăng/dầu",
    vehicle: "Ô tô",
    brand: "Toyota",
    color: "",
    active: true,
    note: "",
  })
  const vehicleId = state.directory.vehicles[0].id
  const service = state.directory.services.find(
    (row) =>
      row.vehicle === "Ô tô" &&
      row.category === "Thuê bao",
  )
  const input = {
    energy: "Xăng/dầu",
    id: "",
    estate: "A",
    customerId,
    members: [],
    vehicleIds: [vehicleId],
    vehicle: "Ô tô",
    noPlate: false,
    anyPlate: false,
    lots: [{ parkId: "A:0", serviceId: service.id, active: true }],
    status: "Đang hoạt động",
    type,
    group: "Cư dân",
    contract: "",
    contractEnd: "",
    from: today,
    to: type === "VIP" ? "" : "2026-12-31",
    note: "",
  }
  return { state, input, service, customerId, vehicleId }
}
function register(type) {
  const fixture = setup(type)
  const state = saveSubscriber(fixture.state, fixture.input)
  return { ...fixture, state, sub: state.subscriptions[0] }
}
const stockCard = (state, type = "Thuê bao tháng", park = "Hầm B1 – S1") =>
  state.cards.find(
    (row) =>
      row.estate === "A" &&
      row.park === park &&
      row.type === type &&
      row.vehicle === "Ô tô" &&
      row.status === "Trong kho" &&
      !row.subscription,
  )

test("directory references preserve seeded customers, vehicles, services and unique subscriptions", () => {
  const state = seedOperations(),
    directory = directoryOf(state)
  assert.equal(directory.profiles.length, state.subscriptions.length)
  assert.equal(
    new Set(directory.profiles.map((row) => row.id)).size,
    state.subscriptions.length,
  )
  assert.equal(subscriberCards(state).size, 1290)
  assert.ok(state.cards.filter((card) => card.status === "Trong kho").every((card) => !card.subscription))
  assert.ok(
    [...subscriberCards(state).values()].every(
      (card) => card.type !== "Vãng lai",
    ),
  )
  for (const profile of directory.profiles) {
    assert.ok(
      directory.customers.some(
        (row) => row.id === profile.customerId && row.estate === profile.estate,
      ),
    )
    assert.ok(
      profile.vehicleIds.every((id) =>
        directory.vehicles.some((row) => row.id === id),
      ),
    )
    assert.ok(
      profile.lots.every((lot) =>
        directory.services.some(
          (row) => row.id === lot.serviceId,
        ),
      ),
    )
  }
})
test("registering reuses identities, supports several lots and does not issue a card implicitly", () => {
  const { state, input } = setup()
  const second = state.directory.services.find(
    (row) => row.category === "Thuê bao" && row.vehicle === "Ô tô",
  )
  const before = JSON.stringify(state)
  const next = saveSubscriber(state, {
    ...input,
    lots: [
      ...input.lots,
      { parkId: "A:1", serviceId: second.id, active: true },
    ],
  })
  assert.equal(next.subscriptions.length, state.subscriptions.length + 1)
  assert.equal(
    next.directory.customers.length,
    state.directory.customers.length,
  )
  assert.equal(next.directory.vehicles.length, state.directory.vehicles.length)
  assert.equal(next.directory.profiles[0].lots.length, 2)
  assert.equal(next.subscriptions[0].cardId, "")
  assert.deepEqual(next.cards, state.cards)
  assert.equal(JSON.stringify(state), before)
})
test("scope, service category, duplicate lots and vehicle types are validated before save", () => {
  const { state, input } = setup()
  assert.throws(
    () => saveSubscriber(state, { ...input, estate: "B" }),
    /khách hàng/,
  )
  assert.throws(
    () => saveSubscriber(state, { ...input, vehicle: "Xe máy" }),
    /Xe phải/,
  )
  assert.throws(
    () =>
      saveSubscriber(state, { ...input, lots: [...input.lots, ...input.lots] }),
    /trùng bãi/,
  )
  assert.throws(
    () =>
      saveSubscriber(state, {
        ...input,
        lots: [{ parkId: "A:0", serviceId: "DV-VL-001", active: true }],
      }),
    /gói Thuê bao/,
  )
  assert.throws(
    () => saveSubscriber(state, { ...input, members: [input.customerId] }),
    /thành viên/,
  )
})
test("VIP supports multiple existing vehicles or explicit unrestricted plates, distinct from no-plate monthly vehicles", () => {
  let { state, input } = setup("VIP")
  state = saveManagedVehicle(state, {
    ...state.directory.vehicles[0],
    id: "",
    plate: "30A-999.92",
  })
  const next = saveSubscriber(state, {
    ...input,
    vehicleIds: [input.vehicleIds[0], state.directory.vehicles[0].id],
  })
  assert.equal(next.directory.profiles[0].vehicleIds.length, 2)
  assert.match(next.subscriptions[0].plate, /999.91.*999.92/)
  assert.throws(
    () => saveSubscriber(state, { ...input, anyPlate: true, vehicleIds: [] }),
    /không bắt buộc biển số/,
  )
  const service = state.directory.services.find((row) => row.id === input.lots[0].serviceId)
  state = saveManagedService(state, { ...service, control: "Biển số hoặc Thẻ" })
  const unrestricted = saveSubscriber(state, {
    ...input,
    anyPlate: true,
    vehicleIds: [],
  })
  assert.equal(unrestricted.subscriptions[0].plate, "Không giới hạn biển số")
  assert.throws(
    () => saveSubscriber(state, { ...input, noPlate: true, vehicleIds: [] }),
    /khác với xe/,
  )
  assert.throws(
    () => saveSubscriber(state, { ...input, anyPlate: true }),
    /Bỏ lựa chọn xe/,
  )
  assert.throws(
    () =>
      saveSubscriber(state, {
        ...input,
        vehicleIds: state.directory.vehicles
          .filter((row) => row.estate === "A" && row.vehicle === "Ô tô")
          .slice(0, 11)
          .map((row) => row.id),
      }),
    /1–10 xe/,
  )
  const monthly = saveSubscriber(state, {
    ...input,
    type: "Thuê bao tháng",
    noPlate: true,
    vehicleIds: [],
    to: "2026-12-31",
  })
  assert.equal(monthly.subscriptions[0].plate, "Không biển số")
})
test("monthly vehicle duplicates use an existing subscription instead of registering another one", () => {
  const { state, input } = register()
  assert.throws(() => saveSubscriber(state, input), /Xe đã có thuê bao tháng/)
})
test("customer and vehicle identities reject duplicates but allow unchanged masked legacy phone numbers", () => {
  const { state } = setup()
  assert.throws(
    () =>
      saveManagedCustomer(state, { ...state.directory.customers[0], id: "" }),
    /đã tồn tại/,
  )
  assert.throws(
    () =>
      saveManagedVehicle(state, {
        ...state.directory.vehicles[0],
        id: "",
        plate: "30a99991",
      }),
    /đã tồn tại/,
  )
  assert.doesNotThrow(() => saveManagedVehicle(state, { ...state.directory.vehicles[0], id: "", plate: "30B-999.91" }))
  assert.throws(() => saveManagedVehicle(state, { ...state.directory.vehicles[0], id: "", plate: "---" }), /Biển số/)
  const legacy = state.directory.customers.find((row) =>
    row.phone.includes("*"),
  )
  assert.doesNotThrow(() =>
    saveManagedCustomer(state, { ...legacy, note: "Cập nhật ghi chú" }),
  )
  assert.throws(
    () => saveManagedCustomer(state, { ...legacy, phone: "123" }),
    /10 chữ số/,
  )
})
test("new service selection requires active matching service while existing links survive deactivation", () => {
  const { state, input, service } = register()
  const inactive = saveManagedService(state, { ...service, active: false, control: "UHF" })
  assert.doesNotThrow(() =>
    saveSubscriber(
      inactive,
      subscriberInput(inactive, state.subscriptions[0].id),
    ),
  )
  const other = { ...input, noPlate: true, vehicleIds: [] }
  assert.throws(() => saveSubscriber(inactive, other), /đang hoạt động/)
  assert.throws(
    () => saveManagedService(state, { ...service, vehicle: "Xe máy" }),
    /đang có thuê bao/,
  )
  assert.throws(
    () => saveManagedService(state, { ...service, category: "Vãng lai" }),
    /đang có thuê bao/,
  )
  assert.throws(
    () =>
      issueSubscriberCard(
        inactive,
        state.subscriptions[0].id,
        stockCard(state).id,
        "A:0",
        "Cấp mới",
      ),
    /gói dịch vụ/,
  )
})
test("issuing is atomic, updates lookup immediately, and preserves closed historical report metrics", () => {
  const { state, sub } = register()
  const card = stockCard(state),
    historical = stockMetrics(defaults),
    before = JSON.stringify(state)
  const next = issueSubscriberCard(
    state,
    sub.id,
    card.id,
    "A:0",
    "Khách đã nhận thẻ",
  )
  assert.equal(assignedCard(next, sub.id).id, card.id)
  assert.equal(next.subscriptions[0].id, sub.id)
  assert.equal(
    next.directory.customers.length,
    state.directory.customers.length,
  )
  assert.equal(
    next.cards.filter((row) => row.status === "Trong kho").length,
    state.cards.filter((row) => row.status === "Trong kho").length - 1,
  )
  const lookup = lookupCards(
    { ...defaultCardLookupFilters, keyword: card.id },
    undefined,
    next.cards,
  )
  assert.equal(lookup.cards[0].subscription, sub.id)
  assert.equal(lookup.cards[0].phone, "0912****678")
  assert.equal(next.activity[0].title, "Cấp thẻ thuê bao")
  assert.deepEqual(stockMetrics(defaults), historical)
  assert.equal(JSON.stringify(state), before)
})
test("wrong warehouse, kind, inactive customer, and future or expired subscriptions cannot receive stock cards", () => {
  const { state, sub, customerId } = register()
  assert.throws(
    () =>
      issueSubscriberCard(
        state,
        sub.id,
        stockCard(state, "VIP").id,
        "A:0",
        "Cấp",
      ),
    /Chọn thẻ Trong kho/,
  )
  assert.throws(
    () => issueSubscriberCard(state, sub.id, stockCard(state).id, "A:1", "Cấp"),
    /gói dịch vụ/,
  )
  const customer = state.directory.customers.find(
    (row) => row.id === customerId,
  )
  assert.throws(
    () =>
      issueSubscriberCard(
        saveManagedCustomer(state, { ...customer, active: false }),
        sub.id,
        stockCard(state).id,
        "A:0",
        "Cấp",
      ),
    /Khách hàng đã ngừng/,
  )
  const expired = saveSubscriber(state, {
    ...subscriberInput(state, sub.id),
    from: "2026-09-01",
    to: "2026-10-20",
  })
  assert.throws(
    () =>
      issueSubscriberCard(expired, sub.id, stockCard(state).id, "A:0", "Cấp"),
    /còn hiệu lực/,
  )
  const future = saveSubscriber(state, {
    ...subscriberInput(state, sub.id),
    from: "2026-12-01",
    to: "2026-12-31",
  })
  assert.throws(
    () =>
      issueSubscriberCard(future, sub.id, stockCard(state).id, "A:0", "Cấp"),
    /còn hiệu lực/,
  )
})
test("reissuing cannot bypass a locked old card, and physical recall preserves the same subscriber identity", () => {
  const { state, sub } = register()
  const first = stockCard(state)
  let next = issueSubscriberCard(state, sub.id, first.id, "A:0", "Lần đầu")
  next = applyOperation(next, {
    kind: "lock",
    cardId: first.id,
    reason: "Kiểm tra thẻ",
  })
  assert.throws(
    () => issueSubscriberCard(next, sub.id, first.id, "A:0", "Cấp lại"),
    /Thẻ cũ còn lưu hành/,
  )
  next = applyOperation(next, {
    kind: "return",
    cardId: first.id,
    checked: true,
    result: "pass",
    reason: "Thẻ cũ đã kiểm tra",
  })
  const replaced = issueSubscriberCard(
    next,
    sub.id,
    first.id,
    "A:0",
    "Cấp lại sau khi kiểm tra",
  )
  assert.equal(replaced.subscriptions[0].id, sub.id)
  assert.equal(replaced.directory.profiles[0].status, "Đang hoạt động")
  assert.equal(replaced.activity[0].title, "Cấp lại thẻ")
})
test("master edits update the linked subscription and current card without changing historical snapshots", () => {
  const { state, sub, customerId, vehicleId } = register()
  let next = issueSubscriberCard(
    state,
    sub.id,
    stockCard(state).id,
    "A:0",
    "Cấp mới",
  )
  const historical = stockMetrics(defaults)
  const customer = next.directory.customers.find((row) => row.id === customerId)
  next = saveManagedCustomer(next, {
    ...customer,
    name: "Tên khách đã cập nhật",
    phone: "0987654321",
  })
  const vehicle = next.directory.vehicles.find((row) => row.id === vehicleId)
  next = saveManagedVehicle(next, { ...vehicle, plate: "30A-999.93" })
  assert.equal(assignedCard(next, sub.id).owner, "Tên khách đã cập nhật")
  assert.equal(assignedCard(next, sub.id).phone, "0987****321")
  assert.equal(assignedCard(next, sub.id).plate, "30A-999.93")
  assert.equal(next.subscriptions[0].plate, "30A-999.93")
  assert.deepEqual(stockMetrics(defaults), historical)
})
test("subscription cancellation never returns a physical card to stock and cannot be reversed", () => {
  const { state, sub } = register()
  const active = issueSubscriberCard(
    state,
    sub.id,
    stockCard(state).id,
    "A:0",
    "Cấp mới",
  )
  const next = changeSubscriberState(
    active,
    sub.id,
    "Đã hủy",
    "Khách dừng thuê bao",
  )
  assert.equal(assignedCard(next, sub.id).status, "Đang hoạt động")
  assert.equal(next.directory.profiles[0].status, "Đã hủy")
  assert.throws(
    () => changeSubscriberState(next, sub.id, "Đang hoạt động", "Mở lại"),
    /không được kích hoạt lại/,
  )
  assert.throws(
    () => saveSubscriber(next, subscriberInput(next, sub.id)),
    /chỉ được xem/,
  )
})

test("service packages can be shared by several explicitly selected parking lots", () => {
  const { state, input } = setup()
  const next = saveManagedService(state, {
    id: "",
    parkIds: ["A:0", "A:1"],
    name: "Gói ô tô chỉ biển số",
    vehicle: "Ô tô",
    category: "Thuê bao",
    control: "Biển số",
    pricing: "Theo tháng",
    price: 1500000,
    validFrom: "2026-09-01",
    validTo: "",
    active: true,
    note: "",
  })
  const service = next.directory.services[0]
  assert.deepEqual(service.parkIds, ["A:0", "A:1"])
  assert.equal(service.control, "Biển số")
  assert.throws(() => saveManagedService(next, { ...service, id: "", control: "Thẻ" }), /Cấu hình dịch vụ/)
  const saved = saveSubscriber(next, {
    ...input,
    lots: [
      { parkId: "A:0", serviceId: service.id, active: true },
      { parkId: "A:1", serviceId: service.id, active: true },
    ],
  })
  assert.deepEqual(saved.directory.profiles[0].lots.map((lot) => lot.serviceId), [service.id, service.id])
})

test("service lot scopes drive estate and lot filters and preserve legacy shared packages", () => {
  const { state, service } = setup()
  const shared = { ...service, parkIds: ["A:0", "B:1"] }
  assert.equal(serviceMatchesScope(shared, "A", "A:0"), true)
  assert.equal(serviceMatchesScope(shared, "B", "B:1"), true)
  assert.equal(serviceMatchesScope(shared, "A", "B:1"), false)
  assert.equal(serviceMatchesScope(shared, "", "A:1"), false)
  assert.equal(serviceMatchesScope(shared, "C"), false)
  assert.equal(serviceMatchesScope(shared), true)
  // Multi-select: any chosen estate/park matches; empty lists mean every value.
  assert.equal(serviceMatchesScope(shared, ["C", "B"], ["B:1", "Z:9"]), true)
  assert.equal(serviceMatchesScope(shared, ["C"], []), false)
  assert.equal(serviceMatchesScope(shared, [], []), true)
  const services = [shared, { ...shared, id: "DV-OTHER", parkIds: ["C:0"] }]
  assert.deepEqual(services.filter((row) => serviceMatchesScope(row, "", "B:1")).map((row) => row.id), [shared.id])
  const { parkIds, ...legacyService } = service
  const legacyState = { ...state, directory: { ...state.directory, services: [legacyService] } }
  assert.deepEqual(directoryOf(legacyState).services[0].parkIds, managementParks.map((park) => park.id))
  assert.equal("parkIds" in legacyState.directory.services[0], false)
})

test("service lot selection is required and cannot remove a lot still used by a subscription", () => {
  const { state, input, service } = setup()
  for (const parkIds of [[], ["A:0", "A:0"], ["missing-lot"]])
    assert.throws(() => saveManagedService(state, { ...service, id: "", parkIds }), /bãi xe hợp lệ/)
  const selected = ["A:0", "A:1"]
  const next = saveManagedService(state, { ...service, id: "", parkIds: selected })
  selected.push("A:2")
  const created = next.directory.services[0]
  assert.deepEqual(created.parkIds, ["A:0", "A:1"])
  const registered = saveSubscriber(next, { ...input, lots: [{ parkId: "A:0", serviceId: created.id, active: true }] })
  assert.throws(() => saveManagedService(registered, { ...created, parkIds: ["A:1"] }), /đang có thuê bao sử dụng gói/)
  assert.doesNotThrow(() => saveManagedService(registered, { ...created, parkIds: ["A:0"] }))
  assert.doesNotThrow(() => saveManagedService(registered, { ...created, parkIds: [...created.parkIds, "B:0"] }))
  assert.throws(() => saveSubscriber(next, { ...input, lots: [{ parkId: "A:2", serviceId: created.id, active: true }] }), /áp dụng tại bãi/)
  const stale = { ...registered, directory: { ...registered.directory, services: registered.directory.services.map((row) =>
    row.id === created.id ? { ...row, parkIds: ["A:1"] } : row,
  ) } }
  assert.throws(() => issueSubscriberCard(stale, registered.subscriptions[0].id, stockCard(stale).id, "A:0", "Cấp mới"), /gói dịch vụ/)
})

test("customer face registration is optional, survives profile edits and supports explicit removal", () => {
  const { state, customerId } = setup()
  const customer = state.directory.customers.find((row) => row.id === customerId)
  const photo = { angle: "CENTER", src: "data:image/png;base64,iVBORw0KGgo=" }
  const withFace = saveManagedCustomer(state, { ...customer, faces: [photo] })
  photo.src = "changed after saving"
  const saved = withFace.directory.customers[0]
  assert.equal(saved.faces[0].src, "data:image/png;base64,iVBORw0KGgo=")
  assert.deepEqual(customer.faces, [])
  const { faces, ...legacyInput } = saved
  const edited = saveManagedCustomer(withFace, { ...legacyInput, note: "Updated profile" })
  assert.deepEqual(edited.directory.customers[0].faces, faces)
  const removed = saveManagedCustomer(edited, { ...edited.directory.customers[0], faces: [] })
  assert.deepEqual(removed.directory.customers[0].faces, [])
})

test("customer face registration rejects duplicate poses, missing center, unsupported format and oversized files", () => {
  const { state, customerId } = setup()
  const customer = state.directory.customers.find((row) => row.id === customerId)
  const center = { angle: "CENTER", src: "data:image/png;base64,iVBORw0KGgo=" }
  const save = (faces) => saveManagedCustomer(state, { ...customer, faces })
  assert.throws(() => save([center, center]), /Mỗi góc/)
  assert.throws(() => save([{ ...center, angle: "LEFT" }]), /chính diện/)
  assert.throws(() => save([{ ...center, src: "data:image/svg+xml;base64,PHN2Zz4=" }]), /JPG hoặc PNG/)
  assert.throws(() => save([{ ...center, src: "data:image/png;base64," + "A".repeat(7 * 1024 * 1024) }]), /5 MB/)
  assert.deepEqual(customer.faces, [])
})

test("vehicle energy selects compatible service prices and mixed VIP cannot use an electric-only package", () => {
  let { state, input, service, vehicleId } = setup("VIP")
  const gas = state.directory.vehicles.find((row) => row.id === vehicleId)
  state = saveManagedVehicle(state, { ...gas, id: "", plate: "30E-888.88", energy: "Điện" })
  const electric = state.directory.vehicles[0]
  state = saveManagedService(state, { ...service, id: "", name: "Gói điện", energy: "Điện", price: 900000 })
  const electricService = state.directory.services[0]
  const lots = [{ parkId: "A:0", serviceId: electricService.id, active: true }]
  assert.throws(() => saveSubscriber(state, { ...input, vehicleIds: [gas.id], lots }), /loại phương tiện/i)
  assert.throws(() => saveSubscriber(state, { ...input, vehicleIds: [gas.id, electric.id], lots }), /loại phương tiện/i)
  assert.throws(() => saveSubscriber(state, { ...input, vehicleIds: [], anyPlate: true, lots }), /loại phương tiện/i)
  const registered = saveSubscriber(state, { ...input, vehicleIds: [electric.id], lots })
  const id = registered.subscriptions[0].id
  const issued = issueSubscriberCard(registered, id, stockCard(registered, "VIP").id, "A:0", "Cấp cho xe điện")
  assert.equal(issued.cards.find((row) => row.subscription === id).vehicle, "Ô tô")
  assert.equal("energies" in issued.cards.find((row) => row.subscription === id), false)
  assert.throws(() => saveManagedVehicle(issued, { ...electric, energy: "Xăng/dầu" }), /không phù hợp gói/)
  assert.throws(() => saveManagedService(issued, { ...electricService, energy: "Xăng/dầu" }), /không phù hợp các xe/)
  assert.throws(() => saveManagedVehicle(state, { ...gas, id: "", plate: "30Z-888.88", energy: "Chưa xác định" }), /loại phương tiện/i)
  const mixed = saveSubscriber(state, { ...input, vehicleIds: [gas.id, electric.id] })
  const mixedIssued = issueSubscriberCard(mixed, mixed.subscriptions[0].id, stockCard(mixed, "VIP").id, "A:0", "Cấp VIP nhiều xe")
  assert.equal(mixedIssued.cards.find((row) => row.subscription === mixed.subscriptions[0].id).vehicle, "Ô tô")
  assert.equal(mixed.directory.profiles[0].vehicleIds.length, 2)
})

test("issuance filter distinguishes new registrations, circulating locked cards and recalled cards", () => {
  let { state, sub } = register()
  assert.equal(subscriptionCardState(sub), "Chưa được cấp thẻ")
  state = issueSubscriberCard(state, sub.id, stockCard(state).id, "A:0", "Cấp lần đầu")
  const issued = state.cards.find((row) => row.subscription === sub.id)
  sub = state.subscriptions.find((row) => row.id === sub.id)
  assert.equal(subscriptionCardState(sub, { ...issued, status: "Khóa" }), "Đang có thẻ lưu hành")
  state = applyOperation(state, { kind: "return", cardId: issued.id, checked: true, result: "pass", reason: "Thu hồi" })
  assert.equal(subscriptionCardState(state.subscriptions.find((row) => row.id === sub.id), assignedCard(state, sub.id)), "Chờ cấp lại thẻ")
})

test("VIP without plate restriction needs a plate-free control mode and a card or face to be identified", () => {
  assert.equal(controlRequiresPlate("Biển số"), true)
  assert.equal(controlRequiresPlate("Biển số và Thẻ"), true)
  assert.equal(controlRequiresPlate("(Biển số và Khuôn mặt) hoặc (Biển số và UHF)"), true)
  assert.equal(controlRequiresPlate("Biển số hoặc Thẻ"), false)
  assert.equal(controlRequiresPlate("UHF hoặc (Biển số và Khuôn mặt)"), false)
  assert.equal(controlRequiresPlate("Khuôn mặt"), false)
  let { state, input } = setup("VIP")
  const service = state.directory.services.find((row) => row.id === input.lots[0].serviceId)
  state = saveManagedService(state, { ...service, control: "Biển số hoặc Thẻ" })
  const saved = saveSubscriber(state, { ...input, anyPlate: true, vehicleIds: [] })
  const id = saved.subscriptions[0].id
  assert.equal(vipIdentificationMissing(saved, id), true)
  assert.throws(
    () => saveManagedService(saved, { ...service, control: "Biển số và Thẻ" }),
    /VIP không giới hạn biển số/,
  )
  const card = saved.cards.find((row) => row.status === "Trong kho" && !row.subscription &&
    row.type === "VIP" && row.vehicle === "Ô tô" && row.estate === "A" && row.park === "Hầm B1 – S1")
  if (card) {
    card.technology = "Thẻ Mifare"
    const issued = issueSubscriberCard(saved, id, card.id, "A:0", "Cấp thẻ VIP")
    assert.equal(vipIdentificationMissing(issued, id), false)
  }
  const customer = saved.directory.customers.find((row) => row.id === input.customerId)
  const face = { angle: "CENTER", src: "data:image/png;base64,iVBORw0KGgo=" }
  const withFace = saveManagedCustomer(saved, { ...customer, faces: [face] })
  assert.equal(vipIdentificationMissing(withFace, id), false)
})

test("monthly vehicles without plates cannot register with a plate-required service", () => {
  const { state, input, service } = setup()
  for (const control of ["Biển số", "Biển số và Thẻ", "Biển số và Khuôn mặt", "(Biển số và Khuôn mặt) hoặc (Biển số và UHF)"]) {
    const next = saveManagedService(state, { ...service, id: "", control })
    assert.throws(() => saveSubscriber(next, {
      ...input, noPlate: true, vehicleIds: [],
      lots: [{ parkId: "A:0", serviceId: next.directory.services[0].id, active: true }],
    }), /Xe không có biển số.*không bắt buộc biển số/)
  }
  for (const control of ["UHF", "Khuôn mặt", "Biển số hoặc Thẻ", "UHF hoặc (Biển số và Khuôn mặt)"]) {
    const next = saveManagedService(state, { ...service, id: "", control })
    const registered = saveSubscriber(next, {
      ...input, noPlate: true, vehicleIds: [],
      lots: [{ parkId: "A:0", serviceId: next.directory.services[0].id, active: true }],
    })
    assert.equal(registered.subscriptions[0].plate, "Không biển số")
    assert.equal(subscriptionIdentificationMissing(registered, registered.subscriptions[0].id), true)
    assert.deepEqual(registered.cards, state.cards)
  }
})

test("no-plate registration remains pending identification until its owner/member has a face or a card is issued", () => {
  let { state, input, service } = setup()
  state = saveManagedService(state, { ...service, id: "", control: "Biển số hoặc Thẻ" })
  const packageId = state.directory.services[0].id
  state = saveSubscriber(state, { ...input, noPlate: true, vehicleIds: [], lots: [{ parkId: "A:0", serviceId: packageId, active: true }] })
  const id = state.subscriptions[0].id
  assert.equal(subscriptionIdentificationMissing(state, id), true)
  assert.equal(subscriptionPlateControlConflict(state, id), false)
  const customer = state.directory.customers.find((row) => row.id === input.customerId)
  const face = { angle: "CENTER", src: "data:image/png;base64,iVBORw0KGgo=" }
  const withOwnerFace = saveManagedCustomer(state, { ...customer, faces: [face] })
  assert.equal(subscriptionIdentificationMissing(withOwnerFace, id), false)
  const withoutFace = saveManagedCustomer(withOwnerFace, { ...customer, faces: [] })
  assert.equal(subscriptionIdentificationMissing(withoutFace, id), true)
  const member = state.directory.customers.find((row) => row.estate === "A" && row.id !== customer.id && row.active)
  let withMemberFace = saveManagedCustomer(state, { ...member, faces: [face] })
  withMemberFace = saveSubscriber(withMemberFace, { ...subscriberInput(withMemberFace, id), members: [member.id] })
  assert.equal(subscriptionIdentificationMissing(withMemberFace, id), false)
  const card = stockCard(state)
  const issued = issueSubscriberCard(state, id, card.id, "A:0", "Cấp thẻ xe không biển số")
  assert.equal(subscriptionIdentificationMissing(issued, id), false)
  const recalled = applyOperation(issued, { kind: "return", cardId: card.id, checked: true, result: "pass", reason: "Thu hồi" })
  assert.equal(subscriptionIdentificationMissing(recalled, id), true)
  const cancelled = changeSubscriberState(state, id, "Đã hủy", "Hủy đăng ký")
  assert.equal(subscriptionIdentificationMissing(cancelled, id), false)
})

test("service edits and card issuance cannot bypass the no-plate control restriction on existing records", () => {
  let { state, input, service } = setup()
  state = saveManagedService(state, { ...service, id: "", control: "UHF" })
  const record = state.directory.services[0]
  state = saveSubscriber(state, { ...input, noPlate: true, vehicleIds: [], lots: [{ parkId: "A:0", serviceId: record.id, active: true }] })
  const id = state.subscriptions[0].id
  for (const control of ["Biển số", "Biển số và Thẻ"]) {
    assert.throws(() => saveManagedService(state, { ...record, control }), /xe không có biển số/)
    const legacy = { ...state, directory: { ...state.directory, services: state.directory.services.map((row) => row.id === record.id ? { ...row, control } : row) } }
    assert.equal(subscriptionPlateControlConflict(legacy, id), true)
    const before = JSON.stringify(legacy)
    assert.throws(() => issueSubscriberCard(legacy, id, stockCard(legacy).id, "A:0", "Cấp thẻ"), /không bắt buộc biển số/)
    assert.throws(() => saveSubscriber(legacy, subscriberInput(legacy, id)), /không bắt buộc biển số/)
    assert.equal(JSON.stringify(legacy), before)
  }
  const normal = register()
  assert.equal(subscriptionIdentificationMissing(normal.state, normal.sub.id), false)
  assert.equal(subscriptionPlateControlConflict(normal.state, normal.sub.id), false)
})

test("registration requires a card only when every control alternative requires one",()=>{
  // "Thẻ" means a Proximity/Mifare stock card; UHF modes are satisfied by the UHF tag registered on the subscription.
  for(const mode of ["Biển số và Thẻ","Biển số và Thẻ và Khuôn mặt"]) assert.equal(controlRequiresCard(mode),true)
  for(const mode of ["Biển số","Khuôn mặt","Biển số hoặc Thẻ","UHF","UHF và Khuôn mặt","Biển số và Thẻ UHF","UHF hoặc (Biển số và Khuôn mặt)","(Biển số và Thẻ) hoặc (Biển số và Khuôn mặt)"]) assert.equal(controlRequiresCard(mode),false)
  for(const mode of ["UHF","UHF và Khuôn mặt","Biển số và Thẻ UHF"]) assert.equal(controlRequiresUhf(mode),true)
  for(const mode of ["UHF hoặc Biển số","Biển số và Thẻ","(Biển số và Khuôn mặt) hoặc (Biển số và UHF)"]) assert.equal(controlRequiresUhf(mode),false)
  let {state,input,service}=setup(),before=JSON.stringify(state)
  assert.throws(()=>saveSubscriberRegistration(state,input),/yêu cầu thẻ/)
  assert.equal(JSON.stringify(state),before)
  state=saveManagedService(state,{...service,control:"Biển số"})
  const next=saveSubscriberRegistration(state,input)
  assert.equal(next.subscriptions[0].cardId,"")
  state=saveManagedService(state,{...service,control:"Biển số hoặc Thẻ"})
  const noPlate={...input,noPlate:true,vehicleIds:[]}
  assert.equal(subscriberRequiresCard(directoryOf(state),noPlate),true)
  assert.throws(()=>saveSubscriberRegistration(state,noPlate),/yêu cầu thẻ/)
  state=saveManagedService(state,{...service,control:"UHF hoặc (Biển số và Khuôn mặt)"})
  assert.equal(subscriberRequiresCard(directoryOf(state),noPlate),false)
  assert.throws(()=>saveSubscriberRegistration(state,noPlate),/UHF/)
  assert.doesNotThrow(()=>saveSubscriberRegistration(state,{...noPlate,uhfCode:"E2000017221101441890ABCD"}))
})

test("saving registration allocates stock and updates card/subscriber links in one transaction",()=>{
  const {state,input}=setup(),card=stockCard(state),before=JSON.stringify(state)
  const next=saveSubscriberRegistration(state,{...input,cardId:card.id,cardParkId:"A:0"})
  const sub=next.subscriptions[0]
  assert.equal(sub.cardId,card.id)
  assert.equal(assignedCard(next,sub.id).id,card.id)
  assert.equal(assignedCard(next,sub.id).vehicle,input.vehicle)
  assert.equal(JSON.stringify(state),before)
  const edit=subscriberInput(next,sub.id)
  assert.equal(saveSubscriberRegistration(next,{...edit,note:"Sửa hồ sơ"}).subscriptions[0].cardId,card.id)
  for(const patch of [{cardId:"NO-CARD",cardParkId:"A:0"},{cardId:card.id,cardParkId:"A:1"},{cardId:card.id,cardParkId:""}]) {
    assert.throws(()=>saveSubscriberRegistration(state,{...input,...patch}))
    assert.equal(JSON.stringify(state),before)
  }
})

test("card registration validates exact parking, vehicle category, subscription kind and rejects UHF stock",()=>{
  let {state,input,service}=setup(),card=stockCard(state)
  assert.equal(subscriptionCardFits(state,input,card,"A:0"),true)
  for(const patch of [{vehicle:"Xe máy"},{type:"VIP"},{status:"Khóa"},{subscription:"TB-other"},{technology:"Thẻ UHF"}]) assert.equal(subscriptionCardFits(state,input,{...card,...patch},"A:0"),false)
  assert.equal(subscriptionCardFits(state,input,card,"A:1"),false)
  const uhfStock={...state,cards:state.cards.map(c=>c.id===card.id?{...c,technology:"Thẻ UHF"}:c)}
  assert.throws(()=>saveSubscriberRegistration(uhfStock,{...input,cardId:card.id,cardParkId:"A:0"}))
  state=saveManagedService(state,{...service,control:"Biển số và Thẻ UHF"})
  assert.throws(()=>saveSubscriberRegistration(state,input),/yêu cầu thẻ UHF/)
  const saved=saveSubscriberRegistration(state,{...input,uhfCode:"E28011606000020A",uhfLabel:"UHF-0001"})
  const profile=directoryOf(saved).profiles.find(p=>p.id===saved.subscriptions[0].id)
  assert.deepEqual(profile.uhf,{code:"E28011606000020A",label:"UHF-0001"})
  assert.equal(saved.subscriptions[0].cardId,"")
  assert.equal(saved.cards.length,state.cards.length)
  assert.equal(subscriberInput(saved,profile.id).uhfCode,"E28011606000020A")
})

test("UHF tags are unique, never come from stock and force a monthly subscription",()=>{
  let {state,input,service}=setup()
  state=saveManagedService(state,{...service,control:"UHF"})
  assert.throws(()=>saveSubscriberRegistration(state,{...input,uhfCode:"E2 80"}),/khoảng trắng/)
  assert.throws(()=>saveSubscriberRegistration(state,{...input,uhfCode:stockCard(state).id}),/trùng với mã thẻ/)
  const first=saveSubscriberRegistration(state,{...input,uhfCode:"E200AAA1"})
  const id=first.subscriptions[0].id
  let next=saveManagedVehicle(first,{id:"",estate:"A",plate:"30A-999.92",energy:"Xăng/dầu",vehicle:"Ô tô",brand:"Kia",color:"",active:true,note:""})
  const other=next.directory.vehicles[0].id
  assert.throws(()=>saveSubscriberRegistration(next,{...input,vehicleIds:[other],uhfCode:"e200aaa1"}),new RegExp(`đã được đăng ký cho thuê bao ${id}`))
  assert.doesNotThrow(()=>saveSubscriberRegistration(next,{...subscriberInput(next,id),note:"Giữ mã UHF cũ"}))
  assert.equal(registrationForCard(state,{...input,type:"VIP",anyPlate:true}).type,"Thuê bao tháng")
  assert.throws(()=>saveSubscriberRegistration(state,{...input,uhfCode:"E200AAA2",cardId:stockCard(state,"VIP").id,cardParkId:"A:0"}))
})

test("one subscription can hold a Mifare card and a UHF tag across its parking services",()=>{
  let {state,input,service}=setup()
  state=saveManagedService(state,{...service,id:"",name:"Ô tô UHF B1-S2",parkIds:["A:1"],control:"Biển số và Thẻ UHF"})
  const uhfService=state.directory.services[0]
  state=saveManagedService(state,{...service,control:"Biển số và Thẻ"})
  const both={...input,lots:[{parkId:"A:0",serviceId:service.id,active:true},{parkId:"A:1",serviceId:uhfService.id,active:true}]}
  const card=stockCard(state)
  assert.throws(()=>saveSubscriberRegistration(state,{...both,uhfCode:"E200BBB1"}),/Proximity\/Mifare/)
  assert.throws(()=>saveSubscriberRegistration(state,{...both,cardId:card.id,cardParkId:"A:0"}),/UHF/)
  const saved=saveSubscriberRegistration(state,{...both,cardId:card.id,cardParkId:"A:0",uhfCode:"E200BBB1"})
  const sub=saved.subscriptions[0]
  assert.equal(sub.cardId,card.id)
  assert.equal(directoryOf(saved).profiles.find(p=>p.id===sub.id).uhf.code,"E200BBB1")
  assert.equal(saved.cards.find(c=>c.id===card.id).technology==="Thẻ UHF",false)
})
test("future registrations can allocate a physical card while retaining a future effective date",()=>{
  const {state,input}=setup(),card=stockCard(state)
  const next=saveSubscriberRegistration(state,{...input,from:"2026-11-01",cardId:card.id,cardParkId:"A:0"})
  assert.equal(next.subscriptions[0].effectiveFrom,"2026-11-01")
  assert.equal(next.subscriptions[0].cardId,card.id)
  assert.throws(()=>saveSubscriberRegistration(state,{...input,to:"2026-10-01",cardId:card.id,cardParkId:"A:0"}),/quá khứ/)
})

test("customer and vehicle forms preserve legacy required information and audit fields",()=>{
  const {state,customerId,vehicleId}=setup(),customer=state.directory.customers.find(c=>c.id===customerId),vehicle=state.directory.vehicles.find(v=>v.id===vehicleId)
  for(const patch of [{phone:""},{unitId:""},{block:""}]) assert.throws(()=>saveManagedCustomer(state,{...customer,id:"",...patch}),/số điện thoại|Tòa|Đơn vị/)
  for(const patch of [{phone:""},{unitId:""},{block:""}]) assert.throws(()=>saveManagedCustomer(state,{...customer,...patch}),/bỏ trống/)
  assert.throws(()=>saveManagedVehicle(state,{...vehicle,id:"",brand:""}),/hãng xe/)
  const next=saveManagedCustomer(state,{...customer,identity:"012345678901",note:"Ghi chú"}),saved=next.directory.customers.find(c=>c.id===customerId)
  assert.equal(saved.createdAt,customer.createdAt);assert.equal(saved.updatedBy,"Admin Local")
  assert.equal(saved.identity,"012345678901")
})

test("editing a subscription preserves hidden legacy members including an unchanged inactive member",()=>{
  let {state,input,service}=setup('VIP')
  state=saveManagedService(state,{...service,control:'Biển số và Thẻ'})
  const member=directoryOf(state).customers.find(c=>c.estate===input.estate&&c.id!==input.customerId)
  state=saveSubscriberRegistration(state,{...input,members:[member.id],cardId:stockCard(state,'VIP').id,cardParkId:'A:0'})
  const id=state.subscriptions[0].id
  state=saveManagedCustomer(state,{...member,active:false})
  const edited=saveSubscriberRegistration(state,{...subscriberInput(state,id),note:'Sửa khi phần thành viên đang ẩn'})
  assert.deepEqual(directoryOf(edited).profiles.find(p=>p.id===id).members,[member.id])
})

test("the selected card determines VIP registration and a face cannot replace the VIP card",()=>{
  let {state,input,service,customerId}=setup()
  state=saveManagedService(state,{...service,control:'Biển số hoặc Thẻ'})
  const vip=stockCard(state,'VIP'),monthly=stockCard(state)
  const noPlate={...input,vehicleIds:[],anyPlate:false}
  assert.equal(registrationForCard(state,{...noPlate,cardId:vip.id}).type,'VIP')
  assert.equal(registrationForCard(state,{...noPlate,cardId:vip.id}).anyPlate,true)
  assert.equal(registrationForCard(state,{...noPlate,type:'VIP'}).type,'Thuê bao tháng')
  const owner=directoryOf(state).customers.find(c=>c.id===customerId)
  state=saveManagedCustomer(state,{...owner,faces:[{angle:'CENTER',src:'data:image/png;base64,iVBORw0KGgo='}]})
  assert.throws(()=>saveSubscriberRegistration(state,{...noPlate,type:'VIP'}),/đúng một xe/)
  assert.throws(()=>saveSubscriberRegistration(state,{...noPlate,cardId:monthly.id,cardParkId:'A:0'}),/đúng một xe/)
  const next=saveSubscriberRegistration(state,{...noPlate,cardId:vip.id,cardParkId:'A:0'})
  assert.equal(next.subscriptions[0].cardId,vip.id)
  assert.equal(next.subscriptions[0].type,'VIP')
  assert.equal(directoryOf(next).profiles[0].anyPlate,true)
  assert.equal(directoryOf(next).profiles[0].vehicleIds.length,0)
})

test("a VIP can select several plates with a plate service while a zero-plate VIP cannot bypass mandatory plates",()=>{
  let {state,input,service}=setup('VIP')
  state=saveManagedService(state,{...service,control:'Biển số và Thẻ'})
  const first=directoryOf(state).vehicles.find(v=>v.id===input.vehicleIds[0])
  state=saveManagedVehicle(state,{...first,id:'',plate:'30QA-222.02'})
  const ids=[first.id,directoryOf(state).vehicles[0].id]
  const next=saveSubscriberRegistration(state,{...input,anyPlate:true,vehicleIds:ids,cardId:stockCard(state,'VIP').id,cardParkId:'A:0'})
  assert.deepEqual(directoryOf(next).profiles[0].vehicleIds,ids)
  assert.equal(directoryOf(next).profiles[0].anyPlate,false)
  const card=stockCard(state,'VIP')
  assert.throws(()=>saveSubscriberRegistration(state,{...input,vehicleIds:[],cardId:card.id,cardParkId:'A:0'}),/không bắt buộc biển số/)
})

test("scope and type changes reconcile the complete draft without mutating existing state",()=>{
  const {state,input,service}=setup(),card=stockCard(state),before=JSON.stringify(input)
  const draft={...input,cardId:card.id,cardParkId:'A:0'}
  const broader=updateRegistrationDraft(state,draft,{lots:[...input.lots,{parkId:'A:1',serviceId:service.id,active:true}]})
  assert.equal(broader.cardId,card.id);assert.equal(broader.lots.length,2)
  const removed=updateRegistrationDraft(state,broader,{lots:broader.lots.slice(1)})
  assert.equal(removed.cardParkId,'A:1');assert.equal(removed.cardId,'')
  const estate=updateRegistrationDraft(state,draft,{estate:'B'})
  assert.equal(estate.customerId,'');assert.deepEqual(estate.lots,[]);assert.deepEqual(estate.vehicleIds,[]);assert.equal(estate.cardId,'')
  const vipCard=stockCard(state,'VIP')
  const vip=updateRegistrationDraft(state,draft,{cardId:vipCard.id,vehicleIds:[]})
  assert.equal(vip.type,'VIP');assert.equal(vip.anyPlate,true);assert.equal(vip.group,'');assert.equal(vip.cardId,vipCard.id)
  const withPlate=updateRegistrationDraft(state,vip,{vehicleIds:input.vehicleIds})
  assert.equal(withPlate.anyPlate,false)
  const cleared=updateRegistrationDraft(state,{...withPlate,vehicleIds:[...input.vehicleIds,'XE-00001']},{cardId:''})
  assert.equal(cleared.type,'Thuê bao tháng');assert.equal(cleared.anyPlate,false);assert.deepEqual(cleared.vehicleIds,[])
  const switched=updateRegistrationDraft(state,{...withPlate,vehicleIds:[...input.vehicleIds,'XE-00001']},{cardId:card.id})
  assert.equal(switched.type,'Thuê bao tháng');assert.equal(switched.cardId,card.id);assert.deepEqual(switched.vehicleIds,[])
  const removedVip=updateRegistrationDraft(state,vip,{lots:[{parkId:'A:1',serviceId:service.id,active:true}]})
  assert.equal(removedVip.cardId,'');assert.equal(removedVip.type,'Thuê bao tháng');assert.equal(removedVip.anyPlate,false)
  assert.equal(JSON.stringify(input),before)
})

test("service and vehicle changes remove incompatible selections while subscription dates preserve the service",()=>{
  let {state,input,service}=setup()
  state=saveManagedService(state,{...service,id:'',name:'Chỉ xe điện',energy:'Điện'})
  const electric=directoryOf(state).services[0]
  const changed=updateRegistrationDraft(state,input,{lots:[{parkId:'A:0',serviceId:electric.id,active:true}]})
  assert.deepEqual(changed.vehicleIds,[])
  const noPlate=updateRegistrationDraft(state,input,{noPlate:true})
  assert.equal(noPlate.lots[0].serviceId,'');assert.deepEqual(noPlate.vehicleIds,[])
  state=saveManagedService(state,{...service,id:'',name:'Có thời hạn',validTo:'2026-11-30'})
  const finite=directoryOf(state).services[0]
  const draft={...input,to:'2026-11-30',lots:[{parkId:'A:0',serviceId:finite.id,active:true}]}
  assert.equal(updateRegistrationDraft(state,draft,{to:'2026-12-31'}).lots[0].serviceId,finite.id)
  assert.throws(()=>saveSubscriber(state,{...input,lots:[{...input.lots[0],active:false}]}),/ít nhất một bãi đang áp dụng/)
})

test("face requirements and alternative identification branches are validated before allocating a card",()=>{
  let {state,input,service,customerId}=setup()
  // Use a dedicated package: switching the shared seed package to face-only is blocked while its subscribers lack faces.
  state=saveManagedService(state,{...service,id:'',name:'Gói khuôn mặt',control:'Biển số và Khuôn mặt'})
  service=directoryOf(state).services[0]
  input={...input,lots:input.lots.map(l=>({...l,serviceId:service.id}))}
  const before=JSON.stringify(state)
  assert.throws(()=>saveSubscriberRegistration(state,input),/yêu cầu khuôn mặt/)
  assert.equal(JSON.stringify(state),before)
  const owner=directoryOf(state).customers.find(c=>c.id===customerId)
  const withFace=saveManagedCustomer(state,{...owner,faces:[{angle:'CENTER',src:'data:image/png;base64,iVBORw0KGgo='}]})
  assert.doesNotThrow(()=>saveSubscriberRegistration(withFace,input))
  state=saveManagedService(state,{...service,control:'(Biển số và Thẻ) hoặc (Biển số và Khuôn mặt)'})
  assert.match(registrationControlError(state,input),/Chọn thẻ Proximity\/Mifare, nhập mã thẻ UHF hoặc bổ sung khuôn mặt/)
  assert.doesNotThrow(()=>saveSubscriberRegistration(state,{...input,cardId:stockCard(state,'VIP').id,cardParkId:'A:0'}))
  const withAlternativeFace=saveManagedCustomer(state,{...owner,faces:[{angle:'CENTER',src:'data:image/png;base64,iVBORw0KGgo='}]})
  assert.doesNotThrow(()=>saveSubscriberRegistration(withAlternativeFace,input))
})


test("services need no validity dates and legacy dates cannot block registration or card allocation",()=>{
  let {state,input,service}=setup()
  const {validFrom,validTo,...withoutDates}=service
  state=saveManagedService(state,{...withoutDates,id:'',name:'Dịch vụ không giới hạn ngày'})
  const created=directoryOf(state).services[0]
  assert.equal(created.validFrom,undefined)
  assert.equal(created.validTo,undefined)
  // Stale service dates from a previous prototype must never constrain the subscriber.
  state=saveManagedService(state,{...created,validFrom:'2030-12-31',validTo:'2020-01-01'})
  const draft={...input,lots:[{parkId:'A:0',serviceId:created.id,active:true}],cardId:stockCard(state).id,cardParkId:'A:0'}
  const changed=updateRegistrationDraft(state,draft,{from:'2026-11-01',to:'2027-01-31'})
  assert.equal(changed.lots[0].serviceId,created.id)
  const saved=saveSubscriberRegistration(state,changed)
  assert.equal(assignedCard(saved,saved.subscriptions[0].id).id,draft.cardId)
  assert.throws(()=>saveSubscriberRegistration(state,{...draft,from:'2027-01-31',to:'2026-11-01'}),/thời gian|hiệu lực|ngày/i)
})

test("a vehicle cannot belong to two active VIP subscriptions", () => {
  let { state, input } = setup("VIP")
  state = saveSubscriber(state, input)
  const first = state.subscriptions[0].id
  assert.throws(() => saveSubscriber(state, input), new RegExp(`VIP ${first}`))
  const cancelled = changeSubscriberState(state, first, "Đã hủy", "Khách ngừng sử dụng")
  assert.doesNotThrow(() => saveSubscriber(cancelled, input))
  const edited = saveSubscriber(state, { ...subscriberInput(state, first), note: "Cập nhật" })
  assert.equal(edited.subscriptions.length, state.subscriptions.length)
})

test("choosing a VIP card before plates keeps the package so the card and vehicles stay selectable", () => {
  const { state, input, service } = setup("VIP")
  assert.equal(service.control.includes("Biển số"), true)
  const vipCards = state.cards.filter((c) => c.type === "VIP" && c.vehicle === "Ô tô" && c.estate === "A" &&
    c.park === "Hầm B1 – S1" && c.status === "Trong kho" && !c.subscription)
  const empty = { ...input, type: "Thuê bao tháng", vehicleIds: [], cardId: "", cardParkId: "" }
  const draft = updateRegistrationDraft(state, empty, { cardId: vipCards[0].id, cardParkId: "A:0" })
  assert.equal(draft.type, "VIP")
  assert.equal(draft.anyPlate, true)
  assert.equal(draft.lots[0].serviceId, service.id)
  const monthly = state.cards.find((c) => c.type === "Thuê bao tháng" && subscriptionCardFits(state, { ...draft, type: c.type }, c, "A:0"))
  const switched = updateRegistrationDraft(state, draft, { cardId: monthly.id, cardParkId: "A:0" })
  assert.equal(switched.cardId, monthly.id)
  assert.equal(switched.type, "Thuê bao tháng")
  assert.throws(() => saveSubscriberRegistration(state, draft), /không bắt buộc biển số/)
})

test("face-controlled subscriptions need no card and keep at least one face photo", () => {
  let { state, input, customerId } = setup()
  const base = state.directory.services.find((row) => row.id === input.lots[0].serviceId)
  const png = "data:image/png;base64,iVBORw0KGgo="
  const customer = state.directory.customers.find((row) => row.id === customerId)
  state = saveManagedService(state, { ...base, id: "", name: "Gói BS+KM", parkIds: ["A:0"], control: "Biển số và Khuôn mặt" })
  const face = state.directory.services[0]
  state = saveManagedCustomer(state, { ...customer, faces: [{ angle: "CENTER", src: png }] })
  const draft = { ...input, lots: [{ parkId: "A:0", serviceId: face.id, active: true }] }
  const saved = saveSubscriberRegistration(state, draft)
  const sub = saved.subscriptions[0]
  const profile = saved.directory.profiles[0]
  assert.equal(subscriptionCardState(sub, undefined, subscriberRequiresCard(saved.directory, profile)), "Không yêu cầu thẻ")
  assert.equal(subscriptionCardState(sub), "Chưa được cấp thẻ")
  const owner = saved.directory.customers.find((row) => row.id === customerId)
  assert.throws(() => saveManagedCustomer(saved, { ...owner, faces: [] }), /yêu cầu khuôn mặt/)
  const cancelled = changeSubscriberState(saved, sub.id, "Đã hủy", "Ngừng")
  assert.doesNotThrow(() => saveManagedCustomer(cancelled, { ...owner, faces: [] }))
})

test("switching a package to a face-only mode is blocked while its subscribers have no face", () => {
  let { state, input } = setup()
  const base = state.directory.services.find((row) => row.id === input.lots[0].serviceId)
  state = saveManagedService(state, { ...base, id: "", name: "Gói UHF", parkIds: ["A:0"], control: "Biển số hoặc Thẻ" })
  const svc = state.directory.services[0]
  state = saveSubscriber(state, { ...input, lots: [{ parkId: "A:0", serviceId: svc.id, active: true }] })
  assert.throws(() => saveManagedService(state, { ...svc, control: "Biển số và Khuôn mặt" }), /chưa có ảnh khuôn mặt/)
  assert.doesNotThrow(() => saveManagedService(state, { ...svc, control: "Biển số và Thẻ" }))
})


test("customer classification is authoritative for registration, including stale or forged draft groups",()=>{
  let {state,input,customerId}=setup()
  let customer=directoryOf(state).customers.find(row=>row.id===customerId)
  state=saveManagedCustomer(state,{...customer,group:'Cư dân'})
  const draft=registrationForCard(state,{...input,group:'Gian hàng'})
  assert.equal(draft.group,'Cư dân')
  state=saveSubscriberRegistration(state,{...draft,cardId:stockCard(state).id,cardParkId:'A:0'})
  const sub=state.subscriptions[0],card=assignedCard(state,sub.id),before=stockMetrics(defaults)
  assert.equal(sub.group,'Cư dân');assert.equal(card.group,'Cư dân')
  customer=directoryOf(state).customers.find(row=>row.id===customerId)
  const changed=saveManagedCustomer(state,{...customer,group:'Gian hàng'})
  assert.equal(changed.subscriptions.find(row=>row.id===sub.id).group,'Gian hàng')
  assert.equal(changed.cards.find(row=>row.id===card.id).group,'Gian hàng')
  assert.deepEqual(subscriptionGroupWarnings(changed,sub.id),['Thiếu hợp đồng hợp lệ'])
  const edit=subscriberInput(changed,sub.id)
  assert.throws(()=>saveSubscriberRegistration(changed,{...edit,group:'Cư dân'}),/hợp đồng/)
  const completed=saveSubscriberRegistration(changed,{...edit,contract:'HD-KH-01',contractEnd:'2026-12-31'})
  assert.deepEqual(subscriptionGroupWarnings(completed,sub.id),[])
  assert.deepEqual(stockMetrics(defaults),before)
})

test("changing customer group updates every old monthly subscription without changing VIP card kind",()=>{
  let {state,input,customerId}=setup()
  state=saveSubscriberRegistration(state,{...input,cardId:stockCard(state).id,cardParkId:'A:0'})
  const monthly=state.subscriptions[0]
  state=saveSubscriberRegistration(state,{...input,cardId:stockCard(state,'VIP').id,cardParkId:'A:0',to:''})
  const vip=state.subscriptions[0]
  state=changeSubscriberState(state,monthly.id,'Đã hủy','Kiểm tra đồng bộ hồ sơ cũ')
  const customer=directoryOf(state).customers.find(row=>row.id===customerId)
  const next=saveManagedCustomer(state,{...customer,group:'Văn phòng'})
  assert.equal(next.subscriptions.find(row=>row.id===monthly.id).group,'Văn phòng')
  assert.equal(assignedCard(next,monthly.id).group,'Văn phòng')
  assert.equal(next.subscriptions.find(row=>row.id===vip.id).type,'VIP')
  assert.equal(assignedCard(next,vip.id).type,'VIP')
  assert.equal(customerSubscriptionGroup(directoryOf(next).customers.find(row=>row.id===customerId)),'Văn phòng')
  assert.equal(state.subscriptions.find(row=>row.id===monthly.id).group,monthly.group)
})

test("legacy groups migrate onto customers and linked cards without duplicating identities",()=>{
  const state=seedOperations(),before=JSON.stringify(state)
  const legacy={...state,directory:{...state.directory,customers:state.directory.customers.map(({group,...customer})=>customer)}}
  const normalized=synchronizeCustomerGroups(legacy),directory=directoryOf(normalized)
  assert.equal(directory.customers.length,state.directory.customers.length)
  assert.equal(normalized.cards.length,state.cards.length)
  for(const profile of directory.profiles) {
    const sub=normalized.subscriptions.find(row=>row.id===profile.id)
    const customer=directory.customers.find(row=>row.id===profile.customerId)
    assert.ok(customer.group)
    if(sub.type==='Thuê bao tháng') {
      assert.equal(sub.group,customer.group)
      assert.equal(assignedCard(normalized,sub.id).group,customer.group)
    }
  }
  assert.equal(JSON.stringify(state),before)
})

test("switching customers replaces draft group, clears old contracts and validates resident apartments",()=>{
  let {state,input,customerId}=setup()
  const customer=directoryOf(state).customers.find(row=>row.id===customerId)
  assert.throws(()=>saveManagedCustomer(state,{...customer,group:'VIP'}),/nhóm thuê bao/)
  assert.throws(()=>saveManagedCustomer(state,{...customer,group:'Cư dân',apartment:''}),/căn hộ/)
  state=saveManagedCustomer(state,{...customer,id:'',name:'Khách gian hàng',phone:'0987654321',apartment:'S1.1-9999',group:'Gian hàng'})
  const other=directoryOf(state).customers[0]
  const draft=updateRegistrationDraft(state,{...input,contract:'HD-CU',contractEnd:'2026-12-31'},{customerId:other.id,group:'Nội bộ'})
  assert.equal(draft.group,'Gian hàng');assert.equal(draft.contract,'');assert.equal(draft.contractEnd,'')
  assert.equal(directoryOf(state).customers.find(row=>row.id===customerId).group,customer.group)
})

test("leaving the Gian hàng group clears the old contract from the customer's subscriptions",()=>{
  let {state,input,customerId}=setup()
  const owner=directoryOf(state).customers.find(c=>c.id===customerId)
  state=saveManagedCustomer(state,{...owner,group:"Gian hàng"})
  state=saveManagedService(state,{...directoryOf(state).services.find(s=>s.id===input.lots[0].serviceId),control:"Biển số"})
  state=saveSubscriberRegistration(state,{...input,contract:"HĐ-GH-01",contractEnd:"2027-06-30"})
  const id=state.subscriptions[0].id
  assert.equal(state.subscriptions[0].contract,"HĐ-GH-01")
  const moved=saveManagedCustomer(state,{...directoryOf(state).customers.find(c=>c.id===customerId),group:"Văn phòng"})
  const sub=moved.subscriptions.find(s=>s.id===id)
  assert.equal(sub.group,"Văn phòng")
  assert.equal(sub.contract,"")
  assert.equal(sub.contractEnd,"")
  assert.equal(subscriberInput(moved,id).contract,"")
  const office=saveSubscriberRegistration(moved,{...subscriberInput(moved,id),contract:"HĐ-CŨ",contractEnd:"2027-06-30"})
  assert.equal(office.subscriptions.find(s=>s.id===id).contract,"")
})

test("packages that read no card offer and issue no card; the owner's own face is required",()=>{
  let {state,input,service,customerId}=setup()
  const png="data:image/png;base64,iVBORw0KGgo="
  state=saveManagedService(state,{...service,id:"",name:"Cư dân khuôn mặt",parkIds:["A:0"],control:"Biển số và Khuôn mặt"})
  const face=directoryOf(state).services[0]
  const draft={...input,lots:[{parkId:"A:0",serviceId:face.id,active:true}]}
  assert.equal(profileUsesCard(directoryOf(state),draft),false)
  assert.equal(profileUsesCard(directoryOf(state),input),true)
  const card=stockCard(state)
  assert.equal(subscriptionCardFits(state,draft,card,"A:0"),false)
  assert.equal(updateRegistrationDraft(state,{...input,cardId:card.id,cardParkId:"A:0"},{lots:draft.lots}).cardId,"")
  // A member's photo does not stand in for the owner.
  const owner=directoryOf(state).customers.find(c=>c.id===customerId)
  state=saveManagedCustomer(state,{...owner,id:"",name:"Người nhà",phone:"0912000999",faces:[{angle:"CENTER",src:png}]})
  const member=directoryOf(state).customers[0]
  assert.throws(()=>saveSubscriberRegistration(state,{...draft,members:[member.id]}),/khuôn mặt của chủ thuê bao/)
  state=saveManagedCustomer(state,{...owner,faces:[{angle:"CENTER",src:png}]})
  const saved=saveSubscriberRegistration(state,{...draft,members:[member.id]})
  const id=saved.subscriptions[0].id
  assert.equal(saved.subscriptions[0].cardId,"")
  assert.throws(()=>issueSubscriberCard(saved,id,stockCard(saved).id,"A:0","Cấp thêm"),/không sử dụng thẻ/)
  assert.doesNotThrow(()=>saveManagedCustomer(saved,{...directoryOf(saved).customers.find(c=>c.id===member.id),faces:[]}))
  assert.throws(()=>saveManagedCustomer(saved,{...directoryOf(saved).customers.find(c=>c.id===customerId),faces:[]}),/chủ thuê bao/)
})
