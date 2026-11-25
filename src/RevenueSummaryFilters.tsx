import { useEffect, useState } from "react"
import { ListFilter, Search } from "lucide-react"
import { Button, Field, Form, Input, Select } from "./ui"
import { estates } from "./data"
import { allowedSites } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import type { UpdateParams } from "./parking-ui"
import RevenueMultiFilter from "./RevenueMultiFilter"

export default function RevenueSummaryFilters({ estate, site, month, cutoff, access, update }: {
  estate: string; site: string; month: string; cutoff: string; access: ParkingAccess; update: UpdateParams;
}) {
  const [draft, setDraft] = useState({ estate, site, month })
  useEffect(() => setDraft({ estate, site, month }), [estate, site, month])
  const sites = allowedSites(access)
  const pending = draft.estate !== estate || draft.site !== site || draft.month !== month
  return <Form className="panel filter-panel lookup-filter-panel revenue-filter-panel" onSubmit={(event) => { event.preventDefault(); update({ ...draft, page: null }) }}>
    <div className="filter-heading"><span><ListFilter size={16} /><strong>Bộ lọc tra cứu</strong>{pending && <span className="filter-pending">Chưa áp dụng</span>}</span><Button variant="ghost" onClick={() => { const value = { estate, site: "", month }; setDraft(value); update({ ...value, page: null }) }}>Xóa bộ lọc</Button></div>
    <div className="filter-grid lookup-filter-row">
      <Field label="Khu đô thị"><Select aria-label="Khu đô thị" value={draft.estate} options={estates.filter((item) => sites.some((site) => site.estate === item.id)).map((item) => ({ value: item.id, label: item.name }))} onChange={(event) => setDraft({ ...draft, estate: event.target.value, site: "" })} /></Field>
      <RevenueMultiFilter label="Bãi xe" value={draft.site} allLabel="Tất cả bãi xe" options={sites.filter((site) => site.estate === draft.estate).map((site) => ({ value: site.id, label: site.label }))} change={(site) => setDraft({ ...draft, site })} />
      <Field label="Kỳ kế toán"><Input type="month" max={cutoff.slice(0, 7)} value={draft.month} onChange={(event) => setDraft({ ...draft, month: event.target.value })} /></Field>
    </div>
    <p className="lookup-multi-hint">Tổng hợp và chốt theo từng khu đô thị, từng kỳ kế toán; có thể đối chiếu nhiều bãi xe.</p>
    <div className="lookup-filter-footer"><Button variant="primary" type="submit" disabled={!/^\d{4}-\d{2}$/.test(draft.month) || draft.month > cutoff.slice(0, 7)}><Search size={14} />Áp dụng</Button></div>
  </Form>
}
