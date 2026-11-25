import { useEffect, useState } from "react"
import { Minus, Plus, Printer, RotateCcw } from "lucide-react"
import { Badge, Button, Field, Form, Heading, Input, Overlay, Select } from "./ui"
import { allowedSites, dayAt, dayStart, displayTime, vnNow } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import { ParkingPagination } from "./parking-ui"
import { ReasonDialog } from "./RevenueOperations"
import { applyTemplate, benefitDefaults, benefitText, cancelCode, codeUnused, localDateTime, parseLocalDateTime, saveBill, sourceCodes, voucherKinds } from "./voucher-baseline"
import type { BillVoucher, IssuedVoucher, VoucherBaseline } from "./voucher-baseline"
import { VoucherBenefitFields, VoucherSites, VoucherTicket } from "./VoucherUI"

export type VoucherCommit = (change: (state: VoucherBaseline) => VoucherBaseline) => boolean
export default function VoucherBillForm({ original, state, access, actor, commit, close, openBill, notify, onDirty }: {
  original?: BillVoucher; state: VoucherBaseline; access: ParkingAccess; actor: string; commit: VoucherCommit
  close: () => void; openBill: (id: string) => void; notify: (message: string) => void; onDirty: (dirty: boolean) => void
}) {
  const [initial] = useState<BillVoucher>(() => original ? { ...original, sites: [...original.sites] } : {
    ...benefitDefaults, id: "", merchant: "", reference: "", name: "", sites: [], paid: Math.floor(vnNow()), bill: 0, guests: 1,
    from: Math.floor(vnNow()), until: dayStart(dayAt(vnNow())) + 1439, quota: 1, active: true, created: vnNow(), updated: vnNow(),
    windowStart: localDateTime(vnNow()), windowEnd: `${dayAt(vnNow())}T23:59`,
  })
  const [draft, setDraft] = useState(initial), [templateId, setTemplateId] = useState("")
  const [confirm, setConfirm] = useState(false), [discard, setDiscard] = useState(false), [undo, setUndo] = useState(false)
  const [existing, setExisting] = useState<BillVoucher | null>(null), [cancel, setCancel] = useState<IssuedVoucher | null>(null)
  const [print, setPrint] = useState(false), [page, setPage] = useState(1), [error, setError] = useState("")
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const editable = ["admin", "manager"].includes(access.role)
  useEffect(() => { onDirty(dirty); return () => onDirty(false) }, [dirty, onDirty])
  const change = (patch: Partial<BillVoucher>) => { setDraft((old) => ({ ...old, ...patch })); setError("") }
  const sites = allowedSites(access)
  const merchants = state.merchants.filter((row) => (row.active || row.id === original?.merchant) && row.sites.some((id) => sites.some((site) => site.id === id)))
  const templates = state.templates.filter((row) => row.merchant === draft.merchant && row.active)
  const codes = original ? sourceCodes(state, original.id) : [], live = codes.filter((row) => !row.canceled)
  const unused = codes.filter((row) => codeUnused(state, row))
  const lockedType = codes.some((row) => !codeUnused(state, row))
  const createCount = Math.max(0, draft.quota - live.length), cancelCount = Math.max(0, live.length - draft.quota)
  const pendingCount = Number.isInteger(createCount) ? Math.min(999, createCount) : 0
  const ticketRows = [...codes.map((code) => ({ code, key: code.id })), ...Array.from({ length: pendingCount }, (_, i) => ({ code: undefined, key: `pending/${i}` }))]
  const currentPage = Math.min(page, Math.max(1, Math.ceil(ticketRows.length / 24)))
  const lookup = () => {
    if (original || !draft.merchant || !draft.reference.trim()) return
    const match = state.sources.find((row) => row.merchant === draft.merchant && row.reference.toUpperCase() === draft.reference.trim().toUpperCase())
    if (match) setExisting(match)
  }
  const apply = (id: string) => {
    setTemplateId(id)
    const template = templates.find((row) => row.id === id)
    if (template) setDraft((old) => applyTemplate(old, template))
  }
  const requestSave = () => {
    try { saveBill(state, draft, access, actor); setError(""); setConfirm(true) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Kiểm tra thông tin voucher") }
  }
  const submitLabel = !original ? "Tạo voucher" : cancelCount ? `Hủy bớt voucher chưa dùng (còn ${draft.quota})` : createCount ? "Tạo voucher" : "Cập nhật cấu hình voucher"
  return <div className="voucher-baseline-editor">
    <div className="parking-actions voucher-editor-actions"><Button disabled={!dirty} onClick={() => setUndo(true)}><RotateCcw size={15} />Hoàn tác</Button>
      <Button disabled={!original || !unused.length} onClick={() => setPrint(true)}><Printer size={15} />In voucher</Button>
      <Button onClick={() => dirty ? setDiscard(true) : close()}>{editable ? "Hủy" : "Quay lại danh sách"}</Button>{editable && <Button variant="primary" disabled={!!original && !dirty} onClick={requestSave}>{submitLabel}</Button>}</div>
    {error && <div className="parking-banner error" role="alert">{error}</div>}
    <div className="voucher-baseline-form-layout"><Form onSubmit={(e) => { e.preventDefault(); if (editable) requestSave() }}><fieldset disabled={!editable} className="voucher-bill-fields">
      <section className="panel parking-detail-panel voucher-baseline-section"><Heading><span className="voucher-step">1</span>Thông tin hóa đơn</Heading><p className="parking-chart-note">Nhập thông tin hóa đơn để tạo voucher</p>
        <div className="parking-form-grid">
          <Field label="Mã hóa đơn" required><Input autoFocus disabled={!!original} maxLength={100} placeholder="Nhập mã hóa đơn" value={draft.reference} onBlur={lookup} onChange={(e) => change({ reference: e.target.value })} /></Field>
          <Field label="Số lượng khách" hint="Số khách trong hóa đơn"><Input type="number" min={0} max={9999} step={1} value={draft.guests} onChange={(e) => change({ guests: Number(e.target.value), quota: Number(e.target.value) })} /></Field>
          <Field label="Gian hàng" required><Select disabled={!!original} value={draft.merchant} options={[{ value: "", label: "Chọn gian hàng" }, ...merchants.map((row) => ({ value: row.id, label: row.name }))]}
            onChange={(e) => {
              const merchant = merchants.find((row) => row.id === e.target.value)
              const template = state.templates.find((row) => row.merchant === merchant?.id && row.active && row.isDefault)
              const next = { ...draft, merchant: e.target.value, sites: merchant?.sites ?? [], name: merchant?.name.slice(0, 20) ?? "" }
              setDraft(template ? applyTemplate(next, template) : next); setTemplateId(template?.id ?? ""); setError("")
            }} /></Field>
          <Field label="Mẫu voucher"><Select disabled={!draft.merchant} value={templateId} options={[{ value: "", label: "Chọn mẫu" }, ...templates.map((row) => ({ value: row.id, label: row.name + (row.isDefault ? " (Mặc định)" : "") }))]} onChange={(e) => apply(e.target.value)} /></Field>
        </div>
        <details className="voucher-baseline-details" open={error ? true : undefined}><summary>Thông tin chi tiết</summary><div className="parking-form-grid">
          <Field label="Tên voucher" required><Input maxLength={20} placeholder="Nhập tên voucher" value={draft.name} onChange={(e) => change({ name: e.target.value })} /></Field>
          <Field label="Ngày giờ thanh toán" required><Input type="datetime-local" max={localDateTime(vnNow())} value={localDateTime(draft.paid)} onChange={(e) => change({ paid: parseLocalDateTime(e.target.value) })} /></Field>
          <Field label="Giá trị bill"><Input type="number" min={0} max={9999999999} step={1} value={draft.bill} onChange={(e) => change({ bill: Number(e.target.value) })} /></Field>
          <Field label="Trạng thái bill"><Select value={draft.active ? "active" : "inactive"} options={[{ value: "active", label: "Hoạt động" }, { value: "inactive", label: "Không hoạt động" }]} onChange={(e) => change({ active: e.target.value === "active" })} /></Field>
        </div></details>
      </section>
      <section className="panel parking-detail-panel voucher-baseline-section"><Heading><span className="voucher-step">2</span>Cấu hình voucher</Heading><p className="parking-chart-note">Chọn số lượng và phân loại cần phát hành</p>
        <div className="parking-form-grid"><Field label="Số lượng voucher phát hành" required hint={cancelCount ? `Tối đa ${cancelCount} voucher chưa sử dụng sẽ bị hủy` : createCount ? `+${createCount} voucher sẽ được tạo thêm` : undefined}>
          <div className="voucher-quantity"><Button aria-label="Giảm số lượng voucher phát hành" disabled={draft.quota <= 1} onClick={() => change({ quota: draft.quota - 1 })}><Minus size={14} /></Button>
            <Input type="number" aria-label="Số lượng voucher phát hành" min={1} max={999} step={1} value={draft.quota} onChange={(e) => change({ quota: Number(e.target.value) })} />
            <Button aria-label="Tăng số lượng voucher phát hành" disabled={draft.quota >= 999} onClick={() => change({ quota: draft.quota + 1 })}><Plus size={14} /></Button></div>
        </Field>
          <Field label="Loại voucher" required><Select disabled={lockedType} value={draft.kind} options={Object.entries(voucherKinds).map(([value, label]) => ({ value, label }))}
            onChange={(e) => change({ kind: e.target.value as BillVoucher["kind"], amount: 0, hours: 0, minutes: 0, windowStart: localDateTime(vnNow()), windowEnd: `${dayAt(vnNow())}T23:59` })} /></Field>
        </div>
        <details className="voucher-baseline-details" open={error ? true : undefined}><summary>Thông tin chi tiết</summary><div className="parking-form-grid">
          <VoucherBenefitFields value={draft} change={change} hideType />
          <Field label="Hiệu lực từ" required><Input type="datetime-local" value={localDateTime(draft.from)} onChange={(e) => change({ from: parseLocalDateTime(e.target.value) })} /></Field>
          <Field label="Hiệu lực đến" required><Input type="datetime-local" value={localDateTime(draft.until)} onChange={(e) => change({ until: parseLocalDateTime(e.target.value) })} /></Field>
        </div></details>
        <VoucherSites sites={sites} value={draft.sites} change={(value) => change({ sites: value })} />
      </section>
    </fieldset></Form>
      <aside className="voucher-baseline-preview" aria-label="Chế độ xem trước"><section className="panel parking-detail-panel"><Badge tone="blue">Chế độ xem trước</Badge>
        <VoucherTicket source={draft} code={unused[0]} state={state} preview notify={notify} /></section>
        <div className="parking-banner warning"><strong>Lưu ý</strong><ul><li>Các trường có dấu * là bắt buộc</li><li>Mỗi mã hóa đơn chỉ được tạo voucher 1 lần</li><li>Vui lòng kiểm tra kỹ thông tin trước khi phát hành</li></ul></div>
      </aside>
    </div>
    <section className="panel parking-detail-panel voucher-baseline-section"><Heading><span className="voucher-step">3</span>Lịch sử phát hành</Heading><p className="parking-chart-note">Số lượng và voucher đã tạo · {live.length} mã hợp lệ{pendingCount > 0 && ` · ${pendingCount} mã chờ tạo`}</p>
      <div className="voucher-ticket-grid">{ticketRows.slice((currentPage - 1) * 24, currentPage * 24).map((row) => <VoucherTicket key={row.key} source={original ?? draft} code={row.code} state={state} pending={!row.code} notify={notify}
        cancel={editable && row.code && codeUnused(state, row.code) ? () => setCancel(row.code!) : undefined} />)}</div>
      {!ticketRows.length && <div className="parking-empty">Nhập số lượng voucher phát hành để xem trước voucher</div>}
      {ticketRows.length > 24 && <ParkingPagination count={ticketRows.length} page={currentPage} size={24} change={setPage} />}
    </section>
    {confirm && <Overlay title={!original ? "Xác nhận tạo tất cả voucher" : cancelCount ? "Xác nhận hủy voucher chưa sử dụng" : createCount ? "Xác nhận tạo voucher vừa thêm" : "Xác nhận cập nhật cấu hình voucher"} onClose={() => setConfirm(false)} footer={<>
      <Button onClick={() => setConfirm(false)}>Quay lại</Button><Button variant="primary" onClick={() => {
        let savedId = original?.id
        if (commit((latest) => { const next = saveBill(latest, draft, access, actor); savedId = next.sources.find((row) => row.merchant === draft.merchant && row.reference === draft.reference.trim())?.id; return next })) {
          setConfirm(false); onDirty(false); notify("Đã lưu cấu hình voucher."); if (!original && savedId) openBill(savedId); else close()
        }
      }}>{cancelCount ? `Xác nhận hủy ${cancelCount} voucher` : createCount ? `Xác nhận tạo ${createCount} voucher` : "Xác nhận cập nhật cấu hình"}</Button>
    </>}><dl className="parking-detail-grid"><div><dt>Bill ID/mã nguồn</dt><dd>{draft.reference}</dd></div><div><dt>Số voucher đã có</dt><dd>{live.length}</dd></div>
      <div><dt>Số voucher tạo thêm</dt><dd>{createCount}</dd></div><div><dt>Số voucher hủy bớt (tối đa)</dt><dd>{cancelCount}</dd></div>
      <div><dt>Số voucher giữ nguyên (đã áp dụng/đã dùng)</dt><dd>{live.length - unused.length}</dd></div><div><dt>Tổng sau khi lưu</dt><dd>{draft.active ? draft.quota : live.length - unused.length}</dd></div>
      <div><dt>Loại voucher</dt><dd>{voucherKinds[draft.kind]}</dd></div><div><dt>Giá trị ưu đãi</dt><dd>{benefitText(draft)}</dd></div></dl>
      <p className="parking-chart-note">Voucher đã áp dụng/đã sử dụng luôn giữ nguyên, không bị ảnh hưởng bởi lần lưu này.</p>
      {!draft.active && <div className="parking-banner warning">Mọi voucher chưa sử dụng của hóa đơn sẽ bị hủy ngay khi lưu.</div>}
    </Overlay>}
    {cancel && <ReasonDialog title="Hủy voucher hóa đơn" description={`Voucher của bill ${original?.reference} sẽ bị hủy và không thể hoàn tác.`} action="Xác nhận hủy" close={() => setCancel(null)} submit={(reason) => {
      if (commit((latest) => cancelCode(latest, cancel, reason, access, actor))) { setCancel(null); notify("Đã hủy voucher") }
    }} />}
    {existing && <Overlay title="Hóa đơn đã có voucher" onClose={() => setExisting(null)} footer={<><Button onClick={() => setExisting(null)}>Tiếp tục chỉnh sửa</Button><Button variant="primary" onClick={() => { onDirty(false); openBill(existing.id) }}>Chuyển sang cập nhật</Button></>}>
      Hóa đơn {existing.reference} đã được tạo voucher. Chuyển sang cập nhật hóa đơn này? Thông tin vừa nhập sẽ không được giữ lại.</Overlay>}
    {(discard || undo) && <Overlay title={undo ? "Hoàn tác các thay đổi?" : "Bỏ thay đổi chưa lưu?"} onClose={() => { setDiscard(false); setUndo(false) }} footer={<>
      <Button onClick={() => { setDiscard(false); setUndo(false) }}>Tiếp tục chỉnh sửa</Button><Button variant="primary" onClick={() => {
        onDirty(false); if (undo) { setDraft(initial); setTemplateId(""); setError(""); setUndo(false) } else close()
      }}>{undo ? "Hoàn tác" : "Bỏ thay đổi"}</Button></>}>Các thay đổi chưa lưu sẽ mất.</Overlay>}
    {print && <Overlay wide title="In voucher" subtitle={`${unused.length} voucher chưa sử dụng · Bill ID ${original?.reference}`} onClose={() => setPrint(false)} footer={<><Button onClick={() => setPrint(false)}>Đóng</Button><Button variant="primary" onClick={() => window.print()}><Printer size={15} />In bản xem trước</Button></>}>
      <div className="voucher-print-sheet voucher-ticket-grid">{unused.map((code) => <VoucherTicket key={code.id} source={original!} code={code} state={state} notify={notify} />)}</div>
    </Overlay>}
  </div>
}
