import type { ReactNode } from "react"
import { ListFilter, LoaderCircle, Search } from "lucide-react"
import { Button, Form } from "./ui"

export const lookupMatchHint = "Trong cùng một bộ lọc: khớp một trong các lựa chọn. Giữa các bộ lọc: đáp ứng đồng thời."

export default function LookupFilterPanel({
  label, className, children, pending, disabled, busy, beforeApply, onClear, onApply,
}: {
  label: string
  className?: string
  children: ReactNode
  pending?: boolean
  disabled?: boolean
  busy?: boolean
  beforeApply?: ReactNode
  onClear: () => void
  onApply: () => void
}) {
  return <Form className={`panel filter-panel lookup-filter-panel${className ? ` ${className}` : ""}`} aria-label={label}
    onSubmit={(event) => { event.preventDefault(); if (!disabled && !busy) onApply() }}>
    <div className="filter-heading">
      <span><ListFilter size={16} /><strong>Bộ lọc tra cứu</strong>
        {pending && <span className="filter-pending">Chưa áp dụng</span>}
      </span>
      <Button variant="ghost" onClick={onClear}>Xóa bộ lọc</Button>
    </div>
    {children}
    <div className="lookup-filter-footer">
      {beforeApply}
      <Button variant="primary" type="submit" disabled={disabled || busy}>
        {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Search size={14} />} Áp dụng
      </Button>
    </div>
  </Form>
}
