import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { CalendarCheck2, Download, FileSpreadsheet, Plus, TriangleAlert } from "lucide-react"
import { Badge, Button, Field, Input, Overlay, Select, Textarea } from "./ui"
import { date, estates, fmt, normalize } from "./data"
import { allowedSites, isDay, siteById, vnNow, vnToday } from "./parking-model"
import type { ParkingAccess, ParkingSettings, Trip } from "./parking-model"
import { allOption, ExportButton, ParkingPagination, ParkingTabs, pageNumber, pageSize, TextLink } from "./parking-ui"
import type { ExportParking, ExportRow, UpdateParams } from "./parking-ui"
import {
  auditRevenue, configAt, dateCell, daysFor, revenueUnits, estateName, isPeriodClosed, monthEnd,
  revenueShifts, revenueWrite, scopeRows, timestampCell, totals, unitTypes,
} from "./revenue-model"
import type { LedgerRow, Payment, RevenueFilter, RevenueState } from "./revenue-model"
import type { OperationState } from "./operations-model"
import { balances, debtRow, groupRows, money, voucherDebtMeasures, voucherDebtValue } from "./revenue-tables"
import type { VoucherDebtMeasure } from "./revenue-tables"
import type { Balance } from "./revenue-tables"
import { isPositiveMoney, referencePattern, validDayUntil, validMonth } from "./revenue-operations"
import type { RevenueSave } from "./revenue-operations"
import { DataTable } from "./RevenueDashboard"
import { revenueMatches, revenueValues } from "./revenue-filter-values"
import RevenueSummaryFilters from "./RevenueSummaryFilters"
import { revenueHistoryParams } from "./revenue-entry"
import type { RevenueNavigate } from "./RevenueDashboard"
import {
  buildRevenueSummaryWorkbook,
  buildZfi014Workbook,
  cashAndQrTotal,
  isSapConfigComplete,
  summaryShiftRow,
} from "./revenue-zfi014"

export interface RevenueOperationProps {
  state: RevenueState; ledger: LedgerRow[]; parking: ParkingSettings; trips: Trip[]; access: ParkingAccess;
  filter: RevenueFilter; cutoff: string; actor: string; params: URLSearchParams; update: UpdateParams;
  navigate: RevenueNavigate; exportFile: ExportParking; save: RevenueSave; notify: (message: string) => void;
  operations: OperationState;
}
export function ReasonDialog({ title, description, action, close, submit }: {
  title: string; description: string; action: string; close: () => void; submit: (reason: string) => void
}) {
  const [reason, setReason] = useState("")
  return <Overlay title={title} subtitle={description} onClose={close} dismissOnBackdrop={false}
    footer={<><Button onClick={close}>Hủy</Button><Button variant="primary" disabled={!reason.trim()} onClick={() => submit(reason.trim())}>{action}</Button></>}>
    <Field label="Lý do" required><Textarea autoFocus maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      <span className="character-count">{reason.length}/500</span></Field>
  </Overlay>
}
export function PagedData<T>({ rows, data, id, params, update, link, empty, columns }: {
  rows: T[]; data: (row: T) => ExportRow; id: (row: T) => string; params: URLSearchParams; update: UpdateParams
  link?: Parameters<typeof DataTable<T>>[0]["link"]; empty?: React.ReactNode; columns?: string[]
}) {
  const size = pageSize(params.get("size")), page = pageNumber(params.get("page"), rows.length, size)
  return <><DataTable rows={rows.slice((page - 1) * size, page * size)} data={data} rowKey={id} link={link} empty={empty} columns={columns} />
    <ParkingPagination count={rows.length} size={size} page={page} change={(value) => update({ page: String(value) })}
      changeSize={(value) => update({ size: String(value), page: null })} /></>
}
export function RevenueClose({
  state,
  ledger,
  parking,
  access,
  filter,
  cutoff,
  actor,
  params,
  update,
  navigate,
  exportFile,
  headerActions,
}: RevenueOperationProps & { headerActions?: (actions: ReactNode) => ReactNode }) {
  const monthParam = params.get("month") ?? ""
  const hasExplicitRange = Boolean(params.get("start") || params.get("end"))
  const fallbackMonth = !hasExplicitRange && validMonth(monthParam) && monthParam <= cutoff.slice(0, 7) ? monthParam : ""
  const start = fallbackMonth ? `${fallbackMonth}-01` : filter.start
  const end = fallbackMonth ? (monthEnd(fallbackMonth) < cutoff ? monthEnd(fallbackMonth) : cutoff) : filter.end
  const accessibleSites = allowedSites(access)
  const permittedEstates = estates.filter((item) => accessibleSites.some((site) => site.estate === item.id)).map((item) => item.id)
  const estateFilter = filter.estate || access.estate || ""
  const selectedEstates = estateFilter
    ? revenueValues(estateFilter).filter((id) => permittedEstates.includes(id))
    : permittedEstates
  const sites = accessibleSites.filter((site) => selectedEstates.includes(site.estate) && revenueMatches(site.id, filter.site))
  const days = daysFor(start, end)
  const allShifts = useMemo(
    () => days.flatMap((day) => sites.flatMap((site) => revenueShifts(site.id, day, parking, state))),
    [days, sites, parking, state],
  )
  const scopedLedger = useMemo(
    () => scopeRows(ledger, { estate: selectedEstates.join("|"), site: filter.site, vehicle: "", start, end }, access, false),
    [ledger, selectedEstates, filter.site, start, end, access],
  )
  const byShift = useMemo(() => groupRows(scopedLedger, (row) => row.shiftId), [scopedLedger])
  const grandTotal = useMemo(() => totals(scopedLedger), [scopedLedger])
  const grandCashQr = cashAndQrTotal(grandTotal)
  const adjustments = useMemo(
    () =>
      state.changes.filter(
        (item) =>
          selectedEstates.includes(item.estate) &&
          revenueMatches(item.site, filter.site) &&
          item.recorded >= start &&
          item.recorded <= end,
      ),
    [state.changes, selectedEstates, filter.site, start, end],
  )
  const missingSapEstates = selectedEstates.filter((id) => !isSapConfigComplete(configAt(state, id, end)))
  const startMonth = start.slice(0, 7)
  const endMonth = end.slice(0, 7)
  const allAutoClosedPeriod =
    selectedEstates.length > 0 &&
    selectedEstates.every((id) => isPeriodClosed(state, id, endMonth, cutoff))
  const showEstateColumn = selectedEstates.length > 1
  const sortedShifts = useMemo(
    () =>
      [...allShifts].sort(
        (a, b) =>
          b.day.localeCompare(a.day) ||
          a.estate.localeCompare(b.estate) ||
          a.site.localeCompare(b.site) ||
          a.name.localeCompare(b.name),
      ),
    [allShifts],
  )

  const downloadReport = () =>
    exportFile("BaoCaoDoanhThuTongHop", () =>
      buildRevenueSummaryWorkbook({
        state,
        scopedLedger,
        shifts: allShifts,
        estates: selectedEstates,
        siteFilter: filter.site,
        days,
        cutoff,
        adjustments,
        actor,
      }),
    )

  const downloadZfi014 = () =>
    exportFile("ZFI014", () =>
      buildZfi014Workbook({
        state,
        ledger,
        scopedLedger,
        estates: selectedEstates,
        days,
        adjustments,
        actor,
      }),
    )

  const actionsNode = (
    <>
      <Button onClick={downloadReport}>
        <FileSpreadsheet size={15} />
        Tải báo cáo doanh thu
      </Button>
      {revenueWrite(access, "period") && (
        <Button variant="primary" onClick={downloadZfi014}>
          <Download size={15} />
          Tải số liệu ZFI014
        </Button>
      )}
    </>
  )

  return (
    <>
      {headerActions ? (
        headerActions(actionsNode)
      ) : (
        <div className="panel parking-toolbar revenue-toolbar">
          <div className="parking-inline">{actionsNode}</div>
        </div>
      )}
      <RevenueSummaryFilters
        estate={estateFilter}
        site={filter.site}
        start={start}
        end={end}
        cutoff={cutoff}
        access={access}
        update={update}
      />
      <div className="parking-banner">
        <CalendarCheck2 size={16} />
        {allAutoClosedPeriod && startMonth === endMonth
          ? `Kỳ ${endMonth.split("-").reverse().join("/")} · Đã tự động chốt kỳ`
          : `Tự động chốt theo ngày doanh thu đến hết ${date(cutoff)} · Kỳ kế toán tự động khóa sổ khi kết thúc tháng`}
        {adjustments.length > 0 && (
          <TextLink
            onClick={() => {
              const period = { estate: estateFilter, site: filter.site, vehicle: "", start, end }
              navigate({ ...period, ...revenueHistoryParams(period) }, "revenue-lookup", false)
            }}
          >
            {adjustments.length} khoản điều chỉnh sau chốt
          </TextLink>
        )}
      </div>
      {missingSapEstates.length > 0 && (
        <div className="parking-banner warning">
          <TriangleAlert size={16} />
          Chưa khai báo đủ mã SAP cho ZFI014: {missingSapEstates.map(estateName).join(", ")}.
        </div>
      )}
      <div className="panel">
        <div className="parking-banner revenue-list-total">
          <strong>Tổng hợp phạm vi đang xem</strong>
          {`${money(grandTotal.revenue)} doanh thu · ${money(grandTotal.moneyByMethod[0] ?? 0)} tiền mặt · ${money(grandTotal.moneyByMethod[1] ?? 0)} QR · ${money(grandCashQr)} tiền mặt + QR (ZFI014) · ${money(grandTotal.debt)} voucher · ${money(grandTotal.lost)} thất thu`}
        </div>
        <PagedData
          rows={sortedShifts}
          id={(row) => row.id}
          params={params}
          update={update}
          data={(shift) => summaryShiftRow(shift, byShift.get(shift.id) ?? [], showEstateColumn)}
        />
      </div>
    </>
  )
}

const paymentData = (row: Payment, state: RevenueState): ExportRow => ({
  "Ngày thanh toán": dateCell(row.day), "Đơn vị": revenueUnits(state).find((unit) => unit.id === row.unit)?.name ?? row.unit, "Số tiền (₫)": row.amount,
  "Số chứng từ": row.document, "Kỳ được trả": row.month || "Kỳ cũ nhất còn nợ", "Người ghi nhận": row.actor,
  "Thời điểm": timestampCell(row.at), "Trạng thái": row.canceled ? "Đã hủy" : "Hiệu lực", "Lý do hủy": row.canceled, "Thao tác": "",
})
export function RevenueDebt({ state, ledger, access, filter, cutoff, actor, params, update, exportFile, save, notify }: RevenueOperationProps) {
  const scoped = useMemo(() => scopeRows(ledger, { ...filter, start: "2026-01-01", end: cutoff }, access), [ledger, filter.estate, filter.site, filter.vehicle, cutoff, access])
  const selected = params.get("debtPeriod") === "1" ? scoped.filter((row) => row.revenueDay >= filter.start && row.revenueDay <= filter.end) : scoped
  const allBalances = balances(ledger, scoped, state, vnToday())
  const asOfParam = params.get("debtAsOf") || ""
  const asOf = isDay(asOfParam) && asOfParam <= cutoff ? asOfParam : params.get("debtPeriod") === "1" ? cutoff : vnToday()
  const historical = asOf < vnToday()
  const measure = Object.prototype.hasOwnProperty.call(voucherDebtMeasures, params.get("debtMeasure") || "") ? params.get("debtMeasure") as VoucherDebtMeasure : null
  const results = balances(ledger, selected, state, asOf)
  const tab = params.get("tab") === "history" ? "Lịch sử thanh toán" : "Công nợ theo đơn vị"
  const query = params.get("q") || "", type = params.get("unitType") || "", condition = params.get("condition") || ""
  const rows = results.filter((row) => revenueMatches(row.id, params.get("unit")) && revenueMatches(row.type, type) &&
    (!measure || voucherDebtValue(row, measure) > 0) &&
    (!condition || revenueValues(condition).some((value) => value === "Còn nợ" && row.remaining > 0 || value === "Quá hạn" && row.overdue > 0 || value === "Đã trả hết" && row.remaining === 0)) &&
    (!query || normalize(`${row.name} ${row.contract}`).includes(normalize(query))))
  const units = revenueUnits(state).filter((unit) => allowedSites(access).some((site) => site.estate === unit.estate) && revenueMatches(unit.estate, filter.estate))
  const unitIds = new Set(units.map((unit) => unit.id))
  const history = state.payments.filter((row) => unitIds.has(row.unit) && row.day <= asOf && revenueMatches(row.unit, params.get("unit")) && revenueMatches(units.find((unit) => unit.id === row.unit)?.type, type) &&
    (!query || normalize(`${row.document} ${units.find((unit) => unit.id === row.unit)?.name ?? ""}`).includes(normalize(query))))
  const [draft, setDraft] = useState<{ unit: string; amount: string; day: string; document: string; month: string; note: string } | null>(null)
  const [error, setError] = useState("")
  const [cancel, setCancel] = useState<Payment | null>(null)
  const start = (unit = "") => { setError(""); setDraft({ unit, amount: "", day: vnToday(), document: "", month: "", note: "" }) }
  const savePayment = () => {
    if (!draft) return
    const amount = Number(draft.amount), remaining = allBalances.find((row) => row.id === draft.unit)?.amounts
      .filter((item) => !draft.month || item.row.revenueDay.startsWith(draft.month)).reduce((n, item) => n + item.remaining, 0) ?? 0
    if (!unitIds.has(draft.unit) || !isPositiveMoney(amount) || amount > remaining || !validDayUntil(draft.day) || !referencePattern.test(draft.document.trim())) {
      setError(amount > remaining ? `Không được lớn hơn số còn nợ ${fmt(remaining)}.` : "Kiểm tra đơn vị, số tiền, ngày và số chứng từ.")
      return
    }
    if (save((latest) => {
      const current = balances(ledger, scoped, latest, vnToday()).find((row) => row.id === draft.unit)
      const available = current?.amounts.filter((item) => !draft.month || item.row.revenueDay.startsWith(draft.month)).reduce((n, item) => n + item.remaining, 0) ?? 0
      if (amount > available) throw new Error("Công nợ đã thay đổi. Vui lòng kiểm tra lại số còn nợ.")
      if (latest.payments.some((row) => !row.canceled && row.unit === draft.unit && row.document.toLowerCase() === draft.document.trim().toLowerCase()))
        throw new Error("Số chứng từ đã tồn tại.")
      const row: Payment = { ...draft, amount, document: draft.document.trim(), note: draft.note.trim(), id: crypto.randomUUID(), actor, at: vnNow() }
      return auditRevenue({ ...latest, payments: [row, ...latest.payments] }, actor, "Ghi nhận thanh toán", units.find((unit) => unit.id === row.unit)?.estate ?? "", JSON.stringify(row))
    })) { setDraft(null); notify("Ghi nhận thanh toán thành công.") }
  }
  const exportUnit = (row: Balance) => exportFile("DoiSoatVoucher", () => ({ "Lượt dùng voucher": row.amounts.map(({ row, paid, remaining }) => ({
    "Mã voucher": row.voucher?.code, "Mã lượt": row.id, "Ngày doanh thu": dateCell(row.revenueDay), "Số tiền (₫)": row.debt,
    "Đã trả (₫)": paid, "Còn nợ (₫)": remaining,
  })) }), row.rows.length)
  return <div className="panel">
    <ParkingTabs options={["Công nợ theo đơn vị", "Lịch sử thanh toán"]} value={tab}
      change={(value) => update({ tab: value === "Lịch sử thanh toán" ? "history" : null, page: null })} />
    {(measure || historical) && <div className="parking-banner revenue-list-total">
      {measure && tab === "Công nợ theo đơn vị" && <strong>{voucherDebtMeasures[measure]} đối chiếu: {money(rows.reduce((sum, row) => sum + voucherDebtValue(row, measure), 0))} · </strong>}
      Thanh toán và tuổi nợ tính đến {date(asOf)}
      <Button variant="ghost" onClick={() => update({ debtMeasure: null, debtAsOf: null, debtPeriod: null, page: null })}>Xem công nợ hiện tại</Button>
    </div>}
    <div className="parking-toolbar">
      <div className="parking-inline">
        {tab === "Công nợ theo đơn vị" && <>
          <label className="revenue-toggle"><input type="checkbox" checked={params.get("debtPeriod") === "1"}
            onChange={(e) => update({ debtPeriod: e.target.checked ? "1" : null, page: null })} />Theo kỳ phát sinh</label>
        </>}
        {params.get("unit") && <Button onClick={() => update({ unit: null, page: null })}>Tất cả đơn vị</Button>}
      </div>
      <div className="parking-inline"><ExportButton onClick={() => exportFile("ThanhToanCongNo", () =>
        ({ [tab === "Công nợ theo đơn vị" ? "Công nợ" : "Thanh toán"]: tab === "Công nợ theo đơn vị" ? rows.map(debtRow) : history.map((row) => paymentData(row, state)) }))} />
        {!historical && revenueWrite(access, "payment") && <Button variant="primary" onClick={() => start()}><Plus size={15} />Ghi nhận thanh toán</Button>}</div>
    </div>
    {tab === "Công nợ theo đơn vị" ? <PagedData rows={rows} id={(row) => row.id} params={params} update={update} data={(row) => ({ ...debtRow(row), "Thao tác": "" })}
      link={(row, column) => column === "Thao tác" ? <div className="parking-inline">
        <Button aria-label={`Tải đối soát ${row.name}`} onClick={() => exportUnit(row)}><Download size={14} /></Button>
        <Button onClick={() => update({ tab: "history", unit: row.id, page: null })}>Lịch sử</Button>
        {!historical && unitIds.has(row.id) && row.remaining > 0 && revenueWrite(access, "payment") && <Button onClick={() => start(row.id)}>Ghi nhận</Button>}</div> : undefined} />
      : <PagedData rows={history} id={(row) => row.id} data={(row) => paymentData(row, state)} params={params} update={update}
        link={(row, column) => column === "Trạng thái" ? <Badge tone={row.canceled ? "neutral" : "green"}>{row.canceled ? "Đã hủy" : "Hiệu lực"}</Badge> :
          column === "Thao tác" && !historical && !row.canceled && revenueWrite(access, "payment") ? <Button onClick={() => setCancel(row)}>Hủy thanh toán</Button> : undefined} />}
    {draft && <Overlay title="Ghi nhận thanh toán công nợ" onClose={() => setDraft(null)} footer={<>
      <Button onClick={() => setDraft(null)}>Hủy</Button><Button variant="primary" onClick={savePayment}>Lưu</Button></>}>
      <div className="parking-form-grid">
        <Field label="Đơn vị" required><Select options={[allOption("Chọn đơn vị"), ...allBalances.filter((row) => row.remaining > 0 && unitIds.has(row.id)).map((row) => ({ value: row.id, label: row.name }))]}
          value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></Field>
        <Field label="Số tiền (₫)" required error={error || undefined} hint={draft.unit ? `Còn nợ ${money(allBalances.find((row) => row.id === draft.unit)?.remaining ?? 0)}` : undefined}>
          <Input type="number" min={1} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} /></Field>
        <Field label="Ngày thanh toán" required><Input type="date" max={vnToday()} value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })} /></Field>
        <Field label="Số chứng từ" required><Input maxLength={255} value={draft.document} onChange={(e) => setDraft({ ...draft, document: e.target.value })} /></Field>
        <Field label="Kỳ công nợ được trả" hint="Bỏ trống để trừ vào kỳ cũ nhất còn nợ."><Input type="month" value={draft.month} onChange={(e) => setDraft({ ...draft, month: e.target.value })} /></Field>
        <Field label="Ghi chú"><Textarea maxLength={500} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
          <span className="character-count">{draft.note.length}/500</span></Field>
      </div>
    </Overlay>}
    {cancel && <ReasonDialog title="Hủy thanh toán" description={cancel.document} action="Hủy thanh toán" close={() => setCancel(null)} submit={(reason) => {
      if (save((latest) => {
        if (!latest.payments.some((row) => row.id === cancel.id && !row.canceled)) throw new Error("Thanh toán đã được cập nhật.")
        return auditRevenue({ ...latest, payments: latest.payments.map((row) => row.id === cancel.id ? { ...row, canceled: reason } : row) },
          actor, "Hủy thanh toán", cancel.unit.split("-")[0], `${cancel.document} · ${reason}`)
      })) { setCancel(null); notify("Đã hủy thanh toán.") }
    }} />}
  </div>
}
