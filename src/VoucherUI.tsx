import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import QRCode from "react-qr-code"
import { ArrowRight, CalendarDays, Copy, ListFilter, QrCode, Search, SlidersHorizontal } from "lucide-react"
import { fmt } from "./data"
import { Badge, Button, Field, Form, Input, Overlay, Select } from "./ui"
import CardLookupMultiFilter from "./CardLookupMultiFilter"
import ColumnSettingsDrawer, { readColumnSelection } from "./ColumnSettingsDrawer"
import { allowedSites, displayTime } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import { ParkingPagination, ParkingTable, pageNumber, pageSize } from "./parking-ui"
import type { ExportRow, UpdateParams } from "./parking-ui"
import { formatCell } from "./revenue-tables"
import { benefitText, codeLabel, readVoucherScope, usageText, voucherFilterKeys, voucherKinds } from "./voucher-baseline"
import type { Benefit, BillVoucher, IssuedVoucher, VoucherBaseline, VoucherScope } from "./voucher-baseline"

export function VoucherDateRange({ label, from, to, change, required = false }: { label: string; from: string; to: string; change: (from: string, to: string) => void; required?: boolean }) {
  return <Field label={label} required={required}><div className="date-range"><CalendarDays size={15} />
    <Input type="date" aria-label={`${label} · Từ ngày`} value={from} onChange={(e) => change(e.target.value, to)} />
    <span className="date-arrow"><ArrowRight size={14} /></span><Input type="date" aria-label={`${label} · Đến ngày`} value={to} onChange={(e) => change(from, e.target.value)} />
  </div></Field>
}
export function VoucherFilters({ state, page, access, params, update }: { state: VoucherBaseline; page: string; access: ParkingAccess; params: URLSearchParams; update: UpdateParams }) {
  const initial = readVoucherScope(params, page), signature = JSON.stringify(initial)
  const [form, setForm] = useState<VoucherScope>(initial)
  useEffect(() => setForm(JSON.parse(signature)), [signature])
  const change = (patch: Partial<VoucherScope>) => setForm((old) => ({ ...old, ...patch }))
  const sites = allowedSites(access), report = page === "report", merchants = page === "units", history = page === "history"
  const options = (map: Record<string, string>) => Object.entries(map).map(([value, label]) => ({ value, label }))
  const merchantOptions = state.merchants.filter((row) => row.sites.some((site) => sites.some((allowed) => allowed.id === site)) && (!form.site || row.sites.includes(form.site))).map((row) => ({ value: row.id, label: row.name }))
  const multi = (label: string, key: keyof VoucherScope, choices: { value: string; label: string }[]) => <CardLookupMultiFilter label={label} allLabel={`Tất cả ${label.toLocaleLowerCase("vi")}`} value={form[key].split("|").filter(Boolean)} options={choices}
    note={key === "merchants" ? "Chọn tối đa 20 gian hàng." : undefined} onChange={(values) => change({ [key]: values.slice(0, key === "merchants" ? 20 : undefined).join("|") })} />
  const error = form.from && form.to && form.from > form.to || form.validFrom && form.validTo && form.validFrom > form.validTo
    ? "Ngày kết thúc phải từ ngày bắt đầu trở đi" : report && (!form.from || !form.to) ? "Vui lòng chọn đủ từ ngày và đến ngày" : ""
  const apply = () => !error && update({ vbSite: form.site || null, vbMerchant: form.merchants || null, vbType: form.kind || null, vbStatus: form.status || null,
    vbApplication: form.application || null, vbReference: form.reference || null, vbFrom: form.from || null, vbTo: form.to || null, vbValidFrom: form.validFrom || null, vbValidTo: form.validTo || null,
    q: form.query || null, sessionId: form.session || null, page: null })
  const field = (label: string, key: keyof VoucherScope, choices: { value: string; label: string }[]) => <Field label={label}><Select value={form[key]} options={[{ value: "", label: `Tất cả ${label.toLocaleLowerCase("vi")}` }, ...choices]} onChange={(e) => change({ [key]: e.target.value })} /></Field>
  return <Form className="panel filter-panel lookup-filter-panel voucher-baseline-filters" aria-label="Bộ lọc Voucher" onSubmit={(e) => { e.preventDefault(); apply() }}>
    <div className="filter-heading"><span><ListFilter size={16} /><strong>{report ? "Điều kiện báo cáo" : "Bộ lọc tra cứu"}</strong>{signature !== JSON.stringify(form) && <span className="filter-pending">Chưa áp dụng</span>}</span>
      <Button variant="ghost" onClick={() => { setForm(readVoucherScope(new URLSearchParams(), page)); update({ ...Object.fromEntries(voucherFilterKeys.map((key) => [key, null])), page: null }) }}>Xóa bộ lọc</Button></div>
    {!report && <div className="filter-grid lookup-filter-primary"><Field label="Tìm kiếm"><Input type="search" maxLength={64} value={form.query}
      placeholder={merchants ? "Tìm mã hoặc tên gian hàng..." : history ? "Tìm mã voucher, biển số..." : "Tìm bill ID, tên voucher..."} onChange={(e) => change({ query: e.target.value })} /></Field></div>}
    <div className="filter-grid lookup-filter-row">
      <Field label="Bãi xe"><Select value={form.site} options={[{ value: "", label: "Tất cả bãi xe" }, ...sites.map((row) => ({ value: row.id, label: row.label }))]} onChange={(e) => change({ site: e.target.value, merchants: "" })} /></Field>
      {!merchants && multi(report ? "Gian hàng" : "Gian hàng / Đơn vị", "merchants", merchantOptions)}
      {!merchants && (history || report ? multi("Loại voucher", "kind", options(voucherKinds)) : field("Loại voucher", "kind", options(voucherKinds)))}
      {!report && (history ? multi("Trạng thái mã", "status", options({ NEW: "Còn hiệu lực", CANCELLED: "Đã hủy", EXPIRED: "Hết hạn" })) : field("Trạng thái", "status", options({ active: "Hoạt động", inactive: "Không hoạt động" })))}
      {history && multi("Trạng thái sử dụng", "application", options({ APPLIED: "Đang sử dụng", USED: "Đã sử dụng", REJECTED: "Bị từ chối" }))}
      {!merchants && !report && <Field label="Bill ID"><Input maxLength={100} placeholder="Nhập Bill ID" value={form.reference} onChange={(e) => change({ reference: e.target.value })} /></Field>}
    </div>
    {!merchants && <div className="filter-grid voucher-baseline-periods">
      <VoucherDateRange label={report ? "Khoảng ngày" : "Ngày phát hành"} from={form.from} to={form.to} required={report} change={(from, to) => change({ from, to })} />
      {!report && <VoucherDateRange label="Thời gian hiệu lực" from={form.validFrom} to={form.validTo} change={(validFrom, validTo) => change({ validFrom, validTo })} />}
    </div>}
    {form.session && <div className="parking-chips"><Button variant="ghost" onClick={() => update({ sessionId: null, page: null })}>ID lượt gửi: {form.session} ×</Button></div>}
    {error && <p className="field-message" role="alert">{error}</p>}
    <div className="lookup-filter-footer"><Button variant="primary" type="submit" disabled={!!error}><Search size={14} />Áp dụng</Button></div>
  </Form>
}

export function VoucherTable<T>({ rows, data, rowKey, renderCell, params, update, tableKey, required, columns, controls = true, empty = "Không tìm thấy dữ liệu phù hợp" }: {
  rows: T[]; data: (row: T) => ExportRow; rowKey: (row: T) => string; renderCell?: (row: T, key: string) => ReactNode | undefined
  params: URLSearchParams; update: UpdateParams; tableKey: string; required?: string; columns?: string[]; controls?: boolean; empty?: string
}) {
  const entries = rows.map((row) => ({ row, data: data(row) }))
  const keys = columns ?? (entries.length ? Object.keys(entries[0].data) : [])
  const [legacyHidden] = useState(() => readColumnSelection(`voucher-columns/${tableKey}`) ?? [])
  const [selection, setSelection] = useState(() => readColumnSelection(`voucher-column-selection/${tableKey}`))
  const visible = (selection ?? keys.filter((key) => !legacyHidden.includes(key))).filter((key) => keys.includes(key))
  if (required && keys.includes(required) && !visible.includes(required)) visible.unshift(required)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const sort = params.get("vbSort"), desc = params.get("vbDir") !== "asc"
  const size = pageSize(params.get("size")), page = pageNumber(params.get("page"), entries.length, size)
  const sorted = [...entries].sort((a, b) => {
    if (!sort || !(sort in a.data)) return 0
    const left = a.data[sort], right = b.data[sort]
    const compare = typeof left === "number" && typeof right === "number" ? left - right : left instanceof Date && right instanceof Date ? left.getTime() - right.getTime() : String(left ?? "").localeCompare(String(right ?? ""), "vi")
    return compare * (desc ? -1 : 1)
  })
  const saveColumns = (value: string[]) => {
    setSelection(value); setColumnsOpen(false)
    try { localStorage.setItem(`voucher-column-selection/${tableKey}`, JSON.stringify(value)) } catch { /* Optional view preference. */ }
  }
  return <>
    {controls && <div className="op-table-toolbar lookup-table-toolbar"><div className="lookup-result-summary"><span className="count-text" aria-live="polite"><strong>{fmt(rows.length)}</strong> kết quả</span></div>
      <Button onClick={() => setColumnsOpen(true)}><SlidersHorizontal size={15} />Tùy chỉnh cột</Button></div>}
    <ParkingTable rows={sorted.slice((page - 1) * size, page * size)} rowKey={(entry) => rowKey(entry.row)} empty={empty}
      columns={[{ label: "STT", cell: (entry) => sorted.indexOf(entry) + 1, numeric: true }, ...visible.map((key) => ({ label: key,
        numeric: typeof entries[0]?.data[key] === "number", cell: (entry: typeof entries[number]) => renderCell?.(entry.row, key) ?? <span className="revenue-cell" title={formatCell(entry.data[key])}>{formatCell(entry.data[key])}</span>,
        ...(key === "Thao tác" || !controls ? {} : { sort: { direction: sort === key ? desc ? "descending" as const : "ascending" as const : undefined,
          change: () => update({ vbSort: key, vbDir: sort === key && desc ? "asc" : "desc", page: null }) } }),
      }))]} />
    <ParkingPagination count={rows.length} page={page} size={size} change={(value) => update({ page: String(value) })} changeSize={(value) => update({ size: String(value), page: null })} />
    {columnsOpen && <ColumnSettingsDrawer columns={Object.fromEntries(keys.map((key) => [key, key]))} selected={visible} defaults={keys} required={required}
      onClose={() => setColumnsOpen(false)} onSave={saveColumns} />}
  </>
}
export function VoucherBenefitFields({ value, change, template = false, locked = false, hideType = false }: { value: Benefit; change: (patch: Partial<Benefit>) => void; template?: boolean; locked?: boolean; hideType?: boolean }) {
  return <>
    {!hideType && <Field label="Loại voucher" required><Select disabled={locked} value={value.kind} options={Object.entries(voucherKinds).map(([value, label]) => ({ value, label }))}
      onChange={(e) => change({ kind: e.target.value as Benefit["kind"], amount: 0, hours: 0, minutes: 0 })} /></Field>}
    {value.kind === "AMOUNT" && <Field label={template ? "Số tiền giảm" : "Số tiền khấu trừ (₫)"} required><Input type="number" min={1} step={1} value={value.amount || ""} onChange={(e) => change({ amount: Number(e.target.value) })} /></Field>}
    {value.kind === "DURATION" && <><Field label="Số giờ miễn" required><Input type="number" min={template ? 1 : 0} step={1} value={value.hours} onChange={(e) => change({ hours: Number(e.target.value) })} /></Field>
      <Field label="Số phút miễn thêm" required><Input type="number" min={0} max={59} step={1} value={value.minutes} onChange={(e) => change({ minutes: Number(e.target.value) })} /></Field></>}
    {value.kind === "TIME_WINDOW" && <><Field label={template ? "Từ giờ" : "Giờ bắt đầu"} required><Input type={template ? "time" : "datetime-local"} value={value.windowStart} onChange={(e) => change({ windowStart: e.target.value })} /></Field>
      <Field label={template ? "Đến giờ" : "Giờ kết thúc"} required><Input type={template ? "time" : "datetime-local"} value={value.windowEnd} onChange={(e) => change({ windowEnd: e.target.value })} /></Field></>}
    <Field label="Chế độ sử dụng"><Input value={usageText(value.kind)} readOnly /></Field>
  </>
}
export function VoucherSites({ sites, value, change, disabled = false }: { sites: ReturnType<typeof allowedSites>; value: string[]; change: (value: string[]) => void; disabled?: boolean }) {
  return <fieldset className="voucher-baseline-sites" disabled={disabled}><legend>Bãi xe áp dụng <span className="required">*</span></legend>
    {sites.map((site) => <label key={site.id}><input type="checkbox" checked={value.includes(site.id)} onChange={(e) => change(e.target.checked ? [...value, site.id] : value.filter((id) => id !== site.id))} />{site.label}</label>)}
  </fieldset>
}
const strip = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
export function VoucherTicket({ source, code, state, pending = false, preview = false, notify, cancel }: { source: BillVoucher; code?: IssuedVoucher; state: VoucherBaseline; pending?: boolean; preview?: boolean; notify: (message: string) => void; cancel?: () => void }) {
  const benefit = preview ? source : code?.benefit ?? source
  return <div className={`voucher-baseline-ticket ${code?.canceled ? "voucher-ticket-canceled" : ""}`}>
    {pending && <Badge>Chờ tạo</Badge>}
    <strong className="voucher-ticket-name">{strip(source.name || "Tên voucher")}</strong>
    {code ? <QRCode value={code.value} size={90} role="img" aria-label={`Mã QR của voucher ${code.value}`} /> : <div className="voucher-qr-placeholder"><QrCode size={50} /><small>Chưa có mã</small></div>}
    <b className="voucher-ticket-code">{code?.value ?? "Chua co ma"}</b><span>MA GIAM GIA GUI XE</span><strong>{strip(voucherKinds[benefit.kind])}</strong>
    <dl><div><dt>Bill ID</dt><dd>{source.reference || "—"}</dd></div><div><dt>Gia tri</dt><dd>{strip(benefitText(benefit))}</dd></div>
      <div><dt>Phat hanh</dt><dd>{displayTime(preview ? source.from : code?.created ?? source.from)}</dd></div><div><dt>Hieu luc</dt><dd>{displayTime(preview ? source.until : code?.until ?? source.until)}</dd></div></dl>
    {code && <div className="voucher-ticket-actions"><Badge tone={code.canceled ? "red" : "blue"}>{codeLabel(state, code)}</Badge>
      <Button variant="ghost" aria-label={`Sao chép mã voucher ${code.value}`} onClick={() => navigator.clipboard.writeText(code.value).then(() => notify("Đã sao chép mã voucher"), () => notify("Không thể sao chép mã voucher"))}><Copy size={14} /></Button>
      {cancel && <Button variant="ghost" onClick={cancel}>Hủy</Button>}</div>}
    {code?.canceled && <small>Hủy lúc {displayTime(code.canceled.at)} bởi {code.canceled.by} · {code.canceled.reason}</small>}
  </div>
}
