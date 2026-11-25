import { useState } from "react"
import { ArrowLeft, ArrowRight, CalendarDays, History, Pencil, Plus, Trash2 } from "lucide-react"
import { date, fmt } from "./data"
import { Badge, Button, Field, Form, Heading, Input, Overlay, Select, Textarea } from "./ui"
import { ParkingTable, ParkingTabs, TextLink } from "./parking-ui"
import { allowedSites, dayAt, dayStart, daysIn, isDay, minuteIso, shiftDay, siteById, vnNow } from "./parking-model"
import type { Holiday, ParkingAccess } from "./parking-model"
import {
  canEditEvent, canEditHoliday, estateName, eventDays, eventEnd, eventFields, eventStart, eventState, eventTypes,
  validateEvent,
} from "./behavior-model"
import type { BehaviorEvent, EventFields, EventWindow } from "./behavior-model"
import { behaviorEvents, queueBehaviorRefresh } from "./behavior-lookup"
import { EventAnnotation, eventPeriod } from "./BehaviorDetails"
import { behaviorManagementTitle, behaviorOperationsTitle } from "./behavior-routes"
import { BehaviorPanel } from "./BehaviorTables"
import CardLookupMultiFilter from "./CardLookupMultiFilter"
import LookupFilterPanel, { lookupMatchHint } from "./LookupFilterPanel"
import type useParking from "./useParking"
import type { UpdateParams } from "./parking-ui"

const options = (list: readonly string[]) => list.map((value) => ({ value, label: value }))
const searchText = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d").trim()
const holidayGroups = (rows: Holiday[], year: string) => {
  const result: Holiday[][] = []
  for (const row of rows.filter((row) => !row.canceled && row.effective.startsWith(year)).sort((a, b) => a.effective.localeCompare(b.effective))) {
    const last = result.at(-1)
    if (last && last[0].name === row.name && shiftDay(last.at(-1)!.effective, 1) === row.effective) last.push(row)
    else result.push([row])
  }
  return result
}
const emptyEventFilters = { q: "", estates: [] as string[], types: [] as string[], states: [] as string[], start: "", end: "" }
const eventStates = ["Sắp diễn ra", "Đang diễn ra", "Đã diễn ra"]

export default function BehaviorConfiguration({ view, access, model, params, update, notify, onDirty, backToReport }: {
  view: "events" | "holidays"
  access: ParkingAccess; model: ReturnType<typeof useParking>; params: URLSearchParams; update: UpdateParams
  notify: (message: string) => void; onDirty: (dirty: boolean) => void
  backToReport: (origin: string) => void
}) {
  const now = vnNow(), today = dayAt(now)
  const sites = allowedSites(access)
  const estates = [...new Set(sites.map(({ estate }) => estate))].map((value) => ({ value, label: estateName(value) }))
  const events = behaviorEvents(model.settings).filter((event) => estates.some(({ value }) => value === event.estate))
  const canEvent = view === "events" && canEditEvent(access)
  const canHoliday = view === "holidays" && canEditHoliday(access)
  const tab = canEvent ? "Sự kiện" : "Ngày lễ"
  const tabs = [...(canEditEvent(access) ? ["Sự kiện"] : []), ...(canEditHoliday(access) ? ["Ngày lễ"] : [])]
  const focusEvent = params.get("focusEvent")
  const [filters, setFilters] = useState(() => ({ ...emptyEventFilters, q: focusEvent ?? "" }))
  const [draft, setDraft] = useState(filters)
  const [holidayFilter, setHolidayFilter] = useState({ year: today.slice(0, 4), q: "" })
  const [holidayDraft, setHolidayDraft] = useState(holidayFilter)
  const [holidayEdit, setHolidayEdit] = useState<Holiday[] | null>(null)
  const [deleteEvent, setDeleteEvent] = useState<BehaviorEvent | null>(null)
  const [deleteHoliday, setDeleteHoliday] = useState<Holiday[] | null>(null)
  const [history, setHistory] = useState(false)
  const active = params.get("configEvent")
  const current = active === "new" ? undefined : events.find((event) => event.id === active && !event.deleted)
  const conclusion = events.find((event) => event.id === params.get("configNote") && !event.deleted)
  const closeEvent = () => { onDirty(false); update({ configEvent: null }) }
  const closeHoliday = () => { onDirty(false); setHolidayEdit(null) }
  const query = searchText(filters.q)
  const dateError = draft.start && draft.end && draft.start > draft.end
    ? "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." : ""
  const visible = events.filter((event) => !event.deleted &&
    (!filters.estates.length || filters.estates.includes(event.estate)) && (!filters.types.length || filters.types.includes(event.type)) &&
    (!filters.states.length || filters.states.includes(eventState(event, now))) &&
    (!filters.start && !filters.end || eventDays(event).some((day) =>
      (!filters.start || day >= filters.start) && (!filters.end || day <= filters.end))) &&
    (!query || searchText(`${event.id} ${event.name}`).includes(query))).sort((a, b) => eventStart(b) - eventStart(a))
  const saveEvent = (fields: EventFields, previous?: BehaviorEvent) => {
    if (!canEvent || !estates.some(({ value }) => value === fields.estate)) return false
    return model.save((settings) => {
      const collection = behaviorEvents(settings)
      const latest = previous && collection.find((item) => item.id === previous.id)
      if (previous && (!latest || latest.deleted || latest.history[0]?.at !== previous.history[0]?.at || latest.estate !== fields.estate))
        throw new Error("Sự kiện đã thay đổi. Hãy đóng biểu mẫu và mở lại.")
      const error = validateEvent(fields, latest, today)
      if (error) throw new Error(error)
      const id = latest?.id ?? `SK-${String(Math.max(0, ...collection.map(({ id }) => Number(id.split("-")[1]) || 0)) + 1).padStart(2, "0")}`
      const value = { ...fields, id, name: fields.name.trim(), description: fields.description.trim() }
      const updated = {
        ...value, notes: latest?.notes ?? [], history: [{ at: new Date().toISOString(), actor: model.actor,
          text: latest ? "Sửa sự kiện" : "Thêm sự kiện", before: latest && eventFields(latest), after: value }, ...(latest?.history ?? [])],
      }
      const days = [...(latest ? eventDays(latest) : []), ...eventDays(updated)].filter((day) => day < today)
      return { ...settings, behaviorEvents: [...collection.filter((item) => item.id !== id), updated],
        behaviorSnapshot: queueBehaviorRefresh(settings, model.cutoff, days, value.estate) }
    })
  }
  const removeEvent = () => {
    if (!deleteEvent || !canEvent) return
    const saved = model.save((settings) => ({ ...settings,
      behaviorSnapshot: queueBehaviorRefresh(settings, model.cutoff, eventDays(deleteEvent).filter((day) => day < today), deleteEvent.estate),
      behaviorEvents: behaviorEvents(settings).map((item) => {
      if (item.id !== deleteEvent.id || item.deleted || !estates.some(({ value }) => value === item.estate)) return item
      if (item.history[0]?.at !== deleteEvent.history[0]?.at) throw new Error("Sự kiện đã thay đổi. Hãy mở lại trước khi xóa.")
      const before = eventFields(item), after = { ...before, deleted: true }
      return { ...item, deleted: true, history: [{ at: new Date().toISOString(), actor: model.actor, text: "Xóa sự kiện", before, after }, ...item.history] }
    }) }))
    if (saved) { setDeleteEvent(null); notify("Đã xóa sự kiện.") }
  }
  const saveNote = (id: string, previous: string | undefined, text: string) => {
    if (!canEvent || text.length > 1000) return false
    const saved = model.save((settings) => {
      const collection = behaviorEvents(settings)
      const current = collection.find((event) => event.id === id && !event.deleted && estates.some(({ value }) => value === event.estate))
      if (!current || current.notes[0]?.at !== previous) throw new Error("Chú thích đã thay đổi. Hãy đóng rồi mở lại chú thích.")
      const note = { text, at: new Date().toISOString(), actor: model.actor }
      return { ...settings, behaviorEvents: collection.map((event) => event.id === id ? { ...event, notes: [note, ...event.notes] } : event),
        history: [{ id: crypto.randomUUID(), at: minuteIso(vnNow()), actor: model.actor, action: "Lưu chú thích sự kiện",
          scope: current.estate, detail: `${id} · ${current.name}` }, ...settings.history] }
    })
    if (saved) notify("Đã lưu chú thích.")
    return saved
  }
  const saveDays = (incoming: { day: string; name: string }[], replaced: Holiday[] = []) => {
    if (!canHoliday) return false
    return model.save((settings) => {
      const replace = new Set(replaced.map(({ id }) => id))
      if (replaced.some((row) => !settings.holidays.some((item) => item.id === row.id && !item.canceled && item.updated === row.updated)))
        throw new Error("Ngày lễ đã thay đổi. Hãy mở lại biểu mẫu.")
      const others = settings.holidays.filter((row) => !row.canceled && !replace.has(row.id))
      const used = new Set(others.map(({ effective }) => effective))
      const at = minuteIso(vnNow())
      const added = incoming.map(({ day, name }) => {
        if (used.has(day)) throw new Error(`Ngày ${date(day)} đã có trong lịch ngày lễ.`)
        used.add(day)
        return { id: crypto.randomUUID(), effective: day, updated: at, actor: model.actor, name, substitute: false }
      })
      const action = replaced.length ? incoming.length ? "Sửa ngày lễ" : "Xóa ngày lễ" : incoming.length > 1 ? "Thêm danh sách ngày lễ" : "Thêm ngày lễ"
      const addedByDay = new Map(added.map((row) => [row.effective, row]))
      const previousByDay = new Map(replaced.map((row) => [row.effective, row]))
      const changes = [...new Set([...addedByDay.keys(), ...previousByDay.keys()])].map((day) => ({
        id: crypto.randomUUID(), kind: "holidays" as const, at, actor: model.actor, action, scope: "",
        detail: `${date(day)} · ${addedByDay.get(day)?.name ?? previousByDay.get(day)?.name}`,
        before: previousByDay.get(day), after: addedByDay.get(day),
      }))
      return { ...settings, holidays: [...settings.holidays.map((row) => replace.has(row.id) ? { ...row, canceled: true } : row), ...added],
        behaviorSnapshot: queueBehaviorRefresh(settings, model.cutoff,
          [...added, ...replaced].map(({ effective }) => effective).filter((day) => day < today)),
        history: [...changes, ...settings.history] }
    })
  }
  const holidays = holidayGroups(model.settings.holidays, holidayFilter.year)
    .filter(([holiday]) => searchText(holiday.name).includes(searchText(holidayFilter.q)))
  const years = [...new Set([today.slice(0, 4), String(Number(today.slice(0, 4)) + 1), holidayFilter.year,
    ...model.settings.holidays.map((row) => row.effective.slice(0, 4))])].sort()
  const showHolidayYear = (year: string) => {
    const next = { year, q: "" }
    setHolidayFilter(next)
    setHolidayDraft(next)
  }
  const affectedDays = (event: BehaviorEvent) => eventDays(event).filter((day) => day < today)
  return <>
    <div className="breadcrumbs"><span>{behaviorOperationsTitle}</span>
      <span aria-hidden="true">›</span><span className="current-crumb">{behaviorManagementTitle}</span></div>
    <div className="page-heading parking-heading">
      <div><Heading level={1}>{behaviorManagementTitle}</Heading><p className="page-description">{canEvent
        ? "Quản lý sự kiện trong phạm vi khu đô thị được phân quyền." : "Ngày lễ áp dụng cho tất cả khu đô thị."}</p></div>
      <div className="parking-actions">{params.has("fromEvent") && <Button onClick={() => backToReport(params.get("fromEvent")!)}>
        <ArrowLeft size={15} />Quay lại báo cáo</Button>}
        {canEvent ? <Button variant="primary" onClick={() => update({ configEvent: "new" })}><Plus size={16} /> Thêm sự kiện</Button>
          : <Button variant="primary" onClick={() => setHolidayEdit([])}><Plus size={16} /> Thêm ngày lễ</Button>}
      </div>
    </div>
    <ParkingTabs options={tabs} value={tab} change={(value) => {
      setHistory(false)
      update({ configView: value, configEvent: null, configNote: null })
    }} />
    {canEvent ? <>
      <LookupFilterPanel label="Bộ lọc Quản lý sự kiện" className="behavior-lookup-panel"
        pending={JSON.stringify(filters) !== JSON.stringify(draft)} disabled={!!dateError}
        onApply={() => setFilters(draft)} onClear={() => {
          const next = { ...emptyEventFilters, start: filters.start, end: filters.end }
          setFilters(next); setDraft(next)
        }}>
        <div className="filter-grid lookup-filter-primary lookup-filter-row">
          <Field label="Tìm sự kiện"><Input type="search" aria-label="Tìm sự kiện" placeholder="Mã hoặc tên sự kiện…" value={draft.q} maxLength={100}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })} /></Field>
          <CardLookupMultiFilter label="Trạng thái" value={draft.states} options={options(eventStates)} allLabel="Tất cả trạng thái"
            onChange={(states) => setDraft({ ...draft, states })} />
        </div>
        <div className="filter-grid lookup-filter-row behavior-event-options">
          <CardLookupMultiFilter label="Khu đô thị" value={draft.estates} options={estates} allLabel="Tất cả khu đô thị"
            onChange={(estates) => setDraft({ ...draft, estates })} />
          <CardLookupMultiFilter label="Loại sự kiện" value={draft.types} options={options(eventTypes)} allLabel="Tất cả loại sự kiện"
            onChange={(types) => setDraft({ ...draft, types })} />
        </div>
        <p className="lookup-multi-hint">{lookupMatchHint}</p>
        <div className="lookup-time-section">
          <div className="date-field"><Field label="Khoảng ngày diễn ra" error={dateError || undefined}>
            <div className="date-range">
              <CalendarDays size={15} />
              <Input type="date" aria-label="Từ ngày" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
              <span className="date-arrow"><ArrowRight size={14} /></span>
              <Input type="date" aria-label="Đến ngày" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
            </div>
          </Field></div>
        </div>
      </LookupFilterPanel>
      <BehaviorPanel title="Danh sách sự kiện" note={`${fmt(visible.length)} sự kiện`}
        actions={<Button onClick={() => setHistory(true)}><History size={15} /> Lịch sử thay đổi</Button>}>
        <ParkingTable rows={visible} rowKey={({ id }) => id} empty="Không có sự kiện phù hợp." columns={[
          { label: "Mã", cell: ({ id }) => id },
          { label: "Tên sự kiện", cell: ({ name, id }) => <TextLink onClick={() => update({ configEvent: id })}>{name}</TextLink> },
          { label: "Loại", cell: ({ type }) => type },
          { label: "Khu đô thị", cell: ({ estate }) => estateName(estate) },
          { label: "Phạm vi bãi", cell: (event) => <span className="behavior-wrap">{event.sites.map((id) => siteById(id)?.name ?? id).join(", ")}</span> },
          { label: "Thời gian", cell: eventPeriod },
          { label: "Trạng thái", cell: (event) => <Badge tone={eventState(event, now) === "Đã diễn ra" ? "gray" : eventState(event, now) === "Đang diễn ra" ? "green" : "blue"}>{eventState(event, now)}</Badge> },
          { label: "Chú thích", cell: ({ id, name, notes }) => <button type="button"
            className="parking-link behavior-note-preview" title={notes[0]?.text || "Thêm chú thích"}
            aria-label={`Chú thích · ${name}`} onClick={() => update({ configNote: id })}>
            {notes[0]?.text || "Thêm chú thích"}
          </button> },
          { label: "Thao tác", cell: (event) => <div className="parking-inline behavior-row-actions">
            <Button variant="ghost" aria-label={`Sửa ${event.name}`} onClick={() => update({ configEvent: event.id })}><Pencil size={14} /></Button>
            <Button variant="ghost" aria-label={`Xóa ${event.name}`} onClick={() => setDeleteEvent(event)}><Trash2 size={14} /></Button>
          </div> },
        ]} />
      </BehaviorPanel>
    </> : <>
      <LookupFilterPanel label="Bộ lọc Lịch ngày lễ" className="behavior-lookup-panel"
        pending={holidayFilter.year !== holidayDraft.year || holidayFilter.q !== holidayDraft.q}
        onApply={() => setHolidayFilter(holidayDraft)} onClear={() => showHolidayYear(holidayFilter.year)}>
        <div className="filter-grid lookup-filter-primary lookup-filter-row">
          <Field label="Tìm ngày lễ"><Input type="search" aria-label="Tìm ngày lễ" placeholder="Tên ngày lễ…" value={holidayDraft.q} maxLength={100}
            onChange={(e) => setHolidayDraft({ ...holidayDraft, q: e.target.value })} /></Field>
          <Field label="Năm"><Select aria-label="Năm" value={holidayDraft.year} options={years}
            onChange={(e) => setHolidayDraft({ ...holidayDraft, year: e.target.value })} /></Field>
        </div>
      </LookupFilterPanel>
      <BehaviorPanel title="Danh sách ngày lễ" note={`Năm ${holidayFilter.year} · ${fmt(holidays.length)} đợt nghỉ`}
        actions={<Button onClick={() => setHistory(true)}><History size={15} /> Lịch sử thay đổi</Button>}>
      <ParkingTable rows={holidays} rowKey={(rows) => rows[0].id}
        empty={holidayFilter.q ? "Không có ngày lễ phù hợp." : `Chưa khai báo ngày lễ năm ${holidayFilter.year}.`} columns={[
        { label: "Ngày lễ", cell: (rows) => rows[0].name },
        { label: "Từ ngày", cell: (rows) => date(rows[0].effective) },
        { label: "Đến ngày", cell: (rows) => date(rows.at(-1)!.effective) },
        { label: "Số ngày", numeric: true, cell: (rows) => fmt(rows.length) },
        { label: "Thao tác", cell: (rows) => <div className="parking-inline behavior-row-actions">
          <Button variant="ghost" aria-label={`Sửa ${rows[0].name}`} onClick={() => setHolidayEdit(rows)}><Pencil size={14} /></Button>
          <Button variant="ghost" aria-label={`Xóa ${rows[0].name}`} onClick={() => setDeleteHoliday(rows)}><Trash2 size={14} /></Button>
        </div> },
      ]} />
      </BehaviorPanel>
    </>}
    {canEvent && (current || active === "new") && <EventEditor key={active} event={current} sites={sites} estates={estates} today={today}
      close={closeEvent} dirty={onDirty} save={(fields) => {
        if (saveEvent(fields, current)) { closeEvent(); notify(current ? "Đã cập nhật sự kiện." : "Đã thêm sự kiện.") }
      }} />}
    {canEvent && conclusion && <Overlay title="Chú thích sự kiện" subtitle={`${conclusion.id} · ${conclusion.name}`}
      wide onClose={() => update({ configNote: null })} footer={<Button onClick={() => update({ configNote: null })}>Đóng</Button>}>
      <EventAnnotation key={conclusion.id} event={conclusion} save={(previous, text) => saveNote(conclusion.id, previous, text)} />
    </Overlay>}
    {canHoliday && holidayEdit && <HolidayEditor rows={holidayEdit} today={today} close={closeHoliday} dirty={onDirty}
      save={(rows) => { if (saveDays(rows, holidayEdit)) { showHolidayYear(rows[0].day.slice(0, 4)); closeHoliday(); notify("Đã lưu ngày lễ.") } }} />}
    {deleteEvent && <Overlay title="Xóa sự kiện" subtitle={`${deleteEvent.id} · ${deleteEvent.name}`} onClose={() => setDeleteEvent(null)}
      footer={<><Button onClick={() => setDeleteEvent(null)}>Hủy</Button><Button variant="primary" onClick={removeEvent}>Xóa sự kiện</Button></>}>
      <p>Chú thích và lịch sử của sự kiện được lưu lại.</p>
      {!!affectedDays(deleteEvent).length && <p className="parking-banner warning">Ngày có số liệu bị ảnh hưởng: {affectedDays(deleteEvent).map(date).join(", ")}.</p>}
    </Overlay>}
    {deleteHoliday && <Overlay title="Xóa ngày lễ" subtitle={deleteHoliday[0].name} onClose={() => setDeleteHoliday(null)}
      footer={<><Button onClick={() => setDeleteHoliday(null)}>Hủy</Button><Button variant="primary" onClick={() => {
        if (saveDays([], deleteHoliday)) { setDeleteHoliday(null); notify("Đã xóa ngày lễ.") }
      }}>Xóa ngày lễ</Button></>}>
      <p>Xóa lịch từ {date(deleteHoliday[0].effective)} đến {date(deleteHoliday.at(-1)!.effective)} khỏi lịch dùng chung.</p>
    </Overlay>}
    {history && <Overlay title="Lịch sử thay đổi" subtitle={tab} wide onClose={() => setHistory(false)}>
      {canEvent ? <ParkingTable rows={events.flatMap((event) => event.history.map((entry) => ({ ...entry, id: event.id })))
        .sort((a, b) => b.at.localeCompare(a.at))} rowKey={(row) => `${row.id}/${row.at}`} empty="Chưa có thay đổi." columns={[
          { label: "Thời điểm", cell: ({ at }) => new Date(at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) },
          { label: "Người thực hiện", cell: ({ actor }) => actor },
          { label: "Thao tác", cell: ({ text, id }) => `${text} · ${id}` },
          { label: "Trước → Sau", cell: ({ before, after }) => <details className="behavior-change"><summary>{after.name}</summary>
            {before && <HistoryFields value={before} />}{!after.deleted && <HistoryFields value={after} />}</details> },
        ]} /> : <ParkingTable rows={model.settings.history.filter(({ kind }) => kind === "holidays").sort((a, b) => b.at.localeCompare(a.at))}
          rowKey={({ id }) => id} empty="Chưa có thay đổi." columns={[
          { label: "Thời điểm", cell: ({ at }) => at.replace("T", " ") },
          { label: "Người thực hiện", cell: ({ actor }) => actor },
          { label: "Thao tác", cell: ({ action }) => action },
          { label: "Ngày lễ", cell: ({ detail, before, after }) => before && after && "name" in before && "name" in after
            ? `${detail} · ${before.name} → ${after.name}` : detail },
        ]} />}
    </Overlay>}
  </>
}

function HistoryFields({ value }: { value: EventFields }) {
  return <p className="behavior-wrap">{value.name} · {value.type}
    <br />{value.sites.map((id) => siteById(id)?.name ?? id).join(", ")}
    <br />{value.windows.map((window) => `${date(window.day)} ${window.start}–${window.end}${window.overnight ? " (+1 ngày)" : ""}`).join("; ")}
    {value.description && <><br />{value.description}</>}
  </p>
}

function EventEditor({ event, sites, estates, today, close, dirty, save }: {
  event?: BehaviorEvent; sites: ReturnType<typeof allowedSites>; estates: { value: string; label: string }[]
  today: string; close: () => void; dirty: (value: boolean) => void; save: (value: EventFields) => void
}) {
  const initialEstate = event?.estate ?? estates[0]?.value ?? ""
  const initial: EventFields = event ? eventFields(event) : {
    id: "", name: "", type: eventTypes[0], estate: initialEstate, sites: sites.filter((site) => site.estate === initialEstate).map(({ id }) => id),
    windows: [{ day: today, start: "17:00", end: "21:00", overnight: false }], description: "",
  }
  const [value, setValue] = useState(initial)
  const [error, setError] = useState("")
  const [repeat, setRepeat] = useState(false)
  const [until, setUntil] = useState(today)
  const [confirmClose, setConfirmClose] = useState(false)
  const change = (patch: Partial<EventFields>) => {
    const next = { ...value, ...patch }
    setValue(next); setError(""); dirty(JSON.stringify(next) !== JSON.stringify(initial))
  }
  const updateWindow = (index: number, patch: Partial<EventWindow>) =>
    change({ windows: value.windows.map((slot, i) => i === index ? { ...slot, ...patch } : slot) })
  const previous = (key: "name" | "type" | "description") =>
    event && event[key] !== value[key] ? `Giá trị cũ: ${event[key] || "—"}` : undefined
  const dates = [...new Set([...(event ? eventDays(event) : []), ...value.windows.filter((slot) => isDay(slot.day))
    .flatMap((slot) => [slot.day, ...(slot.overnight ? [shiftDay(slot.day, 1)] : [])])])].filter((day) => day < today).sort()
  const submit = () => {
    const issue = validateEvent(value, event, today)
    if (issue) setError(issue)
    else save(value)
  }
  const requestClose = () => JSON.stringify(initial) === JSON.stringify(value) ? close() : setConfirmClose(true)
  const firstWindow = value.windows[0]
  return <Overlay title={event ? "Sửa sự kiện" : "Thêm sự kiện"} subtitle={event?.id} wide onClose={requestClose}
    footer={<><Button onClick={requestClose}>Hủy</Button><Button type="submit" form="behavior-event-form" variant="primary">Lưu sự kiện</Button></>}>
    <Form id="behavior-event-form" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <div className="behavior-detail">
        <div className="behavior-form-grid">
          <Field label="Tên sự kiện" required hint={previous("name")}><Input aria-label="Tên sự kiện" maxLength={200} value={value.name}
            onChange={(e) => change({ name: e.target.value })} /></Field>
          <Field label="Loại sự kiện" required hint={previous("type")}><Select aria-label="Loại sự kiện" options={[...eventTypes]} value={value.type}
            onChange={(e) => change({ type: e.target.value as EventFields["type"] })} /></Field>
          <Field label="Khu đô thị" required><Select aria-label="Khu đô thị" options={estates} value={value.estate} disabled={!!event}
            onChange={(e) => change({ estate: e.target.value, sites: sites.filter((site) => site.estate === e.target.value).map(({ id }) => id) })} /></Field>
          <div><CardLookupMultiFilter label="Phạm vi bãi xe" allLabel="Chọn ít nhất một bãi" value={value.sites}
            options={sites.filter((site) => site.estate === value.estate).map(({ id, name }) => ({ value: id, label: name }))}
            onChange={(ids) => change({ sites: ids })} />
            {event && event.sites.join() !== value.sites.join() && <small className="muted">Giá trị cũ: {event.sites.map((id) => siteById(id)?.name ?? id).join(", ")}</small>}
          </div>
        </div>
        <section className="behavior-window-section">
          <div className="behavior-window-heading"><Heading level={3}>Khung giờ sự kiện</Heading>
            <Button onClick={() => setRepeat(!repeat)} aria-expanded={repeat}><CalendarDays size={15} /> Lặp hằng ngày</Button></div>
          {repeat && <div className="behavior-repeat">
            <Field label="Lặp từ ngày"><Input type="date" aria-label="Lặp từ ngày" value={firstWindow.day}
              onChange={(e) => updateWindow(0, { day: e.target.value })} /></Field>
            <Field label="Lặp đến ngày"><Input type="date" aria-label="Lặp đến ngày" value={until} min={firstWindow.day}
              onChange={(e) => setUntil(e.target.value)} /></Field>
            <Button onClick={() => {
              if (!isDay(firstWindow.day) || !isDay(until) || until < firstWindow.day || dayStart(until) - dayStart(firstWindow.day) >= 1440 * 100) {
                setError("Khoảng lặp phải từ 1 đến 100 ngày."); return
              }
              change({ windows: daysIn(firstWindow.day, until).map((day) => ({ ...firstWindow, day })) }); setRepeat(false)
            }}>Tạo các khung</Button>
            <span className="muted">Dùng giờ của khung đầu và thay các khung đang nhập.</span>
          </div>}
          <div className="behavior-window-list">{value.windows.map((slot, index) => <div key={index} className="behavior-window-row">
            <Field label="Ngày"><Input type="date" aria-label={`Ngày khung ${index + 1}`} value={slot.day} onChange={(e) => updateWindow(index, { day: e.target.value })} /></Field>
            <Field label="Bắt đầu"><Input type="time" step={300} aria-label={`Bắt đầu khung ${index + 1}`} value={slot.start} onChange={(e) => updateWindow(index, { start: e.target.value })} /></Field>
            <Field label="Kết thúc"><Input type="time" step={300} aria-label={`Kết thúc khung ${index + 1}`} value={slot.end} onChange={(e) => updateWindow(index, { end: e.target.value })} /></Field>
            <label className="behavior-check"><input type="checkbox" checked={slot.overnight} onChange={(e) => updateWindow(index, { overnight: e.target.checked })} />
              Kết thúc ngày hôm sau</label>
            <Button variant="ghost" aria-label={`Bỏ khung ${index + 1}`} disabled={value.windows.length === 1}
              onClick={() => change({ windows: value.windows.filter((_, i) => i !== index) })}><Trash2 size={15} /></Button>
          </div>)}</div>
          {event && JSON.stringify(event.windows) !== JSON.stringify(value.windows) && <p className="muted">Giá trị cũ: {event.windows
            .map((slot) => `${date(slot.day)} ${slot.start}–${slot.end}${slot.overnight ? " (+1 ngày)" : ""}`).join(" · ")}</p>}
          <Button variant="link" disabled={value.windows.length >= 100} onClick={() => {
            const last = value.windows.at(-1)!
            change({ windows: [...value.windows, { ...last, day: isDay(last.day) ? shiftDay(last.day, 1) : today }] })
          }}><Plus size={15} /> Thêm khung giờ</Button>
        </section>
        <Field label="Mô tả" hint={previous("description") || `${fmt(value.description.length)} / 1.000 ký tự`}>
          <Textarea aria-label="Mô tả" rows={3} maxLength={1000} value={value.description} onChange={(e) => change({ description: e.target.value })} /></Field>
        {!!dates.length && <p className="parking-banner warning">Ngày có số liệu bị ảnh hưởng: {dates.map(date).join(", ")}.</p>}
        {error && <p className="parking-banner error" role="alert">{error}</p>}
      </div>
    </Form>
    {confirmClose && <Overlay title="Bỏ thay đổi?" dismissOnBackdrop={false} onClose={() => setConfirmClose(false)}
      footer={<><Button onClick={() => setConfirmClose(false)}>Tiếp tục sửa</Button><Button variant="primary" onClick={close}>Bỏ thay đổi</Button></>}>
      <p>Thay đổi trong biểu mẫu chưa được lưu.</p></Overlay>}
  </Overlay>
}

function HolidayEditor({ rows, today, close, dirty, save }: {
  rows: Holiday[]; today: string; close: () => void; dirty: (value: boolean) => void; save: (rows: { day: string; name: string }[]) => void
}) {
  const [name, setName] = useState(rows[0]?.name ?? "")
  const [start, setStart] = useState(rows[0]?.effective ?? today)
  const [end, setEnd] = useState(rows.at(-1)?.effective ?? today)
  const [error, setError] = useState("")
  return <Overlay title={rows.length ? "Sửa ngày lễ" : "Thêm ngày lễ"} onClose={close}
    footer={<><Button onClick={close}>Hủy</Button><Button type="submit" form="behavior-holiday-form" variant="primary">Lưu ngày lễ</Button></>}>
    <Form id="behavior-holiday-form" className="behavior-detail" onSubmit={(e) => {
      e.preventDefault()
      if (!name.trim() || !isDay(start) || !isDay(end) || end < start || dayStart(end) - dayStart(start) >= 1440 * 366) {
        setError("Nhập tên và khoảng ngày hợp lệ, tối đa 366 ngày."); return
      }
      save(daysIn(start, end).map((day) => ({ day, name: name.trim() })))
    }}>
      <Field label="Tên ngày lễ" required><Input aria-label="Tên ngày lễ" value={name} maxLength={200}
        onChange={(e) => { setName(e.target.value); dirty(true) }} /></Field>
      <div className="behavior-form-grid">
        <Field label="Từ ngày" required><Input type="date" aria-label="Từ ngày nghỉ lễ" value={start}
          onChange={(e) => { setStart(e.target.value); dirty(true) }} /></Field>
        <Field label="Đến ngày" required><Input type="date" aria-label="Đến ngày nghỉ lễ" value={end}
          onChange={(e) => { setEnd(e.target.value); dirty(true) }} /></Field>
      </div>
      {error && <p className="parking-banner error" role="alert">{error}</p>}
    </Form>
  </Overlay>
}
