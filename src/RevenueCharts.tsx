import { fmt } from "./data"
import { money, percentage } from "./revenue-tables"

type Item = { id?: string; label: string; value: number; color: string; action: () => void; detail?: string }
const compact = (value: number) => value >= 1e6 ? `${(value / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr` : fmt(value)

export function RevenueDonut({ items, label, action }: { items: Item[]; label: string; action: () => void }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const circumference = 2 * Math.PI * 58
  let offset = 0
  return <div className="revenue-donut-layout">
    <div className="revenue-donut-wrap">
      <svg viewBox="0 0 144 144" className="revenue-donut" role="group" aria-label={`${label}: ${money(total)}`}>
        <circle cx="72" cy="72" r="58" fill="none" stroke="#edf1f6" strokeWidth="17" />
        {items.map((item) => {
          const length = total ? item.value / total * circumference : 0
          const start = offset
          offset += length
          return length > 0 && <circle key={item.id ?? item.label} cx="72" cy="72" r="58" fill="none" stroke={item.color} strokeWidth="17"
            strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start} transform="rotate(-90 72 72)"
            role="button" tabIndex={0} aria-label={`${item.label} · ${money(item.value)} · ${percentage(item.value, total)}`}
            onClick={item.action} onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); item.action() }
            }}><title>{`${item.label} · ${money(item.value)}`}</title></circle>
        })}
      </svg>
      <button type="button" className="revenue-donut-total" disabled={!total} onClick={action} title={money(total)} aria-label={`${label} · Tổng ${money(total)}`}>
        <strong>{compact(total)}</strong><span>{label} (₫)</span>
      </button>
    </div>
    <div className="revenue-donut-legend">{items.length ? items.map((item) => <button type="button" key={item.id ?? item.label}
      className="revenue-donut-row" onClick={item.action} title={`${item.label} · ${money(item.value)} · ${percentage(item.value, total)}`}>
      <i style={{ backgroundColor: item.color }} />
      <span className="revenue-donut-label"><span>{item.label}</span>{item.detail && <small>{item.detail}</small>}</span>
      <span className="revenue-donut-amount"><strong>{fmt(item.value)}</strong><small>{percentage(item.value, total)}</small></span>
    </button>) : <p className="parking-empty">Chưa phát sinh miễn / giảm</p>}</div>
  </div>
}

export function RevenueLossRanking({ items }: { items: Item[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const max = Math.max(1, ...items.map((item) => item.value))
  return <div className="revenue-loss-ranking">
    {items.map((item) => <button type="button" key={item.label} className="revenue-loss-row" disabled={!item.value}
      onClick={item.action} aria-label={`${item.label} · ${money(item.value)} · ${percentage(item.value, total)} thất thu`}>
      <span className="revenue-loss-heading"><span>{item.label}</span><strong>{fmt(item.value)} <small>₫ · {percentage(item.value, total)}</small></strong></span>
      <span className="revenue-loss-axis"><span style={{ width: `${item.value / max * 100}%`, backgroundColor: item.color }}>
        {item.value > 0 && <i style={{ backgroundColor: item.color }} />}</span></span>
    </button>)}
    {!total && <p className="muted">Chưa phát sinh thất thu trong kỳ</p>}
  </div>
}
