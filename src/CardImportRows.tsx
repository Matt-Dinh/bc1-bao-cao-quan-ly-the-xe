import { Plus, X } from "lucide-react"
import { Button, Input, Select } from "./ui"
import { cardTechnologies } from "./vehicle-energy"
import { emptyImportRow } from "./card-import"
import type { CardImportRow } from "./card-import"

export default function CardImportRows({ rows, onChange }: { rows: CardImportRow[]; onChange: (rows: CardImportRow[]) => void }) {
  const update = (index: number, patch: Partial<CardImportRow>) => onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row))
  return <div className="op-manual-cards">
    <p className="muted">Nhập một hoặc vài thẻ, giữ nguyên số 0 đầu mã. Có thể chọn kiểu thẻ riêng cho từng dòng.</p>
    <div className="table-scroll"><table className="data-table">
      <thead><tr><th>Mã thẻ *</th><th>Mã mặt trước</th><th>Mã mặt sau</th><th>Kiểu thẻ</th><th /></tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>
        <td><Input aria-label={`Mã thẻ dòng ${index + 1}`} value={row.id} maxLength={50} onChange={(e) => update(index, { id: e.target.value })} />
          {row.id && row.error && <span className="field-message">{row.error}</span>}</td>
        <td><Input aria-label={`Mã mặt trước dòng ${index + 1}`} value={row.frontCode || ""} maxLength={50} onChange={(e) => update(index, { frontCode: e.target.value })} /></td>
        <td><Input aria-label={`Mã mặt sau dòng ${index + 1}`} value={row.rearCode || ""} maxLength={50} onChange={(e) => update(index, { rearCode: e.target.value })} /></td>
        <td><Select aria-label={`Kiểu thẻ dòng ${index + 1}`} value={row.technology || ""} onChange={(e) => update(index, { technology: e.target.value })}
          options={[{ value: "", label: "Theo kiểu thẻ chung" }, ...cardTechnologies]} /></td>
        <td><Button aria-label={`Xóa dòng thẻ ${index + 1}`} disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, i) => i !== index))}><X size={14} /></Button></td>
      </tr>)}</tbody>
    </table></div>
    <Button disabled={rows.length >= 100} onClick={() => onChange([...rows, emptyImportRow()])}><Plus size={14} />Thêm dòng</Button>
  </div>
}
