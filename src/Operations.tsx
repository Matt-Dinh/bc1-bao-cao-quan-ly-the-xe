import { useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CreditCard,
  Download,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  History,
  Info,
  LockKeyhole,
  Package,
  Plus,
  ScanLine,
  Search,
  ShieldCheck,
  TriangleAlert,
  UnlockKeyhole,
  Upload,
  Warehouse,
  X,
} from "lucide-react"
import {
  Badge,
  Button,
  Field,
  Form,
  Heading,
  Input,
  Label,
  Overlay,
  Select,
  Textarea,
} from "./ui"
import {
  cardTypes,
  customerGroups,
  date,
  estates,
  fmt,
  normalize,
  today,
  vehicles,
} from "./data"
import type { Card } from "./data"
import { cardHistory } from "./report-model"
import {
  applyOperation,
  cardStatuses,
  operationMenus,
  seedOperations,
} from "./operations-model"
import type {
  Handoff,
  Incident,
  Lot,
  OperationAction,
  OperationScreen,
  Subscription,
} from "./operations-model"

const parks = estates.flatMap((e) =>
  e.parks.map((park, i) => ({
    key: `${e.id}:${i}`,
    estate: e.id,
    park,
    label: `${park} · ${e.short}`,
  })),
)
const statusTone = (s: string) =>
  s === "Trong kho"
    ? "blue"
    : s === "Đang hoạt động"
      ? "green"
      : s === "Mất / hỏng"
        ? "red"
        : "neutral"
const maskedPhone = (p: string) =>
  p.includes("*") || p === "—" ? p : `${p.slice(0, 4)}****${p.slice(-3)}`
interface ImportRow {
  id: string
  error: string
}
interface RecordSelection {
  kind: "lot" | "handoff" | "incident"
  id: string
}
interface Editor {
  kind: "import" | "subscription" | "handoff"
  parkKey: string
  supplier: string
  type: string
  vehicle: string
  owner: string
  phone: string
  plate: string
  group: string
  apartment: string
  contract: string
  contractEnd: string
  effectiveFrom: string
  expiry: string
  code: string
  recipient: string
  note: string
  replacement: string
}
interface CardAction {
  kind: "lock" | "unlock" | "return" | "incident"
  cardId: string
  reason: string
  checked: boolean
  result: string
  incidentKind: "Mất" | "Hỏng"
  number: string
  fee: string
  date: string
}
export default function Operations({
  screen,
  focusCardId,
  onFocused,
  onLookup,
  onDirtyChange,
  onNotify,
}: {
  screen: OperationScreen | null
  focusCardId: string | null
  onFocused: () => void
  onLookup: () => void
  onDirtyChange: (dirty: boolean) => void
  onNotify: (text: string) => void
}) {
  const [state, setState] = useState(seedOperations)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [parkFilter, setParkFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [vehicleFilter, setVehicleFilter] = useState("")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [dirty, setDirty] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importStage, setImportStage] = useState(0)
  const [fileName, setFileName] = useState("")
  const [fileError, setFileError] = useState("")
  const [fileBusy, setFileBusy] = useState(false)
  const [reviewTab, setReviewTab] = useState("all")
  const [selected, setSelected] = useState<string[]>([])
  const [scan, setScan] = useState("")
  const [scanError, setScanError] = useState("")
  const [picker, setPicker] = useState(false)
  const [pickerQuery, setPickerQuery] = useState("")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState("Thông tin thẻ")
  const [action, setAction] = useState<CardAction | null>(null)
  const initialAction = useRef<CardAction | null>(null)
  const actionDirty =
    !!action && JSON.stringify(action) !== JSON.stringify(initialAction.current)
  const [actionError, setActionError] = useState("")
  const [record, setRecord] = useState<RecordSelection | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastScreen = useRef(screen)
  const formRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    onDirtyChange((!!editor && dirty) || actionDirty)
  }, [editor, dirty, actionDirty, onDirtyChange])
  useEffect(() => {
    const changed = (!!editor && dirty) || actionDirty
    const handler = (e: BeforeUnloadEvent) => {
      if (changed) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [editor, dirty, actionDirty])
  useEffect(() => {
    if (lastScreen.current !== screen) {
      const fromWarehouse =
        lastScreen.current === "inventory" && screen === "lookup"
      setEditor(null)
      setDirty(false)
      setAction(null)
      setDetailId(null)
      if (!fromWarehouse) {
        setSearch("")
        setQuery("")
        setTypeFilter("")
        setVehicleFilter("")
        setStatusFilter("")
      }
      setPage(1)
      lastScreen.current = screen
    }
  }, [screen])
  useEffect(() => {
    if (screen === "lookup" && focusCardId) {
      setDetailId(focusCardId)
      setDetailTab("Thông tin thẻ")
      setParkFilter("")
      setTypeFilter("")
      setVehicleFilter("")
      setStatusFilter("")
      onFocused()
    }
  }, [focusCardId, screen, onFocused])
  const section = operationMenus.find((m) => m.id === screen)
  const isCardList = screen === "inventory" || screen === "lookup"
  const park = parks.find((p) => p.key === editor?.parkKey)
  const filteredPark = parks.find((p) => p.key === parkFilter)
  const scope = state.cards.filter(
    (c) =>
      !filteredPark ||
      (c.estate === filteredPark.estate && c.park === filteredPark.park),
  )
  const detail = state.cards.find((c) => c.id === detailId)
  const actCard = state.cards.find((c) => c.id === action?.cardId)
  const subscription = state.subscriptions.find(
    (s) => s.id === editor?.replacement,
  )
  const originalCard = state.cards.find((c) => c.id === subscription?.cardId)
  const replacementReady =
    !subscription ||
    (!subscription.ended &&
      !!originalCard &&
      ["Trong kho", "Mất / hỏng"].includes(originalCard.status))
  const chosen = state.cards.find(
    (c) => normalize(c.id) === normalize(editor?.code || ""),
  )
  const candidates = state.cards.filter(
    (c) =>
      c.status === "Trong kho" &&
      c.estate === park?.estate &&
      c.park === park?.park &&
      (editor?.kind === "handoff"
        ? c.type === "Vãng lai"
        : c.vehicle === editor?.vehicle),
  )
  const pickerCards = candidates.filter(
    (c) =>
      !pickerQuery.trim() || normalize(c.id).includes(normalize(pickerQuery)),
  )
  const foundCardError =
    editor?.code &&
    (!chosen
      ? "Không tìm thấy mã thẻ."
      : chosen.status !== "Trong kho"
        ? "Thẻ không ở trạng thái Trong kho."
        : chosen.estate !== park?.estate || chosen.park !== park?.park
          ? "Thẻ không thuộc kho bãi đã chọn."
          : chosen.vehicle !== editor.vehicle
            ? "Loại phương tiện của thẻ không khớp."
            : "")
  const fieldErrors = {
    phone:
      editor?.phone && !editor.replacement && !/^\d{10}$/.test(editor.phone)
        ? "Số điện thoại phải có đúng 10 chữ số."
        : "",
    plate:
      editor?.plate &&
      !editor.replacement &&
      (!/^[A-Za-z0-9Đđ.\s-]+$/.test(editor.plate) || !normalize(editor.plate))
        ? "Biển số chỉ gồm chữ không dấu, số và dấu phân cách."
        : "",
    expiry:
      editor?.expiry && editor.expiry < editor.effectiveFrom
        ? "Ngày hết hiệu lực phải từ ngày bắt đầu trở đi."
        : "",
    contract:
      editor?.contractEnd &&
      editor.group === "Gian hàng" &&
      editor.contractEnd < today
        ? "Hợp đồng gian hàng đã hết hiệu lực."
        : "",
  }
  const canActivate =
    !!editor &&
    !!park &&
    !!chosen &&
    !foundCardError &&
    replacementReady &&
    (!editor.replacement
      ? editor.owner.trim() &&
        /^\d{10}$/.test(editor.phone) &&
        normalize(editor.plate) &&
        !fieldErrors.plate &&
        (editor.type === "VIP" ||
          (editor.group &&
            (editor.group !== "Cư dân" || editor.apartment.trim()) &&
            (editor.group !== "Gian hàng" ||
              (editor.contract.trim() && editor.contractEnd >= today))))
      : editor.note.trim()) &&
    editor.effectiveFrom &&
    (!editor.expiry ? editor.type === "VIP" : !fieldErrors.expiry)
  const set = (key: keyof Editor, value: string) => {
    setEditor((old) =>
      old
        ? {
            ...old,
            [key]: value,
            ...(key === "parkKey" || key === "vehicle" ? { code: "" } : {}),
            ...(key === "type" && value === "VIP"
              ? { group: "", apartment: "", contract: "" }
              : {}),
          }
        : old,
    )
    setDirty(true)
    if (key === "parkKey") {
      setSelected([])
      setScanError("")
    }
  }
  function openEditor(kind: Editor["kind"], replace?: Subscription) {
    const selectedPark = replace
      ? parks.find((p) => {
          const c = state.cards.find((c) => c.id === replace.cardId)
          return p.estate === c?.estate && p.park === c?.park
        })
      : parks.find((p) => p.key === parkFilter)
    const c = replace ? state.cards.find((c) => c.id === replace.cardId) : null
    setEditor({
      kind,
      parkKey: selectedPark?.key || "",
      supplier: "",
      type:
        replace?.type ||
        (kind === "subscription" ? "Thuê bao tháng" : "Vãng lai"),
      vehicle: c?.vehicle || "Ô tô",
      owner: replace?.owner || "",
      phone: replace?.phone || "",
      plate: replace?.plate || "",
      group: replace?.group || "Cư dân",
      apartment: replace?.apartment || "",
      contract: replace?.contract || "",
      contractEnd: replace?.contractEnd || "2026-12-31",
      effectiveFrom: today,
      expiry:
        replace?.expiry && replace.expiry >= today
          ? replace.expiry
          : "2026-12-31",
      code: "",
      recipient: "",
      note: "",
      replacement: replace?.id || "",
    })
    setDirty(false)
    setImportRows([])
    setImportStage(0)
    setFileName("")
    setFileError("")
    setSelected([])
    setScan("")
    setScanError("")
    setReviewTab("all")
    setActionError("")
    window.scrollTo({ top: 0 })
  }
  const closeEditor = () => {
    if (dirty) setDiscard(true)
    else {
      setEditor(null)
      setDirty(false)
    }
  }
  const closeAction = () => {
    if (actionDirty) setDiscard(true)
    else setAction(null)
  }
  function commit(command: OperationAction, message: string) {
    try {
      const next = applyOperation(state, command)
      const keepEditor =
        !!editor && ["lock", "unlock", "incident"].includes(command.kind)
      setState(next)
      if (!keepEditor) {
        setEditor(null)
        setDirty(false)
      }
      setAction(null)
      setActionError("")
      setDetailId(null)
      setRecord(null)
      setPage(1)
      onNotify(message)
      return true
    } catch (e) {
      setActionError((e as Error).message)
      return false
    }
  }
  function openAction(
    kind: CardAction["kind"],
    card?: Card,
    incidentKind: Incident["kind"] = "Mất",
  ) {
    setDetailId(null)
    setActionError("")
    const draft: CardAction = {
      kind,
      cardId: card?.id || "",
      reason: "",
      checked: false,
      result: "",
      incidentKind,
      number: `BB-20261029-${String(state.incidents.length + 1).padStart(3, "0")}`,
      fee: card?.type === "Vãng lai" && incidentKind === "Mất" ? "50000" : "0",
      date: today,
    }
    initialAction.current = draft
    setAction(draft)
  }
  function saveAction() {
    if (!action || !actCard) return
    const incident: Incident = {
      id: action.number.trim(),
      cardId: actCard.id,
      kind: action.kind === "return" ? "Hỏng" : action.incidentKind,
      reason: action.reason.trim(),
      fee: Number(action.fee),
      date: action.date,
      fromReturn: action.kind === "return",
    }
    if (action.kind === "return")
      commit(
        {
          kind: "return",
          cardId: actCard.id,
          checked: action.checked,
          result: action.result,
          reason: action.reason,
          incident: action.result === "damaged" ? incident : undefined,
        },
        action.result === "pass"
          ? "Đã thu hồi thẻ đạt kiểm tra về đúng kho bãi."
          : "Đã thu hồi và lập biên bản hỏng. Thẻ không được đưa vào kho sẵn sàng cấp.",
      )
    else if (action.kind === "incident")
      commit(
        { kind: "incident", incident },
        "Đã lập biên bản và chuyển thẻ sang Mất / hỏng.",
      )
    else
      commit(
        { kind: action.kind, cardId: actCard.id, reason: action.reason },
        action.kind === "lock"
          ? "Đã khóa thẻ. Thẻ không được phép sử dụng."
          : "Đã mở khóa thẻ.",
      )
  }
  function checkRows(ids: string[]) {
    const seen = new Set<string>()
    return ids.map((id) => {
      const clean = id.trim(),
        code = normalize(clean)
      const error = !clean
        ? "Mã thẻ không được để trống"
        : clean.length > 255
          ? "Mã thẻ tối đa 255 ký tự"
          : state.cards.some((c) => normalize(c.id) === code)
            ? "Mã thẻ đã tồn tại trong hệ thống"
            : seen.has(code)
              ? "Trùng mã trong tệp tải lên"
              : ""
      seen.add(code)
      return { id: clean, error }
    })
  }
  async function readFile(file?: File) {
    if (!file) return
    setFileError("")
    setFileBusy(true)
    try {
      if (!/\.(xlsx|xls)$/i.test(file.name))
        throw new Error("Chỉ nhận tệp Excel XLSX hoặc XLS.")
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Tệp vượt quá dung lượng tối đa 10 MB.")
      const data = await file.arrayBuffer(),
        bytes = new Uint8Array(data)
      if (
        !(
          (bytes[0] === 0x50 && bytes[1] === 0x4b) ||
          (bytes[0] === 0xd0 && bytes[1] === 0xcf)
        )
      )
        throw new Error("Nội dung tệp không phải Excel hợp lệ.")
      const XLSX = await import("xlsx"),
        book = XLSX.read(data, { type: "array" })
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        book.Sheets[book.SheetNames[0]],
        { defval: "" },
      )
      if (!rows.length || !Object.keys(rows[0]).includes("Mã thẻ"))
        throw new Error("Tệp cần có cột “Mã thẻ” và ít nhất một dòng dữ liệu.")
      if (rows.length > 10000)
        throw new Error(
          "Mỗi lần nhập tối đa 10.000 mã thẻ. Vui lòng chia nhỏ tệp.",
        )
      setImportRows(checkRows(rows.map((r) => String(r["Mã thẻ"]))))
      setFileName(file.name)
      setDirty(true)
    } catch (e) {
      setImportRows([])
      setFileName("")
      setFileError((e as Error).message)
    } finally {
      setFileBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }
  async function workbook(name: string, rows: Record<string, unknown>[]) {
    const XLSX = await import("xlsx")
    const clean = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k,
          typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v,
        ]),
      ),
    )
    const book = XLSX.utils.book_new(),
      sheet = XLSX.utils.json_to_sheet(clean)
    sheet["!cols"] = Object.keys(clean[0] || {}).map(() => ({ wch: 25 }))
    XLSX.utils.book_append_sheet(book, sheet, "DuLieu")
    XLSX.writeFile(book, `VParking_${name}_20261029.xlsx`)
  }
  function addScanned() {
    const ids = scan
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!ids.length) {
      setScanError("Vui lòng quét hoặc nhập mã thẻ.")
      return
    }
    const found = ids.map((id) =>
      candidates.find((c) => normalize(c.id) === normalize(id)),
    )
    if (found.some((c) => !c)) {
      setScanError(
        "Có mã không phải thẻ vãng lai trong kho của bãi đã chọn. Chưa thêm thẻ nào.",
      )
      return
    }
    if (
      new Set(ids.map(normalize)).size !== ids.length ||
      found.some((c) => selected.includes(c!.id))
    ) {
      setScanError("Danh sách có thẻ trùng hoặc đã được chọn.")
      return
    }
    setSelected((old) => [...old, ...found.map((c) => c!.id)])
    setScan("")
    setScanError("")
    setDirty(true)
  }
  function saveEditor() {
    if (!editor || !park) return
    setActionError("")
    if (editor.kind === "import") {
      const ids = importRows.filter((r) => !r.error).map((r) => r.id)
      commit(
        {
          kind: "import",
          lot: {
            id: `LO-20261029-${String(state.lots.length + 1).padStart(3, "0")}`,
            estate: park.estate,
            park: park.park,
            supplier: editor.supplier.trim(),
            date: today,
            ids,
          },
          type: editor.type,
          vehicle: editor.vehicle,
        },
        `Đã nhập ${ids.length} thẻ hợp lệ vào kho ${park.park}.`,
      )
    } else if (editor.kind === "handoff") {
      commit(
        {
          kind: "handoff",
          handoff: {
            id: `BG-20261029-${String(state.handoffs.length + 1).padStart(3, "0")}`,
            estate: park.estate,
            park: park.park,
            recipient: editor.recipient.trim(),
            ids: selected,
            date: today,
            note: editor.note.trim(),
          },
        },
        `Đã bàn giao ${selected.length} thẻ vãng lai. Trạng thái thẻ chuyển sang Đang hoạt động.`,
      )
    } else {
      if (!canActivate || !chosen) return
      const sub: Subscription = {
        id:
          editor.replacement || `TB-20261029-${state.subscriptions.length + 1}`,
        cardId: chosen.id,
        owner: editor.owner,
        phone: editor.phone,
        plate: editor.plate,
        type: editor.type,
        group: editor.group,
        apartment: editor.apartment,
        contract: editor.contract,
        contractEnd: editor.contractEnd,
        effectiveFrom: editor.effectiveFrom,
        expiry: editor.expiry,
        ended: false,
      }
      commit(
        {
          kind: "activate",
          subscription: sub,
          park: park.park,
          vehicle: editor.vehicle,
          replacement: !!editor.replacement,
          reason: editor.note,
        },
        editor.replacement
          ? "Đã cấp lại thẻ và giữ nguyên thông tin thuê bao."
          : "Đã đăng ký thuê bao và kích hoạt thẻ.",
      )
    }
  }
  const q = normalize(query)
  const visibleCards = scope.filter(
    (c) =>
      (!statusFilter || c.status === statusFilter) &&
      (!typeFilter || c.type === typeFilter) &&
      (!vehicleFilter || c.vehicle === vehicleFilter) &&
      (!q ||
        [c.id, c.owner, c.plate, c.subscription, c.batch].some((v) =>
          normalize(v).includes(q),
        )),
  )
  const subRows = state.subscriptions.filter(
    (s) =>
      scope.some((c) => c.id === s.cardId) &&
      (!typeFilter || s.type === typeFilter) &&
      (!q ||
        [s.id, s.owner, s.plate, s.cardId].some((v) =>
          normalize(v).includes(q),
        )),
  )
  const scopedRecords = (list: (Lot | Handoff)[]) =>
    list.filter(
      (r) =>
        (!filteredPark ||
          (r.estate === filteredPark.estate && r.park === filteredPark.park)) &&
        (!q ||
          normalize(
            [r.id, "supplier" in r ? r.supplier : r.recipient, r.park].join(
              " ",
            ),
          ).includes(q)),
    )
  const incidentRows = state.incidents.filter(
    (r) =>
      scope.some((c) => c.id === r.cardId) &&
      (!q || normalize(`${r.id} ${r.cardId} ${r.reason}`).includes(q)),
  )
  const overviewCards = visibleCards
  const warehouseRows = parks
    .filter((park) => !parkFilter || park.key === parkFilter)
    .map((park) => {
      const cards = overviewCards.filter(
        (card) => card.estate === park.estate && card.park === park.park,
      )
      return {
        ...park,
        total: cards.length,
        counts: cardStatuses.map(
          (status) => cards.filter((card) => card.status === status).length,
        ),
      }
    })
  const currentCount = isCardList
    ? visibleCards.length
    : screen === "subscriptions"
      ? subRows.length
      : screen === "imports"
        ? scopedRecords(state.lots).length
        : screen === "handoffs"
          ? scopedRecords(state.handoffs).length
          : incidentRows.length
  const lastPage = Math.max(1, Math.ceil(currentCount / size))
  useEffect(() => {
    setPage((p) => Math.min(p, lastPage))
  }, [lastPage])
  if (!screen || !section) return null
  const slice = <T,>(rows: T[]) => rows.slice((page - 1) * size, page * size)
  const badge = (c: Card) => (
    <Badge tone={statusTone(c.status)}>{c.status}</Badge>
  )
  const cardLink = (c: Card) => (
    <Button
      variant="link"
      className="card-id"
      onClick={() => {
        setDetailId(c.id)
        setDetailTab("Thông tin thẻ")
      }}
    >
      {c.id}
    </Button>
  )
  const title = editor
    ? editor.kind === "import"
      ? "Nhập kho thẻ theo lô"
      : editor.kind === "handoff"
        ? "Giao thẻ cho bàn thẻ"
        : editor.replacement
          ? "Cấp lại thẻ"
          : "Đăng ký & kích hoạt thẻ"
    : section.title
  const parkField = (
    <Field label="Kho bãi nhận" required>
      <Select
        aria-label="Kho bãi nhận"
        value={editor?.parkKey || ""}
        onChange={(e) => set("parkKey", e.target.value)}
        options={[
          { value: "", label: "Chọn bãi xe nhận thẻ" },
          ...parks.map((p) => ({ value: p.key, label: p.label })),
        ]}
      />
    </Field>
  )
  const noteField = (
    <Field
      label={editor?.replacement ? "Lý do cấp lại" : "Ghi chú"}
      required={!!editor?.replacement}
    >
      <Textarea
        maxLength={500}
        rows={3}
        value={editor?.note || ""}
        onChange={(e) => set("note", e.target.value)}
        placeholder="Nhập thông tin cần ghi nhận…"
      />
      <span className="character-count">{editor?.note.length || 0}/500</span>
    </Field>
  )
  const empty = (
    <div className="empty-state">
      <div className="empty-icon">
        <Search size={25} />
      </div>
      <Heading level={3}>Không có kết quả phù hợp</Heading>
      <span className="muted">Thử thay đổi từ khóa hoặc điều kiện lọc.</span>
      <Button
        onClick={() => {
          setSearch("")
          setParkFilter("")
          setStatusFilter("")
          setTypeFilter("")
          setVehicleFilter("")
        }}
      >
        Xóa bộ lọc
      </Button>
    </div>
  )
  const parkFilterControl = (
    <Select
      aria-label="Lọc kho bãi"
      value={parkFilter}
      onChange={(e) => {
        setParkFilter(e.target.value)
        setPage(1)
      }}
      options={[
        { value: "", label: "Tất cả kho bãi" },
        ...parks.map((p) => ({ value: p.key, label: p.label })),
      ]}
    />
  )
  const footer = (
    <div className="pagination">
      <span className="muted">
        {currentCount
          ? `${fmt((page - 1) * size + 1)}–${fmt(Math.min(page * size, currentCount))} trên ${fmt(currentCount)}`
          : "0 kết quả"}
      </span>
      <div className="pagination-controls">
        <Button
          variant="ghost"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          aria-label="Trang trước"
        >
          <ChevronLeft size={15} />
        </Button>
        <Button variant="ghost" className="page-selected">
          {page}
        </Button>
        <Button
          variant="ghost"
          disabled={page >= lastPage}
          onClick={() => setPage(page + 1)}
          aria-label="Trang sau"
        >
          <ChevronRight size={15} />
        </Button>
        <Select
          aria-label="Số dòng mỗi trang"
          value={size}
          onChange={(e) => {
            setSize(Number(e.target.value))
            setPage(1)
          }}
          options={[20, 50, 100].map((n) => ({
            value: `${n}`,
            label: `${n} / trang`,
          }))}
        />
      </div>
    </div>
  )
  const editTitle =
    editor?.kind === "subscription"
      ? editor.replacement
        ? "Kích hoạt thẻ thay thế"
        : "Kích hoạt thẻ"
      : editor?.kind === "handoff"
        ? `Xác nhận giao ${selected.length} thẻ`
        : `Nhập ${importRows.filter((r) => !r.error).length} thẻ hợp lệ`
  const cardActionValid =
    !!action &&
    !!actCard &&
    !!action.reason.trim() &&
    (action.kind !== "return" || (action.checked && action.result)) &&
    (!(
      action.kind === "incident" ||
      (action.kind === "return" && action.result === "damaged")
    ) ||
      (action.number.trim() &&
        action.date &&
        action.date <= today &&
        Number.isInteger(Number(action.fee)) &&
        Number(action.fee) >= 0 &&
        Number(action.fee) <= 1000000000))
  return (
    <div className="operations">
      <div className="breadcrumbs">
        <span>{section.group}</span>
        <ChevronRight size={12} />
        <span className="current-crumb">{editor ? section.title : title}</span>
        {editor && (
          <>
            <ChevronRight size={12} />
            <span className="current-crumb">{title}</span>
          </>
        )}
      </div>
      <div className="page-heading">
        <div>
          <div className="heading-line">
            {editor && (
              <Button
                variant="ghost"
                onClick={closeEditor}
                aria-label="Quay lại danh sách"
              >
                <ArrowLeft size={20} />
              </Button>
            )}
            <Heading level={1}>{title}</Heading>
          </div>
          <div className="page-description">
            {editor
              ? "Hoàn tất các trường bắt buộc trước khi xác nhận. Mọi thao tác được ghi vào lịch sử thẻ."
              : section.description}
          </div>
        </div>
        {!editor && (
          <div className="op-heading-actions">
            <Button
              onClick={() =>
                workbook(
                  screen,
                  isCardList
                    ? visibleCards.map((c) => ({
                        "Mã thẻ": c.id,
                        "Kho bãi": c.park,
                        "Loại thẻ": c.type,
                        "Phương tiện": c.vehicle,
                        "Chủ thẻ": c.owner,
                        "Biển số": c.plate,
                        "Trạng thái": c.status,
                      }))
                    : screen === "incidents"
                      ? incidentRows.map((i) => ({
                          "Số biên bản": i.id,
                          "Mã thẻ": i.cardId,
                          Loại: i.kind,
                          "Số tiền": i.fee,
                          "Lý do": i.reason,
                          Ngày: date(i.date),
                        }))
                      : screen === "subscriptions"
                        ? subRows.map((s) => ({
                            "Mã thuê bao": s.id,
                            "Chủ thẻ": s.owner,
                            "Mã thẻ": s.cardId,
                            SĐT: maskedPhone(s.phone),
                            "Biển số": s.plate,
                          }))
                        : scopedRecords(
                            screen === "imports" ? state.lots : state.handoffs,
                          ).map((r) => ({
                            "Mã phiếu": r.id,
                            "Bãi xe": r.park,
                            Ngày: date(r.date),
                            "Số thẻ": r.ids.length,
                          })),
                )
              }
            >
              <Download size={15} />
              Xuất danh sách
            </Button>
            {screen !== "inventory" && screen !== "lookup" && (
              <Button
                variant="primary"
                onClick={() =>
                  screen === "incidents"
                    ? openAction("incident")
                    : openEditor(
                        screen === "imports"
                          ? "import"
                          : screen === "subscriptions"
                            ? "subscription"
                            : "handoff",
                      )
                }
              >
                <Plus size={15} />
                {screen === "imports"
                  ? "Nhập kho"
                  : screen === "subscriptions"
                    ? "Đăng ký thuê bao / VIP"
                    : screen === "handoffs"
                      ? "Tạo phiếu giao"
                      : "Lập biên bản"}
              </Button>
            )}
          </div>
        )}
      </div>
      {!editor ? (
        <>
          {screen === "inventory" && (
            <>
              <div className="settings-info">
                <Warehouse size={17} />
                <span>
                  Trạng thái vận hành hiện tại theo bộ lọc. Chỉ thẻ{" "}
                  <strong>Trong kho</strong> sẵn sàng cấp phát; thẻ đang hoạt
                  động, khóa và mất / hỏng không được tính vào tồn kho. Số liệu
                  này không phải số chốt cuối kỳ báo cáo.
                </span>
              </div>
              <div className="summary-grid warehouse-summary">
                {cardStatuses.map((status, i) => (
                  <div
                    className={`summary-card ${
                      i === 3 ? "summary-warning" : ""
                    }`}
                    key={status}
                  >
                    <div className="summary-top">
                      <span>{status}</span>
                      <span className="summary-icon">
                        {
                          [
                            <Package size={19} />,
                            <CreditCard size={19} />,
                            <LockKeyhole size={19} />,
                            <TriangleAlert size={19} />,
                          ][i]
                        }
                      </span>
                    </div>
                    <div className="summary-value">
                      {fmt(
                        overviewCards.filter((card) => card.status === status)
                          .length,
                      )}
                      <span className="summary-unit">thẻ</span>
                    </div>
                    <div className="summary-sub">
                      {
                        [
                          "Sẵn sàng cấp từ kho bãi",
                          "Thẻ đã cấp, đang sử dụng",
                          "Tạm ngừng sử dụng",
                          "Có biên bản, không tái sử dụng",
                        ][i]
                      }
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {screen === "handoffs" && (
            <div className="settings-info">
              <Info size={17} />
              <span>
                Giao thẻ cho bàn thẻ là cấp phát từ kho bãi. Việc phát thẻ cho
                khách ở làn vào và nhận lại ở làn ra không làm thay đổi trạng
                thái thẻ.
              </span>
            </div>
          )}
          {screen === "incidents" && (
            <div className="settings-info">
              <ShieldCheck size={17} />
              <span>
                Biên bản mất / hỏng là kết thúc vòng đời thẻ. Với thẻ thuê bao /
                VIP bị mất, cần khóa thẻ trước khi lập biên bản.
              </span>
            </div>
          )}
          <section className="panel">
            <div className="op-table-toolbar">
              <div className="search-box">
                <Search size={16} />
                <Input
                  aria-label="Tìm kiếm nghiệp vụ"
                  maxLength={100}
                  placeholder={
                    isCardList
                      ? "Mã thẻ, chủ thẻ, biển số, mã thuê bao…"
                      : "Tìm mã, tên hoặc số biên bản…"
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <Button
                    variant="ghost"
                    aria-label="Xóa tìm kiếm"
                    onClick={() => setSearch("")}
                  >
                    <X size={14} />
                  </Button>
                )}
              </div>
              <div className="op-list-filters">
                {parkFilterControl}
                {isCardList && (
                  <Select
                    aria-label="Lọc trạng thái thẻ"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value)
                      setPage(1)
                    }}
                    options={[
                      { value: "", label: "Tất cả trạng thái" },
                      ...cardStatuses,
                    ]}
                  />
                )}
                {(isCardList || screen === "subscriptions") && (
                  <Select
                    aria-label="Lọc loại thẻ"
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value)
                      setPage(1)
                    }}
                    options={[
                      { value: "", label: "Tất cả loại thẻ" },
                      ...cardTypes.filter(
                        (t) => screen !== "subscriptions" || t !== "Vãng lai",
                      ),
                    ]}
                  />
                )}
                {isCardList && (
                  <Select
                    aria-label="Lọc phương tiện thẻ"
                    value={vehicleFilter}
                    onChange={(e) => {
                      setVehicleFilter(e.target.value)
                      setPage(1)
                    }}
                    options={[
                      { value: "", label: "Tất cả phương tiện" },
                      ...vehicles,
                    ]}
                  />
                )}
              </div>
            </div>
            {screen === "inventory" && (
              <>
                <div className="panel-heading warehouse-overview-heading">
                  <div>
                    <Heading>Tổng quan theo kho bãi</Heading>
                    <span className="muted">
                      Số thẻ theo bộ lọc hiện tại · Bao gồm bãi chưa có thẻ
                    </span>
                  </div>
                  <span className="unit-label">Đơn vị: thẻ</span>
                </div>
                <div className="table-scroll">
                  <table className="data-table op-table warehouse-table">
                    <thead>
                      <tr>
                        {[
                          "Kho bãi",
                          "Tổng số thẻ",
                          ...cardStatuses,
                          "Thao tác",
                        ].map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {warehouseRows.map((row) => (
                        <tr key={row.key}>
                          <td>
                            {row.park}
                            <span className="estate-code">
                              {
                                estates.find(
                                  (estate) => estate.id === row.estate,
                                )?.short
                              }
                            </span>
                          </td>
                          <td>
                            <strong>{fmt(row.total)}</strong>
                          </td>
                          {row.counts.map((count, index) => (
                            <td
                              key={index}
                              className={index === 0 ? "warehouse-ready" : ""}
                            >
                              {fmt(count)}
                            </td>
                          ))}
                          <td>
                            <Button
                              variant="link"
                              aria-label={`Xem thẻ tại ${row.label}`}
                              onClick={() => {
                                setParkFilter(row.key)
                                setPage(1)
                                onLookup()
                                window.scrollTo({ top: 0 })
                              }}
                            >
                              Xem thẻ <ArrowRight size={13} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {screen !== "inventory" &&
              (currentCount ? (
                <div className="table-scroll">
                  <table className="data-table op-table">
                    <thead>
                      <tr>
                        {(isCardList
                          ? [
                              "Mã thẻ",
                              "Kho bãi",
                              "Loại thẻ",
                              "Phương tiện",
                              "Chủ thẻ",
                              "Biển số",
                              "Trạng thái",
                              "Thao tác",
                            ]
                          : screen === "imports"
                            ? [
                                "Mã lô nhập",
                                "Kho bãi nhận",
                                "Nhà cung cấp",
                                "Số thẻ",
                                "Ngày nhập",
                                "Người nhập",
                                "",
                              ]
                            : screen === "subscriptions"
                              ? [
                                  "Mã thuê bao",
                                  "Khách hàng",
                                  "Loại thẻ",
                                  "Biển số",
                                  "Mã thẻ hiện tại",
                                  "Kho bãi",
                                  "Hiệu lực đến",
                                  "Tình trạng",
                                  "",
                                ]
                              : screen === "handoffs"
                                ? [
                                    "Mã phiếu giao",
                                    "Bãi nhận",
                                    "Người nhận tại bàn thẻ",
                                    "Số thẻ",
                                    "Ngày giao",
                                    "Người giao",
                                    "",
                                  ]
                                : [
                                    "Số biên bản",
                                    "Mã thẻ",
                                    "Kho bãi",
                                    "Loại biên bản",
                                    "Khoản thu",
                                    "Ngày lập",
                                    "Người lập",
                                    "",
                                  ]
                        ).map((h, i) => (
                          <th key={i}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {isCardList
                        ? slice(visibleCards).map((c) => (
                            <tr key={c.id}>
                              <td>
                                {cardLink(c)}
                                <span className="estate-code">{c.batch}</span>
                              </td>
                              <td>
                                {c.park}
                                <span className="estate-code">
                                  {
                                    estates.find((e) => e.id === c.estate)
                                      ?.short
                                  }
                                </span>
                              </td>
                              <td>
                                <span
                                  className={
                                    c.type === "VIP" ? "vip-label" : ""
                                  }
                                >
                                  {c.type}
                                </span>
                              </td>
                              <td>{c.vehicle}</td>
                              <td>{c.owner}</td>
                              <td>{c.plate}</td>
                              <td>{badge(c)}</td>
                              <td>
                                <div className="op-row-actions">
                                  <Button
                                    variant="ghost"
                                    aria-label={`Chi tiết ${c.id}`}
                                    onClick={() => {
                                      setDetailId(c.id)
                                      setDetailTab("Thông tin thẻ")
                                    }}
                                  >
                                    <ChevronRight size={15} />
                                  </Button>
                                  {c.status === "Đang hoạt động" && (
                                    <Button
                                      variant="ghost"
                                      title="Khóa thẻ"
                                      aria-label={`Khóa ${c.id}`}
                                      onClick={() => openAction("lock", c)}
                                    >
                                      <LockKeyhole size={14} />
                                    </Button>
                                  )}
                                  {c.status === "Khóa" && (
                                    <Button
                                      variant="ghost"
                                      title="Mở khóa"
                                      aria-label={`Mở khóa ${c.id}`}
                                      onClick={() => openAction("unlock", c)}
                                    >
                                      <UnlockKeyhole size={14} />
                                    </Button>
                                  )}
                                  {["Đang hoạt động", "Khóa"].includes(
                                    c.status,
                                  ) && (
                                    <Button
                                      variant="ghost"
                                      className="return-card-button"
                                      onClick={() => openAction("return", c)}
                                    >
                                      Thu hồi
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        : screen === "subscriptions"
                          ? slice(subRows).map((s) => {
                              const c = state.cards.find(
                                (c) => c.id === s.cardId,
                              )!
                              return (
                                <tr key={s.id}>
                                  <td>
                                    <span className="op-code">{s.id}</span>
                                  </td>
                                  <td>
                                    <strong>{s.owner}</strong>
                                    <span className="estate-code">
                                      {maskedPhone(s.phone)} ·{" "}
                                      {s.type === "VIP" ? "VIP" : s.group}
                                    </span>
                                  </td>
                                  <td>{s.type}</td>
                                  <td>{s.plate}</td>
                                  <td>{cardLink(c)}</td>
                                  <td>{c.park}</td>
                                  <td>{date(s.expiry)}</td>
                                  <td>
                                    {s.ended ? (
                                      <Badge>Đã kết thúc</Badge>
                                    ) : (
                                      badge(c)
                                    )}
                                  </td>
                                  <td>
                                    <Button
                                      variant="ghost"
                                      onClick={() =>
                                        openEditor("subscription", s)
                                      }
                                      disabled={s.ended}
                                      title={
                                        s.ended
                                          ? "Thuê bao đã ngừng sử dụng"
                                          : "Chọn thẻ trong kho để thay thế"
                                      }
                                    >
                                      Cấp lại thẻ
                                      <ChevronRight size={13} />
                                    </Button>
                                  </td>
                                </tr>
                              )
                            })
                          : screen === "imports"
                            ? slice(scopedRecords(state.lots) as Lot[]).map(
                                (l) => (
                                  <tr key={l.id}>
                                    <td>
                                      <Button
                                        variant="link"
                                        className="op-code"
                                        onClick={() =>
                                          setRecord({ kind: "lot", id: l.id })
                                        }
                                      >
                                        {l.id}
                                      </Button>
                                    </td>
                                    <td>
                                      {l.park}
                                      <span className="estate-code">
                                        {
                                          estates.find((e) => e.id === l.estate)
                                            ?.short
                                        }
                                      </span>
                                    </td>
                                    <td>{l.supplier}</td>
                                    <td>
                                      <strong>{fmt(l.ids.length)}</strong> thẻ
                                    </td>
                                    <td>{date(l.date)}</td>
                                    <td>Admin Local</td>
                                    <td>
                                      <Button
                                        variant="ghost"
                                        aria-label={`Chi tiết lô ${l.id}`}
                                        onClick={() =>
                                          setRecord({ kind: "lot", id: l.id })
                                        }
                                      >
                                        <ChevronRight size={15} />
                                      </Button>
                                    </td>
                                  </tr>
                                ),
                              )
                            : screen === "handoffs"
                              ? slice(
                                  scopedRecords(state.handoffs) as Handoff[],
                                ).map((h) => (
                                  <tr key={h.id}>
                                    <td>
                                      <Button
                                        variant="link"
                                        className="op-code"
                                        onClick={() =>
                                          setRecord({
                                            kind: "handoff",
                                            id: h.id,
                                          })
                                        }
                                      >
                                        {h.id}
                                      </Button>
                                    </td>
                                    <td>{h.park}</td>
                                    <td>{h.recipient}</td>
                                    <td>
                                      <strong>{h.ids.length}</strong> thẻ
                                    </td>
                                    <td>{date(h.date)}</td>
                                    <td>Admin Local</td>
                                    <td>
                                      <Button
                                        variant="ghost"
                                        aria-label={`Chi tiết phiếu ${h.id}`}
                                        onClick={() =>
                                          setRecord({
                                            kind: "handoff",
                                            id: h.id,
                                          })
                                        }
                                      >
                                        <ChevronRight size={15} />
                                      </Button>
                                    </td>
                                  </tr>
                                ))
                              : slice(incidentRows).map((r) => {
                                  const c = state.cards.find(
                                    (c) => c.id === r.cardId,
                                  )!
                                  return (
                                    <tr key={r.id}>
                                      <td>
                                        <Button
                                          variant="link"
                                          className="op-code"
                                          onClick={() =>
                                            setRecord({
                                              kind: "incident",
                                              id: r.id,
                                            })
                                          }
                                        >
                                          {r.id}
                                        </Button>
                                      </td>
                                      <td>{cardLink(c)}</td>
                                      <td>{c.park}</td>
                                      <td>
                                        <Badge
                                          tone={
                                            r.kind === "Mất" ? "red" : "amber"
                                          }
                                        >
                                          {r.kind === "Mất"
                                            ? "Mất thẻ"
                                            : "Thẻ hỏng"}
                                        </Badge>
                                      </td>
                                      <td>{fmt(r.fee)} ₫</td>
                                      <td>{date(r.date)}</td>
                                      <td>Admin Local</td>
                                      <td>
                                        <Button
                                          variant="ghost"
                                          aria-label={`Chi tiết biên bản ${r.id}`}
                                          onClick={() =>
                                            setRecord({
                                              kind: "incident",
                                              id: r.id,
                                            })
                                          }
                                        >
                                          <ChevronRight size={15} />
                                        </Button>
                                      </td>
                                    </tr>
                                  )
                                })}
                    </tbody>
                  </table>
                </div>
              ) : (
                empty
              ))}
            {screen !== "inventory" && footer}
          </section>
          {screen === "lookup" && (
            <div className="under-table-note">
              <FileCheck2 size={14} />
              Thu hồi phải kiểm tra vật lý: thẻ đạt về đúng kho bãi; thẻ hỏng
              lập biên bản ngay.
            </div>
          )}
        </>
      ) : (
        <div ref={formRef}>
          <Form
            onSubmit={(e) => {
              e.preventDefault()
              if (editor.kind !== "import" || importStage === 1) saveEditor()
            }}
            id="op-editor"
          >
            {editor.kind === "import" ? (
              <>
                <div className="op-stepper">
                  <span className={importStage === 0 ? "current" : "done"}>
                    <span>{importStage ? <Check size={13} /> : "1"}</span>Thông
                    tin & tệp nhập
                  </span>
                  <span className="step-line" />
                  <span className={importStage === 1 ? "current" : ""}>
                    <span>2</span>Kiểm tra & xác nhận
                  </span>
                </div>
                {importStage === 0 ? (
                  <>
                    <section className="panel op-form-section">
                      <div className="op-section-aside">
                        <span className="op-section-icon">
                          <Warehouse size={20} />
                        </span>
                        <Heading level={3}>Thông tin lô nhập</Heading>
                        <p>
                          Thẻ được nhập trực tiếp vào kho của bãi nhận, ở trạng
                          thái Trong kho.
                        </p>
                      </div>
                      <div className="op-field-grid">
                        {parkField}
                        <Field label="Nhà cung cấp" required>
                          <Input
                            maxLength={255}
                            value={editor.supplier}
                            onChange={(e) => set("supplier", e.target.value)}
                            placeholder="Tên nhà cung cấp thẻ"
                          />
                        </Field>
                        <Field label="Loại thẻ">
                          <Select
                            value={editor.type}
                            onChange={(e) => set("type", e.target.value)}
                            options={cardTypes}
                          />
                        </Field>
                        <Field label="Loại phương tiện">
                          <Select
                            value={editor.vehicle}
                            onChange={(e) => set("vehicle", e.target.value)}
                            options={vehicles}
                          />
                        </Field>
                      </div>
                    </section>
                    <section className="panel op-form-section">
                      <div className="op-section-aside">
                        <span className="op-section-icon">
                          <FileSpreadsheet size={20} />
                        </span>
                        <Heading level={3}>Danh sách mã thẻ</Heading>
                        <p>
                          Mã thẻ phải duy nhất trong hệ thống. Tệp mẫu gồm một
                          cột “Mã thẻ”.
                        </p>
                      </div>
                      <div className="op-upload-section">
                        <div
                          className="op-dropzone"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault()
                            readFile(e.dataTransfer.files[0])
                          }}
                        >
                          <span className="op-upload-icon">
                            <Upload size={25} />
                          </span>
                          <Heading level={3}>
                            {fileBusy
                              ? "Đang kiểm tra tệp…"
                              : fileName || "Kéo thả tệp Excel vào đây"}
                          </Heading>
                          <span className="muted">
                            {fileName
                              ? `${importRows.length} dòng đã đọc · Sẵn sàng kiểm tra`
                              : "Định dạng .xlsx, .xls · Tối đa 10 MB"}
                          </span>
                          <Button
                            disabled={fileBusy}
                            onClick={() => fileRef.current?.click()}
                          >
                            <Upload size={14} />
                            {fileName ? "Chọn tệp khác" : "Chọn tệp"}
                          </Button>
                          <Input
                            ref={fileRef}
                            type="file"
                            accept=".xlsx,.xls"
                            aria-label="Tệp danh sách thẻ"
                            className="op-file-input"
                            onChange={(e) => readFile(e.target.files?.[0])}
                          />
                        </div>
                        {fileError && (
                          <span className="op-error" role="alert">
                            {fileError}
                          </span>
                        )}
                        <div className="op-upload-links">
                          <Button
                            variant="link"
                            onClick={() =>
                              workbook("MauNhapKho", [
                                { "Mã thẻ": "THE-NEW-0001" },
                                { "Mã thẻ": "THE-NEW-0002" },
                              ])
                            }
                          >
                            <Download size={13} />
                            Tải tệp mẫu
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setImportRows(
                                checkRows([
                                  "DEMO-NEW-1001",
                                  "DEMO-NEW-1002",
                                  state.cards[0].id,
                                  "DEMO-NEW-1002",
                                ]),
                              )
                              setFileName("Danh_sach_the_minh_hoa.xlsx")
                              setDirty(true)
                              setFileError("")
                            }}
                          >
                            Dùng dữ liệu minh họa
                          </Button>
                        </div>
                      </div>
                    </section>
                  </>
                ) : (
                  <section className="panel op-review">
                    <div className="panel-heading">
                      <div>
                        <Heading>Kết quả kiểm tra tệp dữ liệu</Heading>
                        <span className="muted">
                          {fileName} · {park?.label} · {editor.supplier}
                        </span>
                      </div>
                      <Button onClick={() => setImportStage(0)}>
                        <ArrowLeft size={14} />
                        Chọn lại tệp
                      </Button>
                    </div>
                    <div className="op-validation-grid">
                      <div>
                        <span>Tổng số dòng</span>
                        <strong>{importRows.length}</strong>
                      </div>
                      <div className="validation-green">
                        <span>Hợp lệ · Sẵn sàng nhập</span>
                        <strong>
                          {importRows.filter((r) => !r.error).length}
                        </strong>
                      </div>
                      <div className="validation-red">
                        <span>Lỗi dữ liệu · Không nhập</span>
                        <strong>
                          {importRows.filter((r) => r.error).length}
                        </strong>
                      </div>
                    </div>
                    <div className="op-inline-note">
                      <Info size={16} />
                      Chỉ các dòng hợp lệ được nhập kho. Các dòng lỗi sẽ không
                      được tạo thẻ.
                      <Button
                        variant="link"
                        onClick={() =>
                          workbook(
                            "LoiNhapKho",
                            importRows
                              .map((r, i) => ({ ...r, index: i + 1 }))
                              .filter((r) => r.error)
                              .map((r) => ({
                                STT: r.index,
                                "Mã thẻ": r.id,
                                Lỗi: r.error,
                              })),
                          )
                        }
                      >
                        Tải danh sách lỗi
                        <Download size={13} />
                      </Button>
                    </div>
                    <div className="op-review-tabs">
                      {[
                        ["all", "Tất cả"],
                        ["valid", "Hợp lệ"],
                        ["error", "Lỗi dữ liệu"],
                      ].map(([id, name]) => (
                        <Button
                          variant="ghost"
                          className={reviewTab === id ? "selected" : ""}
                          key={id}
                          onClick={() => setReviewTab(id)}
                        >
                          {name}
                        </Button>
                      ))}
                    </div>
                    <div className="table-scroll op-review-table">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>STT</th>
                            <th>Mã thẻ</th>
                            <th>Kiểm tra</th>
                            <th>Chi tiết phân tích</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importRows
                            .map((r, i) => ({ ...r, index: i + 1 }))
                            .filter(
                              (r) =>
                                reviewTab === "all" ||
                                (reviewTab === "valid" ? !r.error : r.error),
                            )
                            .map((r) => (
                              <tr key={r.index}>
                                <td>{r.index}</td>
                                <td>{r.id || "—"}</td>
                                <td>
                                  <Badge tone={r.error ? "red" : "green"}>
                                    {r.error ? "Lỗi dữ liệu" : "Hợp lệ"}
                                  </Badge>
                                </td>
                                <td className={r.error ? "text-red" : "muted"}>
                                  {r.error ||
                                    "Mã thẻ duy nhất, đủ điều kiện nhập kho"}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            ) : editor.kind === "subscription" ? (
              <>
                {subscription && (
                  <div
                    className={`op-rule ${
                      replacementReady ? "" : "op-rule-danger"
                    }`}
                  >
                    <Info size={17} />
                    <div>
                      <strong>
                        Thẻ hiện tại: {subscription.cardId} ·{" "}
                        {originalCard?.status}
                      </strong>
                      <div>
                        {replacementReady
                          ? "Thẻ cũ đã được xử lý. Chọn một thẻ trong kho của đúng bãi để cấp lại."
                          : "Cần thu hồi hoặc xử lý mất / hỏng thẻ cũ trước khi cấp lại. Không gắn đồng thời hai thẻ cho một thuê bao."}
                      </div>
                    </div>
                    {originalCard && !replacementReady && (
                      <Button
                        onClick={() =>
                          openAction(
                            originalCard.status === "Đang hoạt động"
                              ? "lock"
                              : "incident",
                            originalCard,
                          )
                        }
                      >
                        {originalCard.status === "Đang hoạt động"
                          ? "Khóa thẻ cũ"
                          : "Lập biên bản"}
                      </Button>
                    )}
                  </div>
                )}
                <section className="panel op-form-section">
                  <div className="op-section-aside">
                    <span className="op-section-icon">
                      <CreditCard size={20} />
                    </span>
                    <Heading level={3}>Thông tin thuê bao</Heading>
                    <p>
                      {subscription
                        ? "Giữ nguyên thông tin khách và thuê bao khi cấp lại thẻ."
                        : "Thông tin khách hàng và phương tiện đăng ký sử dụng thẻ."}
                    </p>
                  </div>
                  <div className="op-field-grid">
                    <Field label="Loại thẻ" required>
                      <Select
                        disabled={!!subscription}
                        value={editor.type}
                        onChange={(e) => set("type", e.target.value)}
                        options={["Thuê bao tháng", "VIP"]}
                      />
                    </Field>
                    <Field label="Tên khách hàng" required>
                      <Input
                        disabled={!!subscription}
                        maxLength={255}
                        value={editor.owner}
                        onChange={(e) => set("owner", e.target.value)}
                        placeholder="Nhập họ và tên"
                      />
                    </Field>
                    <Field
                      label="Số điện thoại"
                      required
                      error={fieldErrors.phone}
                    >
                      <Input
                        disabled={!!subscription}
                        maxLength={10}
                        inputMode="numeric"
                        value={editor.phone}
                        onChange={(e) => set("phone", e.target.value)}
                        placeholder="Ví dụ: 0901234567"
                      />
                    </Field>
                    <Field
                      label={
                        editor.type === "VIP"
                          ? "Biển số đại diện"
                          : "Biển số đăng ký"
                      }
                      required
                      error={fieldErrors.plate}
                    >
                      <Input
                        disabled={!!subscription}
                        maxLength={32}
                        value={editor.plate}
                        onChange={(e) => set("plate", e.target.value)}
                        placeholder="Ví dụ: 30A-123.45"
                      />
                    </Field>
                    {editor.type !== "VIP" && (
                      <>
                        <Field label="Nhóm khách hàng" required>
                          <Select
                            disabled={!!subscription}
                            value={editor.group}
                            onChange={(e) => set("group", e.target.value)}
                            options={customerGroups}
                          />
                        </Field>
                        {editor.group === "Cư dân" && (
                          <Field label="Căn hộ" required>
                            <Input
                              disabled={!!subscription}
                              maxLength={255}
                              value={editor.apartment}
                              onChange={(e) => set("apartment", e.target.value)}
                              placeholder="Ví dụ: S1.01-1205"
                            />
                          </Field>
                        )}
                        {editor.group === "Gian hàng" && (
                          <>
                            <Field label="Số hợp đồng gian hàng" required>
                              <Input
                                disabled={!!subscription}
                                maxLength={255}
                                value={editor.contract}
                                onChange={(e) =>
                                  set("contract", e.target.value)
                                }
                              />
                            </Field>
                            <Field
                              label="Hợp đồng có hiệu lực đến"
                              required
                              error={fieldErrors.contract}
                            >
                              <Input
                                disabled={!!subscription}
                                type="date"
                                value={editor.contractEnd}
                                onChange={(e) =>
                                  set("contractEnd", e.target.value)
                                }
                              />
                            </Field>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </section>
                <section className="panel op-form-section">
                  <div className="op-section-aside">
                    <span className="op-section-icon">
                      <ScanLine size={20} />
                    </span>
                    <Heading level={3}>Thẻ cấp phát</Heading>
                    <p>
                      Chỉ kích hoạt thẻ trong kho, đúng bãi nhận và đúng loại
                      phương tiện.
                    </p>
                  </div>
                  <div className="op-field-grid">
                    {parkField}
                    <Field label="Phương tiện" required>
                      <Select
                        disabled={!!subscription}
                        value={editor.vehicle}
                        onChange={(e) => set("vehicle", e.target.value)}
                        options={vehicles}
                      />
                    </Field>
                    <div className="op-full">
                      <Field
                        label="Mã thẻ"
                        required
                        error={foundCardError || undefined}
                      >
                        <div className="op-scan-field">
                          <ScanLine size={18} />
                          <Input
                            maxLength={255}
                            value={editor.code}
                            onChange={(e) => set("code", e.target.value)}
                            placeholder="Quét hoặc nhập mã thẻ trong kho"
                          />
                          <Button
                            disabled={!park}
                            onClick={() => {
                              setPickerQuery("")
                              setPicker(true)
                            }}
                          >
                            Chọn trong kho
                          </Button>
                        </div>
                      </Field>
                      {chosen && !foundCardError && (
                        <div className="op-card-valid">
                          <CircleCheck size={15} />
                          {chosen.id} · Trong kho · {chosen.park} ·{" "}
                          {chosen.vehicle}
                        </div>
                      )}
                    </div>
                    <Field label="Hiệu lực từ" required>
                      <Input
                        type="date"
                        value={editor.effectiveFrom}
                        onChange={(e) => set("effectiveFrom", e.target.value)}
                      />
                    </Field>
                    <div className="field">
                      <Field
                        label="Hiệu lực đến"
                        required={editor.type !== "VIP"}
                        error={fieldErrors.expiry}
                      >
                        <Input
                          type="date"
                          value={editor.expiry}
                          onChange={(e) => set("expiry", e.target.value)}
                        />
                      </Field>
                      {editor.type === "VIP" && (
                        <Label className="op-check">
                          <Input
                            type="checkbox"
                            checked={!editor.expiry}
                            onChange={(e) =>
                              set(
                                "expiry",
                                e.target.checked ? "" : "2026-12-31",
                              )
                            }
                          />
                          Không giới hạn thời gian
                        </Label>
                      )}
                    </div>
                    <div className="op-full">{noteField}</div>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="panel op-form-section">
                  <div className="op-section-aside">
                    <span className="op-section-icon">
                      <Building2 size={20} />
                    </span>
                    <Heading level={3}>Thông tin bàn giao</Heading>
                    <p>
                      Thẻ chỉ được giao cho bàn thẻ của chính bãi đang quản lý
                      kho.
                    </p>
                  </div>
                  <div className="op-field-grid">
                    {parkField}
                    <Field label="Người nhận tại bàn thẻ" required>
                      <Input
                        maxLength={255}
                        value={editor.recipient}
                        onChange={(e) => set("recipient", e.target.value)}
                        placeholder="Họ tên bảo vệ / người nhận"
                      />
                    </Field>
                    <div className="op-full">{noteField}</div>
                  </div>
                </section>
                <section className="panel op-handoff-cards">
                  <div className="panel-heading">
                    <div>
                      <Heading>
                        Danh sách thẻ bàn giao{" "}
                        <span className="tab-counter">{selected.length}</span>
                      </Heading>
                      <span className="muted">
                        Chỉ nhận thẻ vãng lai đang trong kho của bãi đã chọn
                      </span>
                    </div>
                    <Button
                      disabled={!park}
                      onClick={() => {
                        setPickerQuery("")
                        setPicker(true)
                      }}
                    >
                      <Plus size={14} />
                      Chọn từ kho
                    </Button>
                  </div>
                  <div className="op-handoff-scan">
                    <Textarea
                      maxLength={500}
                      value={scan}
                      onChange={(e) => {
                        setScan(e.target.value)
                        setDirty(true)
                      }}
                      placeholder="Quét hoặc dán mã thẻ, mỗi mã một dòng"
                      rows={2}
                    />
                    <Button disabled={!park} onClick={addScanned}>
                      <ScanLine size={15} />
                      Thêm mã thẻ
                    </Button>
                  </div>
                  {scanError && <div className="op-error">{scanError}</div>}
                  {selected.length ? (
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>STT</th>
                            <th>Mã thẻ</th>
                            <th>Loại phương tiện</th>
                            <th>Kho bãi</th>
                            <th>Trạng thái hiện tại</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {selected.map((id, i) => {
                            const c = state.cards.find((c) => c.id === id)!
                            return (
                              <tr key={id}>
                                <td>{i + 1}</td>
                                <td>{id}</td>
                                <td>{c.vehicle}</td>
                                <td>{c.park}</td>
                                <td>{badge(c)}</td>
                                <td>
                                  <Button
                                    variant="ghost"
                                    aria-label={`Bỏ chọn ${id}`}
                                    onClick={() => {
                                      setSelected((old) =>
                                        old.filter((v) => v !== id),
                                      )
                                      setDirty(true)
                                    }}
                                  >
                                    <X size={15} />
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="op-scan-empty">
                      <CreditCard size={27} />
                      <strong>Chưa có thẻ trong phiếu giao</strong>
                      <span>
                        Chọn kho bãi và quét mã thẻ hoặc chọn từ danh sách trong
                        kho.
                      </span>
                    </div>
                  )}
                </section>
              </>
            )}
            {actionError && (
              <div className="op-rule op-rule-danger" role="alert">
                <TriangleAlert size={17} />
                {actionError}
              </div>
            )}
            <div className="op-editor-footer">
              <span>
                <ShieldCheck size={14} />
                {editor.kind === "import"
                  ? "Thẻ hợp lệ sẽ ở trạng thái Trong kho"
                  : "Dữ liệu minh họa · Chỉ lưu trong phiên xem"}
              </span>
              <div>
                <Button onClick={closeEditor}>Hủy</Button>
                {editor.kind === "import" && importStage === 0 ? (
                  <Button
                    variant="primary"
                    disabled={
                      !park ||
                      !editor.supplier.trim() ||
                      !importRows.length ||
                      fileBusy
                    }
                    onClick={() => setImportStage(1)}
                  >
                    Kiểm tra dữ liệu
                    <ArrowRight size={15} />
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    disabled={
                      editor.kind === "import"
                        ? !importRows.some((r) => !r.error)
                        : editor.kind === "subscription"
                          ? !canActivate
                          : !park ||
                            !editor.recipient.trim() ||
                            !selected.length
                    }
                    onClick={saveEditor}
                  >
                    <Check size={15} />
                    {editTitle}
                  </Button>
                )}
              </div>
            </div>
          </Form>
        </div>
      )}
      <footer className="page-footer">
        <span>VParking CMS · Quản lý vòng đời thẻ xe</span>
        <span>
          <span className="demo-dot" />
          Dữ liệu minh họa · Thao tác trong phiên · GMT+7
        </span>
      </footer>
      {picker && (
        <Overlay
          wide
          title={
            editor?.kind === "handoff"
              ? "Chọn thẻ vãng lai trong kho"
              : "Chọn thẻ để kích hoạt"
          }
          subtitle={`${park?.label || "Chưa chọn kho bãi"} · ${candidates.length} thẻ sẵn sàng`}
          onClose={() => setPicker(false)}
          footer={
            <>
              <span className="muted">
                {editor?.kind === "handoff"
                  ? `${selected.length} thẻ đã chọn`
                  : "Bấm Chọn ở dòng thẻ cần cấp"}
              </span>
              <Button onClick={() => setPicker(false)}>Hoàn tất</Button>
            </>
          }
        >
          <div className="search-box op-picker-search">
            <Search size={16} />
            <Input
              maxLength={100}
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Tìm theo mã thẻ…"
              aria-label="Tìm thẻ trong kho"
            />
          </div>
          {pickerCards.length ? (
            <div className="table-scroll op-picker-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mã thẻ</th>
                    <th>Loại thẻ</th>
                    <th>Phương tiện</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pickerCards.map((c) => (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>{c.type}</td>
                      <td>{c.vehicle}</td>
                      <td>{badge(c)}</td>
                      <td>
                        <Button
                          variant={
                            selected.includes(c.id) ? "ghost" : "default"
                          }
                          onClick={() => {
                            if (editor?.kind === "handoff") {
                              setSelected((old) =>
                                old.includes(c.id)
                                  ? old.filter((v) => v !== c.id)
                                  : [...old, c.id],
                              )
                              setDirty(true)
                            } else {
                              set("code", c.id)
                              setPicker(false)
                            }
                          }}
                        >
                          {selected.includes(c.id) ? (
                            <>
                              <Check size={13} />
                              Đã chọn
                            </>
                          ) : (
                            "Chọn"
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="op-scan-empty">
              <Package size={27} />
              <strong>Không có thẻ phù hợp trong kho</strong>
              <span>Kiểm tra lại kho bãi, phương tiện hoặc nhập thêm thẻ.</span>
            </div>
          )}
        </Overlay>
      )}
      {detail && (
        <Overlay
          wide
          title="Thông tin & thao tác thẻ"
          subtitle="Dữ liệu vận hành trong phiên hiện tại"
          onClose={() => setDetailId(null)}
          footer={
            <>
              <span className="detail-footer-note">
                <Warehouse size={14} />
                Kho quản lý: {detail.park}
              </span>
              {detail.status === "Đang hoạt động" && (
                <Button onClick={() => openAction("lock", detail)}>
                  <LockKeyhole size={14} />
                  Khóa
                </Button>
              )}
              {detail.status === "Khóa" && (
                <Button onClick={() => openAction("unlock", detail)}>
                  <UnlockKeyhole size={14} />
                  Mở khóa
                </Button>
              )}
              {detail.status !== "Mất / hỏng" && (
                <Button onClick={() => openAction("incident", detail)}>
                  Lập biên bản
                </Button>
              )}
              {["Đang hoạt động", "Khóa"].includes(detail.status) && (
                <Button
                  variant="primary"
                  onClick={() => openAction("return", detail)}
                >
                  <FileCheck2 size={14} />
                  Thu hồi & kiểm tra
                </Button>
              )}
              <Button onClick={() => setDetailId(null)}>Đóng</Button>
            </>
          }
        >
          <div className="detail-hero">
            <div className="detail-card-icon">
              <CreditCard size={27} />
            </div>
            <div>
              <Heading>{detail.id}</Heading>
              <span>
                {detail.type} · {detail.vehicle}
              </span>
            </div>
            {badge(detail)}
          </div>
          <div className="detail-tabs">
            {["Thông tin thẻ", "Lịch sử thao tác"].map((t) => (
              <Button
                variant="ghost"
                className={detailTab === t ? "selected" : ""}
                key={t}
                onClick={() => setDetailTab(t)}
              >
                {t}
              </Button>
            ))}
          </div>
          {detailTab === "Thông tin thẻ" ? (
            <div className="detail-grid">
              {[
                ["Mã thẻ", detail.id],
                ["Kho bãi", detail.park],
                [
                  "Khu đô thị",
                  estates.find((e) => e.id === detail.estate)?.name || "—",
                ],
                ["Lô nhập", detail.batch],
                ["Chủ thẻ", detail.owner],
                ["Biển số", detail.plate],
                ["Số điện thoại", detail.phone],
                ["Mã thuê bao", detail.subscription || "—"],
                ["Hiệu lực đến", date(detail.expiry)],
              ].map(([l, v]) => (
                <div key={l}>
                  <span>{l}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="timeline">
              {[
                ...state.activity.filter((a) => a.cardId === detail.id),
                ...cardHistory(detail, today).map((a) => ({
                  ...a,
                  title: a.name,
                })),
              ]
                .sort((a, b) => b.at.localeCompare(a.at))
                .map((a, i) => (
                  <div className="timeline-event" key={i}>
                    <span className="timeline-point">
                      {i === 0 && <Check size={12} />}
                    </span>
                    <div>
                      <div className="timeline-title">
                        <strong>{a.title}</strong>
                        <span>
                          {date(a.at.slice(0, 10))} {a.at.slice(11, 16)}
                        </span>
                      </div>
                      <span className="timeline-user">Admin Local</span>
                      <div className="muted">{a.reason}</div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Overlay>
      )}
      {action && (
        <Overlay
          title={
            action.kind === "return"
              ? "Thu hồi & kiểm tra thẻ"
              : action.kind === "incident"
                ? "Lập biên bản mất / hỏng"
                : action.kind === "lock"
                  ? "Khóa thẻ"
                  : "Mở khóa thẻ"
          }
          subtitle={
            action.kind === "return"
              ? "Kiểm tra tình trạng vật lý ngay khi nhận lại thẻ."
              : "Thao tác sẽ được ghi vào lịch sử của thẻ."
          }
          onClose={closeAction}
          footer={
            <>
              <Button onClick={closeAction}>Hủy</Button>
              <Button
                variant="primary"
                disabled={!cardActionValid}
                onClick={saveAction}
              >
                {action.kind === "return"
                  ? action.result === "damaged"
                    ? "Thu hồi & lập biên bản hỏng"
                    : "Xác nhận thu hồi"
                  : action.kind === "incident"
                    ? "Lập biên bản"
                    : "Xác nhận"}
              </Button>
            </>
          }
        >
          <Form
            onSubmit={(e) => {
              e.preventDefault()
              if (cardActionValid) saveAction()
            }}
          >
            <div className="op-action-fields">
              {actCard && (
                <div className="edit-estate">
                  <CreditCard size={22} />
                  <div>
                    <strong>{actCard.id}</strong>
                    <span>
                      {actCard.type} · {actCard.park} · {actCard.status}
                    </span>
                  </div>
                </div>
              )}
              {action.kind === "incident" && (
                <Field
                  label="Mã thẻ"
                  required
                  error={
                    action.cardId && !actCard
                      ? "Không tìm thấy mã thẻ trong hệ thống."
                      : undefined
                  }
                >
                  <Input
                    maxLength={255}
                    value={action.cardId}
                    onChange={(e) => {
                      const value = e.target.value,
                        found = state.cards.find(
                          (c) => normalize(c.id) === normalize(value),
                        )
                      setAction({
                        ...action,
                        cardId: found?.id || value,
                        fee:
                          found?.type === "Vãng lai" &&
                          action.incidentKind === "Mất"
                            ? "50000"
                            : "0",
                      })
                    }}
                    placeholder="Nhập hoặc quét mã thẻ"
                  />
                </Field>
              )}

              {action.kind === "return" && (
                <>
                  <fieldset className="field op-inspection">
                    <legend className="field-label">
                      Kết quả kiểm tra vật lý
                      <span className="required"> *</span>
                    </legend>
                    <div className="op-inspection-options">
                      <Label
                        className={action.result === "pass" ? "selected" : ""}
                      >
                        <Input
                          type="radio"
                          name="inspection"
                          value="pass"
                          checked={action.result === "pass"}
                          onChange={() =>
                            setAction({ ...action, result: "pass", fee: "0" })
                          }
                        />
                        <span>
                          <strong>Thẻ đạt kiểm tra</strong>
                          <small>
                            Thu hồi về đúng kho bãi, sẵn sàng cấp lại
                          </small>
                        </span>
                        <CircleCheck size={18} />
                      </Label>
                      <Label
                        className={
                          action.result === "damaged" ? "selected danger" : ""
                        }
                      >
                        <Input
                          type="radio"
                          name="inspection"
                          value="damaged"
                          checked={action.result === "damaged"}
                          onChange={() =>
                            setAction({
                              ...action,
                              result: "damaged",
                              fee: "0",
                            })
                          }
                        />
                        <span>
                          <strong>Thẻ không đạt / bị hỏng</strong>
                          <small>
                            Lập biên bản hỏng, không đưa vào kho cấp lại
                          </small>
                        </span>
                        <TriangleAlert size={18} />
                      </Label>
                    </div>
                  </fieldset>
                  <Label className="op-check op-inspected">
                    <Input
                      type="checkbox"
                      checked={action.checked}
                      onChange={(e) =>
                        setAction({ ...action, checked: e.target.checked })
                      }
                    />
                    Tôi đã nhận thẻ và kiểm tra tình trạng vật lý
                  </Label>
                </>
              )}
              {action.kind === "incident" && (
                <Field label="Loại biên bản" required>
                  <Select
                    value={action.incidentKind}
                    onChange={(e) =>
                      setAction({
                        ...action,
                        incidentKind: e.target.value as "Mất" | "Hỏng",
                        fee:
                          e.target.value === "Mất" &&
                          actCard?.type === "Vãng lai"
                            ? "50000"
                            : "0",
                      })
                    }
                    options={["Mất", "Hỏng"]}
                  />
                </Field>
              )}
              {(action.kind === "incident" ||
                (action.kind === "return" && action.result === "damaged")) && (
                <div className="op-field-grid">
                  <Field
                    label="Số biên bản"
                    required
                    error={
                      state.incidents.some(
                        (i) => normalize(i.id) === normalize(action.number),
                      )
                        ? "Số biên bản đã tồn tại."
                        : undefined
                    }
                  >
                    <Input
                      maxLength={255}
                      value={action.number}
                      onChange={(e) =>
                        setAction({ ...action, number: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Ngày lập" required>
                    <Input
                      type="date"
                      max={today}
                      value={action.date}
                      onChange={(e) =>
                        setAction({ ...action, date: e.target.value })
                      }
                    />
                  </Field>
                  <div className="op-full">
                    <Field
                      label="Khoản thu ghi nhận (₫)"
                      required
                      error={
                        !Number.isInteger(Number(action.fee)) ||
                        Number(action.fee) < 0 ||
                        Number(action.fee) > 1000000000
                          ? "Nhập số nguyên từ 0 đến 1.000.000.000 ₫."
                          : undefined
                      }
                    >
                      <Input
                        type="number"
                        min={0}
                        max={1000000000}
                        step={1}
                        value={action.fee}
                        onChange={(e) =>
                          setAction({ ...action, fee: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                </div>
              )}
              <Field
                label={
                  action.kind === "return"
                    ? "Lý do thu hồi / ghi nhận kiểm tra"
                    : "Lý do"
                }
                required
              >
                <Textarea
                  maxLength={500}
                  rows={3}
                  value={action.reason}
                  onChange={(e) =>
                    setAction({ ...action, reason: e.target.value })
                  }
                  placeholder={
                    action.kind === "return"
                      ? "Ví dụ: Khách ngừng thuê bao, thẻ còn sử dụng tốt…"
                      : "Nhập lý do thực hiện…"
                  }
                />
                <span className="character-count">
                  {action.reason.length}/500
                </span>
              </Field>
              {action.kind === "return" && action.result && (
                <div
                  className={`op-transition ${
                    action.result === "damaged" ? "danger" : ""
                  }`}
                >
                  <span>{actCard?.status}</span>
                  <ArrowRight size={15} />
                  <strong>
                    {action.result === "pass" ? "Trong kho" : "Mất / hỏng"}
                  </strong>
                  <small>
                    {action.result === "pass"
                      ? `Kho nhận: ${actCard?.park}`
                      : "Có biên bản hỏng · Không thể tái sử dụng"}
                  </small>
                </div>
              )}
              {action.kind === "incident" && (
                <div className="edit-note">
                  <Info size={16} />
                  Thẻ sẽ chuyển sang Mất / hỏng và không thể cấp lại. Khoản thu
                  chỉ minh họa ghi nhận, chưa kết nối Báo cáo doanh thu.
                </div>
              )}
              {actionError && (
                <div className="op-error" role="alert">
                  {actionError}
                </div>
              )}
            </div>
          </Form>
        </Overlay>
      )}
      {record &&
        (() => {
          const item =
            record.kind === "lot"
              ? state.lots.find((x) => x.id === record.id)!
              : record.kind === "handoff"
                ? state.handoffs.find((x) => x.id === record.id)!
                : state.incidents.find((x) => x.id === record.id)!
          const ids = "ids" in item ? item.ids : [item.cardId]
          return (
            <Overlay
              wide
              title={
                record.kind === "lot"
                  ? "Chi tiết lô nhập"
                  : record.kind === "handoff"
                    ? "Chi tiết phiếu giao thẻ"
                    : "Chi tiết biên bản"
              }
              subtitle={item.id}
              onClose={() => setRecord(null)}
              footer={
                <>
                  <Button
                    onClick={() =>
                      workbook(
                        "ChiTiet",
                        ids.map((id) => {
                          const c = state.cards.find((c) => c.id === id)!
                          return {
                            "Mã phiếu": item.id,
                            Ngày: date(item.date),
                            "Mã thẻ": id,
                            "Kho bãi": c.park,
                            "Trạng thái hiện tại": c.status,
                            ...("fee" in item
                              ? {
                                  "Loại biên bản": item.kind,
                                  "Khoản thu": item.fee,
                                  "Lý do": item.reason,
                                }
                              : {}),
                          }
                        }),
                      )
                    }
                  >
                    <Download size={14} />
                    Tải chi tiết
                  </Button>
                  <Button variant="primary" onClick={() => setRecord(null)}>
                    Đóng
                  </Button>
                </>
              }
            >
              <div className="detail-grid">
                {[
                  ["Mã phiếu / biên bản", item.id],
                  ["Ngày ghi nhận", date(item.date)],
                  ["Người thực hiện", "Admin Local"],
                  ...("supplier" in item
                    ? [
                        ["Kho bãi", item.park],
                        ["Nhà cung cấp", item.supplier],
                      ]
                    : "recipient" in item
                      ? [
                          ["Bãi nhận", item.park],
                          ["Người nhận", item.recipient],
                          ["Ghi chú", item.note || "—"],
                        ]
                      : [
                          ["Loại biên bản", item.kind],
                          ["Khoản thu", `${fmt(item.fee)} ₫`],
                          ["Lý do", item.reason],
                        ]),
                ].map(([l, v]) => (
                  <div key={l}>
                    <span>{l}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Mã thẻ</th>
                      <th>Kho bãi</th>
                      <th>Loại thẻ</th>
                      <th>Phương tiện</th>
                      <th>Trạng thái hiện tại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ids.map((id) => {
                      const c = state.cards.find((c) => c.id === id)!
                      return (
                        <tr key={id}>
                          <td>{id}</td>
                          <td>{c.park}</td>
                          <td>{c.type}</td>
                          <td>{c.vehicle}</td>
                          <td>{badge(c)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Overlay>
          )
        })()}
      {discard && (
        <Overlay
          title="Bạn có thay đổi chưa lưu"
          dismissOnBackdrop={false}
          onClose={() => setDiscard(false)}
          footer={
            <>
              <Button autoFocus onClick={() => setDiscard(false)}>
                Tiếp tục chỉnh sửa
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setDiscard(false)
                  if (action) setAction(null)
                  else {
                    setEditor(null)
                    setDirty(false)
                  }
                }}
              >
                Bỏ thay đổi
              </Button>
            </>
          }
        >
          <span className="muted">
            Rời đi sẽ mất các thay đổi chưa xác nhận. Bạn có muốn bỏ thay đổi?
          </span>
        </Overlay>
      )}
    </div>
  )
}
