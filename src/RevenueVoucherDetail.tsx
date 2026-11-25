import { useState } from "react"
import { Download } from "lucide-react"
import { Badge, Button, Overlay } from "./ui"
import { date } from "./data"
import { displayTime, siteById } from "./parking-model"
import { ParkingPagination, ParkingSearch, TextLink } from "./parking-ui"
import type { ExportParking } from "./parking-ui"
import { DataTable } from "./RevenueDashboard"
import { voucherBenefitText, voucherCodeStatus, voucherOrigins, voucherPurposes } from "./revenue-vouchers"
import type { VoucherApplication, VoucherSource, VoucherWorkspace } from "./revenue-vouchers"

export default function RevenueVoucherDetail({ source, workspace, history, close, cancel, exportFile, editable }: {
  source: VoucherSource; workspace: VoucherWorkspace; history: VoucherApplication[]; close: () => void
  cancel: (code: string) => void; exportFile: ExportParking; editable: boolean
}) {
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const rows = workspace.codes.filter((code) => code.sourceId === source.id && code.code.toLowerCase().includes(query.trim().toLowerCase()))
  const data = (code: typeof rows[number]) => ({
    "Mã voucher": code.code, "Ngày phát hành": code.at == null ? "Chưa có dữ liệu" : displayTime(code.at),
    "Trạng thái": voucherCodeStatus(code, source, history), "Số lần đã dùng": history.filter((row) => row.code === code.code && row.status === "USED").length,
    "Lý do hủy": code.canceled?.reason, "Người hủy": code.canceled?.actor, "Thao tác": "",
  })
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / size)))
  return <Overlay wide title={source.name} subtitle={`${source.reference} · ${voucherOrigins[source.origin]}`} onClose={close} footer={<>
    <Button onClick={() => exportFile("MaVoucher", () => ({ "Mã phát hành": rows.map(data) }), rows.length)}><Download size={15} />Xuất danh sách mã</Button><Button onClick={close}>Đóng</Button>
  </>}><dl className="parking-detail-grid">
    <div><dt>Đơn vị nhận</dt><dd>{source.recipient.name}</dd></div><div><dt>Loại nghiệp vụ</dt><dd>{voucherPurposes[source.purpose]}</dd></div>
    <div><dt>Quyền lợi</dt><dd>{voucherBenefitText(source)}</dd></div><div><dt>Bên chịu chi phí</dt><dd>{source.purpose === "VCR_DISCOUNT" ? "VCR" : source.recipient.name}</dd></div>
    <div><dt>Hiệu lực</dt><dd>{date(source.from)} – {date(source.until)}</dd></div><div><dt>Bãi áp dụng</dt><dd>{source.sites.map((id) => siteById(id)?.label).join(", ")}</dd></div>
    <div><dt>Số lần dùng mỗi mã</dt><dd>{source.benefit === "TIME_WINDOW" ? "Nhiều lần trong khung giờ" : "Một lần"}</dd></div>
    <div><dt>Người phát hành</dt><dd>{source.actor}</dd></div>
  </dl>
    <p className="parking-chart-note">Mã đã có lượt áp dụng giữ nguyên lịch sử. Hủy mã chưa dùng không làm thay đổi doanh thu đã ghi nhận.</p>
    <div className="parking-toolbar"><ParkingSearch value={query} placeholder="Tìm mã trong đợt phát hành" change={(value) => { setQuery(value); setPage(1) }} /><Badge tone={source.active ? "green" : "neutral"}>{source.active ? "Hoạt động" : "Ngừng hoạt động"}</Badge></div>
    <DataTable rows={rows.slice((current - 1) * size, current * size)} rowKey={(code) => code.code} data={data}
      link={(code, column) => column === "Thao tác" && editable && ["Chưa sử dụng", "Chưa hiệu lực"].includes(voucherCodeStatus(code, source, history))
        ? <TextLink onClick={() => cancel(code.code)}>Hủy mã</TextLink> : undefined} />
    <ParkingPagination count={rows.length} page={current} size={size} change={setPage} changeSize={(value) => { setSize(value); setPage(1) }} />
  </Overlay>
}
