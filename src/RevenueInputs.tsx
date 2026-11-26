import { useState } from "react"
import type { ReactNode } from "react"
import { Plus, Upload } from "lucide-react"
import { Badge, Button, Field, Input, Overlay, Select, Textarea } from "./ui"
import { fmt, normalize } from "./data"
import { allowedSites, dayAt, siteById, parkingVehicles, vnNow, vnToday } from "./parking-model"
import { allOption, ExportButton, ParkingSearch, ParkingTabs, TextLink } from "./parking-ui"
import type { ExportRow } from "./parking-ui"
import {
  auditRevenue, dateCell, estateName, methods, revenueShifts, revenueWrite, timestampCell,
} from "./revenue-model"
import type { Method, PaperBatch, PaperRow, Receipt, RevenueState } from "./revenue-model"
import { changeLedger, isPositiveMoney, referencePattern, validDayUntil } from "./revenue-operations"
import { DataTable } from "./RevenueDashboard"
import { PagedData, ReasonDialog } from "./RevenueOperations"
import { revenueMatches } from "./revenue-filter-values"
import type { RevenueOperationProps } from "./RevenueOperations"

const paperHeaders = ["Ngày doanh thu", "Ca", "Khu đô thị", "Mã bãi", "Loại xe", "Series từ", "Series đến", "Số lượt", "Thành tiền (₫)", "Phương thức"]
const paperData = (row: PaperRow): ExportRow => ({
  "Ngày doanh thu": dateCell(row.day), "Ca": row.shift, "Khu đô thị": siteById(row.site)?.estate, "Mã bãi": row.site,
  "Loại xe": row.vehicle, "Series từ": row.from, "Series đến": row.to, "Số lượt": row.to - row.from + 1,
  "Thành tiền (₫)": row.amount, "Phương thức": row.method,
})
type ImportRow = { cells: ExportRow; row: PaperRow; index: number; error: string; duplicate?: boolean }
export function RevenuePaper({ state, trips, parking, access, filter, cutoff, actor, params, update, exportFile, save, notify, startNew = false, formOnly = false, onFormClose }: RevenueOperationProps & { startNew?: boolean; formOnly?: boolean; onFormClose?: () => void }) {
  const sites = allowedSites(access)
  const visible = (site: string) => sites.some((item) => item.id === site) && revenueMatches(site, filter.site) &&
    revenueMatches(siteById(site)?.estate, filter.estate)
  const batches = state.papers.flatMap((batch) => {
    const enteredDay = dayAt(batch.at)
    if (enteredDay < filter.start || enteredDay > filter.end) return []
    const rows = batch.rows.filter((row) => visible(row.site) && revenueMatches(row.vehicle, filter.vehicle))
    return rows.length ? [{ ...batch, rows, complete: batch.rows.every((row) => visible(row.site)) }] : []
  }).filter((batch) => (!params.get("q") || normalize(batch.id).includes(normalize(params.get("q")!))) &&
    revenueMatches(batch.canceled ? "Đã hủy" : "Đã nhập", params.get("inputStatus")))
  const [open, setOpen] = useState(startNew && revenueWrite(access, "paper"))
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [preview, setPreview] = useState<ImportRow[]>([])
  const [tab, setTab] = useState("Tất cả")
  const [detail, setDetail] = useState<PaperBatch | null>(null)
  const [cancel, setCancel] = useState<PaperBatch | null>(null)
  const editable = revenueWrite(access, "paper")
  const overlap = (a: PaperRow, b: PaperRow) => siteById(a.site)?.estate === siteById(b.site)?.estate && a.from <= b.to && a.to >= b.from
  const validate = (row: PaperRow, latest: RevenueState) => {
    if (!sites.some((site) => site.id === row.site)) return "Bãi xe ngoài phạm vi quyền."
    if (!validDayUntil(row.day, cutoff)) return "Ngày doanh thu chưa có số liệu hoặc không hợp lệ."
    if (!parkingVehicles.slice(0, 3).includes(row.vehicle)) return "Loại xe không hợp lệ."
    if (!Number.isSafeInteger(row.from) || !Number.isSafeInteger(row.to) || row.from < 1 || row.from > row.to) return "Khoảng series không hợp lệ."
    if (!Number.isSafeInteger(row.amount) || row.amount < 0) return "Thành tiền phải là số nguyên không âm."
    if (!methods.includes(row.method)) return "Phương thức không hợp lệ."
    const shifts = revenueShifts(row.site, row.day, parking, latest)
    const shift = row.shift ? shifts.find((shift) => shift.name === row.shift) : shifts[shifts.length - 1]
    if (!shift) return "Ca không thuộc bãi hoặc ngày đã chọn."
    if (latest.closes[shift.id] && !revenueWrite(access, "adjust")) return "Ca đã chốt."
    return ""
  }
  const checkFile = async () => {
    if (!file || busy) return
    setError(""); setPreview([]); setTab("Tất cả")
    if (!/\.(xlsx|xls)$/i.test(file.name) || file.size > 10 * 1024 * 1024) { setError("Chỉ nhận tệp XLSX hoặc XLS tối đa 10 MB."); return }
    setBusy(true)
    try {
      const XLSX = await import("xlsx")
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
      const sheet = book.Sheets[book.SheetNames[0]]
      const header = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? []
      if (!paperHeaders.every((key) => header.includes(key))) throw new Error("Tiêu đề cột chưa đúng. Vui lòng dùng file mẫu.")
      const source = XLSX.utils.sheet_to_json<ExportRow>(sheet, { defval: "" })
      if (!source.length || source.length > 10000) throw new Error("File phải có từ 1 đến 10.000 dòng.")
      const accepted = state.papers.filter((batch) => !batch.canceled).flatMap((batch) => batch.rows)
      setPreview(source.map((cells, i) => {
        const raw = cells["Ngày doanh thu"]
        const excel = typeof raw === "number" ? XLSX.SSF.parse_date_code(raw) : null
        const day = raw instanceof Date ? raw.toISOString().slice(0, 10) : excel ?
          `${excel.y}-${String(excel.m).padStart(2, "0")}-${String(excel.d).padStart(2, "0")}` :
          /^\d\d\/\d\d\/\d{4}$/.test(String(raw).trim()) ? String(raw).trim().split("/").reverse().join("-") : String(raw).trim()
        const row: PaperRow = { site: String(cells["Mã bãi"]).trim(), day, shift: String(cells.Ca || "").trim(),
          vehicle: String(cells["Loại xe"]).trim() as PaperRow["vehicle"], from: Number(cells["Series từ"]), to: Number(cells["Series đến"]),
          amount: String(cells["Thành tiền (₫)"]).trim() ? Number(cells["Thành tiền (₫)"]) : NaN,
          method: (String(cells["Phương thức"]).trim() || "Tiền mặt") as Method }
        const issue = validate(row, state) || (String(cells["Khu đô thị"]).trim() !== siteById(row.site)?.estate ? "Mã khu đô thị không khớp bãi." : "") ||
          (Number(cells["Số lượt"]) !== row.to - row.from + 1 ? "Số lượt phải bằng số series." : "")
        const duplicate = !issue && accepted.some((other) => overlap(other, row))
        if (!issue && !duplicate) accepted.push(row)
        return { cells, row, index: i + 2, error: issue || (duplicate ? "Series trùng với dữ liệu đã nhập hoặc dòng khác." : ""), duplicate }
      }))
    } catch (error) { setError(error instanceof Error ? error.message : "Không thể đọc tệp.") }
    finally { setBusy(false) }
  }
  const accepted = preview.filter((row) => !row.error)
  const saveBatch = () => {
    if (!editable || !accepted.length) return
    if (save((latest) => {
      const prior = latest.papers.filter((batch) => !batch.canceled).flatMap((batch) => batch.rows)
      for (const { row } of accepted) {
        const issue = validate(row, latest)
        if (issue || prior.some((other) => overlap(other, row))) throw new Error(issue || "Series vừa được nhập. Vui lòng kiểm tra lại file.")
        prior.push(row)
      }
      const batch = { id: `NVG-${crypto.randomUUID().slice(0, 8)}`, at: vnNow(), actor, rows: accepted.map((row) => row.row) }
      const next = { ...latest, papers: [batch, ...latest.papers] }
      return auditRevenue(changeLedger(latest, next, trips, parking, batch.rows.map((_, i) => `${batch.id}-${i + 1}`),
        "Nhập vé giấy sau chốt", actor, revenueWrite(access, "adjust")), actor, "Nhập vé giấy", access.estate, JSON.stringify(batch))
    })) { setOpen(false); onFormClose?.(); notify(`Đã nhập ${accepted.length} dòng vé giấy.`) }
  }
  const data = (row: PaperBatch) => ({
    "Mã lần nhập": row.id, "Thời điểm nhập": timestampCell(row.at), "Người nhập": row.actor,
    "Khu đô thị · bãi": [...new Set(row.rows.map((item) => siteById(item.site)?.label))].join(", "),
    "Ngày doanh thu": [...new Set(row.rows.map((item) => item.day))].sort().join(", "),
    "Số dòng": row.rows.length, "Số lượt": row.rows.reduce((sum, row) => sum + row.to - row.from + 1, 0),
    "Thành tiền (₫)": row.rows.reduce((sum, row) => sum + row.amount, 0), "Trạng thái": row.canceled ? "Đã hủy" : "Đã nhập",
    "Lý do hủy": row.canceled, "Thao tác": "",
  })
  const closeForm = () => { if (!busy) { setOpen(false); onFormClose?.() } }
  return <>{!formOnly && <div className="panel">
    <div className="parking-toolbar"><div className="parking-inline">
      </div>
      <div className="parking-inline"><ExportButton onClick={() => exportFile("NhapVeGiay", () => ({ "Lần nhập": batches.map(data) }))} />
        {editable && <Button variant="primary" onClick={() => { setFile(null); setPreview([]); setError(""); setOpen(true) }}><Upload size={15} />Tải lên</Button>}</div>
    </div>
    <PagedData rows={batches} id={(row) => row.id} data={data} params={params} update={update} link={(row, column) =>
      column === "Mã lần nhập" ? <TextLink onClick={() => setDetail(row)}>{row.id}</TextLink> :
      column === "Thao tác" && editable && row.complete && !row.canceled ? <Button onClick={() => setCancel(row)}>Hủy lần nhập</Button> : undefined} />
    </div>}
    {open && <Overlay wide title={preview.length ? "Kết quả kiểm tra tệp dữ liệu" : "Tải lên file vé giấy"} onClose={closeForm}
      footer={<><Button onClick={closeForm} disabled={busy}>Hủy</Button>
        <Button disabled={!file || busy} onClick={checkFile}>{busy ? "Đang kiểm tra…" : "Kiểm tra file"}</Button>
        {!!preview.length && <Button variant="primary" disabled={!accepted.length} onClick={saveBatch}>Xác nhận tải lên {accepted.length} dòng</Button>}</>}>
      <div className="parking-inline"><Field label="Tệp vé giấy"><Input type="file" accept=".xlsx,.xls" disabled={busy}
        onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview([]); setError("") }} /></Field>
        <TextLink onClick={() => exportFile("MauVeGiay", () => ({ "Mẫu": [Object.fromEntries(paperHeaders.map((key) => [key, ""]))],
          "Mã bãi": sites.map((site) => ({ "Mã bãi": site.id, "Bãi xe": site.label, "Khu đô thị": site.estate })) }))}>Tải file mẫu</TextLink></div>
      {error && <p className="field-message" role="alert">{error}</p>}
      {!!preview.length && <>
        <div className="parking-toolbar"><ParkingTabs options={["Tất cả", "Hợp lệ", "Lỗi dữ liệu", "Trùng lặp"]} value={tab} change={setTab}
          counts={[preview.length, accepted.length, preview.filter((row) => row.error && !row.duplicate).length, preview.filter((row) => row.duplicate).length]} />
          {preview.some((row) => row.error) && <TextLink onClick={() => exportFile("LoiNhapVeGiay", () => ({ "Dòng lỗi": preview.filter((row) => row.error)
            .map((row) => ({ ...row.cells, "Dòng": row.index, "Chi tiết lỗi": row.error })) }))}>Tải file lỗi</TextLink>}</div>
        <DataTable rows={preview.filter((row) => tab === "Tất cả" || tab === "Hợp lệ" && !row.error || tab === "Trùng lặp" && row.duplicate ||
          tab === "Lỗi dữ liệu" && row.error && !row.duplicate).slice(0, 100)} rowKey={(row) => String(row.index)}
          data={(row) => ({ "Dòng": row.index, ...row.cells, "Kiểm tra": row.duplicate ? "Trùng lặp" : row.error ? "Lỗi dữ liệu" : "Hợp lệ", "Chi tiết lỗi": row.error })} />
      </>}
    </Overlay>}
    {detail && <Overlay wide title={`Lần nhập ${detail.id}`} onClose={() => setDetail(null)}><DataTable rows={detail.rows} rowKey={(_, index) => String(index)} data={paperData} /></Overlay>}
    {cancel && <ReasonDialog title="Hủy lần nhập vé giấy" description={cancel.id} action="Hủy lần nhập" close={() => setCancel(null)} submit={(reason) => {
      if (save((latest) => {
        const original = latest.papers.find((row) => row.id === cancel.id && !row.canceled)
        if (!original || !original.rows.every((row) => sites.some((site) => site.id === row.site))) throw new Error("Lần nhập đã thay đổi hoặc ngoài phạm vi quyền.")
        const next = { ...latest, papers: latest.papers.map((row) => row.id === cancel.id ? { ...row, canceled: reason } : row) }
        return auditRevenue(changeLedger(latest, next, trips, parking, original.rows.map((_, i) => `${cancel.id}-${i + 1}`),
          reason, actor, revenueWrite(access, "adjust")), actor, "Hủy vé giấy", access.estate, `${cancel.id} · ${reason}`)
      })) { setCancel(null); notify("Đã hủy lần nhập.") }
    }} />}
  </>
}

export function RevenueReceipts({ state, trips, parking, access, filter, actor, params, update, exportFile, save, notify, operations, startNew = false, formOnly = false, onFormClose, headerActions }: RevenueOperationProps & { startNew?: boolean; formOnly?: boolean; onFormClose?: () => void; headerActions?: (actions: ReactNode) => ReactNode }) {
  const sites = allowedSites(access)
  const editable = revenueWrite(access, "receipt")
  const [draft, setDraft] = useState<{ contract: string; site: string; card: string; kind: string; reason: string; amount: string; method: Method; note: string } | null>(() => startNew && editable ? { contract: "", site: "", card: "", kind: "Cấp lần đầu", reason: "", amount: "50000", method: "Tiền mặt", note: "" } : null)
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [cancel, setCancel] = useState<Receipt | null>(null)
  const [detail, setDetail] = useState<Receipt | null>(null)
  const current = params.get("q") || ""
  const customers = operations.subscriptions.flatMap((sub) => {
    const card = operations.cards.find((item) => item.id === sub.cardId)
    if (!card || sub.type !== "Thuê bao tháng" || sub.ended || sub.expiry && sub.expiry < vnToday() ||
      !revenueMatches(card.estate, filter.estate)) return []
    const siteIds = sites.filter((site) => site.estate === card.estate).map((site) => site.id)
    return siteIds.length ? [{ id: sub.id, estate: card.estate, sites: siteIds, vehicle: card.vehicle, customer: sub.owner, plate: sub.plate, card: sub.cardId, contract: sub.contract }] : []
  })
  const customer = customers.find((row) => row.id === draft?.contract)
  const available = operations.cards.filter((card) => card.status === "Trong kho" && card.estate === customer?.estate && card.vehicle === customer.vehicle &&
    (!draft?.site || card.park === siteById(draft.site)?.name) &&
    !state.receipts.some((row) => !row.canceled && row.card === card.id))
  const change = (key: keyof NonNullable<typeof draft>, value: string) => setDraft((row) => row && ({ ...row, [key]: value }))
  const rows = state.receipts.filter((row) => {
    const estate = siteById(row.site)?.estate ?? ""
    const day = dayAt(row.at)
    return sites.some((site) => site.id === row.site) && revenueMatches(estate, filter.estate) &&
      revenueMatches(row.site, filter.site) && revenueMatches(row.vehicle, filter.vehicle) &&
      day >= filter.start && day <= filter.end &&
      (!current || normalize(`${row.id} ${row.customer} ${row.card}`).includes(normalize(current)))
  })
  const record = () => {
    if (!draft || !customer || !draft.site || !customer.sites.includes(draft.site) || !available.some((row) => row.id === draft.card) ||
      !isPositiveMoney(draft.amount) || (draft.kind === "Cấp lại" && !draft.reason)) {
      setError("Kiểm tra hợp đồng, thẻ trong kho, lý do cấp lại và số tiền."); return
    }
    const row: Receipt = { id: `PT-CT-${crypto.randomUUID().slice(0, 8)}`, at: vnNow(), site: draft.site,
      vehicle: customer.vehicle as Receipt["vehicle"], customer: customer.customer, contract: customer.id, plate: customer.plate, card: draft.card,
      previous: draft.kind === "Cấp lại" ? state.receipts.find((row) => !row.canceled && row.contract === customer.id)?.card ?? customer.card : "",
      kind: draft.kind, reason: draft.reason, amount: Number(draft.amount), method: draft.method, note: draft.note.trim() }
    if (save((latest) => {
      if (!editable || latest.receipts.some((item) => !item.canceled && item.card === row.card)) throw new Error("Thẻ mới đã được cấp.")
      const next = { ...latest, receipts: [row, ...latest.receipts] }
      return auditRevenue(changeLedger(latest, next, trips, parking, [row.id], "Lập phiếu thu sau chốt", actor, revenueWrite(access, "adjust")),
        actor, "Lập phiếu thu", customer.estate, JSON.stringify(row))
    })) { setDraft(null); onFormClose?.(); notify("Đã lập phiếu thu.") }
  }
  const data = (row: Receipt) => ({ "Số phiếu": row.id, "Ngày lập": timestampCell(row.at), "Khu đô thị": estateName(siteById(row.site)?.estate ?? ""),
    "Khách thuê bao": row.customer, "Biển số": row.plate, "Mã thẻ mới": row.card, "Mã thẻ cũ": row.previous, "Loại cấp": row.kind, "Lý do cấp lại": row.reason,
    "Số tiền (₫)": row.amount, "Phương thức": row.method, "Trạng thái": row.canceled ? "Đã hủy" : "Hiệu lực",
    "Ghi chú": row.note, "Lý do hủy": row.canceled, "Thao tác": "",
  })
  const closeForm = () => { setDraft(null); onFormClose?.() }
  const exportReceipts = <ExportButton onClick={() => exportFile("PhieuThuCapThe", () => ({ "Phiếu thu": rows.map(data) }))} />
  return <>{!formOnly && headerActions?.(exportReceipts)}
    {!formOnly && <div className="panel">
    <div className="op-table-toolbar lookup-table-toolbar">
      <span className="count-text" aria-live="polite"><strong>{fmt(rows.length)}</strong> phiếu thu</span>
      <div className="parking-inline">
        {!headerActions && exportReceipts}
        {editable && <Button variant="primary" onClick={() => { setQuery(""); setError(""); setDraft({ contract: "", site: "", card: "", kind: "Cấp lần đầu", reason: "",
          amount: "50000", method: "Tiền mặt", note: "" }) }}><Plus size={15} />Lập phiếu thu</Button>}
      </div>
    </div>
    <PagedData rows={rows} id={(row) => row.id} data={data} params={params} update={update} link={(row, key) =>
      key === "Số phiếu" ? <TextLink onClick={() => setDetail(row)}>{row.id}</TextLink> :
      key === "Thao tác" && editable && !row.canceled ? <Button onClick={() => setCancel(row)}>Hủy phiếu thu</Button> : undefined} />
    </div>}
    {draft && <Overlay title="Lập phiếu thu cấp thẻ" onClose={closeForm} footer={<>
      <Button onClick={closeForm}>Hủy</Button><Button variant="primary" onClick={record}>Lưu</Button></>}>
      <div className="parking-form-grid">
        <Field label="Tìm theo tên hoặc hợp đồng"><Input value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} /></Field>
        <Field label="Khách thuê bao" required><Select value={draft.contract} options={[allOption("Chọn thuê bao"), ...customers.filter((row) =>
          row.id === draft.contract || normalize(`${row.customer} ${row.id} ${row.plate} ${row.contract}`).includes(normalize(query))).slice(0, 60).map((row) => ({ value: row.id, label: `${row.customer} · ${row.id}` }))]}
          onChange={(e) => {
            const customer = customers.find((row) => row.id === e.target.value)
            setDraft({ ...draft, contract: e.target.value, site: customer?.sites[0] || "", card: "" })
          }} /></Field>
        <Field label="Bãi xe" required><Select value={draft.site} options={[allOption("Chọn bãi"), ...sites.filter((site) => customer?.sites.includes(site.id))
          .map((site) => ({ value: site.id, label: site.label }))]} onChange={(e) => change("site", e.target.value)} /></Field>
        <Field label="Loại cấp" required><Select value={draft.kind} options={["Cấp lần đầu", "Cấp lại"]} onChange={(e) => {
          setDraft({ ...draft, kind: e.target.value, reason: "", amount: e.target.value === "Cấp lại" ? "100000" : "50000" })
        }} /></Field>
        {draft.kind === "Cấp lại" && customer && <p className="muted">Thẻ sẽ khóa khi cấp lại: {state.receipts.find((row) =>
          !row.canceled && row.contract === customer.id)?.card ?? customer.card}</p>}
        {draft.kind === "Cấp lại" && <Field label="Lý do cấp lại" required><Select value={draft.reason}
          options={[allOption("Chọn lý do"), "Mất thẻ", "Hỏng thẻ", "Đổi thẻ"]} onChange={(e) => change("reason", e.target.value)} /></Field>}
        <Field label="Mã thẻ mới" required><Select value={draft.card} options={[allOption("Chọn thẻ trong kho"), ...available.map((card) => card.id)]}
          onChange={(e) => change("card", e.target.value)} /></Field>
        <Field label="Số tiền (₫)" required><Input type="number" min={1} value={draft.amount} onChange={(e) => change("amount", e.target.value)} /></Field>
        <Field label="Phương thức" required><Select value={draft.method} options={[...methods]} onChange={(e) => change("method", e.target.value)} /></Field>
        <Field label="Ghi chú"><Textarea maxLength={500} value={draft.note} onChange={(e) => change("note", e.target.value)} /><span className="character-count">{draft.note.length}/500</span></Field>
      </div>{error && <p className="field-message">{error}</p>}
    </Overlay>}
    {detail && <Overlay wide title={detail.id} onClose={() => setDetail(null)}><DataTable rows={[detail]} rowKey={(row) => row.id} data={data} /></Overlay>}
    {cancel && <ReasonDialog title="Hủy phiếu thu" description={cancel.id} action="Hủy phiếu thu" close={() => setCancel(null)} submit={(reason) => {
      if (save((latest) => {
        if (!latest.receipts.some((row) => row.id === cancel.id && !row.canceled)) throw new Error("Phiếu thu đã thay đổi.")
        const next = { ...latest, receipts: latest.receipts.map((row) => row.id === cancel.id ? { ...row, canceled: reason } : row) }
        return auditRevenue(changeLedger(latest, next, trips, parking, [cancel.id], reason, actor, revenueWrite(access, "adjust")),
          actor, "Hủy phiếu thu", siteById(cancel.site)?.estate ?? "", `${cancel.id} · ${reason}`)
      })) { setCancel(null); notify("Đã hủy phiếu thu.") }
    }} />}
  </>
}

