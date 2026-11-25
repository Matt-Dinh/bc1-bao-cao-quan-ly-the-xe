import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Download, Pencil, Plus } from "lucide-react"
import { Badge, Button, Overlay } from "./ui"
import { normalize } from "./data"
import { allowedSites, displayTime, vnNow } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import { TextLink } from "./parking-ui"
import type { ExportParking, ExportRow, UpdateParams } from "./parking-ui"
import VoucherBillForm from "./VoucherBillForm"
import VoucherMerchantForm from "./VoucherMerchantForm"
import VoucherReport from "./VoucherReport"
import { VoucherFilters, VoucherTable } from "./VoucherUI"
import { benefitText, codeLabel, readVoucherBaseline, readVoucherScope, saveMerchant, selectVoucherHistory, selectVoucherSources, setBillActive, siteNames, sourceCodes, voucherKinds, voucherStorageKey } from "./voucher-baseline"
import type { BillVoucher, Merchant, VoucherBaseline } from "./voucher-baseline"
import "./voucher-baseline.css"

export default function VoucherManagement({ access, params, update, exportFile, actor, notify, onDirty, headerActions }: {
  access: ParkingAccess; params: URLSearchParams; update: UpdateParams; exportFile: ExportParking; actor: string
  notify: (message: string) => void; onDirty: (dirty: boolean) => void
  headerActions?: (actions: ReactNode) => ReactNode
}) {
  const [state, setState] = useState(readVoucherBaseline)
  const [cancelBill, setCancelBill] = useState<BillVoucher | null>(null), [cancelMerchant, setCancelMerchant] = useState<Merchant | null>(null)
  const page = ["sources", "units", "history", "report"].includes(params.get("voucherTab") || "") ? params.get("voucherTab")! : "sources"
  const scope = readVoucherScope(params, page), sites = allowedSites(access), siteIds = new Set(sites.map((row) => row.id))
  const editable = ["admin", "manager"].includes(access.role)
  useEffect(() => { try { if (!localStorage.getItem(voucherStorageKey)) localStorage.setItem(voucherStorageKey, JSON.stringify(state)) } catch { /* Keep the preview readable when storage is unavailable. */ } }, [])
  const commit = (change: (latest: VoucherBaseline) => VoucherBaseline) => {
    try {
      const raw = localStorage.getItem(voucherStorageKey), latest = raw ? JSON.parse(raw) as VoucherBaseline : state
      const next = change(latest.version === 1 ? latest : state)
      localStorage.setItem(voucherStorageKey, JSON.stringify(next)); setState(next); return true
    } catch (cause) { notify(cause instanceof Error ? cause.message : "Không thể lưu dữ liệu voucher"); return false }
  }
  const openBill = (id: string) => update({ voucherTab: "sources", voucherEdit: id, merchantEdit: null })
  const openMerchant = (id: string) => update({ voucherTab: "units", merchantEdit: id, voucherEdit: null })
  const closeBill = () => update({ voucherEdit: null, voucherTab: "sources" })
  const closeMerchant = () => update({ merchantEdit: null, voucherTab: "units" })
  const editId = params.get("voucherEdit"), merchantId = params.get("merchantEdit")
  if (editId) {
    const source = state.sources.find((row) => row.id === editId && row.sites.some((site) => siteIds.has(site)))
    if (editId !== "new" && !source || editId === "new" && !editable) return <div className="panel parking-empty">Không tìm thấy voucher hóa đơn hoặc bạn không có quyền truy cập.<Button onClick={closeBill}>Quay lại danh sách</Button></div>
    return <VoucherBillForm key={editId} original={source} state={state} access={access} actor={actor} commit={commit} close={closeBill} openBill={openBill} notify={notify} onDirty={onDirty} />
  }
  if (merchantId) {
    const merchant = state.merchants.find((row) => row.id === merchantId && row.sites.some((site) => siteIds.has(site)))
    if (merchantId !== "new" && !merchant || merchantId === "new" && !editable) return <div className="panel parking-empty">Không tìm thấy gian hàng hoặc bạn không có quyền truy cập.<Button onClick={closeMerchant}>Quay lại danh sách</Button></div>
    return <VoucherMerchantForm key={merchantId} original={merchant} state={state} access={access} actor={actor} commit={commit} close={closeMerchant} notify={notify} onDirty={onDirty} />
  }
  const sources = selectVoucherSources(state, scope, access).sort((a, b) => b.created - a.created)
  const merchants = state.merchants.filter((row) => row.sites.some((site) => siteIds.has(site)) && (!scope.site || row.sites.includes(scope.site)) &&
    (!scope.status || scope.status === (row.active ? "active" : "inactive")) && (!scope.query || normalize(`${row.code} ${row.name}`).includes(normalize(scope.query))))
  const history = selectVoucherHistory(state, scope, access).sort((a, b) => b.code.created - a.code.created)
  const sourceData = (row: BillVoucher): ExportRow => ({ "Bill ID": row.reference, "Tên voucher": row.name, "Gian hàng": state.merchants.find((item) => item.id === row.merchant)?.name,
    "Bãi xe": siteNames(row.sites), "Loại voucher": voucherKinds[row.kind], "Giá trị voucher": benefitText(row), "Hiệu lực từ": new Date(row.from * 60000), "Hiệu lực đến": new Date(row.until * 60000),
    "Số lượng phát hành": row.quota, "Mã hợp lệ": sourceCodes(state, row.id).filter((item) => !item.canceled).length, "Giá trị hóa đơn": row.bill, "Thời gian thanh toán": new Date(row.paid * 60000),
    "Trạng thái": row.active ? "Hoạt động" : "Không hoạt động", "Ngày / Giờ tạo": new Date(row.created * 60000), "Cập nhật cuối": new Date(row.updated * 60000), "Thao tác": "" })
  const merchantData = (row: Merchant): ExportRow => ({ "Mã gian hàng": row.code, "Tên gian hàng": row.name, "Bãi xe": siteNames(row.sites), "Trạng thái": row.active ? "Hoạt động" : "Không hoạt động",
    "Ghi chú": row.description, "Ngày tạo": new Date(row.created * 60000), "Cập nhật cuối": new Date(row.updated * 60000), "Thao tác": "" })
  const historyData = (row: typeof history[number]): ExportRow => ({ "Thời gian": new Date(row.code.created * 60000), "Mã voucher": row.code.value, "Bill ID": row.source.reference, "Tên voucher": row.source.name,
    "Biển số": row.use?.plate, "ID lượt gửi": row.use?.session, "Gian hàng": row.merchant.name, "Trạng thái": codeLabel(state, row.code, row.use), "Loại voucher": voucherKinds[row.code.benefit.kind],
    "Quyền ưu đãi": benefitText(row.code.benefit), "Hiệu lực": `${displayTime(row.code.from)} – ${displayTime(row.code.until)}`, "Thời gian áp dụng": row.use ? new Date(row.use.at * 60000) : null, "Khấu trừ": row.use?.discount })
  const actions = <>
    <Button onClick={() => exportFile(page === "units" ? "GianHang" : page === "history" ? "LichSuVoucher" : "VoucherHoaDon", () => ({ "Dữ liệu": page === "units" ? merchants.map(merchantData) : page === "history" ? history.map(historyData) : sources.map(sourceData) }))}><Download size={15} />Tải xuống</Button>
    {editable && page !== "history" && <Button variant="primary" onClick={() => page === "units" ? openMerchant("new") : openBill("new")}><Plus size={15} />{page === "units" ? "Tạo gian hàng" : "Tạo voucher"}</Button>}
  </>
  return <div className="voucher-baseline">
    {page !== "report" && (headerActions ? headerActions(actions) : <div className="op-heading-actions voucher-heading-actions">{actions}</div>)}
    <VoucherFilters state={state} page={page} access={access} params={params} update={update} />
    {page === "report" ? <VoucherReport state={state} scope={scope} access={access} params={params} update={update} exportFile={exportFile} /> : <section className="panel">
      {page === "sources" && <VoucherTable key="sources" tableKey="sources" rows={sources} data={sourceData} columns={state.sources.length ? Object.keys(sourceData(state.sources[0])) : undefined} rowKey={(row) => row.id} params={params} update={update} required="Bill ID" empty="Không tìm thấy voucher hóa đơn phù hợp"
        renderCell={(row, column) => column === "Bill ID" ? <TextLink onClick={() => openBill(row.id)}>{row.reference}</TextLink> : column === "Trạng thái" ? <div className="parking-inline"><Badge tone={row.active ? "green" : "neutral"}>{row.active ? "Hoạt động" : "Không hoạt động"}</Badge>
          {editable && <button type="button" role="switch" className="voucher-status-switch" aria-checked={row.active} aria-label={`Hoạt động: hóa đơn ${row.reference}`} onClick={() => row.active ? setCancelBill(row) : commit((latest) => setBillActive(latest, row, true, access, actor))}><span /></button>}</div>
          : column === "Thao tác" && editable ? <Button aria-label={`Sửa hóa đơn ${row.reference}`} onClick={() => openBill(row.id)}><Pencil size={14} />Sửa</Button> : undefined} />}
      {page === "units" && <VoucherTable key="units" tableKey="merchants" rows={merchants} data={merchantData} columns={state.merchants.length ? Object.keys(merchantData(state.merchants[0])) : undefined} rowKey={(row) => row.id} params={params} update={update} required="Mã gian hàng" empty="Không tìm thấy gian hàng phù hợp"
        renderCell={(row, column) => column === "Tên gian hàng" ? <TextLink onClick={() => openMerchant(row.id)}>{row.name}</TextLink> : column === "Trạng thái" ? <Badge tone={row.active ? "green" : "neutral"}>{row.active ? "Hoạt động" : "Không hoạt động"}</Badge>
          : column === "Thao tác" && editable ? <div className="parking-inline"><Button onClick={() => openMerchant(row.id)}><Pencil size={14} />Sửa</Button>{row.active && <Button onClick={() => setCancelMerchant(row)}>Ngừng hoạt động</Button>}</div> : undefined} />}
      {page === "history" && <VoucherTable key="history" tableKey="history" rows={history} data={historyData} columns={["Thời gian", "Mã voucher", "Bill ID", "Tên voucher", "Biển số", "ID lượt gửi", "Gian hàng", "Trạng thái", "Loại voucher", "Quyền ưu đãi", "Hiệu lực", "Thời gian áp dụng", "Khấu trừ"]} rowKey={(row) => row.id} params={params} update={update} required="Mã voucher" empty="Không tìm thấy lịch sử voucher phù hợp"
        renderCell={(row, column) => column === "Trạng thái" ? <Badge tone={row.code.canceled ? "red" : row.use?.status === "USED" ? "green" : "neutral"}>{codeLabel(state, row.code, row.use)}</Badge> : undefined} />}
    </section>}
    {cancelBill && <Overlay title="Hủy voucher?" onClose={() => setCancelBill(null)} footer={<><Button onClick={() => setCancelBill(null)}>Quay lại</Button><Button variant="primary" onClick={() => { if (commit((latest) => setBillActive(latest, cancelBill, false, access, actor))) { setCancelBill(null); notify("Đã hủy voucher") } }}>Xác nhận hủy</Button></>}>
      Voucher của bill {cancelBill.reference} và các mã voucher con còn hiệu lực sẽ bị hủy, không thể hoàn tác.<div className="parking-banner warning">Toàn bộ mã voucher chưa dùng của hóa đơn sẽ bị hủy ngay và không khôi phục được — bật lại hóa đơn không sinh lại các mã đã hủy.</div>
    </Overlay>}
    {cancelMerchant && <Overlay title="Ngừng hoạt động gian hàng?" onClose={() => setCancelMerchant(null)} footer={<><Button onClick={() => setCancelMerchant(null)}>Quay lại</Button><Button variant="primary" onClick={() => { if (commit((latest) => saveMerchant(latest, { ...cancelMerchant, active: false }, access, actor))) { setCancelMerchant(null); notify("Đã ngừng hoạt động gian hàng") } }}>Xác nhận</Button></>}>
      Gian hàng {cancelMerchant.name} sẽ ngừng hoạt động; các mã voucher chưa sử dụng bị hủy và không thể khôi phục.
    </Overlay>}
  </div>
}
