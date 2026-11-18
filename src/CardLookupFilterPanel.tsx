import { useState } from "react"
import { ArrowLeft, ListFilter, Search, X } from "lucide-react"
import { alertNames, cardAlertIds, cardTypes, estates, maxDate, vehicles } from "./data"
import ReportPeriodFields from "./ReportPeriodFields"
import {
  circulationGroups,
  defaultCardLookupFilters,
  lookupDateError,
  lookupStatuses,
  movementKinds,
  stockMetricLabels,
} from "./report-model"
import type { CardLookupFilters } from "./report-model"
import { Button, Field, Form, Input, Select } from "./ui"

const firstReportDate = "2026-09-01"
const scopeKeys = ["keyword", "estate", "park", "type", "vehicle"] as const
type Scope = Pick<CardLookupFilters, typeof scopeKeys[number]>
const filterScope = ({ keyword, estate, park, type, vehicle }: CardLookupFilters): Scope =>
  ({ keyword, estate, park, type, vehicle })

function selectFilter<T extends string>(
  label: string,
  value: T,
  onChange: (value: T) => void,
  placeholder: string,
  options: readonly T[],
) {
  return (
    <Field label={label}>
      <Select aria-label={label} value={value}
        onChange={(event) => onChange(event.target.value as T)}
        options={[{ value: "", label: placeholder }, ...options]} />
    </Field>
  )
}

export default function CardLookupFilterPanel({
  filters,
  onApply,
  onBack,
}: {
  filters: CardLookupFilters
  onApply: (filters: CardLookupFilters) => void
  onBack?: () => void
}) {
  const [movements, setMovements] = useState(filters.mode === "movement")
  const [scope, setScope] = useState(() => filterScope(filters))
  const [cardView, setCardView] = useState({
    day: filters.mode === "snapshot" ? filters.end : "",
    status: filters.status,
    group: filters.group,
    alert: filters.alert,
  })
  const [movementView, setMovementView] = useState(() => {
    const initial = filters.mode === "movement" ? filters : defaultCardLookupFilters
    return { start: initial.start, end: initial.end, movement: initial.movement }
  })

  function buildFilters(showMovements: boolean): CardLookupFilters {
    const common = { ...defaultCardLookupFilters, ...scope }
    if (showMovements) return { ...common, ...movementView, mode: "movement" }
    return {
      ...common,
      mode: cardView.day ? "snapshot" : "current",
      end: cardView.day || common.end,
      status: cardView.status,
      group: cardView.group,
      alert: cardView.day ? cardView.alert : "",
    }
  }

  const draft = buildFilters(movements)
  const error = lookupDateError(draft)
  const viewKeys = movements ? ["start", "end", "movement"] as const : ["end", "status", "group", "alert"] as const
  const pending = draft.mode !== filters.mode || [...scopeKeys, ...viewKeys].some((key) => draft[key] !== filters[key])
  const parks = [...new Set(estates.filter((estate) => !scope.estate || estate.id === scope.estate)
    .flatMap((estate) => estate.parks))]

  function changeView(showMovements: boolean) {
    if (showMovements === movements) return
    setMovements(showMovements)
    const next = buildFilters(showMovements)
    if (!lookupDateError(next)) onApply(next)
  }

  function clear() {
    const emptyScope = filterScope(defaultCardLookupFilters)
    setScope(emptyScope)
    if (movements) setMovementView((current) => ({ ...current, movement: "" }))
    else setCardView((current) => ({ ...current, status: "", group: "", alert: "" }))
    if (!error) onApply({ ...draft, ...emptyScope, status: "", group: "", alert: "", movement: "" })
  }

  return (
    <Form className="panel filter-panel lookup-filter-panel" aria-label="Bộ lọc Tra cứu thẻ"
      onSubmit={(event) => {
        event.preventDefault()
        if (!error) onApply(draft)
      }}>
      <div className="filter-heading">
        <span>
          <ListFilter size={16} />
          <strong>Bộ lọc tra cứu</strong>
          {pending && <span className="filter-pending">Chưa áp dụng</span>}
        </span>
        <Button variant="ghost" onClick={clear}>Xóa bộ lọc</Button>
      </div>
      <div className="lookup-view-switch" role="group" aria-label="Nội dung tra cứu">
        <Button variant="ghost" aria-pressed={!movements} onClick={() => changeView(false)}>Danh sách thẻ</Button>
        <Button variant="ghost" aria-pressed={movements} onClick={() => changeView(true)}>Biến động thẻ</Button>
      </div>
      <div className="filter-grid lookup-filter-primary">
        <Field label="Tìm thẻ">
          <Input type="search" aria-label="Tìm thẻ" maxLength={100}
            placeholder="Mã thẻ, chủ thẻ, biển số, mã thuê bao…"
            value={scope.keyword} onChange={(event) => setScope({ ...scope, keyword: event.target.value })} />
        </Field>
        {!movements && (
          <div className="lookup-date-control">
            <Field label="Ngày chốt" error={error || undefined}>
              <Input type="date" aria-label="Ngày chốt" aria-description="Để trống để xem trạng thái hiện tại."
                placeholder="Hiện tại" value={cardView.day}
                min={firstReportDate} max={maxDate}
                onChange={(event) => setCardView({ ...cardView, day: event.target.value })} />
            </Field>
            {cardView.day && (
              <Button variant="ghost" aria-label="Xóa ngày chốt" title="Trở về hiện tại"
                onClick={() => setCardView({ ...cardView, day: "", alert: "" })}><X size={15} /></Button>
            )}
          </div>
        )}
        {movements && (
          <Field label="Nghiệp vụ">
            <Select aria-label="Nghiệp vụ" value={movementView.movement}
              options={[
                { value: "", label: "Tất cả nghiệp vụ" },
                ...movementKinds.map((value, index) => ({ value, label: stockMetricLabels[index + 2] })),
              ]}
              onChange={(event) => setMovementView({ ...movementView, movement: event.target.value as CardLookupFilters["movement"] })} />
          </Field>
        )}
      </div>
      <div className="filter-grid lookup-filter-row">
        <Field label="Khu đô thị">
          <Select aria-label="Khu đô thị" value={scope.estate}
            options={[{ value: "", label: "Tất cả khu đô thị" }, ...estates.map(({ id, name }) => ({ value: id, label: name }))]}
            onChange={(event) => setScope({ ...scope, estate: event.target.value, park: "" })} />
        </Field>
        {selectFilter("Bãi xe", scope.park, (park) => setScope({ ...scope, park }), "Tất cả bãi xe", parks)}
        {selectFilter("Loại thẻ", scope.type, (type) => setScope({ ...scope, type }), "Tất cả loại thẻ", cardTypes)}
        {selectFilter("Phương tiện", scope.vehicle, (vehicle) => setScope({ ...scope, vehicle }), "Tất cả phương tiện", vehicles)}
      </div>
      {movements ? (
        <div className="filter-second-row">
          <ReportPeriodFields period={movementView} min={firstReportDate} max={maxDate} error={error}
            onChange={(period) => setMovementView((current) => ({ ...current, ...period }))} />
        </div>
      ) : (
        <div className="filter-grid lookup-filter-row">
          {selectFilter("Trạng thái", cardView.status, (status) => setCardView({ ...cardView, status }), "Tất cả trạng thái", lookupStatuses)}
          {selectFilter("Nhóm khách hàng", cardView.group, (group) => setCardView({ ...cardView, group }), "Tất cả nhóm khách hàng", circulationGroups("Nhóm khách hàng"))}
          {cardView.day && selectFilter("Cảnh báo", cardView.alert, (alert) => setCardView({ ...cardView, alert }), "Tất cả cảnh báo", cardAlertIds.map((id) => alertNames[id]))}
        </div>
      )}
      <div className="lookup-filter-footer">
        {onBack && <Button variant="ghost" onClick={onBack}><ArrowLeft size={14} /> Quay lại báo cáo</Button>}
        <Button variant="primary" type="submit" disabled={!!error}><Search size={14} /> Áp dụng</Button>
      </div>
    </Form>
  )
}
