import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  Check,
  Copy,
  CreditCard,
  FileText,
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
  controlModes,
  defaultControlMode,
  directoryOf,
  issueSubscriberCard,
  managementParks,
  parseManagementRelation,
  saveManagedCustomer,
  saveManagedService,
  saveManagedVehicle,
  saveSubscriber,
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
    "Gói dịch vụ theo từng bãi, loại phương tiện, chế độ kiểm soát và cách tính giá.",
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
const emptyCustomer = (estate = ""): ManagedCustomer => ({
  id: "",
  estate,
  name: "",
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
  id: "",
  name: "",
  vehicle: "Ô tô",
  category: "Thuê bao",
  control: defaultControlMode,
  pricing: "Theo tháng",
  price: 0,
  validFrom: today,
  validTo: "",
  active: true,
  note: "",
})
const emptySubscriber = (): SubscriberInput => ({
  id: "",
  estate: "",
  customerId: "",
  members: [],
  vehicleIds: [],
  vehicle: "Ô tô",
  noPlate: false,
  anyPlate: false,
  lots: [{ parkId: "", serviceId: "", active: true }],
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

function EntityPicker({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string
  value: string
  onChange: (id: string) => void
  options: { value: string; label: string }[]
  required?: boolean
}) {
  const [query, setQuery] = useState("")
  const matching = options
    .filter((option) => normalize(option.label).includes(normalize(query)))
    .slice(0, 60)
  const selected = options.find((option) => option.value === value)
  const visible =
    selected && !matching.some((option) => option.value === value)
      ? [selected, ...matching]
      : matching
  return (
    <Field label={label} required={required}>
      <Input
        type="search"
        aria-label={`Tìm ${label.toLocaleLowerCase("vi")}`}
        placeholder="Tìm theo tên, mã hoặc số điện thoại…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <Select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        options={[
          { value: "", label: `Chọn ${label.toLocaleLowerCase("vi")}` },
          ...visible,
        ]}
      />
    </Field>
  )
}
function RelationChoices({
  label,
  value,
  options,
  onChange,
  max = 100,
}: {
  label: string
  value: string[]
  options: { value: string; label: string }[]
  onChange: (ids: string[]) => void
  max?: number
}) {
  const [query, setQuery] = useState("")
  const visible = options
    .filter(
      (option) =>
        value.includes(option.value) ||
        normalize(option.label).includes(normalize(query)),
    )
    .sort(
      (a, b) =>
        Number(value.includes(b.value)) - Number(value.includes(a.value)),
    )
    .slice(0, 20)
  return (
    <div className="sm-relations">
      <div className="sm-section-label">
        <strong>{label}</strong>
        <span>{value.length} đã chọn</span>
      </div>
      <Input
        type="search"
        aria-label={`Tìm ${label.toLocaleLowerCase("vi")}`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Nhập tên hoặc mã để tìm…"
      />
      <div className="sm-choice-list">
        {visible.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              checked={value.includes(option.value)}
              disabled={!value.includes(option.value) && value.length >= max}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, option.value]
                    : value.filter((id) => id !== option.value),
                )
              }
            />
            {option.label}
          </label>
        ))}
        {!visible.length && (
          <span className="muted">Chưa có dữ liệu phù hợp.</span>
        )}
      </div>
      {options.length > 20 && (
        <small className="muted">
          Hiện tối đa 20 kết quả; nhập từ khóa để tìm thêm.
        </small>
      )}
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
  const [estate, setEstate] = useState("")
  const [status, setStatus] = useState("")
  const [kind, setKind] = useState("")
  const [vehicle, setVehicle] = useState("")
  const [park, setPark] = useState("")
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
    setEstate("")
    setStatus("")
    setKind("")
    setVehicle("")
    setPark("")
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
  }, [search, estate, status, kind, vehicle, park, related])
  function open(next: Editor) {
    setEditor(next)
    setError("")
    setDirty(false)
    setCardQuery("")
    setDetail(null)
  }
  function change(patch: object) {
    setEditor((old) =>
      old ? { ...old, value: { ...old.value, ...patch } } as Editor : old,
    )
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
        ? { kind: "customer", value: emptyCustomer(estate) }
        : screen === "vehicles"
          ? { kind: "vehicle", value: emptyVehicle(estate) }
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
    if (!editor) return
    try {
      const next =
        editor.kind === "customer"
          ? saveManagedCustomer(state, editor.value)
          : editor.kind === "vehicle"
            ? saveManagedVehicle(state, editor.value)
            : editor.kind === "service"
              ? saveManagedService(state, editor.value)
              : editor.kind === "subscriber"
                ? saveSubscriber(state, editor.value)
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
      if (
        parentEditor &&
        (editor.kind === "customer" || editor.kind === "vehicle")
      ) {
        const nextDirectory = directoryOf(next)
        const updated = { ...parentEditor.value }
        if (editor.kind === "customer")
          updated.customerId = nextDirectory.customers[0].id
        else
          updated.vehicleIds =
            updated.type === "VIP"
              ? [...updated.vehicleIds, nextDirectory.vehicles[0].id]
              : [nextDirectory.vehicles[0].id]
        setEditor({ kind: "subscriber", value: updated })
        setParentEditor(null)
        setDirty(true)
        notify("Đã tạo hồ sơ và chọn vào thuê bao đang đăng ký.")
      } else {
        setEditor(null)
        setDirty(false)
        notify(
          editor.kind === "issue"
            ? "Đã cấp thẻ từ kho và cập nhật thuê bao, tra cứu thẻ."
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
    setSearch("")
    setEstate("")
    setStatus("")
    setKind("")
    setVehicle("")
    setPark("")
    setRelated(null)
  }
  const subscriberRows = state.subscriptions.filter((sub) => {
    const profile = profiles.get(sub.id)
    if (!profile) return false
    const owner = customers.get(profile.customerId)
    const card = cards.get(sub.id)
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
      (!estate || profile.estate === estate) &&
      (!status || profile.status === status) &&
      (!kind || sub.type === kind) &&
      (!vehicle || profile.vehicle === vehicle) &&
      (!park || profile.lots.some((lot) => lot.parkId === park)) &&
      normalize(
        [sub.id, owner?.name, owner?.phone, sub.plate, card?.id].join(" "),
      ).includes(normalize(search))
    )
  })
  const customerRows = directory.customers.filter(
    (row) =>
      (!estate || row.estate === estate) &&
      (!status || String(row.active) === status) &&
      normalize(
        [row.id, row.name, row.phone, row.apartment].join(" "),
      ).includes(normalize(search)),
  )
  const vehicleRows = directory.vehicles.filter(
    (row) =>
      (!estate || row.estate === estate) &&
      (!status || String(row.active) === status) &&
      (!vehicle || row.vehicle === vehicle) &&
      normalize([row.id, row.plate, row.brand, row.color].join(" ")).includes(
        normalize(search),
      ),
  )
  const serviceRows = directory.services.filter(
    (row) =>
      (!status || String(row.active) === status) &&
      (!kind || row.category === kind) &&
      (!vehicle || row.vehicle === vehicle) &&
      normalize([row.id, row.name].join(" ")).includes(normalize(search)),
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
      <div className="panel sm-filters">
        <div className="filter-heading">
          <strong>
            <Search size={14} /> Bộ lọc{" "}
            {screen === "subscriptions"
              ? "thuê bao"
              : screen === "customers"
                ? "khách hàng"
                : screen === "vehicles"
                  ? "xe"
                  : "dịch vụ"}
          </strong>
          <Button variant="ghost" onClick={clearFilters}>
            Xóa bộ lọc
          </Button>
        </div>
        <div className="filter-grid">
          <Field label="Tìm kiếm">
            <Input
              type="search"
              aria-label="Tìm kiếm danh sách"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nhập mã, tên, biển số…"
            />
          </Field>
          {screen !== "services" && <Field label="Khu đô thị">
            <Select
              aria-label="Khu đô thị"
              value={estate}
              onChange={(event) => {
                setEstate(event.target.value)
                setPark("")
              }}
              options={[
                { value: "", label: "Tất cả khu đô thị" },
                ...estateOptions,
              ]}
            />
          </Field>}
          <Field
            label={
              screen === "subscriptions" ? "Trạng thái thuê bao" : "Trạng thái"
            }
          >
            <Select
              aria-label={
                screen === "subscriptions"
                  ? "Trạng thái thuê bao"
                  : "Trạng thái"
              }
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              options={[
                { value: "", label: "Tất cả trạng thái" },
                ...(screen === "subscriptions"
                  ? subscriptionStates.map((value) => ({ value, label: value }))
                  : [
                      { value: "true", label: "Đang hoạt động" },
                      { value: "false", label: "Ngừng hoạt động" },
                    ]),
              ]}
            />
          </Field>
          {screen === "customers" ? (
            <div className="sm-filter-note">
              Tên và số điện thoại là thông tin hồ sơ; thuê bao liên kết bằng mã
              khách hàng.
            </div>
          ) : (
            <Field label="Phương tiện">
              <Select
                aria-label="Phương tiện"
                value={vehicle}
                onChange={(event) => setVehicle(event.target.value)}
                options={[
                  { value: "", label: "Tất cả phương tiện" },
                  ...vehicles,
                ]}
              />
            </Field>
          )}
          {(screen === "subscriptions" || screen === "services") && (
            <>
              <Field
                label={
                  screen === "subscriptions" ? "Loại thuê bao" : "Nhóm dịch vụ"
                }
              >
                <Select
                  aria-label={
                    screen === "subscriptions"
                      ? "Loại thuê bao"
                      : "Nhóm dịch vụ"
                  }
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                  options={[
                    { value: "", label: "Tất cả" },
                    ...(screen === "subscriptions"
                      ? ["Thuê bao tháng", "VIP"]
                      : ["Thuê bao", "Vãng lai"]),
                  ]}
                />
              </Field>
              {screen === "subscriptions" && <Field label="Bãi xe">
                <Select
                  aria-label="Bãi xe"
                  value={park}
                  onChange={(event) => setPark(event.target.value)}
                  options={[
                    { value: "", label: "Tất cả bãi xe" },
                    ...managementParks
                      .filter((row) => !estate || row.estate === estate)
                      .map((row) => ({ value: row.id, label: row.label })),
                  ]}
                />
              </Field>}
            </>
          )}
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
      </div>
      <div className="panel sm-list">
        <div className="sm-list-heading">
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
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {(screen === "subscriptions"
                  ? [
                      "Mã thuê bao / Chủ thuê bao",
                      "Loại / Nhóm thuê bao",
                      "Phương tiện / Biển số",
                      "Bãi và gói dịch vụ",
                      "Hiệu lực",
                      "Trạng thái thuê bao",
                      "Thẻ đang cấp",
                      "Thao tác",
                    ]
                  : screen === "customers"
                    ? [
                        "Mã / Khách hàng",
                        "Khu đô thị",
                        "Số điện thoại",
                        "Căn hộ",
                        "Nguồn",
                        "Trạng thái",
                        "Thuê bao liên quan",
                        "Thao tác",
                      ]
                    : screen === "vehicles"
                      ? [
                          "Mã / Biển số",
                          "Khu đô thị",
                          "Phương tiện",
                          "Hãng / Màu",
                          "Trạng thái",
                          "Thuê bao liên quan",
                          "Thao tác",
                        ]
                      : [
                          "Mã / Dịch vụ",
                          "Phương tiện / Nhóm",
                          "Kiểm soát",
                          "Đơn giá",
                          "Hiệu lực",
                          "Trạng thái",
                          "Thao tác",
                        ]
                ).map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                if (screen === "subscriptions") {
                  const sub = state.subscriptions.find((row) => row.id === id)!,
                    profile = profiles.get(id)!,
                    customer = customers.get(profile.customerId),
                    card = cards.get(id)
                  return (
                    <tr key={id}>
                      <td>
                        <Button variant="link" onClick={() => setDetail(id)}>
                          {id}
                        </Button>
                        <span className="sm-secondary">{customer?.name}</span>
                      </td>
                      <td>
                        <Badge tone={sub.type === "VIP" ? "amber" : "blue"}>
                          {sub.type}
                        </Badge>
                        <span className="sm-secondary">
                          {sub.type === "VIP" ? "—" : sub.group}
                        </span>
                      </td>
                      <td>
                        {profile.vehicle}
                        <span className="sm-secondary sm-wrap">
                          {sub.plate}
                        </span>
                      </td>
                      <td>
                        {profile.lots.map((lot) => (
                          <span className="sm-secondary" key={lot.parkId}>
                            {
                              managementParks.find(
                                (park) => park.id === lot.parkId,
                              )?.label
                            }
                            <small>
                              {services.get(lot.serviceId)?.name}
                              {!lot.active ? " · Tạm ngừng" : ""}
                            </small>
                          </span>
                        ))}
                      </td>
                      <td>
                        {date(sub.effectiveFrom)}
                        <span className="sm-secondary">
                          {sub.expiry
                            ? `đến ${date(sub.expiry)}`
                            : "Không giới hạn"}
                        </span>
                      </td>
                      <td>
                        <Badge tone={tone(profile.status)}>
                          {profile.status}
                        </Badge>
                      </td>
                      <td>
                        {card ? (
                          <>
                            <Button
                              variant="link"
                              onClick={() => onCard(card, id)}
                            >
                              {card.id}
                            </Button>
                            <span className="sm-secondary">
                              <Badge tone={tone(lookupCardStatus(card, today))}>
                                {lookupCardStatus(card, today)}
                              </Badge>
                            </span>
                          </>
                        ) : (
                          <span className="muted">Chưa có thẻ lưu hành</span>
                        )}
                      </td>
                      <td>
                        <div className="sm-actions">
                          <Button
                            variant="ghost"
                            aria-label={`Xem thuê bao ${id}`}
                            onClick={() => setDetail(id)}
                          >
                            Chi tiết
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={profile.status === "Đã hủy"}
                            onClick={() => issue(id)}
                          >
                            {sub.cardId ? "Cấp lại thẻ" : "Cấp thẻ"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                }
                if (screen === "customers") {
                  const row = customers.get(id)!
                  return (
                    <tr key={id}>
                      <td>
                        <Button variant="link" onClick={() => setDetail(id)}>
                          {row.name}
                        </Button>
                        <span className="sm-secondary">{id}</span>
                      </td>
                      <td>
                        {
                          estates.find((estate) => estate.id === row.estate)
                            ?.short
                        }
                      </td>
                      <td>{row.phone || "—"}</td>
                      <td>{row.apartment || "—"}</td>
                      <td>{row.source}</td>
                      <td>
                        <Badge tone={row.active ? "green" : "neutral"}>
                          {row.active ? "Đang hoạt động" : "Ngừng hoạt động"}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="link"
                          onClick={() =>
                            onNavigate("subscriptions", `customer:${id}`)
                          }
                        >
                          {linkedCount("customer", id)} thuê bao
                        </Button>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          aria-label={`Sửa khách hàng ${id}`}
                          onClick={() => editRecord(id)}
                        >
                          <Pencil size={14} />
                        </Button>
                      </td>
                    </tr>
                  )
                }
                if (screen === "vehicles") {
                  const row = vehicleMap.get(id)!
                  return (
                    <tr key={id}>
                      <td>
                        <Button variant="link" onClick={() => setDetail(id)}>
                          {row.plate}
                        </Button>
                        <span className="sm-secondary">{id}</span>
                      </td>
                      <td>
                        {
                          estates.find((estate) => estate.id === row.estate)
                            ?.short
                        }
                      </td>
                      <td>{row.vehicle}</td>
                      <td>
                        {row.brand || "—"}
                        <span className="sm-secondary">{row.color || "—"}</span>
                      </td>
                      <td>
                        <Badge tone={row.active ? "green" : "neutral"}>
                          {row.active ? "Đang hoạt động" : "Ngừng hoạt động"}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="link"
                          onClick={() =>
                            onNavigate("subscriptions", `vehicle:${id}`)
                          }
                        >
                          {linkedCount("vehicle", id)} thuê bao
                        </Button>
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          aria-label={`Sửa xe ${id}`}
                          onClick={() => editRecord(id)}
                        >
                          <Pencil size={14} />
                        </Button>
                      </td>
                    </tr>
                  )
                }
                const row = services.get(id)!
                return (
                  <tr key={id}>
                    <td>
                      <Button variant="link" onClick={() => setDetail(id)}>
                        {row.name}
                      </Button>
                      <span className="sm-secondary">{id}</span>
                    </td>
                    <td>
                      {row.vehicle}
                      <span className="sm-secondary">{row.category}</span>
                    </td>
                    <td>{row.control}</td>
                    <td>
                      {fmt(row.price)} đ
                      <span className="sm-secondary">{row.pricing}</span>
                    </td>
                    <td>
                      {date(row.validFrom)}
                      <span className="sm-secondary">
                        {row.validTo
                          ? `đến ${date(row.validTo)}`
                          : "Không giới hạn ngày kết thúc"}
                      </span>
                    </td>
                    <td>
                      <Badge tone={row.active ? "green" : "neutral"}>
                        {row.active ? "Đang hoạt động" : "Ngừng hoạt động"}
                      </Badge>
                    </td>
                    <td>
                      <div className="sm-actions">
                        <Button
                          variant="ghost"
                          aria-label={`Sửa dịch vụ ${id}`}
                          onClick={() => editRecord(id)}
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={`Sao chép dịch vụ ${id}`}
                          onClick={() =>
                            open({
                              kind: "service",
                              value: {
                                ...row,
                                id: "",
                                name: `${row.name} (bản sao)`,
                              },
                            })
                          }
                        >
                          <Copy size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!ids.length && (
                <tr>
                  <td colSpan={8}>
                    <div className="sm-empty">
                      <Search size={24} />
                      <strong>Không có dữ liệu phù hợp</strong>
                      <span>Kiểm tra lại bộ lọc hoặc thêm hồ sơ mới.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
              <div className="sm-card-panel">
                <CreditCard size={22} />
                <div>
                  <strong>{selectedCard?.id || "Chưa có thẻ lưu hành"}</strong>
                  <p>
                    {selectedCard
                      ? `${lookupCardStatus(selectedCard, today)} · Kho ${selectedCard.park}`
                      : selectedSub.cardId
                        ? `Thẻ gần nhất: ${selectedSub.cardId}. Có thể cấp lại sau khi thẻ cũ đã được xử lý.`
                        : "Đăng ký thuê bao trước, cấp thẻ từ kho khi khách đến nhận."}
                  </p>
                </div>
                {selectedCard && (
                  <Button onClick={() => onCard(selectedCard, selectedSub.id)}>
                    Quản lý thẻ
                    <ArrowRight size={14} />
                  </Button>
                )}
                <Button
                  onClick={() => issue(selectedSub.id)}
                  disabled={selectedProfile.status !== "Đang hoạt động"}
                >
                  {selectedSub.cardId ? "Cấp lại thẻ" : "Cấp thẻ"}
                </Button>
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
              <div className="sm-detail-grid">
                {[
                  ["Mã khách hàng", selectedCustomer.id],
                  ["Số điện thoại", selectedCustomer.phone],
                  ["Email", selectedCustomer.email],
                  ["Giấy tờ định danh", selectedCustomer.identity],
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
              <div className="sm-detail-grid">
                {[
                  ["Mã xe", selectedVehicle.id],
                  ["Phương tiện", selectedVehicle.vehicle],
                  ["Hãng xe", selectedVehicle.brand],
                  ["Màu xe", selectedVehicle.color],
                  ["Ghi chú", selectedVehicle.note],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value || "—"}</strong>
                  </div>
                ))}
              </div>
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
              <div className="sm-detail-grid">
                {[
                  ["Mã dịch vụ", selectedService.id],
                  ["Loại phương tiện", selectedService.vehicle],
                  ["Nhóm dịch vụ", selectedService.category],
                  ["Kiểm soát", selectedService.control],
                  ["Cách tính giá", selectedService.pricing],
                  ["Đơn giá", `${fmt(selectedService.price)} đ`],
                  [
                    "Hiệu lực",
                    `${date(selectedService.validFrom)} – ${
                      selectedService.validTo
                        ? date(selectedService.validTo)
                        : "Không giới hạn"
                    }`,
                  ],
                  ["Ghi chú", selectedService.note],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{value || "—"}</strong>
                  </div>
                ))}
              </div>
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
              ? "Chọn hồ sơ có sẵn; việc cấp thẻ được thực hiện sau khi lưu thuê bao."
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
                  editor.kind === "issue" && (!!oldCard || !editor.value.cardId)
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
              <div className="sm-form-grid">
                <Field label="Khu đô thị" required>
                  <Select
                    aria-label="Khu đô thị khách hàng"
                    disabled={!!editor.value.id}
                    value={editor.value.estate}
                    onChange={(event) => change({ estate: event.target.value })}
                    options={[
                      { value: "", label: "Chọn khu đô thị" },
                      ...estateOptions,
                    ]}
                  />
                </Field>
                <Field label="Tên khách hàng" required>
                  <Input
                    aria-label="Tên khách hàng"
                    maxLength={255}
                    value={editor.value.name}
                    onChange={(event) => change({ name: event.target.value })}
                  />
                </Field>
                <Field label="Số điện thoại">
                  <Input
                    aria-label="Số điện thoại khách hàng"
                    type="tel"
                    maxLength={12}
                    value={editor.value.phone}
                    onChange={(event) => change({ phone: event.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    aria-label="Email khách hàng"
                    type="email"
                    maxLength={255}
                    value={editor.value.email}
                    onChange={(event) => change({ email: event.target.value })}
                  />
                </Field>
                <Field label="Căn hộ">
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
                <Field label="Giấy tờ định danh">
                  <Input
                    aria-label="Giấy tờ định danh"
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
                <Field label="Phương tiện" required>
                  <Select
                    aria-label="Loại phương tiện xe"
                    value={editor.value.vehicle}
                    onChange={(event) =>
                      change({ vehicle: event.target.value })
                    }
                    options={vehicles}
                  />
                </Field>
                <Field label="Hãng xe">
                  <Input
                    aria-label="Hãng xe"
                    maxLength={80}
                    value={editor.value.brand}
                    onChange={(event) => change({ brand: event.target.value })}
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
                <div className="sm-form-grid">
                  <Field label="Tên dịch vụ" required>
                    <Input
                      aria-label="Tên dịch vụ"
                      maxLength={255}
                      value={editor.value.name}
                      onChange={(event) => change({ name: event.target.value })}
                    />
                  </Field>
                  <Field label="Phương tiện">
                    <Select
                      aria-label="Phương tiện dịch vụ"
                      value={editor.value.vehicle}
                      onChange={(event) =>
                        change({ vehicle: event.target.value })
                      }
                      options={vehicles}
                    />
                  </Field>
                  <Field label="Nhóm dịch vụ">
                    <Select
                      aria-label="Nhóm dịch vụ"
                      value={editor.value.category}
                      onChange={(event) =>
                        change({ category: event.target.value })
                      }
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
                  <Field label="Cách tính giá">
                    <Select
                      aria-label="Cách tính giá"
                      value={editor.value.pricing}
                      onChange={(event) =>
                        change({
                          pricing: event.target.value,
                          ...(event.target.value === "Miễn phí"
                            ? { price: 0 }
                            : {}),
                        })
                      }
                      options={[
                        "Theo tháng",
                        "Theo giờ",
                        "Theo lượt",
                        "Miễn phí",
                      ]}
                    />
                  </Field>
                  <Field label="Đơn giá (đ)">
                    <Input
                      type="number"
                      aria-label="Đơn giá dịch vụ"
                      min={0}
                      max={100000000}
                      disabled={editor.value.pricing === "Miễn phí"}
                      value={editor.value.price}
                      onChange={(event) =>
                        change({ price: Number(event.target.value) })
                      }
                    />
                  </Field>
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
                  <Field label="Hiệu lực từ" required>
                    <Input
                      type="date"
                      aria-label="Hiệu lực dịch vụ từ"
                      value={editor.value.validFrom}
                      onChange={(event) =>
                        change({ validFrom: event.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label="Hiệu lực đến"
                    hint="Để trống nếu không giới hạn."
                  >
                    <Input
                      type="date"
                      aria-label="Hiệu lực dịch vụ đến"
                      min={editor.value.validFrom}
                      value={editor.value.validTo}
                      onChange={(event) =>
                        change({ validTo: event.target.value })
                      }
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
            {editor.kind === "subscriber" &&
              (() => {
                const value = editor.value
                const customerOptions = directory.customers
                  .filter(
                    (row) =>
                      row.estate === value.estate &&
                      (row.active || row.id === value.customerId),
                  )
                  .map((row) => ({
                    value: row.id,
                    label: `${row.name} · ${row.id} · ${row.phone || "Chưa có SĐT"}`,
                  }))
                const vehicleOptions = directory.vehicles
                  .filter(
                    (row) =>
                      row.estate === value.estate &&
                      row.vehicle === value.vehicle &&
                      (row.active || value.vehicleIds.includes(row.id)),
                  )
                  .map((row) => ({
                    value: row.id,
                    label: `${row.plate} · ${row.id}`,
                  }))
                const activeCard = cards.get(value.id)
                return (
                  <>
                    <h3 className="sm-subheading">Thông tin thuê bao</h3>
                    <div className="sm-form-grid">
                      <Field label="Khu đô thị" required>
                        <Select
                          aria-label="Khu đô thị thuê bao"
                          disabled={!!value.id}
                          value={value.estate}
                          onChange={(event) =>
                            change({
                              estate: event.target.value,
                              customerId: "",
                              members: [],
                              vehicleIds: [],
                              lots: [
                                { parkId: "", serviceId: "", active: true },
                              ],
                            })
                          }
                          options={[
                            { value: "", label: "Chọn khu đô thị" },
                            ...estateOptions,
                          ]}
                        />
                      </Field>
                      <Field label="Loại thuê bao" required>
                        <Select
                          aria-label="Loại thuê bao đăng ký"
                          disabled={!!activeCard}
                          value={value.type}
                          onChange={(event) =>
                            change({
                              type: event.target.value,
                              vehicleIds: [],
                              noPlate: false,
                              anyPlate: false,
                              group: "",
                              contract: "",
                              contractEnd: "",
                            })
                          }
                          options={["Thuê bao tháng", "VIP"]}
                        />
                      </Field>
                      <EntityPicker
                        label="Chủ thuê bao"
                        required
                        value={value.customerId}
                        onChange={(customerId) =>
                          change({
                            customerId,
                            members: value.members.filter(
                              (id) => id !== customerId,
                            ),
                          })
                        }
                        options={customerOptions}
                      />
                      <div className="sm-selected-customer">
                        <Users size={21} />
                        <strong>
                          {customers.get(value.customerId)?.name ||
                            "Chọn hồ sơ khách hàng có sẵn"}
                        </strong>
                        <span>
                          {customers.get(value.customerId)?.apartment ||
                            "Chưa có thông tin căn hộ"}
                        </span>
                        <Button
                          disabled={!value.estate}
                          onClick={() => {
                            setParentEditor(editor)
                            open({
                              kind: "customer",
                              value: emptyCustomer(value.estate),
                            })
                          }}
                        >
                          <Plus size={13} />
                          Tạo khách hàng mới
                        </Button>
                      </div>
                      <Field label="Loại phương tiện" required>
                        <Select
                          aria-label="Loại phương tiện thuê bao"
                          disabled={!!activeCard}
                          value={value.vehicle}
                          onChange={(event) =>
                            change({
                              vehicle: event.target.value,
                              vehicleIds: [],
                              lots: value.lots.map((lot) => ({
                                ...lot,
                                serviceId: "",
                              })),
                            })
                          }
                          options={vehicles}
                        />
                      </Field>
                      {value.type === "Thuê bao tháng" && (
                        <Field label="Nhóm thuê bao" required>
                          <Select
                            aria-label="Nhóm thuê bao đăng ký"
                            value={value.group}
                            onChange={(event) =>
                              change({
                                group: event.target.value,
                                contract: "",
                                contractEnd: "",
                              })
                            }
                            options={[
                              { value: "", label: "Chọn nhóm thuê bao" },
                              ...customerGroups,
                            ]}
                          />
                        </Field>
                      )}
                      <Field label="Hiệu lực từ" required>
                        <Input
                          type="date"
                          aria-label="Hiệu lực thuê bao từ"
                          value={value.from}
                          onChange={(event) =>
                            change({ from: event.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="Hiệu lực đến"
                        required={value.type === "Thuê bao tháng"}
                        hint={
                          value.type === "VIP"
                            ? "Để trống nếu VIP không giới hạn thời gian."
                            : undefined
                        }
                      >
                        <Input
                          type="date"
                          aria-label="Hiệu lực thuê bao đến"
                          min={value.from}
                          value={value.to}
                          onChange={(event) =>
                            change({ to: event.target.value })
                          }
                        />
                      </Field>
                      {value.type === "Thuê bao tháng" &&
                        value.group === "Gian hàng" && (
                          <>
                            <Field label="Số hợp đồng" required>
                              <Input
                                aria-label="Số hợp đồng thuê bao"
                                maxLength={255}
                                value={value.contract}
                                onChange={(event) =>
                                  change({ contract: event.target.value })
                                }
                              />
                            </Field>
                            <Field label="Hợp đồng đến" required>
                              <Input
                                type="date"
                                aria-label="Hợp đồng thuê bao đến"
                                value={value.contractEnd}
                                onChange={(event) =>
                                  change({ contractEnd: event.target.value })
                                }
                              />
                            </Field>
                          </>
                        )}
                    </div>
                    {activeCard && (
                      <p className="sm-note">
                        Thuê bao đang có thẻ {activeCard.id}. Cần thu hồi thẻ
                        trước khi đổi loại thuê bao hoặc loại phương tiện.
                      </p>
                    )}
                    {value.type === "Thuê bao tháng" &&
                      value.group === "Cư dân" && (
                        <p className="sm-note">
                          Căn hộ được lấy từ hồ sơ chủ thuê bao:{" "}
                          <strong>
                            {customers.get(value.customerId)?.apartment ||
                              "Chưa có căn hộ — bổ sung trong hồ sơ Khách hàng."}
                          </strong>
                        </p>
                      )}
                    <h3 className="sm-subheading">Phương tiện sử dụng</h3>
                    <label className="sm-check">
                      <input
                        type="checkbox"
                        checked={
                          value.type === "VIP" ? value.anyPlate : value.noPlate
                        }
                        onChange={(event) =>
                          change(
                            value.type === "VIP"
                              ? {
                                  anyPlate: event.target.checked,
                                  vehicleIds: [],
                                }
                              : {
                                  noPlate: event.target.checked,
                                  vehicleIds: [],
                                },
                          )
                        }
                      />
                      {value.type === "VIP"
                        ? "VIP không giới hạn biển số"
                        : "Xe không có biển số"}
                    </label>
                    {!value.anyPlate && !value.noPlate && (
                      <>
                        {value.type === "VIP" ? (
                          <RelationChoices
                            label="Xe của VIP"
                            value={value.vehicleIds}
                            onChange={(vehicleIds) => change({ vehicleIds })}
                            options={vehicleOptions}
                            max={10}
                          />
                        ) : (
                          <EntityPicker
                            label="Xe của thuê bao"
                            required
                            value={value.vehicleIds[0] || ""}
                            onChange={(id) =>
                              change({ vehicleIds: id ? [id] : [] })
                            }
                            options={vehicleOptions}
                          />
                        )}
                        <Button
                          className="sm-inline-add"
                          disabled={
                            !value.estate ||
                            (value.type === "VIP" &&
                              value.vehicleIds.length >= 10)
                          }
                          onClick={() => {
                            setParentEditor(editor)
                            open({
                              kind: "vehicle",
                              value: emptyVehicle(value.estate, value.vehicle),
                            })
                          }}
                        >
                          <CarFront size={14} />
                          Tạo xe mới
                        </Button>
                      </>
                    )}
                    <h3 className="sm-subheading">Bãi xe và gói dịch vụ</h3>
                    <div className="sm-lot-editor">
                      {value.lots.map((lot, index) => (
                        <div key={index}>
                          <Field label={`Bãi xe ${index + 1}`} required>
                            <Select
                              aria-label={`Bãi xe thuê bao ${index + 1}`}
                              value={lot.parkId}
                              onChange={(event) =>
                                change({
                                  lots: value.lots.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? {
                                          ...row,
                                          parkId: event.target.value,
                                          serviceId: "",
                                        }
                                      : row,
                                  ),
                                })
                              }
                              options={[
                                { value: "", label: "Chọn bãi xe" },
                                ...managementParks
                                  .filter(
                                    (park) => park.estate === value.estate,
                                  )
                                  .map((park) => ({
                                    value: park.id,
                                    label: park.label,
                                  })),
                              ]}
                            />
                          </Field>
                          <Field label="Gói dịch vụ" required>
                            <Select
                              aria-label={`Gói dịch vụ thuê bao ${index + 1}`}
                              disabled={!lot.parkId}
                              value={lot.serviceId}
                              onChange={(event) =>
                                change({
                                  lots: value.lots.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? {
                                          ...row,
                                          serviceId: event.target.value,
                                        }
                                      : row,
                                  ),
                                })
                              }
                              options={[
                                {
                                  value: "",
                                  label: "Chọn gói Thuê bao đúng phương tiện",
                                },
                                ...directory.services
                                  .filter(
                                    (service) =>
                                      service.vehicle === value.vehicle &&
                                      service.category === "Thuê bao" &&
                                      (service.active ||
                                        service.id === lot.serviceId),
                                  )
                                  .map((service) => ({
                                    value: service.id,
                                    label: `${service.name} · ${fmt(service.price)} đ${
                                      !service.active ? " · Đã ngừng" : ""
                                    }`,
                                  })),
                              ]}
                            />
                          </Field>
                          <label className="sm-check">
                            <input
                              type="checkbox"
                              checked={lot.active}
                              onChange={(event) =>
                                change({
                                  lots: value.lots.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? { ...row, active: event.target.checked }
                                      : row,
                                  ),
                                })
                              }
                            />
                            Áp dụng
                          </label>
                          <Button
                            variant="ghost"
                            aria-label={`Bỏ bãi xe ${index + 1}`}
                            disabled={value.lots.length <= 1}
                            onClick={() =>
                              change({
                                lots: value.lots.filter(
                                  (_, rowIndex) => rowIndex !== index,
                                ),
                              })
                            }
                          >
                            <X size={15} />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      className="sm-inline-add"
                      disabled={
                        !value.estate ||
                        value.lots.length >=
                          managementParks.filter(
                            (park) => park.estate === value.estate,
                          ).length
                      }
                      onClick={() =>
                        change({
                          lots: [
                            ...value.lots,
                            { parkId: "", serviceId: "", active: true },
                          ],
                        })
                      }
                    >
                      <Plus size={14} />
                      Thêm bãi xe
                    </Button>
                    <h3 className="sm-subheading">
                      Thành viên sử dụng thuê bao
                    </h3>
                    <RelationChoices
                      label="Thành viên"
                      value={value.members}
                      onChange={(members) => change({ members })}
                      options={customerOptions.filter(
                        (option) => option.value !== value.customerId,
                      )}
                    />
                    <Field label="Ghi chú">
                      <Textarea
                        aria-label="Ghi chú thuê bao"
                        maxLength={500}
                        value={value.note}
                        onChange={(event) =>
                          change({ note: event.target.value })
                        }
                      />
                    </Field>
                  </>
                )
              })()}
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
                  Hủy là trạng thái cuối. Thao tác này không thu hồi thẻ về kho;
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
