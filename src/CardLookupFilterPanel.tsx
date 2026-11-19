import { useEffect, useState } from "react"
import { ArrowLeft, Info, ListFilter, Search } from "lucide-react"
import { alertNames, cardAlertIds, cardTypes, date, estates, maxDate, today, vehicles } from "./data"
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
  const [draft, setDraft] = useState(filters)
  useEffect(() => setDraft(filters), [filters])
  const movements = draft.mode === "movement"
  const update = (patch: Partial<CardLookupFilters>) => setDraft((current) => ({ ...current, ...patch }))
  const error = lookupDateError(draft)
  const pending = Object.keys(draft).some((key) => draft[key as keyof CardLookupFilters] !== filters[key as keyof CardLookupFilters])
  const parks = [...new Set(estates.filter((estate) => !draft.estate || estate.id === draft.estate)
    .flatMap((estate) => estate.parks))]

  function clear() {
    const cleared: CardLookupFilters = {
      ...defaultCardLookupFilters,
      start: filters.start,
      end: filters.end,
      mode: filters.mode === "current" ? "current" : "snapshot",
    }
    setDraft(cleared)
    onApply(cleared)
  }

  return (
    <Form className="panel filter-panel lookup-filter-panel" aria-label="Bộ lọc Tra cứu thẻ"
      onSubmit={(event) => {
        event.preventDefault()
        if (!error) onApply(movements ? draft : { ...draft, movement: "" })
      }}>
      <div className="filter-heading">
        <span>
          <ListFilter size={16} />
          <strong>Bộ lọc tra cứu</strong>
          {pending && <span className="filter-pending">Chưa áp dụng</span>}
        </span>
        <Button variant="ghost" onClick={clear}>Xóa bộ lọc</Button>
      </div>
      <div className="filter-grid lookup-filter-primary">
        <Field label="Tìm thẻ">
          <Input type="search" aria-label="Tìm thẻ" maxLength={100}
            placeholder="Mã thẻ, chủ thẻ, biển số, mã thuê bao…"
            value={draft.keyword} onChange={(event) => update({ keyword: event.target.value })} />
        </Field>
        <Field label="Loại biến động">
          <Select aria-label="Loại biến động" value={movements ? draft.movement : "cards"}
            options={[
              { value: "cards", label: "Không lọc biến động" },
              { value: "", label: "Tất cả biến động" },
              ...movementKinds.map((value, index) => ({ value, label: stockMetricLabels[index + 2] })),
            ]}
            onChange={(event) => {
              const value = event.target.value
              update(value === "cards"
                ? { mode: draft.start === today && draft.end === today ? "current" : "snapshot", movement: "" }
                : { mode: "movement", movement: value as CardLookupFilters["movement"] })
            }} />
        </Field>
      </div>
      <div className="filter-grid lookup-filter-row">
        <Field label="Khu đô thị">
          <Select aria-label="Khu đô thị" value={draft.estate}
            options={[{ value: "", label: "Tất cả khu đô thị" }, ...estates.map(({ id, name }) => ({ value: id, label: name }))]}
            onChange={(event) => update({ estate: event.target.value, park: "" })} />
        </Field>
        {selectFilter("Bãi xe", draft.park, (park) => update({ park }), "Tất cả bãi xe", parks)}
        {selectFilter("Loại thẻ", draft.type, (type) => update({ type }), "Tất cả loại thẻ", cardTypes)}
        {selectFilter("Phương tiện", draft.vehicle, (vehicle) => update({ vehicle }), "Tất cả phương tiện", vehicles)}
      </div>
      <div className="filter-grid lookup-filter-row">
        {selectFilter("Trạng thái", draft.status, (status) => update({ status }), "Tất cả trạng thái", lookupStatuses)}
        {selectFilter("Nhóm khách hàng", draft.group, (group) => update({ group }), "Tất cả nhóm khách hàng", circulationGroups("Nhóm khách hàng"))}
        {selectFilter("Cảnh báo", draft.alert, (alert) => update({ alert }), "Tất cả cảnh báo", cardAlertIds.map((id) => alertNames[id]))}
      </div>
      <div className="lookup-time-section">
        <div className="lookup-time-fields">
          <ReportPeriodFields period={draft} min={firstReportDate} max={maxDate} inputMax={today} error={error}
            onChange={(period) => update({ ...period, mode: movements ? "movement"
              : period.start === today && period.end === today ? "current" : "snapshot" })} />
        </div>
        <p className="lookup-time-hint" id="lookup-time-hint">
          <Info size={13} />
          <span>{movements
            ? "Biến động tính trong kỳ; trạng thái, nhóm khách hàng và cảnh báo xét tại ngày Đến ngày. Một thẻ có thể phát sinh nhiều lần."
            : error ? "Chọn kỳ báo cáo hợp lệ để xem trạng thái thẻ."
            : draft.mode === "current"
              ? "Hai ngày cùng là hôm nay: xem trạng thái hiện tại. Chọn hai ngày trùng nhau để tra cứu một ngày khác."
              : `Trạng thái và cảnh báo xét tại hết ngày ${date(draft.end)}; mỗi thẻ một dòng. Chọn hai ngày cùng là hôm nay để xem trạng thái hiện tại.`}</span>
        </p>
      </div>
      <div className="lookup-filter-footer">
        {onBack && <Button variant="ghost" onClick={onBack}><ArrowLeft size={14} /> Quay lại báo cáo</Button>}
        <Button variant="primary" type="submit" disabled={!!error}><Search size={14} /> Áp dụng</Button>
      </div>
    </Form>
  )
}
