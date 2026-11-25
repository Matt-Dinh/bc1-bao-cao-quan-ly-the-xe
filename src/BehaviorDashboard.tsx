import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { ArrowUpRight, CalendarDays, CarFront, ChartNoAxesCombined, Clock3, Repeat2, Table2 } from "lucide-react"
import { date, fmt } from "./data"
import { Button, Heading, Select } from "./ui"
import { allOption } from "./parking-ui"
import { arrivalStats, dwellBands, eventTypes, inBand, proportion, repeatBands, returningVehicles, weekday, weekdays } from "./behavior-model"
import type { BehaviorData, EventSummary } from "./behavior-model"
import { behaviorSections } from "./behavior-routes"
import type { BehaviorSection } from "./behavior-routes"
import { Count, decimal, includesEvent, percent } from "./BehaviorTables"
import type { Drill } from "./BehaviorTables"

type OpenSection = (section: BehaviorSection) => void

function ChartCard({ section, title, note, icon, tools, open, children }: {
  section: BehaviorSection; title: string; note?: string; icon: ReactNode; tools?: ReactNode; open: OpenSection; children: ReactNode
}) {
  return <section className="panel parking-chart">
    <header className="parking-chart-header">
      <div><Heading level={2}>{title}</Heading>{note && <p>{note}</p>}</div>
      <div className="behavior-card-tools">
        {tools}
        <span className="report-chart-icon">{icon}</span>
      </div>
    </header>
    <div className="parking-chart-body">{children}</div>
    <Button className="parking-chart-footer" variant="ghost" aria-haspopup="dialog"
      aria-label={`Xem số liệu chi tiết: ${behaviorSections[section]}`} onClick={() => open(section)}>
      <Table2 size={14} /> Xem số liệu chi tiết <ArrowUpRight size={15} />
    </Button>
  </section>
}

const length = (value: number, max: number) => `${value / Math.max(1, max) * 100}%`
const shortDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`

function ArrivalTrend({ visits, scale, drill }: {
  visits: { day: string; kind: string; count: number; event: number }[]; scale: number; drill: Drill
}) {
  const [active, setActive] = useState<string | null>(null)
  const selected = visits.find(({ day }) => day === active)
  const width = 640, height = 168, left = 45, right = 14, top = 10, bottom = 144
  const x = (index: number) => visits.length === 1 ? (left + width - right) / 2 :
    left + index / (visits.length - 1) * (width - left - right)
  const step = visits.length === 1 ? 16 : (width - left - right) / (visits.length - 1)
  const y = (count: number) => bottom - count / scale * (bottom - top)
  const points = visits.map((row, i) => `${x(i)},${y(row.count)}`).join(" ")
  const index = visits.findIndex(({ day }) => day === active)
  const hasWeekend = visits.some(({ kind }) => kind === "Cuối tuần")
  const hasHoliday = visits.some(({ kind }) => kind === "Ngày lễ")
  return <div className="behavior-trend">
    <div className="behavior-trend-readout" aria-live="polite">
      {selected ? <>
        <strong>{date(selected.day)}</strong>
        <span>{weekdays[weekday(selected.day)]} · {selected.kind}</span>
        <span>{fmt(selected.count)} lượt đến</span>
        {selected.event > 0 && <span className="behavior-trend-event">{fmt(selected.event)} lượt thuộc sự kiện</span>}
      </> : <span>Rê chuột hoặc chọn điểm để xem lượt đến theo ngày</span>}
    </div>
    <svg viewBox={`0 0 ${width} ${height}`} className="behavior-trend-svg" role="group" aria-label="Xu hướng lượt đến theo ngày">
      {visits.map(({ day, kind }, i) => kind === "Ngày thường" ? null : (
        <rect
          key={`band-${day}`}
          x={Math.max(left, x(i) - step / 2)}
          y={top}
          width={Math.min(step, width - right - Math.max(left, x(i) - step / 2))}
          height={bottom - top}
          fill={kind === "Ngày lễ" ? "#ffebd2" : "#e8edf4"}
          fillOpacity={kind === "Ngày lễ" ? ".65" : ".55"}
          aria-hidden="true"
        />
      ))}
      {[0, 1, 2, 3, 4].map((tick) => <g key={tick} aria-hidden="true">
        <line x1={left} x2={width - right} y1={y(tick * scale / 4)} y2={y(tick * scale / 4)} className="behavior-grid-line" />
        <text x={left - 8} y={y(tick * scale / 4) + 3} textAnchor="end">{fmt(tick * scale / 4)}</text>
      </g>)}
      {visits.length > 1 && <polygon points={`${left},${bottom} ${points} ${width - right},${bottom}`} fill="#3f76bc" fillOpacity=".08" />}
      <polyline points={points} fill="none" stroke="#3f76bc" strokeWidth="2.5" strokeLinejoin="round" />
      {index >= 0 && <line x1={x(index)} x2={x(index)} y1={top} y2={bottom} className="behavior-trend-crosshair" />}
      {visits.map(({ day, kind, count, event }, i) => {
        const label = `${date(day)} (${kind}) · ${fmt(count)} lượt · ${fmt(event)} thuộc sự kiện`
        const action = () => { if (count) drill(`Lượt đến ngày ${date(day)}`, { start: day, end: day }) }
        return <g key={day}>
          <circle cx={x(i)} cy={y(count)} r={day === active ? 5 : event ? 4 : 2.5}
            fill={event ? "#3c9198" : "white"} stroke={event ? "#3c9198" : "#3f76bc"} strokeWidth="1.8" pointerEvents="none" />
          {(i % Math.max(1, Math.ceil(visits.length / 8)) === 0 || i === visits.length - 1) &&
            <text x={x(i)} y={height - 5} textAnchor="middle" aria-hidden="true">{shortDate(day)}</text>}
          <rect x={x(i) - (i ? (x(i) - x(i - 1)) / 2 : 8)} y={top} height={bottom - top + 8}
            width={step}
            fill="transparent" role="button" tabIndex={0} aria-disabled={!count} aria-label={label}
            className="behavior-trend-hit" onMouseEnter={() => setActive(day)} onFocus={() => setActive(day)}
            onClick={action} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); action() } }}>
            <title>{label}</title>
          </rect>
        </g>
      })}
    </svg>
    <div className="parking-legend behavior-dashboard-legend">
      <span><i className="behavior-line-key" />Lượt đến</span>
      <span><i className="behavior-event-key" />Ngày có sự kiện</span>
      {hasWeekend && <span><i style={{ background: "#dce4ef" }} />Cuối tuần</span>}
      {hasHoliday && <span><i style={{ background: "#ffebd2" }} />Ngày lễ</span>}
    </div>
  </div>
}

const frequencyColors = ["#dce4ef", "#3f76bc", "#76acb5", "#a693c5"]
function ReturningDonut({ frequencies, total, repeat, open }: {
  frequencies: { label: string; count: number }[]; total: number; repeat: number; open: OpenSection
}) {
  const circumference = 2 * Math.PI * 58
  let offset = 0
  return <div className="behavior-returning-layout">
    <div className="behavior-returning-ring">
      <svg viewBox="0 0 160 160" role="group" aria-label={`Cơ cấu ${fmt(total)} xe theo số lần đến`}>
        <circle cx="80" cy="80" r="58" fill="none" stroke="#eff1f5" strokeWidth="19" />
        {frequencies.map(({ label, count }, i) => {
          const arc = count / total * circumference
          const start = offset
          offset += arc
          return count > 0 ? <circle key={label} cx="80" cy="80" r="58" fill="none" stroke={frequencyColors[i]} strokeWidth="19"
            strokeDasharray={`${arc} ${circumference - arc}`} strokeDashoffset={-start} transform="rotate(-90 80 80)"
            role="button" tabIndex={0} aria-label={`${label} · ${fmt(count)} xe · ${percent(proportion(count, total))}`}
            onClick={() => open("returning")} onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open("returning") }
            }}><title>{label} · {fmt(count)} xe</title></circle> : null
        })}
        <text x="80" y="77" textAnchor="middle" className="behavior-ring-value">{percent(proportion(repeat, total))}</text>
        <text x="80" y="96" textAnchor="middle" className="behavior-ring-label">xe quay lại</text>
      </svg>
    </div>
    <div className="behavior-frequency-legend">
      {frequencies.map(({ label, count }, i) => <button type="button" key={label} disabled={!count}
        onClick={() => open("returning")} aria-label={`${label} · ${fmt(count)} xe`}>
        <i style={{ background: frequencyColors[i] }} /><span>{label}</span>
        <strong>{fmt(count)}</strong><small>{percent(proportion(count, total))}</small>
      </button>)}
      <p>Tỷ lệ quay lại tính trên xe có biển số hợp lệ đến từ 2 lượt trong kỳ (không gồm xe đạp).</p>
    </div>
  </div>
}

export default function BehaviorDashboard({
  data,
  events,
  allEventCount,
  eventType,
  onEventType,
  onlyBicycle,
  drill,
  open,
}: {
  data: BehaviorData
  events: EventSummary[]
  allEventCount: number
  eventType: string
  onEventType: (value: string) => void
  onlyBicycle: boolean
  drill: Drill
  open: OpenSection
}) {
  const stats = useMemo(() => arrivalStats(data.arrivals), [data.arrivals])
  const vehicles = useMemo(() => returningVehicles(data), [data])
  const repeat = vehicles.filter(({ rows }) => rows.length >= 2).length
  const eventArrivals = data.arrivals.filter(includesEvent).length
  const visits = data.days.map(({ day, kind, rows }) => ({ day, kind, count: rows.length, event: rows.filter(includesEvent).length }))
  const maxDay = Math.max(1, ...visits.map(({ count }) => count))
  const tickUnit = maxDay >= 400 ? 100 : maxDay >= 40 ? 10 : 1
  const dayScale = Math.ceil(maxDay / (tickUnit * 4)) * tickUnit * 4
  const dwell = dwellBands.fine.map((band) => ({ band, count: data.arrivals.filter(({ dwell }) => inBand(dwell, band)).length }))
  const maxDwell = Math.max(1, ...dwell.map(({ count }) => count))
  const frequencies = repeatBands.map(([min, max, label]) => ({
    label, count: vehicles.filter(({ rows }) => rows.length >= min && rows.length < max).length,
  }))
  const topEvents = [...events].sort((a, b) => b.rows.length - a.rows.length).slice(0, 4)
  const maxEvent = Math.max(1, ...topEvents.flatMap(({ rows, expected }) => [rows.length, expected ?? 0]))
  const kpis = [
    { label: "Lượt đến", icon: <CarFront size={16} />, value: fmt(stats.count), note: `${fmt(stats.exited)} lượt đã ra`,
      action: () => drill("Lượt đến"), disabled: !stats.count },
    { label: "Lưu trú trung bình", icon: <Clock3 size={16} />, value: stats.average === null ? "—" : `${fmt(stats.average)} phút`,
      note: `Trên ${fmt(stats.n)} lượt có lưu trú`, action: () => open("arrivals"), disabled: false },
    { label: "Lượt thuộc sự kiện", icon: <CalendarDays size={16} />, value: fmt(eventArrivals),
      note: `${percent(proportion(eventArrivals, stats.count))} tổng lượt đến`, action: () => open("events"), disabled: false },
    { label: "Tỷ lệ xe quay lại", icon: <Repeat2 size={16} />,
      value: onlyBicycle ? "—" : percent(proportion(repeat, vehicles.length)),
      note: onlyBicycle ? "Không áp dụng cho Xe đạp" : `${fmt(repeat)} xe đến từ 2 lần`,
      action: () => open("returning"), disabled: false },
  ]

  return <>
    <div className="parking-kpis behavior-kpis">
      {kpis.map(({ label, icon, value, note, action, disabled }) => <button className="panel summary-card parking-kpi-link" key={label}
        type="button" disabled={disabled} onClick={action}>
        <span className="summary-top"><span>{label}</span><span className="summary-icon">{icon}</span></span>
        <span className="summary-value">{value}</span>
        <span className="summary-sub">{note}</span>
      </button>)}
    </div>
    <div className="parking-chart-layout behavior-dashboard">
      <ChartCard section="time" title="Lượt đến theo ngày" icon={<ChartNoAxesCombined size={16} />}
        note={stats.count ? `Giờ vào cao điểm ${stats.peakIn}` : undefined} open={open}>
        {stats.count ? <ArrivalTrend visits={visits} scale={dayScale} drill={drill} />
          : <p className="parking-empty">Không có lượt đến trong kỳ.</p>}
      </ChartCard>
      <ChartCard section="arrivals" title="Phân bố thời gian lưu trú" icon={<Clock3 size={16} />}
        note={stats.median === null ? undefined : `Trung vị ${fmt(stats.median)} phút · ${fmt(stats.n)} lượt hợp lệ`} open={open}>
        {stats.n ? <div className="behavior-bars">
          {dwell.map(({ band, count }, bandIndex) => {
            const isPeak = count > 0 && count === maxDwell
            return <div className={`behavior-bar-row${isPeak ? " peak" : ""}`} key={band[0]}>
              <span>{band[2]}</span>
              <span className="behavior-bar-track" aria-hidden="true">
                <i className="behavior-series-base" style={{ width: length(count, maxDwell) }} />
              </span>
              <span className="behavior-bar-value">
                <Count n={count} label={band[2]} drill={drill}
                  patch={{ bDuration: String(bandIndex) }} />
                <small>{percent(proportion(count, stats.n))}</small>
              </span>
            </div>
          })}
        </div> : <p className="parking-empty">Không có lượt lưu trú hợp lệ.</p>}
      </ChartCard>
      <ChartCard section="events" title="Hiệu quả sự kiện" icon={<CalendarDays size={16} />}
        note={events.length > topEvents.length ? `${topEvents.length}/${events.length} sự kiện nhiều lượt nhất` : undefined}
        tools={allEventCount > 0 ? (
          <Select
            aria-label="Lọc loại sự kiện"
            value={eventType}
            options={[allOption("Tất cả loại sự kiện"), ...eventTypes]}
            onChange={(e) => onEventType(e.target.value)}
          />
        ) : undefined}
        open={open}>
        {events.length ? <>
          <div className="behavior-bars">
            {topEvents.map(({ event, rows, expected, gain }) => {
              const liftPct = expected && gain !== null ? proportion(gain, expected) : null
              const toneClass = gain === null ? "" : gain > 0 ? "behavior-positive" : gain < 0 ? "behavior-negative" : ""
              return <div className="behavior-bullet-row" key={event.id}>
                <span title={`${event.name} (${event.type})`}>{event.name}</span>
                <div className="behavior-bullet-track" title={`Thực tế ${fmt(rows.length)} · Dự kiến ${decimal(expected)}`} aria-hidden="true">
                  <i className={gain !== null && gain < 0 ? "behavior-bar-negative" : undefined} style={{ width: length(rows.length, maxEvent) }} />
                  {expected !== null && <b style={{ left: length(expected, maxEvent) }} />}
                </div>
                <span className="behavior-stacked">
                  <Count n={rows.length} label={event.name} drill={drill} patch={{ bEvent: event.id }} />
                  <small className={toneClass}>
                    {gain === null
                      ? "Chưa đủ dữ liệu"
                      : `${gain > 0 ? "+" : ""}${decimal(gain, 0)} lượt${liftPct !== null ? ` (${gain > 0 ? "+" : ""}${decimal(liftPct)}%)` : ""}`}
                  </small>
                </span>
              </div>
            })}
          </div>
          <div className="parking-legend behavior-dashboard-legend">
            <span><i className="behavior-series-base" />Lượt thực tế</span>
            <span><i className="behavior-target-key" />Mốc dự kiến (TB 2–4 tuần trước)</span>
          </div>
        </> : <p className="parking-empty">{eventType ? `Không có sự kiện loại "${eventType}" trong kỳ.` : "Không có sự kiện trong kỳ."}</p>}
      </ChartCard>
      <ChartCard section="returning" title="Tần suất khách quay lại" icon={<Repeat2 size={16} />}
        note={onlyBicycle ? "Không áp dụng cho Xe đạp" : vehicles.length ? `${fmt(vehicles.length)} xe có biển số hợp lệ` : undefined} open={open}>
        {onlyBicycle ? <p className="parking-empty">Không áp dụng cho Xe đạp — chỉ thống kê trên phương tiện có biển số hợp lệ.</p>
          : vehicles.length ? <ReturningDonut frequencies={frequencies} total={vehicles.length} repeat={repeat} open={open} />
          : <p className="parking-empty">Không có dữ liệu biển số trong kỳ.</p>}
      </ChartCard>
    </div>
  </>
}
