import { Component, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { ArrowUpRight, BarChart3, CircleDot, Download, LoaderCircle, PieChart, Table2, TrendingUp, TriangleAlert } from "lucide-react"
import { Button, Field, Heading, Input, Overlay, Select } from "./ui"
import { date, fmt } from "./data"
import { allowedSites, siteById } from "./parking-model"
import type { ParkingAccess, ParkingSettings } from "./parking-model"
import { ExportButton, ParkingTable, TextLink, allOption } from "./parking-ui"
import type { ExportParking, ExportRow, TableColumn } from "./parking-ui"
import { amountKeys, amountLabels, dateCell, daysFor, estateName, lossReasons, methods, monthEnd, revenueAccess, revenueShifts, scopeRows, sources, subscriptionGroups, subscriptionRevenue, totals } from "./revenue-model"
import type { AmountKey, LedgerRow, RevenueFilter, RevenueState } from "./revenue-model"
import { balances, changeRow, dateSpan, dayRow, dayStatus, debtRow, discountRows, formatCell, groupRows, ledgerRow, lossRow, money, percentage, sourceRow, subscriptionRow } from "./revenue-tables"
import { revenueDebtPatch, revenueLookupPatch } from "./revenue-lookup"
import type { RevenueDrill } from "./revenue-lookup"
import { revenueMatches, revenueSelectionLabel } from "./revenue-filter-values"
import { discountChartGroups, topDiscountGroups } from "./revenue-charts"
import { RevenueDonut, RevenueLossRanking } from "./RevenueCharts"
import { revenueHistoryParams } from "./revenue-entry"

export type RevenueNavigate = (patch: Record<string, string | null>, screen?: import("./revenue-model").RevenueScreen, preserve?: boolean) => void
export type Drill = RevenueDrill
const names = [
  "Từ giá niêm yết đến tiền thu", "Doanh thu theo nguồn thu", "Tiền thu theo ngày và phương thức",
  "Miễn / giảm theo chính sách", "Thất thu theo lý do", "Công nợ voucher theo loại đơn vị", "Doanh thu thuê bao",
]
const blue = "#397ac5", orange = "#e68446", red = "#d94753", green = "#34a283", violet = "#8468be"
const paymentColors = [blue, orange, green, "#ca729b", "#6478bd", violet]
type Part = { label: string; value: number; color: string; action?: () => void }
type Bar = { label: string; parts: Part[]; action?: () => void; missing?: string; base?: number; display?: number }

class RevenueChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <div className="parking-empty" role="alert"><TriangleAlert size={16} /> Không tải được dữ liệu
      <Button onClick={() => this.setState({ failed: false })}>Thử lại</Button></div> : this.props.children
  }
}
function CardChart({ index, description, detail, children, note }: { index: number; description: string; detail: () => void; children: ReactNode; note?: ReactNode }) {
  const Icon = index === 2 ? TrendingUp : index === 3 ? PieChart : index === 4 ? CircleDot : BarChart3
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return <section className={`panel parking-chart ${index === 2 ? "parking-chart-full" : ""}`}>
    <header className="parking-chart-header"><div><Heading>{names[index]}</Heading><p>{description}</p></div><span className="report-chart-icon"><Icon size={17} /></span></header>
    <div className="parking-chart-body"><RevenueChartBoundary key={description}>{ready ? children :
      <div className="parking-empty"><LoaderCircle size={17} className="animate-spin" />Đang tải biểu đồ…</div>}</RevenueChartBoundary></div>
    {note && <p className="parking-chart-note">{note}</p>}
    <Button variant="ghost" className="parking-chart-footer" onClick={detail}><Table2 size={15} />Xem số liệu chi tiết<ArrowUpRight size={15} /></Button>
  </section>
}
function Bars({ bars, vertical = false, trend = false }: { bars: Bar[]; vertical?: boolean; trend?: boolean }) {
  const sum = (bar: Bar) => bar.parts.reduce((n, part) => n + Math.max(0, part.value), 0)
  const max = Math.max(1, ...bars.map((bar) => sum(bar) + (bar.base ?? 0)))
  const legends = [...new Map(bars.flatMap((bar) => bar.parts).filter((part) => part.label).map((part) => [part.label, part.color])).entries()]
  if (!bars.length) return <div className="parking-empty">Chưa có dữ liệu</div>
  return <>
    {legends.length > 1 && <div className="parking-legend revenue-legend">{legends.map(([name, color]) => <span key={name}><i style={{ background: color }} />{name}</span>)}
      {trend && <span><i className="revenue-trend-key" />Tổng tiền thu & voucher</span>}</div>}
    <div className={vertical ? "revenue-vertical-scroll" : ""}>
      <div className={vertical ? "revenue-vertical" : "revenue-horizontal"} style={vertical ? { gridTemplateColumns: `repeat(${bars.length}, minmax(42px, 1fr))`, minWidth: bars.length * 48 - 6 } : undefined}>
        {trend && <svg className="revenue-trend" viewBox={`0 0 ${bars.length * 48 - 6} 160`} preserveAspectRatio="none" aria-hidden="true">
          <polyline fill="none" stroke="#334c6b" strokeWidth="2" vectorEffect="non-scaling-stroke"
            points={bars.map((bar, index) => `${index * 48 + 21},${160 - sum(bar) / max * 156}`).join(" ")} />
        </svg>}
        {bars.map((bar) => {
          const title = [bar.label, ...bar.parts.filter((part) => part.label).map((part) => `${part.label} ${money(part.value)}`), money(bar.display ?? sum(bar))].join(" · ")
          return <div className="revenue-bar" key={bar.label} title={title}>
            <button className="revenue-bar-name" type="button" onClick={bar.action} disabled={!bar.action}>{bar.label}</button>
            {trend && <button type="button" className="revenue-trend-point" style={{ top: 177 - sum(bar) / max * 156 }}
              onClick={bar.action} disabled={!bar.action} title={title} aria-label={`${bar.label} · Tổng tiền thu và voucher ${money(sum(bar))}`} />}
            {bar.missing ? <em className="muted">{bar.missing}</em> :
              <div className="revenue-track" style={vertical && bar.base ? { paddingBottom: `${bar.base / max * 156}px` } : undefined}>
                {bar.parts.map((part, index) => {
                  const action = part.action ?? bar.action
                  const style = vertical ? { height: `${Math.max(0, part.value) / max * 156}px`, backgroundColor: part.color }
                    : { width: `${Math.max(0, part.value) / max * 100}%`, backgroundColor: part.color }
                  return action && part.value > 0 ? <button key={index} type="button" title={title} aria-label={[bar.label, part.label, money(part.value)].filter(Boolean).join(" · ")}
                    onClick={action} style={style} /> : <span key={index} style={style} />
                })}
              </div>}
            {!bar.missing && <button type="button" className="revenue-bar-value" onClick={bar.action} disabled={!bar.action}
              aria-label={`${bar.label} · Tổng ${money(bar.display ?? sum(bar))}`}>{vertical ? compactMoney(bar.display ?? sum(bar)) : fmt(bar.display ?? sum(bar))}</button>}
          </div>
        })}
      </div>
    </div>
  </>
}
const compactMoney = (amount: number) => Math.abs(amount) >= 1e6
  ? `${(amount / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr` : fmt(amount)
export function DataTable<T>({ rows, data, rowKey, link, empty, columns, rowClass }: {
  rows: T[]; data: (row: T) => ExportRow; rowKey: (row: T, index: number) => string
  link?: (row: T, key: string, value: ExportRow[string]) => ReactNode | undefined
  empty?: ReactNode; columns?: string[]; rowClass?: (row: T) => string
}) {
  const entries = rows.map((row, index) => ({ row, data: data(row), id: rowKey(row, index) }))
  const keys = columns ?? [...new Set(entries.flatMap((row) => Object.keys(row.data)))]
  const table: TableColumn<typeof entries[number]>[] = keys.map((key) => ({
    label: key, numeric: key.includes("(₫)") || key.startsWith("Số "),
    cell: (item) => link?.(item.row, key, item.data[key]) ?? <span className="revenue-cell" title={formatCell(item.data[key])}>{formatCell(item.data[key])}</span>,
  }))
  return <ParkingTable columns={table} rows={entries} rowKey={(row) => row.id} rowClass={rowClass && ((row) => rowClass(row.row))} empty={empty} />
}

interface Props {
  ledger: LedgerRow[]; state: RevenueState; parking: ParkingSettings; filter: RevenueFilter; access: ParkingAccess
  cutoff: string; actor: string; exportFile: ExportParking; navigate: RevenueNavigate
}
export default function RevenueDashboard({ ledger, state, parking, filter, access, cutoff, actor, exportFile, navigate, exportAction }: Props & {
  exportAction?: (action: ReactNode) => ReactNode
}) {
  const [popup, setPopup] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<string[]>([])
  const [split, setSplit] = useState(false)
  const [unitFilter, setUnitFilter] = useState("")
  const [month, setMonth] = useState(filter.end.slice(0, 7))
  const selected = useMemo(() => scopeRows(ledger, filter, access), [ledger, filter, access])
  const allVehicles = useMemo(() => scopeRows(ledger, filter, access, false), [ledger, filter, access])
  const sites = allowedSites(access).filter((site) => revenueMatches(site.estate, filter.estate))
  const total = totals(selected)
  const mismatches = selected.filter((row) => row.revenue !== row.collected + row.debt + row.lost - row.excess ||
    row.revenue !== row.net + row.vat)
  const days = daysFor(filter.start, filter.end)
  const daily = groupRows(allVehicles, (row) => row.revenueDay)
  const day = (day: string) => daily.get(day) ?? []
  const status = (estate: string, day: string) => dayStatus(state, parking, estate, day, sites.filter((site) => site.estate === estate).map((site) => site.id))
  const discounts = discountRows(selected, state)
  const discountGroups = discountChartGroups(selected, state)
  const visibleDiscounts = topDiscountGroups(discountGroups)
  const discountTotal = totals(selected, true).reduction
  const discountedCount = selected.filter((row) => row.discounts.length).length
  const reviews = selected.filter((row) => row.discounts.some((item) => item.review)).length
  const debt = balances(ledger, selected, state, cutoff)
  const owed = debt.reduce((n, row) => n + row.remaining, 0)
  const overdue = debt.reduce((n, row) => n + row.overdue, 0)
  const reportMonth = filter.end.slice(0, 7)
  const subs = subscriptionRevenue(reportMonth, filter, access)
  const subTotal = subscriptionRow("Tổng cộng", subs)
  const subsDetail = popup === 6 && month !== reportMonth ? subscriptionRevenue(month, filter, access) : subs
  const adjustments = state.changes.filter((row) => sites.some((site) => site.estate === row.estate) && revenueMatches(row.site, filter.site) && row.recorded >= filter.start && row.recorded <= filter.end)
  const go = (drill: Drill) => {
    if (!revenueAccess(access, "revenue-lookup")) return
    const current = window.location.search
    setPopup(null)
    const debtPatch = revenueAccess(access, "revenue-debt") ? revenueDebtPatch(filter, drill, cutoff) : null
    navigate({ ...(debtPatch ?? revenueLookupPatch(filter, drill)), origin: current }, debtPatch ? "revenue-debt" : "revenue-lookup", false)
  }
  const open = (index: number, focus?: string) => {
    setPopup(index); setExpanded(focus ? [focus] : []); setSplit(false); setUnitFilter(""); setMonth(reportMonth)
  }
  const toggle = (key: string) => setExpanded((old) => old.includes(key) ? old.filter((value) => value !== key) : [...old, key])
  const toggleLink = (key: string, label: string) => <TextLink onClick={() => toggle(key)}>{expanded.includes(key) ? "▾" : "▸"} {label}</TextLink>
  const link = (value: ExportRow[string], drill: Drill) => typeof value === "number" && value !== 0 && !["gross", "net", "vat"].includes(drill.amount || "")
    ? <TextLink onClick={() => go(drill)}>{fmt(value)}</TextLink> : undefined
  const moneyKey = (column: string) => amountKeys.find((key) => `${amountLabels[key]} (₫)` === column)
  const context = (label: string, column: string, extra: Omit<Drill, "label"> = {}): Drill => ({
    ...extra, label: `${label} · ${column.replace(" (₫)", "")}`,
    amount: column === "Còn phải thu (₫)" ? "receivable" : column === "Voucher (₫)" ? "debt"
      : methods.some((method) => `${method} (₫)` === column) ? column : moneyKey(column),
  })
  const totalName = access.estate ? "Tổng trong phạm vi quyền" : "Tổng cộng"
  const revenueSources = Object.entries(sources)
  const estateGroups = groupRows(selected, (row) => row.estate)
  const activeEstates = [...new Set(sites.map((site) => site.estate))]
  const regularRows = selected.filter((row) => row.source !== "FREE" && row.source !== "SUB")
  const subGroups = (rows: typeof subs, separated = false) =>
    (separated ? [...groupRows(rows, (row) => row.estate)] : [["", rows] as const]).flatMap(([estate, items]) =>
      subscriptionGroups.map((group) => ({ estate, group, items: items.filter((row) => row.group === group) })))
  const monthlyOperating = (value: string) => totals(scopeRows(ledger, { ...filter, start: `${value}-01`, end: monthEnd(value) < cutoff ? monthEnd(value) : cutoff }, access)).revenue
  const sourceLines = (includeVehicles: boolean) => [
    { name: totalName, rows: regularRows, source: "", vehicle: "" },
    ...revenueSources.flatMap(([source, label]) => {
      const rows = selected.filter((row) => row.source === source)
      const heading = { name: `${label} (${source})`, rows, source, vehicle: "" }
      return [heading, ...(includeVehicles && source !== "MT" && source !== "CT"
        ? [...groupRows(rows, (row) => row.vehicle)].map(([vehicle, items]) => ({ name: vehicle, rows: items, source, vehicle })) : [])]
    }),
  ]
  const sourceData = (row: ReturnType<typeof sourceLines>[number]) => row.source === "APP" && filter.end < "2027-03-01" && !row.rows.length
    ? { "Đơn vị / nguồn thu": row.name, "Doanh thu (₫)": "Chưa có dữ liệu" } : sourceRow(row.name, row.rows, row.source)
  const dayEntries = days.slice().reverse().map((value) => ({ day: value, rows: day(value) }))
  const dayBreakdown = (includeShifts: boolean) => [
    { label: totalName, day: "", shift: "", estate: "", rows: allVehicles, status: "" },
    ...dayEntries.flatMap((entry) => [{
      label: date(entry.day), day: entry.day, shift: "", estate: "", rows: entry.rows,
      status: activeEstates.map((id) => `${activeEstates.length > 1 ? estateName(id) + ": " : ""}${status(id, entry.day)}`).join(" · "),
    }, ...(includeShifts ? sites.filter((site) => revenueMatches(site.id, filter.site)).flatMap((site) =>
      revenueShifts(site.id, entry.day, parking, state).map((shift) => ({
        label: `${site.label} · ${shift.name}`, day: entry.day, shift: shift.id, estate: site.estate,
        rows: entry.rows.filter((row) => row.shiftId === shift.id),
        status: state.closes[shift.id] ? `Đã chốt · ${state.closes[shift.id].actor}` : "Chưa chốt",
      }))) : [])]),
  ]
  const lossEntries = [
    { label: totalName, rows: selected, estate: "", site: "" },
    ...[...estateGroups].flatMap(([estate, rows]) => [
      { label: estateName(estate), rows, estate, site: "" },
      ...[...groupRows(rows, (row) => row.site)].map(([site, items]) => ({ label: siteById(site)?.label ?? site, rows: items, estate, site })),
    ]),
  ]
  const discountExport = (rows: ReturnType<typeof discountRows>) => [
    { "Chính sách": totalName, "Số lượt": discountedCount, "Giá niêm yết (₫)": totals(selected.filter((row) => row.discounts.length), true).gross,
      "Miễn / giảm (₫)": discountTotal, "Miễn toàn bộ": selected.filter((row) => row.source === "FREE").length, "Cần kiểm tra": reviews },
    ...rows.map((row) => row.data),
  ]
  const exportReport = () => exportFile("BaoCaoDoanhThu", () => ({
    "Thông tin": [{
      "Từ ngày": dateCell(filter.start), "Đến ngày": dateCell(filter.end), "Số liệu đến": dateCell(cutoff),
      "Khu đô thị": filter.estate ? revenueSelectionLabel(filter.estate, estateName) : "Tất cả trong phạm vi quyền",
      "Bãi xe": filter.site ? revenueSelectionLabel(filter.site, (id) => siteById(id)?.label ?? id) : "Tất cả", "Loại xe": filter.vehicle.split("|").join(", ") || "Tất cả",
      "Người xuất": actor, "Giờ xuất": new Date(Date.now() + 7 * 3600000),
    }, ...activeEstates.flatMap((estate) => days.map((day) => ({ "Khu đô thị": estateName(estate), "Ngày doanh thu": dateCell(day),
      "Trạng thái chốt": status(estate, day), "Giờ bắt đầu ngày doanh thu": state.configs.find((row) => row.estate === estate && row.from <= day)?.hour ?? "07:00" })))],
    "1-TongHop": sourceLines(true).map(sourceData),
    "2-ThuTienTheoNgay": dayBreakdown(true).map((row) => dayRow(row.label, row.rows, row.status)),
    "3-MienGiam": discountExport(discounts), "4-CongNo": debt.map(debtRow), "5-ThatThu": lossEntries.map((row) => lossRow(row.label, row.rows)),
    ...(filter.start === `${reportMonth}-01` && filter.end === monthEnd(reportMonth) ? {
      "6-ThueBao": [subTotal, ...subGroups(subs).map((row) => subscriptionRow(row.group, row.items)),
        { "Nhóm thuê bao": "Tổng doanh thu bãi xe", "Doanh thu (₫)": monthlyOperating(reportMonth) + Number(subTotal["Doanh thu (₫)"]) }],
    } : {}),
    ...(revenueAccess(access, "revenue-lookup") ? { "7-ChiTiet": selected.map((row) => ledgerRow(row, state)) } : {}),
    ...(adjustments.length ? { "Điều chỉnh sau chốt": adjustments.map(changeRow) } : {}),
  }), selected.length)
  let table: ReactNode
  let exportRows: () => ExportRow[] = () => []
  if (popup === 0) {
    const rows = [{ label: totalName, rows: regularRows, estate: "", site: "" }, ...[...estateGroups].flatMap(([estate, rows]) =>
      [{ label: estateName(estate), rows: rows.filter((row) => row.source !== "FREE" && row.source !== "SUB"), estate, site: "" },
        ...[...groupRows(rows, (row) => row.site)].map(([site, items]) => ({ label: siteById(site)?.label ?? site, rows: items.filter((row) => row.source !== "FREE" && row.source !== "SUB"), estate, site }))])]
    exportRows = () => rows.map((row) => sourceRow(row.label, row.rows))
    table = <DataTable rows={rows.filter((row) => !row.site || expanded.includes(row.estate))} rowKey={(row) => row.label} data={(row) => sourceRow(row.label, row.rows)}
      link={(row, column, value) => column === "Đơn vị / nguồn thu" && row.estate && !row.site ? toggleLink(row.estate, row.label) :
        link(value, context(row.label, column, { estate: row.estate, site: row.site, source: "included" }))} />
  }
  if (popup === 1) {
    const rows = sourceLines(true)
    exportRows = () => rows.map(sourceData)
    table = <DataTable rows={rows.filter((row) => !row.vehicle || expanded.includes(row.source))} rowKey={(row) => `${row.source}/${row.vehicle}`}
      data={sourceData} link={(row, column, value) => column === "Đơn vị / nguồn thu" && row.source && !row.vehicle && rows.some((item) => item.source === row.source && item.vehicle)
        ? toggleLink(row.source, row.name) : link(value, context(row.name, column, { source: row.source || "included", vehicle: row.vehicle }))} />
  }
  if (popup === 2) {
    const rows = dayBreakdown(true)
    exportRows = () => rows.map((row) => dayRow(row.label, row.rows, row.status))
    table = <><DataTable rows={rows.filter((row) => !row.shift || expanded.includes(row.day))} rowKey={(row) => row.shift || row.label}
      data={(row) => dayRow(row.label, row.rows, row.status)} link={(row, column, value) =>
        column === "Ngày doanh thu / ca" && row.day && !row.shift ? toggleLink(row.day, row.label)
          : link(value, context(row.label, column, { day: row.day, shift: row.shift, source: "included", vehicle: "*" }))} />
      {adjustments.length > 0 && <div className="parking-banner">{fmt(adjustments.length)} khoản điều chỉnh sau chốt
        <TextLink onClick={() => { setPopup(null); navigate({ ...filter, ...revenueHistoryParams(filter) }, "revenue-lookup", false) }}>Xem lịch sử ghi nhận</TextLink></div>}</>
  }
  if (popup === 3) {
    const rows = discountRows(selected, state, split)
    const items = [{ code: "", estate: "", label: totalName, data: discountExport([])[0] }, ...rows]
    exportRows = () => discountExport(rows)
    table = <><label className="revenue-toggle"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />Tách theo khu đô thị</label>
      <DataTable rows={items} rowKey={(row) => `${row.code}/${row.estate}`} data={(row) => row.data}
        link={(row, column, value) => link(value, context(row.label, column, { estate: row.estate, policy: row.code || "*", review: column === "Cần kiểm tra" ? "1" : undefined }))} /></>
  }
  if (popup === 4) {
    exportRows = () => lossEntries.map((row) => lossRow(row.label, row.rows))
    table = <DataTable rows={lossEntries.filter((row) => !row.site || expanded.includes(row.estate))} rowKey={(row) => row.label}
      data={(row) => lossRow(row.label, row.rows)} link={(row, column, value) => {
        if (column === "Đơn vị" && row.estate && !row.site) return toggleLink(row.estate, row.label)
        const reason = lossReasons.find((item) => `${item} (₫)` === column)
        return link(value, { ...context(row.label, column, { estate: row.estate, site: row.site, reason }), amount: reason ? "lost" : moneyKey(column) })
      }} />
  }
  if (popup === 5) {
    const rows = debt.filter((row) => !unitFilter || row.type === unitFilter)
    exportRows = () => rows.map(debtRow)
    table = <><div className="revenue-popup-controls"><Field label="Loại đơn vị"><Select value={unitFilter} options={[allOption("Tất cả loại đơn vị"), ...new Set(debt.map((row) => row.type))]}
      onChange={(e) => setUnitFilter(e.target.value)} /></Field></div>
      <DataTable rows={rows} rowKey={(row) => row.id} data={debtRow}
        link={(row, column, value) => link(value, { label: `${row.name} · ${column}`, unit: row.id,
          amount: column === "Đã trả (₫)" ? "debtPaid" : column === "Còn nợ (₫)" ? "debtRemaining" : column === "Quá hạn (₫)" ? "overdue" : "debt" })} /></>
  }
  if (popup === 6) {
    const monthTotal = subscriptionRow(totalName, subsDetail)
    const rows = [{ estate: "", group: totalName, items: subsDetail }, ...subGroups(subsDetail, split)]
    exportRows = () => rows.map((row) => ({ ...subscriptionRow(row.group, row.items), ...(split ? { "Khu đô thị": estateName(row.estate) } : {}) }))
    table = <><div className="revenue-popup-controls">
      <Field label="Tháng dịch vụ"><Input type="month" max={cutoff.slice(0, 7)} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></Field>
      <label className="revenue-toggle"><input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />Tách theo khu đô thị</label>
    </div>
      {month === cutoff.slice(0, 7) && <div className="parking-banner warning">Tháng chưa kết thúc</div>}
      {subsDetail.length ? <DataTable rows={rows} rowKey={(row) => `${row.group}/${row.estate}`}
        data={(row) => ({ ...subscriptionRow(row.group, row.items), ...(split ? { "Khu đô thị": estateName(row.estate) } : {}) })}
        link={(row, column, value) => link(value, { label: `${row.group} · ${column}`, month, group: row.group === totalName ? "" : row.group, estate: row.estate,
          amount: column === "Đã thu (₫)" ? "subPaid" : column === "Chưa thu (₫)" ? "subUnpaid" : moneyKey(column) })} /> : <div className="parking-empty">Chưa có dữ liệu SAP của tháng</div>}
      <div className="parking-banner">Tổng doanh thu bãi xe {money(monthlyOperating(month) + Number(monthTotal["Doanh thu (₫)"]))}{!subsDetail.length && " · chưa gồm thuê bao"}</div></>
  }
  const waterfall: [AmountKey, number, string][] = [["gross", 0, "#b2bdcc"], ["reduction", total.revenue, "#cf7299"],
    ["revenue", 0, "#586a82"], ["paid", 0, blue], ["debt", total.paid, orange], ["lost", total.paid + total.debt, red]]
  const part = (label: string, value: number, color: string, action?: () => void) => ({ label, value, color, action })
  const kpis = [
    { label: "Doanh thu", amount: total.revenue, hint: `${fmt(total.count)} lượt tính doanh thu`, index: 0, drill: { source: "included", amount: "revenue" } },
    { label: "Đã thu", amount: total.paid, hint: `${percentage(total.paid, total.revenue)} doanh thu`, index: 2, drill: { source: "included", amount: "paid" } },
    { label: "Còn nợ voucher", amount: owed, hint: `Quá hạn ${money(overdue)}`, index: 5, drill: { amount: "debtRemaining" } },
    { label: "Thất thu", amount: total.lost, hint: `${percentage(total.lost, total.revenue)} doanh thu`, index: 4, drill: { source: "included", amount: "lost" } },
    { label: "Miễn / giảm", amount: discountTotal, hint: `${fmt(discountedCount)} lượt · ${discountGroups.length} nhóm chính sách`, index: 3, drill: { policy: "*", amount: "reduction" } },
    { label: "Doanh thu thuê bao", amount: subs.length ? Number(subTotal["Doanh thu (₫)"]) : null, hint: `Tháng ${reportMonth.split("-").reverse().join("/")} · ${fmt(subs.length)} thuê bao`, index: 6, drill: { month: reportMonth, amount: "revenue" } },
  ]
  return <>
    {exportAction?.(<Button onClick={exportReport}><Download size={15} /> Xuất báo cáo (mẫu 4.3)</Button>)}
    {!!mismatches.length && <div className="parking-banner error" role="alert"><TriangleAlert size={16} />
      {fmt(mismatches.length)} lượt không cân bằng · {[...new Set(mismatches.map((row) => estateName(row.estate)))].join(", ")}
    </div>}
    <div className="parking-kpis revenue-kpis">{kpis.map((item) => <button type="button" key={item.label}
      className={`summary-card ${item.index === 4 && total.lost ? "parking-kpi-warning" : ""}`}
      disabled={!revenueAccess(access, "revenue-lookup") || item.amount === null}
      title="Xem tại Đối soát doanh thu" onClick={() => go({ label: item.label, ...item.drill })}>
      <div className="summary-top">{item.label} (₫)</div><div className="summary-value">{item.amount === null ? "—" : fmt(item.amount)}</div><div className="summary-sub">{item.hint}</div>
    </button>)}</div>
    <div className="parking-chart-layout revenue-chart-layout">
      <CardChart index={0} description={`Doanh thu ${money(total.revenue)} · đã thu ${percentage(total.paid, total.revenue)}`}
        note={`Thu thừa ${money(total.excess)} được theo dõi riêng.`} detail={() => open(0)}>
        <Bars vertical bars={waterfall.map(([key, base, color]) => ({
          label: amountLabels[key], base, parts: [part("", total[key], color)], display: key === "reduction" ? -total[key] : total[key],
          action: () => go({ label: amountLabels[key], amount: key, source: "included" }),
        }))} />
      </CardChart>
      <CardChart index={1} description={`${fmt(total.count)} lượt tính doanh thu`} detail={() => open(1)}>
        <Bars bars={sourceLines(false).filter((row) => row.source && row.source !== "FREE" && row.source !== "SUB").map((row) => {
          const amounts = totals(row.rows)
          const action = (amount: AmountKey) => () => go({ label: `${row.name} · ${amountLabels[amount]}`, source: row.source, amount })
          return { label: row.name, action: action("revenue"), display: amounts.revenue,
            missing: row.source === "APP" && filter.end < "2027-03-01" && !row.rows.length ? "Chưa có dữ liệu · dự kiến 03/2027" : undefined,
            parts: [part("Đã thu", amounts.paid, blue, action("paid")), part("Công nợ", amounts.debt, orange, action("debt")), part("Thất thu", amounts.lost, red, action("lost"))] }
        })} />
      </CardChart>
      <CardChart index={2} description={`${dateSpan(filter.start, filter.end)} · tất cả loại xe`}
        note="Đường thể hiện tổng tiền thu và voucher; cột tách từng phương thức. Chọn điểm hoặc phần cột để tra cứu, xem chi tiết để đối chiếu từng ca." detail={() => open(2)}>
        <Bars vertical trend bars={days.map((value) => {
          const amounts = totals(day(value))
          const action = (amount: string) => () => go({ label: `${date(value)} · ${amount}`, day: value, vehicle: "*", source: "included", amount })
          return { label: date(value).slice(0, 5), action: action("receivedOrVoucher"),
            parts: [...methods.map((method, i) => part(method, amounts.moneyByMethod[i], paymentColors[i], action(`${method} (₫)`))), part("Voucher", amounts.debt, violet, action("debt"))] }
        })} />
      </CardChart>
      <CardChart index={3} description={`${fmt(discountedCount)} lượt · ${discountGroups.length} nhóm chính sách / nguồn voucher`} detail={() => open(3)}
        note={<>Các mã cùng nguồn voucher được gộp; xem chi tiết để đối chiếu đủ từng mã.
          {reviews > 0 && <> <TextLink onClick={() => go({ label: "VinFast cần kiểm tra", policy: "CS-01", review: "1", amount: "reduction" })}>{reviews} lượt VinFast cần kiểm tra</TextLink></>}</>}>
        <RevenueDonut label="Miễn / giảm" action={() => go({ label: "Miễn / giảm", policy: "*", amount: "reduction" })}
          items={visibleDiscounts.map((row, index) => ({ id: row.key, label: row.label, value: row.value,
            color: row.key === "other" ? "#9ba8b9" : paymentColors[index % paymentColors.length],
            detail: row.key === "other" ? `${row.codes.length} mã chính sách / voucher` : `${fmt(row.count)} lượt${row.codes.length > 1 ? ` · ${row.codes.length} mã` : ""}`,
            action: () => go({ label: row.label, policy: row.codes.join("|"), amount: "reduction" }) }))} />
      </CardChart>
      <CardChart index={4} description={`${money(total.lost)} · ${percentage(total.lost, total.revenue)} doanh thu`} detail={() => open(4)}>
        <RevenueLossRanking items={lossReasons.map((reason) => ({ label: reason, value: totals(selected.filter((row) => row.reason === reason)).lost, color: red,
          action: () => go({ label: reason, reason, amount: "lost" }) })).sort((a, b) => b.value - a.value)} />
      </CardChart>
      <CardChart index={5} description={`Phát sinh ${money(total.debt)} · còn nợ ${money(owed)}`} detail={() => open(5)}>
        <Bars bars={[...groupRows(debt, (row) => row.type)].map(([label, rows]) => {
          const sum = (key: "paid" | "remaining" | "overdue") => rows.reduce((n, row) => n + row[key], 0)
          const action = (amount: string) => () => go({ label, unitType: label, amount })
          return { label, action: action("debt"), parts: [part("Đã trả", sum("paid"), blue, action("debtPaid")),
            part("Trong hạn", sum("remaining") - sum("overdue"), orange, action("inTerm")), part("Quá hạn", sum("overdue"), red, action("overdue"))] }
        })} />
        <div className="revenue-top-debt">{debt.filter((row) => row.remaining > 0).slice(0, 3).map((row) => <div key={row.id}>
          <TextLink onClick={() => go({ label: row.name, unit: row.id, amount: "debtRemaining" })}>{row.name}</TextLink><TextLink onClick={() => go({ label: row.name, unit: row.id, amount: "debtRemaining" })}>{money(row.remaining)}</TextLink>
        </div>)}</div>
      </CardChart>
      <CardChart index={6} description={`Tháng ${reportMonth.split("-").reverse().join("/")} · ${subs.length ? fmt(subs.length) + " hợp đồng" : "Chưa có dữ liệu SAP"}`}
        note={`Tổng doanh thu bãi xe ${money(monthlyOperating(reportMonth) + Number(subTotal["Doanh thu (₫)"]))}${subs.length ? "" : " · chưa gồm thuê bao"}`} detail={() => open(6)}>
        <Bars bars={subs.length ? subGroups(subs).map(({ group, items }) => {
          const data = subscriptionRow(group, items)
          const action = (amount?: string) => () => go({ label: group, group, month: reportMonth, amount })
          return { label: group, action: action(), parts: [part("Đã thu", Number(data["Đã thu (₫)"]), blue, action("subPaid")),
            part("Chưa thu", Number(data["Chưa thu (₫)"]), orange, action("subUnpaid"))] }
        }) : []} />
      </CardChart>
    </div>
    {popup !== null && <Overlay wide title={`${names[popup]} · Số liệu chi tiết`} subtitle={`${dateSpan(filter.start, filter.end)} · ${filter.estate ? revenueSelectionLabel(filter.estate, estateName) : "Tất cả khu đô thị"}${filter.vehicle && popup !== 2 ? " · " + filter.vehicle.split("|").join(", ") : ""}`}
      onClose={() => setPopup(null)} footer={<><ExportButton onClick={() => exportFile("SoLieuDoanhThu", () => ({ "Số liệu": exportRows() }))} />
        <Button onClick={() => setPopup(null)}>Đóng</Button></>}>{table}</Overlay>}
  </>
}
