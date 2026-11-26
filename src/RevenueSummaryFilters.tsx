import { useEffect, useState } from "react"
import { ListFilter, Search } from "lucide-react"
import { Button, Form } from "./ui"
import { estates } from "./data"
import { allowedSites, shiftDay } from "./parking-model"
import type { ParkingAccess } from "./parking-model"
import type { UpdateParams } from "./parking-ui"
import ReportPeriodFields from "./ReportPeriodFields"
import RevenueMultiFilter from "./RevenueMultiFilter"
import { revenuePeriodError } from "./revenue-model"
import { revenueMatches, revenueValues } from "./revenue-filter-values"

export default function RevenueSummaryFilters({
  estate,
  site,
  start,
  end,
  cutoff,
  access,
  update,
}: {
  estate: string
  site: string
  start: string
  end: string
  cutoff: string
  access: ParkingAccess
  update: UpdateParams
}) {
  const [draft, setDraft] = useState({ estate, site, start, end })
  useEffect(() => setDraft({ estate, site, start, end }), [estate, site, start, end])
  const sites = allowedSites(access)
  const permittedEstates = estates.filter((item) => sites.some((s) => s.estate === item.id))
  const filteredSites = sites.filter((item) => revenueMatches(item.estate, draft.estate))
  const pending = draft.estate !== estate || draft.site !== site || draft.start !== start || draft.end !== end
  const error = revenuePeriodError({ estate: draft.estate, site: draft.site, vehicle: "", start: draft.start, end: draft.end }, cutoff)
  const isLatestDay = draft.start === cutoff && draft.end === cutoff

  const apply = () => {
    if (error) return
    update({
      estate: draft.estate || null,
      site: draft.site || null,
      start: draft.start,
      end: draft.end,
      month: null,
      closeStatus: null,
      page: null,
    })
  }

  const reset = () => {
    const next = { estate: access.estate || "", site: "", start: shiftDay(cutoff, -6), end: cutoff }
    setDraft(next)
    update({
      estate: next.estate || null,
      site: null,
      start: next.start,
      end: next.end,
      month: null,
      closeStatus: null,
      page: null,
    })
  }

  return (
    <Form
      className="panel filter-panel lookup-filter-panel revenue-filter-panel"
      aria-label="Bộ lọc Doanh thu tổng hợp"
      onSubmit={(event) => {
        event.preventDefault()
        apply()
      }}
    >
      <div className="filter-heading">
        <span>
          <ListFilter size={16} />
          <strong>Bộ lọc tra cứu</strong>
          {pending && <span className="filter-pending">Chưa áp dụng</span>}
        </span>
        <Button variant="ghost" onClick={reset}>
          Xóa bộ lọc
        </Button>
      </div>
      <div className="filter-grid lookup-filter-row">
        <RevenueMultiFilter
          label="Khu đô thị"
          value={draft.estate}
          allLabel="Tất cả khu đô thị"
          options={permittedEstates.map((item) => ({ value: item.id, label: item.name }))}
          change={(value) => {
            const keptSites = revenueValues(draft.site).filter((id) =>
              sites.some((item) => item.id === id && revenueMatches(item.estate, value)),
            )
            setDraft({ ...draft, estate: value, site: keptSites.join("|") })
          }}
        />
        <RevenueMultiFilter
          label="Bãi xe"
          value={draft.site}
          allLabel="Tất cả bãi xe"
          options={filteredSites.map((item) => ({ value: item.id, label: item.label }))}
          change={(value) => setDraft({ ...draft, site: value })}
        />
      </div>
      <p className="lookup-multi-hint">
        Tổng hợp số liệu đã tự động chốt theo ngày doanh thu; chọn nhiều khu đô thị để xuất gộp 1 file ZFI014 lên SAP.
      </p>
      <div className="lookup-time-section">
        <div className="lookup-time-fields">
          <ReportPeriodFields
            period={{ start: draft.start, end: draft.end }}
            max={cutoff}
            error={error}
            label="Khoảng ngày doanh thu"
            onChange={(period) => setDraft({ ...draft, start: period.start, end: period.end })}
          >
            <div className="quick-dates">
              <Button
                variant="ghost"
                aria-pressed={isLatestDay}
                className={isLatestDay ? "quick-selected" : ""}
                onClick={() => setDraft({ ...draft, start: cutoff, end: cutoff })}
              >
                Ngày gần nhất (T-1)
              </Button>
            </div>
          </ReportPeriodFields>
        </div>
      </div>
      <div className="lookup-filter-footer">
        <Button variant="primary" type="submit" disabled={!!error}>
          <Search size={14} />
          Áp dụng
        </Button>
      </div>
    </Form>
  )
}
