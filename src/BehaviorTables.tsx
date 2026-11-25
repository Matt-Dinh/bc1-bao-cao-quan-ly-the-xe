import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { ChevronDown, ChevronRight, Info } from "lucide-react"
import { Button, Heading } from "./ui"
import { date, fmt } from "./data"
import { numberText, ParkingTable, Segments, TextLink } from "./parking-ui"
import type { TableColumn } from "./parking-ui"
import {
  arrivalStats, behaviorGuests, behaviorVehicles, dayKinds, dwellBands, estateName, eventLabels, hourLabel,
  hourOf, hours, inBand, proportion, repeatBands, returningVehicles, unknownBehavior, weekday, weekdays,
} from "./behavior-model"
import type { BehaviorArrival, BehaviorData, ReturningVehicle } from "./behavior-model"
import { siteById } from "./parking-model"
import { anyEvent, noEvent } from "./behavior-lookup"

export type Drill = (label: string, patch?: Record<string, string | null>) => void
export const decimal = (value: number | null, precision = 1) => numberText(value, precision)
export const percent = (value: number | null) => value === null ? "—" : `${decimal(value)}%`
export const signed = (value: number | null, precision = 1) => value === null ? "—" : `${value > 0 ? "+" : ""}${decimal(value, precision)}`
export const includesEvent = (row: BehaviorArrival) => row.events.length > 0
export const knownVehicles = behaviorVehicles.slice(0, -1)
export const matchingVehicle = (rows: BehaviorArrival[], vehicle: string) => rows.filter((row) => row.vehicle === vehicle)

export function BehaviorPanel({ title, note, actions, children }: { title: string; note?: string; actions?: ReactNode; children: ReactNode }) {
  return <section className="panel behavior-panel">
    <div className="panel-heading behavior-panel-heading">
      <div><Heading level={2}>{title}</Heading>{note && <p>{note}</p>}</div>
      {actions}
    </div>
    {children}
  </section>
}
export function Count({ n, label, drill, patch }: { n: number; label: string; drill: Drill; patch?: Parameters<Drill>[1] }) {
  return n ? <TextLink label={`${label} · ${fmt(n)} lượt`} onClick={() => drill(label, patch)}>{fmt(n)}</TextLink> : "0"
}
export function ThinSample({ n, children }: { n: number; children: ReactNode }) {
  if (n === 0 || n >= 30) return children
  return <span className="behavior-thin" tabIndex={0} title="Ít dữ liệu, không nên dùng để so sánh">
    {children}<Info size={11} aria-label="Ít dữ liệu, không nên dùng để so sánh" />
  </span>
}

const classifications = ["Loại xe", "Sự kiện / Không sự kiện", "Loại khách"] as const
const splits = ["Không tách", "Khu đô thị", "Bãi xe"] as const
type Classification = typeof classifications[number]
type Split = typeof splits[number]
type Breakdown = { label: string; rows: BehaviorArrival[]; patch: NonNullable<Parameters<Drill>[1]> }
function classify(rows: BehaviorArrival[], kind: Classification, guests: string[]): Breakdown[] {
  if (kind === "Sự kiện / Không sự kiện") return eventLabels.map((label, index) => ({
    label, rows: rows.filter((row) => includesEvent(row) === (index === 0)), patch: { bEvent: index ? noEvent : anyEvent },
  }))
  const options = kind === "Loại xe" ? behaviorVehicles : guests.length ? guests : behaviorGuests
  const field = kind === "Loại xe" ? "vehicle" : "guest"
  const by = new Map<string, BehaviorArrival[]>()
  for (const row of rows) {
    const list = by.get(row[field]) ?? []
    list.push(row)
    by.set(row[field], list)
  }
  return options.filter((key) => key !== unknownBehavior || by.has(key)).map((label) => ({
    label, rows: by.get(label) ?? [], patch: { [kind === "Loại xe" ? "vehicle" : "group"]: label },
  }))
}
type Summary = Breakdown & {
  key: string
  parent: number
  stats: ReturnType<typeof arrivalStats>
  kind: "total" | "group" | "category" | "delta"
  difference?: ReturnType<typeof arrivalStats>
}
export function ArrivalsReport({ data, guests, total, drill, classification, split }: {
  data: BehaviorData; guests: string[]; total: string; drill: Drill; classification: string | null; split: string | null
}) {
  const kind = classifications.find((value) => value === classification) ?? classifications[0]
  const separation = splits.find((value) => value === split) ?? splits[0]
  const [expanded, setExpanded] = useState<string[]>([])
  const [bands, setBands] = useState("8 nhóm")
  const [distribution, setDistribution] = useState("Nhóm lưu trú")
  const all = data.arrivals
  const overall = useMemo(() => classify(all, kind, guests), [all, kind, guests])
  const rows = useMemo(() => {
    const summaries: Summary[] = []
    const push = (row: Breakdown, key: string, parent: number, rowKind: Summary["kind"]) =>
      summaries.push({ ...row, key, parent, kind: rowKind, stats: arrivalStats(row.rows) })
    const categories = (rows: Breakdown[], key: string, parent: number, scope = {}) => {
      for (const [index, row] of rows.entries()) push({ ...row, patch: { ...scope, ...row.patch } }, `${key}-${index}`, parent, "category")
      if (kind === classifications[1]) summaries.push({ key: `${key}-delta`, label: "Chênh lệch", rows: [], patch: {}, parent,
        kind: "delta", stats: arrivalStats(rows[0].rows), difference: arrivalStats(rows[1].rows) })
    }
    push({ label: total, rows: all, patch: {} }, "total", all.length, "total")
    if (separation === "Không tách") categories(overall, "cat", all.length)
    else {
      const groups = new Map<string, BehaviorArrival[]>()
      for (const row of all) {
        const key = separation === "Bãi xe" ? row.trip.site : row.trip.site.split(":")[0]
        const items = groups.get(key) ?? []
        items.push(row)
        groups.set(key, items)
      }
      const keys = [...new Set([...data.selectedSites].map((id) => separation === "Bãi xe" ? id : id.split(":")[0]))]
      for (const key of keys) {
        const subset = groups.get(key) ?? []
        const label = separation === "Bãi xe" ? `${estateName(key.split(":")[0])} · ${siteById(key)?.name ?? key}` : estateName(key)
        const patch = { [separation === "Bãi xe" ? "site" : "estate"]: key }
        push({ label, rows: subset, patch }, key, all.length, "group")
        if (expanded.includes(key)) categories(classify(subset, kind, guests), key, subset.length, patch)
      }
    }
    return summaries
  }, [total, all, overall, separation, kind, expanded, guests, data.selectedSites])
  const isDelta = (row: Summary) => row.kind === "delta"
  const measure = (row: Summary, field: "average" | "median" | "brief" | "two" | "four", ratio = false) => {
    const value = row.stats[field], other = row.difference?.[field]
    const text = isDelta(row)
      ? value !== null && other !== null && other !== undefined ? `${signed(value - other, ratio ? 1 : 0)}${ratio ? " đpt" : ""}` : "—"
      : ratio ? percent(value) : decimal(value, 0)
    return <ThinSample n={row.difference ? Math.min(row.stats.n, row.difference.n) : row.stats.n}>{text}</ThinSample>
  }
  const extreme = (row: Summary, value: number | null, label: string) => isDelta(row) || value === null ? "—" :
    <TextLink label={`${label} · ${value} phút`} onClick={() => drill(`${row.label} · ${label} (${value} phút)`, { ...row.patch, bExact: String(value) })}>{fmt(value)}</TextLink>
  const columns: TableColumn<Summary>[] = [
    { label: "Nhóm", cell: (row) => row.kind === "group" ?
      <button type="button" className="behavior-expand" aria-expanded={expanded.includes(row.key)}
        onClick={() => setExpanded((current) => current.includes(row.key) ? current.filter((key) => key !== row.key) : [...current, row.key])}>
        {expanded.includes(row.key) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}{row.label}
      </button> : row.label },
    { label: "Lượt đến", numeric: true, cell: (row) => isDelta(row) ? "—" : <Count n={row.stats.count} label={`${row.label} · Lượt đến`} drill={drill} patch={row.patch} /> },
    { label: "Tỷ trọng", numeric: true, cell: (row) => isDelta(row) ? "—" : percent(proportion(row.stats.count, row.parent)) },
    { label: "Có lưu trú", numeric: true, cell: (row) => isDelta(row) ? "—" : <Count n={row.stats.n} label={`${row.label} · Có lưu trú`} drill={drill} patch={{ ...row.patch, bDuration: "eligible" }} /> },
    { label: "TB (phút)", numeric: true, cell: (row) => measure(row, "average") },
    { label: "Trung vị (phút)", numeric: true, cell: (row) => measure(row, "median") },
    { label: "Ngắn nhất", numeric: true, cell: (row) => extreme(row, row.stats.min, "Lưu trú ngắn nhất") },
    { label: "Dài nhất", numeric: true, cell: (row) => extreme(row, row.stats.max, "Lưu trú dài nhất") },
    { label: "Dưới 30 phút", numeric: true, cell: (row) => measure(row, "brief", true) },
    { label: "Từ 2 giờ", numeric: true, cell: (row) => measure(row, "two", true) },
    { label: "Từ 4 giờ", numeric: true, cell: (row) => measure(row, "four", true) },
    { label: "Giờ vào cao điểm", cell: (row) => isDelta(row) ? "—" : row.stats.peakIn },
  ]
  const byVehicle = kind !== "Loại xe" && distribution === "Loại xe"
  const buckets = byVehicle
    ? behaviorVehicles.filter((label) => label !== unknownBehavior || all.some((row) => row.vehicle === label))
      .map((label) => ({ label, match: (row: BehaviorArrival) => row.vehicle === label, patch: { vehicle: label } }))
    : dwellBands[bands === "8 nhóm" ? "fine" : "coarse"].map((band, bandIndex) => ({
      label: band[2], match: (row: BehaviorArrival) => inBand(row.dwell, band),
      patch: (bands === "8 nhóm"
        ? { bDuration: String(bandIndex) }
        : { bFrom: String(band[0]), bTo: Number.isFinite(band[1]) ? String(band[1]) : null }) as Record<string, string | null>,
    }))
  const cohorts = [...overall, { label: total, rows: all, patch: {} }]
  const bases = cohorts.map((item) => byVehicle ? item.rows.length : item.rows.filter((row) => row.dwell !== null).length)
  return <>
    <BehaviorPanel title="Lượt đến và thời gian lưu trú" note="Thời gian lưu trú tính theo phút trên các lượt đã ra có dữ liệu hợp lệ.">
      <ParkingTable rows={rows} rowKey={(row) => row.key}
        rowClass={(row) => `behavior-row-${row.kind}${separation !== "Không tách" && row.kind === "category" ? " behavior-child" : ""}`} columns={columns} />
    </BehaviorPanel>
    <BehaviorPanel title={byVehicle ? "Cơ cấu phương tiện" : "Phân bố thời gian lưu trú"} note="Tỷ trọng được tính trong từng cột."
      actions={<div className="parking-inline">
        {kind !== "Loại xe" && <Segments options={["Nhóm lưu trú", "Loại xe"]} value={distribution} change={setDistribution} />}
        {!byVehicle && <Segments options={["8 nhóm", "5 nhóm (BC2)"]} value={bands} change={setBands} />}
      </div>}>
      <ParkingTable rows={buckets} rowKey={({ label }) => label} columns={[
        { label: byVehicle ? "Loại xe" : "Nhóm thời gian", cell: (bucket) => bucket.label },
        ...cohorts.map((cohort, index): TableColumn<typeof buckets[number]> => ({
          label: cohort.label, numeric: true, cell: (bucket) => {
            const count = cohort.rows.filter(bucket.match).length
            return <span className="behavior-cell-pair"><Count n={count} label={`${cohort.label} · ${bucket.label}`} drill={drill}
              patch={{ ...cohort.patch, ...bucket.patch }} /><small>{percent(proportion(count, bases[index]))}</small></span>
          },
        })),
        ...(kind === classifications[1] ? [{
          label: "Chênh lệch tỷ trọng", numeric: true, cell: (bucket: typeof buckets[number]) =>
            bases[0] && bases[1] ? `${signed(100 * (cohorts[0].rows.filter(bucket.match).length / bases[0] - cohorts[1].rows.filter(bucket.match).length / bases[1]))} đpt` : "—",
        }] : []),
      ]} />
    </BehaviorPanel>
  </>
}

export function TimeReport({ data, drill, view, average, change, total }: {
  data: BehaviorData; drill: Drill; view: string | null; average: boolean; change: (patch: Record<string, string | null>) => void; total: string
}) {
  const views = ["Ngày", "Loại ngày", "Khung giờ"]
  const active = views.includes(view ?? "") ? view : views[0]
  const highest = Math.max(1, ...data.days.map(({ rows }) => rows.length))
  const aggregate = useMemo(() => arrivalStats(data.arrivals), [data.arrivals])
  const weekly = weekdays.map((_, index) => data.days.filter(({ day }) => weekday(day) === index))
  const hourly = hours.map((hour) => {
    const incoming = weekly.map((days) => days.reduce((n, day) => n + day.rows.filter(({ trip }) => hourOf(trip.entered) === hour).length, 0))
    return { hour, incoming, totalIn: aggregate.inCounts[hour], totalOut: aggregate.outCounts[hour] }
  })
  const heatMax = Math.max(1, ...hourly.flatMap(({ incoming }) => incoming.map((n, i) => average ? n / Math.max(1, weekly[i].length) : n)))
  const byDay = [{ day: "", rows: data.arrivals, kind: "", events: [] }, ...data.days]
  const daySets = [...dayKinds.map((kind) => ({ label: kind, days: data.days.filter((day) => day.kind === kind) })),
    ...["Có sự kiện", "Không có sự kiện"].map((label, i) => ({ label, days: data.days.filter(({ events }) => Boolean(events.length) === (i === 0)) }))]
  const count = (rows: BehaviorArrival[], label: string, patch = {}) =>
    <Count n={rows.length} label={label} drill={drill} patch={patch} />
  const datePatch = (day: string) => day ? { start: day, end: day } : {}
  const holidayYears = [...new Set(data.days.map(({ day }) => day.slice(0, 4)))].filter((year) =>
    ![...data.holidays].some((day) => day.startsWith(year)))
  return <BehaviorPanel title="Lượt đến theo thời gian"
    note={active === "Khung giờ" ? `Giờ vào cao điểm ${aggregate.peakIn} · Giờ ra cao điểm ${aggregate.peakOut}` : undefined}
    actions={<div className="parking-inline">
      <Segments options={views} value={active ?? "Ngày"} change={(value) => change({ timeView: value })} />
      {active === "Khung giờ" && <Segments options={["Tổng", "Trung bình mỗi ngày"]} value={average ? "Trung bình mỗi ngày" : "Tổng"}
        change={(value) => change({ timeAverage: value === "Tổng" ? null : "1" })} />}
    </div>}>
    {active === "Ngày" && <ParkingTable rows={byDay.map((row) => ({ ...row, stats: arrivalStats(row.rows) }))}
      rowKey={(row) => row.day} rowClass={(row) => !row.day ? "behavior-row-total" : row.events.length ? "behavior-event-day" : ""} columns={[
        { label: "Ngày", cell: ({ day }) => day ? date(day) : total },
        { label: "Thứ", cell: ({ day }) => day ? weekdays[weekday(day)] : "—" },
        { label: "Loại ngày", cell: ({ kind }) => kind || "—" },
        { label: "Sự kiện trong ngày", cell: ({ events }) => events.length ? <span className="behavior-tags">{events.map((event) =>
          <span key={event.id} title={`${event.name} · ${estateName(event.estate)}`}>{event.id}</span>)}</span> : "—" },
        { label: "Lượt đến", numeric: true, cell: ({ day, rows }) => <span className="behavior-inline-bar">
          {day && <i style={{ width: `${rows.length / highest * 65}px` }} />}{count(rows, `${day ? date(day) : total} · Lượt đến`, datePatch(day))}
        </span> },
        ...eventLabels.map((label, i): TableColumn<typeof byDay[number]> => ({
          label, numeric: true, cell: ({ day, rows }) => count(rows.filter((row) => includesEvent(row) === (i === 0)),
            `${date(day)} · ${label}`, { ...datePatch(day), bEvent: i === 0 ? anyEvent : noEvent }),
        })),
        ...knownVehicles.map((label): TableColumn<typeof byDay[number]> => ({
          label, numeric: true, cell: ({ day, rows }) => count(matchingVehicle(rows, label), `${date(day)} · ${label}`, { ...datePatch(day), vehicle: label }),
        })),
        { label: "Lưu trú TB (phút)", numeric: true, cell: ({ stats }) => <ThinSample n={stats.n}>{decimal(stats.average, 0)}</ThinSample> },
        { label: "Từ 2 giờ", numeric: true, cell: ({ stats }) => <ThinSample n={stats.n}>{percent(stats.two)}</ThinSample> },
      ]} />}
    {active === "Loại ngày" && <ParkingTable rows={daySets.map(({ label, days }) => {
      const rows = days.flatMap((day) => day.rows)
      return { label, days, rows, stats: arrivalStats(rows) }
    })} rowKey={({ label }) => label} rowClass={({ label }) => label === "Có sự kiện" ? "behavior-table-separator" : ""} columns={[
      { label: "Loại ngày", cell: ({ label }) => label },
      { label: "Số ngày", numeric: true, cell: ({ days }) => fmt(days.length) },
      { label: "Lượt đến", numeric: true, cell: ({ rows, label, days }) => count(rows, label, { bDays: days.map(({ day }) => day).join(",") }) },
      { label: "Lượt TB mỗi ngày", numeric: true, cell: ({ rows, days }) => days.length ? decimal(rows.length / days.length) : "—" },
      { label: "Lưu trú TB (phút)", numeric: true, cell: ({ stats }) => <ThinSample n={stats.n}>{decimal(stats.average, 0)}</ThinSample> },
      { label: "Từ 2 giờ", numeric: true, cell: ({ stats }) => <ThinSample n={stats.n}>{percent(stats.two)}</ThinSample> },
      { label: "Giờ vào cao điểm", cell: ({ stats }) => stats.peakIn },
    ]} />}
    {active === "Loại ngày" && holidayYears.map((year) => <p className="behavior-panel-note" key={year}>Chưa khai báo ngày lễ năm {year}.</p>)}
    {active === "Khung giờ" && <ParkingTable rows={hourly} rowKey={({ hour }) => String(hour)} columns={[
      { label: "Khung giờ", cell: ({ hour }) => hourLabel(hour) },
      ...weekdays.map((label, i): TableColumn<typeof hourly[number]> => ({
        label: `${label} · ${weekly[i].length} ngày`, numeric: true, cell: ({ hour, incoming }) => {
          const n = incoming[i], d = weekly[i].length, strength = average ? n / Math.max(1, d) : n
          return <span className="behavior-heat" style={{ backgroundColor: `rgba(48, 108, 177, ${strength / heatMax * .26})` }}>
            {average ? d ? decimal(n / d) : "—" : <Count n={n} label={`${label} · ${hourLabel(hour)}`} drill={drill}
              patch={{ bHour: String(hour), bDays: weekly[i].map(({ day }) => day).join(",") }} />}
          </span>
        },
      })),
      ...(["totalIn", "totalOut"] as const).map((key): TableColumn<typeof hourly[number]> => ({
        label: key === "totalIn" ? "Tổng vào" : "Tổng ra", numeric: true, cell: (row) => {
          const peak = key === "totalIn" ? aggregate.peakIn : aggregate.peakOut
          const marker = peak.startsWith(hourLabel(row.hour))
          return <span className="behavior-cell-pair">{marker && <span className="behavior-peak" title="Cao điểm">▲</span>}{average
            ? data.days.length ? decimal(row[key] / data.days.length) : "—"
            : <Count n={row[key]} label={`Lượt ${key === "totalIn" ? "vào" : "ra"} · ${hourLabel(row.hour)}`} drill={drill}
              patch={{ [key === "totalIn" ? "bHour" : "bExitHour"]: String(row.hour) }} />}</span>
        },
      })),
    ]} />}
  </BehaviorPanel>
}

export function ReturningReport({ data, drill, open, total }: {
  data: BehaviorData; drill: Drill; open: (title: string, rows: ReturningVehicle[]) => void; total: string
}) {
  const vehicles = useMemo(() => returningVehicles(data), [data])
  const types = [...knownVehicles, ...(data.arrivals.some(({ vehicle }) => vehicle === unknownBehavior) ? [unknownBehavior] : [])]
  const byType = [total, ...types].map((label, i) => {
    const scope: Record<string, string> = i ? { vehicle: label } : {}
    const arrivals = i ? matchingVehicle(data.arrivals, label) : data.arrivals
    const items = i ? vehicles.filter(({ vehicle }) => vehicle === label) : vehicles
    return { label, scope, arrivals, items, repeat: items.filter(({ rows }) => rows.length >= 2),
      familiar: items.filter(({ familiar }) => familiar), covered: arrivals.filter(({ plate }) => plate), applies: label !== "Xe đạp" }
  })
  const vehicleLink = (label: string, rows: ReturningVehicle[], display?: string) =>
    rows.length ? <TextLink label={`${label} · ${fmt(rows.length)} xe`} onClick={() => open(label, rows)}>{display ?? fmt(rows.length)}</TextLink> : display ?? "0"
  const visitRows = repeatBands.map(([low, high, label]) => ({
    label, items: vehicles.filter(({ rows }) => rows.length >= low && rows.length < high),
  }))
  return <>
    <BehaviorPanel title="Khách quay lại theo loại xe" note={data.historyDays < 90
      ? `Khách quen là biển số đã gửi xe tại khu đô thị trong ${data.historyDays} ngày có dữ liệu trước kỳ. Không áp dụng cho Xe đạp.`
      : "Khách quen là biển số đã gửi xe tại khu đô thị trong 90 ngày trước kỳ. Không áp dụng cho Xe đạp."}>
      <ParkingTable rows={byType} rowKey={({ label }) => label} rowClass={({ label }) => label === total ? "behavior-row-total" : ""} columns={[
        { label: "Loại xe", cell: ({ label }) => label },
        { label: "Lượt đến", numeric: true, cell: (row) => <Count n={row.arrivals.length} label={`${row.label} · Lượt đến`} drill={drill} patch={row.scope} /> },
        { label: "Lượt có biển số", numeric: true, cell: (row) => row.applies ? <span className="behavior-cell-pair">
          <Count n={row.covered.length} label={`${row.label} · Lượt có biển số`} drill={drill} patch={{ ...row.scope, bValidPlate: "1" }} />
          <small>{percent(proportion(row.covered.length, row.arrivals.length))}</small></span> : "Không áp dụng" },
        { label: "Số xe", numeric: true, cell: (row) => row.applies ? vehicleLink(row.label, row.items) : "—" },
        { label: "Quay lại từ 2 lần", numeric: true, cell: (row) => row.applies ? <span className="behavior-cell-pair">{vehicleLink(`${row.label} · Quay lại từ 2 lần`, row.repeat)}
          <small>{percent(proportion(row.repeat.length, row.items.length))}</small></span> : "—" },
        { label: "Lượt TB mỗi xe", numeric: true, cell: (row) => row.applies && row.items.length ? decimal(row.items.reduce((n, item) => n + item.rows.length, 0) / row.items.length, 2) : "—" },
        { label: "Khách quen", numeric: true, cell: (row) => row.applies ? <span className="behavior-cell-pair">{vehicleLink(`${row.label} · Khách quen`, row.familiar)}
          <small>{percent(proportion(row.familiar.length, row.items.length))}</small></span> : "—" },
      ]} />
    </BehaviorPanel>
    <BehaviorPanel title="Phân bố theo số lần đến trong kỳ">
      <ParkingTable rows={visitRows} rowKey={({ label }) => label} columns={[
        { label: "Số lần đến", cell: ({ label }) => label },
        ...[...types.filter((type) => type !== "Xe đạp"), total].flatMap((type): TableColumn<typeof visitRows[number]>[] => [
          { label: `${type} · Số xe`, numeric: true, cell: ({ label, items }) => vehicleLink(`${type} · ${label}`, items.filter(({ vehicle }) => type === total || type === vehicle)) },
          { label: `${type} · Số lượt`, numeric: true, cell: ({ label, items }) => fmt(items.filter(({ vehicle }) => type === total || type === vehicle)
            .reduce((n, item) => n + item.rows.length, 0)) },
        ]),
      ]} />
    </BehaviorPanel>
  </>
}

