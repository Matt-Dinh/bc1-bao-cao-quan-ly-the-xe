import { History, Plus } from "lucide-react"
import { Button, Overlay } from "./ui"
import { fmt, normalize } from "./data"
import { ExportButton, NoMatches, ParkingTabs, TextLink } from "./parking-ui"
import { allowedSites, shiftDay, vnToday } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import { revenueAccess, revenuePeriodError, revenueWrite } from "./revenue-model"
import { closeRevenueEntry, revenueEntryKind, revenueEntryParams, revenueEntryScreen, updateRevenueEntry } from "./revenue-entry"
import type { RevenueEntryKind } from "./revenue-entry"
import { PagedData } from "./RevenueOperations"
import type { RevenueOperationProps } from "./RevenueOperations"
import RevenueFilters from "./RevenueFilters"
import { RevenueReceipts } from "./RevenueInputs"
import { revenueMatches } from "./revenue-filter-values"
import { changeRow } from "./revenue-tables"

export function RevenueSourceActions({ access, open }: { access: ParkingAccess; open: (kind: RevenueEntryKind, create: boolean) => void }) {
  return <div className="parking-actions">
    {revenueAccess(access, "revenue-receipt") && revenueWrite(access, "receipt") &&
      <Button onClick={() => open("receipt", true)}><Plus size={15} />Lập phiếu thu cấp thẻ</Button>}
    {revenueAccess(access, "revenue-lookup") &&
      <Button onClick={() => open("history", false)}><History size={15} />Chứng từ và lịch sử</Button>}
  </div>
}

export default function RevenueSourceDocuments(props: RevenueOperationProps) {
  const { access, params, update, state, ledger } = props
  const kind = revenueEntryKind(params)
  if (!kind) return null
  const close = () => update(closeRevenueEntry(params))
  const title = "Chứng từ và lịch sử"
  const permitted = (["history", "receipt"] as const).filter((item) => revenueAccess(access, revenueEntryScreen(item)))
  if (!permitted.some((item) => item === kind)) return <Overlay drawer title={title} onClose={close}><p role="alert">Bạn không có quyền truy cập hồ sơ này.</p></Overlay>
  const local = revenueEntryParams(params), cutoff = vnToday(), history = kind === "history"
  const filter = { estate: local.get("estate") ?? (history ? props.filter.estate : ""), site: local.get("site") ?? (history ? props.filter.site : ""), vehicle: history ? "" : local.get("vehicle") ?? "",
    start: local.get("start") ?? (history ? props.filter.start : shiftDay(cutoff, -6)), end: local.get("end") ?? (history ? props.filter.end : cutoff) }
  const change = (patch: Record<string, string | null>) => update({
    ...(!params.get("entryPanel") && params.get("tab") === "adjustments" ? {
      ...updateRevenueEntry(Object.fromEntries(local)), entryPanel: "history", tab: null, changeDate: null,
    } : {}), ...updateRevenueEntry(patch),
  })
  const error = revenuePeriodError(filter, cutoff)
  const names = { history: "Lịch sử ghi nhận", receipt: "Phiếu thu cấp thẻ" }
  if (kind === "receipt" && params.get("entryAction") === "new") {
    if (!revenueWrite(access, "receipt")) return <Overlay title={title} onClose={close}><p role="alert">Bạn không có quyền tạo hồ sơ này.</p></Overlay>
    return <RevenueReceipts {...props} filter={filter} cutoff={cutoff} params={local} update={change} startNew formOnly onFormClose={close} />
  }
  const sites = allowedSites(access), query = normalize(local.get("q") ?? "")
  const rows = state.changes.filter((row) => {
    const day = local.get("changeDate") === "origin" ? row.origin : row.recorded
    const site = row.site ?? ledger.find((item) => item.id === row.reference)?.site
    return (site ? sites.some((item) => item.id === site && item.estate === row.estate) : sites.some((item) => item.estate === row.estate)) &&
      revenueMatches(row.estate, filter.estate) && revenueMatches(site, filter.site) && day >= filter.start && day <= filter.end &&
      (!query || normalize(`${row.id} ${row.reference} ${row.reason} ${row.actor}`).includes(query))
  })
  return <div className="revenue-source-documents"><Overlay drawer title={title} onClose={close} footer={<Button onClick={close}>Đóng</Button>}>
    {permitted.length > 1 && <ParkingTabs options={permitted.map((item) => names[item])} value={names[kind as "history" | "receipt"]} change={(label) => update({ entryPanel: permitted.find((item) => names[item] === label)!, entryAction: null, entry_q: null, entry_page: null, entry_changeDate: null, entry_vehicle: null })} />}
    {history && <p className="parking-chart-note">Các phát sinh sau chốt được lưu tại đây để đối chiếu. Số liệu đã chốt được giữ nguyên.</p>}
    <RevenueFilters screen={revenueEntryScreen(kind)} history={history} filter={filter} cutoff={cutoff} access={access} params={local} state={state} ledger={ledger} update={change} />
    {!error && (history ? <div className="panel">
      <div className="op-table-toolbar lookup-table-toolbar"><span className="count-text"><strong>{fmt(rows.length)}</strong> bản ghi</span>
        <ExportButton onClick={() => props.exportFile("LichSuGhiNhanDoanhThu", () => ({ "Lịch sử ghi nhận": rows.map(changeRow) }), rows.length)} /></div>
      <PagedData rows={rows} id={(row) => row.id} data={changeRow} params={local} update={change}
        empty={<NoMatches clear={() => change({ estate: null, site: null, q: null, page: null, changeDate: null })} />}
        link={(row, key) => key === "Giao dịch gốc" && ledger.some((item) => item.id === row.reference && sites.some((site) => site.id === item.site))
          ? <TextLink onClick={() => update({ ...closeRevenueEntry(params), detail: row.reference })}>{row.reference}</TextLink> : undefined} />
    </div> : <RevenueReceipts key={kind} {...props} filter={filter} cutoff={cutoff} params={local} update={change} />)}
  </Overlay></div>
}
