const test = require("node:test")
const assert = require("node:assert/strict")
const {
  applyOperation,
  seedOperations,
  cardStatuses,
  operationMenus,
  warehouseBalances,
} = require("/tmp/vparking-model-tests/operations-model.js")
const { estates, today } = require("/tmp/vparking-model-tests/data.js")
const incident = (cardId, kind = "Hỏng") => ({
  id: "BB-TEST-001",
  cardId,
  kind,
  reason: "Kết quả kiểm tra vật lý của thẻ.",
  fee: 0,
  date: today,
  fromReturn: true,
})
const activeCard = (state) =>
  state.cards.find(
    (c) => c.status === "Đang hoạt động" && c.type === "Thuê bao tháng",
  )

test("only four states; every card belongs to a parking warehouse", () => {
  const state = seedOperations()
  assert.equal(cardStatuses.length, 4)
  assert.ok(
    state.cards.every(
      (c) =>
        cardStatuses.includes(c.status) &&
        estates.some((e) => e.id === c.estate && e.parks.includes(c.park)),
    ),
  )
})
test("return cannot complete without physical inspection", () => {
  const state = seedOperations(),
    card = activeCard(state)
  assert.throws(
    () =>
      applyOperation(state, {
        kind: "return",
        cardId: card.id,
        checked: false,
        result: "pass",
        reason: "Khách trả thẻ",
      }),
    /kiểm tra vật lý/,
  )
  assert.equal(
    state.cards.find((c) => c.id === card.id).status,
    "Đang hoạt động",
  )
})
test("passing inspection returns to the same warehouse and detaches subscription", () => {
  const state = seedOperations(),
    card = activeCard(state)
  const next = applyOperation(state, {
    kind: "return",
    cardId: card.id,
    checked: true,
    result: "pass",
    reason: "Khách ngừng thuê bao, đã kiểm tra đạt.",
  })
  const returned = next.cards.find((c) => c.id === card.id)
  assert.equal(returned.status, "Trong kho")
  assert.equal(returned.park, card.park)
  assert.equal(returned.subscription, "")
  assert.ok(next.subscriptions.find((s) => s.cardId === card.id).ended)
})
test("failed inspection requires and atomically creates a damage report", () => {
  const state = seedOperations(),
    card = activeCard(state),
    count = state.cards.filter((c) => c.status === "Trong kho").length
  const command = {
    kind: "return",
    cardId: card.id,
    checked: true,
    result: "damaged",
    reason: "Thẻ gãy, không sử dụng được.",
  }
  assert.throws(() => applyOperation(state, command), /biên bản hỏng/)
  const next = applyOperation(state, {
    ...command,
    incident: incident(card.id),
  })
  assert.equal(next.cards.find((c) => c.id === card.id).status, "Mất / hỏng")
  assert.equal(next.cards.filter((c) => c.status === "Trong kho").length, count)
  assert.equal(next.incidents[0].cardId, card.id)
})
test("failed damage report never partially returns a card", () => {
  const state = seedOperations(),
    card = activeCard(state)
  const report = { ...incident(card.id), id: state.incidents[0].id }
  assert.throws(
    () =>
      applyOperation(state, {
        kind: "return",
        cardId: card.id,
        checked: true,
        result: "damaged",
        reason: "Thẻ gãy",
        incident: report,
      }),
    /biên bản/,
  )
  assert.equal(
    state.cards.find((c) => c.id === card.id).status,
    "Đang hoạt động",
  )
})
test("visitor handoff validates all cards and same warehouse before any update", () => {
  const state = seedOperations(),
    cards = state.cards.filter(
      (c) => c.type === "Vãng lai" && c.status === "Trong kho",
    )
  const first = cards[0],
    other = cards.find((c) => c.estate !== first.estate)
  const handoff = {
    id: "BG-TEST-001",
    estate: first.estate,
    park: first.park,
    recipient: "Bảo vệ bàn thẻ",
    ids: [first.id, other.id],
    date: today,
    note: "",
  }
  assert.throws(
    () => applyOperation(state, { kind: "handoff", handoff }),
    /đúng bãi/,
  )
  const next = applyOperation(state, {
    kind: "handoff",
    handoff: { ...handoff, ids: [first.id] },
  })
  assert.equal(
    next.cards.find((c) => c.id === first.id).status,
    "Đang hoạt động",
  )
  assert.equal(next.cards.find((c) => c.id === first.id).park, first.park)
})
test("import blocks duplicates and creates cards in the receiving warehouse", () => {
  const state = seedOperations()
  const lot = {
    id: "LO-TEST-001",
    estate: "A",
    park: estates[0].parks[0],
    supplier: "Nhà cung cấp",
    date: today,
    ids: ["NEW-TEST-001"],
  }
  assert.throws(
    () =>
      applyOperation(state, {
        kind: "import",
        lot: { ...lot, ids: [state.cards[0].id] },
        type: "Vãng lai",
        vehicle: "Ô tô",
      }),
    /trùng/,
  )
  const next = applyOperation(state, {
    kind: "import",
    lot,
    type: "Vãng lai",
    vehicle: "Ô tô",
  })
  assert.equal(next.cards[0].status, "Trong kho")
  assert.equal(next.cards[0].park, lot.park)
})
test("activate only stock of the correct parking and validate resident information", () => {
  const state = seedOperations(),
    card = state.cards.find(
      (c) => c.status === "Trong kho" && c.vehicle === "Ô tô",
    )
  const subscription = {
    id: "TB-TEST-001",
    cardId: card.id,
    owner: "Nguyễn Minh Anh",
    phone: "0901234567",
    plate: "30A-888.99",
    type: "Thuê bao tháng",
    group: "Cư dân",
    apartment: "",
    contract: "",
    contractEnd: "",
    effectiveFrom: today,
    expiry: "2026-12-31",
    ended: false,
  }
  const command = {
    kind: "activate",
    subscription,
    park: card.park,
    vehicle: "Ô tô",
    replacement: false,
    reason: "",
  }
  assert.throws(() => applyOperation(state, command), /căn hộ/)
  const next = applyOperation(state, {
    ...command,
    subscription: { ...subscription, apartment: "S1-1205" },
  })
  assert.equal(
    next.cards.find((c) => c.id === card.id).status,
    "Đang hoạt động",
  )
  assert.ok(next.cards.find((c) => c.id === card.id).phone.includes("****"))
})
test("subscription loss must be locked first; terminal cards cannot be reopened", () => {
  const state = seedOperations(),
    card = activeCard(state)
  assert.throws(
    () =>
      applyOperation(state, {
        kind: "incident",
        incident: incident(card.id, "Mất"),
      }),
    /khóa thẻ/,
  )
  const locked = applyOperation(state, {
    kind: "lock",
    cardId: card.id,
    reason: "Khách báo mất thẻ",
  })
  const lost = applyOperation(locked, {
    kind: "incident",
    incident: incident(card.id, "Mất"),
  })
  assert.equal(lost.cards.find((c) => c.id === card.id).status, "Mất / hỏng")
  assert.throws(
    () =>
      applyOperation(lost, {
        kind: "unlock",
        cardId: card.id,
        reason: "Tìm thấy thẻ",
      }),
    /không thể/,
  )
})

test("lock and unlock require a reason and append audit entries", () => {
  const state = seedOperations(),
    card = activeCard(state)
  assert.throws(
    () =>
      applyOperation(state, {
        kind: "lock",
        cardId: card.id,
        reason: " ",
      }),
    /lý do/,
  )
  const locked = applyOperation(state, {
    kind: "lock",
    cardId: card.id,
    reason: "Khách báo mất thẻ",
  })
  assert.equal(locked.cards.find((c) => c.id === card.id).status, "Khóa")
  const unlocked = applyOperation(locked, {
    kind: "unlock",
    cardId: card.id,
    reason: "Khách tìm lại được thẻ",
  })
  assert.equal(
    unlocked.cards.find((c) => c.id === card.id).status,
    "Đang hoạt động",
  )
  assert.deepEqual(
    unlocked.activity.slice(0, 2).map((a) => a.title),
    ["Mở khóa thẻ", "Khóa thẻ"],
  )
  assert.equal(
    state.cards.find((c) => c.id === card.id).status,
    "Đang hoạt động",
  )
})

test("navigation separates customers, warehouse overview and one card lookup", () => {
  assert.equal(
    operationMenus.find((menu) => menu.id === "inventory").title,
    "Kho thẻ theo bãi",
  )
  assert.equal(
    operationMenus.find((menu) => menu.id === "subscriptions").group,
    "Quản lý thuê bao",
  )
  assert.deepEqual(
    operationMenus
      .filter((menu) => menu.group === "Quản lý thẻ")
      .map((menu) => menu.id),
    ["inventory", "imports", "handoffs", "lookup", "incidents"],
  )
  assert.equal(operationMenus.filter((menu) => menu.id === "lookup").length, 1)
})

test("ready-stock calculation groups available cards by site, type and vehicle", () => {
  const state = seedOperations()
  const balances = warehouseBalances(state.cards)
  assert.equal(
    new Set(balances.map((row) => row.key)).size,
    estates.reduce((sum, estate) => sum + estate.parks.length, 0),
  )
  assert.equal(
    new Set(
      balances
        .filter((row) => row.park === "Bãi ngoài trời")
        .map((row) => row.key),
    ).size,
    3,
  )
  assert.equal(
    new Set(balances.map((row) => `${row.key}:${row.type}:${row.vehicle}`))
      .size,
    balances.length,
  )
  assert.equal(
    balances.reduce((sum, row) => sum + row.stock, 0),
    state.cards.filter((card) => card.status === "Trong kho").length,
  )
  for (const row of balances) {
    assert.equal(
      row.stock,
      state.cards.filter(
        (card) =>
          card.estate === row.key.split(":")[0] &&
          card.park === row.park &&
          card.type === row.type &&
          card.vehicle === row.vehicle &&
          card.status === "Trong kho",
      ).length,
    )
    assert.equal("active" in row, false)
    assert.equal("damaged" in row, false)
  }
})

test("warehouse overview updates the correct site immediately after importing and issuing cards", () => {
  const state = seedOperations()
  const before = warehouseBalances(state.cards)
  const ready = (rows) =>
    rows
      .filter((row) => row.key === "A:2")
      .reduce((sum, row) => sum + row.stock, 0)
  const imported = applyOperation(state, {
    kind: "import",
    lot: {
      id: "LO-OVERVIEW-001",
      estate: "A",
      park: estates[0].parks[2],
      supplier: "Nhà cung cấp",
      date: today,
      ids: ["OVERVIEW-001"],
    },
    type: "Vãng lai",
    vehicle: "Ô tô",
  })
  const balances = warehouseBalances(imported.cards)
  assert.equal(ready(balances), ready(before) + 1)
  assert.deepEqual(
    balances.filter((row) => row.key !== "A:2"),
    before.filter((row) => row.key !== "A:2"),
  )
  const issued = applyOperation(imported, {
    kind: "handoff",
    handoff: {
      id: "BG-OVERVIEW-001",
      estate: "A",
      park: estates[0].parks[2],
      recipient: "Người nhận tại bãi",
      date: today,
      ids: ["OVERVIEW-001"],
      note: "",
    },
  })
  assert.equal(ready(warehouseBalances(issued.cards)), ready(before))
})

test("an empty warehouse stays visible with zero ready cards", () => {
  const balances = warehouseBalances([])
  assert.equal(balances.length, 9)
  assert.ok(balances.every((row) => row.stock === 0))
})
