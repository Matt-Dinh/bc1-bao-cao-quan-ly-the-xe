import { useEffect, useState } from "react"
import { ArrowLeft, Plus, Save } from "lucide-react"
import { Badge, Button, Field, Form, Heading, Input, Overlay, Select } from "./ui"
import { allowedSites, vnToday } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import { allOption } from "./parking-ui"
import { validateVoucherSource, voucherBenefits, voucherBenefitText, voucherOrigins, voucherPurposes } from "./revenue-vouchers"
import type { VoucherSource, VoucherSourceDraft, VoucherWorkspace } from "./revenue-vouchers"
import { revenueMatches } from "./revenue-filter-values"

export default function RevenueVoucherSourceForm({ original, workspace, access, estate, onDirty, close, save }: {
  original?: VoucherSource; workspace: VoucherWorkspace; access: ParkingAccess; estate: string;
  onDirty: (dirty: boolean) => void; close: () => void; save: (draft: VoucherSourceDraft) => boolean
}) {
  const units = workspace.units.filter((unit) => unit.active && revenueMatches(unit.estate, estate) && allowedSites(access).some((site) => site.estate === unit.estate))
  const [initial] = useState<VoucherSourceDraft>(() => original ? { ...original, quantity: workspace.codes.filter((code) => code.sourceId === original.id && !code.canceled).length } : {
    reference: "", name: "", origin: "BILL", unit: units[0]?.id ?? "", purpose: "", benefit: "AMOUNT",
    amount: 0, minutes: 120, windowStart: "08:00", windowEnd: "17:00", from: vnToday(), until: vnToday(),
    sites: allowedSites(access).filter((site) => site.estate === units[0]?.estate).map((site) => site.id),
    quantity: 1, billAmount: 0, paidAt: vnToday(), active: true,
  })
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const [discard, setDiscard] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  useEffect(() => { onDirty(dirty); return () => onDirty(false) }, [dirty, onDirty])
  const change = (patch: Partial<VoucherSourceDraft>) => { setDraft((old) => ({ ...old, ...patch })); setErrors({}) }
  const unit = workspace.units.find((row) => row.id === draft.unit)
  const sites = allowedSites(access).filter((site) => site.estate === unit?.estate)
  const locked = !!original && workspace.applications.some((row) => row.sourceId === original.id)
  const existingCount = original ? workspace.codes.filter((code) => code.sourceId === original.id && !code.canceled).length : 0
  const leave = () => dirty ? setDiscard(true) : close()
  const review = () => {
    const next = validateVoucherSource(draft, workspace, access, original)
    setErrors(next)
    if (!Object.keys(next).length) setConfirm(true)
  }
  return <div className="voucher-source-editor">
    <div className="page-heading"><div><Heading>{original ? "Sửa nguồn phát hành" : "Tạo voucher"}</Heading>
      <p className="muted">Cùng một nguồn phát hành sinh nhiều mã, dùng chung thời hạn, bãi và cách ghi nhận.</p></div>
      <Button onClick={leave}><ArrowLeft size={15} />Quay lại danh sách</Button></div>
    <Form onSubmit={(event) => { event.preventDefault(); review() }}>
      <section className="panel parking-detail-panel"><Heading>Thông tin phát hành</Heading><div className="parking-form-grid">
        <Field label="Nguồn phát hành" required><Select value={draft.origin} disabled={!!original} options={Object.entries(voucherOrigins).map(([value, label]) => ({ value, label }))}
          onChange={(event) => change({ origin: event.target.value as VoucherSourceDraft["origin"] })} /></Field>
        <Field label={draft.origin === "BILL" ? "Mã hóa đơn" : draft.origin === "EVENT" ? "Mã sự kiện / đợt cấp" : "Mã phiếu cấp / đợt cấp"} required error={errors.reference}>
          <Input autoFocus maxLength={100} value={draft.reference} disabled={!!original} placeholder={draft.origin === "BILL" ? "BILL-DEMO-001" : "CP-DEMO-001"} onChange={(event) => change({ reference: event.target.value })} /></Field>
        <Field label="Tên nguồn phát hành" required error={errors.name}><Input maxLength={255} value={draft.name} placeholder="Ví dụ: Vé âm khách gian hàng tháng 11" onChange={(event) => change({ name: event.target.value })} /></Field>
        <Field label="Đơn vị nhận voucher" required error={errors.unit}><Select disabled={!!original} value={draft.unit} options={[allOption("Chọn đơn vị nhận"), ...units.map((row) => ({ value: row.id, label: row.name }))]}
          onChange={(event) => { const row = units.find((item) => item.id === event.target.value); change({ unit: event.target.value, sites: allowedSites(access).filter((site) => site.estate === row?.estate).map((site) => site.id) }) }} /></Field>
        {draft.origin === "BILL" && <>
          <Field label="Giá trị hóa đơn (₫)" required error={errors.billAmount} hint="Hóa đơn mua hàng; không phải khoản thanh toán công nợ gửi xe."><Input type="number" min={1} step={1} value={draft.billAmount || ""} onChange={(event) => change({ billAmount: Number(event.target.value) })} /></Field>
          <Field label="Ngày thanh toán hóa đơn" required><Input type="date" max={vnToday()} value={draft.paidAt} onChange={(event) => change({ paidAt: event.target.value })} /></Field>
        </>}
      </div></section>
      <section className="panel parking-detail-panel"><Heading>Quyền ưu đãi</Heading>
        {locked && <p className="parking-chart-note">Nguồn đã có lượt áp dụng. Nghiệp vụ và quyền lợi được giữ nguyên để bảo toàn số liệu.</p>}
        <div className="parking-form-grid">
          <Field label="Quyền lợi cho khách" required error={errors.benefit}><Select value={draft.benefit} disabled={locked || draft.purpose === "NEGATIVE_TICKET"}
            options={Object.entries(voucherBenefits).filter(([value]) => draft.purpose === "NEGATIVE_TICKET" ? value === "FULL_FEE" : value !== "FULL_FEE").map(([value, label]) => ({ value, label }))}
            onChange={(event) => change({ benefit: event.target.value as VoucherSourceDraft["benefit"] })} /></Field>
          {draft.benefit === "AMOUNT" && <Field label="Số tiền được tài trợ / giảm (₫)" required error={errors.amount}><Input type="number" min={1} step={1} disabled={locked} value={draft.amount || ""} onChange={(event) => change({ amount: Number(event.target.value) })} /></Field>}
          {draft.benefit === "DURATION" && <Field label="Thời lượng miễn phí (phút)" required error={errors.minutes}><Input type="number" min={1} max={59999} step={1} disabled={locked} value={draft.minutes} onChange={(event) => change({ minutes: Number(event.target.value) })} /></Field>}
          {draft.benefit === "TIME_WINDOW" && <>
            <Field label="Từ giờ" required><Input type="time" disabled={locked} value={draft.windowStart} onChange={(event) => change({ windowStart: event.target.value })} /></Field>
            <Field label="Đến giờ" required error={errors.windowEnd}><Input type="time" disabled={locked} value={draft.windowEnd} onChange={(event) => change({ windowEnd: event.target.value })} /></Field>
          </>}
        </div>
      </section>
      <section className="panel parking-detail-panel"><Heading>Đối soát doanh thu</Heading>
        <p className="parking-chart-note">Thông tin bổ sung để chuyển dữ liệu sử dụng voucher sang doanh thu và công nợ.</p>
        <Field label="Loại nghiệp vụ" required error={errors.purpose}><Select value={draft.purpose} disabled={locked} options={[allOption("Chọn cách ghi nhận"), ...Object.entries(voucherPurposes).map(([value, label]) => ({ value, label }))]}
          onChange={(event) => { const purpose = event.target.value as VoucherSourceDraft["purpose"]; change({ purpose, benefit: purpose === "NEGATIVE_TICKET" ? "FULL_FEE" : draft.benefit === "FULL_FEE" ? "AMOUNT" : draft.benefit }) }} /></Field>
        {draft.purpose && <div className="voucher-financial-note"><Badge tone={draft.purpose === "VCR_DISCOUNT" ? "blue" : "orange"}>{draft.purpose === "VCR_DISCOUNT" ? "VCR chịu chi phí" : "Đơn vị trả lại tiền"}</Badge>
          <p>{draft.purpose === "VCR_DISCOUNT" ? "Tiền được miễn ghi vào Miễn / giảm, không tạo công nợ cho đơn vị nhận."
            : `${unit?.name ?? "Đơn vị được chọn"} là bên chịu khoản phí được tài trợ; chỉ phát sinh công nợ sau khi khách sử dụng và lượt đã hoàn tất.`}</p>
          {draft.purpose === "NEGATIVE_TICKET" && <p>Vé âm bao toàn bộ phí thực tế sau các chính sách miễn / giảm; mỗi lượt chỉ nhận một vé âm.</p>}
        </div>}
      </section>
      <section className="panel parking-detail-panel"><Heading>Phạm vi và số lượng</Heading><div className="parking-form-grid">
        <Field label="Hiệu lực từ" required><Input type="date" value={draft.from} onChange={(event) => change({ from: event.target.value })} /></Field>
        <Field label="Hiệu lực đến" required error={errors.until}><Input type="date" min={draft.from} value={draft.until} onChange={(event) => change({ until: event.target.value })} /></Field>
        <Field label="Tổng số mã chưa hủy" required error={errors.quantity} hint={original ? "Bao gồm mã đã dùng. Tăng để sinh thêm mã; giảm chỉ hủy mã chưa có lượt áp dụng." : "Phát hành từ 1 đến 999 mã."}>
          <Input type="number" min={original ? 0 : 1} max={999} step={1} value={draft.quantity} onChange={(event) => change({ quantity: Number(event.target.value) })} /></Field>
        <Field label="Số lần sử dụng mỗi mã"><Input value={draft.benefit === "TIME_WINDOW" ? "Nhiều lần trong khung giờ và thời hạn" : "Một lần"} readOnly /></Field>
      </div>
        <fieldset className="voucher-sites"><legend>Bãi xe áp dụng <span className="required">*</span></legend>
          {sites.map((site) => <label key={site.id}><input type="checkbox" checked={draft.sites.includes(site.id)} onChange={(event) => change({ sites: event.target.checked ? [...draft.sites, site.id] : draft.sites.filter((id) => id !== site.id) })} />{site.label}</label>)}
          {errors.sites && <p className="field-message">{errors.sites}</p>}
        </fieldset>
      </section>
      <div className="voucher-editor-footer"><Button onClick={leave}>Hủy</Button><Button variant="primary" type="submit" disabled={!!original && !dirty}>{original ? <Save size={15} /> : <Plus size={15} />}{original ? "Xem lại và lưu" : "Xem lại và phát hành"}</Button></div>
    </Form>
    {confirm && <Overlay title="Xác nhận phát hành voucher" onClose={() => setConfirm(false)} dismissOnBackdrop={false} footer={<>
      <Button onClick={() => setConfirm(false)}>Quay lại chỉnh sửa</Button><Button variant="primary" onClick={() => { if (save(draft)) { setConfirm(false); onDirty(false) } }}>Xác nhận {original ? "lưu" : "phát hành"}</Button>
    </>}><dl className="parking-detail-grid">
      <div><dt>Đơn vị nhận</dt><dd>{unit?.name}</dd></div><div><dt>Nghiệp vụ</dt><dd>{draft.purpose ? voucherPurposes[draft.purpose] : ""}</dd></div>
      <div><dt>Quyền lợi</dt><dd>{voucherBenefitText(draft)}</dd></div><div><dt>Số mã cần có</dt><dd>{draft.quantity}</dd></div>
      <div><dt>Mã được tạo thêm</dt><dd>{Math.max(0, draft.quantity - existingCount)}</dd></div><div><dt>Mã chưa dùng sẽ hủy</dt><dd>{Math.max(0, existingCount - draft.quantity)}</dd></div>
      <div><dt>Cách ghi nhận</dt><dd>{draft.purpose === "VCR_DISCOUNT" ? "VCR chịu · Miễn / giảm" : `${unit?.name} trả lại · Công nợ`}</dd></div>
    </dl><p className="parking-chart-note">Việc phát hành mã chưa tạo ra doanh thu, công nợ hoặc khoản thu tiền.</p></Overlay>}
    {discard && <Overlay title="Bỏ thay đổi chưa lưu?" onClose={() => setDiscard(false)} dismissOnBackdrop={false} footer={<>
      <Button onClick={() => setDiscard(false)}>Tiếp tục chỉnh sửa</Button><Button variant="primary" onClick={() => { onDirty(false); close() }}>Bỏ thay đổi</Button>
    </>}>Thông tin vừa chỉnh sửa sẽ không được lưu.</Overlay>}
  </div>
}
