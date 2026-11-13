import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  Info,
  LoaderCircle,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react"
import { Button, Heading } from "./ui"
import { date, fmt } from "./data"
import {
  allowedSites,
  buildParkingReport,
  canExport,
  canOpen,
  dayMinutes,
  dayStart,
  defaultParkingFilters,
  goLive,
  inWindow,
  parkingMenus,
  parkingVehicles,
  periodError,
  shiftDay,
  siteById,
  touches,
  vnNow,
  vnToday,
} from "./parking-model"
import type {
  ParkingAccess,
  ParkingFilters,
  ParkingScreen,
  TripDrill,
} from "./parking-model"
import ParkingDashboard from "./ParkingDashboard"
import ParkingDeclarations from "./ParkingDeclarations"
import {
  ParkingAlerts,
  ParkingTripDetail,
  ParkingTripList,
  parseDrill,
} from "./ParkingTrips"
import {
  ExportButton,
  ParkingFiltersBar,
  ParkingHeading,
  periodText,
  TextLink,
} from "./parking-ui"
import type { ExportParking, UpdateParams } from "./parking-ui"
import { summaryWorkbook } from "./parking-export"
import type useParking from "./useParking"

type Navigate = (
  screen: ParkingScreen,
  patch?: Record<string, string | null>,
  preserve?: boolean,
) => void
interface Props {
  screen: ParkingScreen
  params: URLSearchParams
  access: ParkingAccess
  model: ReturnType<typeof useParking>
  update: UpdateParams
  navigate: Navigate
  home: () => void
  onDirty: (dirty: boolean) => void
  notify: (message: string) => void
}
export default function Parking({
  screen,
  params,
  access,
  model,
  update,
  navigate,
  home,
  onDirty,
  notify,
}: Props) {
  const { trips, settings, cutoff, actor, save } = model
  const defaults = defaultParkingFilters(cutoff)
  const filters = useMemo<ParkingFilters>(
    () => ({
      estate: params.get("estate") || "",
      site: params.get("site") || "",
      vehicle:
        parkingVehicles.find((vehicle) => params.get("vehicle") === vehicle) ??
        defaults.vehicle,
      start: params.get("start") ?? defaults.start,
      end: params.get("end") ?? defaults.end,
    }),
    [
      params.get("estate"),
      params.get("site"),
      params.get("vehicle"),
      params.get("start"),
      params.get("end"),
      defaults.start,
      defaults.end,
    ],
  )
  const menu = parkingMenus.find((menu) => menu.id === screen)!
  const scope = useMemo(() => allowedSites(access), [access])
  const tripId = screen === "parking-trips" ? params.get("trip") : null
  const trip = tripId
    ? [...model.changes.map((row) => row.trip), ...(trips ?? [])].find(
        (row) => row.id === tripId,
      )
    : undefined
  const denied =
    !canOpen(access, screen) ||
    (!!filters.estate &&
      !scope.some((site) => site.estate === filters.estate)) ||
    (!!filters.site &&
      !scope.some(
        (site) =>
          site.id === filters.site &&
          (!filters.estate || site.estate === filters.estate),
      )) ||
    (!!trip && !scope.some((site) => site.id === trip.site)) ||
    (!!params.get("configEstate") &&
      !scope.some((site) => site.estate === params.get("configEstate")))
  const error = periodError(filters, cutoff)
  const configuration =
    screen === "parking-capacity" || screen === "parking-settings"
  const [attempt, setAttempt] = useState(0)
  const [calculation, setCalculation] = useState<{
    key: string
    data: ReturnType<typeof buildParkingReport> | null
    error?: boolean
  } | null>(null)
  const key = `${screen}/${access.role}/${access.estate}/${filters.estate}/${filters.site}/${filters.start}/${filters.end}/${filters.vehicle}/${attempt}`
  useEffect(() => {
    if (!trips || error || denied || configuration || tripId) return
    const timer = window.setTimeout(() => {
      try {
        setCalculation({
          key,
          data: buildParkingReport(trips, settings, filters, access),
        })
      } catch {
        setCalculation((current) => ({
          key,
          data: current?.data ?? null,
          error: true,
        }))
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [
    key,
    trips,
    settings.capacities,
    settings.schedules,
    settings.plans,
    settings.thresholds,
    settings.holidays,
    error,
    denied,
    configuration,
    tripId,
    filters,
    access,
  ])
  const data = calculation?.key === key ? calculation.data : null
  const loadError = calculation?.key === key && calculation.error
  const lastAudit = useRef("")
  const viewKey = `${key}/${params}`
  useEffect(() => {
    if (
      denied ||
      (!configuration && (error || (!data && !trip))) ||
      lastAudit.current === viewKey
    )
      return
    lastAudit.current = viewKey
    model.audit(
      "Xem dữ liệu",
      `${menu.title} · ${params.toString() || periodText(filters)}`,
      params.get("configEstate") || filters.estate || access.estate,
    )
  }, [viewKey, data, denied, trip, configuration, error])
  const exportFile: ExportParking = (name, make, count) => {
    if (!canExport(access)) return
    model.audit(
      "Xuất dữ liệu",
      `${name} · ${params.toString() || periodText(filters)}`,
      params.get("configEstate") || filters.estate || access.estate,
    )
    model.exportFile(name, make, count)
  }
  const changeFilters: UpdateParams = (patch) =>
    update({ ...patch, page: null, focus: null })
  const resetFilters = () =>
    changeFilters({
      estate: null,
      site: null,
      vehicle: null,
      start: null,
      end: null,
      q: null,
      drill: null,
    })
  const returnState = useRef<{ page: string; scroll: number } | null>(null)
  useEffect(() => {
    if (!tripId && data && returnState.current?.page === screen) {
      window.scrollTo(0, returnState.current.scroll)
      returnState.current = null
    }
  }, [tripId, screen, data])
  const openTrip = (id: string) => {
    returnState.current = { page: screen, scroll: window.scrollY }
    navigate("parking-trips", { trip: id, detailFrom: screen }, true)
    window.scrollTo(0, 0)
  }
  const backTrip = () => {
    const from =
      params.get("detailFrom") === "parking-alerts"
        ? "parking-alerts"
        : "parking-trips"
    navigate(from, { trip: null, detailFrom: null }, true)
  }
  const drill = (value: TripDrill) => {
    const origin = new URLSearchParams(params)
    origin.delete("module")
    navigate("parking-trips", {
      drill: JSON.stringify(value),
      origin: `?${origin}`,
      originScreen: screen,
      estate: filters.estate,
      site: filters.site,
      vehicle: filters.vehicle,
      start: filters.start,
      end: filters.end,
    })
    window.scrollTo(0, 0)
  }
  const showFlow = (site: string, day: string) => {
    if (!canOpen(access, "parking-report")) {
      navigate("parking-trips", {
        estate: siteById(site)?.estate ?? "",
        site,
        vehicle: filters.vehicle,
        start: day,
        end: day,
      })
      return
    }
    navigate("parking-report", {
      estate: filters.estate,
      site: filters.site,
      vehicle: filters.vehicle,
      start: filters.start,
      end: filters.end,
      flowDay: day,
      flowSite: site,
      flow: "Giờ",
      focus: "flow",
    })
  }
  const changes = model.changes.filter(
    (row) =>
      scope.some((site) => site.id === row.trip.site) &&
      row.trip.vehicle === filters.vehicle &&
      (!filters.estate || siteById(row.trip.site)?.estate === filters.estate) &&
      (!filters.site || row.trip.site === filters.site) &&
      row.day >= filters.start &&
      row.day <= filters.end,
  )
  if (denied)
    return (
      <div className="panel parking-forbidden">
        <ShieldAlert size={34} />
        <span>403</span>
        <Heading level={1}>Bạn không có quyền truy cập</Heading>
        <Button variant="primary" onClick={home}>
          Về trang chủ
        </Button>
      </div>
    )
  if (configuration)
    return (
      <ParkingDeclarations
        key={screen}
        configuration={screen === "parking-settings"}
        settings={settings}
        params={params}
        update={update}
        access={access}
        actor={actor}
        cutoff={cutoff}
        save={save}
        exportFile={exportFile}
        onDirty={onDirty}
        notify={notify}
      />
    )
  if (tripId && trips && !trip)
    return (
      <div className="panel parking-empty">
        <p>Không tìm thấy lượt xe.</p>
        <Button onClick={backTrip}>Quay lại</Button>
      </div>
    )
  if (trip && !error)
    return (
      <ParkingTripDetail
        trip={trip}
        settings={settings}
        filters={filters}
        cutoff={cutoff}
        changes={model.changes.filter((row) => row.trip.id === trip.id)}
        back={backTrip}
        exportFile={exportFile}
        access={access}
      />
    )
  const exportReport = () => {
    if (!trips || !data) return
    const start = dayStart(filters.start < goLive ? goLive : filters.start),
      end = dayStart(filters.end) + dayMinutes
    const scoped = new Set(
      scope
        .filter(
          (site) =>
            (!filters.estate || site.estate === filters.estate) &&
            (!filters.site || site.id === filters.site),
        )
        .map((site) => site.id),
    )
    const count = trips.filter(
      (trip) => scoped.has(trip.site) && touches(trip, start, end),
    ).length
    exportFile(
      "BaoCaoChoDo",
      () =>
        summaryWorkbook(
          trips,
          settings,
          model.changes,
          filters,
          access,
          cutoff,
          actor,
          vnNow(),
        ),
      count,
    )
  }
  const backToOrigin = () => {
    const origin = new URLSearchParams(params.get("origin") ?? "")
    navigate(
      params.get("originScreen") === "parking-alerts"
        ? "parking-alerts"
        : "parking-report",
      Object.fromEntries(origin),
    )
  }
  const latest = shiftDay(vnToday(), -1)
  const inconsistent = ({
    opening,
    incoming,
    outgoing,
    closing,
  }: {
    opening: number
    incoming: number
    outgoing: number
    closing: number
  }) => opening + incoming - outgoing !== closing
  const mismatches =
    data &&
    (inconsistent(data.total) ||
      data.bySite.some(
        (site) =>
          inconsistent(site.total) ||
          site.daily.some(
            (day) => inconsistent(day) || day.hours.some(inconsistent),
          ),
      ))
  const sourceErrors =
    trips?.filter(
      (trip) =>
        trip.exited !== null &&
        trip.exited < trip.entered &&
        trip.vehicle === filters.vehicle &&
        scope.some((site) => site.id === trip.site) &&
        inWindow(
          trip.exited,
          dayStart(filters.start),
          dayStart(filters.end) + dayMinutes,
        ),
    ).length ?? 0
  return (
    <div className="parking-module">
      <ParkingHeading
        title={menu.title}
        group={menu.group}
        cutoff={cutoff}
        actions={
          <>
            {screen === "parking-trips" &&
              parseDrill(params.get("drill")) &&
              params.has("origin") && (
                <Button onClick={backToOrigin}>
                  <ArrowLeft size={15} /> Quay lại số liệu
                </Button>
              )}
            {screen === "parking-report" &&
              data &&
              data.days.length > 0 &&
              canExport(access) && <ExportButton onClick={exportReport} />}
          </>
        }
      />
      {cutoff < latest && (
        <div className="parking-banner warning">
          <Info size={16} />
          Đang dùng số liệu đến {date(cutoff)}. Số liệu ngày {date(latest)} đang
          được tổng hợp.
        </div>
      )}
      <ParkingFiltersBar
        filters={filters}
        cutoff={cutoff}
        error={error}
        access={access}
        change={changeFilters}
        segmented={screen === "parking-report"}
      />
      {mismatches || sourceErrors > 0 ? (
        <div className="parking-banner error">
          <TriangleAlert size={17} />
          Số liệu đang được kiểm tra
          {sourceErrors > 0
            ? ` · ${fmt(sourceErrors)} lượt có giờ ra trước giờ vào`
            : ""}
        </div>
      ) : null}
      {!error && loadError && (
        <div className="parking-banner error">
          <TriangleAlert size={16} />
          Không tải được số liệu{" "}
          <TextLink onClick={() => setAttempt((value) => value + 1)}>
            Thử lại
          </TextLink>
        </div>
      )}
      {!error && !data && !loadError && (
        <div className="panel parking-empty" role="status">
          <LoaderCircle className="animate-spin" size={22} /> Đang tải số liệu…
        </div>
      )}
      {!error && data && (
        <>
          {screen === "parking-report" && (
            <ParkingDashboard
              data={data}
              settings={settings}
              filters={filters}
              cutoff={cutoff}
              access={access}
              params={params}
              update={update}
              exportFile={exportFile}
              drill={drill}
              resetFilters={resetFilters}
              showCapacity={() => navigate("parking-capacity")}
              showAlerts={() =>
                navigate("parking-alerts", { ...filters, tab: "0" })
              }
            />
          )}
          {screen === "parking-alerts" && (
            <ParkingAlerts
              data={data}
              settings={settings}
              filters={filters}
              access={access}
              params={params}
              update={update}
              exportFile={exportFile}
              changes={changes}
              openTrip={openTrip}
              showFlow={showFlow}
              drill={drill}
            />
          )}
          {screen === "parking-trips" && (
            <ParkingTripList
              data={data}
              settings={settings}
              filters={filters}
              access={access}
              params={params}
              update={update}
              exportFile={exportFile}
              changes={changes}
              openTrip={openTrip}
            />
          )}
        </>
      )}
      <footer className="page-footer">
        <span>VParking CMS · {menu.title}</span>
        <span>Dữ liệu minh họa · GMT+7</span>
      </footer>
    </div>
  )
}
