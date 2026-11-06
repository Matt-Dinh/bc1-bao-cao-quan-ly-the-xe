import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  CircleHelp,
  CreditCard,
  Package,
  Settings2,
  Table2,
  TriangleAlert,
} from "lucide-react"
import { Button, Heading, Overlay, Select } from "./ui"
import { date, estates, fmt, percent } from "./data"
import type { Card, Filters } from "./data"
import type { managementReport } from "./report-model"

type Report = ReturnType<typeof managementReport>
const palette = [
  "#6086ca",
  "#e5a954",
  "#3c9b8a",
  "#d96f87",
  "#8a7db5",
  "#a0b6c7",
  "#b39d75",
  "#669ca4",
  "#a38ca1",
]
const movementLabels = ["Nhập mới", "Cấp ra", "Thu hồi", "Mất / hỏng"]

function Details({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const { overflow, paddingRight } = document.body.style
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    const padding =
      parseFloat(getComputedStyle(document.body).paddingRight) || 0
    document.body.style.overflow = "hidden"
    if (scrollbar) document.body.style.paddingRight = `${padding + scrollbar}px`
    return () => {
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
    }
  }, [open])
  return (
    <div className="report-details">
      <Button
        variant="ghost"
        className="report-detail-trigger"
        aria-label={`Xem số liệu chi tiết: ${title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Table2 size={14} /> Xem số liệu chi tiết <ArrowUpRight size={15} />
      </Button>
      {open &&
        createPortal(
          <div className="report-data-modal">
            <Overlay
              wide
              title={title}
              subtitle={subtitle}
              onClose={() => setOpen(false)}
              footer={
                <>
                  <span className="report-data-hint">
                    Bấm vào số liệu để xem danh sách thẻ liên quan.
                  </span>
                  <Button variant="primary" onClick={() => setOpen(false)}>
                    Đóng số liệu
                  </Button>
                </>
              }
            >
              <div className="report-detail-body">{children}</div>
            </Overlay>
          </div>,
          document.body,
        )}
    </div>
  )
}

export default function ReportDashboard({
  data,
  filters,
  groupBy,
  onGroupBy,
  onMetric,
  onCards,
  onSettings,
  stockDetails,
  circulationDetails,
}: {
  data: Report
  filters: Filters
  groupBy: string
  onGroupBy: (value: string) => void
  onMetric: (index: number) => void
  onCards: (title: string, cards: Card[]) => void
  onSettings: () => void
  stockDetails: ReactNode
  circulationDetails: ReactNode
}) {
  const movements = data.metrics.slice(2, 6)
  const ceiling = Math.max(4, Math.ceil(Math.max(...movements) / 4) * 4)
  const total = data.circulation.length
  const circumference = 2 * Math.PI * 57
  let offset = 0
  const alertMax = Math.max(1, ...data.alerts.map((a) => a.cards.length))
  const scopeLabel = [
    filters.estate
      ? estates.find((estate) => estate.id === filters.estate)?.short
      : "Tất cả khu đô thị",
    filters.park || "Tất cả bãi xe",
    filters.type,
    filters.vehicle,
  ]
    .filter(Boolean)
    .join(" · ")
  const snapshotLabel = `Chốt ngày ${date(filters.end)} · ${scopeLabel}`
  return (
    <div className="management-report">
      <div className="report-period-note">
        <span>
          <span className="report-live-dot" /> Kỳ {date(filters.start)} –{" "}
          {date(filters.end)}
        </span>
        <span>Cơ cấu và cảnh báo chốt tại ngày {date(filters.end)}</span>
      </div>
      <div className="report-kpis">
        {[
          {
            label: "Tồn kho đầu kỳ",
            value: data.metrics[0],
            metric: 0,
            unit: "thẻ",
            icon: <Package size={19} />,
            note: "Số thẻ sẵn sàng cấp trước kỳ",
          },
          {
            label: "Tồn kho cuối kỳ",
            value: data.metrics[6],
            metric: 6,
            unit: "thẻ",
            icon: <Package size={19} />,
            note: "Số thẻ sẵn sàng cấp tại ngày chốt",
          },
          {
            label: "Thẻ lưu hành cuối kỳ",
            value: data.metrics[7],
            metric: 7,
            unit: "thẻ",
            icon: <CreditCard size={19} />,
            note: "Đã cấp, chưa thu hồi",
          },
          {
            label: "Mất / hỏng trong kỳ",
            value: data.metrics[5],
            metric: 5,
            unit: "lượt",
            icon: <TriangleAlert size={19} />,
            note: "Số lần phát sinh trong kỳ",
          },
        ].map((item, i) => (
          <Button
            key={item.metric}
            className={`report-kpi ${i === 3 ? "report-kpi-warning" : ""}`}
            disabled={!item.value}
            onClick={() => onMetric(item.metric)}
            aria-label={`${item.label}: ${fmt(item.value)} ${item.unit}. Xem chi tiết`}
          >
            <span className="report-kpi-top">
              <span>{item.label}</span>
              <span className="report-kpi-icon">{item.icon}</span>
            </span>
            <span className="report-kpi-value">
              {fmt(item.value)} <small>{item.unit}</small>
            </span>
            <span className="report-kpi-note">
              {item.note}
              <ArrowUpRight size={12} />
            </span>
          </Button>
        ))}
      </div>

      <div className="report-chart-grid">
        <section className="panel report-chart-panel movement-panel">
          <div className="report-chart-heading">
            <div>
              <span className="report-eyebrow">01 / BIẾN ĐỘNG</span>
              <Heading>Biến động thẻ trong kỳ</Heading>
              <p>Nhập, cấp phát, thu hồi và mất / hỏng</p>
            </div>
            <span className="report-chart-icon">
              <ChartNoAxesCombined size={21} />
            </span>
          </div>
          <div
            className="movement-chart"
            role="group"
            aria-label="Biểu đồ cột biến động thẻ trong kỳ"
          >
            <span className="chart-axis-unit">Lượt phát sinh</span>
            <div className="movement-plot">
              <div className="movement-grid" aria-hidden="true">
                {[4, 3, 2, 1, 0].map((n) => (
                  <div key={n}>
                    <span>{fmt((ceiling * n) / 4)}</span>
                    <i />
                  </div>
                ))}
              </div>
              <div className="movement-columns">
                {movements.map((value, i) => (
                  <Button
                    key={i}
                    className="movement-column"
                    disabled={!value}
                    aria-label={`${movementLabels[i]}: ${fmt(value)} lượt. Xem thẻ`}
                    onClick={() => onMetric(i + 2)}
                  >
                    <span className="movement-bar-space">
                      <span
                        className="movement-bar"
                        style={{
                          height: `${(value / ceiling) * 100}%`,
                          background: palette[i],
                        }}
                      >
                        <strong>{fmt(value)}</strong>
                      </span>
                    </span>
                    <span className="movement-label">
                      <i style={{ background: palette[i] }} />
                      {movementLabels[i]}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
          {!movements.some(Boolean) && (
            <p className="chart-empty">Không có phát sinh trong kỳ đã chọn.</p>
          )}
          <p className="chart-caption">
            Một thẻ có thể phát sinh nhiều lần. Chọn cột để xem các thẻ liên
            quan.
          </p>
          <Details
            title="Chi tiết biến động kho thẻ"
            subtitle={`Kỳ ${date(filters.start)} – ${date(filters.end)} · ${scopeLabel}`}
          >
            {stockDetails}
          </Details>
        </section>

        <section className="panel report-chart-panel circulation-panel">
          <div className="report-chart-heading">
            <div>
              <span className="report-eyebrow">02 / CƠ CẤU</span>
              <Heading>Cơ cấu thẻ lưu hành</Heading>
              <p>Tại ngày {date(filters.end)}</p>
            </div>
            <Select
              aria-label="Phân loại cơ cấu thẻ"
              className="report-group-select"
              value={groupBy}
              onChange={(e) => onGroupBy(e.target.value)}
              options={["Loại thẻ", "Loại phương tiện", "Nhóm khách hàng"]}
            />
          </div>
          <div className="donut-layout">
            <div className="donut-wrap">
              <svg
                viewBox="0 0 144 144"
                className="report-donut"
                role="group"
                aria-label={`Tỷ trọng theo ${groupBy.toLowerCase()}. Tổng ${fmt(total)} thẻ lưu hành.`}
              >
                <circle
                  cx="72"
                  cy="72"
                  r="57"
                  fill="none"
                  stroke="#eff1f5"
                  strokeWidth="17"
                />
                {data.groups.map((group, i) => {
                  const length = total
                    ? (group.cards.length / total) * circumference
                    : 0
                  const start = offset
                  offset += length
                  return length ? (
                    <circle
                      key={group.label}
                      cx="72"
                      cy="72"
                      r="57"
                      fill="none"
                      stroke={palette[i % palette.length]}
                      strokeWidth="17"
                      strokeDasharray={`${length} ${circumference - length}`}
                      strokeDashoffset={-start}
                      transform="rotate(-90 72 72)"
                      role="button"
                      tabIndex={0}
                      aria-label={`${group.label}: ${fmt(group.cards.length)} thẻ. Xem chi tiết`}
                      onClick={() =>
                        onCards(`Lưu hành · ${group.label}`, group.cards)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onCards(`Lưu hành · ${group.label}`, group.cards)
                        }
                      }}
                    />
                  ) : null
                })}
                <text x="72" y="72" textAnchor="middle" className="donut-total">
                  {fmt(total)}
                </text>
                <text
                  x="72"
                  y="89"
                  textAnchor="middle"
                  className="donut-subtitle"
                >
                  thẻ lưu hành
                </text>
              </svg>
            </div>
            <div className="donut-legend">
              {data.groups.map((group, i) => (
                <Button
                  key={group.label}
                  variant="ghost"
                  className="donut-legend-row"
                  disabled={!group.cards.length}
                  onClick={() =>
                    onCards(`Lưu hành · ${group.label}`, group.cards)
                  }
                >
                  <i style={{ background: palette[i % palette.length] }} />
                  <span>{group.label}</span>
                  <strong>{fmt(group.cards.length)}</strong>
                  <small>
                    {percent(total ? (group.cards.length / total) * 100 : 0)}
                  </small>
                </Button>
              ))}
            </div>
          </div>
          {!total && (
            <p className="chart-empty">Không có thẻ lưu hành tại ngày chốt.</p>
          )}
          <div className="usage-chart">
            <div className="usage-heading">
              <strong>Tình trạng sử dụng</strong>
              <span>Trong tổng thẻ lưu hành</span>
            </div>
            <div
              className="usage-stack"
              role="group"
              aria-label="Tình trạng sử dụng thẻ lưu hành"
            >
              {data.statuses.map((status, i) =>
                status.cards.length ? (
                  <Button
                    key={status.label}
                    style={{
                      width: `${(status.cards.length / total) * 100}%`,
                      background: [palette[2], palette[1], palette[3]][i],
                    }}
                    aria-label={`${status.label}: ${fmt(status.cards.length)} thẻ`}
                    title={`${status.label}: ${fmt(status.cards.length)} thẻ`}
                    onClick={() =>
                      onCards(`Lưu hành · ${status.label}`, status.cards)
                    }
                  />
                ) : null,
              )}
            </div>
            <div className="usage-legend">
              {data.statuses.map((status, i) => (
                <Button
                  key={status.label}
                  variant="ghost"
                  disabled={!status.cards.length}
                  onClick={() =>
                    onCards(`Lưu hành · ${status.label}`, status.cards)
                  }
                >
                  <i
                    style={{
                      background: [palette[2], palette[1], palette[3]][i],
                    }}
                  />
                  {status.label} <strong>{fmt(status.cards.length)}</strong>
                </Button>
              ))}
            </div>
          </div>
          <Details
            title="Chi tiết cơ cấu thẻ lưu hành"
            subtitle={`${snapshotLabel} · Phân loại theo ${groupBy.toLowerCase()}`}
          >
            {circulationDetails}
          </Details>
        </section>
      </div>

      <section className="panel report-chart-panel report-alerts-panel">
        <div className="report-chart-heading">
          <div>
            <span className="report-eyebrow">03 / CẢNH BÁO</span>
            <Heading>Cảnh báo cần rà soát</Heading>
            <p>
              <strong>{fmt(data.warned)} thẻ</strong> có ít nhất một cảnh báo
              tại ngày {date(filters.end)}
            </p>
          </div>
          <Button variant="link" onClick={onSettings}>
            <Settings2 size={14} />
            Cấu hình ngưỡng
          </Button>
        </div>
        <div
          className="alert-bar-chart"
          role="group"
          aria-label="Biểu đồ thanh ngang các nhóm cảnh báo"
        >
          {data.alerts.map((alert, i) => (
            <Button
              key={alert.label}
              variant="ghost"
              className="alert-bar-row"
              disabled={!alert.cards.length}
              onClick={() => onCards(`Cảnh báo · ${alert.label}`, alert.cards)}
            >
              <span className="alert-bar-label">
                <i style={{ background: palette[i] }} />
                {alert.label}
              </span>
              <span className="alert-bar-track">
                <span
                  style={{
                    width: `${(alert.cards.length / alertMax) * 100}%`,
                    background: palette[i],
                  }}
                />
              </span>
              <strong>
                {fmt(alert.cards.length)}
                <small> thẻ</small>
              </strong>
              <ArrowUpRight size={14} />
            </Button>
          ))}
        </div>
        <p className="chart-caption">
          <CircleHelp size={14} />
          Một thẻ có thể thuộc nhiều nhóm; tổng các nhóm không phải số thẻ duy
          nhất.
        </p>
        <Details title="Chi tiết cảnh báo thẻ" subtitle={snapshotLabel}>
          <div className="table-scroll">
            <table className="data-table report-alert-summary">
              <thead>
                <tr>
                  <th>Nhóm cảnh báo</th>
                  <th>Số thẻ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.alerts.map((alert) => (
                  <tr key={alert.label}>
                    <td>{alert.label}</td>
                    <td>{fmt(alert.cards.length)}</td>
                    <td>
                      <Button
                        variant="link"
                        disabled={!alert.cards.length}
                        onClick={() =>
                          onCards(`Cảnh báo · ${alert.label}`, alert.cards)
                        }
                      >
                        Xem danh sách <ArrowUpRight size={13} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Details>
      </section>
    </div>
  )
}
