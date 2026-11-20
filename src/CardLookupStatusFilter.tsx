import { useEffect, useId, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { lookupStatuses, normalizeLookupStatuses } from "./report-model"
import type { LookupStatus } from "./report-model"
import { Button } from "./ui"

export default function CardLookupStatusFilter({ value, onChange }: {
  value: LookupStatus[]
  onChange: (value: LookupStatus[]) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const allInput = useRef<HTMLInputElement>(null)
  const popupId = useId()
  const all = value.length === lookupStatuses.length
  useEffect(() => {
    if (allInput.current) allInput.current.indeterminate = value.length > 0 && !all
  }, [open, value, all])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
  }, [open])
  return (
    <div className="field lookup-status-field" ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          trigger.current?.focus()
        }
        if (open && event.key === "Enter") {
          event.stopPropagation()
          if (event.target instanceof HTMLInputElement) {
            event.preventDefault()
            event.target.click()
          }
        }
      }}>
      <span className="field-label">Trạng thái <span className="lookup-status-multiple">Chọn nhiều</span></span>
      <button type="button" ref={trigger} className="input lookup-status-trigger" aria-label="Trạng thái"
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popupId : undefined}
        onClick={() => setOpen((current) => !current)}>
        <span className="lookup-status-values">
          {all ? "Tất cả trạng thái" : !value.length ? "Chọn trạng thái" : value.map((status) =>
            <span className="lookup-status-tag" key={status}>{status}</span>)}
        </span>
        <ChevronDown size={14} />
      </button>
      {!value.length && <span className="field-message">Chọn ít nhất một trạng thái.</span>}
      {open && <div id={popupId} className="lookup-status-popup" role="dialog" aria-label="Chọn trạng thái">
        <label className="lookup-status-option lookup-status-all">
          <input type="checkbox" ref={allInput} aria-label="Tất cả trạng thái" checked={all}
            onChange={() => onChange(all ? [] : [...lookupStatuses])} />
          <span>Tất cả trạng thái</span>
        </label>
        {lookupStatuses.map((status) => <div className="lookup-status-option" key={status}>
          <label>
            <input type="checkbox" aria-label={status} checked={value.includes(status)}
              onChange={(event) => onChange(normalizeLookupStatuses(event.target.checked
                ? [...value, status] : value.filter((item) => item !== status)))} />
            <span>{status}</span>
          </label>
          <Button variant="ghost" aria-label={`Chỉ chọn ${status}`} onClick={() => onChange([status])}>Chỉ chọn</Button>
        </div>)}
        <p>Đang hoạt động: còn hiệu lực. Thẻ Khóa vẫn thuộc nhóm Khóa dù đã quá hạn.</p>
        <Button variant="ghost" className="lookup-status-done" onClick={() => setOpen(false)}>Xong</Button>
      </div>}
    </div>
  )
}
