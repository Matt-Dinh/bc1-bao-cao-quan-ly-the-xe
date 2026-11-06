import { cardTypes, estates, maxDate, normalize, today, vehicles } from "./data"
import type { Card } from "./data"
import { snapshot } from "./report-model"

export const cardStatuses = [
  "Trong kho",
  "Đang hoạt động",
  "Khóa",
  "Mất / hỏng",
] as const
export const operationMenus = [
  {
    id: "inventory",
    group: "Quản lý thẻ",
    title: "Kho thẻ theo bãi",
    description:
      "Theo dõi tổng số thẻ và trạng thái tại từng kho bãi. Xem thông tin và quản lý từng thẻ tại tab Tra cứu thẻ.",
  },
  {
    id: "imports",
    group: "Quản lý thẻ",
    title: "Nhập kho thẻ",
    description:
      "Tiếp nhận lô thẻ, kiểm tra dữ liệu và nhập vào kho của bãi nhận.",
  },
  {
    id: "subscriptions",
    group: "Quản lý thuê bao",
    title: "Thuê bao & thẻ VIP",
    description: "Đăng ký thuê bao, kích hoạt và cấp lại thẻ từ kho của bãi.",
  },
  {
    id: "handoffs",
    group: "Quản lý thẻ",
    title: "Giao thẻ vãng lai",
    description:
      "Giao thẻ từ kho cho bàn thẻ của bãi và theo dõi từng phiếu giao.",
  },
  {
    id: "lookup",
    group: "Quản lý thẻ",
    title: "Tra cứu thẻ",
    description:
      "Tìm thẻ, xem lịch sử, khóa / mở khóa và thu hồi. Dữ liệu cập nhật theo thao tác trong phiên.",
  },
  {
    id: "incidents",
    group: "Quản lý thẻ",
    title: "Biên bản mất / hỏng",
    description: "Ghi nhận sự cố thẻ, biên bản và khoản thu liên quan.",
  },
] as const
export type OperationScreen = typeof operationMenus[number]["id"]
export function warehouseBalances(cards: Card[]) {
  return estates.flatMap((estate) =>
    estate.parks.flatMap((park, index) => {
      const rows = cards.filter(
        (c) =>
          c.estate === estate.id && c.park === park && c.status === "Trong kho",
      )
      const base = {
        key: `${estate.id}:${index}`,
        estate: estate.short,
        park,
      }
      if (!rows.length) return [{ ...base, type: "—", vehicle: "—", stock: 0 }]
      return cardTypes.flatMap((type) =>
        vehicles.flatMap((vehicle) => {
          const stock = rows.filter(
            (c) => c.type === type && c.vehicle === vehicle,
          ).length
          return stock ? [{ ...base, type, vehicle, stock }] : []
        }),
      )
    }),
  )
}
export interface Lot {
  id: string
  park: string
  estate: string
  supplier: string
  date: string
  ids: string[]
}
export interface Handoff {
  id: string
  estate: string
  park: string
  recipient: string
  date: string
  ids: string[]
  note: string
}
export interface Incident {
  id: string
  cardId: string
  kind: "Mất" | "Hỏng"
  reason: string
  fee: number
  date: string
  fromReturn: boolean
}
export interface Subscription {
  id: string
  cardId: string
  owner: string
  phone: string
  plate: string
  type: string
  group: string
  apartment: string
  contract: string
  contractEnd: string
  effectiveFrom: string
  expiry: string
  ended: boolean
}
export interface ActivityEntry {
  cardId: string
  at: string
  title: string
  reason: string
}
export interface OperationState {
  cards: Card[]
  lots: Lot[]
  handoffs: Handoff[]
  incidents: Incident[]
  subscriptions: Subscription[]
  activity: ActivityEntry[]
}
export function seedOperations(): OperationState {
  const base = snapshot(maxDate)
  const lots: Lot[] = []
  const added: Card[] = []
  estates.forEach((e) =>
    e.parks.forEach((park, pi) => {
      const id = `LO-${e.code}-2910-${pi + 1}`
      const ids = cardTypes.map((type, ti) => {
        const code = `${e.id}-NEW-${pi + 1}${ti + 1}01`
        added.push({
          ...base[0],
          id: code,
          estate: e.id,
          park,
          type,
          vehicle: "Ô tô",
          owner: "—",
          phone: "—",
          plate: "—",
          group: "—",
          apartment: "—",
          subscription: "",
          issued: "",
          expiry: "",
          lastTrip: "",
          unused: 0,
          alerts: [],
          batch: id,
          status: "Trong kho",
          times: 1,
        })
        return code
      })
      lots.push({
        id,
        estate: e.id,
        park,
        supplier: "Công ty CP Công nghệ Việt",
        date: today,
        ids,
      })
    }),
  )
  return {
    cards: [...added, ...base],
    lots,
    handoffs: [
      {
        id: "BG-20261028-001",
        estate: "A",
        park: estates[0].parks[0],
        recipient: "Nguyễn Văn Hùng · Bàn thẻ B1",
        date: maxDate,
        ids: base
          .filter(
            (c) =>
              c.estate === "A" &&
              c.park === estates[0].parks[0] &&
              c.type === "Vãng lai" &&
              c.status === "Đang hoạt động",
          )
          .slice(0, 20)
          .map((c) => c.id),
        note: "Bàn giao ca sáng.",
      },
    ],
    incidents: base
      .filter((c) => c.status === "Mất / hỏng")
      .map((c, i) => ({
        id: `BB-20261016-${String(i + 1).padStart(3, "0")}`,
        cardId: c.id,
        kind: i % 2 ? "Hỏng" : "Mất",
        reason:
          i % 2 ? "Thẻ hỏng, không đọc được mã." : "Khách hàng báo mất thẻ.",
        fee: i % 2 ? 0 : 50000,
        date: "2026-10-16",
        fromReturn: false,
      })),
    subscriptions: base
      .filter(
        (c) =>
          c.type !== "Vãng lai" &&
          c.status !== "Trong kho" &&
          c.status !== "Mất / hỏng",
      )
      .map((c) => ({
        id: c.subscription,
        cardId: c.id,
        owner: c.owner,
        phone: c.phone,
        plate: c.plate,
        type: c.type,
        group: c.group,
        apartment: c.apartment,
        contract: c.group === "Gian hàng" ? `HD-${c.subscription}` : "",
        contractEnd: "2026-12-31",
        effectiveFrom: c.issued,
        expiry: c.expiry,
        ended: false,
      })),
    activity: added.map((c) => ({
      cardId: c.id,
      at: `${today}T08:00:00`,
      title: "Nhập kho theo lô",
      reason: `Nhập lô ${c.batch} · ${c.park}.`,
    })),
  }
}
interface ImportAction {
  kind: "import"
  lot: Lot
  type: string
  vehicle: string
}
interface ActivateAction {
  kind: "activate"
  subscription: Subscription
  park: string
  vehicle: string
  replacement: boolean
  reason: string
}
interface HandoffAction {
  kind: "handoff"
  handoff: Handoff
}
interface LockAction {
  kind: "lock" | "unlock"
  cardId: string
  reason: string
}
interface ReturnAction {
  kind: "return"
  cardId: string
  checked: boolean
  result: string
  reason: string
  incident?: Incident
}
interface IncidentAction {
  kind: "incident"
  incident: Incident
}
export type OperationAction = ImportAction | ActivateAction | HandoffAction | LockAction | ReturnAction | IncidentAction

// In-memory prototype reducer: every action validates first, then changes the whole record atomically.
export function applyOperation(
  state: OperationState,
  action: OperationAction,
): OperationState {
  let next: OperationState = {
    ...state,
    cards: [...state.cards],
    lots: [...state.lots],
    handoffs: [...state.handoffs],
    incidents: [...state.incidents],
    subscriptions: [...state.subscriptions],
    activity: [...state.activity],
  }
  const get = (id: string) => {
    const card = state.cards.find((c) => normalize(c.id) === normalize(id))
    if (!card) throw new Error("Không tìm thấy mã thẻ. Vui lòng kiểm tra lại.")
    return card
  }
  const change = (
    card: Card,
    fields: Partial<Card>,
    title: string,
    reason: string,
  ) => {
    next.cards = next.cards.map((c) =>
      c.id === card.id ? { ...c, ...fields } : c,
    )
    next.activity.unshift({
      cardId: card.id,
      at: `${today}T${new Date().toTimeString().slice(0, 8)}`,
      title,
      reason,
    })
  }
  const reasonRequired = (value: string) => {
    if (!value.trim() || value.trim().length > 500)
      throw new Error("Vui lòng nhập lý do, tối đa 500 ký tự.")
  }
  const validateIncident = (incident: Incident) => {
    if (
      !incident.id.trim() ||
      next.incidents.some((i) => normalize(i.id) === normalize(incident.id))
    )
      throw new Error("Số biên bản bị trùng hoặc chưa được nhập.")
    reasonRequired(incident.reason)
    if (
      !Number.isInteger(incident.fee) ||
      incident.fee < 0 ||
      incident.fee > 1000000000
    )
      throw new Error("Số tiền phải là số nguyên từ 0 đến 1.000.000.000 ₫.")
    if (!incident.date || incident.date > today)
      throw new Error("Ngày lập biên bản không được sau ngày hôm nay.")
  }
  if (action.kind === "import") {
    const { lot } = action
    if (
      !lot.ids.length ||
      !lot.supplier.trim() ||
      !estates.some((e) => e.id === lot.estate && e.parks.includes(lot.park))
    )
      throw new Error(
        "Vui lòng chọn bãi nhận, nhà cung cấp và ít nhất một mã thẻ hợp lệ.",
      )
    if (state.lots.some((l) => normalize(l.id) === normalize(lot.id)))
      throw new Error("Mã lô đã tồn tại.")
    const ids = lot.ids.map(normalize)
    if (
      new Set(ids).size !== ids.length ||
      lot.ids.some(
        (id) =>
          !id.trim() ||
          id.length > 255 ||
          state.cards.some((c) => normalize(c.id) === normalize(id)),
      )
    )
      throw new Error("Danh sách có mã thẻ trùng hoặc không hợp lệ.")
    const template = state.cards[0]
    next.cards = [
      ...lot.ids.map((id) => ({
        ...template,
        id: id.trim(),
        estate: lot.estate,
        park: lot.park,
        batch: lot.id,
        type: action.type,
        vehicle: action.vehicle,
        status: "Trong kho",
        owner: "—",
        phone: "—",
        plate: "—",
        group: "—",
        subscription: "",
        apartment: "—",
        issued: "",
        expiry: "",
        lastTrip: "",
        alerts: [],
      })),
      ...next.cards,
    ]
    next.lots.unshift(lot)
    lot.ids.forEach((cardId) =>
      next.activity.unshift({
        cardId,
        at: `${today}T09:00:00`,
        title: "Nhập kho",
        reason: `${lot.id} · ${lot.park}`,
      }),
    )
  } else if (action.kind === "activate") {
    const s = action.subscription,
      card = get(s.cardId)
    if (
      card.status !== "Trong kho" ||
      card.park !== action.park ||
      card.vehicle !== action.vehicle
    )
      throw new Error(
        "Thẻ phải đang trong kho đúng bãi nhận và đúng loại phương tiện.",
      )
    if (action.replacement) {
      const old = state.subscriptions.find((x) => x.id === s.id)
      if (
        !old ||
        old.ended ||
        !["Trong kho", "Mất / hỏng"].includes(get(old.cardId).status)
      )
        throw new Error(
          "Cần thu hồi hoặc lập biên bản mất / hỏng cho thẻ cũ trước khi cấp lại.",
        )
      reasonRequired(action.reason)
    } else {
      if (
        !s.owner.trim() ||
        !/^\d{10}$/.test(s.phone) ||
        !s.plate.trim() ||
        !/^[A-Za-z0-9Đđ.\s-]+$/.test(s.plate) ||
        !normalize(s.plate)
      )
        throw new Error(
          "Vui lòng kiểm tra tên khách hàng, số điện thoại 10 chữ số và biển số.",
        )
      if (s.type === "Thuê bao tháng" && !s.group)
        throw new Error("Vui lòng chọn nhóm khách hàng.")
      if (s.type !== "VIP" && s.group === "Cư dân" && !s.apartment.trim())
        throw new Error("Thẻ cư dân phải được gắn căn hộ.")
      if (
        s.type !== "VIP" &&
        s.group === "Gian hàng" &&
        (!s.contract.trim() || s.contractEnd < today)
      )
        throw new Error("Gian hàng cần hợp đồng còn hiệu lực.")
    }
    if (
      !s.effectiveFrom ||
      (s.expiry && s.expiry < s.effectiveFrom) ||
      (s.type === "Thuê bao tháng" && !s.expiry)
    )
      throw new Error("Vui lòng kiểm tra khoảng thời gian hiệu lực.")
    change(
      card,
      {
        status: "Đang hoạt động",
        type: s.type,
        owner: s.owner.trim(),
        phone: s.phone.includes("*")
          ? s.phone
          : `${s.phone.slice(0, 4)}****${s.phone.slice(-3)}`,
        plate: s.plate.trim(),
        group: s.type === "VIP" ? "—" : s.group,
        apartment: s.apartment || "—",
        subscription: s.id,
        issued: today,
        expiry: s.expiry,
        alerts: [],
      },
      action.replacement ? "Cấp lại thẻ" : "Kích hoạt thẻ",
      action.reason || `Cấp cho thuê bao ${s.id}.`,
    )
    next.subscriptions = action.replacement
      ? next.subscriptions.map((x) => (x.id === s.id ? s : x))
      : [s, ...next.subscriptions]
  } else if (action.kind === "handoff") {
    const h = action.handoff
    if (
      !h.ids.length ||
      !h.recipient.trim() ||
      new Set(h.ids).size !== h.ids.length
    )
      throw new Error("Vui lòng chọn thẻ và nhập người nhận.")
    const selected = h.ids.map(get)
    if (
      selected.some(
        (c) =>
          c.status !== "Trong kho" ||
          c.type !== "Vãng lai" ||
          c.park !== h.park ||
          c.estate !== h.estate,
      )
    )
      throw new Error("Chỉ giao thẻ vãng lai đang trong kho của đúng bãi.")
    selected.forEach((c) =>
      change(
        c,
        { status: "Đang hoạt động", issued: today },
        "Giao thẻ vãng lai",
        `${h.id} · ${h.recipient}`,
      ),
    )
    next.handoffs.unshift(h)
  } else {
    const card = get(
      action.kind === "incident" ? action.incident.cardId : action.cardId,
    )
    if (card.status === "Mất / hỏng")
      throw new Error("Thẻ mất / hỏng không thể tiếp tục thay đổi trạng thái.")
    if (action.kind === "lock" || action.kind === "unlock") {
      reasonRequired(action.reason)
      if (card.status !== (action.kind === "lock" ? "Đang hoạt động" : "Khóa"))
        throw new Error("Trạng thái thẻ đã thay đổi. Vui lòng kiểm tra lại.")
      change(
        card,
        { status: action.kind === "lock" ? "Khóa" : "Đang hoạt động" },
        action.kind === "lock" ? "Khóa thẻ" : "Mở khóa thẻ",
        action.reason.trim(),
      )
    } else if (action.kind === "return") {
      reasonRequired(action.reason)
      if (
        !["Đang hoạt động", "Khóa"].includes(card.status) ||
        !action.checked ||
        !["pass", "damaged"].includes(action.result)
      )
        throw new Error(
          "Cần kiểm tra vật lý và chọn kết quả trước khi thu hồi.",
        )
      if (action.result === "damaged") {
        if (
          !action.incident ||
          action.incident.kind !== "Hỏng" ||
          action.incident.cardId !== card.id
        )
          throw new Error(
            "Thẻ không đạt cần lập biên bản hỏng ngay khi thu hồi.",
          )
        validateIncident(action.incident)
        next.incidents.unshift(action.incident)
      }
      change(
        card,
        {
          status: action.result === "pass" ? "Trong kho" : "Mất / hỏng",
          owner: "—",
          phone: "—",
          plate: "—",
          subscription: "",
          group: "—",
          apartment: "—",
          expiry: "",
          alerts: [],
          lastTrip: "",
        },
        action.result === "pass"
          ? "Thu hồi · Kiểm tra đạt"
          : "Thu hồi · Thẻ hỏng",
        action.reason.trim(),
      )
      next.subscriptions = next.subscriptions.map((s) =>
        s.cardId === card.id ? { ...s, ended: true } : s,
      )
    } else if (action.kind === "incident") {
      validateIncident(action.incident)
      if (
        action.incident.kind === "Mất" &&
        card.type !== "Vãng lai" &&
        card.status === "Đang hoạt động"
      )
        throw new Error(
          "Vui lòng khóa thẻ thuê bao / VIP bị mất trước khi lập biên bản.",
        )
      change(
        card,
        { status: "Mất / hỏng", alerts: [] },
        `Biên bản ${action.incident.kind.toLowerCase()} thẻ`,
        `${action.incident.id} · ${action.incident.reason}`,
      )
      next.incidents.unshift(action.incident)
    }
  }
  return next
}
