import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, ChevronRight, LoaderCircle, ShieldAlert, TriangleAlert } from "lucide-react"
import { Button, Heading } from "./ui"
import { date, estates } from "./data"
import { allowedSites, dayAt, parkingRoles, shiftDay, vnToday } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import { ParkingTabs } from "./parking-ui"
import type { ExportParking, UpdateParams } from "./parking-ui"
import { auditRevenue, buildLedger, incidentCharges, isPeriodClosed, isRevenueScreen, revenueAccess, revenueCutoff, revenueMenus, revenuePeriodError } from "./revenue-model"
import type { RevenueFilter, RevenueScreen, RevenueState } from "./revenue-model"
import RevenueDashboard from "./RevenueDashboard"
import type { RevenueNavigate } from "./RevenueDashboard"
import RevenueLookup from "./RevenueLookup"
import RevenueFilters from "./RevenueFilters"
import { readRevenueLookup } from "./revenue-lookup"
import { RevenueClose, RevenueDebt } from "./RevenueOperations"
import { RevenueReceipts } from "./RevenueInputs"
import VoucherManagement from "./VoucherManagement"
import { voucherPage } from "./voucher-navigation"
import RevenueSourceDocuments from "./RevenueSourceDocuments"
import { closeRevenueEntry, openRevenueEntry, revenueEntryKind, revenueEntryRedirect } from "./revenue-entry"
import type { RevenueEntryKind } from "./revenue-entry"
import { revenueMatches, revenueValues } from "./revenue-filter-values"
import { RevenueConfiguration } from "./RevenueConfiguration"
import type useParking from "./useParking"
import type { RevenueSave } from "./revenue-operations"
import type { OperationState } from "./operations-model"

export { useRevenueState } from "./useRevenueState"
interface Props {
  screen: RevenueScreen; params: URLSearchParams; access: ParkingAccess; model: ReturnType<typeof useParking>
  state: RevenueState; save: RevenueSave; update: UpdateParams; navigate: RevenueNavigate
  operations: OperationState
  home: () => void; notify: (message: string) => void; onDirty: (dirty: boolean) => void
  openParking: (trip: string, day: string) => void
}
export default function Revenue({ screen, params, access, model, state, save, update, navigate, home, notify, onDirty, openParking, operations }: Props) {
  const actor = parkingRoles[access.role]
  useEffect(() => {
    const patch = revenueEntryRedirect(screen, params)
    if (patch && revenueAccess(access, screen)) navigate(patch, "revenue-lookup", false)
  }, [screen, params, access, navigate])
  const estate = params.get("estate") ?? ""
  const site = params.get("site") ?? ""
  const cutoff = revenueCutoff(state, estate)
  const filterCutoff = screen === "revenue-paper" || screen === "revenue-receipt" || screen === "revenue-voucher" && (!params.get("voucherTab") || params.get("voucherTab") === "sources") ? vnToday() : cutoff
  const filter = useMemo<RevenueFilter>(() => {
    const base = { estate, site, vehicle: params.get("vehicle") ?? "", start: params.get("start") ?? shiftDay(filterCutoff, -6), end: params.get("end") ?? filterCutoff }
    if (screen !== "revenue-lookup") return base
    const values = readRevenueLookup(params, base)
    return { ...base, ...Object.fromEntries(["estate", "site", "vehicle", "start", "end"].filter((key) => values.has(key)).map((key) => [key, values.get(key)!])) }
  }, [estate, site, filterCutoff, params, screen])
  const [reportActions, setReportActions] = useState<HTMLDivElement | null>(null)
  const [closeActions, setCloseActions] = useState<HTMLDivElement | null>(null)
  const [voucherActions, setVoucherActions] = useState<HTMLDivElement | null>(null)
  const [lookupActions, setLookupActions] = useState<HTMLDivElement | null>(null)
  const [configActions, setConfigActions] = useState<HTMLDivElement | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ state: RevenueState; trips: typeof model.trips; settings: typeof model.settings; rows: ReturnType<typeof buildLedger>; error?: boolean } | null>(null)
  const accessible = allowedSites(access)
  const denied = !revenueAccess(access, screen) || revenueValues(filter.estate).some((estate) => !accessible.some((item) => item.estate === estate)) ||
    revenueValues(filter.site).some((site) => !accessible.some((item) => item.id === site && revenueMatches(item.estate, filter.estate)))
  const needsLedger = screen !== "revenue-settings" && screen !== "revenue-voucher"
  const { trips, settings } = model
  const incidents = useMemo(() => incidentCharges(operations), [operations])
  useEffect(() => {
    if (!trips || denied || !needsLedger) return
    const timer = window.setTimeout(() => {
      try { setLoaded({ state, trips, settings, rows: buildLedger(trips, settings, state, incidents) }) }
      catch { setLoaded((old) => ({ state, trips, settings, rows: old?.rows ?? [], error: true })) }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state, trips, settings, incidents, denied, needsLedger, attempt])
  const ledger = loaded?.rows ?? []
  const error = ["revenue-policies", "revenue-settings", "revenue-voucher"].includes(screen) || (screen === "revenue-debt" && params.get("debtPeriod") !== "1") ? "" : revenuePeriodError(filter, filterCutoff)
  const limited = ["revenue-report", "revenue-lookup", "revenue-debt", "revenue-paper", "revenue-receipt"].includes(screen)
  const menu = revenueMenus.find((item) => item.id === screen)!
  const title = screen === "revenue-voucher" ? params.get("merchantEdit") ? params.get("merchantEdit") === "new" ? "Thêm mới gian hàng" : "Chỉnh sửa gian hàng"
    : params.get("voucherEdit") ? params.get("voucherEdit") === "new" ? "Tạo voucher" : "Sửa voucher" : voucherPage(params).title : menu.title
  const exportFile: ExportParking = (name, make, count) => {
    save((latest) => auditRevenue(latest, actor, "Xuất dữ liệu", estate || access.estate, `${name} · ${params}`))
    model.exportFile(name, make, count, { rows: 1000000, simultaneous: 3, days: 7 })
  }
  const origin = params.get("origin")
  if (denied) return <div className="panel parking-forbidden"><ShieldAlert size={34} /><span>403</span>
    <Heading level={1}>Bạn không có quyền truy cập</Heading><Button variant="primary" onClick={home}>Về trang chủ</Button></div>
  const detail = screen === "revenue-lookup" && params.get("detail")
  if (detail && loaded && ledger.some((row) => row.id === detail && !accessible.some((site) => site.id === row.site))) {
    return <div className="panel parking-forbidden"><ShieldAlert size={34} /><span>403</span><Heading level={1}>Bạn không có quyền truy cập</Heading>
      <Button variant="primary" onClick={home}>Về trang chủ</Button></div>
  }
  const reportMonth = filter.end.slice(0, 7)
  const estateOptions = estates.filter((item) => accessible.some((site) => site.estate === item.id) && revenueMatches(item.id, estate))
  const closedEstatesCount = estateOptions.filter((item) => isPeriodClosed(state, item.id, reportMonth, cutoff)).length
  const ready = !needsLedger || loaded
  const operationProps = { state, ledger, parking: settings, trips: trips ?? [], access, filter, cutoff, actor, params, update, navigate, exportFile, save, notify, operations }
  const openSource = (kind: RevenueEntryKind, create: boolean, reference?: string) => {
    const row = kind === "receipt" ? state.receipts.find((item) => item.id === reference) : undefined
    update({ ...openRevenueEntry(params, filter, kind, create, vnToday()), ...(reference ? { entry_q: reference } : {}), ...(row ? { entry_start: dayAt(row.at), entry_end: dayAt(row.at) } : {}) })
  }
  const activeEntry = screen === "revenue-lookup" ? revenueEntryKind(params) : null
  const isEntryInline = !!activeEntry && params.get("entryAction") !== "new"
  const lookupTabs = [
    { key: "transactions" as const, label: "Danh sách giao dịch" },
    ...(revenueAccess(access, "revenue-receipt") ? [{ key: "receipt" as const, label: "Phiếu thu cấp thẻ" }] : []),
    { key: "history" as const, label: "Điều chỉnh sau chốt" },
  ]
  const currentLookupTab = isEntryInline && activeEntry === "receipt" && revenueAccess(access, "revenue-receipt")
    ? "Phiếu thu cấp thẻ"
    : isEntryInline && activeEntry === "history"
      ? "Điều chỉnh sau chốt"
      : "Danh sách giao dịch"
  return <div className="parking-module revenue-module">
    {!detail && <>
      <div className="breadcrumbs"><span>{menu.group}</span><ChevronRight size={12} /><span className="current-crumb">{title}</span></div>
      <div className="page-heading parking-heading"><div><Heading level={1}>{title}</Heading>
        <p className="page-description">{screen === "revenue-policies"
          ? "Thiết lập chính sách miễn, giảm phí gửi xe và thứ tự áp dụng theo bãi xe, phương tiện."
          : screen === "revenue-settings"
            ? "Thiết lập giờ bắt đầu ngày doanh thu, thuế suất VAT, ngưỡng quá hạn công nợ và mã SAP theo khu đô thị."
            : screen === "revenue-lookup"
              ? `Sổ chi tiết và đối soát các giao dịch doanh thu đến hết ngày doanh thu ${date(cutoff)} · GMT+7`
              : screen === "revenue-voucher" ? "Dữ liệu minh họa · GMT+7"
              : `Số liệu đến hết ngày doanh thu ${date(cutoff)} · GMT+7 · Dữ liệu minh họa`}</p></div>
        {screen === "revenue-report" && <div ref={setReportActions} className="parking-actions" />}
        {screen === "revenue-close" && <div ref={setCloseActions} className="parking-actions op-heading-actions" />}
        {screen === "revenue-voucher" && !params.get("voucherEdit") && !params.get("merchantEdit") && params.get("voucherTab") !== "report" && <div ref={setVoucherActions} className="op-heading-actions voucher-heading-actions" />}
        {screen === "revenue-lookup" && !detail && <div ref={setLookupActions} className="parking-actions op-heading-actions" />}
        {(screen === "revenue-policies" || screen === "revenue-settings") && <div ref={setConfigActions} className="parking-actions op-heading-actions" />}
        {origin && ["revenue-lookup", "revenue-debt"].includes(screen) && <Button onClick={() => {
          const old = new URLSearchParams(origin)
          const target = old.get("module")
          old.delete("module")
          navigate(Object.fromEntries(old), isRevenueScreen(target) ? target : "revenue-report", false)
        }}><ArrowLeft size={15} />{new URLSearchParams(origin).get("module") === "revenue-voucher" ? "Quay lại Voucher" : "Quay lại báo cáo"}</Button>}
      </div>
      {screen === "revenue-lookup" && (
        <div className="mb-4">
          <ParkingTabs
            options={lookupTabs.map((tab) => tab.label)}
            value={currentLookupTab}
            change={(label) => {
              const target = lookupTabs.find((tab) => tab.label === label)?.key
              if (target === "transactions") update(closeRevenueEntry(params))
              else if (target === "receipt" || target === "history") openSource(target, false)
            }}
          />
        </div>
      )}
    </>}
    {limited && !detail && !isEntryInline && !params.get("voucherEdit") && <>
      <RevenueFilters key={screen} screen={screen} filter={filter} cutoff={filterCutoff} access={access} params={params} state={state} ledger={ledger} update={update} />
      {screen === "revenue-report" && <div className="revenue-period-status">Kỳ {reportMonth.split("-").reverse().join("/")} ·
        {estateOptions.length > 0 && closedEstatesCount === estateOptions.length ? " Đã tự động chốt kỳ" :
          closedEstatesCount > 0 ? ` ${closedEstatesCount}/${estateOptions.length} khu đã chốt kỳ` : " Đang mở"}</div>}
    </>}
    {needsLedger && loaded?.error && <div className="parking-banner error"><TriangleAlert size={16} />Không tải được dữ liệu <Button onClick={() => setAttempt((n) => n + 1)}>Thử lại</Button></div>}
    {!ready && (!limited || !error) && <div className="panel parking-empty" role="status"><LoaderCircle className="animate-spin" size={20} />Đang tải dữ liệu…</div>}
    {ready && (!limited || !error || detail || isEntryInline) && <>
      {screen === "revenue-report" && <RevenueDashboard {...operationProps}
        exportAction={(action) => reportActions ? createPortal(action, reportActions) : null} />}
      {screen === "revenue-lookup" && (!isEntryInline || detail) && <RevenueLookup {...operationProps} openParking={openParking} openSource={(kind, reference) => openSource(kind, false, reference)}
        headerActions={(actions) => lookupActions ? createPortal(actions, lookupActions) : null} />}
      {screen === "revenue-close" && <RevenueClose {...operationProps}
        headerActions={(actions) => closeActions ? createPortal(actions, closeActions) : null} />}
      {screen === "revenue-debt" && <RevenueDebt {...operationProps} />}
      {screen === "revenue-receipt" && <RevenueReceipts {...operationProps} />}
      {screen === "revenue-voucher" && <VoucherManagement access={access} params={params} update={update} exportFile={exportFile} actor={actor} notify={notify} onDirty={onDirty}
        headerActions={(actions) => voucherActions ? createPortal(actions, voucherActions) : null} />}
      {(screen === "revenue-policies" || screen === "revenue-settings") && <RevenueConfiguration key={screen} {...operationProps}
        policies={screen === "revenue-policies"} onDirty={onDirty}
        headerActions={(actions) => configActions ? createPortal(actions, configActions) : null} />}
    </>}
    {screen === "revenue-lookup" && ready && !detail && <RevenueSourceDocuments {...operationProps}
      headerActions={(actions) => lookupActions ? createPortal(actions, lookupActions) : null} />}
    <footer className="page-footer"><span>VParking CMS · {menu.title}</span><span>Dữ liệu minh họa · GMT+7</span></footer>
  </div>
}
