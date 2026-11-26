import { useState } from "react"
import { FileBarChart2, Layers, Sparkles, X } from "lucide-react"
import { handoffModes, isHandoffMode } from "./handoff-mode"
import type { HandoffMode } from "./handoff-mode"
import "./handoff-mode.css"

const hintDismissKey = "vparking:handoff-hint-dismissed"

export default function HandoffModeSelector({ value, onChange }: {
  value: HandoffMode; onChange: (mode: HandoffMode) => void
}) {
  const [showHint, setShowHint] = useState(() => {
    try { return sessionStorage.getItem(hintDismissKey) !== "1" } catch { return true }
  })
  const dismissHint = () => {
    setShowHint(false)
    try { sessionStorage.setItem(hintDismissKey, "1") } catch {}
  }
  return <div className="handoff-mode-wrap">
    <label className={`handoff-mode-picker${showHint ? " is-highlighted" : ""}`}
      title="Bấm vào đây để chuyển đổi giữa các gói màn hình bàn giao (Tất cả, Quản lý thẻ, Chỗ đỗ, Doanh thu, Hành vi gửi xe)">
      <span className="handoff-mode-badge" aria-hidden="true">
        <span className="handoff-mode-ping" />
        <Layers size={14} />
      </span>
      <span className="handoff-mode-label">Mode bàn giao</span>
      <select aria-label="Mode bàn giao" value={value}
        title={handoffModes.find(mode => mode.id === value)?.title}
        onFocus={dismissHint}
        onChange={event => {
          dismissHint()
          if (isHandoffMode(event.target.value)) onChange(event.target.value)
        }}>
        {handoffModes.map(mode => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
      </select>
    </label>
    {showHint && (
      <div className="handoff-mode-callout" role="status">
        <Sparkles size={13} aria-hidden="true" />
        <span>
          <strong>Chuyển mode bàn giao tại đây</strong> — chọn xem từng phân hệ (Thẻ, Chỗ đỗ, Doanh thu, Hành vi) hoặc tất cả.
        </span>
        <button type="button" className="handoff-mode-dismiss" aria-label="Đóng hướng dẫn" onClick={dismissHint}>
          <X size={13} />
        </button>
      </div>
    )}
  </div>
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
