import { FileBarChart2, Layers } from "lucide-react"
import { handoffModes, isHandoffMode } from "./handoff-mode"
import type { HandoffMode } from "./handoff-mode"
import "./handoff-mode.css"

export default function HandoffModeSelector({ value, onChange }: {
  value: HandoffMode; onChange: (mode: HandoffMode) => void
}) {
  return <label className="handoff-mode-picker">
    <Layers size={14} aria-hidden="true" />
    <span>Mode bàn giao</span>
    <select aria-label="Mode bàn giao" value={value} title={handoffModes.find(mode => mode.id === value)?.title}
      onChange={event => { if (isHandoffMode(event.target.value)) onChange(event.target.value) }}>
      {handoffModes.map(mode => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
    </select>
  </label>
}

export function RevenueReportPending() {
  return <section className="panel handoff-pending" aria-labelledby="revenue-pending-title">
    <span className="handoff-pending-icon"><FileBarChart2 size={25} aria-hidden="true" /></span>
    <span className="handoff-pending-label">BÁO CÁO DOANH THU</span>
    <h1 id="revenue-pending-title">Giao diện doanh thu chưa được công bố</h1>
    <p>Phần doanh thu đang được hoàn thiện ở local và chưa đưa lên bản public này.</p>
    <small>Chọn mode khác ở thanh trên để xem các màn hình đã bàn giao.</small>
  </section>
}
