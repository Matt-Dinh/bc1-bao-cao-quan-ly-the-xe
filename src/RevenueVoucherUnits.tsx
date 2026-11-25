import { useEffect, useState } from "react"
import { Button, Field, Form, Input, Overlay, Select } from "./ui"
import { estates } from "./data"
import { allowedSites } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import type { VoucherUnit } from "./revenue-vouchers"
import { revenueValues } from "./revenue-filter-values"

export default function RevenueVoucherUnitForm({ original, estate, access, close, save, onDirty }: {
  original?: VoucherUnit; estate: string; access: ParkingAccess; close: () => void; save: (unit: VoucherUnit) => boolean; onDirty: (dirty: boolean) => void
}) {
  const [initial] = useState<VoucherUnit>(() => original ?? { id: "", name: "", estate: revenueValues(estate)[0] || allowedSites(access)[0]?.estate || "", type: "Gian hàng", contract: "", active: true })
  const [draft, setDraft] = useState(initial)
  const [discard, setDiscard] = useState(false)
  const dirty = JSON.stringify(initial) !== JSON.stringify(draft)
  useEffect(() => { onDirty(dirty); return () => onDirty(false) }, [dirty, onDirty])
  const submit = () => { if (save({ ...draft, id: draft.id.trim().toUpperCase() })) { onDirty(false); close() } }
  return <><Overlay title={original ? "Sửa đơn vị nhận voucher" : "Thêm đơn vị nhận voucher"} onClose={() => dirty ? setDiscard(true) : close()} footer={<>
    <Button onClick={() => dirty ? setDiscard(true) : close()}>Hủy</Button><Button variant="primary" disabled={!!original && !dirty} onClick={submit}>Lưu đơn vị</Button>
  </>}><Form onSubmit={(event) => { event.preventDefault(); submit() }}><div className="parking-form-grid">
    <Field label="Mã đơn vị" required><Input autoFocus disabled={!!original} maxLength={100} value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} /></Field>
    <Field label="Tên đơn vị" required><Input maxLength={255} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
    <Field label="Khu đô thị" required><Select disabled={!!original} value={draft.estate} options={estates.filter((row) => allowedSites(access).some((site) => site.estate === row.id)).map((row) => ({ value: row.id, label: row.name }))} onChange={(event) => setDraft({ ...draft, estate: event.target.value })} /></Field>
    <Field label="Loại đơn vị" required><Select value={draft.type} options={["Gian hàng", "Khối văn phòng", "Đối tác"]} onChange={(event) => setDraft({ ...draft, type: event.target.value })} /></Field>
    <Field label="Số hợp đồng / vị trí"><Input maxLength={255} value={draft.contract} onChange={(event) => setDraft({ ...draft, contract: event.target.value })} /></Field>
    <Field label="Trạng thái"><Select value={draft.active ? "active" : "inactive"} options={[{ value: "active", label: "Hoạt động" }, { value: "inactive", label: "Không hoạt động" }]} onChange={(event) => setDraft({ ...draft, active: event.target.value === "active" })} /></Field>
  </div></Form></Overlay>
    {discard && <Overlay title="Bỏ thay đổi đơn vị?" onClose={() => setDiscard(false)} footer={<><Button onClick={() => setDiscard(false)}>Tiếp tục chỉnh sửa</Button><Button variant="primary" onClick={() => { onDirty(false); close() }}>Bỏ thay đổi</Button></>}>Thông tin chưa lưu sẽ bị bỏ.</Overlay>}
  </>
}
