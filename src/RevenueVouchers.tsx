import { useMemo, useState } from "react"
import { Download, Pencil, Plus } from "lucide-react"
import { Badge, Button, Heading, Overlay, Select } from "./ui"
import { fmt, normalize } from "./data"
import { allowedSites, dayAt, displayTime, siteById } from "./parking-model"
import { allOption, ParkingSearch, TextLink } from "./parking-ui"
import type { ExportRow } from "./parking-ui"
import { auditRevenue, estateName, revenueDay, revenueVoucherWorkspace, revenueWrite, revenueAccess } from "./revenue-model"
import { money } from "./revenue-tables"
import { PagedData, ReasonDialog } from "./RevenueOperations"
import type { RevenueOperationProps } from "./RevenueOperations"
import RevenueVoucherSourceForm from "./RevenueVoucherSourceForm"
import RevenueVoucherDetail from "./RevenueVoucherDetail"
import RevenueVoucherUnitForm from "./RevenueVoucherUnits"
import { voucherPage } from "./voucher-navigation"
import { revenueMatches } from "./revenue-filter-values"
import { revenueHistoryParams } from "./revenue-entry"
import { cancelVoucherCode, canManageVoucherSource, issuedVoucherCodes, issueVoucherSource, saveVoucherUnit, setVoucherSourceActive, voucherBenefitText, voucherCodeStatus, voucherHistory, voucherPurposes, voucherScope } from "./revenue-vouchers"
import type { VoucherApplication, VoucherSource, VoucherSourceDraft, VoucherUnit, VoucherWorkspace } from "./revenue-vouchers"

const tabIds = ["sources", "units", "history", "report"]
export default function RevenueVouchers({ state, ledger, access, filter, cutoff, actor, params, update, navigate, save, notify, exportFile, onDirty }: RevenueOperationProps & { onDirty: (dirty: boolean) => void }) {
  const workspace = useMemo(() => revenueVoucherWorkspace(state), [state])
  const history = useMemo(() => voucherHistory(workspace, ledger), [workspace, ledger])
  const ledgerById = useMemo(() => new Map(ledger.map((row) => [row.id, row])), [ledger])
  const selectedTab = tabIds.includes(params.get("voucherTab") || "") ? params.get("voucherTab")! : "sources"
  const query = params.get("q") || "", purpose = params.get("voucherPurpose") || "", selectedUnit = params.get("voucherUnit") || "", status = params.get("voucherStatus") || ""
  const sites = allowedSites(access), ids = new Set(sites.map((site) => site.id))
  const editable = revenueWrite(access, "voucher")
  const units = workspace.units.filter((unit) => revenueMatches(unit.estate, filter.estate) && sites.some((site) => site.estate === unit.estate))
  const [unitDraft, setUnitDraft] = useState<VoucherUnit | null | undefined>(undefined)
  const [reason, setReason] = useState<{ type: "code"; code: string } | { type: "source"; source: VoucherSource } | null>(null)
  const selectedSource = params.get("voucherSource") || ""
  const sources = workspace.sources.filter((source) => voucherScope(source, access) && revenueMatches(source.recipient.estate, filter.estate) &&
    revenueMatches(source.unit, selectedUnit) && revenueMatches(source.purpose, purpose) &&
    revenueMatches(source.active ? "active" : "inactive", status) &&
    (source.at == null || dayAt(source.at) >= filter.start && dayAt(source.at) <= filter.end) &&
    (!query || normalize(`${source.name} ${source.reference} ${source.recipient.name}`).includes(normalize(query))))
  const matches = history.filter((row) => {
    const day = revenueDay(row.at, row.recipient.estate, state)
    return ids.has(row.site) && revenueMatches(row.recipient.estate, filter.estate) && revenueMatches(row.site, filter.site) &&
      revenueMatches(ledgerById.get(row.tripId)?.vehicle, filter.vehicle) && day >= filter.start && day <= filter.end &&
      revenueMatches(row.purpose, purpose) && revenueMatches(row.recipient.id, selectedUnit) && revenueMatches(row.sourceId, selectedSource) &&
      revenueMatches(row.status, status) && (!query || normalize(`${row.code} ${row.tripId} ${row.recipient.name}`).includes(normalize(query)))
  })
  const used = matches.filter((row) => row.status === "USED")
  const adjustmentFor = (row: VoucherApplication) => state.changes.find((change) => change.reference === row.tripId && change.reason === `Voucher ${row.code} hoàn tất sau chốt`)
  const regularUsed = used.filter((row) => !adjustmentFor(row))
  const editId = params.get("voucherEdit")
  const original = editId && editId !== "new" ? workspace.sources.find((source) => source.id === editId) : undefined
  const detail = workspace.sources.find((source) => source.id === params.get("voucherDetail") && voucherScope(source, access))
  const issuedPurpose = params.get("voucherIssued") || ""
  const issuedDetail = issuedVoucherCodes(workspace, filter, access, issuedPurpose, selectedUnit)
    .filter(({ code }) => params.get("voucherIssuedStatus") !== "canceled" || !!code.canceled)
  const closeEditor = () => update({ voucherEdit: null })
  const commit = (action: string, scope: string, detail: string, change: (latest: VoucherWorkspace) => VoucherWorkspace) => save((latest) =>
    auditRevenue({ ...latest, voucherWorkspace: change(revenueVoucherWorkspace(latest)) }, actor, action, scope, detail))
  const saveSource = (draft: VoucherSourceDraft) => {
    if (!commit(original ? "Sửa nguồn voucher" : "Phát hành voucher", workspace.units.find((unit) => unit.id === draft.unit)?.estate || "", draft.reference,
      (latest) => issueVoucherSource(latest, draft, access, actor, original))) return false
    onDirty(false); closeEditor(); notify(original ? "Đã lưu nguồn phát hành." : `Đã phát hành ${draft.quantity} mã voucher.`)
    return true
  }
  if (editId) {
    if (!editable || editId !== "new" && (!original || !canManageVoucherSource(original, access))) return <div className="panel parking-empty">Bạn không có quyền chỉnh sửa nguồn này.<Button onClick={closeEditor}>Quay lại</Button></div>
    return <RevenueVoucherSourceForm key={editId} original={original} workspace={workspace} access={access} estate={filter.estate} onDirty={onDirty} close={closeEditor} save={saveSource} />
  }
  const sourceData = (source: VoucherSource): ExportRow => ({
    "Nguồn phát hành": source.name, "Mã tham chiếu": source.reference, "Đơn vị nhận": source.recipient.name,
    "Loại nghiệp vụ": voucherPurposes[source.purpose], "Quyền lợi": voucherBenefitText(source), "Bên chịu phí": source.purpose === "VCR_DISCOUNT" ? "VCR" : source.recipient.name,
    "Số mã chưa hủy": workspace.codes.filter((code) => code.sourceId === source.id && !code.canceled).length,
    "Đã sử dụng": history.filter((row) => row.sourceId === source.id && row.status === "USED").length,
    "Hiệu lực đến": source.until.split("-").reverse().join("/"), "Trạng thái": source.active ? "Hoạt động" : "Không hoạt động", "Thao tác": "",
  })
  const unitRows = units.filter((unit) => (!query || normalize(`${unit.id} ${unit.name} ${unit.contract}`).includes(normalize(query))))
  const unitData = (unit: VoucherUnit): ExportRow => ({ "Đơn vị nhận voucher": unit.name, "Mã đơn vị": unit.id, "Loại đơn vị": unit.type, "Khu đô thị": estateName(unit.estate), "Hợp đồng / vị trí": unit.contract,
    "Nguồn đang hoạt động": workspace.sources.filter((source) => source.unit === unit.id && source.active).length, "Trạng thái": unit.active ? "Hoạt động" : "Không hoạt động", "Thao tác": "" })
  const historyData = (row: VoucherApplication): ExportRow => ({ "Mã voucher": row.code, "Nguồn phát hành": row.sourceName,
    "Đơn vị nhận": row.recipient.name, "Loại nghiệp vụ": voucherPurposes[row.purpose], "Mã lượt": row.tripId,
    "Bãi xe": siteById(row.site)?.label, "Thời điểm áp dụng": displayTime(row.at), "Ngày doanh thu": revenueDay(row.at, row.recipient.estate, state).split("-").reverse().join("/"),
    "Trạng thái sử dụng": row.status === "USED" ? "Đã sử dụng" : row.status === "APPLIED" ? "Đang áp dụng" : "Bị loại khi chốt",
    "Ghi nhận doanh thu": adjustmentFor(row) ? "Điều chỉnh sau chốt" : row.status === "USED" ? "Trong số liệu kỳ" : "Chưa ghi nhận",
    "Khấu trừ thực tế (₫)": row.status === "USED" ? row.amount : null,
    "Công nợ phát sinh (₫)": row.status === "USED" && !adjustmentFor(row) && row.purpose !== "VCR_DISCOUNT" ? row.amount : 0,
    "Miễn / giảm VCR (₫)": row.status === "USED" && !adjustmentFor(row) && row.purpose === "VCR_DISCOUNT" ? row.amount : 0,
    "Khấu trừ ghi điều chỉnh (₫)": adjustmentFor(row) ? row.amount : 0,
  })
  const reportRows = Object.entries(voucherPurposes).map(([purpose, label]) => {
    const uses = used.filter((row) => row.purpose === purpose)
    const issued = issuedVoucherCodes(workspace, filter, access, purpose, selectedUnit)
    return { purpose, label, count: uses.length, issued: issued.length, canceled: issued.filter(({ code }) => code.canceled).length, debt: uses.reduce((n, row) => n + (!adjustmentFor(row) && row.purpose !== "VCR_DISCOUNT" ? row.amount : 0), 0), reduction: uses.reduce((n, row) => n + (!adjustmentFor(row) && row.purpose === "VCR_DISCOUNT" ? row.amount : 0), 0), adjustment: uses.reduce((n, row) => n + (adjustmentFor(row) ? row.amount : 0), 0) }
  }).filter((row) => revenueMatches(row.purpose, purpose))
  const reportData = (row: typeof reportRows[number]): ExportRow => ({ "Loại nghiệp vụ": row.label, "Mã phát hành trong kỳ": row.issued, "Trong đó mã đã hủy": row.canceled, "Lượt sử dụng hoàn tất": row.count, "Công nợ phát sinh (₫)": row.debt, "Miễn / giảm VCR (₫)": row.reduction, "Khấu trừ ghi điều chỉnh (₫)": row.adjustment })
  const completedPeriod: Record<string, string | null> = filter.end > cutoff ? { end: cutoff, start: filter.start > cutoff ? cutoff : filter.start } : {}
  const goHistory = (source?: string, purpose?: string, completed = false) => update({ ...completedPeriod, voucherTab: "history", voucherSource: source || null, voucherPurpose: purpose || null, voucherStatus: completed ? "USED" : null, q: null, page: null })
  const goLookup = (row: VoucherApplication) => {
    const day = revenueDay(row.at, row.recipient.estate, state)
    if (adjustmentFor(row)) {
      navigate({ estate: row.recipient.estate, site: row.site, start: day, end: day, ...revenueHistoryParams({ estate: row.recipient.estate, site: row.site, vehicle: "", start: day, end: day }, row.tripId, "origin"), origin: window.location.search }, "revenue-lookup", false)
      return
    }
    navigate({ estate: row.recipient.estate, site: row.site, start: day, end: day, q: row.tripId,
      ...(row.purpose === "VCR_DISCOUNT" ? { policy: row.code, amount: "reduction" } : { ...(ledgerById.get(row.tripId)?.voucher?.unit ? { unit: row.recipient.id } : {}), amount: "debt" }), origin: window.location.search }, "revenue-lookup", false)
  }
  const exportCurrent = () => exportFile(selectedTab === "history" ? "LichSuVoucher" : selectedTab === "units" ? "DonViNhanVoucher" : selectedTab === "report" ? "BaoCaoVoucher" : "NguonPhatHanhVoucher", () => ({
    [voucherPage(params).title]: selectedTab === "history" ? matches.map(historyData) : selectedTab === "units" ? unitRows.map(unitData) : selectedTab === "report" ? reportRows.map(reportData) : sources.map(sourceData),
  }))
  return <>
    <div className="panel voucher-hub">
      <div className="parking-toolbar">
        <span className="muted">Theo điều kiện đang áp dụng</span>
        <div className="parking-inline"><Button onClick={exportCurrent}><Download size={15} />Xuất dữ liệu</Button>
          {editable && <Button variant="primary" onClick={() => selectedTab === "units" ? setUnitDraft(null) : update({ voucherTab: "sources", voucherEdit: "new", voucherDetail: null })}><Plus size={15} />{selectedTab === "units" ? "Thêm đơn vị" : "Tạo voucher"}</Button>}
        </div>
      </div>
      {selectedSource && <div className="parking-chips parking-list-chips"><Button variant="ghost" onClick={() => update({ voucherSource: null, page: null })}>Nguồn: {workspace.sources.find((source) => source.id === selectedSource)?.name || selectedSource} ×</Button></div>}
      {selectedTab === "sources" && <>
        <p className="voucher-help">Phát hành mã chưa tạo doanh thu hoặc công nợ. Vé âm và voucher thu lại tiền ghi công nợ khi sử dụng; mã giảm giá VCR ghi vào miễn / giảm.</p>
        <PagedData rows={sources} id={(row) => row.id} params={params} update={update} data={sourceData} empty="Chưa có nguồn phát hành phù hợp. Chọn Tạo voucher hoặc thêm đơn vị nhận."
          link={(source, column) => column === "Nguồn phát hành" ? <TextLink onClick={() => update({ voucherDetail: source.id })}>{source.name}</TextLink>
            : column === "Trạng thái" ? <Badge tone={source.active ? "green" : "neutral"}>{source.active ? "Hoạt động" : "Không hoạt động"}</Badge>
              : column === "Thao tác" ? <div className="parking-inline"><Button onClick={() => goHistory(source.id)}>Lịch sử sử dụng</Button>
                {editable && canManageVoucherSource(source, access) && <><Button aria-label={`Sửa ${source.reference}`} onClick={() => update({ voucherEdit: source.id })}><Pencil size={14} /></Button>
                  <Button onClick={() => { if (source.active) setReason({ type: "source", source }); else if (commit("Bật nguồn voucher", source.recipient.estate, source.reference, (latest) => setVoucherSourceActive(latest, source.id, true, "", actor, access))) notify("Đã bật nguồn. Các mã đã hủy được giữ nguyên.") }}>{source.active ? "Ngừng hoạt động" : "Hoạt động lại"}</Button></>}
              </div> : undefined} />
      </>}
      {selectedTab === "units" && <><p className="voucher-help">Dùng chung danh mục cho phát hành, đối soát và thanh toán công nợ. Bên chịu phí được xác định trên từng nguồn phát hành.</p>
        <PagedData rows={unitRows} id={(unit) => unit.id} data={unitData} params={params} update={update} link={(unit, column) => column === "Thao tác" ? <div className="parking-inline">
          {editable && <Button onClick={() => setUnitDraft(unit)}><Pencil size={14} />Sửa</Button>}
          {revenueAccess(access, "revenue-debt") && <Button onClick={() => navigate({ estate: unit.estate, unit: unit.id }, "revenue-debt", false)}>Xem công nợ</Button>}
        </div> : undefined} /></>}
      {selectedTab === "history" && <><p className="voucher-help">Mỗi dòng là một lần áp dụng. Chỉ “Đã sử dụng” được đối chiếu vào doanh thu; “Đang áp dụng” và “Bị loại khi chốt” chưa tạo công nợ.</p>
        <div className="parking-banner revenue-list-total">{fmt(used.length)} lượt hoàn tất · {money(regularUsed.filter((row) => row.purpose !== "VCR_DISCOUNT").reduce((n, row) => n + row.amount, 0))} công nợ phát sinh · {money(regularUsed.filter((row) => row.purpose === "VCR_DISCOUNT").reduce((n, row) => n + row.amount, 0))} miễn / giảm VCR{used.length > regularUsed.length && ` · ${used.length - regularUsed.length} lượt ghi điều chỉnh sau chốt riêng`}</div>
        <PagedData rows={matches} id={(row) => row.id} data={historyData} params={params} update={update}
          link={(row, column, value) => ["Mã lượt", "Công nợ phát sinh (₫)", "Miễn / giảm VCR (₫)", "Khấu trừ ghi điều chỉnh (₫)"].includes(column) && row.status === "USED" && value && revenueAccess(access, "revenue-lookup")
            ? <TextLink onClick={() => goLookup(row)}>{typeof value === "number" ? fmt(value) : String(value)}</TextLink> : undefined} />
      </>}
      {selectedTab === "report" && <>
        <div className="voucher-report-intro"><Heading>Phát hành và sử dụng voucher</Heading><p>Số mã phát hành tính theo ngày cấp, gồm cả mã đã hủy; lượt sử dụng và số tiền tính theo ngày doanh thu. Công nợ còn phải thu và các lần trả tiền theo dõi tại Công nợ voucher.</p></div>
        <PagedData rows={reportRows} id={(row) => row.purpose} params={params} update={update} data={reportData}
          link={(row, column, value) => typeof value === "number" && value > 0 ? ["Mã phát hành trong kỳ", "Trong đó mã đã hủy"].includes(column)
            ? <TextLink onClick={() => update({ voucherIssued: row.purpose, voucherIssuedStatus: column === "Trong đó mã đã hủy" ? "canceled" : null, page: null })}>{fmt(value)}</TextLink>
            : ["Lượt sử dụng hoàn tất", "Công nợ phát sinh (₫)", "Miễn / giảm VCR (₫)", "Khấu trừ ghi điều chỉnh (₫)"].includes(column) ? <TextLink onClick={() => goHistory(undefined, row.purpose, true)}>{fmt(value)}</TextLink> : undefined : undefined} />
      </>}
    </div>
    {selectedTab === "report" && Object.prototype.hasOwnProperty.call(voucherPurposes, issuedPurpose) && <Overlay wide title="Mã phát hành trong kỳ" subtitle={voucherPurposes[issuedPurpose as keyof typeof voucherPurposes]} onClose={() => update({ voucherIssued: null, voucherIssuedStatus: null, page: null })} footer={<Button onClick={() => update({ voucherIssued: null, voucherIssuedStatus: null, page: null })}>Đóng</Button>}>
      <p className="parking-chart-note">{issuedDetail.length} mã theo ngày cấp và phạm vi đang chọn. Mã đã hủy được giữ trong lịch sử phát hành.</p>
      <PagedData rows={issuedDetail} id={({ code }) => code.code} params={params} update={update} data={({ code, source }) => ({
        "Mã voucher": code.code, "Nguồn phát hành": source.name, "Đơn vị nhận": source.recipient.name,
        "Ngày phát hành": displayTime(code.at!), "Trạng thái": voucherCodeStatus(code, source, history), "Lý do hủy": code.canceled?.reason,
      })} link={({ source }, column) => column === "Nguồn phát hành" ? <TextLink onClick={() => update({ voucherIssued: null, voucherIssuedStatus: null, voucherDetail: source.id, page: null })}>{source.name}</TextLink> : undefined} />
    </Overlay>}
    {detail && <RevenueVoucherDetail source={detail} workspace={workspace} history={history} close={() => update({ voucherDetail: null })} editable={editable && canManageVoucherSource(detail, access)} cancel={(code) => setReason({ type: "code", code })} exportFile={exportFile} />}
    {reason && <ReasonDialog title={reason.type === "code" ? "Hủy mã voucher chưa sử dụng" : "Ngừng nguồn phát hành"} description={reason.type === "code" ? reason.code : "Các mã chưa có lượt áp dụng sẽ bị hủy; lịch sử đã sử dụng và công nợ được giữ nguyên."} action="Xác nhận" close={() => setReason(null)} submit={(text) => {
      const success = reason.type === "code" ? commit("Hủy mã voucher", filter.estate, `${reason.code} · ${text}`, (latest) => cancelVoucherCode(latest, reason.code, text, actor, access))
        : commit("Ngừng nguồn voucher", reason.source.recipient.estate, `${reason.source.reference} · ${text}`, (latest) => setVoucherSourceActive(latest, reason.source.id, false, text, actor, access))
      if (success) { setReason(null); notify("Đã cập nhật voucher; số liệu đã ghi nhận được giữ nguyên.") }
    }} />}
    {unitDraft !== undefined && <RevenueVoucherUnitForm original={unitDraft ?? undefined} estate={filter.estate} access={access} onDirty={onDirty} close={() => setUnitDraft(undefined)} save={(unit) => {
      if (!unitDraft && workspace.units.some((row) => row.id === unit.id)) { notify("Mã đơn vị đã tồn tại."); return false }
      const success = commit(unitDraft ? "Sửa đơn vị nhận voucher" : "Thêm đơn vị nhận voucher", unit.estate, unit.id, (latest) => {
        if (!unitDraft && latest.units.some((row) => row.id === unit.id)) throw new Error("Mã đơn vị đã tồn tại.")
        if (unitDraft && JSON.stringify(latest.units.find((row) => row.id === unit.id)) !== JSON.stringify(unitDraft)) throw new Error("Đơn vị vừa được cập nhật. Vui lòng mở lại trước khi sửa.")
        return saveVoucherUnit(latest, unit, access)
      })
      if (success) notify("Đã lưu đơn vị nhận voucher.")
      return success
    }} />}
  </>
}
