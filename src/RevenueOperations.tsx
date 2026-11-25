import { useMemo, useState } from "react"
import { Download, LockKeyhole, Plus, UnlockKeyhole } from "lucide-react"
import { Badge, Button, Field, Heading, Input, Label, Overlay, Select, Textarea } from "./ui"
import { date, estates, fmt, normalize } from "./data"
import { allowedSites, displayTime, isDay, siteById, vnNow, vnToday } from "./parking-model"
import type { ParkingAccess, ParkingSettings, Trip } from "./parking-model"
import { allOption, ExportButton, ParkingPagination, ParkingSearch, ParkingTabs, pageNumber, pageSize, Segments, TextLink } from "./parking-ui"
import type { ExportParking, ExportRow, UpdateParams } from "./parking-ui"
import {
  auditRevenue, closeStatus, configAt, dateCell, daysFor, revenueUnits, estateName, methods, monthEnd,
  revenueShifts, revenueWrite, scopeRows, timestampCell, totals, unitTypes,
} from "./revenue-model"
import type { LedgerRow, Payment, RevenueFilter, RevenueShift, RevenueState } from "./revenue-model"
import type { OperationState } from "./operations-model"
import { balances, changeRow, dayRow, debtRow, groupRows, money, voucherDebtMeasures, voucherDebtValue } from "./revenue-tables"
import type { VoucherDebtMeasure } from "./revenue-tables"
import type { Balance } from "./revenue-tables"
import { isPositiveMoney, referencePattern, validDayUntil, validMonth } from "./revenue-operations"
import type { RevenueSave } from "./revenue-operations"
import { DataTable } from "./RevenueDashboard"
import { revenueMatches, revenueValues } from "./revenue-filter-values"
import RevenueSummaryFilters from "./RevenueSummaryFilters"
import { revenueHistoryParams } from "./revenue-entry"
import type { RevenueNavigate } from "./RevenueDashboard"

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
export function RevenueClose({ state, ledger, parking, access, filter, cutoff, actor, params, update, navigate, exportFile, save, notify }: RevenueOperationProps) {
  const monthParam = params.get("month") ?? ""
  const month = validMonth(monthParam) && monthParam <= cutoff.slice(0, 7) ? monthParam : cutoff.slice(0, 7)
  const estate = revenueValues(filter.estate)[0] || access.estate || allowedSites(access)[0]?.estate || ""
  const sites = allowedSites(access).filter((site) => site.estate === estate)
  const last = monthEnd(month) < cutoff ? monthEnd(month) : cutoff
  const days = daysFor(`${month}-01`, last)
  const allShifts = days.flatMap((day) => sites.flatMap((site) => revenueShifts(site.id, day, parking, state)))
  const shiftsByDay = groupRows(allShifts, (shift) => shift.day)
  const periodKey = `${estate}/${month}`
  const locked = !!state.periods[periodKey]
  const status = params.get("closeStatus") || "Tất cả"
  const byShift = groupRows(ledger.filter((row) => row.estate === estate && row.revenueDay.startsWith(month)), (row) => row.shiftId)
  const allRows = allShifts.filter((shift) => revenueMatches(shift.site, filter.site) &&
    (status === "Tất cả" || (status === "Đã chốt") === !!state.closes[shift.id]))
  const done = days.filter((day) => (shiftsByDay.get(day) ?? []).every((shift) => state.closes[shift.id]))
  const canClosePeriod = !locked && monthEnd(month) <= cutoff && days.length > 0 && done.length === days.length
  const adjustments = state.changes.filter((item) => item.estate === estate && item.recorded.startsWith(month))
  const [closing, setClosing] = useState<RevenueShift | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [cash, setCash] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [reopen, setReopen] = useState<RevenueShift | null>(null)
  const [period, setPeriod] = useState(false)
  const opened = closing ? allShifts.filter((shift) => shift.day === closing.day && shift.site === closing.site) : []
  const allDayTotals = allShifts.flatMap((shift) => byShift.get(shift.id) ?? [])
  const closeShift = () => {
    const mismatch = chosen.some((id) => (byShift.get(id) ?? []).some((row) =>
      row.revenue !== row.collected + row.debt + row.lost - row.excess || row.revenue !== row.net + row.vat))
    if (!chosen.length || !cash || (cash === "Lệch" || mismatch) && !note.trim()) {
      setError(!chosen.length ? "Vui lòng chọn ít nhất một ca." : !cash ? "Vui lòng đối chiếu tiền mặt với sổ chốt ca." :
        mismatch ? "Vui lòng nhập ghi chú cho ca có lượt không cân bằng." : "Vui lòng nhập ghi chú khi tiền mặt lệch.")
      return
    }
    if (save((latest) => {
      if (!revenueWrite(access, "shift") || latest.periods[periodKey] || chosen.some((id) => latest.closes[id])) throw new Error("Trạng thái chốt đã thay đổi.")
      const next = { ...latest.closes }
      for (const id of chosen) next[id] = { actor, at: vnNow(), note: [cash, note.trim()].filter(Boolean).join(" · "),
        frozen: Object.fromEntries((byShift.get(id) ?? []).filter((row) => row.source === "MT").map((row) => [row.id, row])) }
      return auditRevenue({ ...latest, closes: next }, actor, "Chốt ca", estate, `${chosen.join(", ")} · ${cash} · ${note}`)
    })) { setClosing(null); notify(`Đã chốt ${chosen.length} ca.`) }
  }
  const unclose = (reason: string) => {
    if (!reopen) return
    if (save((latest) => {
      if (!revenueWrite(access, "reopen") || latest.periods[periodKey] || !latest.closes[reopen.id]) throw new Error("Ca không thể mở chốt.")
      const next = { ...latest.closes }
      delete next[reopen.id]
      return auditRevenue({ ...latest, closes: next }, actor, "Mở chốt", estate, `${reopen.id} · ${reason}`)
    })) { setReopen(null); notify("Đã mở chốt ca.") }
  }
  const closePeriod = () => {
    if (!canClosePeriod) return
    if (save((latest) => {
      if (!revenueWrite(access, "period") || latest.periods[periodKey] || allShifts.some((shift) => !latest.closes[shift.id])) throw new Error("Kỳ còn ca chưa chốt.")
      return auditRevenue({ ...latest, periods: { ...latest.periods, [periodKey]: { actor, at: vnNow(), note: "Chốt kỳ", frozen: {} } } },
        actor, "Chốt kỳ", estate, month)
    })) { setPeriod(false); notify("Đã chốt kỳ.") }
  }
  const sap = () => exportFile("ZFI014", () => ({
    "Thông tin": [{ "Khu đô thị": estateName(estate), "Kỳ": month, "Ngày đưa vào": done.join(", "),
      "Ngày chưa chốt bị loại": days.filter((day) => !done.includes(day)).join(", "), "Người xuất": actor, "Thời điểm": timestampCell(vnNow()),
      "Mã SAP": configAt(state, estate, last).mall || "Chưa khai báo mã TTTM" }],
    "1-SoLieu": done.flatMap((day) => {
      const config = configAt(state, estate, day)
      if (!config.mall) return []
      const total = totals(allDayTotals.filter((row) => row.revenueDay === day))
      return [{ "mã TTTM": config.mall, "tổng tiền": total.collected, "Ngày doanh thu": dateCell(day),
        ...Object.fromEntries(methods.map((method, i) => [method, total.moneyByMethod[i]])), "Chưa VAT": total.net, "VAT": total.vat }]
    }),
    "2-CongNo": [
      ...allDayTotals.filter((row) => row.debt && done.includes(row.revenueDay)).map((row) => ({
        "Loại": "Phát sinh", "Ngày": dateCell(row.revenueDay), "Đơn vị": row.voucher?.unit, "Chứng từ": row.id, "Số tiền": row.debt,
      })),
      ...state.payments.filter((row) => !row.canceled && row.day.startsWith(month) && row.unit.startsWith(`${estate}-`)).map((row) => ({
        "Loại": "Đã trả", "Ngày": dateCell(row.day), "Đơn vị": row.unit, "Chứng từ": row.document, "Số tiền": row.amount,
      })),
    ],
    "3-DieuChinh": adjustments.map(changeRow),
  }))
  const shiftData = (shift: RevenueShift) => ({ "Ngày doanh thu": dateCell(shift.day), "Bãi xe": siteById(shift.site)?.label,
    ...dayRow(shift.name, byShift.get(shift.id) ?? [], state.closes[shift.id] ? "Đã chốt" : "Chưa chốt"),
    "Người chốt": state.closes[shift.id]?.actor, "Thời điểm": state.closes[shift.id] ? timestampCell(state.closes[shift.id].at) : null,
    "Trạng thái ngày": closeStatus(state, estate, shift.day, shiftsByDay.get(shift.day) ?? []), "Thao tác": "",
  })
  return <>
    <RevenueSummaryFilters estate={estate} site={filter.site} month={month} cutoff={cutoff} access={access} update={update} />
    <div className="panel parking-toolbar revenue-toolbar">
      <div className="parking-inline">
        {revenueWrite(access, "period") && <Button onClick={sap}><Download size={15} />Tải số liệu ZFI014</Button>}
        {revenueWrite(access, "period") && <Button variant="primary" disabled={locked} onClick={() => setPeriod(true)}>Chốt kỳ</Button>}
      </div>
    </div>
    <div className={`parking-banner ${locked ? "" : "warning"}`}><LockKeyhole size={16} />
      {locked ? "Đã chốt kỳ" : "Kỳ đang mở"} · {done.length}/{days.length} ngày đã chốt
      {adjustments.length > 0 && <TextLink onClick={() => { const period = { estate, site: "", vehicle: "", start: `${month}-01`, end: last }; navigate({ ...period, ...revenueHistoryParams(period) }, "revenue-lookup", false) }}>
        {adjustments.length} khoản điều chỉnh sau chốt</TextLink>}
    </div>
    {!configAt(state, estate, last).mall && <div className="parking-banner warning">Khu đô thị chưa khai báo mã TTTM cho ZFI014.</div>}
    <div className="panel">
      <div className="parking-toolbar"><Segments options={["Tất cả", "Chưa chốt", "Đã chốt"]} value={status} change={(value) => update({ closeStatus: value, page: null })} /></div>
      <PagedData rows={allRows.sort((a, b) => b.day.localeCompare(a.day) || a.site.localeCompare(b.site) || a.name.localeCompare(b.name))} id={(row) => row.id}
        params={params} update={update} data={shiftData} link={(row, column) => {
          if (column !== "Thao tác" || locked) return undefined
          if (state.closes[row.id] && revenueWrite(access, "reopen")) return <Button variant="ghost" onClick={() => setReopen(row)}><UnlockKeyhole size={15} />Mở chốt</Button>
          if (!state.closes[row.id] && revenueWrite(access, "shift")) return <Button onClick={() => {
            setClosing(row); setChosen([row.id]); setCash(""); setNote(""); setError("")
          }}>Chốt ca</Button>
        }} />
    </div>
    {closing && <Overlay wide title={`Chốt ca · ${siteById(closing.site)?.label}`} subtitle={date(closing.day)} onClose={() => setClosing(null)}
      footer={<><Button onClick={() => setClosing(null)}>Hủy</Button><Button variant="primary" onClick={closeShift}>Chốt {chosen.length} ca</Button></>}>
      <DataTable rows={opened} rowKey={(row) => row.id} data={(row) => ({ "Chọn": "", ...shiftData(row) })}
        link={(row, column) => column === "Chọn" ? <input aria-label={`Chọn ${row.name}`} type="checkbox" disabled={!!state.closes[row.id]}
          checked={chosen.includes(row.id)} onChange={(e) => setChosen(e.target.checked ? [...chosen, row.id] : chosen.filter((id) => id !== row.id))} /> : undefined} />
      <div className="parking-form-grid"><Field label="Tiền mặt so với sổ chốt ca" required><Select value={cash}
        options={[allOption("Chọn kết quả"), "Khớp", "Lệch"]} onChange={(e) => setCash(e.target.value)} /></Field>
        <Field label="Ghi chú" required={cash === "Lệch"}><Textarea maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <span className="character-count">{note.length}/500</span></Field></div>
      {error && <p className="field-message" role="alert">{error}</p>}
    </Overlay>}
    {reopen && <ReasonDialog title="Mở chốt ca" description={`${date(reopen.day)} · ${reopen.name}`} action="Mở chốt" close={() => setReopen(null)} submit={unclose} />}
    {period && <Overlay title={`Chốt kỳ ${month.split("-").reverse().join("/")}`} subtitle={estateName(estate)} onClose={() => setPeriod(false)} dismissOnBackdrop={false}
      footer={<><Button autoFocus onClick={() => setPeriod(false)}>Hủy</Button><Button variant="primary" disabled={!canClosePeriod} onClick={closePeriod}>Xác nhận chốt kỳ</Button></>}>
      <p>{done.length}/{days.length} ngày đã chốt · Doanh thu {money(totals(allDayTotals).revenue)} · {adjustments.length} điều chỉnh</p>
      {monthEnd(month) > cutoff && <p className="field-message">Kỳ chưa kết thúc.</p>}
      {allShifts.some((shift) => !state.closes[shift.id]) && <p className="field-message">Ca chưa chốt: {allShifts.filter((shift) => !state.closes[shift.id])
        .map((shift) => `${date(shift.day)} · ${siteById(shift.site)?.name} · ${shift.name}`).join("; ")}</p>}
      {canClosePeriod && <p className="field-message">Kỳ đã chốt không thể mở lại.</p>}
    </Overlay>}
  </>
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
