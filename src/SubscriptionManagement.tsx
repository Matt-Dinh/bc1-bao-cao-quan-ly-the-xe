import ManagementListTable from "./ManagementListTable"
import CardLookupMultiFilter from "./CardLookupMultiFilter"
import SubscriberRegistration from "./SubscriberRegistration"
import { updateRegistrationDraft } from "./subscription-model"
import { EntityPicker, RelationChoices } from "./ManagementPickers"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  Check,
  CreditCard,
  FileText,
  ListFilter,
  Pencil,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react"
import {
  Badge,
  Button,
  Field,
  Form,
  Heading,
  Input,
  Overlay,
  Select,
  Textarea,
} from "./ui"
import {
  customerGroups,
  date,
  estates,
  fmt,
  normalize,
  today,
  vehicles,
} from "./data"
import type { Card } from "./data"
import type { OperationState } from "./operations-model"
import { lookupCardStatus } from "./report-model"
import {
  changeSubscriberState,
  customerSubscriptionGroup,
  controlModes,
  defaultControlMode,
  directoryOf,
  issueSubscriberCard,
  managementParks,
  managementUnits,
  vehicleBrands,
  parseManagementRelation,
  saveManagedCustomer,
  saveManagedService,
  saveManagedVehicle,
  saveSubscriberRegistration,
  subscriberRequiresCard,
  subscriptionCardFits,
  serviceMatchesScope,
  profileUsesCard,
  profileRfidVehicle,
  profileUsesUhf,
  subscriberCards,
  subscriberInput,
  subscriptionStates,
} from "./subscription-model"
import type {
  ManagedCustomer,
  ManagedService,
  ManagedVehicle,
  ManagementScreen,
  SubscriberInput,
  SubscriptionState,
} from "./subscription-model"
import "./subscription-management.css"
import CustomerFaces from "./CustomerFaces"
import { vehicleVariantLabel, vehicleChoiceOptions, matchesVehicleChoices } from "./vehicle-energy"
import {
  controlRequiresPlate,
  issuanceStates,
  plateFreeControlMessage,
  requiresPlateFreeControl,
  subscriberEnergies,
  subscriptionCardState,
  subscriptionIdentificationMissing,
  subscriptionPlateControlConflict,
} from "./subscription-model"
type Editor = { kind: "customer"; value: ManagedCustomer } | {
  kind: "vehicle"
  value: ManagedVehicle
} | { kind: "service"; value: ManagedService } | {
  kind: "subscriber"
  value: SubscriberInput
} | {
  kind: "issue"
  value: { id: string; parkId: string; cardId: string; reason: string }
} | {
  kind: "status"
  value: { id: string; status: SubscriptionState; reason: string }
}
type Related = { kind: "customer" | "vehicle" | "service"; id: string }
const titles = {
  subscriptions: "Danh sách thuê bao",
  customers: "Khách hàng",
  vehicles: "Danh sách xe",
  services: "Danh sách dịch vụ",
}
const descriptions = {
  subscriptions:
    "Thuê bao tháng và VIP dùng chung hồ sơ khách hàng, phương tiện và gói dịch vụ theo bãi.",
  customers:
    "Hồ sơ khách hàng dùng chung. Xem các thuê bao của từng chủ sở hữu và thành viên.",
  vehicles:
    "Thông tin phương tiện dùng chung cho thuê bao tháng và danh sách biển số VIP.",
  services:
    "Quản lý dịch vụ theo bãi xe, loại phương tiện và chế độ kiểm soát để đăng ký thuê bao.",
}
const groupTitles = {
  subscriptions: "Quản lý thuê bao",
  customers: "Khách hàng",
  vehicles: "Quản lý xe",
  services: "Dịch vụ",
}
const estateOptions = estates.map((estate) => ({
  value: estate.id,
  label: estate.name,
}))
const emptyExtraFilters = {
  unit: [] as string[],
  face: [] as string[],
  source: [] as string[],
  group: [] as string[],
  brand: [] as string[],
  voucher: [] as string[],
}
/** Multi-select filter: no choice means every value; otherwise match any chosen value. */
const anyOf = (chosen: readonly string[], value: string) =>
  !chosen.length || chosen.includes(value)
const emptyFilters = {
  search: "",
  estate: [] as string[],
  status: [] as string[],
  kind: [] as string[],
  vehicleChoices: [] as string[],
  issuance: [] as string[],
  park: [] as string[],
  ...emptyExtraFilters,
}
const emptyCustomer = (estate = ""): ManagedCustomer => ({
  id: "",
  estate,
  name: "",
  group: "Chưa phân nhóm",
  contract: "",
  contractEnd: "",
  unitId: "",
  block: "",
  phone: "",
  email: "",
  identity: "",
  apartment: "",
  address: "",
  active: true,
  source: "Hệ thống",
  note: "",
})
const emptyVehicle = (estate = "", vehicle = "Ô tô"): ManagedVehicle => ({
  rfid: "",
  energy: "",
  id: "",
  estate,
  plate: "",
  vehicle,
  brand: "",
  color: "",
  active: true,
  note: "",
})
const emptyService = (): ManagedService => ({
  energy: "",
  id: "",
  parkIds: [],
  name: "",
  vehicle: "Ô tô",
  category: "Thuê bao",
  control: defaultControlMode,
  pricing: "Theo tháng",
  price: 0,
  active: true,
  note: "",
})
const emptySubscriber = (): SubscriberInput => ({
  energy: "",
  id: "",
  estate: "",
  customerId: "",
  members: [],
  vehicleIds: [],
  vehicle: "Ô tô",
  noPlate: false,
  anyPlate: false,
  lots: [],
  status: "Đang hoạt động",
  type: "Thuê bao tháng",
  group: "",
  contract: "",
  contractEnd: "",
  from: today,
  to: "",
  note: "",
})
const tone = (status: string) =>
  status === "Đang hoạt động"
    ? "green"
    : status === "Đã hủy"
      ? "red"
      : status === "Hết hạn"
        ? "amber"
        : "neutral"
function AuditInformation({
  record,
}: {
  record: {
    createdAt?: string
    createdBy?: string
    updatedAt?: string
    updatedBy?: string
  }
}) {
  const format = (v?: string) =>
    v
      ? new Date(v).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      : "Chưa ghi nhận"
  return (
    <div className="sm-detail-grid sm-audit">
      {[
        ["Người tạo", record.createdBy],
        ["Ngày tạo", format(record.createdAt)],
        ["Người cập nhật", record.updatedBy],
        ["Cập nhật cuối", format(record.updatedAt)],
      ].map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value || "Chưa ghi nhận"}</strong>
        </div>
      ))}
    </div>
  )
}
export default function SubscriptionManagement({
  screen,
  state,
  onChange,
  onNavigate,
  onCard,
  notify,
  onDirty,
  focusId,
  onFocused,
}: {
  screen: ManagementScreen
  state: OperationState
  onChange: (next: OperationState) => void
  onNavigate: (screen: ManagementScreen, focus?: string) => void
  onCard: (card: Card, subscriberId: string) => void
  notify: (text: string) => void
  onDirty: (dirty: boolean) => void
  focusId: string | null
  onFocused: () => void
}) {
  const directory = useMemo(() => directoryOf(state), [state])
  const [customerFaceBusy, setCustomerFaceBusy] = useState(false)
  const customers = useMemo(
    () => new Map(directory.customers.map((row) => [row.id, row])),
    [directory],
  )
  const vehicleMap = useMemo(
    () => new Map(directory.vehicles.map((row) => [row.id, row])),
    [directory],
  )
  const services = useMemo(
    () => new Map(directory.services.map((row) => [row.id, row])),
    [directory],
  )
  const profiles = useMemo(
    () => new Map(directory.profiles.map((row) => [row.id, row])),
    [directory],
  )
  const cards = useMemo(
    () => subscriberCards(state),
    [state.cards, state.subscriptions],
  )
  const [search, setSearch] = useState("")
  const [estate, setEstate] = useState<string[]>([])
  const [status, setStatus] = useState<string[]>([])
  const [kind, setKind] = useState<string[]>([])
  const [vehicleChoices, setVehicleChoices] = useState<string[]>([])
  const [issuance, setIssuance] = useState<string[]>([])
  const [park, setPark] = useState<string[]>([])
  const [extraFilters, setExtraFilters] = useState(emptyExtraFilters)
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters)
  const draftFilters = {
    search,
    estate,
    status,
    kind,
    vehicleChoices,
    issuance,
    park,
    ...extraFilters,
  }
  const filtersPending =
    JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters)
  const [page, setPage] = useState(1)
  const [related, setRelated] = useState<Related | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [parentEditor, setParentEditor] = useState<Extract<Editor, {
    kind: "subscriber"
  }> | null>(null)
  const [dirty, setDirty] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [error, setError] = useState("")
  const errorRef = useRef<HTMLParagraphElement>(null)
  const [cardQuery, setCardQuery] = useState("")
  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])
  useEffect(() => {
    onDirty(!!parentEditor || (!!editor && dirty))
    return () => onDirty(false)
  }, [editor, dirty, parentEditor, onDirty])
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty || parentEditor) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", leave)
    return () => window.removeEventListener("beforeunload", leave)
  }, [dirty, parentEditor])
  useEffect(() => {
    setSearch("")
    setAppliedFilters(emptyFilters)
    setExtraFilters(emptyExtraFilters)
    setEstate([])
    setStatus([])
    setKind([])
    setVehicleChoices([])
    setIssuance([])
    setPark([])
    setPage(1)
    setRelated(null)
    setDetail(null)
    setEditor(null)
    setDirty(false)
    setParentEditor(null)
  }, [screen])
  useEffect(() => {
    if (!focusId) return
    const relation = parseManagementRelation(focusId)
    if (relation) setRelated(relation)
    else setDetail(focusId)
    onFocused()
  }, [screen, focusId])
  useEffect(() => {
    setPage(1)
  }, [appliedFilters, related])
  function open(next: Editor) {
    setEditor(next)
    setError("")
    setDirty(false)
    setCardQuery("")
    setDetail(null)
  }
  function change(patch: object) {
    setEditor((old) => {
      if (!old) return old
      if (old.kind !== "subscriber")
        return { ...old, value: { ...old.value, ...patch } } as Editor
      const next = updateRegistrationDraft(state, old.value, patch)
      return { kind: "subscriber", value: next }
    })
    setDirty(true)
    setError("")
  }
  function closeEditor() {
    if (dirty) setDiscard(true)
    else finishClose()
  }
  function finishClose() {
    setEditor(parentEditor)
    setParentEditor(null)
    setDirty(!!parentEditor)
    setDiscard(false)
    setError("")
  }
  function newRecord() {
    open(
      screen === "customers"
        ? { kind: "customer", value: emptyCustomer(appliedFilters.estate.length === 1 ? appliedFilters.estate[0] : "") }
        : screen === "vehicles"
          ? { kind: "vehicle", value: emptyVehicle(appliedFilters.estate.length === 1 ? appliedFilters.estate[0] : "") }
          : screen === "services"
            ? { kind: "service", value: emptyService() }
            : { kind: "subscriber", value: emptySubscriber() },
    )
  }
  function editRecord(id: string) {
    if (screen === "customers") {
      const row = customers.get(id)
      if (row) open({ kind: "customer", value: { ...row } })
    }
    if (screen === "vehicles") {
      const row = vehicleMap.get(id)
      if (row) open({ kind: "vehicle", value: { ...row } })
    }
    if (screen === "services") {
      const row = services.get(id)
      if (row) open({ kind: "service", value: { ...row } })
    }
    if (screen === "subscriptions") {
      const row = subscriberInput(state, id)
      if (row) open({ kind: "subscriber", value: row })
    }
  }
  function issue(id: string) {
    const profile = profiles.get(id)
    open({
      kind: "issue",
      value: {
        id,
        parkId: profile?.lots.find((lot) => lot.active)?.parkId ?? "",
        cardId: "",
        reason: "",
      },
    })
  }
  function save() {
    if (!editor || customerFaceBusy) return
    try {
      const next =
        editor.kind === "customer"
          ? saveManagedCustomer(state, editor.value)
          : editor.kind === "vehicle"
            ? saveManagedVehicle(state, editor.value)
            : editor.kind === "service"
              ? saveManagedService(state, editor.value)
              : editor.kind === "subscriber"
                ? saveSubscriberRegistration(state, editor.value)
                : editor.kind === "issue"
                  ? issueSubscriberCard(
                      state,
                      editor.value.id,
                      editor.value.cardId,
                      editor.value.parkId,
                      editor.value.reason,
                    )
                  : changeSubscriberState(
                      state,
                      editor.value.id,
                      editor.value.status,
                      editor.value.reason,
                    )
      onChange(next)
      const savedSubscriber =
        editor.kind === "subscriber"
          ? (directoryOf(next).profiles.find(
              (row) => row.id === editor.value.id,
            ) ?? directoryOf(next).profiles[0])
          : undefined
      if (
        parentEditor &&
        (editor.kind === "customer" || editor.kind === "vehicle")
      ) {
        const nextDirectory = directoryOf(next)
        const updated = { ...parentEditor.value }
        if (editor.kind === "customer")
          updated.customerId = editor.value.id || nextDirectory.customers[0].id
        else {
          // Editing a vehicle (e.g. adding its RFID) keeps it selected; a new vehicle is added.
          const vehicleId = editor.value.id || nextDirectory.vehicles[0].id
          updated.vehicleIds =
            updated.type === "VIP"
              ? Array.from(new Set([...updated.vehicleIds, vehicleId]))
              : [vehicleId]
        }
        setEditor({ kind: "subscriber", value: updateRegistrationDraft(next, parentEditor.value, updated) })
        setParentEditor(null)
        setDirty(true)
        notify("Đã tạo hồ sơ và chọn vào thuê bao đang đăng ký.")
      } else {
        setEditor(null)
        setDirty(false)
        notify(
          editor.kind === "issue"
            ? "Đã cấp thẻ từ kho và cập nhật thuê bao, tra cứu thẻ."
            : savedSubscriber &&
                subscriptionIdentificationMissing(next, savedSubscriber.id)
              ? "Đã lưu thuê bao. Cần cấp thẻ hoặc bổ sung ảnh khuôn mặt để hoàn tất nhận diện cho thuê bao này."
              : "Đã lưu thông tin.",
        )
      }
      setError("")
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể lưu thông tin.",
      )
    }
  }
  function clearFilters() {
    setAppliedFilters(emptyFilters)
    setExtraFilters(emptyExtraFilters)
    setPage(1)
    setIssuance([])
    setSearch("")
    setEstate([])
    setStatus([])
    setKind([])
    setVehicleChoices([])
    setPark([])
    setRelated(null)
  }
  const subscriberRows = state.subscriptions.filter((sub) => {
    const profile = profiles.get(sub.id)
    if (!profile) return false
    const owner = customers.get(profile.customerId)
    const card = cards.get(sub.id)
    if (
      !anyOf(appliedFilters.issuance,
        subscriptionCardState(sub, card, subscriberRequiresCard(directory, profile)))
    )
      return false
    const links =
      related?.kind === "customer"
        ? profile.customerId === related.id ||
          profile.members.includes(related.id)
        : related?.kind === "vehicle"
          ? profile.vehicleIds.includes(related.id)
          : related?.kind === "service"
            ? profile.lots.some((lot) => lot.serviceId === related.id)
            : true
    return (
      links &&
      anyOf(appliedFilters.estate, profile.estate) &&
      anyOf(appliedFilters.status, profile.status) &&
      (!appliedFilters.vehicleChoices.length || subscriberEnergies(directory,profile).some(energy => matchesVehicleChoices(profile.vehicle,energy,appliedFilters.vehicleChoices))) &&
      (!appliedFilters.park.length ||
        profile.lots.some((lot) => appliedFilters.park.includes(lot.parkId))) &&
      normalize(
        [sub.id, owner?.name, owner?.phone, sub.plate, card?.id, ...profile.vehicleIds.map((id) => vehicleMap.get(id)?.rfid)].join(" "),
      ).includes(normalize(appliedFilters.search))
    )
  })
  const customerRows = directory.customers.filter(
    (row) =>
      anyOf(appliedFilters.unit, row.unitId || "") &&
      anyOf(appliedFilters.face, String(!!row.faces?.length)) &&
      anyOf(appliedFilters.source, row.source) &&
      anyOf(appliedFilters.group, customerSubscriptionGroup(row)) &&
      anyOf(appliedFilters.estate, row.estate) &&
      anyOf(appliedFilters.status, String(row.active)) &&
      normalize(
        [
          row.id,
          row.name,
          row.phone,
          row.identity,
          row.email,
          row.address,
          row.block,
          row.apartment,
        ].join(" "),
      ).includes(normalize(appliedFilters.search)),
  )
  const vehicleRows = directory.vehicles.filter(
    (row) =>
      anyOf(appliedFilters.brand, row.brand) &&
      anyOf(appliedFilters.voucher, String(!!row.useVoucher)) &&
      anyOf(appliedFilters.estate, row.estate) &&
      anyOf(appliedFilters.status, String(row.active)) &&
      matchesVehicleChoices(row.vehicle,row.energy,appliedFilters.vehicleChoices) &&
      normalize([row.id, row.plate, row.rfid, row.brand, row.color].join(" ")).includes(
        normalize(appliedFilters.search),
      ),
  )
  const serviceRows = directory.services.filter(
    (row) =>
      serviceMatchesScope(row, appliedFilters.estate, appliedFilters.park) &&
      anyOf(appliedFilters.status, String(row.active)) &&
      anyOf(appliedFilters.kind, row.category) &&
      matchesVehicleChoices(row.vehicle,row.energy,appliedFilters.vehicleChoices,true) &&
      normalize([row.id, row.name].join(" ")).includes(
        normalize(appliedFilters.search),
      ),
  )
  const count =
    screen === "subscriptions"
      ? subscriberRows.length
      : screen === "customers"
        ? customerRows.length
        : screen === "vehicles"
          ? vehicleRows.length
          : serviceRows.length
  const totalPages = Math.max(1, Math.ceil(count / 20))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * 20
  const ids = (
    screen === "subscriptions"
      ? subscriberRows
      : screen === "customers"
        ? customerRows
        : screen === "vehicles"
          ? vehicleRows
          : serviceRows
  )
    .slice(start, start + 20)
    .map((row) => row.id)
  const linkedCount = (kind: Related["kind"], id: string) =>
    directory.profiles.filter((row) =>
      kind === "customer"
        ? row.customerId === id || row.members.includes(id)
        : kind === "vehicle"
          ? row.vehicleIds.includes(id)
          : row.lots.some((lot) => lot.serviceId === id),
    ).length
  const relatedText = related
    ? related.kind === "customer"
      ? customers.get(related.id)?.name
      : related.kind === "vehicle"
        ? vehicleMap.get(related.id)?.plate
        : services.get(related.id)?.name
    : ""
  const selectedSub = detail
    ? state.subscriptions.find((row) => row.id === detail)
    : undefined
  const selectedProfile = detail ? profiles.get(detail) : undefined
  const selectedCustomer = detail ? customers.get(detail) : undefined
  const selectedVehicle = detail ? vehicleMap.get(detail) : undefined
  const selectedService = detail ? services.get(detail) : undefined
  const selectedCard = detail ? cards.get(detail) : undefined
  const issueSub =
    editor?.kind === "issue"
      ? state.subscriptions.find((row) => row.id === editor.value.id)
      : undefined
  const issueProfile = issueSub ? profiles.get(issueSub.id) : undefined
  const oldCard = issueSub ? cards.get(issueSub.id) : undefined
  const issuePark =
    editor?.kind === "issue"
      ? managementParks.find((park) => park.id === editor.value.parkId)
      : undefined
  const candidates =
    issueSub && issueProfile && issuePark
      ? state.cards.filter(
          (card) =>
            card.status === "Trong kho" &&
            !card.subscription &&
            card.estate === issuePark.estate &&
            card.park === issuePark.park &&
            card.type === issueSub.type &&
            card.vehicle === issueProfile.vehicle &&
            normalize(card.id).includes(normalize(cardQuery)),
        )
      : []
  const editorTitle =
    editor?.kind === "customer"
      ? editor.value.id
        ? "Sửa khách hàng"
        : "Thêm khách hàng"
      : editor?.kind === "vehicle"
        ? editor.value.id
          ? "Sửa thông tin xe"
          : "Thêm xe"
        : editor?.kind === "service"
          ? editor.value.id
            ? "Sửa dịch vụ"
            : "Thêm dịch vụ"
          : editor?.kind === "subscriber"
            ? editor.value.id
              ? "Sửa thuê bao"
              : "Đăng ký thuê bao"
            : editor?.kind === "status"
              ? "Thay đổi trạng thái thuê bao"
              : issueSub?.cardId
                ? "Cấp lại thẻ"
                : "Cấp thẻ cho thuê bao"
  return (
    <div className="subscription-management">
      <div className="breadcrumbs">
        <span>{groupTitles[screen]}</span>
        <ArrowRight size={12} />
        <span>{titles[screen]}</span>
      </div>
      <div className="page-heading">
        <div>
          <Heading level={1}>{titles[screen]}</Heading>
          <p className="page-description">{descriptions[screen]}</p>
        </div>
        <Button variant="primary" onClick={newRecord}>
          <Plus size={15} />
          {screen === "subscriptions"
            ? "Đăng ký thuê bao"
            : screen === "customers"
              ? "Thêm khách hàng"
              : screen === "vehicles"
                ? "Thêm xe"
                : "Thêm dịch vụ"}
        </Button>
      </div>
      {screen === "subscriptions" && (
        <div className="sm-overview">
          <div>
            <Users size={18} />
            <span>
              Tổng thuê bao<strong>{fmt(state.subscriptions.length)}</strong>
            </span>
          </div>
          <div>
            <FileText size={18} />
            <span>
              Thuê bao tháng
              <strong>
                {fmt(
                  state.subscriptions.filter(
                    (row) => row.type === "Thuê bao tháng",
                  ).length,
                )}
              </strong>
            </span>
          </div>
          <div>
            <CreditCard size={18} />
            <span>
              Thuê bao VIP
              <strong>
                {fmt(
                  state.subscriptions.filter((row) => row.type === "VIP")
                    .length,
                )}
              </strong>
            </span>
          </div>
          <div>
            <Check size={18} />
            <span>
              Đang có thẻ lưu hành<strong>{fmt(cards.size)}</strong>
            </span>
          </div>
        </div>
      )}
      <Form
        className="panel filter-panel lookup-filter-panel sm-filters"
        aria-label={`Bộ lọc ${titles[screen]}`}
        onSubmit={(event) => {
          event.preventDefault()
          setAppliedFilters({ ...draftFilters, search: search.trim() })
          setSearch(search.trim())
          setPage(1)
        }}
      >
        <div className="filter-heading">
          <span>
            <ListFilter size={16} />
            <strong>
              Bộ lọc{" "}
              {screen === "subscriptions"
                ? "thuê bao"
                : screen === "customers"
                  ? "khách hàng"
                  : screen === "vehicles"
                    ? "xe"
                    : "dịch vụ"}
            </strong>
            {filtersPending && (
              <span className="filter-pending">Chưa áp dụng</span>
            )}
          </span>
          <Button variant="ghost" onClick={clearFilters}>
            Xóa bộ lọc
          </Button>
        </div>
        <div className="filter-grid lookup-filter-primary">
          <Field label="Tìm kiếm">
            <Input
              type="search"
              aria-label="Tìm kiếm danh sách"
              maxLength={100}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nhập mã, tên, biển số…"
            />
          </Field>
          <CardLookupMultiFilter label="Khu đô thị" value={estate} options={estateOptions} allLabel="Tất cả khu đô thị"
            onChange={(next) => {
              setEstate(next)
              setPark(park.filter((id) => !next.length || next.includes(id.split(":")[0])))
              setExtraFilters({ ...extraFilters, unit: extraFilters.unit.filter((id) => !next.length || managementUnits.some((u) => u.id === id && next.includes(u.estate))) })
            }} />
        </div>
        <div className="filter-grid lookup-filter-row">
          <CardLookupMultiFilter label={screen === "subscriptions" ? "Trạng thái thuê bao" : "Trạng thái"} value={status}
            allLabel="Tất cả trạng thái" onChange={setStatus}
            options={screen === "subscriptions"
              ? subscriptionStates.map((value) => ({ value, label: value }))
              : [{ value: "true", label: "Đang hoạt động" }, { value: "false", label: "Ngừng hoạt động" }]} />
          {screen !== "customers" && <CardLookupMultiFilter label="Loại phương tiện" value={vehicleChoices}
            options={vehicleChoiceOptions()}
            allLabel="Tất cả loại phương tiện" onChange={setVehicleChoices}
            note={screen === "services"?"Dịch vụ dùng chung cho xe xăng và xe điện xuất hiện khi chọn một trong hai loại. Bỏ chọn hết để xem mọi loại.":undefined}/>
          }
          {screen === "services" && <CardLookupMultiFilter label="Kiểu dịch vụ" value={kind} allLabel="Tất cả kiểu dịch vụ"
            onChange={setKind} options={["Thuê bao", "Vãng lai"].map((value) => ({ value, label: value }))} />}
          {(screen === "subscriptions" || screen === "services") && <CardLookupMultiFilter label="Bãi xe" value={park}
            allLabel="Tất cả bãi xe" onChange={setPark}
            options={managementParks.filter((row) => !estate.length || estate.includes(row.estate)).map((row) => ({ value: row.id, label: row.label }))} />}
          {screen === "subscriptions" && <CardLookupMultiFilter label="Tình trạng cấp thẻ" value={issuance}
            allLabel="Tất cả tình trạng cấp thẻ" onChange={setIssuance} options={issuanceStates.map((value) => ({ value, label: value }))} />}
          {screen === "customers" && <>
            <CardLookupMultiFilter label="Nhóm thuê bao" value={extraFilters.group} options={customerGroups.map(value=>({value,label:value}))}
              allLabel="Tất cả nhóm thuê bao" onChange={group=>setExtraFilters({...extraFilters,group})}/>
            <CardLookupMultiFilter label="Đơn vị" value={extraFilters.unit} allLabel="Tất cả đơn vị"
              onChange={(unit) => setExtraFilters({ ...extraFilters, unit })}
              options={managementUnits.filter((u) => !estate.length || estate.includes(u.estate)).map((u) => ({ value: u.id, label: u.name }))} />
            <CardLookupMultiFilter label="Khuôn mặt" value={extraFilters.face} allLabel="Tất cả"
              onChange={(face) => setExtraFilters({ ...extraFilters, face })}
              options={[{ value: "true", label: "Đã có ảnh" }, { value: "false", label: "Chưa có ảnh" }]} />
            <CardLookupMultiFilter label="Nguồn" value={extraFilters.source} allLabel="Tất cả nguồn"
              onChange={(source) => setExtraFilters({ ...extraFilters, source })}
              options={Array.from(new Set(directory.customers.map((c) => c.source))).map((v) => ({ value: v, label: v }))} />
          </>}
          {screen === "vehicles" && <>
            <CardLookupMultiFilter label="Hãng xe" value={extraFilters.brand} allLabel="Tất cả hãng xe"
              onChange={(brand) => setExtraFilters({ ...extraFilters, brand })}
              options={Array.from(new Set([...vehicleBrands, ...directory.vehicles.map((v) => v.brand)].filter(Boolean))).sort().map((v) => ({ value: v, label: v }))} />
            <CardLookupMultiFilter label="Voucher" value={extraFilters.voucher} allLabel="Tất cả"
              onChange={(voucher) => setExtraFilters({ ...extraFilters, voucher })}
              options={[{ value: "true", label: "Có" }, { value: "false", label: "Không" }]} />
          </>}
        </div>
        {related && (
          <div className="sm-related">
            <span>
              Thuê bao liên quan đến:{" "}
              <strong>{relatedText || related.id}</strong>
            </span>
            <Button variant="ghost" onClick={() => setRelated(null)}>
              <X size={13} />
              Bỏ điều kiện
            </Button>
          </div>
        )}
        <div className="lookup-filter-footer">
          <Button variant="primary" type="submit">
            <Search size={14} />
            Áp dụng
          </Button>
        </div>
      </Form>
      <div className="panel sm-list">
        <ManagementListTable key={screen} screen={screen} state={state} directory={directory} ids={ids}
          heading={<>
<strong>
            {fmt(count)}{" "}
            {screen === "subscriptions"
              ? "thuê bao"
              : screen === "customers"
                ? "khách hàng"
                : screen === "vehicles"
                  ? "xe"
                  : "dịch vụ"}
          </strong>
          <span>
            {screen === "subscriptions"
              ? "Mỗi thuê bao một dòng, có thể áp dụng nhiều bãi."
              : "Chọn mã để xem thông tin và các liên kết."}
          </span>
          </>}
          onDetail={setDetail} onEdit={editRecord} onIssue={issue} onCard={onCard}
          onRelated={(kind,id)=>onNavigate("subscriptions",`${kind}:${id}`)}
          onCopyService={id=>{const row=services.get(id);if(row)open({kind:"service",value:{...row,id:"",name:`${row.name} (bản sao)`}})}}/>
        <div className="sm-pagination">
          <span>
            {count
              ? `${start + 1}–${Math.min(start + 20, count)} trên ${fmt(count)}`
              : "0 kết quả"}
          </span>
          <Button
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Trang trước
          </Button>
          <span>
            {currentPage} / {totalPages}
          </span>
          <Button
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Trang sau
          </Button>
        </div>
      </div>
      {detail && (
        <Overlay
          wide
          title={
            screen === "subscriptions"
              ? "Chi tiết thuê bao"
              : screen === "customers"
                ? "Hồ sơ khách hàng"
                : screen === "vehicles"
                  ? "Thông tin phương tiện"
                  : "Thông tin dịch vụ"
          }
          onClose={() => setDetail(null)}
          footer={
            <>
              <Button onClick={() => setDetail(null)}>Đóng</Button>
              <Button
                variant="primary"
                disabled={
                  screen === "subscriptions" &&
                  selectedProfile?.status === "Đã hủy"
                }
                onClick={() => editRecord(detail)}
              >
                <Pencil size={14} />
                Sửa thông tin
              </Button>
            </>
          }
        >
          {screen === "subscriptions" && selectedSub && selectedProfile && (
            <>
              <div className="sm-detail-title">
                <div>
                  <Heading>{selectedSub.id}</Heading>
                  <span>
                    {selectedSub.type} · {selectedProfile.vehicle}
                  </span>
                </div>
                <Badge tone={tone(selectedProfile.status)}>
                  {selectedProfile.status}
                </Badge>
              </div>
              <div className="sm-detail-grid">
                <div>
                  <span>Chủ thuê bao</span>
                  <Button
                    variant="link"
                    onClick={() =>
                      onNavigate("customers", selectedProfile.customerId)
                    }
                  >
                    {customers.get(selectedProfile.customerId)?.name}
                  </Button>
                </div>
                <div>
                  <span>Nhóm thuê bao</span>
                  <strong>
                    {selectedSub.type === "VIP" ? "—" : selectedSub.group}
                  </strong>
                </div>
                <div>
                  <span>Hiệu lực</span>
                  <strong>
                    {date(selectedSub.effectiveFrom)} –{" "}
                    {selectedSub.expiry
                      ? date(selectedSub.expiry)
                      : "Không giới hạn"}
                  </strong>
                </div>
                <div>
                  <span>Thành viên</span>
                  {selectedProfile.members.length ? (
                    selectedProfile.members.map((id) => (
                      <Button
                        key={id}
                        variant="link"
                        onClick={() => onNavigate("customers", id)}
                      >
                        {customers.get(id)?.name}
                      </Button>
                    ))
                  ) : (
                    <strong>Chưa có thành viên</strong>
                  )}
                </div>
                <div>
                  <span>Phương tiện</span>
                  {selectedProfile.vehicleIds.map((id) => (
                    <Button
                      key={id}
                      variant="link"
                      onClick={() => onNavigate("vehicles", id)}
                    >
                      {vehicleMap.get(id)?.plate}
                    </Button>
                  ))}
                  {!selectedProfile.vehicleIds.length && (
                    <strong>
                      {selectedProfile.anyPlate
                        ? "VIP không giới hạn biển số"
                        : "Xe không có biển số"}
                    </strong>
                  )}
                </div>
                <div>
                  <span>Căn hộ / Hợp đồng</span>
                  <strong>
                    {customers.get(selectedProfile.customerId)?.apartment ||
                      selectedSub.contract ||
                      "—"}
                  </strong>
                  {selectedSub.contract && (
                    <small>Hợp đồng đến {date(selectedSub.contractEnd)}</small>
                  )}
                </div>
              </div>
              <h3 className="sm-subheading">Bãi xe và dịch vụ áp dụng</h3>
              <div className="sm-lot-details">
                {selectedProfile.lots.map((lot) => (
                  <div key={lot.parkId}>
                    <span>
                      {
                        managementParks.find((park) => park.id === lot.parkId)
                          ?.label
                      }
                    </span>
                    <Button
                      variant="link"
                      onClick={() => onNavigate("services", lot.serviceId)}
                    >
                      {services.get(lot.serviceId)?.name}
                    </Button>
                    <Badge tone={lot.active ? "green" : "neutral"}>
                      {lot.active ? "Đang áp dụng" : "Tạm ngừng"}
                    </Badge>
                  </div>
                ))}
              </div>
              <h3 className="sm-subheading">Thẻ cấp cho thuê bao</h3>
              {profileUsesUhf(directory, selectedProfile) && profileRfidVehicle(directory, selectedProfile) && (
                <div className="sm-card-panel">
                  <CreditCard size={23} />
                  <div>
                    <strong>Thẻ UHF {profileRfidVehicle(directory, selectedProfile)!.rfid}</strong>
                    <p>
                      Mã thẻ RFID của xe {profileRfidVehicle(directory, selectedProfile)!.plate}, dán trên xe,
                      không quản lý trong kho. Đổi mã thẻ RFID tại Danh sách xe.
                    </p>
                  </div>
                </div>
              )}
              {subscriptionPlateControlConflict(state, selectedSub.id) && (
                <p className="sm-warning">
                  Gói hiện tại đang bắt buộc biển số.{" "}
                  {plateFreeControlMessage(selectedProfile)} Chỉnh sửa thuê bao
                  để chuyển sang gói phù hợp trước khi cấp thẻ.
                </p>
              )}
              {subscriptionIdentificationMissing(state, selectedSub.id) && (
                <p className="sm-note">
                  {selectedProfile.noPlate
                    ? "Thuê bao xe không có biển số"
                    : "VIP không giới hạn biển số"}{" "}
                  chưa có thẻ lưu hành hoặc ảnh khuôn mặt nên chưa thể nhận diện
                  tại cổng. Cấp thẻ hoặc bổ sung ảnh khuôn mặt cho chủ thuê
                  bao để hoàn tất đăng ký.
                </p>
              )}
              <div className="sm-card-panel">
                <CreditCard size={22} />
                <div>
                  <strong>{selectedCard?.id || "Chưa có thẻ lưu hành"}</strong>
                  <p>
                    {selectedCard
                      ? `${lookupCardStatus(selectedCard, today)} · Kho ${selectedCard.park}`
                      : selectedSub.cardId
                        ? `Thẻ gần nhất: ${selectedSub.cardId}. Có thể cấp lại sau khi thẻ cũ đã được xử lý.`
                        : "Chỉnh sửa thuê bao để chọn và cấp thẻ ngay trong hồ sơ."}
                  </p>
                </div>
                {selectedCard && (
                  <Button onClick={() => onCard(selectedCard, selectedSub.id)}>
                    Quản lý thẻ
                    <ArrowRight size={14} />
                  </Button>
                )}
                {profileUsesCard(directory, selectedProfile) ? (
                  <Button
                    onClick={() => issue(selectedSub.id)}
                    disabled={selectedProfile.status !== "Đang hoạt động"}
                  >
                    {selectedSub.cardId ? "Cấp lại thẻ" : "Cấp thẻ"}
                  </Button>
                ) : (
                  <span className="sr-hint">Dịch vụ không sử dụng thẻ</span>
                )}
              </div>
              <div className="sm-state-controls">
                <p>
                  Ngừng/hủy thuê bao không ghi nhận thẻ về kho. Thẻ cần được thu
                  hồi và kiểm tra vật lý riêng.
                </p>
                {selectedProfile.status !== "Đã hủy" && (
                  <Button
                    onClick={() =>
                      open({
                        kind: "status",
                        value: {
                          id: selectedSub.id,
                          status:
                            selectedProfile.status === "Đang hoạt động"
                              ? "Tạm ngừng"
                              : "Đang hoạt động",
                          reason: "",
                        },
                      })
                    }
                  >
                    Thay đổi trạng thái thuê bao
                  </Button>
                )}
              </div>
            </>
          )}
          {screen === "customers" && selectedCustomer && (
            <>
              <Heading>{selectedCustomer.name}</Heading>
              <Badge tone={selectedCustomer.active ? "green" : "neutral"}>
                {selectedCustomer.active ? "Đang hoạt động" : "Ngừng hoạt động"}
              </Badge>
              <div className="sm-detail-grid">
                {[
                  ["Mã khách hàng", selectedCustomer.id],
                  [
                    "Khu đô thị",
                    estates.find((e) => e.id === selectedCustomer.estate)?.name,
                  ],
                  ["Số điện thoại", selectedCustomer.phone],
                  ["Nhóm thuê bao", customerSubscriptionGroup(selectedCustomer)],
                  ...(selectedCustomer.group === "Gian hàng" ? [["Hợp đồng", selectedCustomer.contract ? `${selectedCustomer.contract} · đến ${date(selectedCustomer.contractEnd || "")}` : "Chưa có hợp đồng"]] : []),
                  ["Email", selectedCustomer.email],
                  ["CCCD", selectedCustomer.identity],
                  [
                    "Đơn vị",
                    managementUnits.find(
                      (u) => u.id === selectedCustomer.unitId,
                    )?.name,
                  ],
                  ["Tòa", selectedCustomer.block],
                  ["Căn hộ", selectedCustomer.apartment],
                  ["Địa chỉ", selectedCustomer.address],
                  ["Nguồn", selectedCustomer.source],
                  ["Ghi chú", selectedCustomer.note],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value || "—"}</strong>
                  </div>
                ))}
              </div>
              <AuditInformation record={selectedCustomer} />
              <CustomerFaces value={selectedCustomer.faces} />
              <Button
                onClick={() =>
                  onNavigate("subscriptions", `customer:${detail}`)
                }
              >
                Xem {linkedCount("customer", detail)} thuê bao liên quan
                <ArrowRight size={14} />
              </Button>
            </>
          )}
          {screen === "vehicles" && selectedVehicle && (
            <>
              <Heading>{selectedVehicle.plate}</Heading>
              <Badge tone={selectedVehicle.active ? "green" : "neutral"}>
                {selectedVehicle.active ? "Đang hoạt động" : "Ngừng hoạt động"}
              </Badge>
              <div className="sm-detail-grid">
                {[
                  ["Mã xe", selectedVehicle.id],
                  [
                    "Khu đô thị",
                    estates.find((e) => e.id === selectedVehicle.estate)?.name,
                  ],
                  ["Loại phương tiện",vehicleVariantLabel(selectedVehicle.vehicle,selectedVehicle.energy)],
                  ["Mã thẻ RFID", selectedVehicle.rfid || "Chưa khai báo"],
                  ["Hãng xe", selectedVehicle.brand],
                  ["Màu xe", selectedVehicle.color],
                  ["Voucher", selectedVehicle.useVoucher ? "Có" : "Không"],
                  ["Ghi chú", selectedVehicle.note],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value || "—"}</strong>
                  </div>
                ))}
              </div>
              <AuditInformation record={selectedVehicle} />
              <Button
                onClick={() => onNavigate("subscriptions", `vehicle:${detail}`)}
              >
                Xem {linkedCount("vehicle", detail)} thuê bao liên quan
                <ArrowRight size={14} />
              </Button>
            </>
          )}
          {screen === "services" && selectedService && (
            <>
              <Heading>{selectedService.name}</Heading>
              <Badge tone={selectedService.active ? "green" : "neutral"}>
                {selectedService.active ? "Đang hoạt động" : "Ngừng hoạt động"}
              </Badge>
              <div className="sm-detail-grid">
                {[
                  ["Mã dịch vụ", selectedService.id],
                  [
                    "Loại phương tiện",
                    vehicleVariantLabel(
                      selectedService.vehicle,
                      selectedService.energy,
                      true,
                    ),
                  ],
                  [
                    "Bãi xe áp dụng",
                    managementParks
                      .filter((park) =>
                        selectedService.parkIds.includes(park.id),
                      )
                      .map((park) => park.label)
                      .join("; "),
                  ],
                  ["Kiểu dịch vụ", selectedService.category],
                  ["Áp dụng voucher", selectedService.voucher ? "Có" : "Không"],
                  ["Kiểm soát", selectedService.control],
                  ["Ghi chú", selectedService.note],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value || "—"}</strong>
                  </div>
                ))}
              </div>
              <AuditInformation record={selectedService} />
              <Button
                onClick={() => onNavigate("subscriptions", `service:${detail}`)}
              >
                Xem {linkedCount("service", detail)} thuê bao sử dụng
                <ArrowRight size={14} />
              </Button>
            </>
          )}
        </Overlay>
      )}
      {editor && (
        <Overlay
          wide
          title={editorTitle}
          subtitle={
            editor.kind === "subscriber"
              ? "Chọn dịch vụ, phương tiện và mã thẻ phù hợp. Thuê bao và cấp thẻ được lưu cùng lúc."
              : undefined
          }
          onClose={closeEditor}
          dismissOnBackdrop={false}
          footer={
            <>
              <Button onClick={closeEditor}>
                {parentEditor ? "Quay lại thuê bao" : "Hủy"}
              </Button>
              <Button
                variant="primary"
                onClick={save}
                disabled={
                  customerFaceBusy ||
                  (editor.kind === "issue" &&
                    (!!oldCard || !editor.value.cardId))
                }
              >
                <Check size={14} />
                {editor.kind === "issue" ? "Xác nhận cấp thẻ" : "Lưu thông tin"}
              </Button>
            </>
          }
        >
          <Form
            className="sm-form"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            {editor.kind === "customer" && (
              <>
                <div className="sm-form-grid">
                  <Field label="Khu đô thị" required>
                    <Select
                      aria-label="Khu đô thị khách hàng"
                      disabled={!!editor.value.id}
                      value={editor.value.estate}
                      onChange={(event) =>
                        change({
                          estate: event.target.value,
                          unitId: "",
                          block: "",
                          apartment: "",
                        })
                      }
                      options={[
                        { value: "", label: "Chọn khu đô thị" },
                        ...estateOptions,
                      ]}
                    />
                  </Field>
                  <Field label="Nhóm thuê bao" required hint="Dùng chung cho các thuê bao của khách hàng. Thay đổi nhóm sẽ cập nhật các thuê bao đã có.">
                    <Select aria-label="Nhóm thuê bao khách hàng" value={editor.value.group ?? customerSubscriptionGroup(editor.value)}
                      onChange={event=>change({group:event.target.value})} options={customerGroups}/>
                  </Field>
                  {(editor.value.group ?? customerSubscriptionGroup(editor.value)) === "Gian hàng" && <>
                    <Field label="Số hợp đồng" required hint="Hợp đồng gian hàng dùng chung cho các thuê bao tháng của khách hàng.">
                      <Input aria-label="Số hợp đồng khách hàng" maxLength={255} value={editor.value.contract ?? ""}
                        onChange={event=>change({contract:event.target.value})}/>
                    </Field>
                    <Field label="Hợp đồng đến" required>
                      <Input type="date" aria-label="Hợp đồng khách hàng đến" min={today} value={editor.value.contractEnd ?? ""}
                        onChange={event=>change({contractEnd:event.target.value})}/>
                    </Field>
                  </>}
                  <Field label="Tên khách hàng" required>
                    <Input
                      aria-label="Tên khách hàng"
                      maxLength={255}
                      value={editor.value.name}
                      onChange={(event) => change({ name: event.target.value })}
                    />
                  </Field>
                  <Field label="Số điện thoại" required>
                    <Input
                      aria-label="Số điện thoại khách hàng"
                      type="tel"
                      maxLength={12}
                      value={editor.value.phone}
                      onChange={(event) =>
                        change({ phone: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Email">
                    <Input
                      aria-label="Email khách hàng"
                      type="email"
                      maxLength={255}
                      value={editor.value.email}
                      onChange={(event) =>
                        change({ email: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Đơn vị" required>
                    <Select
                      aria-label="Đơn vị khách hàng"
                      value={editor.value.unitId || ""}
                      disabled={!editor.value.estate}
                      onChange={(e) => change({ unitId: e.target.value })}
                      options={[
                        { value: "", label: "Chọn đơn vị" },
                        ...managementUnits
                          .filter((u) => u.estate === editor.value.estate)
                          .map((u) => ({ value: u.id, label: u.name })),
                      ]}
                    />
                  </Field>
                  <Field label="Tòa" required>
                    <Select
                      aria-label="Tòa khách hàng"
                      value={editor.value.block || ""}
                      disabled={!editor.value.estate}
                      onChange={(e) =>
                        change({ block: e.target.value, apartment: "" })
                      }
                      options={[
                        { value: "", label: "Chọn tòa" },
                        ...[
                          ...new Set(
                            [
                              ...(editor.value.estate === "A"
                                ? ["S1.1", "S1.2", "S2.1"]
                                : editor.value.estate === "B"
                                  ? ["S3.1", "S4.1"]
                                  : ["T1", "T2"]),
                              ...directory.customers
                                .filter((c) => c.estate === editor.value.estate)
                                .map(
                                  (c) => c.block || c.apartment.split("-")[0],
                                )
                                .filter(Boolean),
                              editor.value.block || "",
                            ].filter(Boolean),
                          ),
                        ]
                          .sort()
                          .map((b) => ({ value: b, label: b })),
                      ]}
                    />
                  </Field>
                  <Field label="Căn hộ" required={editor.value.group==="Cư dân"}>
                    <Input
                      aria-label="Căn hộ khách hàng"
                      maxLength={80}
                      value={editor.value.apartment}
                      onChange={(event) =>
                        change({ apartment: event.target.value })
                      }
                      placeholder="Ví dụ: S1.1-1205"
                    />
                  </Field>
                  <Field label="CCCD">
                    <Input
                      aria-label="CCCD"
                      inputMode="numeric"
                      maxLength={20}
                      value={editor.value.identity}
                      onChange={(event) =>
                        change({ identity: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Địa chỉ">
                    <Input
                      aria-label="Địa chỉ khách hàng"
                      maxLength={255}
                      value={editor.value.address}
                      onChange={(event) =>
                        change({ address: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Trạng thái khách hàng">
                    <Select
                      aria-label="Trạng thái khách hàng"
                      value={String(editor.value.active)}
                      onChange={(event) =>
                        change({ active: event.target.value === "true" })
                      }
                      options={[
                        { value: "true", label: "Đang hoạt động" },
                        { value: "false", label: "Ngừng hoạt động" },
                      ]}
                    />
                  </Field>
                  <Field label="Ghi chú">
                    <Textarea
                      aria-label="Ghi chú khách hàng"
                      maxLength={500}
                      value={editor.value.note}
                      onChange={(event) => change({ note: event.target.value })}
                    />
                  </Field>
                </div>
                <CustomerFaces
                  value={editor.value.faces}
                  onChange={(faces) => change({ faces })}
                  onBusyChange={setCustomerFaceBusy}
                />
              </>
            )}
            {editor.kind === "vehicle" && (
              <div className="sm-form-grid">
                <Field label="Khu đô thị" required>
                  <Select
                    aria-label="Khu đô thị xe"
                    disabled={!!editor.value.id}
                    value={editor.value.estate}
                    onChange={(event) => change({ estate: event.target.value })}
                    options={[
                      { value: "", label: "Chọn khu đô thị" },
                      ...estateOptions,
                    ]}
                  />
                </Field>
                <Field label="Biển số" required>
                  <Input
                    aria-label="Biển số xe"
                    maxLength={20}
                    value={editor.value.plate}
                    onChange={(event) =>
                      change({ plate: event.target.value.toUpperCase() })
                    }
                  />
                </Field>
                <Field label="Loại phương tiện" required>
                  <Select aria-label="Loại phương tiện xe" value={editor.value.energy && editor.value.energy !== "Chưa xác định" ? `${editor.value.vehicle}|${editor.value.energy}` : ""}
                    onChange={e=>{const [vehicle,energy]=e.target.value.split("|");change({vehicle:vehicle||"Ô tô",energy:energy||""})}}
                    options={[{value:"",label:"Chọn loại phương tiện"},...vehicleChoiceOptions()]}/>
                </Field>
                <Field label="Mã thẻ RFID" hint="Mã EPC của tem UHF dán trên xe. Không bắt buộc; cần khi xe dùng dịch vụ có đầu đọc UHF. Mã là duy nhất và không nhập kho.">
                  <Input
                    aria-label="Mã thẻ RFID"
                    maxLength={50}
                    placeholder="VD: E2801160600002084B0C1F2A"
                    value={editor.value.rfid ?? ""}
                    onChange={(event) =>
                      change({ rfid: event.target.value.replace(/\s/g, "").toUpperCase() })
                    }
                  />
                </Field>
                <Field label="Hãng xe" required>
                  <Select
                    aria-label="Hãng xe"
                    value={editor.value.brand}
                    onChange={(e) => change({ brand: e.target.value })}
                    options={[
                      { value: "", label: "Chọn hãng xe" },
                      ...Array.from(
                        new Set(
                          [...vehicleBrands, editor.value.brand].filter(
                            Boolean,
                          ),
                        ),
                      ),
                    ]}
                  />
                </Field>
                <Field label="Màu xe">
                  <Input
                    aria-label="Màu xe"
                    maxLength={50}
                    value={editor.value.color}
                    onChange={(event) => change({ color: event.target.value })}
                  />
                </Field>
                <label className="sm-check">
                  <input
                    type="checkbox"
                    disabled
                    checked={!!editor.value.useVoucher}
                  />
                  Áp dụng voucher (theo dữ liệu voucher)
                </label>
                <Field label="Trạng thái xe">
                  <Select
                    aria-label="Trạng thái xe"
                    value={String(editor.value.active)}
                    onChange={(event) =>
                      change({ active: event.target.value === "true" })
                    }
                    options={[
                      { value: "true", label: "Đang hoạt động" },
                      { value: "false", label: "Ngừng hoạt động" },
                    ]}
                  />
                </Field>
                <Field label="Ghi chú">
                  <Textarea
                    aria-label="Ghi chú xe"
                    maxLength={500}
                    value={editor.value.note}
                    onChange={(event) => change({ note: event.target.value })}
                  />
                </Field>
              </div>
            )}
            {editor.kind === "service" && (
              <>
                <RelationChoices
                  label="Bãi xe áp dụng"
                  value={editor.value.parkIds}
                  options={managementParks.map((park) => ({
                    value: park.id,
                    label: park.label,
                  }))}
                  onChange={(parkIds) => change({ parkIds })}
                />
                <p className="sm-note">
                  Chọn ít nhất một bãi xe. Có thể dùng chung gói dịch vụ cho
                  nhiều bãi; mỗi thuê bao chọn gói theo bãi đã đăng ký.
                </p>
                <div className="sm-form-grid">
                  <Field label="Tên dịch vụ" required>
                    <Input
                      aria-label="Tên dịch vụ"
                      maxLength={255}
                      value={editor.value.name}
                      onChange={(event) => change({ name: event.target.value })}
                    />
                  </Field>
                  <Field label="Loại phương tiện" required>
                    <Select aria-label="Loại phương tiện dịch vụ" value={`${editor.value.vehicle}|${editor.value.energy||""}`}
                      onChange={e=>{const [vehicle,energy]=e.target.value.split("|");change({vehicle,energy})}} options={vehicleChoiceOptions(true)}/>
                  </Field>
                  <Field label="Kiểu dịch vụ">
                    <Select
                      aria-label="Kiểu dịch vụ"
                      value={editor.value.category}
                      onChange={(event) => {
                        const category = event.target
                          .value as ManagedService["category"]
                        change({
                          category,
                          prices: undefined,
                          pricing:
                            category === "Thuê bao" ? "Theo tháng" : "Theo giờ",
                          price: 0,
                        })
                      }}
                      options={["Thuê bao", "Vãng lai"]}
                    />
                  </Field>
                  <Field label="Chế độ kiểm soát">
                    <Select
                      aria-label="Chế độ kiểm soát"
                      value={editor.value.control}
                      onChange={(event) =>
                        change({ control: event.target.value })
                      }
                      options={[...controlModes]}
                    />
                  </Field>
                  <label className="sm-check">
                    <input
                      type="checkbox"
                      checked={!!editor.value.voucher}
                      onChange={(e) => change({ voucher: e.target.checked })}
                    />
                    Áp dụng voucher
                  </label>
                  <Field label="Trạng thái dịch vụ">
                    <Select
                      aria-label="Trạng thái dịch vụ"
                      value={String(editor.value.active)}
                      onChange={(event) =>
                        change({ active: event.target.value === "true" })
                      }
                      options={[
                        { value: "true", label: "Đang hoạt động" },
                        { value: "false", label: "Ngừng hoạt động" },
                      ]}
                    />
                  </Field>
                  <Field label="Ghi chú">
                    <Textarea
                      aria-label="Ghi chú dịch vụ"
                      maxLength={500}
                      value={editor.value.note}
                      onChange={(event) => change({ note: event.target.value })}
                    />
                  </Field>
                </div>
                <p className="sm-note">
                  Ngừng dịch vụ sẽ ngăn đăng ký/cấp thẻ mới. Thuê bao đang dùng
                  gói vẫn giữ liên kết để đối chiếu.
                </p>
              </>
            )}
            {editor.kind === "subscriber" && <SubscriberRegistration value={editor.value} state={state} onChange={change}
              onCreateCustomer={()=>{setParentEditor(editor);open({kind:"customer",value:emptyCustomer(editor.value.estate)})}}
              onEditCustomer={()=>{const customer=customers.get(editor.value.customerId);if(customer){setParentEditor(editor);open({kind:"customer",value:{...customer}})}}}
              onCreateVehicle={()=>{setParentEditor(editor);open({kind:"vehicle",value:emptyVehicle(editor.value.estate,editor.value.vehicle)})}}
              onEditVehicle={id=>{const vehicle=vehicleMap.get(id);if(vehicle){setParentEditor(editor);open({kind:"vehicle",value:{...vehicle}})}}}
              onCard={onCard}/>}
            {editor.kind === "issue" && issueSub && issueProfile && (
              <>
                <div className="sm-card-panel">
                  <CreditCard size={23} />
                  <div>
                    <Heading>{issueSub.id}</Heading>
                    <span>
                      {issueSub.owner} · {issueSub.type} ·{" "}
                      {issueProfile.vehicle}
                    </span>
                  </div>
                </div>
                {oldCard ? (
                  <div className="sm-warning">
                    <strong>
                      Thẻ cũ {oldCard.id} còn lưu hành (
                      {lookupCardStatus(oldCard, today)}).
                    </strong>
                    <p>
                      Cần thu hồi và kiểm tra vật lý hoặc lập biên bản mất/hỏng
                      trước khi cấp lại. Khóa thẻ đơn thuần chưa giải phóng thẻ
                      cũ.
                    </p>
                    <Button onClick={() => onCard(oldCard, issueSub.id)}>
                      Mở quản lý thẻ cũ
                      <ArrowRight size={14} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="sm-form-grid">
                      <Field label="Bãi cấp thẻ" required>
                        <Select
                          aria-label="Bãi cấp thẻ"
                          value={editor.value.parkId}
                          onChange={(event) => {
                            change({ parkId: event.target.value, cardId: "" })
                            setCardQuery("")
                          }}
                          options={[
                            { value: "", label: "Chọn bãi" },
                            ...issueProfile.lots
                              .filter((lot) => lot.active)
                              .map((lot) => ({
                                value: lot.parkId,
                                label:
                                  managementParks.find(
                                    (park) => park.id === lot.parkId,
                                  )?.label || lot.parkId,
                              })),
                          ]}
                        />
                      </Field>
                      <Field label="Tìm thẻ trong kho">
                        <Input
                          type="search"
                          aria-label="Tìm thẻ cấp"
                          value={cardQuery}
                          onChange={(event) => setCardQuery(event.target.value)}
                          placeholder="Nhập mã thẻ…"
                        />
                      </Field>
                    </div>
                    <p className="sm-note">
                      Chỉ hiện thẻ Trong kho đúng bãi, loại {issueSub.type} và
                      phương tiện {issueProfile.vehicle}. Một thẻ được cấp cho
                      thuê bao và dùng tại các bãi được áp dụng.
                    </p>
                    <div className="sm-stock-choices">
                      {candidates.slice(0, 50).map((card) => (
                        <label key={card.id}>
                          <input
                            type="radio"
                            name="issue-card"
                            checked={editor.value.cardId === card.id}
                            onChange={() => change({ cardId: card.id })}
                          />
                          <strong>{card.id}</strong>
                          <span>
                            {card.type} · {card.vehicle} · {card.park}
                          </span>
                        </label>
                      ))}
                      {!candidates.length && (
                        <div className="sm-empty">
                          Chưa có thẻ phù hợp trong kho. Kiểm tra bãi cấp thẻ
                          hoặc nhập thêm thẻ.
                        </div>
                      )}
                    </div>
                    <Field
                      label={
                        issueSub.cardId ? "Lý do cấp lại" : "Ghi chú cấp thẻ"
                      }
                      required
                    >
                      <Textarea
                        aria-label="Lý do cấp thẻ"
                        maxLength={500}
                        value={editor.value.reason}
                        onChange={(event) =>
                          change({ reason: event.target.value })
                        }
                      />
                    </Field>
                  </>
                )}
              </>
            )}
            {editor.kind === "status" && (
              <>
                <Field label="Trạng thái thuê bao">
                  <Select
                    aria-label="Trạng thái thuê bao mới"
                    value={editor.value.status}
                    onChange={(event) => change({ status: event.target.value })}
                    options={[...subscriptionStates]}
                  />
                </Field>
                <p className="sm-note">
                  Hủy là trạng thái cuối. Thao tác này không thu hồi thẻ về kho
                  thẻ đang lưu hành vẫn cần xử lý tại Quản lý thẻ.
                </p>
                <Field label="Lý do thay đổi" required>
                  <Textarea
                    aria-label="Lý do trạng thái thuê bao"
                    maxLength={500}
                    value={editor.value.reason}
                    onChange={(event) => change({ reason: event.target.value })}
                  />
                </Field>
              </>
            )}
            {(editor.kind === "customer" ||
              editor.kind === "vehicle" ||
              editor.kind === "service") &&
              editor.value.id && <AuditInformation record={editor.value} />}
            {error && (
              <p className="sm-error" role="alert" ref={errorRef} tabIndex={-1}>
                {error}
              </p>
            )}
            <button
              type="submit"
              className="sm-hidden-submit"
              tabIndex={-1}
              aria-hidden="true"
            />
          </Form>
        </Overlay>
      )}
      {discard && (
        <Overlay
          title="Bỏ thay đổi chưa lưu?"
          onClose={() => setDiscard(false)}
          footer={
            <>
              <Button onClick={() => setDiscard(false)}>Tiếp tục nhập</Button>
              <Button variant="primary" onClick={finishClose}>
                Bỏ thay đổi
              </Button>
            </>
          }
        >
          <p>
            Dữ liệu đang nhập chưa được lưu. Bạn có muốn bỏ các thay đổi này?
          </p>
        </Overlay>
      )}
      <footer className="sm-footer">
        VParking CMS · Dữ liệu minh họa dùng chung trong phiên · Báo cáo theo kỳ
        giữ nguyên dữ liệu đã chốt
      </footer>
    </div>
  )
}
