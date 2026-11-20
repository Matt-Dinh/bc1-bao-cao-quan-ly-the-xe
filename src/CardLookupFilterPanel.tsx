import { useEffect, useState } from "react"
import { ArrowLeft, Info, ListFilter, Search } from "lucide-react"
import { cardTypes, customerGroups, date, estates, maxDate, today, vehicles } from "./data"
import ReportPeriodFields from "./ReportPeriodFields"
import CardLookupStatusFilter from "./CardLookupStatusFilter"
import CardLookupMultiFilter from "./CardLookupMultiFilter"
import {
  lookupAlerts,
  defaultCardLookupFilters,
  lookupDateError,
  lookupParkOptions,
  lookupSelectionError,
  movementKinds,
  stockMetricLabels,
} from "./report-model"
import type { CardLookupFilters } from "./report-model"
import { Button, Field, Form, Input } from "./ui"

const firstReportDate = "2026-09-01"
function selectFilter(
  label: string,
  value: string[],
  onChange: (value: string[]) => void,
  placeholder: string,
  options: readonly string[],
) {
  return (
    <CardLookupMultiFilter label={label} value={value} onChange={onChange} allLabel={placeholder}
      options={options.map((value) => ({ value, label: value }))} />
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
  const [scopeNotice, setScopeNotice] = useState("")
  useEffect(() => {
    setDraft(filters)
    setScopeNotice("")
  }, [filters])
  const movements = draft.mode === "movement"
  const update = (patch: Partial<CardLookupFilters>) => setDraft((current) => ({ ...current, ...patch }))
  const error = lookupDateError(draft)
  const selectionError = lookupSelectionError(draft)
  const pending = JSON.stringify(draft) !== JSON.stringify(filters)
  const parks = lookupParkOptions.filter((option) => !draft.estate.length || draft.estate.includes(option.estate))

  function clear() {
    const cleared: CardLookupFilters = {
      ...defaultCardLookupFilters,
      start: filters.start,
      end: filters.end,
      mode: filters.mode === "current" ? "current" : "snapshot",
    }
    setDraft(cleared)
    setScopeNotice("")
    onApply(cleared)
  }

  return (
    <Form className="panel filter-panel lookup-filter-panel" aria-label="Bộ lọc Tra cứu thẻ"
      onSubmit={(event) => {
        event.preventDefault()
        if (!error && !selectionError) onApply(movements ? draft : { ...draft, movement: [] })
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
        <CardLookupMultiFilter label="Loại biến động" value={movements ? draft.movement.length ? draft.movement : [...movementKinds] : []}
          allLabel="Không lọc biến động" quickAll="Tất cả biến động"
          options={movementKinds.map((value, index) => ({ value, label: stockMetricLabels[index + 2] }))}
          note="Chọn các loại để xem biến động trong kỳ. Không lọc biến động: xem danh sách thẻ tại ngày đến."
          onChange={(values) => update(values.length ? { mode: "movement", movement: values as CardLookupFilters["movement"] }
            : { mode: draft.start === today && draft.end === today ? "current" : "snapshot", movement: [] })} />
      </div>
      <div className="filter-grid lookup-filter-row">
        <CardLookupMultiFilter label="Khu đô thị" value={draft.estate} allLabel="Tất cả khu đô thị"
          options={estates.map(({ id, name }) => ({ value: id, label: name }))}
          onChange={(estate) => {
            const park = draft.park.filter((key) => lookupParkOptions.some((option) => option.value === key &&
              (!estate.length || estate.includes(option.estate))))
            setScopeNotice(park.length !== draft.park.length ? "Đã bỏ các bãi xe không thuộc khu đô thị vừa chọn. Vui lòng kiểm tra lại bãi xe trước khi áp dụng." : "")
            update({ estate, park })
          }} />
        <CardLookupMultiFilter label="Bãi xe" value={draft.park} onChange={(park) => update({ park })}
          allLabel="Tất cả bãi xe" options={parks} note="Tên khu đô thị đi kèm giúp phân biệt các bãi xe trùng tên." />
        {selectFilter("Loại thẻ", draft.type, (type) => update({ type }), "Tất cả loại thẻ", cardTypes)}
        {selectFilter("Phương tiện", draft.vehicle, (vehicle) => update({ vehicle }), "Tất cả phương tiện", vehicles)}
      </div>
      <div className="filter-grid lookup-filter-row">
        <CardLookupStatusFilter value={draft.statuses} onChange={(statuses) => update({ statuses })} />
        <CardLookupMultiFilter label="Nhóm thuê bao" value={draft.group} onChange={(group) => update({ group })}
          allLabel="Tất cả nhóm thuê bao" options={customerGroups.map((value) => ({ value, label: value }))}
          note="Nhóm thuê bao áp dụng cho thẻ Thuê bao tháng. VIP và Vãng lai được chọn tại Loại thẻ." />
        <CardLookupMultiFilter label="Cảnh báo" value={draft.alert} onChange={(alert) => update({ alert })}
          allLabel="Không giới hạn cảnh báo"
          options={lookupAlerts.map((label) => ({ value: label, label }))}
          note="Khớp một trong các cảnh báo đã chọn. Bỏ chọn hết để không giới hạn, gồm cả thẻ không có cảnh báo." />
      </div>
      <p className="lookup-multi-hint">Trong cùng một bộ lọc: khớp một trong các lựa chọn. Giữa các bộ lọc: đáp ứng đồng thời.</p>
      {scopeNotice && <p className="lookup-multi-notice" role="status">{scopeNotice}</p>}
      {selectionError && <p className="field-message" role="alert">{selectionError}</p>}
      <div className="lookup-time-section">
        <div className="lookup-time-fields">
          <ReportPeriodFields period={draft} min={firstReportDate} max={maxDate} inputMax={today} error={error}
            onChange={(period) => update({ ...period, mode: movements ? "movement"
              : period.start === today && period.end === today ? "current" : "snapshot" })} />
        </div>
        <p className="lookup-time-hint" id="lookup-time-hint">
          <Info size={13} />
          <span>{movements
            ? "Biến động tính trong kỳ; trạng thái, nhóm thuê bao và cảnh báo xét tại ngày Đến ngày. Một thẻ có thể phát sinh nhiều lần."
            : error ? "Chọn kỳ báo cáo hợp lệ để xem trạng thái thẻ."
            : draft.mode === "current"
              ? "Hai ngày cùng là hôm nay: xem trạng thái hiện tại. Chọn hai ngày trùng nhau để tra cứu một ngày khác."
              : `Trạng thái và cảnh báo xét tại hết ngày ${date(draft.end)}; mỗi thẻ một dòng. Chọn hai ngày cùng là hôm nay để xem trạng thái hiện tại.`}</span>
        </p>
      </div>
      <div className="lookup-filter-footer">
        {onBack && <Button variant="ghost" onClick={onBack}><ArrowLeft size={14} /> Quay lại báo cáo</Button>}
        <Button variant="primary" type="submit" disabled={!!error || !!selectionError}><Search size={14} /> Áp dụng</Button>
      </div>
    </Form>
  )
}
