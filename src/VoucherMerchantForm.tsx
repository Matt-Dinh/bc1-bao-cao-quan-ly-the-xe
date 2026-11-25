import { useEffect, useState } from "react"
import { Pencil, Plus, Star, Trash2 } from "lucide-react"
import { Badge, Button, Field, Form, Heading, Input, Overlay, Select, Textarea } from "./ui"
import { normalize } from "./data"
import { allowedSites, displayTime, vnNow } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import { ParkingSearch } from "./parking-ui"
import { benefitDefaults, benefitText, removeTemplate, saveMerchant, saveTemplate, siteNames, usageText, voucherKinds } from "./voucher-baseline"
import type { Merchant, Template, VoucherBaseline } from "./voucher-baseline"
import type { VoucherCommit } from "./VoucherBillForm"
import { VoucherBenefitFields, VoucherSites, VoucherTable } from "./VoucherUI"

function TemplateForm({ original, merchant, commit, close, state, access, onDirty, parentDirty }: {
  original?: Template; merchant: Merchant; commit: VoucherCommit; close: () => void; state: VoucherBaseline; access: ParkingAccess; onDirty: (dirty: boolean) => void; parentDirty: boolean
}) {
  const [initial] = useState<Template>(() => original ?? { ...benefitDefaults, hours: 0, id: "", merchant: merchant.id, name: "", sites: [...merchant.sites], start: "00:00", duration: 24, active: true, isDefault: false, updated: vnNow() })
  const [draft, setDraft] = useState(initial), [error, setError] = useState(""), [discard, setDiscard] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  useEffect(() => { onDirty(dirty || parentDirty); return () => onDirty(parentDirty) }, [dirty, parentDirty, onDirty])
  const submit = () => {
    try { saveTemplate(state, draft, access); if (commit((latest) => saveTemplate(latest, draft, access))) close() }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Kiểm tra mẫu voucher") }
  }
  return <><Overlay wide title={original ? "Chỉnh sửa mẫu voucher" : "Thêm mới mẫu voucher"} onClose={() => dirty ? setDiscard(true) : close()} footer={<><Button onClick={() => dirty ? setDiscard(true) : close()}>Hủy</Button><Button variant="primary" disabled={!!original && !dirty} onClick={submit}>{original ? "Cập nhật" : "Tạo mới"}</Button></>}>
    {error && <div className="parking-banner error" role="alert">{error}</div>}
    <Form onSubmit={(e) => { e.preventDefault(); submit() }}><div className="parking-form-grid">
      <Field label="Tên voucher" required><Input autoFocus maxLength={20} placeholder="Nhập tên voucher" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
      <VoucherBenefitFields value={draft} template change={(patch) => setDraft({ ...draft, ...patch })} />
      <Field label="Giờ bắt đầu hiệu lực" required><Input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></Field>
      <Field label="Khoảng thời gian kết thúc hiệu lực" required hint="Số giờ"><Input type="number" min={0} max={8760} step={1} value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })} /></Field>
      <Field label="Trạng thái"><Select value={draft.active ? "active" : "inactive"} options={[{ value: "active", label: "Hoạt động" }, { value: "inactive", label: "Không hoạt động" }]} onChange={(e) => setDraft({ ...draft, active: e.target.value === "active" })} /></Field>
      <div className="field"><span className="field-label">Thiết lập mặc định</span><label className="voucher-default-choice"><input type="checkbox" checked={draft.isDefault} disabled={!!original?.isDefault} onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })} />Mẫu mặc định</label>
        {original?.isDefault && <small>Mẫu đang là mặc định — muốn đổi, đặt mẫu khác làm mặc định.</small>}</div>
    </div><VoucherSites sites={allowedSites(access)} value={draft.sites} change={(sites) => setDraft({ ...draft, sites })} /></Form>
  </Overlay>{discard && <Overlay title="Bỏ thay đổi mẫu voucher?" onClose={() => setDiscard(false)} footer={<><Button onClick={() => setDiscard(false)}>Tiếp tục chỉnh sửa</Button><Button variant="primary" onClick={close}>Bỏ thay đổi</Button></>}>Các thay đổi chưa lưu sẽ mất.</Overlay>}</>
}
export default function VoucherMerchantForm({ original, state, access, actor, commit, close, notify, onDirty }: {
  original?: Merchant; state: VoucherBaseline; access: ParkingAccess; actor: string; commit: VoucherCommit; close: () => void; notify: (message: string) => void; onDirty: (dirty: boolean) => void
}) {
  const [initial] = useState<Merchant>(() => original ? { ...original, sites: [...original.sites] } : { id: "", code: "", name: "", sites: [], active: true, description: "", created: vnNow(), updated: vnNow() })
  const [draft, setDraft] = useState(initial), [error, setError] = useState(""), [confirm, setConfirm] = useState(false), [discard, setDiscard] = useState(false)
  const [template, setTemplate] = useState<Template | null | undefined>(undefined), [remove, setRemove] = useState<Template | null>(null)
  const [query, setQuery] = useState(""), [kind, setKind] = useState(""), [tableParams, setTableParams] = useState(new URLSearchParams())
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial), editable = ["admin", "manager"].includes(access.role)
  useEffect(() => { onDirty(dirty); return () => onDirty(false) }, [dirty, onDirty])
  const latestMerchant = state.merchants.find((row) => row.id === original?.id)
  const templates = state.templates.filter((row) => row.merchant === original?.id && (!query || normalize(row.name).includes(normalize(query))) && (!kind || row.kind === kind)).sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
  const apply = () => {
    if (commit((latest) => saveMerchant(latest, draft, access, actor))) { onDirty(false); notify(original ? "Đã cập nhật gian hàng" : "Đã tạo gian hàng"); close() }
  }
  const submit = () => {
    try { saveMerchant(state, draft, access, actor); setError(""); if (original?.active && !draft.active) setConfirm(true); else apply() }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Kiểm tra thông tin gian hàng") }
  }
  return <div className="voucher-baseline-editor">
    <div className="parking-actions voucher-editor-actions"><Button onClick={() => dirty ? setDiscard(true) : close()}>{editable ? "Hủy" : "Quay lại danh sách"}</Button>
      {editable && <Button variant="primary" disabled={!!original && !dirty} onClick={submit}>{original ? "Lưu" : "Tạo gian hàng"}</Button>}</div>
    {error && <div className="parking-banner error" role="alert">{error}</div>}
    <Form onSubmit={(e) => { e.preventDefault(); submit() }}><fieldset disabled={!editable} className="panel parking-detail-panel voucher-baseline-section"><Heading>Thông tin gian hàng</Heading>
      <VoucherSites sites={allowedSites(access)} value={draft.sites} change={(sites) => setDraft({ ...draft, sites })} />
      <div className="parking-form-grid"><Field label="Mã gian hàng" required><Input maxLength={50} disabled={!!original} placeholder="GH-004" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></Field>
        <Field label="Tên gian hàng" required><Input maxLength={255} placeholder="Nhập tên gian hàng" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
        <Field label="Trạng thái gian hàng" required><Select value={draft.active ? "active" : "inactive"} options={[{ value: "active", label: "Hoạt động" }, { value: "inactive", label: "Không hoạt động" }]} onChange={(e) => setDraft({ ...draft, active: e.target.value === "active" })} /></Field>
        <Field label="Ghi chú"><Textarea maxLength={500} placeholder="Nhập ghi chú..." value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field></div>
      {original?.active && !draft.active && <div className="parking-banner warning">Lưu ở trạng thái Không hoạt động sẽ hủy mọi mã voucher chưa dùng của gian hàng, không khôi phục được. Gian hàng không hoạt động không tạo / sửa được mẫu và voucher hóa đơn.</div>}
    </fieldset></Form>
    {original && <section className="panel voucher-baseline-template-section"><div className="parking-chart-header"><div><Heading>Danh sách mẫu voucher</Heading><p>Mẫu điền sẵn quyền lợi và hiệu lực khi tạo voucher hóa đơn của gian hàng. Mẫu mặc định được áp dụng ngay khi chọn gian hàng.</p></div>
      {editable && <Button disabled={!latestMerchant?.active} title={!latestMerchant?.active ? "Gian hàng đang không hoạt động" : undefined} onClick={() => setTemplate(null)}><Plus size={15} />Thêm mẫu voucher</Button>}</div>
      <div className="parking-toolbar"><ParkingSearch value={query} placeholder="Tìm kiếm tên voucher..." change={(value) => { setQuery(value); setTableParams(new URLSearchParams()) }} />
        <Select aria-label="Lọc loại mẫu voucher" value={kind} options={[{ value: "", label: "Tất cả loại Voucher" }, ...Object.entries(voucherKinds).map(([value, label]) => ({ value, label }))]} onChange={(e) => { setKind(e.target.value); setTableParams(new URLSearchParams()) }} /></div>
      <VoucherTable rows={templates} rowKey={(row) => row.id} tableKey={`templates/${original.id}`} controls={false} params={tableParams} update={(patch) => setTableParams((old) => { const next = new URLSearchParams(old); Object.entries(patch).forEach(([key, value]) => value == null ? next.delete(key) : next.set(key, value)); return next })}
        data={(row) => ({ "Tên voucher": row.name, "Loại Voucher": voucherKinds[row.kind], "Quyền ưu đãi": benefitText(row), "Chế độ sử dụng": usageText(row.kind), "Bãi xe áp dụng": siteNames(row.sites), "Hiệu lực": `Từ ${row.start}, trong ${row.duration} giờ`, "Trạng thái": row.active ? "Hoạt động" : "Không hoạt động", "Mặc định": row.isDefault ? "Mặc định" : "—", "Cập nhật cuối": new Date(row.updated * 60000), "Thao tác": "" })}
        renderCell={(row, column) => column === "Mặc định" && row.isDefault ? <Badge tone="blue"><Star size={12} />Mặc định</Badge> : column === "Thao tác" && editable ? <div className="parking-inline">
          <Button disabled={!latestMerchant?.active} onClick={() => setTemplate(row)}><Pencil size={14} />Sửa</Button>
          <Button disabled={!latestMerchant?.active || row.isDefault || !row.active} onClick={() => { if (commit((latest) => saveTemplate(latest, { ...row, isDefault: true }, access))) notify(`Đã đặt mẫu ${row.name} làm mặc định`) }}>Đặt làm mặc định</Button>
          <Button disabled={!latestMerchant?.active} onClick={() => setRemove(row)}><Trash2 size={14} />Xóa</Button></div> : undefined}
        empty={query || kind ? "Không tìm thấy mẫu voucher phù hợp" : "Gian hàng chưa có mẫu voucher nào"} />
    </section>}
    {template !== undefined && latestMerchant && <TemplateForm key={template?.id ?? "new"} original={template ?? undefined} merchant={latestMerchant} state={state} access={access} commit={commit} close={() => setTemplate(undefined)} onDirty={onDirty} parentDirty={dirty} />}
    {remove && <Overlay title="Xác nhận xóa" onClose={() => setRemove(null)} footer={<><Button onClick={() => setRemove(null)}>Hủy</Button><Button variant="primary" onClick={() => { if (commit((latest) => removeTemplate(latest, remove, access))) { setRemove(null); notify("Đã xóa mẫu voucher") } }}>Xóa</Button></>}>Bạn có chắc muốn xóa mẫu voucher {remove.name}? Thao tác này không thể hoàn tác.</Overlay>}
    {confirm && <Overlay title="Ngừng hoạt động gian hàng?" onClose={() => setConfirm(false)} footer={<><Button onClick={() => setConfirm(false)}>Quay lại</Button><Button variant="primary" onClick={apply}>Xác nhận</Button></>}>Mọi mã voucher chưa dùng của gian hàng sẽ bị hủy. Bật lại gian hàng không khôi phục các mã đã hủy.</Overlay>}
    {discard && <Overlay title="Bỏ thay đổi chưa lưu?" onClose={() => setDiscard(false)} footer={<><Button onClick={() => setDiscard(false)}>Tiếp tục chỉnh sửa</Button><Button variant="primary" onClick={() => { onDirty(false); close() }}>Bỏ thay đổi</Button></>}>Các thay đổi chưa lưu sẽ mất.</Overlay>}
  </div>
}
