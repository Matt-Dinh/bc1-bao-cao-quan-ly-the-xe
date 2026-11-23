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
    vehicle: "Ô tô",
    brand: "",
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
  const inactive = saveManagedService(state, { ...service, active: false })
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

test("service packages are not tied to a parking lot and can be reused across lots", () => {
  const { state, input } = setup()
  const next = saveManagedService(state, {
    id: "",
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
  assert.equal("parkId" in service, false)
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
