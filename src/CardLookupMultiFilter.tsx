import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "./ui"

export default function CardLookupMultiFilter({ label, value, options, allLabel, onChange, note, quickAll }: {
  label: string
  value: readonly string[]
  options: readonly { value: string; label: string }[]
  allLabel: string
  onChange: (value: string[]) => void
  note?: string
  quickAll?: string
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const popupId = useId()
  const [placement, setPlacement] = useState({ above: false, maxHeight: 420 })
  useLayoutEffect(() => {
    if (!open || !root.current) return
    const rect = root.current.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom - 12
    const above = rect.top - 12
    const opensAbove = below < 280 && above > below
    setPlacement({ above: opensAbove, maxHeight: Math.max(120, Math.min(420, opensAbove ? above : below)) })
  }, [open, value])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
  }, [open])
  function toggle(option: string, checked: boolean) {
    const next = checked ? [...value, option] : value.filter((item) => item !== option)
    onChange(options.filter((option) => next.includes(option.value)).map((option) => option.value))
  }
  return <div className="field lookup-status-field lookup-multi-field" ref={root}
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
    <span className="field-label">{label} <span className="lookup-status-multiple">Chọn nhiều</span></span>
    <button type="button" ref={trigger} className="input lookup-status-trigger" aria-label={label}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? popupId : undefined}
      onClick={() => setOpen((current) => !current)}>
      <span className="lookup-status-values">{!value.length ? allLabel :
        options.filter((option) => value.includes(option.value)).map((option) =>
          <span className="lookup-status-tag" key={option.value}>{option.label}</span>)}</span>
      <ChevronDown size={14} />
    </button>
    {open && <div id={popupId} className="lookup-status-popup" role="dialog" aria-label={`Chọn ${label.toLocaleLowerCase("vi")}`}
      style={{ top: placement.above ? "auto" : "100%", bottom: placement.above ? "100%" : undefined, maxHeight: placement.maxHeight }}>
      <button type="button" className="lookup-status-option lookup-status-all lookup-multi-reset" aria-pressed={!value.length}
        onClick={() => onChange([])}>
        <span className="lookup-multi-reset-mark" aria-hidden="true">{!value.length ? "✓" : ""}</span>
        <span>{allLabel}</span>
      </button>
      {quickAll && <Button variant="ghost" onClick={() => onChange(options.map((option) => option.value))}>{quickAll}</Button>}
      <div className="lookup-multi-options">
        {options.map((option) => <div className="lookup-status-option" key={option.value}>
          <label>
            <input type="checkbox" aria-label={option.label} checked={value.includes(option.value)}
              onChange={(event) => toggle(option.value, event.target.checked)} />
            <span>{option.label}</span>
          </label>
          <Button variant="ghost" aria-label={`Chỉ chọn ${option.label}`} onClick={() => onChange([option.value])}>Chỉ chọn</Button>
        </div>)}
      </div>
      <p>{note || "Bỏ chọn hết để không giới hạn bộ lọc này."}</p>
      <Button variant="ghost" className="lookup-status-done" onClick={() => setOpen(false)}>Xong</Button>
    </div>}
  </div>
}
