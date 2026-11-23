import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import type { ReactNode } from "react"
import ColumnSettingsDrawer, { readColumnSelection } from "./ColumnSettingsDrawer"
import {
  ArrowLeft,
  Camera,
  History,
  Moon,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react"
import {
  Badge,
  Button,
  Field,
  Heading,
  Input,
  Overlay,
  Select,
} from "./ui"
import { date, estates, fmt } from "./data"
import {
  alertTabs,
  canExport,
  clearTripLookup,
  dayAt,
  dayMinutes,
  dayStart,
  daysIn,
  dayTypes,
  deficit,
  displayTime,
  drillTrips,
  durationGroups,
  durationHours,
  exceededHoursBySite,
  goLive,
  hasLookupHours,
  isLocked,
  nightsFor,
  normalizeTripSearch,
  overCapacityTripAlert,
  parkedDuringExceededHour,
  parkingGroups,
  searchTrips,
  siteById,
  statusAt,
  touches,
  tripAlerts,
  tripAlertLabel,
  tripAlertOptions,
  tripLookupDrill,
  tripLookupKeys,
  tripLookupMode,
  tripLookupModes,
  tripLookupTimeError,
  tripLookupWindow,
  vnNow,
} from "./parking-model"
import type {
  Adjustment,
  ParkingAccess,
  ParkingFilters,
  ParkingReportData,
  ParkingSettings,
  Trip,
  TripDrill,
} from "./parking-model"
import {
  allOption,
  excelDate,
  ExportButton,
  NoMatches,
  numberText,
  pageNumber,
  pageSize,
  ParkingHeading,
  ParkingPagination,
  ParkingSearch,
  ParkingTable,
  TextLink,
} from "./parking-ui"
import type {
  ExportParking,
  ExportRow,
  TableColumn,
  UpdateParams,
} from "./parking-ui"
import { adjustmentExport, tripExport } from "./parking-export"
import CardLookupMultiFilter from "./CardLookupMultiFilter"
import { tripLookupOptionKeys, tripLookupScopeKeys, tripLookupValue, tripLookupValues, tripMatchesLookup, tripMatchesScope, tripLookupScope } from "./parking-lookup"

export const tripLabel = (trip: Trip) => trip.plate || trip.id
const money = (value: number | null) =>
  value === null ? "—" : `${fmt(value)} đ`
const estateLabel = (trip: Trip) =>
  estates.find((estate) => estate.id === siteById(trip.site)?.estate)?.name ??
  "—"
const tripSearchPlaceholder = "Tìm biển số, mã thẻ, mã vé"
const advancedKeys = [
  "state",
  "alert",
  "group",
  "lane",
  "night",
  "adjustment",
] as const
const baseColumns = [
  "Biển số",
  "Bãi xe",
  "Loại xe",
  "Mã thẻ / vé",
  "Nhóm khách",
  "Vào",
  "Ra",
  "Thời gian đỗ",
  "Trạng thái",
  "Cảnh báo",
]
const extraColumns = [
  "Khu đô thị",
  "Làn vào",
  "Làn ra",
  "Nguồn vào",
  "Nguồn ra",
  "Số đêm",
  "Chính sách",
  "Phải thu",
  "Voucher",
  "Thực thu",
  "Chủ xe",
  "Số điện thoại",
]
type TripRow = {
  trip: Trip
  night?: string
  index?: number
  afterLock?: boolean
}
const clearAdvanced = Object.fromEntries(advancedKeys.map((key) => [key, null]))
const columnsKey = "vparking:parking:trip-columns"
const tripColumnNames = Object.fromEntries([...baseColumns, ...extraColumns].map((label) => [label, label]))
export function readTripLookupParams(params: URLSearchParams) {
  const values = new URLSearchParams()
  for (const key of ["q", ...tripLookupScopeKeys, ...advancedKeys, ...tripLookupKeys]) {
    for (const value of params.getAll(key)) if (value) values.append(key, value)
  }
  for (const key of tripLookupOptionKeys) {
    const value = tripLookupValue(tripLookupValues(values, key))
    if (value) values.set(key, value)
    else values.delete(key)
  }
  return values
}
export function tripLookupFilterError(params: URLSearchParams, filters: ParkingFilters) {
  const query = params.get("q")?.trim() ?? ""
  if (query && normalizeTripSearch(query).length < 3) return "Nhập ít nhất 3 chữ hoặc số để tìm lượt xe."
  return tripLookupTimeError(params, filters)
}
function readColumns(actor: string) {
  return readColumnSelection(`${columnsKey}:${actor}`)
    ?.filter((key) => Object.prototype.hasOwnProperty.call(tripColumnNames, key)) ?? null
}
export function parseDrill(param: string | null): TripDrill | null {
  if (!param) return null
  try {
    const value = JSON.parse(param) as TripDrill
    if (
      !Object.prototype.hasOwnProperty.call(tripLookupModes, value.metric) ||
      typeof value.label !== "string" ||
      !Number.isFinite(value.start) ||
      !Number.isFinite(value.end) ||
      value.end <= value.start ||
      value.end - value.start > 32 * dayMinutes ||
      Math.abs(value.end) > 1e9 ||
      Math.abs(value.start) > 1e9 ||
      (value.sites && !Array.isArray(value.sites)) ||
      (value.days && !Array.isArray(value.days))
    )
      return null
    return value
  } catch {
    return null
  }
}
export function TripLookupFields({ params, update, data }: { params: URLSearchParams; update: UpdateParams; data: ParkingReportData | null }) {
  const mode = tripLookupMode(params)
  const metric = params.get("reportMetric") || mode
  const contextLabels: Record<string, string> = {
    incoming: "Xe vào bãi trong khoảng ngày đã chọn",
    outgoing: "Xe ra khỏi bãi trong khoảng ngày đã chọn",
    opening: "Xe có mặt tại thời điểm đầu kỳ",
    closing: "Xe có mặt tại thời điểm chốt",
    parked: "Lượt xe dùng tính tỷ lệ lấp đầy",
    planned: "Lượt xe dùng tính tỷ lệ đạt kế hoạch",
    nightly: "Lượt qua đêm · khung giờ 02:00–05:00",
    unusual: "Xe vãng lai đỗ vượt ngưỡng cảnh báo",
    duration: "Xe đã ra dùng tính thời gian đỗ",
    issue: "Lượt xe cần kiểm tra tại làn",
    deficit: "Xe ra chưa thu đủ phí",
    exceeded: "Xe có mặt khi bãi vượt sức chứa",
  }
  const context = (metric && contextLabels[metric]) || (params.get("night") === "1" ? "Xe có qua đêm" : "")
  const bucket = Number(params.get("durationGroup"))
  const details = [
    ...(hasLookupHours(mode) ? [
      mode !== "closing" ? `Từ ${params.get("hourStart") || "00:00"} ngày đầu kỳ` : "",
      mode !== "opening" ? (params.get("hourEnd") ? `Đến ${params.get("hourEnd")} ngày cuối kỳ` : "Đến hết ngày cuối kỳ") : "",
    ] : []),
    dayTypes.find((day) => day === params.get("dayKind")) || "",
    Number.isInteger(bucket) && bucket >= 1 && bucket <= durationGroups.length && (mode === "outgoing" || mode === "duration")
      ? durationGroups[bucket - 1] : "",
    mode === "nightly" ? "Mỗi dòng là một xe trong một đêm; một xe có thể có nhiều dòng." : "",
  ].filter(Boolean)
  const lanes = [...new Set([
    "Làn vào 1", "Làn vào 2", "Làn ra 1", "Làn ra 2", ...tripLookupValues(params, "lane"),
    ...(data?.periodTrips.flatMap((trip) => [trip.laneIn, trip.laneOut]) ?? []),
  ].filter(Boolean))].sort()
  return <>
    <div className="filter-grid parking-lookup-grid">
      <Field label="Biển số / thẻ / vé">
        <Input type="search" aria-label="Biển số / thẻ / vé" placeholder={tripSearchPlaceholder} maxLength={100}
          value={params.get("q") ?? ""} onChange={(e) => update({ q: e.target.value || null })} />
      </Field>
      {([
        ["state", "Trạng thái lượt xe", "Tất cả trạng thái", [
          { value: "missing-exit", label: "Chưa ghi nhận giờ ra" },
          { value: "Đang trong bãi", label: "Đang trong bãi tại mốc tra cứu" },
          { value: "Đã ra", label: "Đã ra tại mốc tra cứu" },
        ]],
        ["group", "Nhóm khách hàng", "Tất cả nhóm khách hàng", [...parkingGroups]],
        ["lane", "Làn xe", "Tất cả làn", lanes],
        ["alert", "Cảnh báo", "Tất cả cảnh báo", [...tripAlertOptions,
          ...(tripLookupValues(params, "alert").includes(overCapacityTripAlert.value) ? [{ value: overCapacityTripAlert.value, label: tripAlertLabel(overCapacityTripAlert.value) }] : [])]],
      ] as const).map(([key, label, all, options]) => (
        <CardLookupMultiFilter key={key} label={label} allLabel={all} value={tripLookupValues(params, key)}
          options={options.map((option) => typeof option === "string" ? { value: option, label: option } : option)}
          onChange={(values) => update({ [key]: tripLookupValue(values) })}
          note={key === "state" && tripLookupValues(params, key).includes("missing-exit")
            ? "Chưa ghi nhận giờ ra: lượt đã vào và hiện chưa có giờ ra. Nếu chọn thêm trạng thái, kết quả gồm cả các trạng thái đã chọn."
            : key === "alert" ? "Khớp ít nhất một cảnh báo đã chọn. Bỏ chọn hết để không giới hạn cảnh báo." : undefined} />
      ))}
    </div>
    {context || params.get("adjustment") === "1" ? <div className="parking-lookup-context" role="status">
      <div>
        <strong>Đang xem: {params.get("adjustment") === "1" ? "Bản cập nhật sau khi chốt số liệu" : context}</strong>
        {!!details.length && <p>{details.join(" · ")}</p>}
      </div>
      <Button variant="link" onClick={() => update({ ...clearTripLookup, night: null, adjustment: null,
        ...(params.has("reportMetric") ? { state: null, alert: null, group: null } : {}),
      })}>Bỏ điều kiện đối chiếu</Button>
    </div> : <p className="lookup-time-hint">Tra cứu các xe có mặt trong bãi trong khoảng thời gian đã chọn, kể cả xe vào từ trước.</p>}
  </>
}
interface TripProps {
  data: ParkingReportData
  settings: ParkingSettings
  filters: ParkingFilters
  params: URLSearchParams
  update: UpdateParams
  access: ParkingAccess
  exportFile: ExportParking
  changes: Adjustment[]
  openTrip: (id: string) => void
}
export function ParkingTripList({
  data,
  settings,
  filters,
  params,
  update,
  access,
  exportFile,
  changes,
  openTrip,
  revenueActions,
  headingActions,
}: TripProps & { revenueActions?: ReactNode; headingActions: HTMLDivElement | null }) {
  const [showColumns, setShowColumns] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const defaultColumns = [...baseColumns]
  if (new Set(data.bySite.map((site) => site.estate)).size > 1)
    defaultColumns.splice(1, 0, "Khu đô thị")
  const actor = `${access.role}/${access.estate}`
  const [savedColumns, setSavedColumns] = useState(() => readColumns(actor))
  const shownColumns = savedColumns ?? defaultColumns
  useEffect(() => setSavedColumns(readColumns(actor)), [actor])
  const drill = tripLookupDrill(params, filters, data)
  const lookupWindow = tripLookupWindow(params, filters)
  const q = params.get("q")?.slice(0, 100) ?? ""
  const end = drill?.metric === "opening" ? drill.start : lookupWindow.end
  const adjustmentOnly = params.get("adjustment") === "1"
  const now = vnNow()
  const exceededHours = useMemo(() => exceededHoursBySite(data.total.exceeded), [data.total.exceeded])
  const alertLabels = (trip: Trip) => {
    const labels = tripAlerts(trip, filters, settings)
    if (parkedDuringExceededHour(trip, exceededHours)) labels.push(overCapacityTripAlert.label)
    return labels.map(tripAlertLabel)
  }
  const matches = (trip: Trip) =>
    searchTrips(trip, q) &&
    tripMatchesLookup(trip, params, end, filters, settings, exceededHours, now) &&
    (params.get("night") !== "1" || nightsFor(trip, data.days).length > 0)
  const uniqueChanges = [
    ...new Map(changes.map((change) => [change.trip.id, change.trip])).values(),
  ]
  const historyChanges = changes.filter(({ trip }) => matches(trip) &&
    (!(params.get("hourStart") || params.get("hourEnd")) || touches(trip, lookupWindow.start, lookupWindow.end)))
  const filteredSites = (trip: Trip) => tripMatchesScope(trip, tripLookupScope(params))
  const scopedTrips = drill
    ? data.bySite.flatMap((site) => site.trips)
    : data.periodTrips
  const matchingTrips = (adjustmentOnly ? uniqueChanges.filter(filteredSites) : scopedTrips)
    .filter(matches)
    .filter((trip) => drill || touches(trip, lookupWindow.start, lookupWindow.end))
  const filtered: TripRow[] = (drill
    ? drillTrips(matchingTrips, drill, settings, data.total.exceeded)
    : matchingTrips.map((trip) => ({ trip }))).map((row) => ({ ...row, afterLock: adjustmentOnly }))
  const sort = params.get("sort") || "new"
  filtered.sort((a, b) =>
    sort === "old"
      ? a.trip.entered - b.trip.entered
      : sort === "plate" || sort === "plate-desc"
        ? tripLabel(a.trip).localeCompare(tripLabel(b.trip), "vi", {
            numeric: true,
          }) * (sort === "plate-desc" ? -1 : 1)
        : b.trip.entered - a.trip.entered,
  )
  const size = pageSize(params.get("size")),
    page = pageNumber(params.get("page"), filtered.length, size)
  const rowList = filtered
    .slice((page - 1) * size, page * size)
    .map((row, index) => ({ ...row, index: (page - 1) * size + index + 1 }))
  const tableColumns: Record<string, TableColumn<TripRow>["cell"]> = {
    "Biển số": ({ trip }) => (
      <TextLink onClick={() => openTrip(trip.id)}>{tripLabel(trip)}</TextLink>
    ),
    "Khu đô thị": ({ trip }) => estateLabel(trip),
    "Bãi xe": ({ trip }) => siteById(trip.site)?.name,
    "Loại xe": ({ trip }) => trip.vehicle,
    "Mã thẻ / vé": ({ trip }) => trip.ticket,
    "Nhóm khách": ({ trip }) => trip.group,
    Vào: ({ trip }) => displayTime(trip.entered),
    Ra: ({ trip }) => <>
      {displayTime(trip.exited)}
      {trip.exited != null && trip.exited >= end && <span className="parking-trip-reference">Ra sau mốc tra cứu</span>}
    </>,
    "Thời gian đỗ": ({ trip }) =>
      `${numberText(durationHours(trip, end), 2)} giờ`,
    "Trạng thái": ({ trip }) => (
      <Badge tone={statusAt(trip, end) === "Đã ra" ? "green" : "blue"}>
        {statusAt(trip, end)}
      </Badge>
    ),
    "Cảnh báo": ({ trip, afterLock }) =>
      [
        ...alertLabels(trip),
        ...(afterLock ? ["Sau khóa"] : []),
      ].join(" · ") || "—",
    "Làn vào": ({ trip }) => trip.laneIn,
    "Làn ra": ({ trip }) => trip.exited != null ? trip.laneOut : "—",
    "Nguồn vào": ({ trip }) => trip.sourceIn,
    "Nguồn ra": ({ trip }) => trip.exited != null ? trip.sourceOut : "—",
    "Số đêm": ({ trip }) => fmt(nightsFor(trip, data.days).length),
    "Chính sách": ({ trip }) => trip.policy ?? "—",
    "Phải thu": ({ trip }) => money(trip.due),
    Voucher: ({ trip }) => money(trip.voucher),
    "Thực thu": ({ trip }) => money(trip.paid),
    "Chủ xe": ({ trip }) => trip.owner,
    "Số điện thoại": ({ trip }) => trip.phone,
  }
  const reset = () =>
    update({ ...clearAdvanced, ...clearTripLookup, estate: null, site: null, q: null, drill: null, page: null })
  const exportRows = () =>
    exportFile(
      "TraCuuLuotXe",
      () => ({
        "Lượt xe": filtered.map(({ trip, night, afterLock }) => ({
          ...tripExport(trip, filters, settings, data.days, night, end, true),
          "Cảnh báo": alertLabels(trip).join(", "),
          "Sau khóa": afterLock ? "Có" : "",
        })),
        ...(changes.length
          ? {
              "Điều chỉnh sau khóa": adjustmentExport(
                changes.filter((change) =>
                  filtered.some(({ trip }) => trip.id === change.trip.id),
                ),
              ),
            }
          : {}),
      }),
      filtered.length,
    )
  return (
    <>
      {headingActions && createPortal(<>
        {revenueActions}
        {canExport(access) && <ExportButton onClick={exportRows} />}
      </>, headingActions)}
      <div className="panel">
        <div className="op-table-toolbar lookup-table-toolbar">
          <div className="lookup-result-summary">
            <span className="count-text" aria-live="polite">
              <strong>{fmt(filtered.length)}</strong> {drill?.metric === "nightly" ? "lượt qua đêm" : "lượt xe"}
            </span>
          </div>
          <div className="parking-inline">
            <Button aria-pressed={drill?.metric === "nightly"} onClick={() => update({
              ...clearTripLookup, tripMode: drill?.metric === "nightly" ? null : "nightly",
              night: null, adjustment: null, page: null,
            })}><Moon size={15} /> Lượt qua đêm</Button>
            <Button onClick={() => setShowHistory(true)}>
              <History size={15} /> Lịch sử cập nhật{historyChanges.length ? ` (${fmt(historyChanges.length)})` : ""}
            </Button>
            <Button onClick={() => setShowColumns(true)}>
              <SlidersHorizontal size={15} /> Tùy chỉnh cột
            </Button>
          </div>
        </div>
        {adjustmentOnly && (
          <div className="parking-inline parking-list-chips">
            <Badge tone="amber">Điều chỉnh sau khóa</Badge>
          </div>
        )}
        <p className="parking-history-note">Trạng thái và thời gian đỗ tính đến hết {displayTime(end - 1)}. Cột Ra hiển thị giờ ra đã ghi nhận, kể cả khi ra sau mốc tra cứu; “—” nghĩa là chưa ghi nhận giờ ra.</p>
        <ParkingTable
          rows={rowList}
          rowKey={({ trip, night }) => `${trip.id}/${night ?? ""}`}
          empty={
            filters.end < goLive ? (
              `Chưa có dữ liệu trước ngày ${date(goLive)}.`
            ) : (
              <NoMatches clear={reset} />
            )
          }
          columns={[
            { label: "STT", numeric: true, cell: (row) => row.index },
            ...shownColumns
              .filter((label) => tableColumns[label])
              .map((label): TableColumn<TripRow> => ({ label: label === "Trạng thái" ? "Trạng thái tại mốc tra cứu" : label, cell: tableColumns[label],
                ...(label === "Vào" ? { sort: {
                  direction: sort === "old" ? "ascending" : sort === "new" ? "descending" : undefined,
                  change: () => update({ sort: sort === "old" ? null : "old", page: null }),
                } } : label === "Biển số" ? { sort: {
                  direction: sort === "plate" ? "ascending" : sort === "plate-desc" ? "descending" : undefined,
                  change: () => update({ sort: sort === "plate" ? "plate-desc" : "plate", page: null }),
                } } : {}),
              })),
            ...(drill?.metric === "nightly"
              ? [
                  {
                    label: "Đêm",
                    cell: ({ night }: TripRow) => date(night ?? ""),
                  },
                ]
              : []),
            ...(!shownColumns.includes("Biển số")
              ? [
                  {
                    label: "Chi tiết",
                    cell: ({ trip }: TripRow) => (
                      <TextLink onClick={() => openTrip(trip.id)}>
                        Xem lượt
                      </TextLink>
                    ),
                  },
                ]
              : []),
          ]}
        />
        <ParkingPagination
          count={filtered.length}
          page={page}
          size={size}
          change={(next) => update({ page: String(next) })}
          changeSize={(next) => update({ size: String(next), page: null })}
        />
      </div>
      {showHistory && <Overlay title="Lịch sử cập nhật sau khi chốt" wide
        subtitle="Các bổ sung hoặc sửa thông tin lượt xe sau khi kỳ báo cáo đã khóa. Số liệu đã chốt được giữ nguyên."
        onClose={() => setShowHistory(false)} footer={<>
          {canExport(access) && <ExportButton onClick={() => exportFile("LichSuCapNhatLuotXe",
            () => ({ "Lịch sử cập nhật": adjustmentExport(historyChanges) }), historyChanges.length)} />}
          <Button onClick={() => setShowHistory(false)}>Đóng</Button>
        </>}>
        <p className="parking-history-note">Theo địa điểm, phương tiện, bộ lọc và ngày phát sinh lượt xe đang chọn.</p>
        <ParkingTable rows={historyChanges} rowKey={(row) => `${row.trip.id}/${row.day}/${row.at}/${row.title}`}
          empty="Không có cập nhật sau chốt phù hợp với bộ lọc."
          columns={[
            { label: "Lượt xe", cell: ({ trip }) => <TextLink onClick={() => { setShowHistory(false); openTrip(trip.id) }}>{tripLabel(trip)}</TextLink> },
            { label: "Ngày phát sinh lượt xe", cell: (row) => date(row.day) },
            { label: "Thời điểm cập nhật", cell: (row) => displayTime(row.at) },
            { label: "Người cập nhật", cell: (row) => row.actor },
            { label: "Nội dung", cell: (row) => row.title },
          ]} />
      </Overlay>}
      {showColumns && (
        <ColumnSettingsDrawer
          key={actor}
          columns={tripColumnNames}
          selected={shownColumns}
          defaults={defaultColumns}
          onClose={() => setShowColumns(false)}
          onSave={(selection) => {
            setSavedColumns(selection)
            try { localStorage.setItem(`${columnsKey}:${actor}`, JSON.stringify(selection)) } catch {}
            setShowColumns(false)
          }}
        />
      )}
    </>
  )
}

type AlertRow = {
  id: string
  trip?: Trip
  site: string
  day?: string
  design?: number
  peak?: number
  hours?: number
}
export function ParkingAlerts({
  data,
  settings,
  filters,
  params,
  update,
  access,
  exportFile,
  openTrip,
  showFlow,
  drill,
}: TripProps & {
  showFlow: (site: string, day: string) => void
  drill: (drill: TripDrill) => void
}) {
  const q = params.get("q")?.slice(0, 100) ?? ""
  const tab = Math.min(
    3,
    Math.max(0, Math.floor(Number(params.get("tab")) || 0)),
  )
  const end = dayStart(filters.end) + dayMinutes
  const options = useMemo<AlertRow[][]>(() => {
    const over = data.total.exceeded
      .filter(
        (row) =>
          !q ||
          data.bySite
            .find((site) => site.id === row.site)
            ?.trips.some(
              (trip) =>
                searchTrips(trip, q) &&
                touches(
                  trip,
                  dayStart(row.day),
                  dayStart(row.day) + dayMinutes,
                ),
            ),
      )
      .map((row) => ({
        id: `${row.site}/${row.day}`,
        site: row.site,
        day: row.day,
        design: row.capacity?.design,
        peak: row.peak.closing,
        hours: row.exceeded,
      }))
      .sort((a, b) => b.day.localeCompare(a.day))
    const trips = data.periodTrips
      .filter((trip) => searchTrips(trip, q))
      .map((trip) => ({
        trip,
        flags: tripAlerts(trip, filters, settings),
      }))
    const rows = (index: number, sort: (a: Trip, b: Trip) => number) =>
      trips
        .filter(({ flags }) => flags.includes(alertTabs[index]))
        .map(({ trip }) => ({ id: trip.id, site: trip.site, trip }))
        .sort((a, b) => sort(a.trip, b.trip))
    return [
      over,
      rows(1, (a, b) => a.entered - b.entered),
      rows(2, (a, b) => deficit(b) - deficit(a)),
      rows(3, (a, b) => b.issue!.at - a.issue!.at),
    ]
  }, [data, filters, settings, q])
  const rows = options[tab]
  const size = pageSize(params.get("size")),
    page = pageNumber(params.get("page"), rows.length, size)
  const columns: TableColumn<AlertRow>[][] = [
    [
      {
        label: "Ngày",
        cell: (row) => (
          <TextLink onClick={() => showFlow(row.site, row.day!)}>
            {date(row.day!)}
          </TextLink>
        ),
      },
      { label: "Bãi xe", cell: (row) => siteById(row.site)?.label },
      { label: "Loại xe", cell: () => filters.vehicle },
      {
        label: "Chỗ quy hoạch",
        numeric: true,
        cell: (row) => fmt(row.design!),
      },
      {
        label: "Tồn cao nhất",
        numeric: true,
        cell: (row) => {
          const peak = data.bySite
            .find((site) => site.id === row.site)
            ?.daily.find((day) => day.day === row.day)?.peak
          return peak ? (
            <TextLink
              onClick={() =>
                drill({
                  metric: "closing",
                  label: alertTabs[0],
                  start: peak.start,
                  end: peak.end,
                  sites: [row.site],
                })
              }
            >
              ▲ {fmt(row.peak!)}
            </TextLink>
          ) : (
            "—"
          )
        },
      },
      {
        label: "Số xe vượt",
        numeric: true,
        cell: (row) => fmt(row.peak! - row.design!),
      },
      {
        label: "Số khung vượt",
        numeric: true,
        cell: (row) => (
          <TextLink onClick={() => showFlow(row.site, row.day!)}>
            {fmt(row.hours!)}
          </TextLink>
        ),
      },
    ],
    [
      {
        label: "Biển số",
        cell: ({ trip }) => (
          <TextLink onClick={() => openTrip(trip!.id)}>
            {tripLabel(trip!)}
          </TextLink>
        ),
      },
      { label: "Bãi xe", cell: (row) => siteById(row.site)?.label },
      { label: "Loại xe", cell: ({ trip }) => trip!.vehicle },
      { label: "Nhóm khách", cell: ({ trip }) => trip!.group },
      { label: "Vào lúc", cell: ({ trip }) => displayTime(trip!.entered) },
      {
        label: "Đã đỗ (giờ)",
        numeric: true,
        cell: ({ trip }) => numberText(durationHours(trip!, end), 2),
      },
    ],
    [
      {
        label: "Biển số",
        cell: ({ trip }) => (
          <TextLink onClick={() => openTrip(trip!.id)}>
            {tripLabel(trip!)}
          </TextLink>
        ),
      },
      { label: "Bãi xe", cell: (row) => siteById(row.site)?.label },
      { label: "Ra lúc", cell: ({ trip }) => displayTime(trip!.exited) },
      { label: "Làn ra", cell: ({ trip }) => trip!.laneOut },
      {
        label: "Phải thu",
        numeric: true,
        cell: ({ trip }) => money(trip!.due! - trip!.voucher),
      },
      {
        label: "Thực thu",
        numeric: true,
        cell: ({ trip }) => money(trip!.paid),
      },
      {
        label: "Thiếu",
        numeric: true,
        cell: ({ trip }) => money(deficit(trip!)),
      },
    ],
    [
      { label: "Thời điểm", cell: ({ trip }) => displayTime(trip!.issue!.at) },
      { label: "Bãi xe", cell: (row) => siteById(row.site)?.label },
      { label: "Làn", cell: ({ trip }) => trip!.issue!.lane },
      {
        label: "Biển số / mã thẻ / vé",
        cell: ({ trip }) => (
          <TextLink onClick={() => openTrip(trip!.id)}>
            {trip!.plate || trip!.ticket}
          </TextLink>
        ),
      },
      {
        label: "Loại bất thường",
        cell: ({ trip }) => <Badge tone="amber">{trip!.issue!.kind}</Badge>,
      },
      { label: "Diễn giải", cell: ({ trip }) => trip!.issue!.note },
    ],
  ]
  const exportRows = () =>
    exportFile(
      "CanhBaoXeRaVao",
      () => {
        const sheets: Record<string, ExportRow[]> = Object.fromEntries(
          options.map((items, index) => [
            alertTabs[index],
            items.map((row) => {
              const trip = row.trip
              if (!trip)
                return {
                  Ngày: excelDate(dayStart(row.day!)),
                  "Bãi xe": siteById(row.site)?.label,
                  "Loại xe": filters.vehicle,
                  "Chỗ quy hoạch": row.design,
                  "Tồn cao nhất": row.peak,
                  "Số xe vượt": row.peak! - row.design!,
                  "Số khung vượt": row.hours,
                }
              const common = {
                "Biển số": trip.plate,
                "Bãi xe": siteById(row.site)?.label,
                "Mã lượt": trip.id,
              }
              if (index === 1)
                return {
                  ...common,
                  "Loại xe": trip.vehicle,
                  "Nhóm khách": trip.group,
                  "Vào lúc": excelDate(trip.entered),
                  "Đã đỗ (giờ)": durationHours(trip, end),
                }
              if (index === 2)
                return {
                  ...common,
                  "Ra lúc": excelDate(trip.exited),
                  "Làn ra": trip.laneOut,
                  "Phải thu": trip.due! - trip.voucher,
                  "Thực thu": trip.paid,
                  Thiếu: deficit(trip),
                }
              return {
                ...common,
                "Thời điểm": excelDate(trip.issue!.at),
                Làn: trip.issue!.lane,
                "Mã thẻ / vé": trip.ticket,
                "Loại bất thường": trip.issue!.kind,
                "Diễn giải": trip.issue!.note,
              }
            }),
          ]),
        )
        sheets["Tổng hợp"] = [
          {
            "Tổng số lượt có cảnh báo": new Set(
              options
                .slice(1)
                .flat()
                .map((row) => row.id),
            ).size,
          },
        ]
        return sheets
      },
      options.reduce((count, items) => count + items.length, 0),
    )
  return (
    <div className="panel">
      <div className="parking-toolbar">
        <ParkingSearch
          value={q}
          change={(value) => update({ q: value, page: null })}
          placeholder={tripSearchPlaceholder}
          minLength={3}
        />
        {canExport(access) && <ExportButton onClick={exportRows} />}
      </div>
      <div className="parking-tabs" role="tablist">
        {alertTabs.map((label, index) => (
          <Button
            variant="ghost"
            role="tab"
            aria-selected={tab === index}
            onClick={() => update({ tab: String(index), page: null })}
            key={label}
          >
            {label}{" "}
            <span className="tab-counter">{fmt(options[index].length)}</span>
          </Button>
        ))}
      </div>
      <ParkingTable
        rows={rows.slice((page - 1) * size, page * size)}
        rowKey={(row) => row.id}
        columns={columns[tab]}
        empty={
          q ? (
            <NoMatches clear={() => update({ q: null })} />
          ) : filters.end < goLive ? (
            `Chưa có dữ liệu trước ngày ${date(goLive)}.`
          ) : (
            "Chưa có cảnh báo trong kỳ"
          )
        }
      />
      <ParkingPagination
        count={rows.length}
        page={page}
        size={size}
        change={(next) => update({ page: String(next) })}
        changeSize={(next) => update({ size: String(next), page: null })}
      />
    </div>
  )
}

export function ParkingTripDetail({
  trip,
  settings,
  filters,
  cutoff,
  changes,
  back,
  exportFile,
  access,
  revenueActions,
}: {
  trip: Trip
  settings: ParkingSettings
  filters: ParkingFilters
  cutoff: string
  changes: Adjustment[]
  back: () => void
  exportFile: ExportParking
  access: ParkingAccess
  revenueActions?: React.ReactNode
}) {
  const end = dayStart(filters.end) + dayMinutes
  const closed = trip.exited != null
  const days = daysIn(dayAt(trip.entered), filters.end)
  const flags = tripAlerts(trip, filters, settings).map(tripAlertLabel)
  const actions = [
    ...(trip.actions ?? []),
    ...changes
      .filter(
        (change) => !trip.actions?.some((action) => action.at === change.at),
      )
      .map((change) => ({
        at: change.at,
        actor: change.actor,
        title: change.title,
        reason: `Ngày bị ảnh hưởng ${date(change.day)}`,
        afterLock: true,
      })),
  ].sort((a, b) => b.at - a.at)
  return (
    <>
      <ParkingHeading
        title={`Chi tiết lượt xe · ${tripLabel(trip)}`}
        group="Quản lý chỗ đỗ / Tra cứu lượt xe"
        cutoff={cutoff}
        actions={
          <>
            <Button onClick={back}>
              <ArrowLeft size={15} /> Quay lại
            </Button>
            {revenueActions}
            {canExport(access) && (
              <ExportButton
                onClick={() =>
                  exportFile(
                    "ChiTietLuotXe",
                    () => ({
                      "Lượt xe": [tripExport(trip, filters, settings, days, undefined, end, true)],
                      "Điều chỉnh sau khóa": adjustmentExport(changes),
                    }),
                    1,
                  )
                }
              />
            )}
          </>
        }
      />
      {(flags.length > 0 || changes.length > 0) && (
        <div className="parking-banner warning">
          <TriangleAlert size={17} />
          {[
            ...flags,
            ...(changes.length ? ["Có điều chỉnh sau khóa"] : []),
          ].join(" · ")}
        </div>
      )}
      <section className="panel parking-detail-panel">
        <Heading>Thông tin lượt</Heading>
        <p className="parking-history-note">Trạng thái và thời gian đỗ tính đến hết {displayTime(end - 1)}. Thông tin lần ra là thông tin đã ghi nhận của lượt xe{trip.exited != null && trip.exited >= end ? "; xe đã ra sau mốc tra cứu" : ""}.</p>
        <dl className="parking-detail-grid">
          {[
            ["Trạng thái tại mốc tra cứu", statusAt(trip, end)],
            ["Khu đô thị", estateLabel(trip)],
            ["Bãi xe", siteById(trip.site)?.name],
            ["Loại xe", trip.vehicle],
            ["Mã thẻ / vé", trip.ticket],
            ["Nhóm khách", trip.group],
            ["Chủ xe", trip.owner],
            ["Số điện thoại", trip.phone],
            ["Thời gian đỗ", `${numberText(durationHours(trip, end), 2)} giờ`],
            ["Qua đêm", `${nightsFor(trip, days).length} đêm`],
            [
              "Phải thu",
              `${money(trip.due)}${
                closed || trip.due === null ? "" : " (tạm tính)"
              }`,
            ],
            ["Voucher", money(trip.voucher)],
            ["Thực thu", money(closed ? trip.paid : null)],
            ...(closed && trip.supplementalExit ? [
              ["Số biên bản", trip.supplementalExit.reference],
              ["Phương thức thanh toán", trip.supplementalExit.method],
            ] : []),
            ["Chính sách", trip.policy],
            [
              "Số liệu ngày vào",
              isLocked(dayAt(trip.entered)) ? "Đã khóa" : "Chưa khóa",
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="parking-detail-pair">
        {([
          [
            "Lần vào",
            trip.entered,
            trip.laneIn,
            trip.sourceIn,
            trip.cameraIn,
            trip.photoIn,
          ],
          [
            "Lần ra",
            closed ? trip.exited : null,
            trip.laneOut,
            trip.sourceOut,
            trip.cameraOut,
            trip.photoOut,
          ],
        ] as const).map(([label, at, lane, source, camera, photo]) => (
          <section className="panel parking-detail-panel" key={label}>
            <Heading>{label}</Heading>
            <dl className="parking-detail-grid">
              {[
                ["Thời điểm", displayTime(at)],
                ["Bãi xe", at === null ? "—" : siteById(trip.site)?.label],
                ["Làn", at === null ? "—" : lane],
                ["Nguồn ghi nhận", at === null ? "—" : source],
                ["Biển camera đọc", at === null ? "—" : camera || "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {at !== null && photo ? (
              <img
                className="parking-lane-photo"
                src={photo}
                alt={`Ảnh tại ${lane}`}
              />
            ) : (
              <div className="parking-photo-placeholder">
                <Camera size={18} />
                {at === null
                  ? "Chưa ghi nhận giờ ra"
                  : "Chưa có ảnh tại làn"}
              </div>
            )}
          </section>
        ))}
      </div>
      <section className="panel parking-detail-panel">
        <Heading>Lịch sử thao tác</Heading>
        <ParkingTable
          rows={actions}
          rowKey={(row) => `${row.at}/${row.title}`}
          empty="Chưa có thao tác bổ sung hoặc điều chỉnh"
          columns={[
            { label: "Thời điểm", cell: (row) => displayTime(row.at) },
            { label: "Người thực hiện", cell: (row) => row.actor },
            {
              label: "Thao tác",
              cell: (row) => (
                <>
                  {row.title}{" "}
                  {row.afterLock && <Badge tone="amber">Sau khóa</Badge>}
                </>
              ),
            },
            { label: "Lý do", cell: (row) => row.reason },
          ]}
        />
      </section>
    </>
  )
}
