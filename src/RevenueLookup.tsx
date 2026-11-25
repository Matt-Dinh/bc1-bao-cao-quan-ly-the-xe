import { useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { ArrowLeft, SlidersHorizontal } from "lucide-react"
import { Button, Heading } from "./ui"
import ColumnSettingsDrawer, { readColumnSelection } from "./ColumnSettingsDrawer"
import { fmt } from "./data"
import { allowedSites, displayTime, siteById } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import { ExportButton, NoMatches, ParkingPagination, TextLink, pageNumber, pageSize } from "./parking-ui"
import type { ExportParking, UpdateParams } from "./parking-ui"
import { amountKeys, amountLabels, revenueAccess, revenueUnits, estateName, methods, sources, timestampCell, totals } from "./revenue-model"
import type { AmountKey, LedgerRow, RevenueFilter, RevenueState } from "./revenue-model"
import { changeRow, formatCell, ledgerRow, money } from "./revenue-tables"
import { DataTable } from "./RevenueDashboard"
import { selectRevenueLookup, revenueLookupReset } from "./revenue-lookup"
import type { RevenueEntryKind } from "./revenue-entry"

const columns = ["Mã lượt / khoản thu", "Giờ ra / lập", "Bãi xe", "Làn ra", "Loại xe", "Biển số", "Nguồn thu", "Doanh thu (₫)", "Đã thu (₫)", "Còn phải thu (₫)", "Loại / lý do"]
const moreColumns = ["Khu đô thị", "Số lượt", "Ngày doanh thu", "Ca", "Giờ vào", "Nhóm khách", "Mã thẻ / vé", "Nguồn ghi nhận", "Giá niêm yết (₫)",
  "Miễn / giảm (₫)", "Chưa VAT (₫)", "VAT (₫)", ...methods.map((method) => `${method} (₫)`), "Tiền thực nhận (₫)", "Công nợ (₫)", "Thất thu (₫)", "Thu thừa (₫)", "Mã voucher", "Mã giao dịch", "Trạng thái chốt", "Cờ"]
interface Props {
  ledger: LedgerRow[]; state: RevenueState; access: ParkingAccess; filter: RevenueFilter; cutoff: string;
  params: URLSearchParams; update: UpdateParams; exportFile: ExportParking; openParking: (trip: string, day: string) => void
  openSource?: (kind: RevenueEntryKind, reference: string) => void
  headerActions?: (actions: ReactNode) => ReactNode
}
export default function RevenueLookup({ ledger, state, access, filter, cutoff, params, update, exportFile, openParking, openSource, headerActions }: Props) {
  const key = `vparking:revenue:columns:${access.role}/${access.estate}`
  const [shown, setShown] = useState<string[]>(() => {
    const saved = readColumnSelection(key)
    const selected = (saved ?? columns).filter((label) => [...columns, ...moreColumns].includes(label))
    if (!selected.includes(columns[0])) selected.unshift(columns[0])
    return selected
  })
  const [columnsOpen, setColumnsOpen] = useState(false)
  const scrollBeforeDetail = useRef(0)
  const sites = allowedSites(access)
  const { scope, measure, list, subscriptions, valueFor, subscriptionValue } = useMemo(
    () => selectRevenueLookup(ledger, state, filter, access, cutoff, params), [ledger, state, filter, access, cutoff, params])
  const id = params.get("detail")
  const detail = id ? ledger.find((row) => row.id === id && sites.some((site) => site.id === row.site)) : undefined
  const sum = totals(list, true)
  const matchCount = subscriptions?.length ?? list.length
  const size = pageSize(params.get("size")), page = pageNumber(params.get("page"), matchCount, size)
  const slice = <T,>(rows: T[]) => rows.slice((page - 1) * size, page * size)
  const clear = () => update({ ...scope, ...revenueLookupReset, q: null, drill: null, page: null })
  const titleMeasure = amountLabels[measure as AmountKey] ?? ({ receivable: "Còn phải thu", debtPaid: "Đã trả", debtRemaining: "Còn nợ", overdue: "Quá hạn", inTerm: "Trong hạn", subPaid: "Đã thu", subUnpaid: "Chưa thu", receivedOrVoucher: "Tiền thực nhận và voucher" }[measure]) ?? measure
  const drillColumn = titleMeasure ? `${titleMeasure.replace(" (₫)", "")} đối chiếu (₫)` : ""
  const exportDetails = (row: LedgerRow) => ({ ...ledgerRow(row, state), ...(measure ? { [drillColumn]: valueFor(row) } : {}) })
  const subscriptionData = (row: NonNullable<typeof subscriptions>[number]) => ({
    "Số hợp đồng": row.id, "Khách thuê bao": row.customer, "Khu đô thị": estateName(row.estate), "Nhóm": row.group, "Tháng": row.month,
    "Doanh thu (₫)": row.gross, "Đã thu (₫)": row.paid ? row.gross : 0, "Chưa thu (₫)": row.paid ? 0 : row.gross,
  })
  const exportList = () => exportFile("TraCuuDoanhThu", () => ({
    [subscriptions ? "Thuê bao" : "Chi tiết"]:
      subscriptions ? subscriptions.map((row) => ({ ...subscriptionData(row), ...(measure ? { [drillColumn]: subscriptionValue(row) } : {}) })) : list.map(exportDetails),
  }), matchCount)
  const openDetail = (id: string) => {
    scrollBeforeDetail.current = window.scrollY
    update({ detail: id })
    window.scrollTo(0, 0)
  }
  const back = () => {
    update({ detail: null })
    window.requestAnimationFrame(() => window.scrollTo(0, scrollBeforeDetail.current))
  }
  if (id && !detail) return <div className="panel parking-empty">Không tìm thấy khoản thu trong phạm vi quyền.<Button onClick={back}>Quay lại</Button></div>
  if (detail) return <>
    <div className="page-heading"><div><Heading level={1}>Chi tiết doanh thu · {detail.id}</Heading><p className="muted">{sources[detail.source]} · {siteById(detail.site)?.label}</p></div>
      <div className="parking-actions"><Button onClick={back}><ArrowLeft size={15} /> Quay lại</Button>
        {detail.trip && !detail.id.startsWith("DEMO-") && <Button onClick={() => openParking(detail.trip!.id, detail.revenueDay)}>Mở ở Tra cứu lượt xe</Button>}
        {openSource && revenueAccess(access, "revenue-receipt") && detail.source === "CT" && <Button onClick={() => openSource("receipt", detail.id)}>Xem phiếu thu gốc</Button>}
        <ExportButton onClick={() => exportFile("ChiTietDoanhThu", () => ({ "Chi tiết": [ledgerRow(detail, state)] }), 1)} /></div></div>
    <section className="panel parking-detail-panel"><Heading>Các lớp tiền</Heading><dl className="parking-detail-grid">
      {amountKeys.map((key) => <div key={key}><dt>{amountLabels[key]}</dt><dd>{money(detail[key])}</dd></div>)}
    </dl></section>
    <section className="panel parking-detail-panel"><Heading>Thông tin {detail.trip ? "lượt xe" : "khoản thu"}</Heading><dl className="parking-detail-grid">
      {Object.entries(ledgerRow(detail, state)).filter(([key]) => !key.endsWith("(₫)")).map(([key, value]) =>
        <div key={key}><dt>{key}</dt><dd>{formatCell(value)}</dd></div>)}
      {detail.description && <div><dt>Diễn giải</dt><dd>{detail.description}</dd></div>}
    </dl></section>
    <section className="panel parking-detail-panel"><Heading>Chính sách miễn / giảm</Heading>
      <DataTable rows={detail.discounts} rowKey={(row, index) => `${row.code}/${index}`} data={(row) => ({
        "Chính sách": state.policies.find((policy) => policy.code === row.code)?.name ?? row.code,
        "Giá trị (₫)": row.amount, "Cần kiểm tra": row.review ? "Có" : "—",
      })} />
    </section>
    <section className="panel parking-detail-panel"><Heading>Giao dịch thu tiền và voucher</Heading>
      <DataTable rows={[...detail.payments.map((row) => ({ id: row.id, at: row.at, method: row.method, amount: row.amount, status: row.status, original: row.original })),
        ...(detail.voucher ? [{ id: detail.voucher.code, at: detail.at, method: "Voucher", amount: detail.debt,
          status: detail.voucher?.recipient?.name ?? revenueUnits(state).find((row) => row.id === detail.voucher?.unit)?.name ?? "Công nợ", original: undefined }] : [])]}
        rowKey={(row) => row.id} data={(row) => ({ "Mã giao dịch": row.id, "Thời điểm": timestampCell(row.at), "Phương thức": row.method,
          "Số tiền (₫)": row.amount, "Trạng thái / đơn vị": row.status, "Giao dịch gốc": row.original })} />
    </section>
    <section className="panel parking-detail-panel"><Heading>Lịch sử tính số liệu và chốt</Heading>
      <p>{state.closes[detail.shiftId] ? `Đã chốt · ${state.closes[detail.shiftId].actor} · ${displayTime(state.closes[detail.shiftId].at)}` : "Tạm tính"}</p>
      <DataTable rows={state.changes.filter((row) => row.reference === detail.id)} rowKey={(row) => row.id} data={changeRow} />
    </section>
  </>
  const empty = <NoMatches clear={clear} />
  return <>
    {headerActions ? headerActions(<ExportButton onClick={exportList} />) : <div className="op-heading-actions"><ExportButton onClick={exportList} /></div>}
    <div className="panel">
    <div className="op-table-toolbar lookup-table-toolbar">
      <div className="lookup-result-summary"><span className="count-text" aria-live="polite"><strong>{fmt(matchCount)}</strong> {subscriptions ? "thuê bao" : "khoản thu"}</span></div>
      {!subscriptions && <Button onClick={() => setColumnsOpen(true)}><SlidersHorizontal size={15} />Tùy chỉnh cột</Button>}
    </div>
    {subscriptions ? <>
      <div className="parking-banner revenue-list-total">{measure ? `Tổng ${titleMeasure} đối chiếu` : "Tổng doanh thu thuê bao"} · {fmt(subscriptions.length)} thuê bao · {money(subscriptions.reduce((sum, row) => sum + subscriptionValue(row), 0))}</div>
      <DataTable rows={slice(subscriptions)} rowKey={(row) => row.id} data={(row) => ({ ...subscriptionData(row), ...(measure ? { [drillColumn]: subscriptionValue(row) } : {}) })} empty={empty} />
    </> : <>
      <div className="parking-banner revenue-list-total">
        <strong>{measure ? `Tổng ${titleMeasure} đối chiếu` : "Tổng danh sách"}</strong>
        {measure ? money(list.reduce((total, row) => total + valueFor(row), 0)) : `${money(sum.revenue)} doanh thu · ${money(sum.paid)} đã thu · ${money(sum.debt + sum.lost)} còn phải thu`}
      </div>
      <DataTable rows={slice(list)} rowKey={(row) => row.id} data={exportDetails} empty={empty} columns={[...shown, ...(measure ? [drillColumn] : [])]}
        link={(row, key) => key === columns[0] ? <TextLink onClick={() => openDetail(row.id)}>{row.id}</TextLink> : undefined} />
    </>}
    <ParkingPagination count={matchCount} page={page} size={size} change={(value) => update({ page: String(value) })}
      changeSize={(value) => update({ size: String(value), page: null })} />
    {columnsOpen && <ColumnSettingsDrawer columns={Object.fromEntries([...columns, ...moreColumns].map((label) => [label, label]))}
      selected={shown} defaults={columns} required={columns[0]} onClose={() => setColumnsOpen(false)} onSave={(selection) => {
        setShown(selection); setColumnsOpen(false)
        try { localStorage.setItem(key, JSON.stringify(selection)) } catch {}
      }} />}
  </div>
  </>
}
