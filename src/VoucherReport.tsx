import { useState } from "react"
import { Download, TrendingUp } from "lucide-react"
import { Button, Heading } from "./ui"
import { date, fmt } from "./data"
import { dayAt, shiftDay, vnNow } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import { ParkingTabs } from "./parking-ui"
import type { ExportParking, ExportRow, UpdateParams } from "./parking-ui"
import { selectVoucherSources, voucherKinds, voucherStats } from "./voucher-baseline"
import type { VoucherBaseline, VoucherScope } from "./voucher-baseline"
import { VoucherTable } from "./VoucherUI"

const palette = ["#397ac5", "#e68446", "#34a283", "#8468be", "#ca729b", "#9ba8b9"]
const rate = (used: number, issued: number) => `${(issued ? used / issued * 100 : 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%`
export default function VoucherReport({ state, scope, access, params, update, exportFile }: { state: VoucherBaseline; scope: VoucherScope; access: ParkingAccess; params: URLSearchParams; update: UpdateParams; exportFile: ExportParking }) {
  const tab = ["overview", "merchant", "type"].includes(params.get("vbReport") || "") ? params.get("vbReport")! : "overview"
  const sources = selectVoucherSources(state, { ...scope, from: "", to: "", status: "", query: "" }, access)
  const stats = voucherStats(state, sources, scope.from, scope.to)
  const days: string[] = []
  if (scope.from && scope.to && scope.from <= scope.to) for (let day = scope.from; day <= scope.to; day = shiftDay(day, 1)) days.push(day)
  const daily = days.map((day) => ({ day, ...voucherStats(state, sources, day, day) }))
  const max = Math.max(1, ...daily.flatMap((row) => [row.issued, row.used]))
  const merchantRows = state.merchants.map((merchant) => ({ merchant, ...voucherStats(state, sources.filter((row) => row.merchant === merchant.id), scope.from, scope.to) }))
    .filter((row) => row.issued || row.used).sort((a, b) => b.issued - a.issued)
  const merchantData = (row: typeof merchantRows[number]): ExportRow => ({ "Gian hàng": row.merchant.name, "Số bill": row.sourceCount, "Phát hành": row.issued, "Đã dùng": row.used,
    "Tổng ưu đãi · Tiền (₫)": row.benefitAmount, "Tổng ưu đãi · Thời gian (phút)": row.benefitMinutes, "Khấu trừ (₫)": row.discount, "Tỷ lệ": rate(row.used, row.issued) })
  const typeRows = Object.entries(voucherKinds).map(([kind, label]) => ({ kind, label, ...voucherStats(state, sources.filter((row) => row.kind === kind), scope.from, scope.to) }))
  const dailyRows = daily.map((row) => ({ day: row.day, data: { "Ngày": date(row.day), ...Object.fromEntries(typeRows.map((type) => [type.label, voucherStats(state, sources.filter((source) => source.kind === type.kind), row.day, row.day).issued])), "Tổng": row.issued } }))
  const other = merchantRows.slice(5).reduce((sum, row) => sum + row.issued, 0)
  const donut = [...merchantRows.slice(0, 5).map((row) => ({ id: row.merchant.id, label: row.merchant.name, value: row.issued })), ...(other ? [{ id: "other", label: "Khác", value: other }] : [])]
  let offset = 0
  const circumference = 2 * Math.PI * 57
  const labels = { overview: "Tổng quan", merchant: "Theo gian hàng", type: "Theo loại voucher" }
  return <div className="voucher-baseline-report">
    <div className="panel parking-toolbar"><ParkingTabs options={Object.values(labels)} value={labels[tab as keyof typeof labels]} change={(label) => update({ vbReport: Object.keys(labels).find((key) => labels[key as keyof typeof labels] === label)!, page: null, vbSort: null, vbDir: null })} />
      <Button disabled={tab === "overview"} title={tab === "overview" ? "Tab Tổng quan chưa hỗ trợ xuất báo cáo" : undefined} onClick={() => exportFile("BaoCaoVoucher", () => ({ [tab === "merchant" ? "Theo gian hàng" : "Theo loại voucher"]: tab === "merchant" ? merchantRows.map(merchantData) : dailyRows.map((row) => row.data) }))}><Download size={15} />Xuất báo cáo</Button>
    </div>
    <p className="revenue-period-status">Từ {date(scope.from)} đến {date(scope.to)}</p>
    {tab === "overview" && <>
      <div className="parking-kpis voucher-baseline-kpis">{[
        { label: "Tổng voucher phát hành", value: fmt(stats.issued), hint: `+${fmt(stats.today)} hôm nay · Từ ${fmt(stats.sourceCount)} hóa đơn` },
        { label: "Voucher đã sử dụng", value: fmt(stats.used), hint: `${rate(stats.used, stats.issued)} tỷ lệ` },
        { label: "Tổng quyền ưu đãi", value: `${fmt(stats.benefitMinutes / 60)} giờ`, hint: `≈ ${fmt(stats.benefitMinutes)} phút · ưu đãi tiền ${fmt(stats.benefitAmount)} ₫` },
        { label: "Tổng tiền khấu trừ", value: `${fmt(stats.discount)} ₫`, hint: "Trong khoảng đã lọc" },
        { label: "Hết hạn chưa dùng", value: fmt(stats.expired), hint: `${rate(stats.expired, stats.issued)} tổng phát hành` },
      ].map((item) => <div className="summary-card" key={item.label}><div className="summary-top">{item.label}</div><div className="summary-value">{item.value}</div><div className="summary-sub">{item.hint}</div></div>)}</div>
      <section className="panel parking-chart"><div className="parking-chart-header"><div><Heading>Biến động voucher theo ngày</Heading><p>Mã phát hành và lượt đã sử dụng mỗi ngày</p></div><TrendingUp size={18} /></div>
        <div className="parking-chart-body"><div className="parking-legend"><span><i style={{ background: palette[0] }} />Phát hành</span><span><i style={{ background: palette[2] }} />Đã sử dụng</span></div>
          <div className="voucher-trend-scroll"><svg viewBox="0 0 800 235" className="voucher-trend-chart" role="img" aria-label="Biến động voucher phát hành và đã sử dụng theo ngày">
            {[0, 1, 2, 3, 4].map((n) => <g key={n}><line x1="40" x2="775" y1={200 - n * 43} y2={200 - n * 43} stroke="#e9edf3" /><text x="30" y={204 - n * 43} textAnchor="end">{Math.round(max * n / 4)}</text></g>)}
            {(["issued", "used"] as const).map((key, series) => <g key={key}><polyline fill="none" stroke={palette[series ? 2 : 0]} strokeWidth="2.5" points={daily.map((row, i) => `${48 + i / Math.max(1, daily.length - 1) * 715},${200 - row[key] / max * 172}`).join(" ")} />
              {daily.map((row, i) => <circle key={row.day} cx={48 + i / Math.max(1, daily.length - 1) * 715} cy={200 - row[key] / max * 172} r="3.5" fill={palette[series ? 2 : 0]}><title>{`${date(row.day)}: phát hành ${row.issued}, đã sử dụng ${row.used}`}</title></circle>)}</g>)}
            {daily.filter((_, i) => daily.length <= 14 || i % Math.ceil(daily.length / 10) === 0).map((row) => <text key={row.day} x={48 + days.indexOf(row.day) / Math.max(1, daily.length - 1) * 715} y="225" textAnchor="middle">{date(row.day).slice(0, 5)}</text>)}
          </svg></div>
        </div>
      </section>
    </>}
    {tab === "merchant" && <>
      <section className="panel parking-chart"><div className="parking-chart-header"><div><Heading>Phân bố theo gian hàng</Heading><p>Tỷ trọng mã phát hành của 5 gian hàng nhiều nhất</p></div></div><div className="parking-chart-body voucher-merchant-donut">
        <svg viewBox="0 0 144 144" role="img" aria-label="Phân bố voucher phát hành theo gian hàng"><circle cx="72" cy="72" r="57" fill="none" stroke="#edf1f6" strokeWidth="17" />
          {donut.map((row, index) => { const length = stats.issued ? row.value / stats.issued * circumference : 0; const start = offset; offset += length; return <circle key={row.id} cx="72" cy="72" r="57" fill="none" stroke={palette[index]} strokeWidth="17" transform="rotate(-90 72 72)" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-start}><title>{`${row.label}: ${fmt(row.value)}`}</title></circle> })}
          <text x="72" y="72" textAnchor="middle" className="voucher-ring-total">{fmt(stats.issued)}</text><text x="72" y="88" textAnchor="middle" className="voucher-ring-caption">voucher phát hành</text></svg>
        <div className="voucher-merchant-legend">{donut.map((row, index) => <div key={row.id}><i style={{ background: palette[index] }} /><span>{row.label}</span><strong>{fmt(row.value)}</strong><small>{rate(row.value, stats.issued)}</small></div>)}{!stats.issued && <p className="parking-empty">Chưa có voucher phát hành</p>}</div>
      </div></section>
      <section className="panel"><div className="parking-chart-header"><Heading>Thống kê theo gian hàng</Heading></div><VoucherTable tableKey="report-merchants" rows={merchantRows} rowKey={(row) => row.merchant.id} data={merchantData} params={params} update={update} required="Gian hàng" empty="Chưa có gian hàng phát hành voucher trong khoảng này" /></section>
    </>}
    {tab === "type" && <>
      <section className="panel parking-detail-panel"><Heading>Phân bố theo loại voucher</Heading><p className="parking-chart-note">Số mã phát hành và tỷ trọng trên tổng phát hành</p>
        <div className="voucher-type-summary">{typeRows.map((row, index) => <div key={row.kind}><span>{row.label}</span><strong>{fmt(row.issued)} <small>· {rate(row.issued, stats.issued)}</small></strong>
          <div className="voucher-type-track"><i style={{ width: `${stats.issued ? row.issued / stats.issued * 100 : 0}%`, background: palette[index] }} /></div><small>Đã dùng {fmt(row.used)} · tỷ lệ {rate(row.used, row.issued)}</small></div>)}</div>
      </section>
      <section className="panel"><div className="parking-chart-header"><div><Heading>Báo cáo chi tiết theo ngày</Heading><p>Số mã phát hành mỗi ngày theo loại voucher</p></div></div>
        <VoucherTable tableKey="report-types" rows={[{ day: "total", data: { "Ngày": "Tổng cộng", ...Object.fromEntries(typeRows.map((row) => [row.label, row.issued])), "Tổng": stats.issued } }, ...dailyRows]} rowKey={(row) => row.day} data={(row) => row.data} params={params} update={update} controls={false} />
      </section>
    </>}
  </div>
}
