import { ArrowRight, CalendarDays } from "lucide-react"
import { Button, Field, Input } from "./ui"

type Period = { start: string; end: string }

function daysBefore(day: string, count: number) {
  const value = new Date(`${day}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() - count)
  return value.toISOString().slice(0, 10)
}

export default function ReportPeriodFields({
  period,
  min,
  max,
  inputMax = max,
  error,
  onChange,
}: {
  period: Period
  min?: string
  max: string
  inputMax?: string
  error?: string
  onChange: (period: Period) => void
}) {
  const monthStart = `${max.slice(0, 7)}-01`
  const lastMonthEnd = daysBefore(monthStart, 1)
  const presets = [
    { label: "Tháng này", start: monthStart, end: max },
    { label: "Tháng trước", start: `${lastMonthEnd.slice(0, 7)}-01`, end: lastMonthEnd },
    { label: "7 ngày trước", start: daysBefore(max, 6), end: max },
  ]
  return (
    <>
      <div className="date-field">
        <Field label="Kỳ báo cáo" required error={error || undefined}>
          <div className="date-range">
            <CalendarDays size={15} />
            <Input type="date" aria-label="Từ ngày" min={min} max={inputMax} value={period.start}
              onChange={(event) => onChange({ start: event.target.value, end: period.end })} />
            <span className="date-arrow"><ArrowRight size={14} /></span>
            <Input type="date" aria-label="Đến ngày" min={min} max={inputMax} value={period.end}
              onChange={(event) => onChange({ start: period.start, end: event.target.value })} />
          </div>
        </Field>
      </div>
      <div className="quick-dates">
        {presets.map(({ label, start, end }) => {
          const selected = period.start === start && period.end === end
          return <Button key={label} variant="ghost" aria-pressed={selected}
            className={selected ? "quick-selected" : ""} onClick={() => onChange({ start, end })}>{label}</Button>
        })}
      </div>
    </>
  )
}
