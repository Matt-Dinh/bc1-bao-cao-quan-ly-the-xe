import { useEffect, useState } from "react"
import { ListFilter, Search } from "lucide-react"
import { Button, Field, Form, Input, Overlay, Select } from "./ui"
import RevenueMultiFilter from "./RevenueMultiFilter"
import { revenueMatches, revenueValues, revenueSelectionLabel } from "./revenue-filter-values"
import { voucherPurposes } from "./revenue-vouchers"
import ReportPeriodFields from "./ReportPeriodFields"
import { estates } from "./data"
import { allowedSites, parkingVehicles } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import { allOption } from "./parking-ui"
import type { UpdateParams } from "./parking-ui"
import { revenueUnits, lossReasons, revenuePeriodError, sources, subscriptionGroups, unitTypes } from "./revenue-model"
import type { LedgerRow, RevenueFilter, RevenueScreen, RevenueState } from "./revenue-model"
import { measureOptions, readRevenueLookup, revenueLookupKeys } from "./revenue-lookup"

export default function RevenueFilters({ screen, filter, cutoff, access, params, state, ledger, update, history = false }: {
  screen: RevenueScreen; filter: RevenueFilter; cutoff: string; access: ParkingAccess; params: URLSearchParams
  state: RevenueState; ledger: LedgerRow[]; update: UpdateParams; history?: boolean
}) {
  const lookup = screen === "revenue-lookup" && !history
  const applied = readRevenueLookup(params, filter)
  const [draft, setDraft] = useState<Record<string, string> | null>(null)
  const [shiftSearch, setShiftSearch] = useState("")
  const sites = allowedSites(access)
  const permitted = estates.filter((estate) => sites.some((site) => site.estate === estate.id))
  const initial = { ...filter, ...Object.fromEntries(applied), ...(history ? { changeDate: params.get("changeDate") || "recorded" } : {}) }
  const signature = JSON.stringify(initial)
  const [form, setForm] = useState<Record<string, string>>(initial)
  useEffect(() => { setForm(JSON.parse(signature)) }, [signature])
  const scope: RevenueFilter = { estate: form.estate || "", site: form.site || "", vehicle: form.vehicle || "", start: form.start, end: form.end }
  const change: UpdateParams = (patch) => setForm((old) => ({ ...old, ...Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value ?? ""])), drill: "", page: "" }))
  const selected = Object.fromEntries(revenueLookupKeys.map((key) => [key, form[key] || ""]))
  const pending = JSON.stringify(form) !== signature
  const units = revenueUnits(state).filter((unit) => revenueMatches(unit.estate, scope.estate) && sites.some((site) => site.estate === unit.estate))
  const multi = (label: string, key: string, allLabel: string, options: readonly (string | { value: string; label: string })[]) => <RevenueMultiFilter label={label} value={form[key] || ""} allLabel={allLabel} options={options} change={(value) => change({ [key]: value })} />
  const fieldOptions = {
    source: [allOption("Tất cả nguồn thu"), { value: "included", label: "Các khoản có doanh thu" }, ...Object.entries(sources).map(([value, label]) => ({ value, label }))],
    amount: [allOption("Tất cả chỉ tiêu"), ...measureOptions],
    balance: [allOption("Tất cả tình trạng"), { value: "paid", label: "Đã thu đủ" }, { value: "unpaid", label: "Chưa thu đủ" }, { value: "debt", label: "Có công nợ voucher" }, { value: "lost", label: "Có thất thu" }, { value: "excess", label: "Có thu thừa" }, { value: "free", label: "Miễn phí toàn bộ" }],
    policy: [allOption("Tất cả chính sách"), { value: "*", label: "Có áp dụng miễn / giảm" }, ...state.policies.map((row) => ({ value: row.code, label: row.name }))],
    review: [allOption("Tất cả lượt"), { value: "1", label: "Cần kiểm tra miễn / giảm" }],
    reason: [allOption("Tất cả lý do"), ...lossReasons.map((value) => ({ value, label: value }))],
    unitType: [allOption("Tất cả loại đơn vị"), ...unitTypes.map((value) => ({ value, label: value }))],
    unit: [allOption("Tất cả đơn vị"), ...units.map((unit) => ({ value: unit.id, label: unit.name }))],
    shift: [allOption("Tất cả ca"), ...[...new Map(ledger.filter((row) => sites.some((site) => site.id === row.site) &&
      revenueMatches(row.estate, scope.estate) && revenueMatches(row.site, scope.site) && row.revenueDay >= scope.start && row.revenueDay <= scope.end)
      .map((row) => [row.shiftId, { value: row.shiftId, label: `${row.revenueDay.split("-").reverse().join("/")} · ${sites.find((site) => site.id === row.site)?.label} · ${row.shiftName}` }])).values()]],
    group: [allOption("Tất cả nhóm thuê bao"), ...subscriptionGroups.map((value) => ({ value, label: value }))],
    countOnly: [allOption("Tất cả khoản thu"), { value: "1", label: "Chỉ lượt gửi xe" }],
    freeOnly: [allOption("Tất cả lượt"), { value: "1", label: "Chỉ lượt miễn toàn bộ" }],
    closeStatus: [allOption("Tất cả trạng thái"), { value: "open", label: "Tạm tính" }, { value: "shift", label: "Đã chốt ca" }, { value: "period", label: "Đã chốt kỳ" }],
  }
  const labels = { source: "Nguồn thu", amount: "Số liệu từ báo cáo", balance: "Tình trạng thu tiền", policy: "Chính sách miễn / giảm", review: "Kiểm tra miễn / giảm", reason: "Lý do thất thu", unitType: "Loại đơn vị", unit: "Đơn vị nhận voucher", shift: "Ca trực", group: "Nhóm thuê bao", countOnly: "Phạm vi", freeOnly: "Miễn phí", closeStatus: "Trạng thái chốt" }
  const selectionText = (key: string, value: string, compact = false) => key === "policy" && compact && revenueValues(value).length > 2
    ? `${revenueValues(value).length} mã chính sách / voucher`
    : revenueSelectionLabel(value, (item) => fieldOptions[key as keyof typeof fieldOptions]?.find((option) => option.value === item)?.label || item)
  const advancedKeys = ["shift", "closeStatus", "policy", "unit", "reason", "review", "month", "group"] as const
  const advancedCount = lookup ? advancedKeys.filter((key) => selected[key]).length + (form.sort && form.sort !== "new" ? 1 : 0) : 0
  const appliedKeys = revenueLookupKeys.filter((key) => applied.get(key) && !["source", "balance"].includes(key))
  const debtHistory = screen === "revenue-debt" && params.get("tab") === "history"
  const voucherTab = params.get("voucherTab") || "sources"
  const configuration = screen === "revenue-policies" || screen === "revenue-settings"
  const showSite = screen !== "revenue-settings" && (screen !== "revenue-voucher" || voucherTab !== "units") && !debtHistory
  const showVehicle = showSite && !history && !(screen === "revenue-voucher" && ["sources", "report"].includes(voucherTab))
  const showPeriod = !configuration && (screen === "revenue-voucher" ? voucherTab !== "units" : screen !== "revenue-debt" || params.get("debtPeriod") === "1")
  const reset = () => {
    const keys = [...revenueLookupKeys, "estate", "site", "vehicle", "q", "voucherPurpose", "voucherUnit", "voucherStatus", "voucherSource", "inputStatus", "policyStatus", "unitType", "condition", ...(lookup ? ["sort"] : [])]
    setForm({ ...initial, ...Object.fromEntries(keys.map((key) => [key, ""])), ...(history ? { changeDate: "recorded" } : {}) })
    update({ ...Object.fromEntries(keys.map((key) => [key, null])), ...(history ? { changeDate: null } : {}) })
  }
  const error = showPeriod ? revenuePeriodError(scope, cutoff) : ""
  const apply = () => { if (!error) update({ ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value || null])), drill: null, page: null }) }
  const placeholder = history ? "Tìm mã lượt, mã chứng từ, lý do" : screen === "revenue-paper" ? "Tìm mã lần nhập" : screen === "revenue-receipt" ? "Tìm số phiếu, khách thuê bao, mã thẻ" : screen === "revenue-voucher" ? "Tìm mã voucher, nguồn phát hành, đơn vị" : screen === "revenue-debt" ? "Tìm đơn vị hoặc số chứng từ" : screen === "revenue-policies" ? "Tìm mã hoặc tên chính sách" : "Tìm mã lượt, biển số, thẻ, vé, giao dịch, voucher"
  return <Form className={`panel filter-panel lookup-filter-panel revenue-filter-panel${lookup && !selected.month ? " revenue-lookup-filters" : ""}`} aria-label="Bộ lọc doanh thu và voucher" onSubmit={(event) => { event.preventDefault(); apply() }}>
    <div className="filter-heading"><span><ListFilter size={16} /><strong>{screen === "revenue-report" ? "Điều kiện báo cáo" : "Bộ lọc tra cứu"}</strong>{pending && <span className="filter-pending">Chưa áp dụng</span>}</span>
      <Button variant="ghost" onClick={reset}>Xóa bộ lọc</Button></div>
    {!["revenue-report", "revenue-settings"].includes(screen) && !(screen === "revenue-voucher" && voucherTab === "report") && <div className="filter-grid lookup-filter-primary"><Field label="Tìm kiếm"><Input type="search" maxLength={100} placeholder={placeholder} value={form.q || ""} onChange={(event) => change({ q: event.target.value })} /></Field></div>}
    <div className="filter-grid lookup-filter-row">
      <RevenueMultiFilter label="Khu đô thị" value={scope.estate} allLabel="Tất cả khu đô thị" options={permitted.map((estate) => ({ value: estate.id, label: estate.name }))} change={(value) => {
        const kept = revenueValues(scope.site).filter((id) => sites.some((site) => site.id === id && revenueMatches(site.estate, value)))
        change({ estate: value, site: kept.join("|"), shift: null, unit: null, voucherUnit: null, voucherSource: null, voucherDetail: null })
      }} />
      {showSite && multi("Bãi xe", "site", "Tất cả bãi xe", sites.filter((site) => revenueMatches(site.estate, scope.estate)).map((site) => ({ value: site.id, label: site.label })))}
      {showVehicle && multi("Phương tiện", "vehicle", "Tất cả phương tiện", [...parkingVehicles, "Chưa xác định"])}
      {history && <Field label="Tra cứu theo"><Select value={form.changeDate || "recorded"} options={[
        { value: "recorded", label: "Ngày ghi nhận" }, { value: "origin", label: "Ngày doanh thu gốc" },
      ]} onChange={(event) => change({ changeDate: event.target.value })} /></Field>}
      {lookup && !selected.month && <>
        {multi("Nguồn thu", "source", "Tất cả nguồn thu", fieldOptions.source.filter((option) => option.value))}
        <Field label="Tình trạng thu tiền"><Select value={form.balance || ""} options={fieldOptions.balance} onChange={(event) => change({ balance: event.target.value })} /></Field>
      </>}
      {screen === "revenue-voucher" && voucherTab !== "units" && <>
        {multi("Loại nghiệp vụ voucher", "voucherPurpose", "Tất cả loại nghiệp vụ", Object.entries(voucherPurposes).map(([value, label]) => ({ value, label })))}
        {multi("Đơn vị nhận voucher", "voucherUnit", "Tất cả đơn vị nhận", units.map((unit) => ({ value: unit.id, label: unit.name })))}
        {["history", "sources"].includes(voucherTab) && multi("Trạng thái voucher", "voucherStatus", "Tất cả trạng thái", voucherTab === "sources" ? [{ value: "active", label: "Hoạt động" }, { value: "inactive", label: "Không hoạt động" }] : [{ value: "APPLIED", label: "Đang áp dụng" }, { value: "USED", label: "Đã sử dụng" }, { value: "REJECTED", label: "Bị loại khi chốt" }])}
      </>}
      {screen === "revenue-debt" && <>{multi("Loại đơn vị", "unitType", "Tất cả loại đơn vị", unitTypes)}{multi("Đơn vị nhận voucher", "unit", "Tất cả đơn vị nhận", units.map((unit) => ({ value: unit.id, label: unit.name })))}{!debtHistory && multi("Tình trạng công nợ", "condition", "Tất cả tình trạng", ["Còn nợ", "Quá hạn", "Đã trả hết"])}</>}
      {screen === "revenue-paper" && multi("Trạng thái lần nhập", "inputStatus", "Tất cả trạng thái", ["Đã nhập", "Đã hủy"])}
      {screen === "revenue-policies" && multi("Trạng thái chính sách", "policyStatus", "Tất cả trạng thái", ["Hoạt động", "Không hoạt động"])}
    </div>
    <p className="lookup-multi-hint">Trong cùng một bộ lọc: khớp một trong các lựa chọn. Giữa các bộ lọc: đáp ứng đồng thời.</p>
    <div className="lookup-time-section"><div className="lookup-time-fields">
      {showPeriod && <ReportPeriodFields period={scope} max={cutoff} error={error} label={screen === "revenue-report" ? "Kỳ báo cáo" : screen === "revenue-receipt" ? "Ngày lập" : screen === "revenue-paper" ? "Thời điểm nhập" : screen === "revenue-debt" ? "Kỳ phát sinh" : screen === "revenue-voucher" ? voucherTab === "sources" ? "Ngày phát hành" : "Kỳ báo cáo sử dụng" : "Khoảng ngày tra cứu"}
        onChange={(period) => change({ ...period, shift: null })} />}
    </div></div>
    {lookup && appliedKeys.length > 0 && <div className="parking-chips revenue-filter-chips" aria-label="Bộ lọc doanh thu đang áp dụng">
      {appliedKeys.map((key) => <Button key={key} variant="ghost" title={key === "policy" ? selectionText(key, applied.get(key)!) : undefined} onClick={() => update({ ...Object.fromEntries(applied), [key]: null, ...(key === "month" ? { group: null, amount: null } : {}), page: null, drill: null })}>
        {key === "month" ? `Tháng dịch vụ: ${applied.get(key)!.split("-").reverse().join("/")}` : `${labels[key]}: ${selectionText(key, applied.get(key)!, true)}`} ×
      </Button>)}
    </div>}
    {lookup && selected.month && <p className="parking-chart-note">Doanh thu thuê bao tính theo tháng dịch vụ {selected.month.split("-").reverse().join("/")}; khoảng ngày áp dụng cho lượt và khoản thu.</p>}
    {draft && <Overlay drawer title="Bộ lọc nâng cao" onClose={() => setDraft(null)} footer={<>
      <Button onClick={() => setDraft({ ...draft, ...Object.fromEntries(advancedKeys.map((key) => [key, ""])), sort: "", ...(draft.month ? { amount: "", group: "" } : {}) })}>Xóa bộ lọc</Button>
      <Button variant="primary" disabled={!!draft.month && (!/^\d{4}-\d{2}$/.test(draft.month) || draft.month > cutoff.slice(0, 7))} onClick={() => { change({ ...draft }); setDraft(null) }}>Xong</Button>
    </>}><div className="parking-drawer-fields">
      <Field label="Dữ liệu tra cứu"><Select value={draft.month ? "subscription" : "ledger"} options={[{ value: "ledger", label: "Lượt xe và khoản thu" }, { value: "subscription", label: "Doanh thu thuê bao" }]}
        onChange={(event) => setDraft({ ...Object.fromEntries(revenueLookupKeys.map((key) => [key, ""])), month: event.target.value === "subscription" ? scope.end.slice(0, 7) : "" })} /></Field>
      {draft.month && <Field label="Tháng dịch vụ" required><Input type="month" max={cutoff.slice(0, 7)} value={draft.month}
        onChange={(event) => setDraft({ ...draft, month: event.target.value })} /></Field>}
      {!draft.month && <Field label="Sắp xếp kết quả"><Select value={draft.sort || "new"} options={[
        { value: "new", label: "Giờ ra mới nhất" }, { value: "old", label: "Giờ ra cũ nhất" }, { value: "amount", label: "Doanh thu cao nhất" },
      ]} onChange={(event) => setDraft({ ...draft, sort: event.target.value })} /></Field>}
      {Object.entries(labels).filter(([key]) => draft.month ? key === "group" : ["shift", "closeStatus", "policy", "unit", "reason", "review"].includes(key)).map(([key, label]) => {
        const choices = fieldOptions[key as keyof typeof fieldOptions]
        const filtered = key === "shift" ? choices.filter((option) => !option.value || option.value === draft.shift || option.label.toLocaleLowerCase("vi-VN").includes(shiftSearch.trim().toLocaleLowerCase("vi-VN"))) : choices
        const options = filtered.some((option) => option.value === draft[key]) ? filtered : [...filtered, { value: draft[key], label: selectionText(key, draft[key], true) }]
        return <div key={key}>{key === "shift" && choices.length > 10 && <Field label="Tìm ca doanh thu"><Input type="search" value={shiftSearch} placeholder="Ngày, bãi xe hoặc tên ca" onChange={(event) => setShiftSearch(event.target.value)} /></Field>}
          <Field label={label}><Select value={draft[key]} options={options} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></Field></div>
      })}
    </div></Overlay>}
    <div className="lookup-filter-footer">
      {lookup && <Button onClick={() => { setDraft({ ...selected, sort: form.sort || "" }); setShiftSearch("") }}><ListFilter size={15} />Bộ lọc nâng cao{advancedCount ? ` (${advancedCount})` : ""}</Button>}
      <Button variant="primary" type="submit" disabled={!!error}><Search size={14} />Áp dụng</Button></div>
  </Form>
}
