import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import {
  Activity,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Banknote,
  BookOpen,
  Building2,
  CalendarDays,
  CarFront,
  ChartNoAxesCombined,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleCheck,
  CircleHelp,
  Clock3,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  FileBarChart2,
  FileCheck2,
  FileSpreadsheet,
  History,
  Info,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  Menu,
  Package,
  ParkingSquare,
  PanelLeftClose,
  Pencil,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  Users,
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
} from "./ui"
import {
  alertNames,
  cardAlertIds,
  cardTypes,
  columnNames,
  customerGroups,
  date,
  defaults,
  defaultColumns,
  estates,
  filterCards,
  fmt,
  initialThresholds,
  maxDate,
  normalize,
  percent,
  screens,
  today,
  vehicles,
} from "./data"
import LookupFilterPanel, { lookupMatchHint } from "./LookupFilterPanel"
import CardLookupMultiFilter from "./CardLookupMultiFilter"
import type { Card, Filters, Screen, Threshold } from "./data"
import Operations from "./Operations"
import SubscriptionManagement from "./SubscriptionManagement"
import { isManagementScreen } from "./subscription-model"
import type { ManagementScreen } from "./subscription-model"
import ReportDashboard from "./ReportDashboard"
import ReportPeriodFields from "./ReportPeriodFields"
import Parking from "./Parking"
import useParking from "./useParking"
import Revenue from "./Revenue"
import { useRevenueState } from "./useRevenueState"
import { auditRevenue, cardsWithReceipts, incidentCharges, isRevenueScreen, revenueAccess, revenueMenus, revenueWrite } from "./revenue-model"
import VoucherNavigation from "./VoucherNavigation"
import { changeLedger } from "./revenue-operations"
import type { RevenueScreen } from "./revenue-model"
import {
  canOpen, dayAt, defaultParkingFilters, demoAccess, displayTime, isParkingScreen,
  overCapacityTripAlert, parkingMenus, parkingRoles, siteById, vnToday,
} from "./parking-model"
import type { ParkingAccess, ParkingScreen, Role } from "./parking-model"
import { operationMenus, seedOperations } from "./operations-model"
import { withDemoScenarios } from "./demo-scenarios"
import type { OperationScreen } from "./operations-model"
import {
  cardHistory,
  circulationGroups,
  circulationStatus,
  circulationStatuses,
  daysBetween,
  defaultCardLookupFilters,
  inCirculationGroup,
  isReportCardLookup,
  lossBreakdown,
  lookupSnapshotDay,
  lookupCards,
  managementReport,
  readCardLookupParams,
  recentTrips,
  reportLookupFilters,
  setCardLookupParams,
  snapshot,
  stockMetrics,
} from "./report-model"
import type { CardLookupFilters, CirculationGrouping, ReportLookupSelection } from "./report-model"
import HandoffModeSelector from "./HandoffModeSelector"
import Behavior from "./Behavior"
import { behaviorManagementTitle, behaviorOperations, behaviorOperationsTitle, behaviorReport, behaviorTitle, isBehaviorScreen } from "./behavior-routes"
import type { BehaviorScreen } from "./behavior-routes"
import { canEditEvent, canEditHoliday, canReadBehavior } from "./behavior-model"
import { handoffModeStorageKey, initialHandoffLocation, modeAllowsScreen, modeHome } from "./handoff-mode"
import type { HandoffMode } from "./handoff-mode"

const screenIcons = {
  stock: Warehouse,
  circulation: CreditCard,
  alerts: TriangleAlert,
  cards: Search,
  settings: Settings2,
}
const operationIcons = {
  inventory: Warehouse,
  imports: Package,
  subscriptions: Users,
  customers: Users,
  vehicles: CarFront,
  services: Settings2,
  handoffs: ArrowUpRight,
  lookup: Search,
  incidents: FileCheck2,
}
type ModuleScreen = ParkingScreen | RevenueScreen | BehaviorScreen
interface LeaveTarget {
  report?: Screen
  operation?: OperationScreen
  parking?: { screen: ModuleScreen; patch?: Record<string, string | null>; preserve?: boolean }
  access?: ParkingAccess
  mode?: HandoffMode
}
interface Change {
  estate: string
  previous: Threshold
  next: Threshold
  actor: string
  at: string
}
const initialHandoff = initialHandoffLocation(window.location.search, (() => {
  try { return localStorage.getItem(handoffModeStorageKey) } catch { return null }
})())
const startupParams = initialHandoff.params
const getInitial = () => {
  const p = new URLSearchParams(startupParams)
  const requested = screens.some((s) => s.id === p.get("screen"))
    ? p.get("screen") as Screen
    : "stock"
  const screen =
    requested === "circulation" || requested === "alerts" ? "stock" : requested
  const f = { ...defaults }
  for (const key of Object.keys(f) as Array<keyof Filters>)
    if (p.has(key)) f[key] = p.get(key)!.slice(0, 100)
  if (f.estate && !estates.some((e) => e.id === f.estate)) f.estate = ""
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  if (!validDate(f.end) || f.end > maxDate || f.end < "2026-09-01")
    f.end = maxDate
  if (
    !validDate(f.start) ||
    f.start < "2026-09-01" ||
    f.start > f.end ||
    daysBetween(f.start, f.end) >= 31
  )
    f.start = `${f.end.slice(0, 7)}-01`
  if (!cardTypes.includes(f.type)) f.type = ""
  if (!vehicles.includes(f.vehicle)) f.vehicle = ""
  if (!["Trong kho", "Đang hoạt động", "Khóa", "Mất / hỏng"].includes(f.status))
    f.status = ""
  if (!cardAlertIds.some((id) => String(id + 1) === f.alert)) f.alert = ""
  if (f.expiry && !validDate(f.expiry)) f.expiry = ""
  if (
    f.park &&
    !estates.some(
      (e) => (!f.estate || e.id === f.estate) && e.parks.includes(f.park),
    )
  )
    f.park = ""
  if (screen === "stock") {
    f.status = ""
    f.alert = ""
    f.expiry = ""
  }
  return { screen, f }
}
const initial = getInitial()
function App() {
  const [handoffMode, setHandoffMode] = useState<HandoffMode>(initialHandoff.mode)
  const modeAllows = (id: string) => modeAllowsScreen(handoffMode, id)
  const [parking, setParking] = useState<ModuleScreen | null>(() => {
    const value = startupParams.get("module")
    return isParkingScreen(value) || isRevenueScreen(value) || isBehaviorScreen(value) ? value : null
  })
  const [parkingParams, setParkingParams] = useState(() => {
    const params = new URLSearchParams(startupParams)
    if (!isParkingScreen(params.get("module")) && !isRevenueScreen(params.get("module")) && !isBehaviorScreen(params.get("module"))) return new URLSearchParams()
    params.delete("module")
    params.delete("mode")
    return params
  })
  const [parkingAccess, setParkingAccess] = useState<ParkingAccess>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("vparking:parking:demo-access") ?? "null") as ParkingAccess | null
      if (saved && Object.prototype.hasOwnProperty.call(parkingRoles, saved.role) &&
        (!saved.estate || estates.some((estate) => estate.id === saved.estate))) return saved
    } catch { /* Use the default demo account. */ }
    return demoAccess
  })
  const [parkingDirty, setParkingDirty] = useState(false)
  const [operation, setOperation] = useState<OperationScreen | null>(() => {
    const value = startupParams.get("module")
    return operationMenus.some((m) => m.id === value)
      ? value as OperationScreen
      : null
  })
  const [operationDirty, setOperationDirty] = useState(false)
  const [operationFocus, setOperationFocus] = useState<string | null>(null)
  const [managementOrigin, setManagementOrigin] = useState<string | null>(null)
  const [leaveTarget, setLeaveTarget] = useState<LeaveTarget | null>(null)
  const [screen, setScreen] = useState<Screen>(initial.screen)
  const [draft, setDraft] = useState<Filters>(initial.f)
  const [applied, setApplied] = useState<Filters>(initial.f)
  const [ready, setReady] = useState(true)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [expanded, setExpanded] = useState<string[]>(["A"])
  const [sort, setSort] = useState(false)
  const [search, setSearch] = useState(() =>
    initial.screen === "cards"
      ? new URLSearchParams(startupParams).get("q")?.slice(0, 100) || ""
      : "",
  )
  const [query, setQuery] = useState(search)
  const [page, setPage] = useState(() =>
    Math.max(1, Number(new URLSearchParams(startupParams).get("page")) || 1),
  )
  const [pageSize, setPageSize] = useState(20)
  const [groupBy, setGroupBy] = useState<CirculationGrouping>(() => {
    const value = new URLSearchParams(startupParams).get("reportGroupBy")
    return value === "Loại phương tiện" || value === "Nhóm khách hàng" ? value : "Loại thẻ"
  })
  const [split, setSplit] = useState(() => new URLSearchParams(startupParams).get("splitByEstate") === "1")
  const [lookupFilters, setLookupFilters] = useState(() =>
    operation === "lookup" ? readCardLookupParams(new URLSearchParams(startupParams), initial.f) : null,
  )
  const [lookupFromReport, setLookupFromReport] = useState(() =>
    operation === "lookup" && isReportCardLookup(new URLSearchParams(startupParams)),
  )
  const [detail, setDetail] = useState<Card | null>(null)
  const [detailTab, setDetailTab] = useState("Thông tin thẻ")
  const [drawer, setDrawer] = useState<"filter" | "columns" | null>(null)
  const [columns, setColumns] = useState(defaultColumns)
  const [columnDraft, setColumnDraft] = useState(defaultColumns)
  const [toast, setToast] = useState("")
  const parkingModel = useParking(parkingAccess, setToast)
  const revenueModel = useRevenueState(setToast)
  const behaviorTripUpdates = useMemo(() => revenueModel.state.tripUpdates?.map(({ trip }) => trip), [revenueModel.state.tripUpdates])
  const [cardOperations, setCardOperations] = useState(()=>withDemoScenarios(seedOperations()))
  const sharedCards = useMemo(() => cardsWithReceipts(cardOperations, revenueModel.state.receipts),
    [cardOperations, revenueModel.state.receipts])
  const updateCardOperations = (next: typeof cardOperations) => {
    if (next.incidents.length !== sharedCards.incidents.length && Object.keys(revenueModel.state.closes).length) {
      const before = incidentCharges(sharedCards)
      const after = incidentCharges(next)
      const ids = after.filter((row) => !before.some((old) => old.id === row.id)).map((row) => row.id)
      if (ids.length && !revenueModel.save((state) => {
        const updated = changeLedger(state, state, [], parkingModel.settings, ids, "Biên bản mất / hỏng sau chốt",
          parkingModel.actor, revenueWrite(parkingAccess, "adjust"), { before, after })
        return updated === state ? state : auditRevenue(updated, parkingModel.actor, "Điều chỉnh biên bản mất / hỏng",
          parkingAccess.estate, ids.join(", "))
      })) throw new Error("Không thể ghi nhận phí biên bản vào doanh thu.")
    }
    const projected = new Map(sharedCards.cards.map((card) => [card.id, card]))
    const base = new Map(cardOperations.cards.map((card) => [card.id, card]))
    const projectedSubscriptions = new Map(sharedCards.subscriptions.map((row) => [row.id, row]))
    const baseSubscriptions = new Map(cardOperations.subscriptions.map((row) => [row.id, row]))
    setCardOperations({ ...next, cards: next.cards.map((card) =>
      card === projected.get(card.id) ? base.get(card.id) ?? card : card),
      subscriptions: next.subscriptions.map((row) =>
        row === projectedSubscriptions.get(row.id) ? baseSubscriptions.get(row.id) ?? row : row),
    })
  }
  const [notifications, setNotifications] = useState(false)
  const [help, setHelp] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [thresholds, setThresholds] = useState(initialThresholds)
  const [editing, setEditing] = useState<string | null>(null)
  const [edit, setEdit] = useState<Threshold>({
    expiry: 7,
    loss: 5,
    unused: 30,
    effective: "2026-10-30",
  })
  const [originalEdit, setOriginalEdit] = useState("")
  const [changes, setChanges] = useState<Change[]>([])
  const [settingsHistoryOpen, setSettingsHistoryOpen] = useState(false)
  const [settingsFilter, setSettingsFilter] = useState({ q: "", estates: [] as string[], statuses: [] as string[] })
  const [settingsFilterDraft, setSettingsFilterDraft] = useState({ q: "", estates: [] as string[], statuses: [] as string[] })
  const [discard, setDiscard] = useState(false)
  const [account, setAccount] = useState(false)
  const [sortKey, setSortKey] = useState(() => {
    const key =
      new URLSearchParams(startupParams).get("sort")?.replace(/^-/, "") ||
      "id"
    return key in columnNames ? key : "id"
  })
  const [sortDesc, setSortDesc] = useState(
    () =>
      new URLSearchParams(startupParams).get("sort")?.startsWith("-") ||
      false,
  )
  const [previewState, setPreviewState] = useState("ready")
  const previousSearch = useRef(search)
  const title = screens.find((s) => s.id === screen)!
  const reportSection = screen === "cards" ? "stock" : screen

  useEffect(() => {
    if (previousSearch.current === search) return
    previousSearch.current = search
    const t = window.setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 500)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => {
    if (toast) {
      const t = window.setTimeout(
        () => setToast(""),
        toast.startsWith("Không thể") ? 5000 : 3000,
      )
      return () => clearTimeout(t)
    }
  }, [toast])
  useEffect(() => {
    if (parking) {
      const params = new URLSearchParams(parkingParams)
      params.set("module", parking)
      params.set("mode", handoffMode)
      window.history.replaceState(null, "", `${window.location.pathname}?${params}`)
      return
    }
    const p = new URLSearchParams({ screen, mode: handoffMode })
    if (operation) p.set("module", operation)
    for (const [key, value] of Object.entries(applied))
      if (value && value !== defaults[(key as keyof Filters)]) p.set(key, value)
    if (groupBy !== "Loại thẻ") p.set("reportGroupBy", groupBy)
    if (split) p.set("splitByEstate", "1")
    if (operation === "lookup" && lookupFilters) {
      setCardLookupParams(p, lookupFilters)
      if (lookupFromReport) p.set("lookupFrom", "report")
    }
    if (query) p.set("q", query)
    if (page > 1) p.set("page", String(page))
    if (sortDesc || sortKey !== "id")
      p.set("sort", `${sortDesc ? "-" : ""}${sortKey}`)
    window.history.replaceState(null, "", `${window.location.pathname}?${p}`)
  }, [screen, applied, query, page, sortKey, sortDesc, operation, parking, parkingParams, lookupFilters, lookupFromReport, groupBy, split, handoffMode])
  useEffect(() => {
    try { localStorage.setItem(handoffModeStorageKey, handoffMode) } catch { /* The URL still preserves the mode. */ }
  }, [handoffMode])
  useEffect(() => {
    const changed = parkingDirty || (editing && JSON.stringify(edit) !== originalEdit)
    function leave(e: BeforeUnloadEvent) {
      if (changed) {
        e.preventDefault()
        e.returnValue = ""
      }
    }
    window.addEventListener("beforeunload", leave)
    return () => window.removeEventListener("beforeunload", leave)
  }, [editing, edit, originalEdit, parkingDirty])

  const error =
    !draft.end || (screen === "stock" && !draft.start)
      ? "Vui lòng chọn đầy đủ ngày báo cáo."
      : draft.end > maxDate
        ? `Chỉ có dữ liệu đến ngày ${date(maxDate)}.`
        : draft.end < "2026-09-01" || (screen === "stock" && draft.start < "2026-09-01")
          ? "Chưa có dữ liệu trước ngày 01/09/2026."
          : screen === "stock" && draft.start > draft.end
            ? "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc."
            : screen === "stock" &&
                (new Date(draft.end).getTime() -
                  new Date(draft.start).getTime()) /
                  86400000 >=
                  31
              ? "Kỳ báo cáo tối đa 31 ngày."
              : ""
  const reportCards = useMemo(
    () => snapshot(applied.end, currentThreshold),
    [applied.end, thresholds],
  )
  const dashboard = useMemo(
    () => managementReport(applied, currentThreshold, groupBy),
    [applied, thresholds, groupBy],
  )
  const warningCount = dashboard.warned
  const lookupResult = useMemo(
    () => operation === "lookup" && lookupFilters
      ? lookupCards(lookupFilters, (estate) => currentThreshold(estate, lookupSnapshotDay(lookupFilters)), sharedCards.cards)
      : null,
    [operation, lookupFilters, thresholds, sharedCards.cards],
  )
  const baseCards = useMemo(
    () => filterCards(reportCards, applied, query, screen === "stock"),
    [applied, query, reportCards, screen],
  )
  const listCards = useMemo(() => {
    return [...baseCards].sort((a, b) => {
      const av = String(a[(sortKey as keyof Card)] ?? ""),
        bv = String(b[(sortKey as keyof Card)] ?? "")
      return av.localeCompare(bv, "vi", { numeric: true }) * (sortDesc ? -1 : 1)
    })
  }, [baseCards, sortKey, sortDesc])
  const selectedEstates = estates.filter(
    (e) =>
      (!applied.estate || applied.estate === e.id) &&
      (!applied.park || e.parks.includes(applied.park)),
  )
  const circulating = baseCards.filter(
    (c) => c.status === "Đang hoạt động" || c.status === "Khóa",
  )
  const locked = circulating.filter((c) => c.status === "Khóa").length
  const expired = circulating.filter(
    (c) => c.status === "Đang hoạt động" && c.expiry && c.expiry < applied.end,
  ).length
  const stockCount = baseCards.filter((c) => c.status === "Trong kho").length
  const active = circulating.length - locked - expired
  const totalRows = listCards.length
  const pages = Math.max(1, Math.ceil(totalRows / pageSize))
  useEffect(() => {
    setPage((p) => Math.min(p, pages))
  }, [pages])
  const estateName = (id: string) =>
    estates.find((e) => e.id === id)?.name || "—"
  const toggleExpanded = (id: string) =>
    setExpanded((old) =>
      old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
    )
  const update = (key: keyof Filters, value: string) =>
    setDraft((old) => ({
      ...old,
      [key]: value,
      ...(key === "estate" ? { park: "" } : {}),
    }))
  function chooseOperation(id: OperationScreen, force = false) {
    if (!force && !modeAllows(id)) { setToast("Màn hình thuộc mode bàn giao khác. Chọn mode tương ứng để xem."); return }
    if (operation === id) {
      setMobile(false)
      return
    }
    if ((operationDirty || parkingDirty) && !force) {
      setLeaveTarget({ operation: id })
      return
    }
    setOperation(id)
    setManagementOrigin(null)
    setLookupFilters(id === "lookup" ? defaultCardLookupFilters : null)
    setLookupFromReport(false)
    setParking(null)
    setParkingDirty(false)
    setMobile(false)
    setOperationFocus(null)
    setOperationDirty(false)
  }
  function navigate(id: Screen, force = false) {
    if (id === "circulation" || id === "alerts") id = "stock"
    if (!force && !modeAllows(id)) { setToast("Màn hình thuộc mode bàn giao khác. Chọn mode tương ứng để xem."); return }
    if ((operationDirty || parkingDirty) && !force) {
      setLeaveTarget({ report: id })
      return
    }
    setOperation(null)
    setParking(null)
    setParkingDirty(false)
    setOperationDirty(false)
    setPreviewState("ready")
    setScreen(id)
    setMobile(false)
    setSearch("")
    setQuery("")
    setPage(1)
    setLookupFilters(null)
    setReady(true)
    if (id !== "cards") {
      setDraft((v) => ({ ...v, status: "", alert: "", expiry: "" }))
      setApplied((v) => ({ ...v, status: "", alert: "", expiry: "" }))
    }
  }
  function applyParkingParams(base: URLSearchParams, patch: Record<string, string | null>) {
    const next = new URLSearchParams(base)
    for (const [name, value] of Object.entries(patch)) {
      if (value !== null) next.set(name, value)
      else next.delete(name)
    }
    return next
  }
  function updateParking(patch: Record<string, string | null>) {
    setParkingParams((params) => applyParkingParams(params, patch))
  }
  function chooseParking(id: ModuleScreen, patch?: Record<string, string | null>, preserve = false, force = false) {
    if (!force && !modeAllows(id)) { setToast("Màn hình thuộc mode bàn giao khác. Chọn mode tương ứng để xem."); return }
    if (parking === id && !patch) { setMobile(false); return }
    if ((operationDirty || parkingDirty) && !force) {
      setLeaveTarget({ parking: { screen: id, patch, preserve } })
      return
    }
    setParkingParams((params) => applyParkingParams(preserve ? params : new URLSearchParams(), patch ?? {}))
    setParking(id)
    setOperation(null)
    setLookupFilters(null)
    setOperationDirty(false)
    setParkingDirty(false)
    setMobile(false)
    if (!preserve) window.scrollTo(0, 0)
  }
  function changeHandoffMode(next: HandoffMode, force = false) {
    if (next === handoffMode) return
    if (!force && (operationDirty || parkingDirty || editing && JSON.stringify(edit) !== originalEdit)) {
      setLeaveTarget({ mode: next })
      return
    }
    setHandoffMode(next)
    setDetail(null)
    setDrawer(null)
    setEditing(null)
    setNotifications(false)
    setAccount(false)
    setHelp(false)
    setLeaveTarget(null)
    const home = modeHome(next)
    if (home === "stock") navigate("stock", true)
    else chooseParking(home, undefined, false, true)
  }
  function navigateHome() {
    const home = modeHome(handoffMode)
    if (home === "stock") navigate("stock")
    else chooseParking(home)
  }
  function changeParkingAccess(access: ParkingAccess, force = false) {
    if (parkingDirty && !force) { setLeaveTarget({ access }); return }
    setParkingAccess(access)
    setParkingDirty(false)
    setAccount(false)
    if (parking) setParkingParams(new URLSearchParams())
    try { localStorage.setItem("vparking:parking:demo-access", JSON.stringify(access)) } catch {}
  }
  function runReport() {
    if (error) return
    setPreviewState("ready")
    setLoading(true)
    window.setTimeout(() => {
      setApplied({ ...draft })
      setReady(true)
      setLoading(false)
      setPage(1)
      setDrawer(null)
    }, 450)
  }
  function reset() {
    setPreviewState("ready")
    setDraft(defaults)
    setApplied(defaults)
    setSearch("")
    setQuery("")
    setPage(1)
    setReady(true)
  }
  function openDetail(card: Card) {
    setDetail(card)
    setDetailTab("Thông tin thẻ")
  }
  function openReportLookup(selection: ReportLookupSelection) {
    chooseOperation("lookup")
    setLookupFilters(reportLookupFilters(applied, selection))
    setLookupFromReport(true)
    window.scrollTo(0, 0)
  }
  function openWarehouseLookup(filters: CardLookupFilters, focusCardId?: string) {
    chooseOperation("lookup")
    setLookupFilters(filters)
    if (focusCardId) setOperationFocus(focusCardId)
  }
  function openManagedCard(card: Card, subscriberId: string) {
    chooseOperation("lookup")
    setLookupFilters({ ...defaultCardLookupFilters, keyword: card.id })
    setManagementOrigin(subscriberId)
    setOperationFocus(card.id)
  }
  function navigateManagement(id: ManagementScreen, focus?: string) {
    chooseOperation(id)
    if (focus) setOperationFocus(focus)
  }
  function stockValues(e: typeof estates[number]) {
    return stockMetrics({ ...applied, estate: e.id })
  }
  const sumValues = selectedEstates.reduce(
    (a, e) => a.map((v, i) => v + stockValues(e)[i]),
    Array(8).fill(0) as number[],
  )
  function closeEdit() {
    if (JSON.stringify(edit) !== originalEdit) setDiscard(true)
    else setEditing(null)
  }
  const editErrors = {
    expiry:
      !Number.isInteger(edit.expiry) || edit.expiry < 1 || edit.expiry > 90
        ? "Nhập số nguyên từ 1 đến 90 ngày."
        : "",
    loss:
      !Number.isFinite(edit.loss) ||
      edit.loss < 0 ||
      edit.loss > 100 ||
      Number(edit.loss.toFixed(2)) !== edit.loss
        ? "Nhập từ 0 đến 100%, tối đa 2 số thập phân."
        : "",
    unused:
      !Number.isInteger(edit.unused) || edit.unused < 1 || edit.unused > 365
        ? "Nhập số nguyên từ 1 đến 365 ngày."
        : "",
    effective:
      !edit.effective || edit.effective <= today
        ? "Ngày áp dụng phải sau ngày 29/10/2026."
        : "",
  }
  function saveThreshold() {
    if (
      !editing ||
      Object.values(editErrors).some(Boolean) ||
      JSON.stringify(edit) === originalEdit
    )
      return
    setChanges((old) => [
      {
        estate: editing,
        previous: thresholds[editing],
        next: { ...edit },
        actor: parkingRoles[parkingAccess.role],
        at: "29/10/2026 14:30",
      },
      ...old,
    ])
    setThresholds((old) => ({ ...old, [editing]: { ...edit } }))
    setEditing(null)
    setToast(
      "Đã lưu tham số. Giá trị mới có hiệu lực từ " +
        date(edit.effective) +
        ".",
    )
  }
  function currentThreshold(eid: string, day = applied.end) {
    const t = thresholds[eid]
    return t.effective <= day ? t : initialThresholds[eid]
  }
  async function exportReport() {
    if (exporting) return
    setExporting(true)
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.utils.book_new()
      const sanitize = (value: unknown) =>
        typeof value === "string" && /^[=+\-@]/.test(value)
          ? `'${value}`
          : value
      const add = (name: string, rows: Record<string, unknown>[]) => {
        const clean = rows.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [k, sanitize(v)]),
          ),
        )
        const ws = XLSX.utils.json_to_sheet(clean)
        for (const key of Object.keys(ws)) {
          const cell = ws[key]
          if (cell?.v instanceof Date)
            cell.z =
              cell.v.getHours() || cell.v.getMinutes()
                ? "dd/mm/yyyy hh:mm"
                : "dd/mm/yyyy"
        }
        ws["!cols"] = Object.keys(clean[0] || {}).map(() => ({ wch: 24 }))
        XLSX.utils.book_append_sheet(wb, ws, name)
      }
      const cardRows = (items: Card[]) =>
        items.map((c) =>
          Object.fromEntries(
            Object.keys(columnNames).map((key) => [
              columnNames[key],
              key === "estate"
                ? estateName(c.estate)
                : key === "alerts"
                  ? c.alerts.map((i) => alertNames[i]).join(", ") || "—"
                  : key === "expiry" || key === "issued" || key === "lastTrip"
                    ? c[key]
                      ? new Date(`${c[key]}T00:00:00`)
                      : "—"
                    : c[(key as keyof Card)],
            ]),
          ),
        )
      if (screen !== "stock")
        add("ThongTin", [
          {
            "Báo cáo": title.title,
            "Ngày chốt": new Date(applied.end),
            "Dữ liệu chốt đến": new Date(maxDate),
            "Khu đô thị": applied.estate
              ? estateName(applied.estate)
              : "Tất cả",
            "Bãi xe": applied.park || "Tất cả",
            "Loại thẻ": applied.type || "Tất cả",
            "Phương tiện": applied.vehicle || "Tất cả",
            "Từ khóa": query || "—",
            "Người xuất": "Admin Local",
            "Thời điểm xuất": new Date(),
            Nguồn: "Dữ liệu minh họa",
          },
        ])
      if (screen === "stock") {
        add("ThongTin", [
          {
            "Báo cáo": title.title,
            "Từ ngày": new Date(applied.start),
            "Đến ngày": new Date(applied.end),
            "Dữ liệu chốt đến": new Date(maxDate),
            "Khu đô thị": applied.estate
              ? estateName(applied.estate)
              : "Tất cả",
            "Bãi xe": applied.park || "Tất cả",
            "Loại thẻ": applied.type || "Tất cả",
            "Phương tiện": applied.vehicle || "Tất cả",
            "Người xuất": "Admin Local",
            "Thời điểm xuất": new Date(),
            Nguồn: "Dữ liệu minh họa",
          },
        ])
        add("1-TongQuan", [
          {
            "Tổng thẻ": stockCount + circulating.length,
            "Tồn kho": stockCount,
            "Lưu hành": circulating.length,
            "Đang hoạt động": active,
            "Khóa / hết hạn": locked + expired,
            "Cấp ra": sumValues[3],
            "Thu về": sumValues[4],
            "Mất / hỏng": sumValues[5],
            "Tỷ lệ sử dụng (%)":
              (active / (stockCount + circulating.length)) * 100,
            "Tỷ lệ mất / hỏng (%)":
              (sumValues[5] / (sumValues[0] + sumValues[1])) * 100,
          },
        ])
        add(
          "2-BienDongKho",
          selectedEstates.flatMap((e) =>
            e.parks
              .filter((p) => !applied.park || p === applied.park)
              .map((p) => {
                const v = stockMetrics({ ...applied, estate: e.id, park: p })
                const losses = lossBreakdown({
                  ...applied,
                  estate: e.id,
                  park: p,
                })
                return {
                  "Khu đô thị": e.name,
                  "Kho bãi": p,
                  "Tồn kho đầu kỳ": v[0],
                  "Lưu hành đầu kỳ": v[1],
                  "Nhập mới": v[2],
                  "Cấp ra": v[3],
                  "Thu về": v[4],
                  "Mất / hỏng": v[5],
                  "Mất trong kho": losses.warehouseLost,
                  "Hỏng trong kho": losses.warehouseDamaged,
                  "Mất khi lưu hành": losses.circulatingLost,
                  "Hỏng khi lưu hành": losses.circulatingDamaged,
                  "Tồn kho cuối kỳ": v[6],
                  "Lưu hành cuối kỳ": v[7],
                }
              }),
          ),
        )
        add(
          "3-LuuHanh",
          selectedEstates.flatMap((e) =>
            dashboard.groups.map((group) => ({
              "Khu đô thị": e.name,
              [groupBy]: group.label,
              "Đang lưu hành": group.cards.filter((c) => c.estate === e.id)
                .length,
              "Đang hoạt động": group.cards.filter(
                (c) =>
                  c.estate === e.id &&
                  c.status === "Đang hoạt động" &&
                  (!c.expiry || c.expiry >= applied.end),
              ).length,
              Khóa: group.cards.filter(
                (c) => c.estate === e.id && c.status === "Khóa",
              ).length,
              "Hết hạn": group.cards.filter(
                (c) =>
                  c.estate === e.id &&
                  c.status === "Đang hoạt động" &&
                  c.expiry &&
                  c.expiry < applied.end,
              ).length,
            })),
          ),
        )
        add(
          "4-CanhBao",
          selectedEstates.map((e) => ({
            "Khu đô thị": e.name,
            ...Object.fromEntries(
              cardAlertIds.map((id) => [
                alertNames[id],
                baseCards.filter(
                  (c) => c.estate === e.id && c.alerts.includes(id),
                ).length,
              ]),
            ),
            "Tổng số thẻ có cảnh báo": baseCards.filter(
              (c) => c.estate === e.id && c.alerts.length,
            ).length,
          })),
        )
        add(
          "5-ChiTiet",
          cardRows(filterCards(reportCards, applied, query, true)),
        )
      } else if (screen === "alerts") {
        cardAlertIds.forEach((id, i) =>
          add(
            `${i + 1}-${["SapHetHan", "KhongKhop", "KhongSuDung"][i]}`,
            cardRows(baseCards.filter((c) => c.alerts.includes(id))),
          ),
        )
        add("TongHop", [
          {
            "Tổng số thẻ có cảnh báo": baseCards.filter(
              (c) => c.alerts.length > 0,
            ).length,
          },
        ])
      } else if (screen === "circulation") {
        const categories =
          groupBy === "Loại thẻ"
            ? cardTypes
            : groupBy === "Loại phương tiện"
              ? vehicles
              : [...customerGroups, "VIP và Vãng lai"]
        add(
          "TheLuuHanh",
          selectedEstates.flatMap((e) =>
            categories.map((category) => {
              const rows = circulating.filter(
                (c) =>
                  c.estate === e.id &&
                  (groupBy === "Loại thẻ"
                    ? c.type === category
                    : groupBy === "Loại phương tiện"
                      ? c.vehicle === category
                      : category === "VIP và Vãng lai"
                        ? c.type !== "Thuê bao tháng"
                        : c.type === "Thuê bao tháng" && c.group === category),
              )
              return {
                "Khu đô thị": e.name,
                [groupBy]: category,
                "Đang lưu hành": rows.length,
                "Đang hoạt động": rows.filter(
                  (c) =>
                    c.status === "Đang hoạt động" &&
                    (!c.expiry || c.expiry >= applied.end),
                ).length,
                Khóa: rows.filter((c) => c.status === "Khóa").length,
                "Hết hạn": rows.filter(
                  (c) =>
                    c.status === "Đang hoạt động" &&
                    c.expiry &&
                    c.expiry < applied.end,
                ).length,
              }
            }),
          ),
        )
      } else add("DanhSachThe", cardRows(listCards))
      const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14)
      XLSX.writeFile(wb, `VParking_${screen}_${stamp}.xlsx`, {
        cellDates: true,
      })
      setToast("Đã tải báo cáo Excel theo điều kiện đang áp dụng.")
    } catch {
      setToast(
        "Không thể xuất báo cáo. Vui lòng thử lại; bộ lọc vẫn được giữ nguyên.",
      )
    } finally {
      setExporting(false)
    }
  }

  const renderFilterFields = (extra = false) => (
    <>
      {!extra && (
        <>
          <Field label="Khu đô thị">
            <Select
              aria-label="Khu đô thị"
              value={draft.estate}
              onChange={(e) => update("estate", e.target.value)}
              options={[
                { value: "", label: "Tất cả khu đô thị" },
                ...estates.map((e) => ({ value: e.id, label: e.name })),
              ]}
            />
          </Field>
          <Field label="Bãi xe">
            <Select
              aria-label="Bãi xe"
              value={draft.park ? `${draft.estate}:${draft.park}` : ""}
              onChange={(e) => {
                if (!e.target.value) update("park", "")
                else {
                  const [estate, park] = e.target.value.split(":")
                  setDraft((old) => ({ ...old, estate, park }))
                }
              }}
              options={[
                { value: "", label: "Tất cả bãi xe" },
                ...estates
                  .filter((e) => !draft.estate || e.id === draft.estate)
                  .flatMap((e) =>
                    e.parks.map((p) => ({
                      value: `${e.id}:${p}`,
                      label: `${p} · ${e.short}`,
                    })),
                  ),
              ]}
            />
          </Field>
          <Field label="Loại thẻ">
            <Select
              aria-label="Loại thẻ"
              value={draft.type}
              onChange={(e) => update("type", e.target.value)}
              options={[{ value: "", label: "Tất cả loại thẻ" }, ...cardTypes]}
            />
          </Field>
          <Field label="Phương tiện">
            <Select
              aria-label="Phương tiện"
              value={draft.vehicle}
              onChange={(e) => update("vehicle", e.target.value)}
              options={[
                { value: "", label: "Tất cả phương tiện" },
                ...vehicles,
              ]}
            />
          </Field>
        </>
      )}
      {extra && (
        <>
          <Field label="Trạng thái">
            <Select
              aria-label="Trạng thái"
              value={draft.status}
              onChange={(e) => update("status", e.target.value)}
              options={[
                { value: "", label: "Tất cả (trừ Mất / hỏng)" },
                "Trong kho",
                "Đang hoạt động",
                "Khóa",
                "Mất / hỏng",
              ]}
            />
          </Field>
          <Field label="Cảnh báo">
            <Select
              aria-label="Cảnh báo"
              value={draft.alert}
              onChange={(e) => update("alert", e.target.value)}
              options={[
                { value: "", label: "Tất cả cảnh báo" },
                ...cardAlertIds.map((id) => ({
                  value: String(id + 1),
                  label: alertNames[id],
                })),
              ]}
            />
          </Field>
          <Field label="Hiệu lực đến">
            <Input
              aria-label="Hiệu lực đến"
              type="date"
              value={draft.expiry}
              onChange={(e) => update("expiry", e.target.value)}
            />
          </Field>
        </>
      )}
    </>
  )
  const cellNumber = (value: number, onClick: () => void, cls = "") => (
    <Button variant="link" className={`number-link ${cls}`} onClick={onClick} disabled={!value}>
      {fmt(value)}
    </Button>
  )

  function renderStock() {
    const rows = sort
      ? [...selectedEstates].sort((a, b) => {
          const av = stockValues(a),
            bv = stockValues(b)
          return (
            bv[5] / Math.max(1, bv[0] + bv[1]) -
            av[5] / Math.max(1, av[0] + av[1])
          )
        })
      : selectedEstates
    return (
      <>
        <section className="panel report-panel">
          <div className="panel-heading">
            <div>
              <Heading>Chi tiết biến động kho thẻ</Heading>
            </div>
            <div className="panel-tools">
              <span className="unit-label">Đơn vị: thẻ / lần</span>
              <Button
                variant="ghost"
                onClick={() =>
                  setExpanded(
                    expanded.length === estates.length
                      ? []
                      : estates.map((e) => e.id),
                  )
                }
              >
                <ChevronsRight size={15} />
                {expanded.length === estates.length
                  ? "Thu gọn tất cả"
                  : "Mở rộng tất cả"}
              </Button>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table stock-table">
              <thead>
                <tr>
                  <th rowSpan={2} className="unit-column">
                    Đơn vị quản lý
                  </th>
                  <th colSpan={2}>Đầu kỳ</th>
                  <th colSpan={4}>Phát sinh trong kỳ</th>
                  <th colSpan={2} className="end-group">
                    Cuối kỳ
                  </th>
                  <th rowSpan={2}>
                    <Button
                      variant="ghost"
                      onClick={() => setSort(!sort)}
                      className="sort-button"
                    >
                      Tỷ lệ mất / hỏng
                      <ChevronDown size={12} />
                    </Button>
                  </th>
                  <th rowSpan={2}>Định mức</th>
                </tr>
                <tr>
                  {[
                    "Tồn kho",
                    "Lưu hành",
                    "Nhập mới",
                    "Cấp ra",
                    "Thu về",
                    "Mất / hỏng",
                    "Tồn kho",
                    "Lưu hành",
                  ].map((n, i) => (
                    <th key={i} className={i >= 6 ? "end-group" : ""}>
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="total-row">
                  <td>
                    <span className="total-symbol">
                      <ChartNoAxesCombined size={16} />
                    </span>
                    Tổng cộng{" "}
                    <span className="row-count">
                      {selectedEstates.length} khu đô thị
                    </span>
                  </td>
                  {sumValues.map((n, i) => (
                    <td key={i}>
                      {cellNumber(
                        n,
                        () => openReportLookup({ kind: "metric", index: i }),
                        i >= 6 ? "strong-number" : "",
                      )}
                    </td>
                  ))}
                  <td>
                    {percent(
                      (sumValues[5] / (sumValues[0] + sumValues[1])) * 100,
                    )}
                  </td>
                  <td>—</td>
                </tr>
                {rows.map((e) => {
                  const v = stockValues(e),
                    rate = (v[5] / (v[0] + v[1])) * 100,
                    over = rate > currentThreshold(e.id).loss
                  return (
                    <FragmentRows key={e.id}>
                      <tr
                        className={
                          (previewState === "mismatch" && e.id === "B"
                            ? "mismatch-row "
                            : "") +
                          (expanded.includes(e.id)
                            ? "parent-row is-expanded"
                            : "parent-row")
                        }
                      >
                        <td>
                          <Button
                            variant="ghost"
                            className="estate-toggle"
                            onClick={() => toggleExpanded(e.id)}
                            aria-expanded={expanded.includes(e.id)}
                          >
                            {expanded.includes(e.id) ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                            <span className="estate-icon">
                              <Building2 size={16} />
                            </span>
                            <span>
                              {e.name}
                              <span className="estate-code">
                                {e.code} · 3 bãi xe
                              </span>
                            </span>
                          </Button>
                        </td>
                        {v.map((n, i) => (
                          <td key={i}>
                            {cellNumber(
                              n,
                              () => openReportLookup({ kind: "metric", index: i, estate: e.id }),
                              i >= 6 ? "strong-number" : "",
                            )}
                          </td>
                        ))}
                        <td>
                          <span className={over ? "exceeded" : ""}>
                            {
                              <>
                                {over && <TriangleAlert size={12} />}
                                {percent(rate)}
                              </>
                            }
                          </span>
                        </td>
                        <td className="muted">
                          {percent(currentThreshold(e.id).loss)}
                        </td>
                      </tr>
                      {expanded.includes(e.id) &&
                        e.parks
                          .filter((p) => !applied.park || p === applied.park)
                          .map((p) => {
                            const values = stockMetrics({
                              ...applied,
                              estate: e.id,
                              park: p,
                            })
                            const vals = values
                            return (
                              <tr className="child-row" key={p}>
                                <td>
                                  <span className="tree-line" />
                                  <CarFront size={14} />
                                  <span>{p}</span>
                                </td>
                                {vals.map((n, i) => (
                                  <td key={i}>
                                    {n === null ? (
                                      <span className="dash">—</span>
                                    ) : (
                                      cellNumber(n, () => openReportLookup({ kind: "metric", index: i, estate: e.id, park: p }))
                                    )}
                                  </td>
                                ))}
                                <td className="dash">—</td>
                                <td className="dash">—</td>
                              </tr>
                            )
                          })}
                    </FragmentRows>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="table-bottom">
            <span>
              <span className="table-dot" />
              {selectedEstates.length} khu đô thị{" "}
              <span className="sub-divider" />
              {applied.park ? 1 : selectedEstates.length * 3} bãi xe
            </span>
            <span>
              <Info size={13} />
              Bấm vào số liệu để xem danh sách thẻ
            </span>
          </div>
        </section>
        {previewState !== "mismatch" && (
          <div className="reconciliation">
            <div className="reconcile-icon">
              <CheckCheck size={19} />
            </div>
            <div>
              <span className="reconcile-title">Số liệu đã được đối soát</span>
              <span className="reconcile-detail">
                Tồn kho và lưu hành cuối kỳ khớp với số đầu kỳ và các phát sinh
                trong kỳ.
              </span>
            </div>
            <span className="reconcile-status">
              <CircleCheck size={14} />
              Khớp số liệu
            </span>
          </div>
        )}
        <div className="notes-grid">
          <section className="info-note">
            <div className="note-icon">
              <BookOpen size={17} />
            </div>
            <div>
              <Heading level={3}>Cách đọc báo cáo</Heading>
              <div>
                Tồn kho được quản lý riêng tại từng bãi xe và tổng hợp lên khu
                đô thị. Các chỉ tiêu cấp ra, thu về và mất / hỏng được tính theo{" "}
                <strong>số lần phát sinh</strong>.
              </div>
            </div>
          </section>
          <section className="info-note">
            <div className="note-icon amber">
              <TriangleAlert size={17} />
            </div>
            <div>
              <Heading level={3}>Lưu ý về định mức</Heading>
              <div>
                <span className="text-red">Tỷ lệ có biểu tượng cảnh báo</span>{" "}
                là tỷ lệ mất / hỏng vượt định mức riêng của khu đô thị.{" "}
                <Button variant="link" onClick={() => navigate("settings")}>
                  Xem cấu hình <ArrowRight size={12} />
                </Button>
              </div>
            </div>
          </section>
        </div>
      </>
    )
  }
  function renderCirculation() {
    const categories = circulationGroups(groupBy)
    const byCategory = (rows: Card[], cat: string) =>
      rows.filter((c) => inCirculationGroup(c, groupBy, cat))
    const row = (
      label: string,
      items: Card[],
      parent: number,
      child = false,
      estateId = "",
    ) => {
      const estateRow = estateId && !child
      const category = label === "Tổng cộng" || estateRow ? undefined : label
      const statusRows = circulationStatuses.map((status) =>
        items.filter((c) => circulationStatus(c, applied.end) === status),
      )
      return (
        <tr
          key={label}
          className={
            label === "Tổng cộng"
              ? "total-row"
              : child
                ? "child-row"
                : "parent-row"
          }
        >
          <td>
            {estateRow ? (
              <Button
                variant="ghost"
                className="estate-toggle"
                onClick={() => toggleExpanded(estateId)}
              >
                {expanded.includes(estateId) ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <Building2 size={16} />
                {label}
              </Button>
            ) : (
              <span className={child ? "indent-label" : "category-label"}>
                {label === "Tổng cộng" ? (
                  <ChartNoAxesCombined size={16} />
                ) : (
                  <CreditCard size={15} />
                )}
                {label}
              </span>
            )}
          </td>
          {[items, ...statusRows].map((rs, i) => (
            <td key={i}>
              {cellNumber(
                rs.length,
                () =>
                  openReportLookup({
                    kind: "circulation",
                    groupBy,
                    group: category,
                    status: i ? circulationStatuses[i - 1] : undefined,
                    estate: estateId,
                  }),
                i === 0 ? "strong-number" : "",
              )}
            </td>
          ))}
          <td>
            <span className="activity-rate">
              {items.length
                ? percent((statusRows[0].length / items.length) * 100)
                : "—"}
            </span>
          </td>
          <td>
            <div className="share-cell">
              <span>
                {parent ? percent((items.length / parent) * 100) : "—"}
              </span>
              <progress
                max="100"
                value={parent ? (items.length / parent) * 100 : 0}
              />
            </div>
          </td>
        </tr>
      )
    }
    return (
      <>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <Heading>Cơ cấu thẻ đang lưu hành</Heading>
              <span className="muted">
                Số liệu tại 23:59:59 ngày {date(applied.end)}
              </span>
            </div>
            <div className="group-tools">
              <Label className="switch-label">
                <Input
                  type="checkbox"
                  role="switch"
                  checked={split}
                  onChange={(e) => setSplit(e.target.checked)}
                />
                <span className="switch-track" />
                Tách theo khu đô thị
              </Label>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table circulation-table">
              <thead>
                <tr>
                  <th>
                    {split ? "Khu đô thị / " : ""}
                    {groupBy}
                  </th>
                  {[
                    "Đang lưu hành",
                    "Đang hoạt động",
                    "Khóa",
                    "Hết hạn",
                    "Tỷ lệ hoạt động",
                    "Tỷ trọng",
                  ].map((n) => (
                    <th key={n}>{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row("Tổng cộng", circulating, circulating.length)}
                {split
                  ? selectedEstates.map((e) => (
                      <FragmentRows key={e.id}>
                        {row(
                          e.name,
                          circulating.filter((c) => c.estate === e.id),
                          circulating.length,
                          false,
                          e.id,
                        )}
                        {expanded.includes(e.id) &&
                          categories.map((cat) => {
                            const rs = circulating.filter(
                              (c) => c.estate === e.id,
                            )
                            return row(
                              cat,
                              byCategory(rs, cat),
                              rs.length,
                              true,
                              e.id,
                            )
                          })}
                      </FragmentRows>
                    ))
                  : categories.map((cat) =>
                      row(
                        cat,
                        byCategory(circulating, cat),
                        circulating.length,
                      ),
                    )}
              </tbody>
            </table>
          </div>
          <div className="table-bottom">
            <span>
              {split ? selectedEstates.length : categories.length} phân loại
            </span>
            <span>
              <Info size={13} />
              Đang lưu hành = Đang hoạt động + Khóa + Hết hạn
            </span>
          </div>
        </section>
      </>
    )
  }
  function tableFooter(count: number) {
    return (
      <div className="pagination">
        <span className="muted">
          {count
            ? `${fmt((page - 1) * pageSize + 1)}–${fmt(Math.min(page * pageSize, count))} trên ${fmt(count)}`
            : "0 kết quả"}
        </span>
        <div className="pagination-controls">
          <Button
            variant="ghost"
            disabled={page === 1}
            onClick={() => setPage(1)}
            aria-label="Trang đầu"
          >
            <ChevronsLeft size={15} />
          </Button>
          <Button
            variant="ghost"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            aria-label="Trang trước"
          >
            <ChevronLeft size={15} />
          </Button>
          {Array.from({ length: Math.min(pages, 4) }, (_, i) => i + 1).map(
            (p) => (
              <Button
                key={p}
                variant="ghost"
                className={page === p ? "page-selected" : ""}
                onClick={() => setPage(p)}
              >
                {p}
              </Button>
            ),
          )}
          {pages > 4 && (
            <>
              <span>…</span>
              <Button
                variant="ghost"
                className={page > 4 ? "page-selected" : ""}
                onClick={() => setPage(pages)}
              >
                {page > 4 ? page : pages}
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
            aria-label="Trang sau"
          >
            <ChevronRight size={15} />
          </Button>
          <Button
            variant="ghost"
            disabled={page >= pages}
            onClick={() => setPage(pages)}
            aria-label="Trang cuối"
          >
            <ChevronsRight size={15} />
          </Button>
          <Select
            aria-label="Số dòng mỗi trang"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            options={[20, 50, 100].map((n) => ({
              value: String(n),
              label: `${n} / trang`,
            }))}
          />
        </div>
      </div>
    )
  }
  function cardCell(card: Card, key: string) {
    if (key === "id")
      return (
        <Button
          variant="link"
          className="card-id"
          onClick={() => openDetail(card)}
        >
          {card.id}
        </Button>
      )
    if (key === "estate")
      return (
        <span title={estateName(card.estate)}>
          {estates.find((e) => e.id === card.estate)?.short}
        </span>
      )
    if (key === "status")
      return (
        <Badge
          tone={
            card.status === "Đang hoạt động"
              ? "green"
              : card.status === "Trong kho"
                ? "blue"
                : card.status === "Mất / hỏng"
                  ? "red"
                  : "neutral"
          }
        >
          {card.status}
        </Badge>
      )
    if (key === "expiry" || key === "issued" || key === "lastTrip")
      return (
        <span
          className={
            key === "expiry" && card.expiry && card.expiry < applied.end
              ? "text-red"
              : ""
          }
        >
          {date(card[key])}
        </span>
      )
    if (key === "alerts")
      return card.alerts.length ? (
        <span
          className="inline-alert"
          title={card.alerts.map((a) => alertNames[a]).join(", ")}
        >
          <TriangleAlert size={13} />
          {card.alerts.length} cảnh báo
        </span>
      ) : (
        <span className="dash">—</span>
      )
    if (key === "type")
      return (
        <span
          className={`type-label ${card.type === "VIP" ? "vip-label" : ""}`}
        >
          {card.type}
        </span>
      )
    return String(card[(key as keyof Card)] || "—")
  }
  const searchBox = (
    <div className="search-box">
      <Search size={16} />
      <Input
        aria-label="Tìm kiếm thẻ"
        maxLength={100}
        placeholder={
          screen === "alerts"
            ? "Tìm mã thẻ, biển số…"
            : "Tìm mã thẻ, biển số, mã thuê bao…"
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
  )
  const empty = (
    <div className="empty-state">
      <div className="empty-icon">
        <Search size={26} />
      </div>
      <Heading level={3}>Không có kết quả phù hợp</Heading>
      <span className="muted">
        Thử thay đổi từ khóa hoặc điều kiện lọc để tìm thẻ.
      </span>
      <Button onClick={reset}>Xóa bộ lọc</Button>
    </div>
  )
  function renderCards() {
    const visibleColumns = columns.filter(
      (k) => k !== "estate" || !applied.estate,
    )
    return (
      <>
        <div className="drill-banner">
          <Button variant="ghost" onClick={() => navigate("stock")}>
            <ArrowLeft size={15} />
            Quay lại báo cáo
          </Button>
          <span>Dữ liệu thẻ tại ngày chốt, dùng để đối chiếu báo cáo.</span>
        </div>
        <section className="panel cards-panel">
          <div className="table-toolbar">
            <div className="search-area">
              {searchBox}
              {search.trim().length > 0 && search.trim().length < 3 && (
                <span className="search-hint">Nhập ít nhất 3 ký tự</span>
              )}
            </div>
            <div className="panel-tools">
              <span className="count-text">
                <strong>{fmt(totalRows)}</strong> thẻ xe
              </span>
              <Button
                onClick={() => {
                  setColumnDraft([...columns])
                  setDrawer("columns")
                }}
              >
                <SlidersHorizontal size={15} />
                Tùy chỉnh cột
              </Button>
              <Button onClick={() => setDrawer("filter")}>
                <ListFilter size={15} />
                Bộ lọc
                {(applied.status || applied.alert || applied.expiry) && (
                  <span className="filter-dot" />
                )}
              </Button>
            </div>
          </div>
          {totalRows ? (
            <div className="table-scroll">
              <table className="data-table cards-table">
                <thead>
                  <tr>
                    <th className="index-column">STT</th>
                    {visibleColumns.map((k) => (
                      <th key={k}>
                        <Button
                          className="column-sort"
                          variant="ghost"
                          onClick={() => {
                            setSortKey(k)
                            setSortDesc(sortKey === k ? !sortDesc : false)
                            setPage(1)
                          }}
                        >
                          {columnNames[k]}
                          {sortKey === k && (
                            <ChevronDown
                              size={11}
                              className={sortDesc ? "rotated" : ""}
                            />
                          )}
                        </Button>
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {listCards
                    .slice((page - 1) * pageSize, page * pageSize)
                    .map((c, i) => (
                      <tr key={c.id}>
                        <td className="muted">
                          {(page - 1) * pageSize + i + 1}
                        </td>
                        {visibleColumns.map((k) => (
                          <td key={k}>{cardCell(c, k)}</td>
                        ))}
                        <td>
                          <Button
                            variant="ghost"
                            aria-label={`Xem ${c.id}`}
                            onClick={() => openDetail(c)}
                          >
                            <ChevronRight size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            empty
          )}
          {tableFooter(totalRows)}
        </section>
        <div className="under-table-note">
          <ShieldCheck size={14} />
          Số điện thoại được che theo quyền truy cập.
        </div>
      </>
    )
  }
  async function exportSettings() {
    if (exporting) return
    setExporting(true)
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.utils.book_new()
      const scoped = estates.filter(
        (e) => !parkingAccess.estate || e.id === parkingAccess.estate,
      )
      const rows = scoped.map((e) => ({
        "Khu đô thị": e.name,
        "Mã KĐT": e.code,
        "Sắp hết hạn (ngày)": thresholds[e.id].expiry,
        "Định mức mất / hỏng (%)": thresholds[e.id].loss,
        "Không sử dụng (ngày)": thresholds[e.id].unused,
        "Áp dụng từ": date(thresholds[e.id].effective),
        "Trạng thái":
          thresholds[e.id].effective > today ? "Sắp áp dụng" : "Đang áp dụng",
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ws["!cols"] = Object.keys(rows[0] || {}).map(() => ({ wch: 24 }))
      XLSX.utils.book_append_sheet(wb, ws, "ThamSoBaoCaoTheXe")
      XLSX.writeFile(wb, `ThamSoBaoCaoTheXe_${today}.xlsx`)
      setToast("Đã xuất tham số báo cáo thẻ xe.")
    } catch {
      setToast("Không thể xuất dữ liệu. Vui lòng thử lại.")
    } finally {
      setExporting(false)
    }
  }
  function renderSettings() {
    const scopedEstates = estates.filter(
      (e) => !parkingAccess.estate || e.id === parkingAccess.estate,
    )
    const statusOf = (id: string) =>
      thresholds[id].effective > today ? "Sắp áp dụng" : "Đang áp dụng"
    const visibleEstates = scopedEstates.filter((e) => {
      const q = normalize(settingsFilter.q)
      const matchesQ = !q || normalize(`${e.name} ${e.code} ${e.short}`).includes(q)
      const matchesEstate =
        !settingsFilter.estates.length || settingsFilter.estates.includes(e.id)
      const matchesStatus =
        !settingsFilter.statuses.length ||
        settingsFilter.statuses.includes(statusOf(e.id))
      return matchesQ && matchesEstate && matchesStatus
    })
    const scopedChanges = changes.filter(
      (c) =>
        (!parkingAccess.estate || c.estate === parkingAccess.estate) &&
        (!settingsFilter.estates.length ||
          settingsFilter.estates.includes(c.estate)),
    )
    const pendingFilter =
      JSON.stringify(settingsFilterDraft) !== JSON.stringify(settingsFilter)
    const clearSettingsFilters = () => {
      const empty = { q: "", estates: [] as string[], statuses: [] as string[] }
      setSettingsFilterDraft(empty)
      setSettingsFilter(empty)
    }
    const canEditCardSettings = ["admin", "manager", "it"].includes(
      parkingAccess.role,
    )
    return (
      <>
        <div className="settings-info">
          <Info size={16} />
          <span>
            Tham số được thiết lập theo khu đô thị. Thay đổi chỉ áp dụng từ ngày
            hiệu lực, không làm thay đổi báo cáo của các ngày trước.
          </span>
        </div>
        <LookupFilterPanel
          label="Bộ lọc Tham số báo cáo thẻ xe"
          pending={pendingFilter}
          onApply={() => setSettingsFilter(settingsFilterDraft)}
          onClear={clearSettingsFilters}
        >
          <div className="filter-grid config-filter-grid">
            <Field label="Tìm kiếm">
              <Input
                type="search"
                aria-label="Tìm khu đô thị"
                maxLength={100}
                placeholder="Tên hoặc mã khu đô thị…"
                value={settingsFilterDraft.q}
                onChange={(e) =>
                  setSettingsFilterDraft((prev) => ({
                    ...prev,
                    q: e.target.value,
                  }))
                }
              />
            </Field>
            <CardLookupMultiFilter
              label="Khu đô thị"
              value={settingsFilterDraft.estates}
              allLabel="Tất cả khu đô thị"
              options={scopedEstates.map((e) => ({
                value: e.id,
                label: e.name,
              }))}
              onChange={(estates) =>
                setSettingsFilterDraft((prev) => ({ ...prev, estates }))
              }
            />
            <CardLookupMultiFilter
              label="Trạng thái"
              value={settingsFilterDraft.statuses}
              allLabel="Tất cả trạng thái"
              options={["Đang áp dụng", "Sắp áp dụng"].map((value) => ({
                value,
                label: value,
              }))}
              onChange={(statuses) =>
                setSettingsFilterDraft((prev) => ({ ...prev, statuses }))
              }
            />
          </div>
          <p className="lookup-multi-hint">{lookupMatchHint}</p>
        </LookupFilterPanel>
        <section className="panel">
          <div className="op-table-toolbar lookup-table-toolbar">
            <div className="lookup-result-summary">
              <span className="count-text" aria-live="polite">
                <strong>{fmt(visibleEstates.length)}</strong> khu đô thị
              </span>
            </div>
            <Button onClick={() => setSettingsHistoryOpen(true)}>
              <History size={15} /> Lịch sử thay đổi
              {scopedChanges.length > 0 && (
                <span className="tab-counter">{scopedChanges.length}</span>
              )}
            </Button>
          </div>
          {visibleEstates.length ? (
            <div className="table-scroll">
              <table className="data-table op-table">
                <thead>
                  <tr>
                    <th>Khu đô thị</th>
                    <th className="parking-number">
                      Sắp hết hạn <span className="header-unit">(ngày)</span>
                    </th>
                    <th className="parking-number">
                      Định mức mất / hỏng{" "}
                      <span className="header-unit">(%)</span>
                    </th>
                    <th className="parking-number">
                      Không sử dụng <span className="header-unit">(ngày)</span>
                    </th>
                    <th>Áp dụng từ</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEstates.map((e) => {
                    const state = statusOf(e.id)
                    return (
                      <tr key={e.id}>
                        <td>
                          <div className="estate-name-cell">
                            <span className="estate-icon">
                              <Building2 size={16} />
                            </span>
                            <span>
                              <strong>{e.name}</strong>
                              <span className="estate-code">{e.code}</span>
                            </span>
                          </div>
                        </td>
                        <td className="parking-number">
                          {thresholds[e.id].expiry}
                        </td>
                        <td className="parking-number">
                          {percent(thresholds[e.id].loss, 2)}
                        </td>
                        <td className="parking-number">
                          {thresholds[e.id].unused}
                        </td>
                        <td>{date(thresholds[e.id].effective)}</td>
                        <td>
                          <Badge tone={state === "Sắp áp dụng" ? "amber" : "green"}>
                            {state}
                          </Badge>
                        </td>
                        <td>
                          <div className="op-row-actions">
                            {canEditCardSettings ? (
                              <Button
                                variant="ghost"
                                title="Sửa tham số"
                                aria-label={`Sửa tham số ${e.name}`}
                                onClick={() => {
                                  const value = {
                                    ...thresholds[e.id],
                                    effective: "2026-10-30",
                                  }
                                  setEditing(e.id)
                                  setEdit(value)
                                  setOriginalEdit(JSON.stringify(value))
                                }}
                              >
                                <Pencil size={14} />
                              </Button>
                            ) : (
                              "—"
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="parking-empty">
              <p>Không có khu đô thị phù hợp</p>
              <Button onClick={clearSettingsFilters}>Xóa bộ lọc</Button>
            </div>
          )}
          <div className="table-bottom">
            <span>{scopedEstates.length} khu đô thị trong phạm vi quyền</span>
            <span>
              <ShieldCheck size={14} />
              Chỉ người có quyền mới có thể sửa tham số
            </span>
          </div>
        </section>
        {settingsHistoryOpen && (
          <Overlay
            drawer
            title="Lịch sử thay đổi"
            subtitle="Các thay đổi tham số báo cáo thẻ xe trong phiên."
            onClose={() => setSettingsHistoryOpen(false)}
            footer={
              <Button onClick={() => setSettingsHistoryOpen(false)}>Đóng</Button>
            }
          >
            {scopedChanges.length ? (
              scopedChanges.map((c, ci) => {
                const diffs = (["expiry", "loss", "unused", "effective"] as const).filter(
                  (k) => c.previous[k] !== c.next[k],
                )
                return (
                  <div className="parking-history-entry" key={ci}>
                    <strong>Sửa tham số · {estateName(c.estate)}</strong>
                    <span>
                      {c.actor} · {c.at}
                    </span>
                    {diffs.map((k) => {
                      const label = {
                        expiry: "Ngưỡng sắp hết hạn",
                        loss: "Định mức mất / hỏng",
                        unused: "Số ngày không sử dụng",
                        effective: "Ngày bắt đầu áp dụng",
                      }[k]
                      const unit =
                        k === "effective" ? "" : k === "loss" ? "%" : " ngày"
                      const prevVal =
                        k === "effective"
                          ? date(String(c.previous[k]))
                          : `${c.previous[k]}${unit}`
                      const nextVal =
                        k === "effective"
                          ? date(String(c.next[k]))
                          : `${c.next[k]}${unit}`
                      return (
                        <div key={k}>
                          <span className="muted">{label}:</span> {prevVal} →{" "}
                          <strong>{nextVal}</strong>
                        </div>
                      )
                    })}
                  </div>
                )
              })
            ) : (
              <div className="parking-empty">Chưa có thay đổi trong phiên này</div>
            )}
          </Overlay>
        )}
      </>
    )
  }

  function renderOperationMenu(group: typeof operationMenus[number]["group"]) {
    return operationMenus
      .filter((menu) => menu.group === group && modeAllows(menu.id))
      .map((menu) => {
        const Icon = operationIcons[menu.id]
        return (
          <Button
            variant="ghost"
            key={menu.id}
            className={`subnav-item ${operation === menu.id ? "active" : ""}`}
            aria-current={operation === menu.id ? "page" : undefined}
            onClick={() => chooseOperation(menu.id)}
          >
            <Icon size={15} />
            <span>{menu.title}</span>
            {operation === menu.id && <span className="active-dot" />}
          </Button>
        )
      })
  }
  function renderParkingMenu(group: typeof parkingMenus[number]["group"]) {
    const icons = {
      "parking-report": FileBarChart2, "parking-alerts": TriangleAlert, "parking-trips": Search,
      "parking-capacity": Warehouse, "parking-settings": Settings2,
    }
    return parkingMenus.filter((menu) => menu.id !== "parking-alerts" && menu.group === group && modeAllows(menu.id) && canOpen(parkingAccess, menu.id)).map((menu) => {
      const Icon = icons[menu.id]
      const active = parking === menu.id
      return <Button variant="ghost" className={`subnav-item ${active ? "active" : ""}`} key={menu.id}
        aria-current={active ? "page" : undefined} onClick={() => chooseParking(menu.id)}>
        <Icon size={15} /><span>{menu.title}</span>{active && <span className="active-dot" />}
      </Button>
    })
  }
  function renderRevenueMenu(group: typeof revenueMenus[number]["group"]) {
    return revenueMenus.filter((menu) => menu.group === group && modeAllows(menu.id) && revenueAccess(parkingAccess, menu.id)).map((menu) => {
      const active = parking === menu.id
      const Icon = menu.group === "Báo cáo" ? FileBarChart2 : menu.group === "Cấu hình" ? Settings2 : Banknote
      return <Button key={menu.id} variant="ghost" className={`subnav-item ${active ? "active" : ""}`}
        aria-current={active ? "page" : undefined} onClick={() => chooseParking(menu.id)}>
        <Icon size={15} /><span>{menu.title}</span>{active && <span className="active-dot" />}
      </Button>
    })
  }
  const firstRevenueOperation = revenueMenus.find((menu) => menu.group === "Quản lý doanh thu" && modeAllows(menu.id) && revenueAccess(parkingAccess, menu.id))
  const firstParkingOperation = parkingMenus.find(menu => menu.group === "Quản lý chỗ đỗ" && menu.id !== "parking-alerts" && modeAllows(menu.id) && canOpen(parkingAccess, menu.id))
  const firstConfiguration = modeAllows("settings") ? "settings" : parkingMenus.find(menu => menu.group === "Cấu hình" && modeAllows(menu.id) && canOpen(parkingAccess, menu.id))?.id ??
    revenueMenus.find(menu => menu.group === "Cấu hình" && modeAllows(menu.id) && revenueAccess(parkingAccess, menu.id))?.id

  return (
    <div className={`app ${collapsed ? "sidebar-collapsed" : ""}`}>
      {mobile && (
        <div className="mobile-shade" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="brand">
          <svg
            className="brand-mark"
            viewBox="0 0 44 36"
            fill="none"
            aria-hidden="true"
          >
            <path d="M2 4h13l8 12L33 4h9L25 28h-8L2 4Z" fill="currentColor" />
            <path d="M4 14h10l8 13-5 7L4 14Z" fill="currentColor" />
            <path d="m27 2-5 7-4-7h9Z" fill="currentColor" />
          </svg>
          <div className="brand-text">
            <span>VPARKING</span>
            <strong>CMS PORTAL</strong>
          </div>
          <span className="version-label">2.0</span>
        </div>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <Building2 size={18} />
          </span>
          <div>
            <span>Không gian làm việc</span>
            <strong>VCR · Ban vận hành</strong>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-caption">KHÔNG GIAN QUẢN LÝ</div>
        <nav className="main-nav" aria-label="Điều hướng chính">
          <Button
            variant="ghost"
            className="nav-item"
            onClick={navigateHome}
          >
            <LayoutDashboard size={18} />
            <span>Tổng quan</span>
          </Button>
          {modeAllows("subscriptions") && <div
            className="nav-section"
            role="group"
            aria-label="Quản lý thuê bao"
          >
            <Button
              variant="ghost"
              className="nav-item nav-section-label"
              aria-label="Quản lý thuê bao"
              title="Quản lý thuê bao"
              onClick={() => chooseOperation("subscriptions")}
            >
              <Users size={18} />
              <span>Quản lý thuê bao</span>
              <ChevronDown size={14} />
            </Button>
            <div className="subnav customer-navigation">
              {renderOperationMenu("Quản lý thuê bao")}
            </div>
          </div>}
          {modeAllows("customers") && <Button variant="ghost" className={`nav-item ${operation === "customers" ? "active" : ""}`}
            aria-current={operation === "customers" ? "page" : undefined} onClick={() => chooseOperation("customers")}>
            <Users size={18} /><span>Khách hàng</span>
          </Button>}
          {modeAllows("vehicles") && <div className="nav-section" role="group" aria-label="Quản lý xe">
            <Button variant="ghost" className="nav-item nav-section-label" aria-label="Quản lý xe" onClick={() => chooseOperation("vehicles")}>
              <CarFront size={18} /><span>Quản lý xe</span><ChevronDown size={14} />
            </Button><div className="subnav">{renderOperationMenu("Quản lý xe")}</div>
          </div>}
          {modeAllows("services") && <div className="nav-section" role="group" aria-label="Dịch vụ">
            <Button variant="ghost" className="nav-item nav-section-label" aria-label="Dịch vụ" onClick={() => chooseOperation("services")}>
              <Settings2 size={18} /><span>Dịch vụ</span><ChevronDown size={14} />
            </Button><div className="subnav">{renderOperationMenu("Dịch vụ")}</div>
          </div>}
          {modeAllows("inventory") && <div className="nav-section" role="group" aria-label="Quản lý thẻ">
            <Button
              variant="ghost"
              className="nav-item nav-section-label"
              aria-label="Quản lý thẻ"
              title="Quản lý thẻ"
              onClick={() => chooseOperation("inventory")}
            >
              <CreditCard size={18} />
              <span>Quản lý thẻ</span>
              <ChevronDown size={14} />
            </Button>
            <div className="subnav op-navigation">
              {renderOperationMenu("Quản lý thẻ")}
            </div>
          </div>}
          {firstParkingOperation && <div className="nav-section" role="group" aria-label="Quản lý chỗ đỗ">
            <Button variant="ghost" className="nav-item nav-section-label" aria-label="Quản lý chỗ đỗ" title="Quản lý chỗ đỗ"
              onClick={() => chooseParking(firstParkingOperation.id)}>
              <ParkingSquare size={18} /><span>Quản lý chỗ đỗ</span><ChevronDown size={14} />
            </Button>
            <div className="subnav">{renderParkingMenu("Quản lý chỗ đỗ")}</div>
          </div>}
          {firstRevenueOperation && <div className="nav-section" role="group" aria-label="Quản lý doanh thu">
            <Button variant="ghost" className="nav-item nav-section-label" aria-label="Quản lý doanh thu" title="Quản lý doanh thu"
              onClick={() => chooseParking(firstRevenueOperation.id)}>
              <Banknote size={18} /><span>Quản lý doanh thu</span><ChevronDown size={14} />
            </Button>
            <div className="subnav">{renderRevenueMenu("Quản lý doanh thu")}</div>
          </div>}
          {((modeAllows("revenue-voucher") && revenueAccess(parkingAccess, "revenue-voucher")) || (modeAllows("revenue-debt") && revenueAccess(parkingAccess, "revenue-debt"))) && <VoucherNavigation active={parking === "revenue-voucher"} params={parkingParams}
            canBrowse={modeAllows("revenue-voucher") && revenueAccess(parkingAccess, "revenue-voucher")}
            debt={modeAllows("revenue-debt") && revenueAccess(parkingAccess, "revenue-debt") ? { active: parking === "revenue-debt", open: () => chooseParking("revenue-debt") } : undefined}
            canCreate={revenueWrite(parkingAccess, "voucher")} open={(patch) => chooseParking("revenue-voucher", patch)} />}
          {modeAllows(behaviorOperations) && (canEditEvent(parkingAccess) || canEditHoliday(parkingAccess)) && <div className="nav-section behavior-operations-nav" role="group" aria-label={behaviorOperationsTitle}>
            <Button variant="ghost" className="nav-item nav-section-label" title={behaviorOperationsTitle}
              onClick={() => chooseParking(behaviorOperations)}>
              <Users size={18} /><span>{behaviorOperationsTitle}</span><ChevronDown size={14} />
            </Button>
            <div className="subnav">
              <Button variant="ghost" className={`subnav-item ${parking === behaviorOperations ? "active" : ""}`}
                aria-current={parking === behaviorOperations ? "page" : undefined} onClick={() => chooseParking(behaviorOperations)}>
                <CalendarDays size={15} /><span>{behaviorManagementTitle}</span>{parking === behaviorOperations && <span className="active-dot" />}
              </Button>
            </div>
          </div>}
          <div className="nav-section" role="group" aria-label="Báo cáo">
            <Button
              variant="ghost"
              className="nav-item nav-section-label"
              aria-label="Báo cáo"
              title="Báo cáo"
              onClick={navigateHome}
            >
              <ChartNoAxesCombined size={18} />
              <span>Báo cáo</span>
              <ChevronDown size={14} />
            </Button>
            <div className="subnav">
              {screens
                .filter((s) => s.id === "stock" && modeAllows(s.id))
                .map((s) => {
                  const Icon = screenIcons[s.id]
                  return (
                    <Button
                      key={s.id}
                      variant="ghost"
                      onClick={() => navigate(s.id)}
                      className={`subnav-item ${
                        !operation && !parking && reportSection === s.id ? "active" : ""
                      }`}
                      aria-current={
                        !operation && !parking && reportSection === s.id
                          ? "page"
                          : undefined
                      }
                    >
                      <Icon size={15} />
                      <span>{s.title}</span>
                      {s.id === "alerts" && (
                        <span className="nav-count">{warningCount}</span>
                      )}
                      {!operation && !parking && reportSection === s.id && (
                        <span className="active-dot" />
                      )}
                    </Button>
                  )
                })}
              {renderParkingMenu("Báo cáo")}
              {renderRevenueMenu("Báo cáo")}
              {modeAllows(behaviorReport) && canReadBehavior(parkingAccess) && <Button variant="ghost"
                className={`subnav-item ${parking === behaviorReport ? "active" : ""}`}
                aria-current={parking === behaviorReport ? "page" : undefined} onClick={() => chooseParking(behaviorReport)}>
                <FileBarChart2 size={15} /><span>{behaviorTitle}</span>{parking === behaviorReport && <span className="active-dot" />}
              </Button>}
            </div>
          </div>
          {firstConfiguration && <div role="group" aria-label="Cấu hình">
            <Button
              variant="ghost"
              className="nav-item nav-section-label configuration-label"
              aria-label="Cấu hình"
              title="Cấu hình"
              onClick={() => firstConfiguration === "settings" ? navigate("settings") : chooseParking(firstConfiguration)}
            >
              <Settings2 size={18} />
              <span>Cấu hình</span>
              <ChevronDown size={14} />
            </Button>
            <div className="subnav">
              {modeAllows("settings") && <Button
                variant="ghost"
                className={`subnav-item ${
                  !operation && !parking && screen === "settings" ? "active" : ""
                }`}
                aria-current={
                  !operation && !parking && screen === "settings" ? "page" : undefined
                }
                onClick={() => navigate("settings")}
              >
                <Settings2 size={15} />
                <span>Tham số báo cáo thẻ xe</span>
                {!operation && !parking && screen === "settings" && <span className="active-dot" />}
              </Button>}
              {renderParkingMenu("Cấu hình")}
              {renderRevenueMenu("Cấu hình")}
            </div>
          </div>}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card">
            <span className="support-icon">
              <CircleHelp size={19} />
            </span>
            <div>
              <strong>Bạn cần hỗ trợ?</strong>
              <span>Xem hướng dẫn sử dụng</span>
            </div>
            <Button
              variant="ghost"
              aria-label="Hướng dẫn sử dụng"
              onClick={() => setHelp(true)}
            >
              <ArrowUpRight size={16} />
            </Button>
          </div>
          <Button
            variant="ghost"
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeftClose size={17} />
            <span>Thu gọn thanh bên</span>
          </Button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              variant="ghost"
              className="mobile-menu"
              aria-label="Mở menu"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={21} />
            </Button>
            <span className="portal-label">Hệ thống quản lý bãi đỗ xe</span>
            <HandoffModeSelector value={handoffMode} onChange={changeHandoffMode} />
          </div>
          <div className="topbar-right">
            <span className="today-label">
              <CalendarDays size={15} />
              {parking ? date(vnToday()) : "Thứ Năm, 29/10/2026"}
            </span>
            <Button
              variant="ghost"
              aria-label="Trợ giúp"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </Button>
            <div className="popover-anchor">
              <Button
                variant="ghost"
                className="notification-button"
                aria-label="Thông báo"
                onClick={() => {
                  setNotifications(!notifications)
                  setAccount(false)
                }}
              >
                <Bell size={19} />
                <span className="notification-dot" />
              </Button>
              {notifications && (
                <div className="popover notifications-popover">
                  <Heading level={3}>Thông báo</Heading>
                  {modeAllows("parking-trips") && parkingModel.notices.map((notice) => <div className="notification-entry" key={notice.id}>
                    <span className="notification-icon amber"><TriangleAlert size={18} /></span>
                    <div><strong>Vượt sức chứa · {siteById(notice.site)?.label}</strong>
                      <span>{notice.vehicle} · {fmt(notice.count)} xe / {fmt(notice.design)} chỗ quy hoạch</span>
                      <small>{displayTime(notice.at)}</small>
                      <Button variant="link" onClick={() => {
                        const filters = defaultParkingFilters(parkingModel.cutoff)
                        const day = dayAt(notice.at)
                        chooseParking("parking-trips", {
                          ...filters,
                          estate: siteById(notice.site)?.estate ?? "",
                          site: notice.site,
                          vehicle: notice.vehicle,
                          alert: overCapacityTripAlert.value,
                          ...(day <= filters.end ? { start: day, end: day } : {}),
                        })
                        setNotifications(false)
                      }}>{dayAt(notice.at) <= parkingModel.cutoff ? "Xem lượt xe" : "Xem lượt xe kỳ gần nhất"} <ArrowRight size={12} /></Button>
                    </div>
                  </div>)}
                  {parkingModel.exports.map((file) => <div className="notification-entry" key={file.id}>
                    <span className="notification-icon"><FileSpreadsheet size={18} /></span>
                    <div><strong>File Excel đã sẵn sàng</strong><span title={file.name}>{file.name}</span>
                      <Button variant="link" onClick={() => parkingModel.downloadExport(file.id)}>Tải file <Download size={12} /></Button>
                    </div>
                  </div>)}
                  {modeAllows("stock") && <div className="notification-entry">
                    <span className="notification-icon">
                      <FileSpreadsheet size={18} />
                    </span>
                    <div>
                      <strong>Dữ liệu báo cáo đã sẵn sàng</strong>
                      <span>Đã tổng hợp số liệu đến 28/10/2026.</span>
                      <small>29/10/2026 05:45</small>
                    </div>
                  </div>}
                  {modeAllows("stock") && <div className="notification-entry">
                    <span className="notification-icon amber">
                      <TriangleAlert size={18} />
                    </span>
                    <div>
                      <strong>{warningCount} thẻ cần kiểm tra</strong>
                      <span>Kiểm tra các cảnh báo trong báo cáo thẻ xe.</span>
                      <Button
                        variant="link"
                        onClick={() => {
                          navigate("alerts")
                          setNotifications(false)
                        }}
                      >
                        Xem cảnh báo
                        <ArrowRight size={12} />
                      </Button>
                    </div>
                  </div>}
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <div className="popover-anchor">
              <Button
                variant="ghost"
                className="account-button"
                onClick={() => {
                  setAccount(!account)
                  setNotifications(false)
                }}
              >
                <span className="avatar">AL</span>
                <span>
                  {parkingRoles[parkingAccess.role]}<small>{parkingAccess.role === "admin" ? "Quản trị viên" : "Tài khoản minh họa"}</small>
                </span>
                <ChevronDown size={13} />
              </Button>
              {account && (
                <div className="popover account-popover">
                  <strong>{parkingRoles[parkingAccess.role]}</strong>
                  <div className="account-access">
                    <ShieldCheck size={15} />
                    Phân quyền báo cáo chỗ đỗ và doanh thu
                  </div>
                  <div className="muted">
                    Phiên bản thiết kế · Dữ liệu minh họa
                  </div>
                  <Field label="Vai trò minh họa"><Select value={parkingAccess.role}
                    options={Object.entries(parkingRoles).map(([value, label]) => ({ value, label }))}
                    onChange={(e) => changeParkingAccess({ role: e.target.value as Role, estate: parkingAccess.estate })} /></Field>
                  <Field label="Phạm vi khu đô thị"><Select value={parkingAccess.estate}
                    options={[{ value: "", label: "Tất cả khu đô thị" }, ...estates.map((estate) => ({ value: estate.id, label: estate.name }))]}
                    onChange={(e) => changeParkingAccess({ ...parkingAccess, estate: e.target.value })} /></Field>
                </div>
              )}
            </div>
          </div>
        </header>
        <main>
          {operation && isManagementScreen(operation) && <SubscriptionManagement screen={operation} state={sharedCards}
            onChange={updateCardOperations} onNavigate={navigateManagement} onCard={openManagedCard}
            notify={setToast} onDirty={setOperationDirty} focusId={operationFocus} onFocused={() => setOperationFocus(null)} />}
          {operation === "lookup" && managementOrigin && <Button className="sm-back-link" variant="ghost" onClick={() => navigateManagement("subscriptions", managementOrigin)}><ArrowLeft size={14} />Quay lại thuê bao</Button>}
          <Operations
            screen={operation && isManagementScreen(operation) ? null : operation}
            lookupResult={lookupResult}
            lookupFilters={lookupFilters}
            onLookupFilters={setLookupFilters}
            onBackToReport={lookupFromReport ? () => navigate("stock") : undefined}
            focusCardId={operationFocus}
            onFocused={() => setOperationFocus(null)}
            onLookup={openWarehouseLookup}
            onDirtyChange={setOperationDirty}
            onNotify={setToast}
            sharedState={sharedCards}
            onStateChange={updateCardOperations}
          />
          {parking && isParkingScreen(parking) && <Parking key={`${parkingAccess.role}/${parkingAccess.estate}`} screen={parking} params={parkingParams}
            access={parkingAccess} model={parkingModel} update={updateParking} navigate={chooseParking}
            home={navigateHome} onDirty={setParkingDirty} notify={setToast} revenue={modeAllows("revenue-lookup") ? revenueModel : undefined}
            tripUpdates={modeAllows(behaviorReport) ? behaviorTripUpdates : undefined} />}
          {parking && isRevenueScreen(parking) && <Revenue key={`${parking}/${parkingAccess.role}/${parkingAccess.estate}`}
            screen={parking} params={parkingParams} access={parkingAccess} model={parkingModel}
            state={revenueModel.state} save={revenueModel.save} update={updateParking} operations={sharedCards}
            navigate={(patch, screen = parking, preserve = true) => chooseParking(screen, patch, preserve)}
            home={navigateHome} notify={setToast} onDirty={setParkingDirty}
            openParking={(trip, day) => chooseParking("parking-trips", { trip, start: day, end: day > parkingModel.cutoff ? parkingModel.cutoff : day })} />}
          {parking && isBehaviorScreen(parking) && <Behavior key={`${parking}/${parkingAccess.role}/${parkingAccess.estate}`} screen={parking}
            access={parkingAccess} params={parkingParams} model={parkingModel} tripUpdates={behaviorTripUpdates}
            update={updateParking} notify={setToast} onDirty={setParkingDirty}
            manageEvent={(id, origin) => chooseParking(behaviorOperations, { configView: "Sự kiện", focusEvent: id, fromEvent: origin })}
            backToReport={(origin) => chooseParking(behaviorReport, Object.fromEntries(new URLSearchParams(origin)))} />}
          <div hidden={!!operation || !!parking}>
            <div className="breadcrumbs">
              <span>{screen === "settings" ? "Cấu hình" : "Báo cáo"}</span>
              <ChevronRight size={12} />
              {screen === "cards" && (
                <>
                  <span>Báo cáo quản lý thẻ</span>
                  <ChevronRight size={12} />
                </>
              )}
              <span className="current-crumb">{title.title}</span>
            </div>
            <div className="page-heading">
              <div>
                <div className="heading-line">
                  <Heading level={1}>{title.title}</Heading>
                  {screen !== "settings" && (
                    <span className="page-tag">
                      {screen === "cards"
                        ? "Chi tiết báo cáo"
                        : "Báo cáo thẻ xe"}
                    </span>
                  )}
                </div>
                <div className="page-description">{title.description}</div>
              </div>
              {screen === "settings" ? (
                <div className="op-heading-actions">
                  <Button onClick={exportSettings} disabled={exporting}>
                    {exporting ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : (
                      <Download size={15} />
                    )}
                    Xuất dữ liệu
                  </Button>
                </div>
              ) : (
                <Button
                  className="export-button"
                  onClick={exportReport}
                  disabled={
                    !ready ||
                    loading ||
                    exporting ||
                    !["ready", "stale", "mismatch"].includes(previewState)
                  }
                >
                  {exporting ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  {exporting
                    ? "Đang xuất…"
                    : screen === "stock"
                      ? "Tải báo cáo"
                      : "Tải danh sách"}
                  <span className="file-extension">.xlsx</span>
                </Button>
              )}
            </div>
            {screen !== "settings" && (
              <>
                <div className="data-status">
                  <div>
                    <span className="data-status-icon">
                      <Database size={15} />
                    </span>
                    <span>
                      Dữ liệu có đến{" "}
                      <strong>
                        {date(
                          previewState === "stale" ? "2026-10-27" : maxDate,
                        )}
                      </strong>
                    </span>
                    <span className="status-separator">·</span>
                    <span className="data-status-note">
                      Dữ liệu theo kỳ, tách với thao tác trong phiên
                    </span>
                  </div>
                  <span className="data-ready">
                    <span />
                    {previewState === "stale" ? "Chờ tổng hợp" : "Đã cập nhật"}
                  </span>
                </div>
                <section className="panel filter-panel">
                  <div className="filter-heading">
                    <span>
                      <ListFilter size={16} />
                      <strong>Điều kiện báo cáo</strong>
                      {JSON.stringify(draft) !== JSON.stringify(applied) && (
                        <span className="filter-pending">
                          <Clock3 size={12} />
                          Chưa áp dụng
                        </span>
                      )}
                    </span>
                    <Button variant="ghost" onClick={reset}>
                      <RefreshCw size={13} />
                      Đặt lại
                    </Button>
                  </div>
                  <div className="filter-grid">{renderFilterFields()}</div>
                  <div className="filter-second-row">
                    {screen === "stock" ? (
                      <ReportPeriodFields period={draft} min="2026-09-01" max={maxDate} error={error}
                        onChange={(period) => setDraft((current) => ({ ...current, ...period }))} />
                    ) : (
                      <div className="date-field">
                        <Field label="Ngày chốt" required error={error}>
                          <Input
                            type="date"
                            aria-label="Ngày chốt"
                            min="2026-09-01"
                            max={maxDate}
                            value={draft.end}
                            onChange={(e) => update("end", e.target.value)}
                          />
                        </Field>
                      </div>
                    )}
                    <div className="run-report">
                      <Button
                        variant="primary"
                        onClick={runReport}
                        disabled={!!error || loading}
                      >
                        {loading ? (
                          <LoaderCircle size={16} className="spin" />
                        ) : (
                          <ChartNoAxesCombined size={16} />
                        )}
                        Xem báo cáo
                      </Button>
                    </div>
                  </div>
                </section>
              </>
            )}
            {screen !== "settings" &&
              Object.entries(applied).some(
                ([key, value]) => value && !["start", "end"].includes(key),
              ) && (
                <div className="applied-filters">
                  <span>Đang lọc:</span>
                  {([
                    "estate",
                    "park",
                    "type",
                    "vehicle",
                    "status",
                    "alert",
                    "expiry",
                  ] as const)
                    .filter((key) => applied[key])
                    .map((key) => (
                      <span className="filter-chip" key={key}>
                        {key === "estate"
                          ? estateName(applied.estate)
                          : key === "alert"
                            ? alertNames[Number(applied.alert) - 1]
                            : key === "expiry"
                              ? `Hiệu lực đến ${date(applied.expiry)}`
                              : applied[key]}
                        <Button
                          variant="ghost"
                          aria-label={`Bỏ lọc ${key}`}
                          onClick={() => {
                            const next = {
                              ...applied,
                              [key]: "",
                              ...(key === "estate" ? { park: "" } : {}),
                            }
                            setApplied(next)
                            setDraft(next)
                            setPage(1)
                          }}
                        >
                          <X size={12} />
                        </Button>
                      </span>
                    ))}
                  <Button variant="link" onClick={reset}>
                    Xóa tất cả
                  </Button>
                </div>
              )}
            {previewState === "stale" && (
              <div className="state-banner warning">
                <Clock3 size={17} />
                <div>
                  <strong>Số liệu ngày hôm qua chưa tổng hợp xong</strong>
                  <span>
                    Đang hiển thị dữ liệu gần nhất đến ngày 27/10/2026. Hệ thống
                    sẽ cập nhật sau khi tổng hợp hoàn tất.
                  </span>
                </div>
              </div>
            )}
            {previewState === "mismatch" && (
              <div className="state-banner danger">
                <TriangleAlert size={17} />
                <div>
                  <strong>Số liệu đang được kiểm tra</strong>
                  <span>
                    Vinhomes Smart City có số liệu đối soát không khớp. Hệ thống
                    đã gửi thông tin cho IT kiểm tra.
                  </span>
                </div>
              </div>
            )}
            {previewState === "error" || previewState === "denied" ? (
              <div className="panel empty-state">
                <div className="empty-icon">
                  <ShieldCheck size={26} />
                </div>
                <Heading level={3}>
                  {previewState === "denied"
                    ? "Bạn không có quyền xem báo cáo này"
                    : "Không thể tải báo cáo"}
                </Heading>
                <span className="muted">
                  {previewState === "denied"
                    ? "Vui lòng liên hệ quản trị viên để được cấp quyền khu đô thị."
                    : "Vui lòng thử lại. Bộ lọc của bạn vẫn được giữ nguyên. Mã tham chiếu: BC-1029."}
                </span>
                <Button
                  onClick={() =>
                    previewState === "denied"
                      ? setPreviewState("ready")
                      : runReport()
                  }
                >
                  {previewState === "denied" ? (
                    <ArrowLeft size={15} />
                  ) : (
                    <RefreshCw size={15} />
                  )}
                  {previewState === "denied" ? "Quay lại báo cáo" : "Thử lại"}
                </Button>
              </div>
            ) : previewState === "empty" ? (
              <div className="panel">{empty}</div>
            ) : loading || previewState === "loading" ? (
              <div className="panel loading-state">
                <LoaderCircle size={28} className="spin" />
                <Heading level={3}>Đang tổng hợp báo cáo…</Heading>
                <span className="muted">Vui lòng đợi trong giây lát</span>
              </div>
            ) : !ready || previewState === "initial" ? (
              <div className="panel empty-state">
                <FileBarChart2 size={32} />
                <Heading level={3}>Chọn điều kiện để xem báo cáo</Heading>
                <span className="muted">
                  Thiết lập bộ lọc phía trên và bấm Xem báo cáo.
                </span>
              </div>
            ) : screen === "cards" ? (
              renderCards()
            ) : screen === "settings" ? (
              renderSettings()
            ) : !operation && !parking ? (
              <ReportDashboard
                data={dashboard}
                filters={applied}
                groupBy={groupBy}
                onGroupBy={setGroupBy}
                onMetric={(index) => openReportLookup({ kind: "metric", index })}
                onLookup={openReportLookup}
                onSettings={() => navigate("settings")}
                stockDetails={renderStock()}
                circulationDetails={renderCirculation()}
              />
            ) : null}
            <footer className="page-footer">
              <span>
                VParking CMS <span className="footer-dot">·</span>{" "}
                {screen === "cards"
                  ? "Đối chiếu thẻ theo kỳ báo cáo"
                  : "Báo cáo quản lý thẻ xe"}
              </span>
              <span>
                <span className="demo-dot" />
                Dữ liệu minh họa<span className="footer-dot">·</span>Múi giờ
                GMT+7
              </span>
            </footer>
            {screen !== "settings" && (
              <div className="preview-states">
                <span>Trạng thái minh họa</span>
                <Select
                  aria-label="Trạng thái minh họa"
                  value={previewState}
                  onChange={(e) => setPreviewState(e.target.value)}
                  options={[
                    { value: "ready", label: "Có dữ liệu" },
                    { value: "initial", label: "Chưa chạy báo cáo" },
                    { value: "loading", label: "Đang tải" },
                    { value: "empty", label: "Không có kết quả" },
                    { value: "error", label: "Lỗi hệ thống" },
                    { value: "stale", label: "Chưa tổng hợp xong" },
                    { value: "mismatch", label: "Đối soát không khớp" },
                    { value: "denied", label: "Không có quyền" },
                  ]}
                />
              </div>
            )}
          </div>
        </main>
      </div>
      {toast && (
        <div
          className={`toast ${
            toast.startsWith("Không thể") ? "toast-error" : ""
          }`}
          role="status"
        >
          {toast.startsWith("Không thể") ? (
            <TriangleAlert size={19} />
          ) : (
            <CircleCheck size={19} />
          )}
          <span>{toast}</span>
          <Button
            variant="ghost"
            onClick={() => setToast("")}
            aria-label="Đóng thông báo"
          >
            <X size={15} />
          </Button>
        </div>
      )}
      {drawer && (
        <Overlay
          drawer
          title={drawer === "filter" ? "Bộ lọc nâng cao" : "Tùy chỉnh cột"}
          subtitle={
            drawer === "filter"
              ? "Lọc thêm trạng thái, cảnh báo và hiệu lực của danh sách theo kỳ."
              : "Chọn cột hiển thị. Kéo bằng nút mũi tên để đổi thứ tự."
          }
          onClose={() => setDrawer(null)}
          footer={
            <>
              <Button
                onClick={() =>
                  drawer === "columns"
                    ? setColumnDraft(defaultColumns)
                    : setDraft((old) => ({
                        ...old,
                        status: "",
                        alert: "",
                        expiry: "",
                      }))
                }
              >
                {drawer === "columns" ? "Khôi phục mặc định" : "Đặt lại"}
              </Button>
              <Button
                variant="primary"
                disabled={drawer === "filter" && !!error}
                onClick={() => {
                  if (drawer === "filter") runReport()
                  else {
                    setColumns(columnDraft)
                    setDrawer(null)
                    setToast("Đã áp dụng cấu hình cột trong phiên xem này.")
                  }
                }}
              >
                Áp dụng
              </Button>
            </>
          }
        >
          {drawer === "filter" ? (
            <div className="drawer-fields">{renderFilterFields(true)}</div>
          ) : (
            <div className="column-list">
              {[
                ...columnDraft,
                ...Object.keys(columnNames).filter(
                  (k) => !columnDraft.includes(k),
                ),
              ].map((k, i) => (
                <div
                  className={`column-choice ${
                    columnDraft.includes(k) ? "column-checked" : ""
                  }`}
                  key={k}
                >
                  <Label>
                    <Input
                      type="checkbox"
                      checked={columnDraft.includes(k)}
                      disabled={k === "id"}
                      onChange={(e) =>
                        setColumnDraft((old) =>
                          e.target.checked
                            ? [...old, k]
                            : old.filter((v) => v !== k),
                        )
                      }
                    />
                    <span>{columnNames[k]}</span>
                  </Label>
                  {columnDraft.includes(k) && (
                    <div>
                      <Button
                        variant="ghost"
                        disabled={i === 0 || k === "id" || i === 1}
                        aria-label={`Di chuyển ${columnNames[k]} lên`}
                        onClick={() =>
                          setColumnDraft((old) => {
                            const next = [...old]
                            ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                            return next
                          })
                        }
                      >
                        <ChevronLeft size={13} className="arrow-up" />
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={i >= columnDraft.length - 1 || k === "id"}
                        aria-label={`Di chuyển ${columnNames[k]} xuống`}
                        onClick={() =>
                          setColumnDraft((old) => {
                            const next = [...old]
                            ;[next[i + 1], next[i]] = [next[i], next[i + 1]]
                            return next
                          })
                        }
                      >
                        <ChevronRight size={13} className="arrow-down" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Overlay>
      )}
      {detail && (
        <Overlay
          wide
          title="Chi tiết thẻ"
          subtitle="Thông tin tại ngày chốt"
          onClose={() => setDetail(null)}
          footer={
            <>
              <span className="detail-footer-note">
                <ShieldCheck size={14} />
                Thao tác thẻ tại phân hệ Quản lý thẻ
              </span>
              <Button onClick={() => setDetail(null)}>Đóng</Button>
              <Button
                variant="primary"
                onClick={() => {
                  chooseOperation("lookup")
                  setOperationFocus(detail.id)
                  setDetail(null)
                }}
              >
                Xem trạng thái hiện tại
                <ExternalLink size={14} />
              </Button>
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
                {detail.type} <span className="footer-dot">·</span>{" "}
                {detail.vehicle}
              </span>
            </div>
            {cardCell(detail, "status")}
            <span className="detail-estate">
              <Building2 size={14} />
              {estateName(detail.estate)}
            </span>
          </div>
          {detail.alerts.map((a) => (
            <div
              className="detail-alert"
              key={a}
            >
              <TriangleAlert size={18} />
              <div>
                <strong>{alertNames[a]}</strong>
                <span>
                  {a === 0
                    ? `Thẻ hết hiệu lực vào ${date(detail.expiry)}. Vui lòng nhắc khách gia hạn.`
                    : a === 2
                      ? detail.plate === "—"
                        ? "Chưa có biển số đăng ký và chưa gắn căn hộ cư dân."
                        : "Biển đăng ký: 30A-123.45 · Camera: 30A-999.99 · 3 lượt không khớp."
                      : `Không có lượt xe trong ${detail.unused} ngày. Lần sử dụng gần nhất: ${date(detail.lastTrip)}.`}
                </span>
              </div>
            </div>
          ))}
          <div className="detail-tabs">
            {["Thông tin thẻ", "Lịch sử trạng thái", "Lượt xe gần nhất"].map(
              (t) => (
                <Button
                  variant="ghost"
                  className={detailTab === t ? "selected" : ""}
                  key={t}
                  onClick={() => setDetailTab(t)}
                >
                  {t}
                  {t === "Lượt xe gần nhất" && (
                    <span className="tab-counter">
                      {recentTrips(detail).length}
                    </span>
                  )}
                </Button>
              ),
            )}
          </div>
          {detailTab === "Thông tin thẻ" ? (
            <>
              <div className="detail-section-heading">
                <CreditCard size={16} />
                <Heading level={3}>Thông tin thẻ</Heading>
              </div>
              <div className="detail-grid">
                {[
                  ["Mã thẻ", detail.id],
                  ["Loại thẻ", detail.type],
                  ["Phương tiện", detail.vehicle],
                  ["Lô nhập", detail.batch],
                  ["Nhà cung cấp", "Công ty CP Công nghệ Việt"],
                  ["Ngày nhập kho", "01/09/2026"],
                  ["Khu đô thị", estateName(detail.estate)],
                  ["Bãi phân bổ", detail.park || "—"],
                  ["Hiệu lực từ", date(detail.issued)],
                  ["Hiệu lực đến", date(detail.expiry)],
                  [
                    "Lượt xe gần nhất",
                    detail.lastTrip
                      ? `${date(detail.lastTrip)} 17:42`
                      : "—",
                  ],
                  [
                    "Biên bản mất / hỏng",
                    detail.status === "Mất / hỏng" ? "BB-2026-0012" : "—",
                  ],
                ].map(([l, v]) => (
                  <div key={l}>
                    <span>{l}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              {detail.type === "Thuê bao tháng" && (
                <>
                  <div className="detail-section-heading">
                    <Users size={16} />
                    <Heading level={3}>Thông tin thuê bao</Heading>
                  </div>
                  <div className="detail-grid">
                    {[
                      ["Mã thuê bao", detail.subscription],
                      ["Chủ thẻ", detail.owner],
                      ["Số điện thoại", detail.phone],
                      ["Biển số đăng ký", detail.plate],
                      ["Nhóm khách", detail.group],
                      ["Căn hộ / gian hàng", detail.apartment],
                      ["Hợp đồng", "HĐ-2026-01024"],
                      ["Hiệu lực hợp đồng", "31/12/2026"],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <span>{l}</span>
                        <strong>{v}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : detailTab === "Lịch sử trạng thái" ? (
            <div className="timeline">
              {cardHistory(detail, applied.end).map((ev, i) => (
                <div
                  className={`timeline-event ${ev.canceled ? "canceled" : ""}`}
                  key={i}
                >
                  <span className="timeline-point">
                    {i === 0 ? <Check size={12} /> : null}
                  </span>
                  <div>
                    <div className="timeline-title">
                      <strong>{ev.name}</strong>
                      {ev.canceled && <Badge>Đã hủy</Badge>}
                      <span>
                        {date(ev.at.slice(0, 10))} {ev.at.slice(11, 16)}
                      </span>
                    </div>
                    <span className="timeline-user">{ev.user}</span>
                    <div className="muted">{ev.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {[
                      "Thời điểm",
                      "Chiều",
                      "Bãi xe / Làn",
                      "Biển camera",
                      "Kết quả",
                    ].map((n) => (
                      <th key={n}>{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTrips(detail).map((trip, i) => (
                    <tr key={i}>
                      <td>
                        {date(trip.day)} {trip.time}
                      </td>
                      <td>
                        <span className="trip-direction">
                          {i % 2 ? (
                            <ArrowDownLeft size={14} />
                          ) : (
                            <ArrowUpRight size={14} />
                          )}
                          {i % 2 ? "Vào" : "Ra"}
                        </span>
                      </td>
                      <td>
                        {detail.park || "Hầm B1"} · Làn {(i % 2) + 1}
                      </td>
                      <td>
                        {detail.alerts.includes(2)
                          ? "30A-999.99"
                          : detail.plate}
                      </td>
                      <td>
                        <Badge tone="green">Cho qua</Badge>
                      </td>
                    </tr>
                  ))}
                  {!recentTrips(detail).length && (
                    <tr>
                      <td colSpan={5} className="muted">
                        Chưa có dữ liệu lượt xe đến ngày {date(applied.end)}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Overlay>
      )}
      {editing && (
        <Overlay
          title={`Sửa tham số · ${estates.find((e) => e.id === editing)?.short}`}
          subtitle="Giá trị mới chỉ áp dụng từ ngày hiệu lực được chọn."
          onClose={closeEdit}
          footer={
            <>
              <Button onClick={closeEdit}>Hủy</Button>
              <Button
                variant="primary"
                disabled={
                  Object.values(editErrors).some(Boolean) ||
                  JSON.stringify(edit) === originalEdit
                }
                onClick={saveThreshold}
              >
                <Check size={15} />
                Lưu thay đổi
              </Button>
            </>
          }
        >
          <div className="edit-estate">
            <Building2 size={19} />
            <div>
              <strong>{estateName(editing)}</strong>
              <span>Tham số cảnh báo theo khu đô thị</span>
            </div>
          </div>
          <Form
            onSubmit={(e) => {
              e.preventDefault()
              saveThreshold()
            }}
            id="threshold-form"
          >
            <div className="edit-fields">
              <Field
                label="Ngưỡng sắp hết hạn"
                required
                error={editErrors.expiry}
                hint="Từ 1 đến 90 ngày. Mặc định: 7 ngày."
              >
                <div className="input-suffix">
                  <Input
                    autoFocus
                    type="number"
                    min={1}
                    max={90}
                    step={1}
                    value={Number.isNaN(edit.expiry) ? "" : edit.expiry}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        expiry:
                          e.target.value === "" ? NaN : Number(e.target.value),
                      })
                    }
                  />
                  <span>ngày</span>
                </div>
              </Field>
              <Field
                label="Định mức mất / hỏng"
                required
                error={editErrors.loss}
                hint="Từ 0 đến 100%, tối đa 2 số thập phân."
              >
                <div className="input-suffix">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={Number.isNaN(edit.loss) ? "" : edit.loss}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        loss:
                          e.target.value === "" ? NaN : Number(e.target.value),
                      })
                    }
                  />
                  <span>%</span>
                </div>
              </Field>
              <Field
                label="Số ngày không sử dụng"
                required
                error={editErrors.unused}
                hint="Từ 1 đến 365 ngày. Mặc định: 30 ngày."
              >
                <div className="input-suffix">
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={Number.isNaN(edit.unused) ? "" : edit.unused}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        unused:
                          e.target.value === "" ? NaN : Number(e.target.value),
                      })
                    }
                  />
                  <span>ngày</span>
                </div>
              </Field>
              <Field
                label="Ngày bắt đầu áp dụng"
                required
                error={editErrors.effective}
              >
                <Input
                  type="date"
                  min="2026-10-30"
                  value={edit.effective}
                  onChange={(e) =>
                    setEdit({ ...edit, effective: e.target.value })
                  }
                />
              </Field>
            </div>
            <div className="edit-note">
              <Info size={16} />
              Báo cáo của các ngày trước ngày áp dụng vẫn sử dụng tham số cũ.
            </div>
          </Form>
        </Overlay>
      )}
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
                  setEditing(null)
                }}
              >
                Bỏ thay đổi
              </Button>
            </>
          }
        >
          <div className="discard-content">
            Rời đi sẽ mất các thay đổi này. Bạn có chắc chắn muốn đóng mà không
            lưu?
          </div>
        </Overlay>
      )}
      {help && (
        <Overlay
          title="Hướng dẫn quản lý thẻ và báo cáo"
          subtitle="VParking CMS 2.0 · Phiên bản thiết kế tương tác"
          onClose={() => setHelp(false)}
          footer={
            <Button variant="primary" onClick={() => setHelp(false)}>
              Đã hiểu
            </Button>
          }
        >
          <div className="help-content">
            <div className="help-note">
              <Info size={18} />
              <span>
                Đây là bản thiết kế với dữ liệu minh họa. Quản lý thẻ hỗ trợ
                thao tác trong phiên xem; báo cáo sử dụng dữ liệu theo kỳ riêng.
                Dữ liệu và cấu hình chưa được lưu trên máy chủ.
              </span>
            </div>
            {[
              {
                title: "Quản lý thuê bao",
                description:
                  "Đăng ký thuê bao / VIP, quản lý thông tin khách và cấp lại thẻ.",
              },
              {
                title: "Quản lý thẻ",
                description:
                  "Xem tồn kho theo bãi, nhập kho, giao thẻ vãng lai; tìm và xử lý từng thẻ tại Tra cứu thẻ.",
              },
              {
                title: "Báo cáo",
                description:
                  "Theo dõi biến động, cơ cấu và cảnh báo theo kỳ. Bấm số liệu để đối chiếu danh sách thẻ.",
              },
              {
                title: "Cấu hình",
                description: "Thiết lập ngưỡng cảnh báo và định mức báo cáo.",
              },
            ].map((s, i) => (
              <div className="help-item" key={s.title}>
                <span>{i + 1}</span>
                <div>
                  <strong>{s.title}</strong>
                  <div className="muted">{s.description}</div>
                </div>
              </div>
            ))}
            <div className="help-note">
              <ShieldCheck size={18} />
              <span>
                Bấm số liệu để tra cứu các thẻ liên quan. Bấm mã thẻ để xem
                thông tin, lịch sử và lượt xe.
              </span>
            </div>
          </div>
        </Overlay>
      )}
      {leaveTarget && (
        <Overlay
          title="Bạn có thay đổi chưa lưu"
          dismissOnBackdrop={false}
          onClose={() => setLeaveTarget(null)}
          footer={
            <>
              <Button autoFocus onClick={() => setLeaveTarget(null)}>
                Tiếp tục chỉnh sửa
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (leaveTarget.mode) changeHandoffMode(leaveTarget.mode, true)
                  else if (leaveTarget.report) navigate(leaveTarget.report, true)
                  else if (leaveTarget.operation)
                    chooseOperation(leaveTarget.operation, true)
                  else if (leaveTarget.parking)
                    chooseParking(leaveTarget.parking.screen, leaveTarget.parking.patch, leaveTarget.parking.preserve, true)
                  else if (leaveTarget.access) changeParkingAccess(leaveTarget.access, true)
                  setLeaveTarget(null)
                }}
              >
                Bỏ thay đổi & chuyển trang
              </Button>
            </>
          }
        >
          <span className="muted">
            Các thông tin chưa xác nhận sẽ không được lưu. Bạn có muốn chuyển
            trang?
          </span>
        </Overlay>
      )}
    </div>
  )
}
function FragmentRows({ children }: { children: ReactNode }) {
  return <>{children}</>
}
export default App
