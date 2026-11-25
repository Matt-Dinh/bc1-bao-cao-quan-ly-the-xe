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
  tripLookupPatch,
  vnNow,
  vnToday,
} from "./parking-model"
import type {
  ParkingAccess,
  ParkingFilters,
  ParkingScreen,
  Trip,
  TripDrill,
} from "./parking-model"
import ParkingDashboard from "./ParkingDashboard"
import ParkingDeclarations from "./ParkingDeclarations"
import {
  ParkingAlerts,
  ParkingTripDetail,
  ParkingTripList,
  readTripLookupParams,
  TripLookupFields,
  tripLookupFilterError,
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
import { RevenueTripEditor } from "./RevenueTripEditor"
import type { RevenueTripActions } from "./RevenueTripEditor"
import { orphanTransactions } from "./parking-supplement-data"
import { tripRevenueAmounts } from "./revenue-model"
import { getParkingFeeService } from "./parking-fees"
import { createDemoParkingFeeService } from "./parking-fees-demo"
import { tripLookupScope, tripLookupScopeDenied, tripMatchesScope } from "./parking-lookup"
import { behaviorReportInputs } from "./behavior-lookup"
import { canReadBehavior, canSeePlates, indexEvents } from "./behavior-model"
import { behaviorReport, migrateBehaviorLocation } from "./behavior-routes"

type Navigate = (
  screen: ParkingScreen | import("./behavior-routes").BehaviorScreen,
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
  revenue?: RevenueTripActions
  tripUpdates?: Trip[]
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
  revenue,
  tripUpdates,
}: Props) {
  const { trips: baseTrips, settings, cutoff, actor, save } = model
  const trips = useMemo(() => {
    if (!baseTrips) return baseTrips
    if (!revenue?.state.tripUpdates.length && !tripUpdates?.length) return baseTrips.map(tripRevenueAmounts)
    const byId = new Map(baseTrips.map((trip) => [trip.id, trip]))
    if (revenue) for (const update of revenue.state.tripUpdates) byId.set(update.trip.id, update.trip)
    else for (const trip of tripUpdates ?? []) byId.set(trip.id, trip)
    return [...byId.values()].map(tripRevenueAmounts)
  }, [baseTrips, revenue?.state.tripUpdates, tripUpdates])
  const lookupEvents = useMemo(() => screen === "parking-trips" ? behaviorReportInputs(settings, cutoff).events : [],
    [screen, settings.behaviorEvents, settings.behaviorSnapshot, cutoff])
  const eventIndex = useMemo(() => indexEvents(lookupEvents), [lookupEvents])
  const pendingTrips: Trip[] = revenue && baseTrips ? orphanTransactions.filter((row) =>
    (!access.estate || row.estate === access.estate) && !revenue.state.tripUpdates.some((update) => update.trip.id === row.trip))
    .map((row) => ({
      id: row.trip, site: `${row.estate}:0`, vehicle: "Ô tô", group: "Vãng lai",
      plate: row.plate, ticket: `QR-${row.trip}`, owner: "", phone: "", entered: dayStart(row.day),
      exited: dayStart(row.day) + Number(row.at.slice(-5, -3)) * 60 + Number(row.at.slice(-2)), laneIn: "", laneOut: "Làn ra 1",
      sourceIn: "CSKH bổ sung", sourceOut: "Làn tự động", due: row.amount,
      paid: row.status === "Thành công" ? row.amount : 0, voucher: 0,
    })) : []
  const demoFeeSource = useRef({ baseTrips, pendingTrips, updates: revenue?.state.tripUpdates })
  demoFeeSource.current = { baseTrips, pendingTrips, updates: revenue?.state.tripUpdates }
  const demoFeeService = useMemo(() => createDemoParkingFeeService((id) => {
    const current = demoFeeSource.current
    return current.updates?.find((row) => row.trip.id === id)?.trip ??
      current.baseTrips?.find((row) => row.id === id) ?? current.pendingTrips.find((row) => row.id === id)
  }), [])
  const parkingFeeService = revenue?.feeService ?? getParkingFeeService() ?? demoFeeService
  const defaults = defaultParkingFilters(cutoff)
  const lookupScope = useMemo(() => screen === "parking-trips" ? tripLookupScope(params) : undefined,
    [screen, JSON.stringify(params.getAll("estate")), JSON.stringify(params.getAll("site")), JSON.stringify(params.getAll("vehicle"))])
  const filters = useMemo<ParkingFilters>(
    () => ({
      estate: lookupScope ? lookupScope.estates.length === 1 ? lookupScope.estates[0] : "" : params.get("estate") || "",
      site: lookupScope ? lookupScope.sites.length === 1 ? lookupScope.sites[0] : "" : params.get("site") || "",
      vehicle:
        parkingVehicles.find((vehicle) => (lookupScope ? lookupScope.vehicles[0] : params.get("vehicle")) === vehicle) ??
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
      lookupScope,
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
    (screen === "parking-trips" && (params.has("bContext") && !canReadBehavior(access) || params.has("bPlate") && !canSeePlates(access))) ||
    (lookupScope ? tripLookupScopeDenied(lookupScope, access) : (!!filters.estate &&
      !scope.some((site) => site.estate === filters.estate)) ||
    (!!filters.site &&
      !scope.some(
        (site) =>
          site.id === filters.site &&
          (!filters.estate || site.estate === filters.estate),
      ))) ||
    (!!trip && !scope.some((site) => site.id === trip.site)) ||
    (!!params.get("configEstate") &&
      params
        .get("configEstate")!
        .split("|")
        .filter(Boolean)
        .some((estateId) => !scope.some((site) => site.estate === estateId)))
  const dateError = periodError(filters, cutoff)
  const lookupError = screen === "parking-trips" && !dateError ? tripLookupFilterError(params, filters) : ""
  const error = dateError || lookupError
  const legacyDrill = screen === "parking-trips" ? params.get("drill") : null
  useEffect(() => {
    const previous = parseDrill(legacyDrill)
    if (previous) update({ ...tripLookupPatch(previous, filters, settings), drill: null, page: null })
  }, [legacyDrill])
  const configuration =
    screen === "parking-capacity" || screen === "parking-settings"
  const [attempt, setAttempt] = useState(0)
  const [tripHeadingActions, setTripHeadingActions] = useState<HTMLDivElement | null>(null)
  const [calculation, setCalculation] = useState<{
    key: string
    data: ReturnType<typeof buildParkingReport> | null
    error?: boolean
  } | null>(null)
  const key = `${screen}/${access.role}/${access.estate}/${filters.estate}/${filters.site}/${filters.start}/${filters.end}/${filters.vehicle}/${JSON.stringify(lookupScope)}/${attempt}`
  useEffect(() => {
    if (!trips || error || denied || configuration || tripId) return
    const timer = window.setTimeout(() => {
      try {
        setCalculation({
          key,
          data: buildParkingReport(trips, settings, filters, access, lookupScope),
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
    if (!canOpen(access, "parking-trips")) return
    const origin = new URLSearchParams(params)
    origin.delete("module")
    navigate("parking-trips", {
      ...tripLookupPatch(value, filters, settings),
      origin: `?${origin}`,
      originScreen: screen,
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
      (lookupScope ? tripMatchesScope(row.trip, lookupScope) : row.trip.vehicle === filters.vehicle &&
      (!filters.estate || siteById(row.trip.site)?.estate === filters.estate) &&
      (!filters.site || row.trip.site === filters.site)) &&
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
        revenueActions={revenue && <RevenueTripEditor existing={revenue.state.tripUpdates.find((update) => update.trip.id === trip.id)?.trip ??
          baseTrips?.find((original) => original.id === trip.id) ?? trip} {...revenue} feeService={parkingFeeService}
          trips={baseTrips ?? []} settings={settings} actor={actor} access={access} notify={notify} />}
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
    const originScreen = params.get("originScreen")
    if (originScreen) {
      const report = new URLSearchParams(origin)
      report.set("module", originScreen)
      migrateBehaviorLocation(report)
      if (report.get("module") === behaviorReport) {
        report.delete("module")
        navigate(behaviorReport, Object.fromEntries(report))
        return
      }
    }
    navigate(
      originScreen === "parking-alerts"
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
        (lookupScope ? tripMatchesScope(trip, lookupScope) : trip.vehicle === filters.vehicle) &&
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
              params.has("origin") && (
                <Button onClick={backToOrigin}>
                  <ArrowLeft size={15} /> Quay lại số liệu
                </Button>
              )}
            {screen === "parking-trips" && <div className="op-heading-actions trip-heading-actions" ref={setTripHeadingActions} />}
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
        key={screen}
        filters={filters}
        cutoff={cutoff}
        error={dateError}
        access={access}
        change={screen === "parking-report" ? (patch) => {
          changeFilters(patch)
          setAttempt((value) => value + 1)
        } : changeFilters}
        lookup={screen === "parking-trips" ? {
          params: readTripLookupParams(params),
          fields: (draftParams, updateDraft) => <TripLookupFields params={draftParams} update={updateDraft} data={data}
            events={lookupEvents.filter((event) => scope.some((site) => site.estate === event.estate))} />,
          error: tripLookupFilterError,
        } : undefined}
        report={screen === "parking-report"}
        loading={!error && !data && !loadError}
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
              headingActions={tripHeadingActions}
              behaviorEvents={eventIndex}
              behaviorCutoff={dayStart(shiftDay(cutoff, 1))}
              behaviorTrips={params.has("bContext") ? trips?.filter((trip) =>
                scope.some((site) => site.id === trip.site) && inWindow(trip.entered, dayStart(filters.start), dayStart(shiftDay(filters.end, 1)))) : undefined}
              revenueActions={revenue && <RevenueTripEditor pendingTrips={pendingTrips} {...revenue} feeService={parkingFeeService}
                trips={baseTrips ?? []} settings={settings} actor={actor} access={access} notify={notify} />}
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
