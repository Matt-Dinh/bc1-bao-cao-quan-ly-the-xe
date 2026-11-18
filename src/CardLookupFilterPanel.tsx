import { useState } from "react"
import { ArrowLeft, ChevronDown, ListFilter, Search, X } from "lucide-react"
import { alertNames, cardAlertIds, cardTypes, estates, maxDate, vehicles } from "./data"
import { circulationGroups, defaultCardLookupFilters, lookupDateError, lookupStatuses, movementKinds, stockMetricLabels } from "./report-model"
import type { CardLookupFilters } from "./report-model"
import { Button, Field, Form, Input, Select } from "./ui"

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
  const [showMore, setShowMore] = useState(false)
  const error = lookupDateError(draft)
  const pending = JSON.stringify(draft) !== JSON.stringify(filters)
  const movements = draft.mode === "movement"
  const snapshot = draft.mode === "snapshot"
  const parks = [...new Set(estates.filter((estate) => !draft.estate || estate.id === draft.estate)
    .flatMap((estate) => estate.parks))]

  function update<K extends keyof CardLookupFilters>(key: K, value: CardLookupFilters[K]) {
    setDraft((current) => ({ ...current, [key]: value, ...(key === "estate" ? { park: "" } : {}) }))
  }

  function clear() {
    const next: CardLookupFilters = {
      ...defaultCardLookupFilters,
      mode: filters.mode,
      start: filters.start,
      end: filters.end,
    }
    setDraft(next)
    onApply(next)
  }

  function changeMode(mode: CardLookupFilters["mode"]) {
    setDraft((current) => ({
      ...current,
      mode,
      start: mode === "movement" && current.start > current.end ? current.end : current.start,
      status: mode === "movement" ? "" : current.status,
      group: mode === "movement" ? "" : current.group,
      alert: mode === "snapshot" ? current.alert : "",
      movement: mode === "movement" ? current.movement : "",
    }))
  }

  function removeAdvanced(key: "group" | "alert") {
    update(key, "")
    onApply({ ...filters, [key]: "" })
  }

  function select<K extends keyof CardLookupFilters>(key: K, label: string, placeholder: string, options: readonly CardLookupFilters[K][]) {
    return (
      <Field label={label}>
        <Select
          aria-label={label}
          value={draft[key]}
          onChange={(e) => update(key, e.target.value as CardLookupFilters[K])}
          options={[{ value: "", label: placeholder }, ...options]}
        />
      </Field>
    )
  }

  return (
    <Form
      className="panel filter-panel lookup-filter-panel"
      aria-label="Bộ lọc Tra cứu thẻ"
      onSubmit={(event) => {
        event.preventDefault()
        if (!error) onApply(draft)
      }}
    >
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
          <Input
            type="search"
            aria-label="Tìm thẻ"
            maxLength={100}
            placeholder="Mã thẻ, chủ thẻ, biển số, mã thuê bao…"
            value={draft.keyword}
            onChange={(e) => update("keyword", e.target.value)}
          />
        </Field>
        <Field label="Tra cứu theo">
          <Select
            aria-label="Tra cứu theo"
            value={draft.mode}
            options={[
              { value: "current", label: "Hiện tại" },
              { value: "snapshot", label: "Tại ngày chốt" },
              { value: "movement", label: "Phát sinh trong kỳ" },
            ]}
            onChange={(e) => changeMode(e.target.value as CardLookupFilters["mode"])}
          />
        </Field>
      </div>
      <div className="filter-grid lookup-filter-row">
        <Field label="Khu đô thị">
          <Select
            aria-label="Khu đô thị"
            value={draft.estate}
            options={[{ value: "", label: "Tất cả khu đô thị" }, ...estates.map((item) => ({ value: item.id, label: item.name }))]}
            onChange={(e) => update("estate", e.target.value)}
          />
        </Field>
        {select("park", "Bãi xe", "Tất cả bãi xe", parks)}
        {select("type", "Loại thẻ", "Tất cả loại thẻ", cardTypes)}
        {select("vehicle", "Phương tiện", "Tất cả phương tiện", vehicles)}
      </div>
      <div className="filter-grid lookup-filter-row">
        {movements && (
          <Field label="Từ ngày" required>
            <Input type="date" aria-label="Từ ngày" value={draft.start} min="2026-09-01" max={maxDate}
              onChange={(e) => update("start", e.target.value)} />
          </Field>
        )}
        {(movements || snapshot) && (
          <Field label={movements ? "Đến ngày" : "Ngày chốt"} required>
            <Input type="date" aria-label={movements ? "Đến ngày" : "Ngày chốt"} value={draft.end}
              min="2026-09-01" max={maxDate} onChange={(e) => update("end", e.target.value)} />
          </Field>
        )}
        {movements ? (
          <Field label="Nghiệp vụ">
            <Select
              aria-label="Nghiệp vụ"
              value={draft.movement}
              options={[
                { value: "", label: "Tất cả nghiệp vụ" },
                ...movementKinds.map((value, i) => ({ value, label: stockMetricLabels[i + 2] })),
              ]}
              onChange={(e) => update("movement", e.target.value as CardLookupFilters["movement"])}
            />
          </Field>
        ) : select("status", "Trạng thái", "Tất cả trạng thái", lookupStatuses)}
      </div>
      {(!movements || filters.group || filters.alert) && (
        <div className="lookup-filter-more">
          {!movements && (
            <Button
              variant="ghost"
              aria-expanded={showMore}
              aria-controls="lookup-extra-filters"
              onClick={() => setShowMore(!showMore)}
            >
              Lọc thêm <ChevronDown size={14} />
            </Button>
          )}
          {filters.mode !== "movement" && filters.group && (
            <span className="filter-chip">
              Nhóm khách hàng: {filters.group}
              <Button variant="ghost" aria-label="Bỏ lọc nhóm khách hàng" onClick={() => removeAdvanced("group")}><X size={12} /></Button>
            </span>
          )}
          {filters.mode === "snapshot" && filters.alert && (
            <span className="filter-chip">
              Cảnh báo: {filters.alert}
              <Button variant="ghost" aria-label="Bỏ lọc cảnh báo" onClick={() => removeAdvanced("alert")}><X size={12} /></Button>
            </span>
          )}
        </div>
      )}
      {!movements && (
        <div id="lookup-extra-filters" hidden={!showMore}>
          <div className="filter-grid lookup-filter-row">
            {select("group", "Nhóm khách hàng", "Tất cả nhóm khách hàng", circulationGroups("Nhóm khách hàng"))}
            {snapshot && select("alert", "Cảnh báo", "Tất cả cảnh báo", cardAlertIds.map((id) => alertNames[id]))}
          </div>
        </div>
      )}
      {error && <p className="lookup-filter-error" role="alert">{error}</p>}
      <div className="lookup-filter-footer">
        {onBack && <Button variant="ghost" onClick={onBack}><ArrowLeft size={14} /> Quay lại báo cáo</Button>}
        <Button variant="primary" type="submit" disabled={!!error}><Search size={14} /> Áp dụng</Button>
      </div>
    </Form>
  )
}
