import { customerGroups, estates, normalize, today, vehicles } from "./data"
import type { Card } from "./data"
import type { OperationState, Subscription } from "./operations-model"

export const managementScreens = [
  "subscriptions",
  "customers",
  "vehicles",
  "services",
] as const
export type ManagementScreen = typeof managementScreens[number]
export function parseManagementRelation(value: string) {
  const match = /^(customer|vehicle|service):(.+)$/.exec(value)
  return match ? { kind: match[1] as "customer" | "vehicle" | "service", id: match[2] } : null
}
export const isManagementScreen = (
  value: string | null,
): value is ManagementScreen =>
  managementScreens.some((screen) => screen === value)
export const controlModes = [
  "Không",
  "UHF hoặc (Biển số và Khuôn mặt)",
  "UHF và Khuôn mặt",
  "UHF hoặc Biển số",
  "(Biển số và Khuôn mặt) hoặc (Biển số và UHF)",
  "QRCODE và Khuôn mặt",
  "Biển số và Thẻ UHF",
  "UHF",
  "Khuôn mặt",
  "Mở tay",
  "Biển số và Thẻ và Khuôn mặt",
  "(Biển số và Thẻ) hoặc (Biển số và Khuôn mặt)",
  "Biển số hoặc Thẻ",
  "Biển số và Thẻ",
  "Biển số và Khuôn mặt",
  "Biển số",
] as const
export type ControlMode = typeof controlModes[number]
export const defaultControlMode: ControlMode = "Biển số và Thẻ"
export const subscriptionStates = [
  "Đang hoạt động",
  "Tạm ngừng",
  "Đã hủy",
] as const
export type SubscriptionState = typeof subscriptionStates[number]
export const managementParks = estates.flatMap((estate) =>
  estate.parks.map((park, index) => ({
    id: `${estate.id}:${index}`,
    estate: estate.id,
    park,
    label: `${park} · ${estate.short}`,
  })),
)
export interface ManagedCustomer {
  id: string
  estate: string
  name: string
  phone: string
  email: string
  identity: string
  apartment: string
  address: string
  active: boolean
  source: string
  note: string
}
export interface ManagedVehicle {
  id: string
  estate: string
  plate: string
  vehicle: string
  brand: string
  color: string
  active: boolean
  note: string
}
export interface ManagedService {
  id: string
  name: string
  vehicle: string
  category: "Thuê bao" | "Vãng lai"
  control: string
  pricing: "Theo tháng" | "Theo giờ" | "Theo lượt" | "Miễn phí"
  price: number
  validFrom: string
  validTo: string
  active: boolean
  note: string
}
export interface SubscriptionLot {
  parkId: string
  serviceId: string
  active: boolean
}
export interface SubscriberProfile {
  id: string
  estate: string
  customerId: string
  members: string[]
  vehicleIds: string[]
  vehicle: string
  noPlate: boolean
  anyPlate: boolean
  lots: SubscriptionLot[]
  status: SubscriptionState
  note: string
}
export interface SubscriptionDirectory {
  customers: ManagedCustomer[]
  vehicles: ManagedVehicle[]
  services: ManagedService[]
  profiles: SubscriberProfile[]
}
export interface SubscriberInput extends SubscriberProfile {
  type: "Thuê bao tháng" | "VIP"
  group: string
  contract: string
  contractEnd: string
  from: string
  to: string
}
const hasValue = (value: string) => !!value && value !== "—"
const plateKey = (value: string) => normalize(value).replace(/[^A-Z0-9Đ]/g, "")
const newId = (prefix: string, rows: { id: string }[]) => {
  let number = rows.length + 1
  while (
    rows.some(
      (row) => row.id === `${prefix}-${String(number).padStart(5, "0")}`,
    )
  )
    number++
  return `${prefix}-${String(number).padStart(5, "0")}`
}
function fail(message: string): never {
  throw new Error(message)
}
const dayValid = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value
const validatePeriod = (from: string, to: string) => {
  if (!dayValid(from) || (to && (!dayValid(to) || to < from)))
    fail("Kiểm tra lại khoảng thời gian hiệu lực.")
}
export const assignedCard = (state: OperationState, id: string) =>
  state.cards.find(
    (card) =>
      card.subscription === id &&
      ["Đang hoạt động", "Khóa"].includes(card.status),
  )
export function subscriberCards(state: OperationState) {
  const ids = new Set(state.subscriptions.map((row) => row.id))
  return new Map(
    state.cards
      .filter(
        (card) =>
          ids.has(card.subscription) &&
          ["Đang hoạt động", "Khóa"].includes(card.status),
      )
      .map((card) => [card.subscription, card]),
  )
}

export function seedSubscriptionDirectory(
  cards: Card[],
  subscriptions: Subscription[],
): SubscriptionDirectory {
  const result: SubscriptionDirectory = {
    customers: [],
    vehicles: [],
    services: [],
    profiles: [],
  }
  for (const vehicle of vehicles) {
      result.services.push({
        id: `DV-TB-${vehicles.indexOf(vehicle) + 1}`,
        name: `Gói thuê bao ${vehicle.toLocaleLowerCase("vi")}`,
        vehicle,
        category: "Thuê bao",
        control: defaultControlMode,
        pricing: "Theo tháng",
        price:
          vehicle === "Ô tô" ? 1200000 : vehicle === "Xe máy" ? 120000 : 60000,
        validFrom: "2026-09-01",
        validTo: "",
        active: true,
        note: "",
      })
    }
  result.services.push({
    id: "DV-VL-001",
    name: "Vãng lai ô tô",
    vehicle: "Ô tô",
    category: "Vãng lai",
    control: defaultControlMode,
    pricing: "Theo giờ",
    price: 15000,
    validFrom: "2026-09-01",
    validTo: "",
    active: true,
    note: "",
  })
  const customerIndex = new Map<string, ManagedCustomer>()
  const vehicleIndex = new Map<string, ManagedVehicle>()
  const byCard = new Map(cards.map((card) => [card.id, card]))
  for (const sub of subscriptions) {
    const card = byCard.get(sub.cardId)
    if (!card) continue
    // Names and masked phone numbers are not identities: preserve distinct apartments.
    const customerKey = [card.estate, sub.owner, sub.phone, sub.apartment].join(
      "|",
    )
    let customer = customerIndex.get(customerKey)
    if (!customer) {
      customer = {
        id: newId("KH", result.customers),
        estate: card.estate,
        name: sub.owner,
        phone: sub.phone,
        apartment: hasValue(sub.apartment) ? sub.apartment : "",
        email: "",
        identity: "",
        address: "",
        active: true,
        source: sub.group === "Cư dân" ? "Đồng bộ" : "Hệ thống",
        note: "",
      }
      result.customers.push(customer)
      customerIndex.set(customerKey, customer)
    }
    const vehicleIds: string[] = []
    if (hasValue(sub.plate)) {
      const key = `${card.estate}:${plateKey(sub.plate)}`
      let vehicle = vehicleIndex.get(key)
      if (!vehicle) {
        vehicle = {
          id: newId("XE", result.vehicles),
          estate: card.estate,
          plate: sub.plate,
          vehicle: card.vehicle,
          brand: "",
          color: "",
          active: true,
          note: "",
        }
        result.vehicles.push(vehicle)
        vehicleIndex.set(key, vehicle)
      }
      vehicleIds.push(vehicle.id)
    }
    const park = managementParks.find(
      (row) => row.estate === card.estate && row.park === card.park,
    )
    const service = result.services.find(
      (row) => row.category === "Thuê bao" && row.vehicle === card.vehicle,
    )
    result.profiles.push({
      id: sub.id,
      estate: card.estate,
      customerId: customer.id,
      members: [],
      vehicleIds,
      vehicle: card.vehicle,
      noPlate: !vehicleIds.length && sub.type !== "VIP",
      anyPlate: !vehicleIds.length && sub.type === "VIP",
      lots:
        park && service
          ? [{ parkId: park.id, serviceId: service.id, active: true }]
          : [],
      status: sub.ended ? "Đã hủy" : "Đang hoạt động",
      note: "",
    })
  }
  return result
}
export function directoryOf(state: OperationState) {
  return (
    state.directory ??
    seedSubscriptionDirectory(state.cards, state.subscriptions)
  )
}
export const subscriberInput = (
  state: OperationState,
  id: string,
): SubscriberInput | undefined => {
  const sub = state.subscriptions.find((row) => row.id === id)
  const profile = directoryOf(state).profiles.find((row) => row.id === id)
  return sub && profile
    ? {
        ...profile,
        members: [...profile.members],
        vehicleIds: [...profile.vehicleIds],
        lots: profile.lots.map((lot) => ({ ...lot })),
        type: sub.type as SubscriberInput["type"],
        group: sub.group,
        contract: sub.contract,
        contractEnd: sub.contractEnd,
        from: sub.effectiveFrom,
        to: sub.expiry,
      }
    : undefined
}
function projectSubscriber(state: OperationState, id: string): OperationState {
  const directory = directoryOf(state)
  const profile = directory.profiles.find((row) => row.id === id)
  const sub = state.subscriptions.find((row) => row.id === id)
  if (!profile || !sub) return state
  const customer = directory.customers.find(
    (row) => row.id === profile.customerId,
  )
  if (!customer) return state
  const plates = profile.vehicleIds
    .map(
      (vehicleId) =>
        directory.vehicles.find((row) => row.id === vehicleId)?.plate,
    )
    .filter(Boolean) as string[]
  const plate = profile.anyPlate
    ? "Không giới hạn biển số"
    : profile.noPlate
      ? "Không biển số"
      : plates.join(", ") || "—"
  const fields = {
    owner: customer.name,
    phone: customer.phone || "—",
    plate,
    apartment: customer.apartment || "—",
  }
  return {
    ...state,
    subscriptions: state.subscriptions.map((row) =>
      row.id === id ? { ...row, ...fields } : row,
    ),
    cards: state.cards.map((card) =>
      card.subscription === id &&
      ["Đang hoạt động", "Khóa"].includes(card.status)
        ? {
            ...card,
            ...fields,
            phone:
              customer.phone.includes("*") || !customer.phone
                ? customer.phone || "—"
                : `${customer.phone.slice(0, 4)}****${customer.phone.slice(-3)}`,
            type: sub.type,
            vehicle: profile.vehicle,
            group: sub.type === "VIP" ? "—" : sub.group,
            expiry: sub.expiry,
          }
        : card,
    ),
  }
}

export function saveManagedCustomer(
  state: OperationState,
  input: ManagedCustomer,
): OperationState {
  const directory = directoryOf(state)
  const old = directory.customers.find((row) => row.id === input.id)
  if (
    !estates.some((estate) => estate.id === input.estate) ||
    !input.name.trim()
  )
    fail("Chọn khu đô thị và nhập tên khách hàng.")
  if (old && old.estate !== input.estate)
    fail("Không đổi khu đô thị của khách hàng đã tạo.")
  const phone = input.phone.trim()
  if (phone && !/^0\d{9}$/.test(phone) && phone !== old?.phone)
    fail("Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.")
  if (input.apartment.trim() && !phone)
    fail("Khách hàng có căn hộ cần có số điện thoại.")
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
    fail("Email không hợp lệ.")
  if (input.identity && !/^\d{6,20}$/.test(input.identity))
    fail("Số giấy tờ gồm 6–20 chữ số.")
  if (
    phone &&
    !phone.includes("*") &&
    directory.customers.some(
      (row) =>
        row.id !== input.id &&
        row.estate === input.estate &&
        row.phone === phone &&
        row.apartment === input.apartment.trim(),
    )
  )
    fail(
      "Khách hàng có số điện thoại và căn hộ này đã tồn tại. Hãy chọn hồ sơ có sẵn.",
    )
  const record = {
    ...input,
    id: old?.id || newId("KH", directory.customers),
    name: input.name.trim(),
    phone,
    apartment: input.apartment.trim(),
    source: old?.source ?? "Hệ thống",
  }
  let next = {
    ...state,
    directory: {
      ...directory,
      customers: old
        ? directory.customers.map((row) => (row.id === old.id ? record : row))
        : [record, ...directory.customers],
    },
  }
  for (const profile of directory.profiles.filter(
    (row) => row.customerId === record.id,
  ))
    next = (projectSubscriber(next, profile.id) as typeof next)
  return next
}
export function saveManagedVehicle(
  state: OperationState,
  input: ManagedVehicle,
): OperationState {
  const directory = directoryOf(state)
  const old = directory.vehicles.find((row) => row.id === input.id)
  if (
    !estates.some((estate) => estate.id === input.estate) ||
    !vehicles.includes(input.vehicle)
  )
    fail("Chọn khu đô thị và loại phương tiện.")
  if (old && old.estate !== input.estate)
    fail("Không đổi khu đô thị của xe đã tạo.")
  if (
    !plateKey(input.plate) ||
    input.plate.length > 20 ||
    !/^[A-Za-z0-9Đđ.\s-]+$/.test(input.plate)
  )
    fail("Biển số gồm chữ, số, dấu phân cách và không quá 20 ký tự.")
  if (
    directory.vehicles.some(
      (row) =>
        row.id !== input.id &&
        row.estate === input.estate &&
        plateKey(row.plate) === plateKey(input.plate),
    )
  )
    fail("Biển số đã tồn tại trong khu đô thị.")
  const profiles = directory.profiles.filter(
    (row) => row.vehicleIds.includes(input.id) && row.status !== "Đã hủy",
  )
  if (old && profiles.length && old.vehicle !== input.vehicle)
    fail("Xe đang gắn thuê bao. Không thay đổi loại phương tiện tại đây.")
  const record = {
    ...input,
    id: old?.id || newId("XE", directory.vehicles),
    plate: input.plate.trim().toUpperCase(),
  }
  let next = {
    ...state,
    directory: {
      ...directory,
      vehicles: old
        ? directory.vehicles.map((row) => (row.id === old.id ? record : row))
        : [record, ...directory.vehicles],
    },
  }
  for (const profile of profiles)
    next = (projectSubscriber(next, profile.id) as typeof next)
  return next
}
export function saveManagedService(
  state: OperationState,
  input: ManagedService,
): OperationState {
  const directory = directoryOf(state)
  const old = directory.services.find((row) => row.id === input.id)
  if (!input.name.trim() || !vehicles.includes(input.vehicle))
    fail("Nhập tên dịch vụ và loại phương tiện.")
  if (
    !["Thuê bao", "Vãng lai"].includes(input.category) ||
    !["Theo tháng", "Theo giờ", "Theo lượt", "Miễn phí"].includes(
      input.pricing,
    ) ||
    !controlModes.some((mode) => mode === input.control)
  )
    fail("Cấu hình dịch vụ không hợp lệ.")
  if (
    !Number.isFinite(input.price) ||
    input.price < 0 ||
    input.price > 100000000
  )
    fail("Đơn giá phải từ 0 đến 100.000.000 đồng.")
  validatePeriod(input.validFrom, input.validTo)
  const used = directory.profiles.some(
    (row) =>
      row.status !== "Đã hủy" &&
      row.lots.some((lot) => lot.serviceId === input.id),
  )
  if (
    old &&
    used &&
    (old.vehicle !== input.vehicle || old.category !== input.category)
  )
    fail(
      "Dịch vụ đang có thuê bao sử dụng. Không đổi nhóm dịch vụ hoặc loại phương tiện.",
    )
  const record = {
    ...input,
    id: old?.id || newId("DV", directory.services),
    name: input.name.trim(),
    price: input.pricing === "Miễn phí" ? 0 : input.price,
  }
  return {
    ...state,
    directory: {
      ...directory,
      services: old
        ? directory.services.map((row) => (row.id === old.id ? record : row))
        : [record, ...directory.services],
    },
  }
}

export function saveSubscriber(
  state: OperationState,
  input: SubscriberInput,
): OperationState {
  const directory = directoryOf(state)
  const old = state.subscriptions.find((row) => row.id === input.id)
  const oldProfile = directory.profiles.find((row) => row.id === input.id)
  if (oldProfile?.status === "Đã hủy")
    fail("Thuê bao đã hủy chỉ được xem thông tin.")
  const customer = directory.customers.find(
    (row) => row.id === input.customerId && row.estate === input.estate,
  )
  if (!customer || (!customer.active && customer.id !== oldProfile?.customerId))
    fail("Chọn khách hàng đang hoạt động thuộc khu đô thị.")
  if (oldProfile && oldProfile.estate !== input.estate)
    fail("Không đổi khu đô thị của thuê bao đã tạo.")
  if (
    !["Thuê bao tháng", "VIP"].includes(input.type) ||
    !vehicles.includes(input.vehicle)
  )
    fail("Chọn loại thuê bao và phương tiện hợp lệ.")
  if (
    new Set(input.members).size !== input.members.length ||
    input.members.includes(input.customerId) ||
    input.members.some(
      (id) =>
        !directory.customers.some(
          (row) => row.id === id && row.estate === input.estate && row.active,
        ),
    )
  )
    fail(
      "Kiểm tra lại danh sách thành viên: không trùng chủ thuê bao, cùng khu đô thị và đang hoạt động.",
    )
  validatePeriod(input.from, input.to)
  if (input.type === "Thuê bao tháng" && !input.to)
    fail("Thuê bao tháng cần ngày hết hiệu lực.")
  if (input.type === "Thuê bao tháng" && !customerGroups.includes(input.group))
    fail("Chọn nhóm thuê bao.")
  if (
    input.type === "Thuê bao tháng" &&
    input.group === "Cư dân" &&
    !customer.apartment
  )
    fail("Khách hàng cư dân cần có căn hộ trong hồ sơ.")
  if (
    input.type === "Thuê bao tháng" &&
    input.group === "Gian hàng" &&
    (!input.contract.trim() ||
      !dayValid(input.contractEnd) ||
      input.contractEnd < input.from ||
      input.contractEnd < today)
  )
    fail("Gian hàng cần hợp đồng còn hiệu lực.")
  if (input.anyPlate && input.type !== "VIP")
    fail("Chỉ VIP được không giới hạn biển số.")
  if (input.type === "VIP" && input.noPlate)
    fail("VIP không giới hạn biển số khác với xe không có biển số.")
  const ids = [...new Set(input.vehicleIds)]
  if ((input.anyPlate || input.noPlate) && ids.length)
    fail(
      "Bỏ lựa chọn xe khi dùng chế độ không biển số hoặc không giới hạn biển số.",
    )
  if (
    !input.anyPlate &&
    !input.noPlate &&
    (input.type === "Thuê bao tháng"
      ? ids.length !== 1
      : !ids.length || ids.length > 10)
  )
    fail(
      input.type === "VIP"
        ? "VIP cần 1–10 xe hoặc chọn Không giới hạn biển số."
        : "Thuê bao tháng chọn đúng một xe, hoặc chọn Xe không có biển số.",
    )
  if (
    ids.some(
      (id) =>
        !directory.vehicles.some(
          (row) =>
            row.id === id &&
            row.estate === input.estate &&
            row.vehicle === input.vehicle &&
            (row.active || oldProfile?.vehicleIds.includes(row.id)),
        ),
    )
  )
    fail("Xe phải cùng khu đô thị, đúng loại phương tiện và đang hoạt động.")
  if (
    input.type === "Thuê bao tháng" &&
    ids.length &&
    directory.profiles.some(
      (profile) =>
        profile.id !== input.id &&
        profile.status !== "Đã hủy" &&
        profile.vehicleIds.some((id) => ids.includes(id)) &&
        state.subscriptions.find((sub) => sub.id === profile.id)?.type ===
          "Thuê bao tháng",
    )
  )
    fail(
      "Xe đã có thuê bao tháng. Hãy bổ sung bãi xe cho thuê bao đang có thay vì đăng ký trùng.",
    )
  if (
    !input.lots.length ||
    new Set(input.lots.map((lot) => lot.parkId)).size !== input.lots.length
  )
    fail("Chọn ít nhất một bãi và không chọn trùng bãi.")
  for (const lot of input.lots) {
    const park = managementParks.find(
      (row) => row.id === lot.parkId && row.estate === input.estate,
    )
    const service = directory.services.find(
      (row) =>
        row.id === lot.serviceId &&
        row.vehicle === input.vehicle &&
        row.category === "Thuê bao",
    )
    const unchanged =
      oldProfile?.lots.some(
        (row) => row.parkId === lot.parkId && row.serviceId === lot.serviceId,
      ) &&
      old?.effectiveFrom === input.from &&
      old?.expiry === input.to
    if (!park || !service || (!service.active && !unchanged))
      fail(
        "Mỗi bãi cần gói Thuê bao đúng phương tiện; chỉ chọn mới gói đang hoạt động.",
      )
    if (
      !unchanged &&
      (service.validFrom > input.from ||
        (service.validTo &&
          (service.validTo < (input.to || input.from) || !input.to)))
    )
      fail("Hiệu lực của gói dịch vụ chưa phù hợp với thời gian thuê bao.")
  }
  const current = old && assignedCard(state, old.id)
  if (
    current &&
    (old.type !== input.type ||
      current.vehicle !== input.vehicle ||
      !input.lots.some((lot) =>
        managementParks.some(
          (park) =>
            park.id === lot.parkId &&
            park.estate === current.estate &&
            park.park === current.park,
        ),
      ))
  )
    fail(
      "Thu hồi thẻ hiện tại trước khi đổi loại thuê bao, phương tiện hoặc bỏ bãi đang quản lý thẻ.",
    )
  const id =
    old?.id ||
    newId(`TB-${today.replace(/-/g, "")}`, [
      ...state.subscriptions,
      ...state.cards
        .filter((card) => card.subscription)
        .map((card) => ({ id: card.subscription })),
    ])
  const profile: SubscriberProfile = {
    id,
    estate: input.estate,
    customerId: input.customerId,
    members: [...input.members],
    vehicleIds: ids,
    vehicle: input.vehicle,
    noPlate: input.noPlate,
    anyPlate: input.anyPlate,
    lots: input.lots.map((lot) => ({ ...lot })),
    status: oldProfile?.status ?? "Đang hoạt động",
    note: input.note.trim(),
  }
  const record: Subscription = {
    id,
    cardId: old?.cardId ?? "",
    owner: customer.name,
    phone: customer.phone,
    plate: "",
    type: input.type,
    group: input.type === "VIP" ? "—" : input.group,
    apartment: customer.apartment,
    contract: input.type === "VIP" ? "" : input.contract.trim(),
    contractEnd: input.type === "VIP" ? "" : input.contractEnd,
    effectiveFrom: input.from,
    expiry: input.to,
    ended: false,
  }
  return projectSubscriber(
    {
      ...state,
      subscriptions: old
        ? state.subscriptions.map((row) => (row.id === id ? record : row))
        : [record, ...state.subscriptions],
      directory: {
        ...directory,
        profiles: oldProfile
          ? directory.profiles.map((row) => (row.id === id ? profile : row))
          : [profile, ...directory.profiles],
      },
    },
    id,
  )
}

export function changeSubscriberState(
  state: OperationState,
  id: string,
  status: SubscriptionState,
  reason: string,
): OperationState {
  const directory = directoryOf(state)
  const profile =
    directory.profiles.find((row) => row.id === id) ??
    fail("Không tìm thấy thuê bao.")
  if (profile.status === "Đã hủy")
    fail("Thuê bao đã hủy không được kích hoạt lại.")
  if (!subscriptionStates.includes(status) || !reason.trim())
    fail("Chọn trạng thái và nhập lý do thay đổi.")
  return {
    ...state,
    directory: {
      ...directory,
      profiles: directory.profiles.map((row) =>
        row.id === id ? { ...row, status } : row,
      ),
    },
    subscriptions: state.subscriptions.map((row) =>
      row.id === id ? { ...row, ended: status === "Đã hủy" } : row,
    ),
    activity: [
      {
        cardId: assignedCard(state, id)?.id ?? "",
        at: `${today}T10:00:00`,
        title: `${status} thuê bao ${id}`,
        reason: reason.trim(),
      },
      ...state.activity,
    ],
  }
}

export function issueSubscriberCard(
  state: OperationState,
  id: string,
  cardId: string,
  parkId: string,
  reason: string,
): OperationState {
  const directory = directoryOf(state)
  const sub =
    state.subscriptions.find((row) => row.id === id) ??
    fail("Không tìm thấy thuê bao.")
  const profile =
    directory.profiles.find((row) => row.id === id) ??
    fail("Không tìm thấy thông tin thuê bao.")
  if (
    profile.status !== "Đang hoạt động" ||
    (sub.expiry && sub.expiry < today) ||
    sub.effectiveFrom > today
  )
    fail("Chỉ cấp thẻ cho thuê bao đang hoạt động và còn hiệu lực.")
  if (assignedCard(state, id))
    fail(
      "Thẻ cũ còn lưu hành. Cần thu hồi, kiểm tra vật lý hoặc lập biên bản trước khi cấp lại.",
    )
  if (!reason.trim()) fail("Nhập ghi chú cấp thẻ hoặc lý do cấp lại.")
  const park = managementParks.find(
    (row) => row.id === parkId && row.estate === profile.estate,
  )
  const lot = profile.lots.find((row) => row.parkId === parkId && row.active)
  const service = directory.services.find((row) => row.id === lot?.serviceId)
  if (
    !park ||
    !lot ||
    !service?.active ||
    service.validFrom > today ||
    (service.validTo && service.validTo < today)
  )
    fail(
      "Bãi cấp thẻ cần đang áp dụng gói dịch vụ còn hoạt động, còn hiệu lực.",
    )
  const customer = directory.customers.find(
    (row) => row.id === profile.customerId,
  )
  if (!customer?.active)
    fail("Khách hàng đã ngừng hoạt động; chưa thể cấp thẻ.")
  if (!customer.phone)
    fail("Bổ sung số điện thoại chủ thuê bao trước khi cấp thẻ.")
  if (
    profile.vehicleIds.some(
      (vehicleId) =>
        !directory.vehicles.find((row) => row.id === vehicleId)?.active,
    )
  )
    fail("Có xe đã ngừng sử dụng; kiểm tra lại thuê bao trước khi cấp thẻ.")
  const card = state.cards.find((row) => row.id === cardId)
  if (
    !card ||
    card.status !== "Trong kho" ||
    card.estate !== park.estate ||
    card.park !== park.park ||
    card.vehicle !== profile.vehicle ||
    card.type !== sub.type ||
    card.subscription
  )
    fail(
      "Chọn thẻ Trong kho đúng bãi, đúng loại thẻ và phương tiện, chưa gắn thuê bao khác.",
    )
  const next = {
    ...state,
    cards: state.cards.map((row) =>
      row.id === cardId
        ? {
            ...row,
            status: "Đang hoạt động",
            subscription: id,
            issued: today,
            lastTrip: "",
            alerts: [],
            expiry: sub.expiry,
          }
        : row,
    ),
    subscriptions: state.subscriptions.map((row) =>
      row.id === id ? { ...row, cardId, ended: false } : row,
    ),
    activity: [
      {
        cardId,
        at: `${today}T10:00:00`,
        title: sub.cardId ? "Cấp lại thẻ" : "Cấp thẻ thuê bao",
        reason: `${id} · ${reason.trim()}`,
      },
      ...state.activity,
    ],
  }
  return projectSubscriber(next, id)
}
