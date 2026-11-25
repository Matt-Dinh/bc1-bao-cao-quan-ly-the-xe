import { useEffect, useMemo, useState } from "react"
import { CalendarDays, ChartNoAxesCombined, ChevronRight, Download, Info, LoaderCircle, ShieldAlert, TriangleAlert } from "lucide-react"
import { date, fmt } from "./data"
import { Button, Field, Heading, Overlay, Select } from "./ui"
import { TextLink } from "./parking-ui"
import type { ExportParking, UpdateParams } from "./parking-ui"
import { allowedSites, canOpen, shiftDay, siteById, vnToday } from "./parking-model"
import type { ParkingAccess, Trip } from "./parking-model"
import { tripLookupValue, tripLookupValues } from "./parking-lookup"
import {
  behaviorGuests, behaviorPeriod, behaviorPeriodError, behaviorScope, behaviorVehicles, buildBehaviorData, canEditEvent,
  canEditHoliday, canExportBehavior, canReadBehavior, canSeePlates, estateName, eventTypes, summarizeEvents,
} from "./behavior-model"
import type { BehaviorData, BehaviorFilters, ReturningVehicle } from "./behavior-model"
import { behaviorReportInputs } from "./behavior-lookup"
import { behaviorConfig, behaviorReport, behaviorSections, behaviorTitle, readBehaviorSection } from "./behavior-routes"
import type { BehaviorScreen, BehaviorSection } from "./behavior-routes"
import { ArrivalsReport, ReturningReport, TimeReport } from "./BehaviorTables"
import type { Drill } from "./BehaviorTables"
import { EventDetail, EventsReport, PlateList } from "./BehaviorDetails"
import BehaviorConfiguration from "./BehaviorConfiguration"
import BehaviorDashboard from "./BehaviorDashboard"
import CardLookupMultiFilter from "./CardLookupMultiFilter"
import LookupFilterPanel, { lookupMatchHint } from "./LookupFilterPanel"
import ReportPeriodFields from "./ReportPeriodFields"
import type useParking from "./useParking"
import "./behavior.css"

const fieldOptions = (values: readonly string[]) => values.map((value) => ({ value, label: value }))
const roles = (access: ParkingAccess) => access.estate ? "Tổng trong phạm vi quyền" : "Tổng cộng"
const classifyOptions = ["Loại xe", "Sự kiện / Không sự kiện", "Loại khách"]
const splitOptions = ["Không tách", "Khu đô thị", "Bãi xe"]
function getFilters(params: URLSearchParams, yesterday: string): BehaviorFilters {
  const period = behaviorPeriod(yesterday)
  return { start: params.get("start") ?? period.start, end: params.get("end") ?? period.end,
    estates: tripLookupValues(params, "estate"), sites: tripLookupValues(params, "site"),
    vehicles: tripLookupValues(params, "vehicle"), guests: params.has("group") ? tripLookupValues(params, "group") : ["Vãng lai"],
    type: "" }
}
type Props = {
  screen: BehaviorScreen
  access: ParkingAccess
  params: URLSearchParams
  model: ReturnType<typeof useParking>
  tripUpdates?: Trip[]
  update: UpdateParams
  manageEvent: (id: string, origin: string) => void
  backToReport: (origin: string) => void
  notify: (message: string) => void
  onDirty: (dirty: boolean) => void
}

export default function Behavior(props: Props) {
  const { screen, access } = props
  if (screen !== behaviorReport) {
    const requested = props.params.get("configView")
    const events = requested ? requested !== "Ngày lễ" : screen !== behaviorConfig && canEditEvent(access)
    const allowed = events ? canEditEvent(access) : canEditHoliday(access)
    return <div className="parking-module behavior-module">
      {allowed ? <BehaviorConfiguration {...props} view={events ? "events" : "holidays"} /> : <Denied />}
    </div>
  }
  return <BehaviorReport key={screen} {...props} />
}
function Denied() {
  return <div className="parking-banner error" role="alert"><ShieldAlert size={17} />Bạn không có quyền truy cập trang này.</div>
}

function BehaviorReport({ access, params, model, tripUpdates, update, manageEvent, notify }: Props) {
  const yesterday = shiftDay(vnToday(), -1)
  const { cutoff } = model
  const section = readBehaviorSection(params.get("behaviorSection"))
  const serializedTypes = params.get("eventType")
  const eventTypesApplied = useMemo(() => tripLookupValues(new URLSearchParams(serializedTypes
    ? { eventType: serializedTypes } : undefined), "eventType"), [serializedTypes])
  const [eventTypesDraft, setEventTypesDraft] = useState(eventTypesApplied)
  useEffect(() => setEventTypesDraft(eventTypesApplied), [eventTypesApplied])
  const appliedKey = JSON.stringify(getFilters(params, yesterday))
  const applied = useMemo(() => JSON.parse(appliedKey) as BehaviorFilters, [appliedKey])
  const [draft, setDraft] = useState(applied)
  const [filterNotice, setFilterNotice] = useState("")
  useEffect(() => { setDraft(applied); setFilterNotice("") }, [applied])
  const ran = params.get("behaviorRun") !== "0"
  const periodError = behaviorPeriodError(draft, yesterday)
  const scope = useMemo(() => behaviorScope(applied, access), [applied, access])
  const denied = !canReadBehavior(access) || scope.denied
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; data?: BehaviorData; error?: string }>()
  const key = `${appliedKey}/${access.role}/${access.estate}/${cutoff}/${attempt}`
  const input = useMemo(() => behaviorReportInputs(model.settings, cutoff, [...new Set(scope.sites.map((site) => site.estate))]), [
    model.settings.behaviorEvents, model.settings.behaviorSnapshot, model.settings.holidays, cutoff, scope,
  ])
  const sites = allowedSites(access)
  const statsCutoff = applied.end < cutoff ? applied.end : cutoff
  const trips = useMemo(() => {
    if (!model.trips || !tripUpdates?.length) return model.trips
    const rows = new Map(model.trips.map((trip) => [trip.id, trip]))
    for (const trip of tripUpdates) rows.set(trip.id, trip)
    return [...rows.values()]
  }, [model.trips, tripUpdates])
  const canRun = ran && !denied && !behaviorPeriodError(applied, yesterday)
  useEffect(() => {
    if (!canRun || !trips) return
    const timer = window.setTimeout(() => {
      try {
        setResult({ key, data: buildBehaviorData(trips, input.events, input.holidays, applied, scope.sites, cutoff) })
      } catch {
        setResult({ key, error: "BC4-01" })
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [canRun, key, trips, input, applied, scope, cutoff])
  const data = canRun && result?.key === key ? result.data : undefined
  const failure = canRun && result?.key === key ? result.error : null
  const busy = canRun && !data && !failure
  const [plates, setPlates] = useState<{ title: string; rows: ReturningVehicle[] } | null>(null)
  const total = roles(access)
  const events = useMemo(() => data ? summarizeEvents(data, input.events) : [], [data, input.events])
  const visibleEvents = eventTypesApplied.length ? events.filter(({ event }) => eventTypesApplied.includes(event.type)) : events
  const event = events.find(({ event }) => event.id === params.get("eventDetail"))
  const optionsSites = sites.filter((site) => !draft.estates.length || draft.estates.includes(site.estate))
  const showPending = input.pending.some((day) => day >= applied.start && day <= applied.end)
  const set = (patch: Partial<BehaviorFilters>) => setDraft((current) => ({ ...current, ...patch }))
  const openSection = (value: BehaviorSection) => update({ behaviorSection: value, eventDetail: null })
  const openPlates = (title: string, rows: ReturningVehicle[]) => {
    if (!canSeePlates(access)) { notify("Bạn không có quyền xem danh sách biển số."); return }
    model.audit("Mở danh sách biển số", `${title} · ${date(applied.start)} – ${date(applied.end)} · ${fmt(rows.length)} xe`,
      applied.estates.length === 1 ? applied.estates[0] : access.estate)
    setPlates({ title, rows })
  }
  const run = (filters = draft) => {
    if (behaviorPeriodError(filters, yesterday)) return
    setPlates(null)
    update({ start: filters.start, end: filters.end, estate: tripLookupValue(filters.estates), site: tripLookupValue(filters.sites),
      vehicle: tripLookupValue(filters.vehicles), group: tripLookupValue(filters.guests) ?? "",
      behaviorRun: "1", eventDetail: null, behaviorSection: null })
    setAttempt((value) => value + 1)
  }
  const drill: Drill = (label, patch = {}) => {
    if (!canOpen(access, "parking-trips")) { notify("Bạn không có quyền tra cứu lượt xe."); return }
    const origin = new URLSearchParams(params)
    origin.delete("module")
    const mode = new URLSearchParams(window.location.search).get("mode") ?? "behavior"
    const target = new URLSearchParams({ module: "parking-trips", mode, originScreen: behaviorReport, origin: origin.toString(),
      start: applied.start, end: statsCutoff, tripMode: "incoming", bContext: label, bCutoff: cutoff })
    const conditions = { estate: tripLookupValue(applied.estates), site: tripLookupValue(applied.sites),
      vehicle: tripLookupValue(applied.vehicles), group: tripLookupValue(applied.guests), ...patch }
    for (const [name, value] of Object.entries(conditions)) if (value) target.set(name, value)
    window.open(`${window.location.pathname}?${target}`, "_blank", "noopener")
  }
  const exportFile: ExportParking = (name, make, count) => {
    if (!canExportBehavior(access) || name === "DanhSachBienSo" && !canSeePlates(access)) return
    model.audit("Xuất dữ liệu", `${name} · ${date(applied.start)} – ${date(applied.end)}`, applied.estates[0] ?? access.estate)
    model.exportFile(name, make, count)
  }
  const download = async (detail?: BehaviorSection) => {
    if (!data) return
    try {
      const { behaviorWorkbook } = await import("./behavior-export")
      const exportedEvents = detail === "events" ? visibleEvents : events
      const names: Record<BehaviorSection, string> = { arrivals: "LuotDenVaLuuTru", time: "LuotDenTheoThoiGian",
        events: "PhanTichSuKien", returning: "KhachQuayLai" }
      const rowCount = !detail || detail === "events" ? exportedEvents.reduce((count, event) =>
        count + 1 + event.windows.reduce((n, slot) => n + Math.max(1, slot.weeks.length), 0), 0) : 0
      const filter = detail === "events" ? { ...applied, type: eventTypesApplied.join(", ") } : applied
      exportFile(detail ? names[detail] : "PhanTichHanhVi",
        () => behaviorWorkbook(detail, data, filter, exportedEvents, statsCutoff, model.actor, total), rowCount)
    } catch { notify("Không thể xuất dữ liệu. Vui lòng thử lại.") }
  }
  return <div className="parking-module behavior-module">
    <div className="breadcrumbs"><span>Báo cáo</span><ChevronRight size={12} /><span className="current-crumb">{behaviorTitle}</span></div>
    <div className="page-heading parking-heading">
      <div><Heading level={1}>{behaviorTitle}</Heading>
        <p className="page-description">Dữ liệu minh họa · Số liệu đến 23:59:59 {date(cutoff)} · GMT+7</p></div>
      {canExportBehavior(access) && !denied && <Button onClick={() => download()} disabled={!data}>
        <Download size={15} />Tải báo cáo
      </Button>}
    </div>
    {denied && !canReadBehavior(access) ? <Denied /> : <>
      <LookupFilterPanel label="Bộ lọc Báo cáo phân tích hành vi" className="behavior-lookup-panel"
        pending={JSON.stringify(draft) !== appliedKey} disabled={!!periodError} busy={busy && JSON.stringify(draft) === appliedKey}
        onApply={run} onClear={() => {
          const cleared = { ...applied, estates: [], sites: [], vehicles: [], guests: [] }
          setDraft(cleared)
          setFilterNotice("")
          run(cleared)
        }}>
        <div className="filter-grid lookup-filter-row">
          <CardLookupMultiFilter label="Khu đô thị" allLabel="Tất cả khu đô thị" value={draft.estates}
            options={[...new Set(sites.map(({ estate }) => estate))].map((value) => ({ value, label: estateName(value) }))}
            onChange={(estates) => {
              const selected = draft.sites.filter((id) => !estates.length || estates.includes(siteById(id)?.estate ?? ""))
              setFilterNotice(selected.length !== draft.sites.length
                ? "Đã bỏ các bãi xe không thuộc khu đô thị vừa chọn. Vui lòng kiểm tra lại bãi xe trước khi áp dụng." : "")
              set({ estates, sites: selected })
            }} />
          <CardLookupMultiFilter label="Bãi xe" allLabel="Tất cả bãi xe" value={draft.sites}
            options={optionsSites.map(({ id, label }) => ({ value: id, label }))} onChange={(values) => set({ sites: values })}
            note="Tên khu đô thị đi kèm giúp phân biệt các bãi xe trùng tên." />
          <CardLookupMultiFilter label="Phương tiện" allLabel="Tất cả phương tiện" value={draft.vehicles}
            options={fieldOptions(behaviorVehicles)} onChange={(values) => set({ vehicles: values })} />
          <CardLookupMultiFilter label="Loại khách" allLabel="Tất cả loại khách" value={draft.guests}
            options={fieldOptions(behaviorGuests)} onChange={(values) => set({ guests: values })} />
        </div>
        <p className="lookup-multi-hint">{lookupMatchHint}</p>
        {filterNotice && <p className="lookup-multi-notice" role="status">{filterNotice}</p>}
        <div className="lookup-time-section">
          <div className="lookup-time-fields">
            <ReportPeriodFields period={draft} max={yesterday} error={periodError} onChange={set} />
          </div>
          <p className="lookup-time-hint"><Info size={13} /><span>Lượt được tính theo giờ xe vào bãi trong kỳ đã chọn.</span></p>
        </div>
      </LookupFilterPanel>
      {denied ? <Denied /> : <>
        {cutoff < yesterday && <p className="parking-banner warning"><Info size={16} />
          Đang dùng số liệu đến {date(cutoff)}. Số liệu ngày {date(yesterday)} đang được tổng hợp.
        </p>}
        {showPending && <p className="parking-banner" role="status"><Info size={16} />
          Số liệu sẽ được tính lại trong đêm cho các ngày {input.pending.filter((day) => day >= applied.start && day <= applied.end).map(date).join(", ")}.
        </p>}
        {(!ran || !canRun) && <div className="panel behavior-empty">
          <span className="behavior-empty-icon"><ChartNoAxesCombined size={24} /></span>
          <Heading level={2}>Chưa chạy báo cáo</Heading>
          <p>Chọn bộ lọc và bấm Áp dụng để hiển thị số liệu.</p>
        </div>}
        {busy && <p className="panel parking-empty" role="status"><LoaderCircle size={20} className="animate-spin" /> Đang tải số liệu…</p>}
        {failure && <p className="parking-banner error" role="alert"><TriangleAlert size={16} />
          Không tải được số liệu ({failure}). <TextLink onClick={() => setAttempt((value) => value + 1)}>Thử lại</TextLink></p>}
        {data && <>
          <p className="behavior-result-period"><CalendarDays size={14} />{date(applied.start)} – {date(applied.end)}
            <span>·</span>{applied.guests.length ? applied.guests.join(", ") : "Tất cả loại khách"}
          </p>
          <BehaviorDashboard data={data} events={events} drill={drill} open={openSection} />
        </>}
      </>}
    </>}
    {data && section && !event && !plates && <Overlay wide title={`${behaviorSections[section]} · Số liệu chi tiết`}
      subtitle={`${date(applied.start)} – ${date(applied.end)}`} onClose={() => update({ behaviorSection: null })}
      footer={<>{canExportBehavior(access) && <Button onClick={() => download(section)}><Download size={15} />Tải bảng</Button>}
        <Button variant="primary" onClick={() => update({ behaviorSection: null })}>Đóng</Button></>}>
      {section === "arrivals" && <>
        <div className="behavior-detail-filters">
          <Field label="Phân loại theo"><Select aria-label="Phân loại theo" value={params.get("classify") ?? classifyOptions[0]}
            options={classifyOptions} onChange={(e) => update({ classify: e.target.value })} /></Field>
          <Field label="Tách theo"><Select aria-label="Tách theo" value={params.get("split") ?? splitOptions[0]}
            options={splitOptions} onChange={(e) => update({ split: e.target.value })} /></Field>
        </div>
        <ArrivalsReport data={data} total={total} guests={applied.guests} drill={drill}
          classification={params.get("classify")} split={params.get("split")} />
      </>}
      {section === "time" && <TimeReport data={data} total={total} drill={drill}
        view={params.get("timeView")} average={params.get("timeAverage") === "1"} change={update} />}
      {section === "events" && <>
        <LookupFilterPanel label="Bộ lọc chi tiết sự kiện" className="behavior-lookup-panel"
          pending={tripLookupValue(eventTypesDraft) !== tripLookupValue(eventTypesApplied)}
          onApply={() => update({ eventType: tripLookupValue(eventTypesDraft) })}
          onClear={() => { setEventTypesDraft([]); update({ eventType: null }) }}>
          <div className="filter-grid lookup-filter-row"><CardLookupMultiFilter label="Loại sự kiện" value={eventTypesDraft}
            allLabel="Tất cả loại sự kiện" options={fieldOptions(eventTypes)} onChange={setEventTypesDraft} /></div>
        </LookupFilterPanel>
        <EventsReport summaries={visibleEvents} total={total} drill={drill} open={(id) => update({ eventDetail: id })} />
      </>}
      {section === "returning" && <ReturningReport data={data} total={total} drill={drill} open={openPlates} />}
    </Overlay>}
    {event && <EventDetail key={event.event.id} summary={event} close={() => update({ eventDetail: null })}
      manage={canEditEvent(access) ? () => manageEvent(event.event.id, params.toString()) : undefined} drill={drill} />}
    {plates && !denied && canSeePlates(access) && <PlateList title={plates.title} items={plates.rows} close={() => setPlates(null)}
      drill={drill} exportFile={canExportBehavior(access) ? exportFile : undefined} />}
    <footer className="page-footer"><span>VParking CMS · {behaviorTitle}</span><span>Dữ liệu minh họa · GMT+7</span></footer>
  </div>
}

