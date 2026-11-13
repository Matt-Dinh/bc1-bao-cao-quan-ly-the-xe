import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  Camera,
  ListFilter,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react"
import {
  Badge,
  Button,
  Field,
  Heading,
  Input,
  Label,
  Overlay,
  Select,
} from "./ui"
import { date, estates, fmt } from "./data"
import {
  alertTabs,
  canExport,
  dayAt,
  dayMinutes,
  dayStart,
  daysIn,
  deficit,
  displayTime,
  drillTrips,
  durationHours,
  goLive,
  isLocked,
  nightsFor,
  parkingGroups,
  searchTrips,
  siteById,
  statusAt,
  touches,
  tripAlerts,
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
function readColumns(actor: string) {
  try {
    return JSON.parse(
      localStorage.getItem(`${columnsKey}:${actor}`) ?? "null",
    ) as string[] | null
  } catch {
    return null
  }
}
export function parseDrill(param: string | null): TripDrill | null {
  if (!param) return null
  try {
    const value = JSON.parse(param) as TripDrill
    if (
      ![
        "incoming",
        "outgoing",
        "opening",
        "closing",
        "parked",
        "nightly",
        "unusual",
        "duration",
        "issue",
        "deficit",
      ].includes(value.metric) ||
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
function drillLabel(drill: TripDrill) {
  if (drill.metric === "closing")
    return `Đang trong bãi lúc ${displayTime(drill.end - 1 / 60, true)}`
  if (drill.metric === "opening")
    return `Tồn đầu lúc ${displayTime(drill.start)}`
  if (drill.metric === "duration" || drill.metric === "outgoing")
    return `Ra trong ${date(dayAt(drill.start))} – ${date(dayAt(drill.end - 1))} · ${drill.label}`
  return drill.label
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
}: TripProps) {
  const [drawer, setDrawer] = useState<"filters" | "columns" | null>(null)
  const [draft, setDraft] = useState<Record<string, string | null>>({})
  const defaultColumns = [...baseColumns]
  if (new Set(data.bySite.map((site) => site.estate)).size > 1)
    defaultColumns.splice(1, 0, "Khu đô thị")
  const actor = `${access.role}/${access.estate}`
  const [savedColumns, setSavedColumns] = useState(() => readColumns(actor))
  const [columnDraft, setColumnDraft] = useState<string[]>([])
  const shownColumns = savedColumns ?? defaultColumns
  useEffect(() => setSavedColumns(readColumns(actor)), [actor])
  const drill = parseDrill(params.get("drill"))
  const q = params.get("q")?.slice(0, 100) ?? ""
  const end = dayStart(filters.end) + dayMinutes
  const adjustmentOnly = params.get("adjustment") === "1"
  const laneList = [
    ...new Set(data.periodTrips.flatMap((trip) => [trip.laneIn, trip.laneOut])),
  ].sort()
  const matches = (trip: Trip) =>
    searchTrips(trip, q) &&
    (!params.get("state") || params.get("state") === statusAt(trip, end)) &&
    (!params.get("alert") ||
      tripAlerts(trip, filters, settings).includes(params.get("alert")!)) &&
    (!params.get("group") || params.get("group") === trip.group) &&
    (!params.get("lane") ||
      [trip.laneIn, trip.laneOut].includes(params.get("lane")!)) &&
    (params.get("night") !== "1" || nightsFor(trip, data.days).length > 0)
  const uniqueChanges = [
    ...new Map(changes.map((change) => [change.trip.id, change.trip])).values(),
  ]
  const filteredSites = (trip: Trip) =>
    (!filters.site || filters.site === trip.site) &&
    (!filters.estate || siteById(trip.site)?.estate === filters.estate)
  const scopedTrips = drill
    ? data.bySite.flatMap((site) => site.trips)
    : data.periodTrips
  const filtered: TripRow[] = adjustmentOnly
    ? uniqueChanges
        .filter((trip) => matches(trip) && filteredSites(trip))
        .map((trip) => ({ trip, afterLock: true }))
    : drill
      ? drillTrips(scopedTrips.filter(matches), drill, settings)
      : scopedTrips.filter(matches).map((trip) => ({ trip }))
  const sort = params.get("sort") || "new"
  filtered.sort((a, b) =>
    sort === "old"
      ? a.trip.entered - b.trip.entered
      : sort === "plate"
        ? tripLabel(a.trip).localeCompare(tripLabel(b.trip), "vi", {
            numeric: true,
          })
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
    Ra: ({ trip }) =>
      displayTime(statusAt(trip, end) === "Đã ra" ? trip.exited : null),
    "Thời gian đỗ": ({ trip }) =>
      `${numberText(durationHours(trip, end), 2)} giờ`,
    "Trạng thái": ({ trip }) => (
      <Badge tone={statusAt(trip, end) === "Đã ra" ? "green" : "blue"}>
        {statusAt(trip, end)}
      </Badge>
    ),
    "Cảnh báo": ({ trip, afterLock }) =>
      [
        ...tripAlerts(trip, filters, settings),
        ...(afterLock ? ["Sau khóa"] : []),
      ].join(" · ") || "—",
    "Làn vào": ({ trip }) => trip.laneIn,
    "Làn ra": ({ trip }) =>
      statusAt(trip, end) === "Đã ra" ? trip.laneOut : "—",
    "Nguồn vào": ({ trip }) => trip.sourceIn,
    "Nguồn ra": ({ trip }) =>
      statusAt(trip, end) === "Đã ra" ? trip.sourceOut : "—",
    "Số đêm": ({ trip }) => fmt(nightsFor(trip, data.days).length),
    "Chính sách": ({ trip }) => trip.policy ?? "—",
    "Phải thu": ({ trip }) => money(trip.due),
    Voucher: ({ trip }) => money(trip.voucher),
    "Thực thu": ({ trip }) =>
      money(statusAt(trip, end) === "Đã ra" ? trip.paid : null),
    "Chủ xe": ({ trip }) => trip.owner,
    "Số điện thoại": ({ trip }) => trip.phone,
  }
  const reset = () =>
    update({ ...clearAdvanced, q: null, drill: null, page: null })
  const changeColumns = (label: string) =>
    setColumnDraft((old) =>
      old.includes(label)
        ? old.filter((item) => item !== label)
        : [...old, label],
    )
  const moveColumn = (label: string, direction: number) => {
    const next = [...columnDraft]
    const index = next.indexOf(label),
      target = index + direction
    if (index < 0 || target < 0 || target >= next.length) return
    const previous = next[target]
    next[target] = label
    next[index] = previous
    setColumnDraft(next)
  }
  const exportRows = () =>
    exportFile(
      "TraCuuLuotXe",
      () => ({
        "Lượt xe": filtered.map(({ trip, night, afterLock }) => ({
          ...tripExport(trip, filters, settings, data.days, night),
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
      <div className="panel">
        <div className="parking-toolbar">
          <ParkingSearch
            value={q}
            change={(value) => update({ q: value, page: null })}
            placeholder={tripSearchPlaceholder}
            minLength={3}
          />
          <div className="parking-inline">
            <Select
              aria-label="Sắp xếp lượt xe"
              value={sort}
              options={[
                { value: "new", label: "Vào mới nhất" },
                { value: "old", label: "Vào cũ nhất" },
                { value: "plate", label: "Biển số A–Z" },
              ]}
              onChange={(e) => update({ sort: e.target.value, page: null })}
            />
            <Button
              onClick={() => {
                setDraft(
                  Object.fromEntries(
                    advancedKeys.map((key) => [key, params.get(key)]),
                  ),
                )
                setDrawer("filters")
              }}
            >
              <ListFilter size={15} /> Bộ lọc
            </Button>
            <Button
              onClick={() => {
                setColumnDraft(shownColumns)
                setDrawer("columns")
              }}
            >
              <SlidersHorizontal size={15} /> Tùy chỉnh cột
            </Button>
            {canExport(access) && <ExportButton onClick={exportRows} />}
          </div>
        </div>
        <div className="parking-chips parking-list-chips">
          {drill && (
            <>
              <Button
                variant="ghost"
                onClick={() =>
                  update({
                    drill: null,
                    page: null,
                    site:
                      drill.sites?.length === 1 ? drill.sites[0] : filters.site,
                  })
                }
                aria-label="Bỏ điều kiện đối chiếu"
              >
                {drillLabel(drill)} ×
              </Button>
              {drill.sites?.length === 1 && (
                <span>{siteById(drill.sites[0])?.label}</span>
              )}
              <span>{filters.vehicle}</span>
            </>
          )}
          {advancedKeys.flatMap((key) => {
            const value = params.get(key)
            if (!value) return []
            return [
              <Button
                key={key}
                variant="ghost"
                onClick={() => update({ [key]: null, page: null })}
              >
                {key === "night"
                  ? "Chỉ lượt qua đêm"
                  : key === "adjustment"
                    ? "Điều chỉnh sau khóa"
                    : value}{" "}
                ×
              </Button>,
            ]
          })}
          {(q || drill || advancedKeys.some((key) => params.has(key))) && (
            <TextLink onClick={reset}>Xóa bộ lọc</TextLink>
          )}
        </div>
        {adjustmentOnly && (
          <div className="parking-inline parking-list-chips">
            <Badge tone="amber">Điều chỉnh sau khóa</Badge>
          </div>
        )}
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
              .map((label) => ({ label, cell: tableColumns[label] })),
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
      {drawer === "filters" && (
        <Overlay
          drawer
          title="Bộ lọc lượt xe"
          onClose={() => setDrawer(null)}
          footer={
            <>
              <Button onClick={() => setDraft(clearAdvanced)}>
                Xóa bộ lọc
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  update({ ...draft, page: null })
                  setDrawer(null)
                }}
              >
                Áp dụng
              </Button>
            </>
          }
        >
          <div className="parking-drawer-fields">
            {([
              ["state", "Trạng thái lượt", ["Đang trong bãi", "Đã ra"]],
              ["alert", "Cảnh báo", alertTabs.slice(1)],
              ["group", "Nhóm khách", [...parkingGroups]],
              ["lane", "Làn", laneList],
            ] as const).map(([key, label, options]) => (
              <Field key={key} label={label}>
                <Select
                  value={draft[key] ?? ""}
                  options={[allOption("Tất cả"), ...options]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
              </Field>
            ))}
            <Label className="op-check">
              <Input
                type="checkbox"
                checked={draft.night === "1"}
                onChange={(e) =>
                  setDraft({ ...draft, night: e.target.checked ? "1" : null })
                }
              />
              Chỉ lượt qua đêm
            </Label>
            <Label className="op-check">
              <Input
                type="checkbox"
                checked={draft.adjustment === "1"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    adjustment: e.target.checked ? "1" : null,
                  })
                }
              />
              Điều chỉnh sau khóa
            </Label>
          </div>
        </Overlay>
      )}
      {drawer === "columns" && (
        <Overlay
          drawer
          title="Tùy chỉnh cột"
          onClose={() => setDrawer(null)}
          footer={
            <>
              <Button onClick={() => setColumnDraft(defaultColumns)}>
                Mặc định
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setSavedColumns(columnDraft)
                  try {
                    localStorage.setItem(
                      `${columnsKey}:${actor}`,
                      JSON.stringify(columnDraft),
                    )
                  } catch {}
                  setDrawer(null)
                }}
              >
                Lưu
              </Button>
            </>
          }
        >
          {[
            ...columnDraft,
            ...[...baseColumns, ...extraColumns].filter(
              (label) => !columnDraft.includes(label),
            ),
          ].map((label) => (
            <div className="parking-column-setting" key={label}>
              <Label className="op-check">
                <Input
                  type="checkbox"
                  checked={columnDraft.includes(label)}
                  onChange={() => changeColumns(label)}
                />
                {label}
              </Label>
              {columnDraft.includes(label) && (
                <div className="parking-inline">
                  <Button
                    variant="ghost"
                    aria-label={`Đưa ${label} lên`}
                    disabled={columnDraft[0] === label}
                    onClick={() => moveColumn(label, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Đưa ${label} xuống`}
                    disabled={columnDraft[columnDraft.length - 1] === label}
                    onClick={() => moveColumn(label, 1)}
                  >
                    ↓
                  </Button>
                </div>
              )}
            </div>
          ))}
        </Overlay>
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
}: {
  trip: Trip
  settings: ParkingSettings
  filters: ParkingFilters
  cutoff: string
  changes: Adjustment[]
  back: () => void
  exportFile: ExportParking
  access: ParkingAccess
}) {
  const end = dayStart(filters.end) + dayMinutes
  const closed = statusAt(trip, end) === "Đã ra"
  const days = daysIn(dayAt(trip.entered), filters.end)
  const flags = tripAlerts(trip, filters, settings)
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
            {canExport(access) && (
              <ExportButton
                onClick={() =>
                  exportFile(
                    "ChiTietLuotXe",
                    () => ({
                      "Lượt xe": [tripExport(trip, filters, settings, days)],
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
        <dl className="parking-detail-grid">
          {[
            ["Trạng thái", statusAt(trip, end)],
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
                  ? "Xe chưa ra tại ngày chốt"
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
