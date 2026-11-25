import { useState } from "react"
import { ArrowUpRight, Download, History, Pencil } from "lucide-react"
import { date, fmt } from "./data"
import { Badge, Button, Field, Form, Overlay, Select, Textarea } from "./ui"
import { excelDate, ParkingPagination, ParkingTable, TextLink } from "./parking-ui"
import type { ExportParking, TableColumn } from "./parking-ui"
import { dayAt, displayTime, siteById } from "./parking-model"
import {
  arrivalStats, estateName, eventEnd, eventStart, eventTimeline, hourLabel, hourOf, proportion,
} from "./behavior-model"
import type { BehaviorEvent, EventSummary, ReturningVehicle } from "./behavior-model"
import { BehaviorPanel, Count, decimal, knownVehicles, percent, signed, ThinSample } from "./BehaviorTables"
import type { Drill } from "./BehaviorTables"

export const eventPeriod = (event: BehaviorEvent) => event.windows.length === 1
  ? `${displayTime(eventStart(event))} → ${dayAt(eventStart(event)) === dayAt(eventEnd(event)) ? displayTime(eventEnd(event)).slice(11) : displayTime(eventEnd(event))}`
  : `${date(dayAt(eventStart(event)))} – ${date(dayAt(eventEnd(event)))} · ${event.windows.length} khung`
const eventScope = (event: BehaviorEvent) => event.sites.map((id) => siteById(id)?.name ?? id).join(", ")
const noteTime = (iso: string) => displayTime(Date.parse(iso) / 60_000 + 7 * 60)

export function EventsReport({ summaries, total, drill, open }: {
  summaries: EventSummary[]; total: string; drill: Drill; open: (id: string) => void
}) {
  const unique = [...new Map(summaries.flatMap(({ rows }) => rows).map((row) => [row.trip.id, row])).values()]
  const rows = [
    ...(summaries.length ? [{ event: null, stats: arrivalStats(unique), rows: unique, expected: null, gain: null, partial: false }] : []),
    ...summaries.map((row) => ({ ...row, stats: arrivalStats(row.rows) })),
  ]
  const patch = (event: BehaviorEvent | null) => ({ bEvent: event?.id ?? summaries.map(({ event }) => event.id).join(",") })
  return <BehaviorPanel title="Hiệu quả sự kiện" note="Lượt tăng thêm so với cùng thứ và khung giờ ở các tuần đủ điều kiện.">
    <ParkingTable rows={rows} rowKey={({ event }) => event?.id ?? "total"} rowClass={({ event }) => event ? "" : "behavior-row-total"}
      empty="Không có sự kiện phù hợp trong kỳ báo cáo." columns={[
        { label: "Sự kiện", cell: ({ event }) => event ? <div className="behavior-stacked">
          <TextLink onClick={() => open(event.id)}>{event.name}</TextLink><small>{event.id} · {event.type}</small></div> : total },
        { label: "Khu đô thị / Bãi xe", cell: ({ event }) => event ? <div className="behavior-stacked">{estateName(event.estate)}
          <small className="behavior-wrap">{eventScope(event)}</small></div> : "—" },
        { label: "Thời gian", cell: ({ event, partial }) => event ? <div className="behavior-stacked">{eventPeriod(event)}{partial && <small>Một phần ngoài kỳ</small>}</div> : "—" },
        { label: "Lượt sự kiện", numeric: true, cell: ({ event, rows }) => <Count n={rows.length} label={event?.name ?? total} drill={drill} patch={patch(event)} /> },
        ...knownVehicles.map((vehicle): TableColumn<typeof rows[number]> => ({
          label: vehicle, numeric: true, cell: ({ event, rows }) => <Count n={rows.filter((row) => row.vehicle === vehicle).length}
            label={`${event?.name ?? total} · ${vehicle}`} drill={drill} patch={{ ...patch(event), vehicle }} />,
        })),
        { label: "Lượt dự kiến", numeric: true, cell: ({ event, expected }) => event ? expected === null ? <span className="muted">Chưa đủ dữ liệu</span> : decimal(expected) : "—" },
        { label: "Tăng thêm", numeric: true, cell: ({ gain, expected }) => <span className={gain !== null && gain < 0 ? "behavior-negative" : ""}>
          {signed(gain)}{gain !== null && expected ? ` (${signed(proportion(gain, expected))}%)` : ""}</span> },
        { label: "TB / Trung vị (phút)", numeric: true, cell: ({ stats }) => <ThinSample n={stats.n}>{decimal(stats.average, 0)} / {decimal(stats.median, 0)}</ThinSample> },
        { label: "Giờ vào / ra cao điểm", cell: ({ stats }) => <div className="behavior-stacked">{stats.peakIn}<small>{stats.peakOut}</small></div> },
        { label: "Chú thích", cell: ({ event }) => {
          const note = event?.notes[0]
          if (!event) return "—"
          return note?.text ? <div className="behavior-stacked behavior-note-preview">
            <button type="button" className="parking-link" onClick={() => open(event.id)}>{note.text}</button>
            <small>{note.actor} · {noteTime(note.at).slice(0, 10)}</small>
          </div> : "—"
        } },
      ]} />
  </BehaviorPanel>
}

export function EventDetail({ summary, close, manage, drill }: {
  summary: EventSummary; close: () => void; manage?: () => void; drill: Drill
}) {
  const { event, windows, rows } = summary
  const [active, setActive] = useState(0)
  const timeline = eventTimeline(summary)[active]
  const max = Math.max(1, ...(timeline?.hours.flatMap((hour) => [hour.incoming, hour.outgoing]) ?? []))
  return <Overlay title="Chi tiết sự kiện" subtitle={`${event.id} · ${event.name}`} wide onClose={close}
    footer={<><Button onClick={close}>Đóng</Button>{manage && <Button onClick={manage}><ArrowUpRight size={15} />Quản lý sự kiện</Button>}
      <Button variant="primary" disabled={!rows.length} onClick={() => drill(event.name, { bEvent: event.id })}>Xem {fmt(rows.length)} lượt</Button></>}>
    <div className="behavior-detail">
      <dl className="behavior-detail-meta">
        <div><dt>Loại sự kiện</dt><dd>{event.type}</dd></div><div><dt>Khu đô thị</dt><dd>{estateName(event.estate)}</dd></div>
        <div><dt>Phạm vi bãi</dt><dd>{eventScope(event)}</dd></div><div><dt>Thời gian</dt><dd>{eventPeriod(event)}</dd></div>
        <div><dt>Lượt tăng thêm</dt><dd>{signed(summary.gain)}</dd></div>
      </dl>
      {event.description && <p className="behavior-long-text">{event.description}</p>}
      <BehaviorPanel title="Cơ sở tính lượt dự kiến">
        <ParkingTable rows={windows} rowKey={({ start }) => String(start)} columns={[
          { label: "Khung giờ tính", cell: ({ start, end }) => `${displayTime(start)} → ${displayTime(end)}` },
          { label: "Các tuần đối chiếu", cell: ({ weeks }) => weeks.length ? <span className="behavior-wrap">
            {weeks.map(({ day, count }) => `${date(day)} · ${fmt(count)} lượt`).join("  |  ")}</span> : "—" },
          { label: "Lượt dự kiến", numeric: true, cell: ({ expected, weeks }) => expected === null ? "Chưa đủ dữ liệu" : <div className="behavior-stacked">
            {decimal(expected)}<small>Dựa trên {weeks.length} tuần</small></div> },
          { label: "Lượt sự kiện", numeric: true, cell: ({ rows }) => fmt(rows.length) },
        ]} />
      </BehaviorPanel>
      {!!timeline && <BehaviorPanel title="Lượt vào và ra theo giờ"
        actions={windows.length > 1 && <Select aria-label="Khung giờ sự kiện" value={String(active)}
          options={windows.map(({ start }, i) => ({ value: String(i), label: displayTime(start) }))}
          onChange={(e) => setActive(Number(e.target.value))} />}>
        <div className="behavior-event-chart">
          <div className="behavior-chart-columns" style={{ gridTemplateColumns: `repeat(${timeline.hours.length}, minmax(35px, 1fr))` }}>
            {timeline.hours.map(({ minute, incoming, outgoing }) => <div key={minute} title={`${displayTime(minute)} · Vào ${incoming} · Ra ${outgoing}`}>
              <div className="behavior-chart-track"><i style={{ height: `${incoming / max * 100}%` }} />
                <i style={{ height: `${outgoing / max * 100}%` }} /></div>
              <small>{hourLabel(hourOf(minute)).slice(0, 5)}</small>
            </div>)}
          </div>
          <div className="parking-legend behavior-chart-legend"><span><i />Lượt vào</span><span><i />Lượt ra</span></div>
        </div>
      </BehaviorPanel>}
      <EventAnnotation event={event} />
    </div>
  </Overlay>
}

export function EventAnnotation({ event, save }: {
  event: BehaviorEvent; save?: (previous: string | undefined, text: string) => boolean
}) {
  const latest = event.notes[0]
  const [edit, setEdit] = useState(Boolean(save && !latest?.text))
  const [text, setText] = useState(latest?.text ?? "")
  const [version, setVersion] = useState(latest?.at)
  const [showHistory, setShowHistory] = useState(false)
  return <BehaviorPanel title="Chú thích" actions={save && !edit && <Button onClick={() => {
        setVersion(latest?.at); setText(latest?.text ?? ""); setEdit(true)
      }}><Pencil size={14} />{latest?.text ? "Sửa chú thích" : "Thêm chú thích"}</Button>}>
        <div className="behavior-panel-body">
          {save && edit ? <Form onSubmit={(e) => { e.preventDefault(); if (save(version, text.trim())) setEdit(false) }}>
            <Field label="Nội dung chú thích" hint={`Không bắt buộc · ${fmt(text.length)} / 1.000 ký tự`}>
              <Textarea aria-label="Nội dung chú thích" placeholder="Nhập nội dung cần lưu ý về sự kiện…" rows={4}
                maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <div className="behavior-form-actions"><Button onClick={() => setEdit(false)}>Hủy</Button>
              <Button type="submit" variant="primary" disabled={text.trim() === (latest?.text ?? "")}>Lưu chú thích</Button></div>
          </Form> : latest?.text ? <><p className="behavior-long-text">{latest.text}</p><p className="muted">{latest.actor} · {noteTime(latest.at)}</p></>
            : <p className="muted">Chưa có chú thích.</p>}
          {!!event.notes.length && <Button variant="link" aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}>
            <History size={14} /> Lịch sử ({event.notes.length})</Button>}
          {showHistory && <ol className="behavior-history">{event.notes.map((note) =>
            <li key={note.at}><strong>{note.actor} · {noteTime(note.at)}</strong><p className="behavior-long-text">{note.text}</p></li>)}</ol>}
        </div>
  </BehaviorPanel>
}

export function PlateList({ title, items, close, drill, exportFile }: {
  title: string; items: ReturningVehicle[]; close: () => void; drill: Drill; exportFile?: ExportParking
}) {
  const [page, setPage] = useState(1)
  const size = 50
  return <Overlay title="Danh sách biển số" subtitle={`${title} · ${fmt(items.length)} xe`} wide onClose={close}
    footer={<><Button onClick={close}>Đóng</Button>{exportFile && <Button variant="primary" onClick={() => exportFile("DanhSachBienSo", () => ({
      "Biển số": items.map((item) => ({ "Biển số": item.plate, "Loại xe": item.vehicle, "Số lượt trong kỳ": item.rows.length,
        "Lần đến đầu": excelDate(item.first), "Lần đến cuối": excelDate(item.last), "Loại khách quay lại": item.familiar ? "Khách quen" : "Khách mới" })),
    }), items.length)}><Download size={15} />Tải danh sách</Button>}</>}>
    <p className="parking-banner">Lần mở này đã được ghi nhật ký.</p>
    <ParkingTable rows={items.slice((page - 1) * size, page * size)} rowKey={({ plate }) => plate} columns={[
      { label: "Biển số", cell: ({ plate }) => <TextLink onClick={() => drill(plate, { bPlate: plate })}>{plate}</TextLink> },
      { label: "Loại xe", cell: ({ vehicle }) => vehicle },
      { label: "Số lượt trong kỳ", numeric: true, cell: ({ rows }) => fmt(rows.length) },
      { label: "Lần đến đầu", cell: ({ first }) => displayTime(first) },
      { label: "Lần đến cuối", cell: ({ last }) => displayTime(last) },
      { label: "Phân loại", cell: ({ familiar }) => <Badge tone={familiar ? "green" : "gray"}>{familiar ? "Khách quen" : "Khách mới"}</Badge> },
    ]} />
    <div className="behavior-plate-pagination"><ParkingPagination count={items.length} size={size} page={page} change={setPage} />
      <span className="muted">50 dòng/trang</span></div>
  </Overlay>
}

