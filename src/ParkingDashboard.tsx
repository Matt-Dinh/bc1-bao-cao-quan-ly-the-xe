import { Component, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Clock3,
  Gauge,
  Layers3,
  LoaderCircle,
  Table2,
  TriangleAlert,
  TrendingUp,
} from "lucide-react"
import { Button, Field, Heading, Input, Overlay, Select } from "./ui"
import { date, fmt } from "./data"
import {
  aggregateDays,
  canDeclare,
  dayAt,
  dayMinutes,
  dayStart,
  displayTime,
  durationStats,
  goLive,
  parkingGroups,
  peakOf,
  ratio,
  shiftIntervals,
  siteById,
} from "./parking-model"
import type {
  Interval,
  ParkingAccess,
  ParkingFilters,
  ParkingReportData,
  ParkingSettings,
  SiteDay,
  TripDrill,
} from "./parking-model"
import {
  allOption,
  ExportButton,
  NoMatches,
  numberText,
  pageNumber,
  ParkingPagination,
  ParkingTable,
  pct,
  periodText,
  Segments,
  TextLink,
  undeclared,
} from "./parking-ui"
import type {
  ExportParking,
  ExportRow,
  TableColumn,
  UpdateParams,
} from "./parking-ui"
import {
  dayTypeExport,
  durationExport,
  flowExport,
  utilizationExport,
} from "./parking-export"
import { canExport } from "./parking-model"

type Popup = {
  kind: "use" | "day-type" | "daily" | "site-day" | "hours" | "duration"
  ids?: string[]
  day?: string
  dayType?: string
  interval?: string
}
type Breakdown = {
  label: string
  key: string
  rows: SiteDay[]
  ids: string[]
  level: number
  expandable?: boolean
}
type ChartPoint = {
  id: string
  label: string
  detail?: string
  incoming?: number
  outgoing?: number
  line?: number
  limit?: number | null
  tint?: string
  warning?: boolean
  sub?: string
  value?: string
  color?: string
  action?: () => void
}

function Chart({
  title,
  description,
  icon,
  actions,
  details,
  className = "",
  children,
  note,
}: {
  title: string
  description: string
  icon: ReactNode
  actions?: ReactNode
  details: () => void
  className?: string
  children: ReactNode
  note: string
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <section className={`panel parking-chart ${className}`}>
      <header className="parking-chart-header">
        <div>
          <Heading>{title}</Heading>
          <p>{description}</p>
        </div>
        <div className="parking-inline">
          {actions}
          <span className="report-chart-icon">{icon}</span>
        </div>
      </header>
      <div className="parking-chart-body">
        <ChartBoundary key={description}>
          {ready ? (
            children
          ) : (
            <div className="parking-empty" role="status">
              <LoaderCircle className="animate-spin" size={17} />
              Đang tải biểu đồ…
            </div>
          )}
        </ChartBoundary>
      </div>
      <p className="parking-chart-note">{note}</p>
      <Button
        className="parking-chart-footer"
        variant="ghost"
        onClick={details}
        disabled={!ready}
      >
        <Table2 size={15} /> Xem số liệu chi tiết <ArrowUpRight size={15} />
      </Button>
    </section>
  )
}
class ChartBoundary extends Component<{ children: ReactNode }, {
  error: boolean
}> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? (
      <div className="parking-empty" role="alert">
        <TriangleAlert size={17} />
        Không tải được biểu đồ
        <Button onClick={() => this.setState({ error: false })}>Thử lại</Button>
      </div>
    ) : (
      this.props.children
    )
  }
}
const chartColors = ["#587fc9", "#df9d48", "#358e7e", "#8779bd", "#d3647e"]
function Legend({ entries }: { entries: [string, string][] }) {
  return (
    <div className="parking-legend">
      {entries.map(([label, color]) => (
        <span key={label}>
          <i style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  )
}
function Plot({
  points,
  format = fmt,
  minWidth,
  lineOnly = false,
  percentScale = false,
}: {
  points: ChartPoint[]
  format?: (value: number) => string
  minWidth?: number
  lineOnly?: boolean
  percentScale?: boolean
}) {
  const max = Math.max(
    percentScale ? 100 : 1,
    ...points.flatMap((point) => [
      point.incoming ?? 0,
      point.outgoing ?? 0,
      point.line ?? 0,
      point.limit ?? 0,
    ]),
  )
  const step = percentScale
    ? 25
    : Math.max(1, 10 ** Math.floor(Math.log10(max / 4)))
  const scale = Math.ceil(max / (step * 4)) * step * 4
  const viewHeight = 150
  const line = (key: "line" | "limit", color: string, dashed: boolean) =>
    points.slice(1).map((point, index) => {
      const before = points[index][key],
        after = point[key]
      if (before == null || after == null) return null
      const x1 = ((index + 0.5) / points.length) * 100
      const x2 = ((index + 1.5) / points.length) * 100
      return (
        <line
          key={point.id}
          x1={x1}
          x2={x2}
          y1={viewHeight * (1 - before / scale)}
          y2={viewHeight * (1 - after / scale)}
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeDasharray={dashed ? "5 4" : undefined}
        />
      )
    })
  if (!points.length)
    return <div className="parking-empty">Chưa có dữ liệu</div>
  return (
    <div className="parking-plot-scroll">
      <div className="parking-plot" style={{ minWidth }}>
        <div className="parking-axis" aria-hidden="true">
          {[1, 0.75, 0.5, 0.25, 0].map((mark) => (
            <span key={mark}>{format(scale * mark)}</span>
          ))}
        </div>
        <div className="parking-plot-content">
          <div className="parking-plot-grid" aria-hidden="true" />
          {points.some(
            (point) => point.line !== undefined || point.limit != null,
          ) && (
            <svg
              aria-hidden="true"
              className="parking-lines"
              viewBox={`0 0 100 ${viewHeight}`}
              preserveAspectRatio="none"
            >
              {line("limit", "#d94a55", true)}
              {line("line", "#df9d48", false)}
              {points.map((point, index) =>
                point.line === undefined ? null : (
                  <line
                    key={point.id}
                    x1={((index + 0.5) / points.length) * 100}
                    x2={((index + 0.5) / points.length) * 100 + 0.01}
                    y1={viewHeight * (1 - point.line / scale)}
                    y2={viewHeight * (1 - point.line / scale)}
                    stroke={point.warning ? "#d94a55" : "#df9d48"}
                    strokeWidth="5"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ),
              )}
            </svg>
          )}
          <div
            className="parking-columns"
            style={{
              gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
            }}
          >
            {points.map((point) => {
              const title = [
                point.detail ?? point.label,
                point.value ??
                  (point.incoming === undefined
                    ? ""
                    : `Vào ${fmt(point.incoming)}`),
                point.outgoing === undefined ? "" : `Ra ${fmt(point.outgoing)}`,
                point.line === undefined ? "" : `Tồn ${fmt(point.line)}`,
                point.warning ? "Vượt sức chứa" : "",
              ]
                .filter(Boolean)
                .join(" · ")
              const content = (
                <>
                  <span className={`parking-column-track ${point.tint ?? ""}`}>
                    {!lineOnly && point.incoming !== undefined && (
                      <i
                        style={{
                          height: `${(point.incoming / scale) * 100}%`,
                          background: point.color ?? chartColors[0],
                        }}
                      >
                        {point.value && <b>{point.value}</b>}
                      </i>
                    )}
                    {!lineOnly && point.outgoing !== undefined && (
                      <i
                        style={{
                          height: `${(point.outgoing / scale) * 100}%`,
                          background: chartColors[2],
                        }}
                      />
                    )}
                  </span>
                  <span className="parking-column-label">
                    {point.label}
                    {point.warning && <strong className="text-red"> ▲</strong>}
                  </span>
                  {point.sub && <small>{point.sub}</small>}
                </>
              )
              return point.action ? (
                <button
                  type="button"
                  key={point.id}
                  title={title}
                  aria-label={title}
                  onClick={point.action}
                >
                  {content}
                </button>
              ) : (
                <div key={point.id} title={title}>
                  {content}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  data: ParkingReportData
  settings: ParkingSettings
  filters: ParkingFilters
  cutoff: string
  access: ParkingAccess
  params: URLSearchParams
  update: UpdateParams
  exportFile: ExportParking
  drill: (drill: TripDrill) => void
  showAlerts: () => void
  showCapacity: () => void
  resetFilters: () => void
}
export default function ParkingDashboard({
  data,
  settings,
  filters,
  cutoff,
  access,
  params,
  update,
  exportFile,
  drill,
  showAlerts,
  showCapacity,
  resetFilters,
}: Props) {
  const [popup, setPopup] = useState<Popup | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])
  const [popupPage, setPopupPage] = useState(1)
  const [popupSize, setPopupSize] = useState(20)
  const [showRatios, setShowRatios] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const security = access.role === "security"
  const detailDayParam = params.get("flowDay")
  const detailDay =
    detailDayParam && data.days.includes(detailDayParam)
      ? detailDayParam
      : filters.end
  const detailSite =
    data.bySite.find((site) => site.id === params.get("flowSite")) ??
    peakOf(
      data.bySite,
      (site) => site.daily.find((day) => day.day === detailDay)?.exceeded ?? 0,
    )
  const detailSiteDay = detailSite?.daily.find((day) => day.day === detailDay)
  const byShift = params.get("flow") === "Ca"
  const guest = parkingGroups.find((item) => item === params.get("guest")) ?? ""
  const utilizationMode =
    params.get("unit") || (data.bySite.length > 12 ? "Khu đô thị" : "Bãi")
  const allDuration = useMemo(
    () => durationStats(data.periodTrips, settings, filters, data.days),
    [data, settings, filters],
  )
  const duration = useMemo(
    () =>
      guest
        ? durationStats(data.periodTrips, settings, filters, data.days, guest)
        : allDuration,
    [data, settings, filters, guest, allDuration],
  )
  const flow =
    detailSite && byShift
      ? shiftIntervals(
          detailSite.trips,
          settings,
          detailSite.id,
          filters.vehicle,
          detailDay,
          cutoff,
        )
      : (detailSiteDay?.hours ?? [])
  const total = data.total
  const exceededDays = new Set(total.exceeded.map((row) => row.day)).size
  const start = dayStart(data.days[0] ?? filters.start),
    end = dayStart(filters.end) + dayMinutes
  const period = periodText(filters)
  const scope =
    siteById(filters.site)?.label ??
    data.byEstate.find((estate) => estate.id === filters.estate)?.name ??
    "Tất cả bãi theo bộ lọc"
  const open = (value: Popup) => {
    setPopup(value)
    setExpanded(
      value.ids
        ? data.byEstate
            .filter((estate) =>
              estate.children.some((site) => value.ids?.includes(site.id)),
            )
            .map((estate) => estate.id)
        : [],
    )
    setPopupPage(1)
    setShowRatios(false)
  }
  const focusFlow = (site: string, day: string) => {
    setPopup(null)
    update({ flowDay: day, flowSite: site, flow: "Giờ", focus: "flow" })
  }
  useEffect(() => {
    if (params.get("focus") === "flow")
      chartRef.current?.scrollIntoView({ block: "start" })
  }, [params.get("focus"), detailDay, detailSite?.id])
  const navigateDrill = (value: TripDrill) => {
    setPopup(null)
    drill(value)
  }
  const countLink = (
    count: number,
    metric: TripDrill["metric"],
    label: string,
    options: Partial<TripDrill> = {},
    value?: string,
  ) =>
    count > 0 && !security ? (
      <TextLink
        onClick={() => navigateDrill({ metric, label, start, end, ...options })}
      >
        {value ?? fmt(count)}
      </TextLink>
    ) : (
      (value ?? fmt(count))
    )
  const windowOptions = (row: Interval, ids: string[]): Partial<TripDrill> => ({
    start: row.start,
    end: row.end,
    sites: ids,
  })
  const counts = <T extends {
    opening: number
    incoming: number
    outgoing: number
    closing: number
  },>(
    options: (row: T) => Partial<TripDrill>,
  ): TableColumn<T>[] =>
    ([
      ["Tồn đầu", "opening"],
      ["Xe vào", "incoming"],
      ["Xe ra", "outgoing"],
      ["Tồn cuối", "closing"],
    ] as const).map(([label, key]) => ({
      label,
      numeric: true,
      cell: (row) =>
        "incomplete" in row && row.incomplete
          ? "—"
          : countLink(row[key], key, label, options(row)),
    }))
  const breakdown = (ids?: string[]): Breakdown[] => {
    const estates = data.byEstate.flatMap((estate) => {
      const sites = estate.children.filter(
        (site) => !ids || ids.includes(site.id),
      )
      if (!sites.length) return []
      return [{ estate, sites }]
    })
    return [
      {
        label: "Tổng cộng",
        key: "total",
        rows: estates.flatMap(({ sites }) =>
          sites.flatMap((site) => site.daily),
        ),
        ids: estates.flatMap(({ sites }) => sites.map((site) => site.id)),
        level: 0,
      },
      ...estates.flatMap(({ estate, sites }) => [
        {
          label: estate.name,
          key: estate.id,
          rows: sites.flatMap((site) => site.daily),
          ids: sites.map((site) => site.id),
          level: 0,
          expandable: true,
        },
        ...sites.map((site) => ({
          label: site.name,
          key: site.id,
          rows: site.daily,
          ids: [site.id],
          level: 1,
        })),
      ]),
    ]
  }
  const unitLabel = (unit: Breakdown) =>
    unit.expandable ? (
      <TextLink
        onClick={() =>
          setExpanded((old) =>
            old.includes(unit.key)
              ? old.filter((key) => key !== unit.key)
              : [...old, unit.key],
          )
        }
      >
        {expanded.includes(unit.key) ? "▾" : "▸"} {unit.label}{" "}
        <span className="muted">· {unit.ids.length} bãi</span>
      </TextLink>
    ) : (
      <span className={unit.level ? "parking-indent" : "font-semibold"}>
        {unit.label}
      </span>
    )
  const visibleBreakdown = <T extends Breakdown>(rows: T[]) =>
    rows.filter(
      (row) => !row.level || expanded.includes(siteById(row.key)?.estate ?? ""),
    )
  const popupTitles = {
    use: "Khai thác bãi xe",
    "day-type": "Lấp đầy theo loại ngày",
    daily: "Lưu lượng theo ngày",
    "site-day": `Lưu lượng ngày ${date(popup?.day ?? "")} theo bãi`,
    hours: "Lưu lượng trong ngày",
    duration: "Thời gian đỗ",
  }
  let popupTable: ReactNode
  let popupExport: () => ExportRow[] = () => []
  if (popup?.kind === "use") {
    const rows = breakdown(popup.ids).map((unit) => ({
      ...unit,
      total: aggregateDays(unit.rows),
    }))
    popupExport = () =>
      rows.map((row) =>
        utilizationExport(row.label, row.total, filters.vehicle),
      )
    const countOptions = (row: typeof rows[number]) => ({ sites: row.ids })
    popupTable = (
      <ParkingTable
        rows={visibleBreakdown(rows)}
        rowKey={(row) => row.key}
        rowClass={(row) =>
          row.total.opening + row.total.incoming - row.total.outgoing !==
          row.total.closing
            ? "mismatch-row"
            : row.key === "total"
              ? "parking-total"
              : ""
        }
        columns={[
          { label: "Đơn vị", cell: unitLabel },
          {
            label: "Quy hoạch",
            numeric: true,
            cell: (row) =>
              row.total.design === null ? undeclared : fmt(row.total.design),
          },
          {
            label: "Thực tế",
            numeric: true,
            cell: (row) => numberText(row.total.actual),
          },
          ...(filters.vehicle === "Ô tô"
            ? [
                {
                  label: "Chỗ sạc",
                  numeric: true,
                  cell: (row: typeof rows[number]) =>
                    numberText(row.total.charging),
                },
              ]
            : []),
          ...([
            ["Tồn đầu", "opening"],
            ["Xe vào", "incoming"],
            ["Xe ra", "outgoing"],
            ["Tồn cuối", "closing"],
          ] as const).map(
            ([label, metric]): TableColumn<typeof rows[number]> => ({
              label,
              numeric: true,
              cell: (row) =>
                countLink(row.total[metric], metric, label, countOptions(row)),
            }),
          ),
          {
            label: "Tồn cao nhất",
            numeric: true,
            cell: (row) => {
              const value = `${
                row.total.exceeded.length ? "▲ " : ""
              }${fmt(row.total.peak)}`
              const at = row.total.peakAt
              if (row.ids.length === 1 && at)
                return (
                  <TextLink
                    onClick={() => focusFlow(row.ids[0], dayAt(at - 1))}
                  >
                    {value}
                  </TextLink>
                )
              return at
                ? countLink(
                    row.total.peak,
                    "closing",
                    "Tồn cao nhất",
                    { sites: row.ids, end: at },
                    value,
                  )
                : value
            },
          },
          {
            label: "Giờ đỗ tối đa",
            numeric: true,
            cell: (row) =>
              row.total.maxHours === null
                ? undeclared
                : fmt(row.total.maxHours),
          },
          {
            label: "Giờ đỗ thực tế",
            numeric: true,
            cell: (row) =>
              row.total.parkedHours === null
                ? "—"
                : countLink(
                    row.total.parkedHours,
                    "parked",
                    "Lượt tính giờ đỗ thực tế",
                    countOptions(row),
                    numberText(row.total.parkedHours, 1),
                  ),
          },
          {
            label: "Lấp đầy",
            numeric: true,
            cell: (row) => pct(row.total.occupancy),
          },
          {
            label: "Giờ đỗ kế hoạch",
            numeric: true,
            cell: (row) =>
              row.total.plannedHours === null
                ? undeclared
                : numberText(row.total.plannedHours, 1),
          },
          {
            label: "Đạt kế hoạch",
            numeric: true,
            cell: (row) => pct(row.total.attainment),
          },
        ]}
      />
    )
  }
  if (popup?.kind === "day-type") {
    const rows = data.dayGroups.filter(
      (row) =>
        !popup.dayType || row.label === popup.dayType || row.label === "Cả kỳ",
    )
    popupExport = () => rows.map(dayTypeExport)
    popupTable = (
      <ParkingTable
        rows={rows}
        rowKey={(row) => row.label}
        columns={[
          { label: "Loại ngày", cell: (row) => row.label },
          {
            label: "Số ngày",
            numeric: true,
            cell: (row) => fmt(row.days.length),
          },
          {
            label: "Xe vào TB / ngày",
            numeric: true,
            cell: (row) =>
              countLink(
                row.incoming,
                "incoming",
                row.label,
                { days: row.days },
                numberText(row.incoming / row.days.length, 1),
              ),
          },
          {
            label: "Giờ đỗ thực tế TB / ngày",
            numeric: true,
            cell: (row) =>
              row.parkedHours === null
                ? undeclared
                : countLink(
                    row.parkedHours,
                    "parked",
                    row.label,
                    { days: row.days },
                    numberText(row.parkedHours / row.days.length, 1),
                  ),
          },
          {
            label: "Lấp đầy",
            numeric: true,
            cell: (row) => pct(row.occupancy),
          },
        ]}
      />
    )
  }
  if (popup?.kind === "daily" || popup?.kind === "site-day") {
    const day = popup.day ?? detailDay
    const rows =
      popup.kind === "daily"
        ? data.daily.map((row) => ({
            ...row,
            id: row.day,
            label: date(row.day),
            ids: data.bySite.map((site) => site.id),
            peakIn: "",
            peakOut: "",
          }))
        : [
            {
              ...aggregateDays(
                data.bySite.flatMap((site) =>
                  site.daily.filter((row) => row.day === day),
                ),
              ),
              id: "total",
              label: "Tổng cộng",
              day,
              type: "",
              ids: data.bySite.map((site) => site.id),
              peakIn: "",
              peakOut: "",
            },
            ...data.byEstate.map((estate) => ({
              ...aggregateDays(
                estate.children.flatMap((site) =>
                  site.daily.filter((row) => row.day === day),
                ),
              ),
              id: estate.id,
              label: estate.name,
              day,
              type: "",
              ids: estate.children.map((site) => site.id),
              peakIn: "",
              peakOut: "",
            })),
            ...data.bySite.flatMap((site) =>
              site.daily
                .filter((row) => row.day === day)
                .map((row) => ({
                  ...aggregateDays([row]),
                  id: site.id,
                  label: site.label,
                  day,
                  type: "",
                  ids: [site.id],
                  peakIn: row.peakIn.label,
                  peakOut: row.peakOut.label,
                })),
            ),
          ]
    popupExport = () =>
      rows.map((row) => ({
        Ngày: new Date(dayStart(row.day) * 60000),
        "Đơn vị": row.label,
        "Loại ngày": row.type,
        "Tồn đầu": row.opening,
        "Xe vào": row.incoming,
        "Xe ra": row.outgoing,
        "Tồn cuối": row.closing,
        "Quy hoạch": row.design,
        "Tồn cao nhất": row.peak,
        "So với quy hoạch (%)": row.design
          ? (row.peak / row.design) * 100
          : null,
        "Giờ tồn cao nhất": row.peakAt ? new Date(row.peakAt * 60000) : null,
        "Số bãi vượt": row.exceeded.length,
        "Số khung vượt": row.exceeded.reduce(
          (total, site) => total + site.exceeded,
          0,
        ),
        "Cao điểm vào": row.peakIn,
        "Cao điểm ra": row.peakOut,
      }))
    const page = pageNumber(String(popupPage), rows.length, popupSize)
    popupTable = (
      <>
        <ParkingTable
          rows={rows.slice((page - 1) * popupSize, page * popupSize)}
          rowKey={(row) => row.id}
          rowClass={(row) => (row.exceeded.length ? "mismatch-row" : "")}
          columns={[
            {
              label: popup.kind === "daily" ? "Ngày" : "Đơn vị",
              cell: (row) =>
                popup.kind === "daily" ? (
                  <TextLink
                    onClick={() => open({ kind: "site-day", day: row.day })}
                  >
                    {row.label}
                  </TextLink>
                ) : row.id.includes(":") ? (
                  <TextLink onClick={() => focusFlow(row.id, day)}>
                    {row.label}
                  </TextLink>
                ) : (
                  row.label
                ),
            },
            ...(popup.kind === "daily"
              ? [
                  {
                    label: "Loại ngày",
                    cell: (row: typeof rows[number]) => row.type,
                  },
                ]
              : []),
            ...counts<typeof rows[number]>((row) => ({
              sites: row.ids,
              start: dayStart(row.day),
              end: dayStart(row.day) + dayMinutes,
            })),
            {
              label: "Chỗ quy hoạch",
              numeric: true,
              cell: (row) => numberText(row.design),
            },
            {
              label: "Tồn cao nhất",
              numeric: true,
              cell: (row) =>
                row.peakAt
                  ? countLink(row.peak, "closing", "Tồn cao nhất", {
                      sites: row.ids,
                      end: row.peakAt,
                    })
                  : "—",
            },
            ...(popup.kind === "daily"
              ? [
                  {
                    label: "So với quy hoạch",
                    numeric: true,
                    cell: (row: typeof rows[number]) =>
                      pct(ratio(row.peak, row.design)),
                  },
                ]
              : []),
            ...(popup.kind === "site-day"
              ? [
                  {
                    label: "Cao điểm vào",
                    cell: (row: typeof rows[number]) => row.peakIn || "—",
                  },
                  {
                    label: "Cao điểm ra",
                    cell: (row: typeof rows[number]) => row.peakOut || "—",
                  },
                ]
              : []),
            ...(popup.kind === "site-day"
              ? [
                  {
                    label: "Thời điểm tồn cao nhất",
                    cell: (row: typeof rows[number]) =>
                      row.id.includes(":") && row.peakAt
                        ? displayTime(row.peakAt)
                        : "—",
                  },
                ]
              : []),
            {
              label: "Vượt sức chứa",
              cell: (row) =>
                row.exceeded.length
                  ? `${row.exceeded.length} bãi · ${row.exceeded.reduce((total, item) => total + item.exceeded, 0)} khung`
                  : "—",
            },
          ]}
        />
        <ParkingPagination
          count={rows.length}
          page={page}
          size={popupSize}
          change={setPopupPage}
          changeSize={(size) => {
            setPopupSize(size)
            setPopupPage(1)
          }}
        />
      </>
    )
  }
  if (popup?.kind === "hours") {
    const allRows = byShift
      ? data.bySite.flatMap((site) => {
          const shifts = shiftIntervals(
            site.trips,
            settings,
            site.id,
            filters.vehicle,
            detailDay,
            cutoff,
          )
          const first = shifts[0],
            last = shifts[shifts.length - 1]
          return first
            ? [
                {
                  ...first,
                  id: `total/${site.id}`,
                  label: "Tổng ca",
                  end: last.end,
                  closing: last.closing,
                  incoming: shifts.reduce(
                    (total, row) => total + row.incoming,
                    0,
                  ),
                  outgoing: shifts.reduce(
                    (total, row) => total + row.outgoing,
                    0,
                  ),
                  incomplete: shifts.some((row) => row.incomplete),
                  exceeded: false,
                  site: site.id,
                  missing: false,
                  summary: true,
                },
                ...shifts.map((row) => ({
                  ...row,
                  site: site.id,
                  missing: false,
                  summary: false,
                })),
              ]
            : [
                {
                  id: site.id,
                  site: site.id,
                  label: "Chưa khai báo ca trực",
                  day: detailDay,
                  start: 0,
                  end: 0,
                  opening: 0,
                  incoming: 0,
                  outgoing: 0,
                  closing: 0,
                  design: null,
                  actual: null,
                  incomplete: true,
                  exceeded: false,
                  missing: true,
                  summary: true,
                },
              ]
        })
      : flow.map((row) => ({
          ...row,
          site: detailSite?.id ?? "",
          missing: false,
          summary: false,
        }))
    const focused = popup.interval
      ? allRows.find((row) => row.id === popup.interval)
      : undefined
    const rows = focused
      ? [focused]
      : allRows.filter(
          (row) => !byShift || row.summary || expanded.includes(row.site),
        )
    popupExport = () =>
      (focused ? [focused] : allRows).map((row) =>
        row.missing
          ? { "Bãi xe": siteById(row.site)?.label, "Ghi chú": row.label }
          : flowExport(siteById(row.site)?.label ?? "", filters.vehicle, row),
      )
    popupTable = (
      <>
        <div className="parking-inline mb-3">
          <Segments
            options={["Giờ", "Ca"]}
            value={byShift ? "Ca" : "Giờ"}
            change={(value) => {
              setPopup({ kind: "hours" })
              update({ flow: value })
            }}
          />
          {focused && (
            <TextLink onClick={() => setPopup({ kind: "hours" })}>
              Xem tất cả {byShift ? "ca" : "khung giờ"}
            </TextLink>
          )}
        </div>
        <ParkingTable
          rows={rows}
          rowKey={(row) => row.id}
          rowClass={(row) => (row.exceeded ? "mismatch-row" : "")}
          columns={[
            ...(byShift
              ? [
                  {
                    label: "Bãi xe",
                    cell: (row: typeof rows[number]) =>
                      row.summary && !row.missing ? (
                        <TextLink
                          onClick={() =>
                            setExpanded((keys) =>
                              keys.includes(row.site)
                                ? keys.filter((id) => id !== row.site)
                                : [...keys, row.site],
                            )
                          }
                        >
                          {expanded.includes(row.site) ? "▾" : "▸"}{" "}
                          {siteById(row.site)?.label}
                        </TextLink>
                      ) : row.missing || focused ? (
                        siteById(row.site)?.label
                      ) : (
                        "—"
                      ),
                  },
                ]
              : []),
            {
              label: byShift ? "Ca trực" : "Khung giờ",
              cell: (row) => row.label,
            },
            ...counts<typeof rows[number]>((row) =>
              windowOptions(row, [row.site]),
            ),
            ...(!byShift
              ? [
                  {
                    label: "Chỗ trống",
                    numeric: true,
                    cell: (row: typeof rows[number]) =>
                      row.actual === null ? "—" : fmt(row.actual - row.closing),
                  },
                  {
                    label: "Tỷ lệ sử dụng",
                    numeric: true,
                    cell: (row: typeof rows[number]) =>
                      pct(ratio(row.closing, row.actual)),
                  },
                ]
              : []),
            {
              label: "Ghi chú",
              cell: (row) =>
                [
                  row.incomplete && !row.missing ? "Chưa đủ số liệu" : "",
                  row.exceeded ? "▲ Vượt sức chứa" : "",
                  !byShift && row.id === detailSiteDay?.peakIn.id
                    ? "Cao điểm vào"
                    : "",
                  !byShift && row.id === detailSiteDay?.peakOut.id
                    ? "Cao điểm ra"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ") || "—",
            },
          ]}
        />
      </>
    )
  }
  if (popup?.kind === "duration") {
    const rows = breakdown().map((unit) => ({
      ...unit,
      stats:
        unit.key === "total"
          ? duration
          : durationStats(
              data.periodTrips.filter((trip) => unit.ids.includes(trip.site)),
              settings,
              filters,
              data.days,
              guest,
            ),
    }))
    popupExport = () =>
      rows.map((row) => durationExport(row.label, filters.vehicle, row.stats))
    const options = (row: typeof rows[number]) => ({
      sites: row.ids,
      group: guest,
    })
    popupTable = (
      <>
        <Segments
          options={["Số lượt", "Tỷ lệ"]}
          value={showRatios ? "Tỷ lệ" : "Số lượt"}
          change={(value) => setShowRatios(value === "Tỷ lệ")}
        />
        <ParkingTable
          rows={visibleBreakdown(rows)}
          rowKey={(row) => row.key}
          rowClass={(row) => (row.key === "total" ? "parking-total" : "")}
          columns={[
            { label: "Đơn vị", cell: unitLabel },
            ...duration.groups.map(
              ({ label }, index): TableColumn<typeof rows[number]> => ({
                label,
                numeric: true,
                cell: (row) =>
                  countLink(
                    row.stats.groups[index].trips.length,
                    "duration",
                    label,
                    { ...options(row), bucket: index + 1 },
                    showRatios
                      ? pct(
                          ratio(
                            row.stats.groups[index].trips.length,
                            row.stats.departed.length,
                          ),
                        )
                      : undefined,
                  ),
              }),
            ),
            {
              label: "Tổng lượt ra",
              numeric: true,
              cell: (row) =>
                countLink(
                  row.stats.departed.length,
                  "outgoing",
                  "Ra trong kỳ",
                  options(row),
                ),
            },
            {
              label: "TG đỗ TB (giờ)",
              numeric: true,
              cell: (row) =>
                countLink(
                  row.stats.departed.length,
                  "duration",
                  "Lượt tính thời gian đỗ",
                  options(row),
                  numberText(row.stats.average, 2),
                ),
            },
            {
              label: "Lượt qua đêm",
              numeric: true,
              cell: (row) =>
                countLink(
                  row.stats.nightly.length,
                  "nightly",
                  "Lượt qua đêm",
                  options(row),
                ),
            },
            {
              label: "Xe chưa ra",
              numeric: true,
              cell: (row) =>
                countLink(
                  row.stats.remaining.length,
                  "closing",
                  "Xe chưa ra",
                  options(row),
                ),
            },
            {
              label: "Tồn bất thường",
              numeric: true,
              cell: (row) =>
                countLink(
                  row.stats.unusual.length,
                  "unusual",
                  "Tồn bất thường",
                  options(row),
                ),
            },
          ]}
        />
      </>
    )
  }

  if (!data.days.length)
    return (
      <div className="panel parking-empty">
        Chưa có dữ liệu trước ngày {date(goLive)}.
      </div>
    )
  if (!data.bySite.length)
    return (
      <div className="panel parking-empty">
        <NoMatches clear={resetFilters} />
      </div>
    )
  const chartUnits = [
    { id: "total", label: "Toàn bộ", total, ids: undefined },
    ...(utilizationMode === "Khu đô thị"
      ? data.byEstate.map((estate) => ({
          id: estate.id,
          label: estate.short,
          total: estate.total,
          ids: estate.children.map((site) => site.id),
        }))
      : data.bySite.map((site) => ({
          id: site.id,
          label: site.label,
          total: site.total,
          ids: [site.id],
        }))),
  ]
  const usageScale =
    Math.max(
      1.15,
      ...chartUnits.flatMap(({ total }) => [
        total.occupancy ?? 0,
        total.attainment ?? 0,
      ]),
    ) * 1.05
  const dailyPoints = data.daily.map((row) => ({
    id: row.day,
    label: row.day.slice(8),
    detail: date(row.day),
    incoming: row.incoming,
    outgoing: row.outgoing,
    line: row.peak,
    limit: row.design,
    tint:
      row.type === "Lễ tết"
        ? "holiday"
        : row.type === "Cuối tuần"
          ? "weekend"
          : "",
    warning: row.exceeded.length > 0,
    action: () => open({ kind: "site-day", day: row.day }),
  }))
  const chartMetrics = [
    {
      label: "Lấp đầy",
      value: pct(total.occupancy),
      hint: "Giờ đỗ thực tế / tối đa",
      icon: <Gauge size={17} />,
    },
    {
      label: "Đạt kế hoạch",
      value: pct(total.attainment),
      hint: "Giờ đỗ thực tế / kế hoạch",
      icon: <Layers3 size={17} />,
    },
    {
      label: "Xe vào trong kỳ",
      value: fmt(total.incoming),
      hint: `TB ${numberText(total.incoming / data.days.length)} xe / ngày`,
      icon: <ArrowDownToLine size={17} />,
    },
    {
      label: "Tồn cao nhất",
      value: `${fmt(total.peak)} / ${numberText(total.design)}`,
      hint: total.peakAt ? date(dayAt(total.peakAt - 1)) : "—",
      icon: <TrendingUp size={17} />,
    },
    {
      label: "Thời gian đỗ trung bình",
      value:
        allDuration.average === null
          ? "—"
          : `${numberText(allDuration.average, 2)} giờ`,
      hint: `${fmt(allDuration.nightly.length)} lượt qua đêm`,
      icon: <Clock3 size={17} />,
    },
    {
      label: "Ngày có bãi vượt sức chứa",
      value: `${exceededDays} ngày`,
      hint: <TextLink onClick={showAlerts}>Xem cảnh báo</TextLink>,
      icon: <TriangleAlert size={17} />,
      warning: exceededDays > 0,
    },
  ]
  return (
    <>
      {!security && (
        <div className="parking-kpis">
          {chartMetrics.map((metric) => (
            <div
              className={`summary-card ${
                metric.warning ? "parking-kpi-warning" : ""
              }`}
              key={metric.label}
            >
              <div className="summary-top">
                <span>{metric.label}</span>
                <span className="summary-icon">{metric.icon}</span>
              </div>
              <div className="summary-value">{metric.value}</div>
              <div className="summary-sub">{metric.hint}</div>
            </div>
          ))}
        </div>
      )}
      <div className="parking-chart-layout">
        {!security && (
          <>
            <Chart
              title="Lấp đầy và đạt kế hoạch"
              description={scope}
              icon={<BarChart3 size={18} />}
              note="Đường nét đứt đánh dấu mốc 100%."
              details={() => open({ kind: "use" })}
              actions={
                <Segments
                  options={["Khu đô thị", "Bãi"]}
                  value={utilizationMode}
                  change={(value) => update({ unit: value })}
                />
              }
            >
              <div className="parking-utilization">
                {chartUnits.map((unit) => (
                  <div className="parking-util-row" key={unit.id}>
                    <strong title={unit.label}>{unit.label}</strong>
                    <div
                      className="parking-util-tracks"
                      style={
                        {
                          "--mark": `${100 / usageScale}%`,
                        } as React.CSSProperties
                      }
                    >
                      {([
                        ["Lấp đầy", unit.total.occupancy, chartColors[0]],
                        ["Đạt kế hoạch", unit.total.attainment, chartColors[1]],
                      ] as const).map(([label, value, color]) => (
                        <button
                          type="button"
                          title={`${unit.label} · ${label} · ${pct(value)}`}
                          onClick={() => open({ kind: "use", ids: unit.ids })}
                          key={label}
                        >
                          {value === null ? (
                            <small>
                              {label === "Đạt kế hoạch" &&
                              unit.total.plannedHours === null
                                ? "Chưa khai báo kế hoạch"
                                : "—"}
                            </small>
                          ) : (
                            <>
                              <i
                                style={{
                                  background: color,
                                  width: `${(value / usageScale) * 100}%`,
                                }}
                              />
                              <b>{pct(value)}</b>
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Legend
                entries={[
                  ["Lấp đầy", chartColors[0]],
                  ["Đạt kế hoạch", chartColors[1]],
                ]}
              />
            </Chart>
            <Chart
              title="Lấp đầy theo loại ngày"
              description="So sánh các ngày trong kỳ"
              icon={<CalendarDays size={18} />}
              note="Ngày lễ tết lấy theo lịch trong Tham số chỗ đỗ."
              details={() => open({ kind: "day-type" })}
            >
              <Plot
                percentScale
                format={(value) => `${value}%`}
                points={data.dayGroups
                  .filter((row) => row.label !== "Cả kỳ")
                  .map((row, index) => ({
                    id: row.label,
                    label: row.label,
                    incoming:
                      row.occupancy === null ? undefined : row.occupancy * 100,
                    color: chartColors[index],
                    limit:
                      total.occupancy === null ? null : total.occupancy * 100,
                    value: pct(row.occupancy),
                    sub: `${row.days.length} ngày · ${numberText(row.incoming / row.days.length)} xe vào/ngày`,
                    action: () =>
                      open({ kind: "day-type", dayType: row.label }),
                  }))}
              />
              <Legend
                entries={[[`Lấp đầy cả kỳ ${pct(total.occupancy)}`, "#d94a55"]]}
              />
            </Chart>
          </>
        )}
        <Chart
          className="parking-chart-full"
          title="Xe vào, xe ra và tồn cao nhất mỗi ngày"
          description={`${scope} · ${period}`}
          icon={<TrendingUp size={18} />}
          note="Chọn một ngày để xem lưu lượng từng bãi. Ký hiệu ▲ đánh dấu ngày có bãi vượt sức chứa."
          details={() => open({ kind: "daily" })}
        >
          <Plot
            minWidth={Math.max(0, dailyPoints.length * 31 + 42)}
            points={dailyPoints.map(
              ({ line: _line, limit: _limit, ...point }) => point,
            )}
          />
          <Plot
            minWidth={Math.max(0, dailyPoints.length * 31 + 42)}
            points={dailyPoints}
            lineOnly
          />
          <Legend
            entries={[
              ["Xe vào", chartColors[0]],
              ["Xe ra", chartColors[2]],
              ["Tồn cao nhất", chartColors[1]],
              ["Chỗ quy hoạch", "#d94a55"],
              ["Cuối tuần", "#e8ebf0"],
              ["Lễ tết", "#ffebd2"],
            ]}
          />
        </Chart>
        <div
          ref={chartRef}
          className={security ? "parking-chart-full" : "parking-chart-anchor"}
        >
          <Chart
            title={byShift ? "Lưu lượng theo ca" : "Lưu lượng theo giờ"}
            description={`${detailSite?.label ?? "—"} · ${date(detailDay)}`}
            icon={<TrendingUp size={18} />}
            note={
              byShift
                ? "Ca qua nửa đêm được tính cho ngày bắt đầu ca."
                : "Số xe trong bãi tính tại cuối mỗi khung giờ."
            }
            details={() => open({ kind: "hours" })}
            actions={
              <Segments
                options={["Giờ", "Ca"]}
                value={byShift ? "Ca" : "Giờ"}
                change={(value) => update({ flow: value, focus: null })}
              />
            }
          >
            <div className="parking-flow-filters">
              <Field label="Bãi xem trong ngày">
                <Select
                  value={detailSite?.id ?? ""}
                  options={data.bySite.map((site) => ({
                    value: site.id,
                    label: site.label,
                  }))}
                  onChange={(e) =>
                    update({ flowSite: e.target.value, focus: null })
                  }
                />
              </Field>
              <Field label="Ngày xem lưu lượng">
                <Input
                  type="date"
                  min={data.days[0]}
                  max={filters.end}
                  value={detailDay}
                  onChange={(e) => {
                    if (data.days.includes(e.target.value))
                      update({ flowDay: e.target.value, focus: null })
                  }}
                />
              </Field>
            </div>
            {flow.length ? (
              <>
                <Plot
                  minWidth={byShift ? undefined : 460}
                  points={flow.map((row, index) => ({
                    id: row.id,
                    detail: row.label,
                    label: byShift
                      ? row.label.split(" · ")[0]
                      : index % 2 === 0
                        ? `${row.label.slice(0, 2)}h`
                        : "",
                    incoming: row.incomplete ? undefined : row.incoming,
                    outgoing: row.incomplete ? undefined : row.outgoing,
                    line: row.incomplete ? undefined : row.closing,
                    limit: row.design,
                    tint: row.exceeded ? "over" : "",
                    warning: row.exceeded,
                    sub: row.incomplete ? "Chưa đủ số liệu" : undefined,
                    action: () => open({ kind: "hours", interval: row.id }),
                  }))}
                />
                <Legend
                  entries={[
                    ["Xe vào", chartColors[0]],
                    ["Xe ra", chartColors[2]],
                    ["Số xe trong bãi", chartColors[1]],
                    ["Chỗ quy hoạch", "#d94a55"],
                  ]}
                />
              </>
            ) : (
              <div className="parking-empty">
                {byShift ? "Chưa khai báo ca trực" : "Chưa có dữ liệu"}
                {!security && (
                  <TextLink onClick={showCapacity}>
                    Sức chứa và kế hoạch bãi xe
                  </TextLink>
                )}
              </div>
            )}
          </Chart>
        </div>
        {!security && (
          <Chart
            title="Lượt xe theo thời gian đỗ"
            description={`TB ${numberText(duration.average, 2)} giờ · ${fmt(duration.nightly.length)} lượt qua đêm · ${fmt(duration.unusual.length)} xe tồn bất thường`}
            icon={<Clock3 size={18} />}
            note="Chỉ tính lượt đã ra trong kỳ."
            details={() => open({ kind: "duration" })}
            actions={
              <Select
                aria-label="Nhóm khách trong biểu đồ thời gian đỗ"
                value={guest}
                options={[allOption("Tất cả nhóm khách"), ...parkingGroups]}
                onChange={(e) => update({ guest: e.target.value })}
              />
            }
          >
            {duration.departed.length ? (
              <Plot
                points={duration.groups.map(({ label, trips }, index) => ({
                  id: label,
                  label,
                  incoming: trips.length,
                  color: chartColors[index],
                  value: fmt(trips.length),
                  sub: pct(ratio(trips.length, duration.departed.length)),
                  action: () =>
                    navigateDrill({
                      metric: "duration",
                      label,
                      start,
                      end,
                      group: guest,
                      bucket: index + 1,
                    }),
                }))}
              />
            ) : (
              <div className="parking-empty">
                <NoMatches clear={() => update({ guest: null })} />
              </div>
            )}
          </Chart>
        )}
      </div>
      {popup && (
        <Overlay
          wide
          title={`${popupTitles[popup.kind]} · Số liệu chi tiết`}
          subtitle={`${scope} · ${period} · ${filters.vehicle}`}
          onClose={() => setPopup(null)}
          footer={
            <>
              {canExport(access) && (
                <ExportButton
                  onClick={() =>
                    exportFile("SoLieuChoDo", () => ({
                      "Số liệu": popupExport(),
                    }))
                  }
                />
              )}
              <Button onClick={() => setPopup(null)}>Đóng</Button>
            </>
          }
        >
          <div className="parking-chips">
            {popup.ids?.map((id) => (
              <span key={id}>{siteById(id)?.label}</span>
            ))}
            {popup.dayType && <span>{popup.dayType}</span>}
            {popup.kind === "hours" && (
              <span>
                {date(detailDay)}
                {!byShift && detailSite ? ` · ${detailSite.label}` : ""}
              </span>
            )}
            {popup.kind === "duration" && guest && <span>{guest}</span>}
          </div>
          {popup.kind === "use" &&
            total.occupancy === null &&
            data.bySite.some((site) => site.total.maxHours === null) && (
              <div className="parking-banner">
                Một số bãi chưa khai báo sức chứa hoặc giờ khai thác.
                {canDeclare(access) && (
                  <TextLink
                    onClick={() => {
                      setPopup(null)
                      showCapacity()
                    }}
                  >
                    Xem khai báo bãi xe
                  </TextLink>
                )}
              </div>
            )}
          {popupTable}
        </Overlay>
      )}
    </>
  )
}
