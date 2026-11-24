import { customerGroups, estates, normalize, today, vehicles } from "./data"
import type { Card } from "./data"
import type { OperationState, Subscription } from "./operations-model"
import { validateFacePhotos } from "./customer-faces"
import type { FacePhoto } from "./customer-faces"
import { energyMatches, energyOptions } from "./vehicle-energy"
import { serviceCoversPeriod, validateServicePrices } from "./service-pricing"
import type { ServicePrice } from "./service-pricing"
export const managementScreens = [
  "subscriptions",
  "customers",
  "vehicles",
  "services",
] as const
export type ManagementScreen = typeof managementScreens[number]
export function parseManagementRelation(value: string) {
  const match = /^(customer|vehicle|service):(.+)$/.exec(value)
  return match
    ? { kind: match[1] as "customer" | "vehicle" | "service", id: match[2] }
    : null
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
export const issuanceStates = [
  "Chưa được cấp thẻ",
  "Đang có thẻ lưu hành",
  "Chờ cấp lại thẻ",
  "Không yêu cầu thẻ",
] as const
/** cardRequired: whether the subscription's control mode needs a card (see subscriberRequiresCard). */
export function subscriptionCardState(
  subscription: Pick<Subscription, "cardId">,
  currentCard?: Card,
  cardRequired = true,
) {
  return currentCard
    ? issuanceStates[1]
    : !cardRequired
      ? issuanceStates[3]
      : subscription.cardId
        ? issuanceStates[2]
        : issuanceStates[0]
}
export type SubscriptionState = typeof subscriptionStates[number]
export const managementParks = estates.flatMap((estate) =>
  estate.parks.map((park, index) => ({
    id: `${estate.id}:${index}`,
    estate: estate.id,
    park,
    label: `${park} · ${estate.short}`,
  })),
)
export interface ManagedAudit {
  createdAt?: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
}
export const managementUnits = estates.map((e) => ({
  id: `BQL-${e.id}`,
  estate: e.id,
  name: `BQL ${e.name}`,
}))
export const vehicleBrands = [
  "VinFast",
  "Toyota",
  "Honda",
  "Hyundai",
  "Kia",
  "Mazda",
  "Ford",
  "Mitsubishi",
  "Mercedes-Benz",
  "BMW",
  "Yamaha",
  "Suzuki",
  "Piaggio",
  "SYM",
  "Giant",
  "Thống Nhất",
  "Khác",
]
export interface ManagedCustomer extends ManagedAudit {
  group?: string
  unitId?: string
  block?: string
  faces?: FacePhoto[]
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
export interface ManagedVehicle extends ManagedAudit {
  useVoucher?: boolean
  energy?: string
  id: string
  estate: string
  plate: string
  vehicle: string
  brand: string
  color: string
  active: boolean
  note: string
}
export interface ManagedService extends ManagedAudit {
  prices?: ServicePrice[]
  voucher?: boolean
  energy?: string
  id: string
  parkIds: string[]
  name: string
  vehicle: string
  category: "Thuê bao" | "Vãng lai"
  control: string
  pricing: "Theo tháng" | "Theo giờ" | "Theo lượt" | "Miễn phí"
  price: number
  /** Legacy pricing migration only; services have no effective-date restriction. */
  validFrom?: string
  validTo?: string
  active: boolean
  note: string
}
export interface SubscriptionLot {
  parkId: string
  serviceId: string
  active: boolean
}
/** UHF tag stuck on the vehicle: registered with the subscription, never stocked or recalled. */
export interface UhfTag {
  code: string
  label?: string
}
export interface SubscriberProfile {
  uhf?: UhfTag
  energy?: string
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
  uhfCode?: string
  uhfLabel?: string
  cardId?: string
  cardParkId?: string
  cardReason?: string
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
// A mode requires the plate when every alternative ("hoặc") includes "Biển số".
export const controlRequiresPlate = (mode: string) =>
  mode.split(" hoặc ").every((part) => part.includes("Biển số"))
// "Thẻ" means a stocked Proximity/Mifare card; "UHF" / "Thẻ UHF" means the UHF tag stuck on the vehicle.
export const branchUsesCard = (part: string) => /Thẻ(?! UHF)/.test(part)
export const branchUsesUhf = (part: string) => part.includes("UHF")
export const controlRequiresCard = (mode: string) =>
  mode.split(" hoặc ").every(branchUsesCard)
export const controlRequiresUhf = (mode: string) =>
  mode.split(" hoặc ").every(branchUsesUhf)
export const controlUsesUhf = (mode: string) =>
  mode.split(" hoặc ").some(branchUsesUhf)
export const profileUsesUhf = (
  directory: SubscriptionDirectory,
  profile: Pick<SubscriberProfile, "lots">,
) =>
  profile.lots.some((lot) => lot.active &&
    controlUsesUhf(directory.services.find((s) => s.id === lot.serviceId)?.control || "Không"))
const availableControlBranches = (mode: string, profile: SubscriberProfile) =>
  mode
    .split(" hoặc ")
    .filter(
      (part) =>
        !(profile.anyPlate || profile.noPlate) || !part.includes("Biển số"),
    )
export const profileRequiresUhf = (
  directory: SubscriptionDirectory,
  profile: SubscriberProfile,
) =>
  profile.lots.some((lot) => {
    if (!lot.active) return false
    const branches = availableControlBranches(
      directory.services.find((s) => s.id === lot.serviceId)?.control ||
        "Không",
      profile,
    )
    return branches.length > 0 && branches.every(branchUsesUhf)
  })
export function subscriberRequiresCard(
  directory: SubscriptionDirectory,
  profile: SubscriberProfile,
) {
  if (profile.anyPlate) return true
  return profile.lots.some((lot) => {
    if (!lot.active) return false
    const branches = availableControlBranches(
      directory.services.find((s) => s.id === lot.serviceId)?.control ||
        "Không",
      profile,
    )
    return branches.length > 0 && branches.every(branchUsesCard)
  })
}
/** Face recognition is registered on the subscription owner; members' photos do not replace it. */
export const profileHasFace = (directory: SubscriptionDirectory, profile: Pick<SubscriberProfile, "customerId">) =>
  !!directory.customers.find(c=>c.id===profile.customerId)?.faces?.length
/** Whether any branch of an active package reads a Proximity/Mifare card; otherwise no card is offered or issued.
 * All branches count (not only plate-free ones) so a VIP card can still be chosen before the plates. */
export const profileUsesCard = (directory: SubscriptionDirectory, profile: Pick<SubscriberProfile, "lots">) =>
  profile.lots.some(lot=>lot.active&&(directory.services.find(s=>s.id===lot.serviceId)?.control||"Không").split(" hoặc ").some(branchUsesCard))
export const profileRequiresFace = (directory: SubscriptionDirectory, profile: SubscriberProfile) => profile.lots.some(l=>{
  if(!l.active)return false
  const branches=availableControlBranches(directory.services.find(s=>s.id===l.serviceId)?.control||"Không",profile)
  return branches.length>0&&branches.every(b=>b.includes("Khuôn mặt"))
})
export function registrationControlError(state: OperationState, input: SubscriberInput): string | null {
  const directory=directoryOf(state),profile=registrationForCard(state,input)
  const card=assignedCard(state,input.id)||state.cards.find(c=>c.id===input.cardId)
  const face=profileHasFace(directory,profile),plate=!!profile.vehicleIds.length
  for(const lot of profile.lots.filter(l=>l.active)) {
    const service=directory.services.find(s=>s.id===lot.serviceId)
    if(!service)continue
    const branches=availableControlBranches(service.control,profile)
    if(!branches.length)continue // Plate-only modes are rejected by saveSubscriber.
    const uhf=!!(input.uhfCode?.trim()||(input.uhfCode===undefined&&directory.profiles.find(p=>p.id===input.id)?.uhf))
    const usable=branches.some(b=>(!b.includes("Biển số")||plate)&&(!branchUsesCard(b)||!!card)&&(!branchUsesUhf(b)||uhf)&&(!b.includes("Khuôn mặt")||face))
    if(!usable && branches.every(branchUsesUhf) && !uhf) return `Dịch vụ “${service.name}” yêu cầu thẻ UHF. Nhập mã thẻ UHF dán trên xe.`
    if(!usable) return branches.every(b=>b.includes("Khuôn mặt"))&&!face
      ? `Dịch vụ “${service.name}” yêu cầu khuôn mặt của chủ thuê bao. Bổ sung ảnh khuôn mặt trong hồ sơ chủ thuê bao trước khi lưu.`
      : `Chưa đáp ứng chế độ kiểm soát của dịch vụ “${service.name}”. Chọn thẻ Proximity/Mifare, nhập mã thẻ UHF hoặc bổ sung khuôn mặt theo chế độ đã chọn.`
  }
  return null
}
/** Registration derives VIP plate mode from the selected vehicles. */
export function registrationInput(input: SubscriberInput): SubscriberInput {
  return {...input, anyPlate:input.type==="VIP"&&!input.vehicleIds.length,
    noPlate:input.type==="VIP"?false:input.noPlate,
    group:input.type==="VIP"?"":input.group,
    contract:input.type==="VIP"?"":input.contract,
    contractEnd:input.type==="VIP"?"":input.contractEnd,
    energy:input.type==="VIP"?undefined:input.energy}
}
/** A registration becomes VIP only through its selected or already allocated VIP card. */
export function registrationForCard(state: OperationState, input: SubscriberInput): SubscriberInput {
  const card=assignedCard(state,input.id)||state.cards.find(c=>c.id===input.cardId)
  // Packages using UHF are always handled as monthly subscriptions.
  const uhf=profileUsesUhf(directoryOf(state),input)
  return registrationInput({...input,type:!uhf&&card?.type==="VIP"?"VIP":"Thuê bao tháng",
    group:customerSubscriptionGroup(directoryOf(state).customers.find(customer=>customer.id===input.customerId))})
}
export function updateRegistrationDraft(state: OperationState, input: SubscriberInput, patch: Partial<SubscriberInput>): SubscriberInput {
  const directory=directoryOf(state)
  let next={...input,...patch}
  if(next.estate!==input.estate) next={...next,customerId:"",members:[],vehicleIds:[],lots:[],cardId:"",cardParkId:""}
  next=registrationForCard(state,next)
  if(next.customerId!==input.customerId || next.group!==input.group) next={...next,contract:"",contractEnd:""}
  if(next.type!==input.type) next={...next,noPlate:false,vehicleIds:next.type==="Thuê bao tháng"&&next.vehicleIds.length>1?[]:next.vehicleIds,
    contract:"",contractEnd:""}
  if(next.noPlate) next.vehicleIds=[]
  next.lots=next.lots.map(lot=>{
    const service=directory.services.find(s=>s.id===lot.serviceId)
    return service&&(!service.parkIds.includes(lot.parkId)||service.vehicle!==next.vehicle||service.category!=="Thuê bao"||next.noPlate&&controlRequiresPlate(service.control))
      ? {...lot,serviceId:""}:lot
  })
  const services=next.lots.map(l=>directory.services.find(s=>s.id===l.serviceId)).filter((s):s is ManagedService=>!!s)
  next.vehicleIds=next.vehicleIds.filter(id=>{
    const vehicle=directory.vehicles.find(v=>v.id===id)
    return vehicle?.estate===next.estate&&vehicle.vehicle===next.vehicle&&services.every(s=>!s.energy||s.energy===vehicle.energy)
  })
  next=registrationInput(next)
  const active=next.lots.filter(l=>l.active)
  if(!active.some(l=>l.parkId===next.cardParkId)) next.cardParkId=active[0]?.parkId||""
  if(next.cardId){const card=state.cards.find(c=>c.id===next.cardId)
    if(!card||!subscriptionCardFits(state,next,card,next.cardParkId||"")) next.cardId=""
  }
  const normalized=registrationForCard(state,next)
  if(normalized.type!==next.type) return {...normalized,contract:"",contractEnd:"",noPlate:false,vehicleIds:normalized.vehicleIds.length>1?[]:normalized.vehicleIds}
  return normalized
}
export function subscriptionCardFits(
  state: OperationState,
  input: SubscriberInput,
  card: Card,
  parkId: string,
) {
  const directory = directoryOf(state),
    park = managementParks.find((p) => p.id === parkId)
  return (
    !!park &&
    input.lots.some((l) => l.active && l.parkId === parkId) &&
    card.status === "Trong kho" &&
    !card.subscription &&
    card.estate === input.estate &&
    card.estate === park.estate &&
    card.park === park.park &&
    card.type === input.type &&
    card.vehicle === input.vehicle &&
    card.technology !== "Thẻ UHF" &&
    profileUsesCard(directory, input)
  )
}
const audit = (old?: ManagedAudit): ManagedAudit => ({
  createdAt: old ? old.createdAt : new Date().toISOString(),
  createdBy: old ? old.createdBy : "Admin Local",
  updatedAt: new Date().toISOString(),
  updatedBy: "Admin Local",
})
export const anyPlateControlMessage =
  "VIP không giới hạn biển số chỉ dùng gói có chế độ kiểm soát không bắt buộc biển số (ví dụ UHF, Khuôn mặt, Biển số hoặc Thẻ)."
export const requiresPlateFreeControl = (
  profile: Pick<SubscriberProfile, "anyPlate" | "noPlate">,
) => profile.anyPlate || profile.noPlate
export const plateFreeControlMessage = (
  profile: Pick<SubscriberProfile, "anyPlate" | "noPlate">,
) =>
  profile.anyPlate
    ? anyPlateControlMessage
    : "Thuê bao Xe không có biển số chỉ dùng gói có chế độ kiểm soát không bắt buộc biển số (ví dụ UHF, Khuôn mặt, Biển số hoặc Thẻ)."
export function subscriptionIdentificationMissing(
  state: OperationState,
  id: string,
) {
  const directory = directoryOf(state)
  const profile = directory.profiles.find((row) => row.id === id)
  if (
    !profile ||
    !requiresPlateFreeControl(profile) ||
    profile.status === "Đã hủy" ||
    profile.uhf ||
    assignedCard(state, id)
  )
    return false
  return ![profile.customerId, ...profile.members].some(
    (customerId) =>
      directory.customers.find((row) => row.id === customerId)?.faces?.length,
  )
}
export const vipIdentificationMissing = subscriptionIdentificationMissing
export function subscriptionPlateControlConflict(
  state: OperationState,
  id: string,
) {
  const directory = directoryOf(state)
  const profile = directory.profiles.find((row) => row.id === id)
  return (
    !!profile &&
    profile.status !== "Đã hủy" &&
    requiresPlateFreeControl(profile) &&
    profile.lots.some((lot) => {
      const service = directory.services.find((row) => row.id === lot.serviceId)
      return !!service && controlRequiresPlate(service.control)
    })
  )
}
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
      parkIds: managementParks.map((park) => park.id),
      name: `Gói thuê bao ${vehicle.toLocaleLowerCase("vi")}`,
      vehicle,
      category: "Thuê bao",
      // Bicycles rarely have plates: the sample package accepts a card instead.
      control: vehicle === "Xe đạp" ? "Biển số hoặc Thẻ" : defaultControlMode,
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
    parkIds: managementParks.map((park) => park.id),
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
        group: customerGroups.includes(sub.group) ? sub.group : "Chưa phân nhóm",
        unitId: `BQL-${card.estate}`,
        block: hasValue(sub.apartment) ? sub.apartment.split("-")[0] : "",
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
    if (customer.group === "Chưa phân nhóm" && customerGroups.includes(sub.group)) customer.group = sub.group
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
          // Sample data: every new vehicle has a type; one in five is electric.
          energy: result.vehicles.length % 5 === 4 ? "Điện" : card.vehicle === "Xe đạp" ? "Không động cơ" : "Xăng/dầu",
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
      energy: !vehicleIds.length && sub.type !== "VIP" ? card.vehicle === "Xe đạp" ? "Không động cơ" : "Xăng/dầu" : undefined,
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
/** Customer classification is independent of VIP/monthly card kind. */
export const customerSubscriptionGroup = (customer?: Pick<ManagedCustomer, "group">) =>
  customerGroups.includes(customer?.group || "") ? customer!.group! : "Chưa phân nhóm"

export function directoryOf(state: OperationState) {
  const directory = state.directory ?? seedSubscriptionDirectory(state.cards, state.subscriptions)
  const missingGroups = directory.customers.some(customer => !customerGroups.includes(customer.group || ""))
  const missingParks = directory.services.some(service => !Array.isArray(service.parkIds))
  if (!missingGroups && !missingParks) return directory
  const legacyGroups = new Map<string, string>()
  if (missingGroups) {
    const subscriptions = new Map(state.subscriptions.map(sub => [sub.id, sub]))
    for (const profile of directory.profiles) {
      const sub = subscriptions.get(profile.id)
      if (sub?.type === "Thuê bao tháng" && customerGroups.includes(sub.group) &&
        (!legacyGroups.has(profile.customerId) || legacyGroups.get(profile.customerId) === "Chưa phân nhóm"))
        legacyGroups.set(profile.customerId, sub.group)
    }
  }
  return { ...directory,
    customers: missingGroups ? directory.customers.map(customer => customerGroups.includes(customer.group || "") ? customer
      : { ...customer, group: legacyGroups.get(customer.id) || "Chưa phân nhóm" }) : directory.customers,
    services: missingParks ? directory.services.map(service => ({ ...service, parkIds: service.parkIds ?? managementParks.map(park => park.id) })) : directory.services,
  }
}
/** Upgrade legacy operational records together; the closed report ledger remains separate. */
export function synchronizeCustomerGroups(state: OperationState): OperationState {
  const directory = directoryOf(state)
  const owners = new Map(directory.customers.map(customer => [customer.id, customer]))
  const groups = new Map(directory.profiles.map(profile => [profile.id, customerSubscriptionGroup(owners.get(profile.customerId))]))
  return { ...state, directory,
    // A contract only belongs to the "Gian hàng" group: leaving that group drops the old contract.
    subscriptions: state.subscriptions.map(sub => {
      if (!groups.has(sub.id)) return sub
      const group = sub.type === "VIP" ? "—" : groups.get(sub.id)!
      return group === "Gian hàng" ? { ...sub, group } : { ...sub, group, contract: "", contractEnd: "" }
    }),
    cards: state.cards.map(card => groups.has(card.subscription) && card.type !== "Vãng lai"
      ? { ...card, group: card.type === "VIP" ? "—" : groups.get(card.subscription)! } : card),
  }
}
/** Classification changes can reveal missing legacy paperwork without inventing it. */
export function subscriptionGroupWarnings(state: OperationState, id: string): string[] {
  const sub = state.subscriptions.find(row=>row.id===id)
  if (!sub || sub.type !== "Thuê bao tháng") return []
  const directory = directoryOf(state), profile = directory.profiles.find(row=>row.id===id)
  const customer = directory.customers.find(row=>row.id===profile?.customerId)
  if (profile?.status === "Đã hủy" || sub.ended) return []
  const warnings: string[] = []
  if (sub.group === "Cư dân" && !customer?.apartment) warnings.push("Thiếu căn hộ")
  if (sub.group === "Gian hàng" && (!sub.contract?.trim() || !dayValid(sub.contractEnd) || sub.contractEnd < sub.effectiveFrom || sub.contractEnd < today))
    warnings.push("Thiếu hợp đồng hợp lệ")
  return warnings
}
/** Estate/park scope; each accepts one value or a multi-select list (empty = every value). */
export function serviceMatchesScope(
  service: ManagedService,
  estate: string | readonly string[] = "",
  parkId: string | readonly string[] = "",
) {
  const estates = typeof estate === "string" ? (estate ? [estate] : []) : estate
  const parks = typeof parkId === "string" ? (parkId ? [parkId] : []) : parkId
  return service.parkIds.some((id) => {
    const park = managementParks.find((row) => row.id === id)
    return (
      !!park && (!estates.length || estates.includes(park.estate)) && (!parks.length || parks.includes(id))
    )
  })
}
export function subscriberEnergies(
  directory: SubscriptionDirectory,
  profile: Pick<SubscriberProfile, "vehicleIds" | "energy"> & {
    anyPlate?: boolean
  },
) {
  if (profile.anyPlate) return ["Chưa xác định"]
  return profile.vehicleIds.length
    ? [
        ...new Set(
          profile.vehicleIds.map(
            (id) =>
              directory.vehicles.find((vehicle) => vehicle.id === id)?.energy ||
              "Chưa xác định",
          ),
        ),
      ]
    : [profile.energy || "Chưa xác định"]
}
export function serviceMatchesSubscriber(
  service: ManagedService,
  directory: SubscriptionDirectory,
  profile: SubscriberProfile,
) {
  return energyMatches(service.energy, subscriberEnergies(directory, profile))
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
        uhfCode: profile.uhf?.code ?? "",
        uhfLabel: profile.uhf?.label ?? "",
        type: sub.type as SubscriberInput["type"],
        group: sub.type === "VIP" ? "" : customerSubscriptionGroup(directoryOf(state).customers.find(customer=>customer.id===profile.customerId)),
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
    group: sub.type === "VIP" ? "—" : customerSubscriptionGroup(customer),
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
            group: fields.group,
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
  const group = input.group ?? old?.group ?? "Chưa phân nhóm"
  if (!customerGroups.includes(group)) fail("Chọn nhóm thuê bao hợp lệ trong hồ sơ khách hàng.")
  if (group === "Cư dân" && !input.apartment.trim() && (!old || old.group !== group || old.apartment))
    fail("Khách hàng cư dân cần có căn hộ trong hồ sơ.")
  const faces = input.faces ?? old?.faces ?? []
  validateFacePhotos(faces)
  if (old?.faces?.length && !faces.length) {
    const candidate = { ...directory, customers: directory.customers.map((row) => row.id === old.id ? { ...row, faces: [] } : row) }
    const blocked = directory.profiles.filter((profile) => profile.status !== "Đã hủy" &&
      profile.customerId === old.id &&
      profileRequiresFace(candidate, profile) && !profileHasFace(candidate, profile))
    if (blocked.length)
      fail(`Khách hàng đang dùng thuê bao ${blocked.slice(0, 5).map((row) => row.id).join(", ")}${blocked.length > 5 ? ` và ${blocked.length - 5} thuê bao khác` : ""} có dịch vụ yêu cầu khuôn mặt. Không xóa hết ảnh khuôn mặt của chủ thuê bao; đổi dịch vụ hoặc chuyển chủ thuê bao trước.`)
  }
  if (
    !estates.some((estate) => estate.id === input.estate) ||
    !input.name.trim()
  )
    fail("Chọn khu đô thị và nhập tên khách hàng.")
  if (old && old.estate !== input.estate)
    fail("Không đổi khu đô thị của khách hàng đã tạo.")
  const phone = input.phone.trim()
  if (
    old &&
    ((old.phone && !phone) ||
      (old.block && !input.block?.trim()) ||
      (old.unitId && !input.unitId))
  )
    fail("Không bỏ trống số điện thoại, Tòa hoặc Đơn vị đã có của khách hàng.")
  if (
    !old &&
    (!phone ||
      !input.block?.trim() ||
      !managementUnits.some(
        (u) => u.id === input.unitId && u.estate === input.estate,
      ))
  )
    fail("Nhập số điện thoại, chọn Tòa và Đơn vị của khách hàng.")
  if (
    input.unitId &&
    !managementUnits.some(
      (u) => u.id === input.unitId && u.estate === input.estate,
    )
  )
    fail("Đơn vị không thuộc khu đô thị đã chọn.")
  if (phone && !/^0\d{9}$/.test(phone) && phone !== old?.phone)
    fail("Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.")
  if (input.apartment.trim() && !phone)
    fail("Khách hàng có căn hộ cần có số điện thoại.")
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
    fail("Email không hợp lệ.")
  if (input.identity && !/^\d{6,20}$/.test(input.identity))
    fail("CCCD gồm 6–20 chữ số.")
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
    ...audit(old),
    group,
    faces: faces.map((photo) => ({ ...photo })),
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
  return synchronizeCustomerGroups(next)
}
export function saveManagedVehicle(
  state: OperationState,
  input: ManagedVehicle,
): OperationState {
  const directory = directoryOf(state)
  const old = directory.vehicles.find((row) => row.id === input.id)
  if (!input.brand.trim() && !old) fail("Chọn hãng xe.")
  const energy = input.energy || old?.energy || "Chưa xác định"
  if (
    !energyOptions(input.vehicle).includes(energy) &&
    !(old && energy === "Chưa xác định")
  )
    fail("Chọn loại phương tiện phù hợp: xe thường hoặc xe điện.")
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
  const candidateDirectory = {
    ...directory,
    vehicles: directory.vehicles.map((row) =>
      row.id === old?.id ? { ...input, energy } : row,
    ),
  }
  if (
    profiles.some((profile) =>
      profile.lots.some((lot) => {
        const service = directory.services.find(
          (row) => row.id === lot.serviceId,
        )
        return (
          service &&
          !serviceMatchesSubscriber(service, candidateDirectory, profile)
        )
      }),
    )
  )
    fail(
      "Loại phương tiện mới không phù hợp gói dịch vụ của thuê bao. Chuyển sang gói phù hợp trước khi cập nhật xe.",
    )
  if (old && profiles.length && old.vehicle !== input.vehicle)
    fail("Xe đang gắn thuê bao. Không thay đổi loại phương tiện tại đây.")
  const record = {
    ...input,
    ...audit(old),
    useVoucher: old?.useVoucher ?? false,
    id: old?.id || newId("XE", directory.vehicles),
    energy,
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
  if (input.prices)
    validateServicePrices(input.prices, input.category, input.vehicle)
  if (
    old &&
    input.prices &&
    directory.profiles.some(
      (profile) =>
        profile.status !== "Đã hủy" &&
        profile.lots.some((l) => l.serviceId === old.id) &&
        !serviceCoversPeriod(
          input,
          state.subscriptions.find((s) => s.id === profile.id)?.effectiveFrom ||
            today,
          state.subscriptions.find((s) => s.id === profile.id)?.expiry || "",
        ),
    )
  )
    fail(
      "Biểu giá mới bị thiếu ngày áp dụng trong thời gian thuê bao đang dùng dịch vụ.",
    )
  if (input.energy && !energyOptions(input.vehicle).includes(input.energy))
    fail("Chọn loại phương tiện áp dụng phù hợp với gói dịch vụ.")
  if (
    old &&
    directory.profiles.some(
      (profile) =>
        profile.status !== "Đã hủy" &&
        profile.lots.some((lot) => lot.serviceId === old.id) &&
        !serviceMatchesSubscriber(input, directory, profile),
    )
  )
    fail(
      "Loại phương tiện áp dụng mới không phù hợp các xe của thuê bao đang dùng gói.",
    )
  if (!input.name.trim() || !vehicles.includes(input.vehicle))
    fail("Nhập tên dịch vụ và loại phương tiện.")
  if (
    !Array.isArray(input.parkIds) ||
    !input.parkIds.length ||
    new Set(input.parkIds).size !== input.parkIds.length ||
    input.parkIds.some((id) => !managementParks.some((park) => park.id === id))
  )
    fail("Chọn ít nhất một bãi xe hợp lệ và không chọn trùng bãi.")
  if (
    !["Thuê bao", "Vãng lai"].includes(input.category) ||
    !["Theo tháng", "Theo giờ", "Theo lượt", "Miễn phí"].includes(
      input.pricing,
    ) ||
    !controlModes.some((mode) => mode === input.control)
  )
    fail("Cấu hình dịch vụ không hợp lệ.")
  if (old && old.control !== input.control) {
    const candidate = { ...directory, services: directory.services.map((row) => row.id === old.id ? { ...row, control: input.control } : row) }
    const blocked = directory.profiles.filter((profile) => profile.status !== "Đã hủy" &&
      profile.lots.some((lot) => lot.active && lot.serviceId === old.id) &&
      profileRequiresFace(candidate, profile) && !profileHasFace(candidate, profile))
    if (blocked.length)
      fail(`Thuê bao ${blocked.slice(0, 5).map((row) => row.id).join(", ")}${blocked.length > 5 ? ` và ${blocked.length - 5} thuê bao khác` : ""} chưa có ảnh khuôn mặt. Bổ sung khuôn mặt trước khi đổi dịch vụ sang chế độ bắt buộc khuôn mặt.`)
  }
  if (
    old &&
    controlRequiresPlate(input.control) &&
    directory.profiles.some(
      (profile) =>
        profile.status !== "Đã hủy" &&
        requiresPlateFreeControl(profile) &&
        profile.lots.some((lot) => lot.serviceId === old.id),
    )
  )
    fail(
      "Gói đang dùng cho VIP không giới hạn biển số hoặc xe không có biển số. Không đổi sang chế độ kiểm soát bắt buộc biển số.",
    )
  if (
    !Number.isFinite(input.price) ||
    input.price < 0 ||
    input.price > 100000000
  )
    fail("Đơn giá phải từ 0 đến 100.000.000 đồng.")
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
  if (
    old &&
    directory.profiles.some(
      (profile) =>
        profile.status !== "Đã hủy" &&
        profile.lots.some(
          (lot) =>
            lot.serviceId === old.id && !input.parkIds.includes(lot.parkId),
        ),
    )
  )
    fail(
      "Bãi xe đang có thuê bao sử dụng gói này. Chuyển gói hoặc bỏ liên kết bãi ở thuê bao trước khi gỡ bãi khỏi dịch vụ.",
    )
  const record = {
    ...input,
    ...audit(old),
    prices: input.prices?.map((p) => ({
      ...p,
      days: [...p.days],
      windows: p.windows.map((w) => ({ ...w })),
    })),
    parkIds: [...input.parkIds],
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
  input = { ...input, group: input.type === "VIP" ? "" : customerSubscriptionGroup(customer) }
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
          (row) => row.id === id && row.estate === input.estate && (row.active || oldProfile?.members.includes(id)),
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
  if (
    input.noPlate &&
    !energyOptions(input.vehicle).includes(input.energy || "") &&
    !(
      oldProfile?.noPlate &&
      (!input.energy || input.energy === "Chưa xác định")
    )
  )
    fail("Chọn loại phương tiện cho xe không có biển số (xe thường hoặc xe điện).")
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
  // A vehicle belongs to one active subscription kind: never both a VIP and a monthly subscription.
  const crossOwner = ids.length
    ? directory.profiles.find(
        (profile) =>
          profile.id !== input.id &&
          profile.status !== "Đã hủy" &&
          profile.vehicleIds.some((id) => ids.includes(id)) &&
          state.subscriptions.find((sub) => sub.id === profile.id)?.type === (input.type === "VIP" ? "Thuê bao tháng" : "VIP"),
      )
    : undefined
  if (crossOwner) {
    const plate = directory.vehicles.find((v) => crossOwner.vehicleIds.includes(v.id) && ids.includes(v.id))?.plate || ""
    fail(input.type === "VIP"
      ? `Xe ${plate} đang có thuê bao tháng ${crossOwner.id}. Hủy thuê bao tháng hoặc bỏ xe khỏi thuê bao đó trước khi thêm vào VIP.`
      : `Xe ${plate} đang thuộc thuê bao VIP ${crossOwner.id}. Bỏ xe khỏi thuê bao VIP trước khi đăng ký thuê bao tháng.`)
  }
  const vipDuplicate =
    input.type === "VIP" && ids.length
      ? directory.profiles.find(
          (profile) =>
            profile.id !== input.id &&
            profile.status !== "Đã hủy" &&
            profile.vehicleIds.some((id) => ids.includes(id)) &&
            state.subscriptions.find((sub) => sub.id === profile.id)?.type === "VIP",
        )
      : undefined
  if (vipDuplicate)
    fail(
      `Xe đã thuộc thuê bao VIP ${vipDuplicate.id} đang hoạt động. Bổ sung bãi xe cho thuê bao đó hoặc hủy thuê bao cũ thay vì đăng ký trùng.`,
    )
  if (
    !input.lots.length ||
    new Set(input.lots.map((lot) => lot.parkId)).size !== input.lots.length
  )
    fail("Chọn ít nhất một bãi và không chọn trùng bãi.")
  if ((oldProfile?.status || "Đang hoạt động") === "Đang hoạt động" && !input.lots.some(l=>l.active)) fail("Thuê bao đang hoạt động cần ít nhất một bãi đang áp dụng.")
  for (const lot of input.lots) {
    const park = managementParks.find(
      (row) => row.id === lot.parkId && row.estate === input.estate,
    )
    const service = directory.services.find(
      (row) =>
        row.id === lot.serviceId &&
        row.parkIds.includes(lot.parkId) &&
        row.vehicle === input.vehicle &&
        row.category === "Thuê bao",
    )
    if (service && !serviceMatchesSubscriber(service, directory, input))
      fail(
        "Gói dịch vụ không phù hợp loại phương tiện của tất cả xe. VIP có xe điện và xe xăng cần gói áp dụng cả hai.",
      )
    if (
      service &&
      requiresPlateFreeControl(input) &&
      controlRequiresPlate(service.control)
    )
      fail(plateFreeControlMessage(input))
    if (service && !serviceCoversPeriod(service, input.from, input.to))
      fail("Biểu giá của dịch vụ chưa bao phủ thời gian thuê bao.")
    const unchanged =
      oldProfile?.lots.some(
        (row) => row.parkId === lot.parkId && row.serviceId === lot.serviceId,
      ) &&
      old?.effectiveFrom === input.from &&
      old?.expiry === input.to
    if (!park || !service || (!service.active && !unchanged))
      fail(
        "Mỗi bãi cần gói Thuê bao áp dụng tại bãi, đúng phương tiện; chỉ chọn mới gói đang hoạt động.",
      )

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
    energy: input.noPlate ? input.energy || "Chưa xác định" : undefined,
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
    uhf: input.uhfCode === undefined
      ? oldProfile?.uhf
      : input.uhfCode.trim()
        ? { code: input.uhfCode.trim(), label: input.uhfLabel?.trim() || undefined }
        : undefined,
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
    contract: input.type === "VIP" || input.group !== "Gian hàng" ? "" : input.contract.trim(),
    contractEnd: input.type === "VIP" || input.group !== "Gian hàng" ? "" : input.contractEnd,
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
  allowFuture = false,
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
    (!allowFuture && sub.effectiveFrom > today)
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
    service &&
    requiresPlateFreeControl(profile) &&
    controlRequiresPlate(service.control)
  )
    fail(plateFreeControlMessage(profile))
  if (
    !park ||
    !lot ||
    !service?.active ||
    service.vehicle !== profile.vehicle ||
    service.category !== "Thuê bao" ||
    !service.parkIds.includes(parkId) ||
    !serviceMatchesSubscriber(service, directory, profile)
  )
    fail(
      "Bãi cấp thẻ cần đang áp dụng gói dịch vụ còn hoạt động, phù hợp phương tiện.",
    )
  if (!profileUsesCard(directory, profile))
    fail("Dịch vụ của thuê bao không sử dụng thẻ Proximity/Mifare nên không cấp thẻ.")
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
      "Chọn thẻ Trong kho đúng bãi, đúng loại thuê bao và loại phương tiện, chưa gắn thuê bao khác.",
    )
  if (card.technology === "Thẻ UHF")
    fail("Thẻ UHF dán trên xe không cấp từ kho. Nhập mã thẻ UHF trong form đăng ký thuê bao.")
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
/** Save the registration and allocate stock in a single immutable transaction. */
export function saveSubscriberRegistration(
  state: OperationState,
  input: SubscriberInput,
): OperationState {
  input = registrationForCard(state,input)
  const directory = directoryOf(state)
  const current = input.id ? assignedCard(state, input.id) : undefined
  if (!current && !input.cardId && subscriberRequiresCard(directory, input))
    fail(
      "Chế độ kiểm soát của dịch vụ yêu cầu thẻ Proximity/Mifare. Chọn mã thẻ ngay trong form đăng ký.",
    )
  if (current && input.cardId && input.cardId !== current.id)
    fail("Thu hồi thẻ đang lưu hành trước khi đổi sang thẻ khác.")
  const uhfCode = profileUsesUhf(directory, input) ? input.uhfCode?.trim() ?? directory.profiles.find((p) => p.id === input.id)?.uhf?.code ?? "" : ""
  if (profileRequiresUhf(directory, input) && !uhfCode)
    fail("Dịch vụ yêu cầu thẻ UHF. Nhập mã thẻ UHF dán trên xe.")
  if (uhfCode) {
    if (!/^\S{1,50}$/.test(uhfCode))
      fail("Mã thẻ UHF tối đa 50 ký tự, không có khoảng trắng.")
    const owner = directory.profiles.find((p) => p.id !== input.id && p.status !== "Đã hủy" && p.uhf && normalize(p.uhf.code) === normalize(uhfCode))
    if (owner) fail(`Mã thẻ UHF đã được đăng ký cho thuê bao ${owner.id}.`)
    if (state.cards.some((c) => normalize(c.id) === normalize(uhfCode)))
      fail("Mã thẻ UHF trùng với mã thẻ đang quản lý trong kho.")
  }
  input = { ...input, uhfCode, uhfLabel: uhfCode ? input.uhfLabel : "" }
  if (!input.id && input.to && input.to < today)
    fail("Ngày hết hiệu lực của thuê bao mới không được ở quá khứ.")
  let next = saveSubscriber(state, input)
  const controlError=registrationControlError(state,input)
  if(controlError)fail(controlError)
  const id = input.id || next.subscriptions[0].id
  if (!current && input.cardId)
    next = issueSubscriberCard(
      next,
      id,
      input.cardId,
      input.cardParkId || "",
      input.cardReason?.trim() || "Cấp thẻ khi đăng ký thuê bao",
      true,
    )
  return next
}
