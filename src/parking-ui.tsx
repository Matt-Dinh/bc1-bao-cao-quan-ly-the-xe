import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { ChartNoAxesCombined, ChevronLeft, ChevronRight, Download, ListFilter, LoaderCircle, Search } from "lucide-react"
import { Button, Field, Form, Heading, Input, Select } from "./ui"
import ReportPeriodFields from "./ReportPeriodFields"
import { date, estates, fmt } from "./data"
import { allowedSites, defaultParkingFilters, parkingVehicles, periodError, shiftDay } from "./parking-model"
import type { ParkingAccess, ParkingFilters } from "./parking-model"

export const numberText = (value: number | null | undefined, digits = 0) =>
  value == null
    ? "—"
    : value.toLocaleString("vi-VN", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })
export const pct = (value: number | null) =>
  value === null ? "—" : `${numberText(value * 100, 1)}%`
export const periodText = (filters: ParkingFilters) =>
  `${date(filters.start)} – ${date(filters.end)}`
export const undeclared = "Chưa khai báo"
export const allOption = (label: string) => ({ value: "", label })
export const parkingFilterKeys = [
  "estate",
  "site",
  "vehicle",
  "start",
  "end",
] as const
export type UpdateParams = (patch: Record<string, string | null>) => void
export type ExportCell = string | number | boolean | Date | null | undefined
export type ExportRow = Record<string, ExportCell>
export type Workbook = Record<string, ExportRow[]>
export type ExportParking = (
  name: string,
  make: () => Workbook,
  count?: number,
) => void
export const excelDate = (minute: number | null) =>
  minute == null ? null : new Date(minute * 60000)

export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick}>
      <Download size={15} /> Xuất dữ liệu
    </Button>
  )
}
export function ParkingHeading({
  title,
  group,
  cutoff,
  actions,
}: {
  title: string
  group: string
  cutoff: string
  actions?: ReactNode
}) {
  return (
    <>
      <div className="breadcrumbs">
        <span>{group}</span>
        <ChevronRight size={12} />
        <span className="current-crumb">{title}</span>
      </div>
      <div className="page-heading parking-heading">
        <div>
          <Heading level={1}>{title}</Heading>
          <p className="page-description">
            Dữ liệu minh họa · Số liệu tính đến 23:59:59 {date(cutoff)} · GMT+7
          </p>
        </div>
        {actions && <div className="parking-actions">{actions}</div>}
      </div>
    </>
  )
}
export function ParkingFiltersBar({
  filters,
  cutoff,
  access,
  error,
  change,
  lookup,
  report = false,
  loading = false,
}: {
  filters: ParkingFilters
  cutoff: string
  access: ParkingAccess
  error: string
  change: UpdateParams
  lookup?: {
    params: URLSearchParams
    fields: (params: URLSearchParams, change: UpdateParams) => ReactNode
    error: (params: URLSearchParams, filters: ParkingFilters) => string
  }
  report?: boolean
  loading?: boolean
}) {
  const [draft, setDraft] = useState(filters)
  useEffect(() => setDraft(filters), [filters])
  const query = lookup?.params.toString() ?? ""
  const [lookupDraft, setLookupDraft] = useState(() => new URLSearchParams(query))
  useEffect(() => setLookupDraft(new URLSearchParams(query)), [query])
  const manual = report || !!lookup
  const visible = manual ? draft : filters
  const datesError = manual ? periodError(draft, cutoff) : error
  const lookupError = lookup && !datesError ? lookup.error(lookupDraft, draft) : ""
  const pending = manual && (parkingFilterKeys.some((key) => draft[key] !== filters[key]) || lookupDraft.toString() !== query)
  const update = (patch: Partial<ParkingFilters>) => {
    if (manual) setDraft((current) => ({ ...current, ...patch }))
    else change(patch)
  }
  const updateLookup: UpdateParams = (patch) => setLookupDraft((current) => {
    const next = new URLSearchParams(current)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    return next
  })
  function submit() {
    if (!manual || datesError || lookupError || loading) return
    const keys = [...new Set([...(lookup?.params.keys() ?? []), ...lookupDraft.keys()])]
    change({ ...draft, ...Object.fromEntries(keys.map((key) => [key, lookupDraft.get(key)])) })
  }
  const sites = allowedSites(access).filter((site) => !visible.estate || site.estate === visible.estate)
  const estateOptions = estates.filter((estate) =>
    allowedSites(access).some((site) => site.estate === estate.id),
  )
  return (
    <Form className="panel filter-panel parking-filter-panel" onSubmit={(event) => { event.preventDefault(); submit() }}>
      <div className="filter-heading">
        <span>
          <ListFilter size={16} /><strong>{report ? "Điều kiện báo cáo" : "Bộ lọc"}</strong>
          {pending && <span className="filter-pending">Chưa áp dụng</span>}
        </span>
        {report && <Button variant="ghost" onClick={() => setDraft(defaultParkingFilters(cutoff))}>Đặt lại</Button>}
        {lookup && <Button variant="ghost" onClick={() => {
          setDraft({ ...defaultParkingFilters(cutoff), start: draft.start, end: draft.end })
          setLookupDraft(new URLSearchParams())
        }}>Xóa bộ lọc</Button>}
      </div>
      <div className="filter-grid">
        <Field label="Khu đô thị">
          <Select
            aria-label="Khu đô thị"
            value={visible.estate}
            onChange={(e) => update({ estate: e.target.value, site: "" })}
            options={[
              allOption("Tất cả khu đô thị"),
              ...estateOptions.map((estate) => ({
                value: estate.id,
                label: estate.name,
              })),
            ]}
          />
        </Field>
        <Field label="Bãi xe">
          <Select
            aria-label="Bãi xe"
            value={visible.site}
            onChange={(e) => update({ site: e.target.value })}
            options={[
              allOption("Tất cả bãi xe"),
              ...sites.map((site) => ({ value: site.id, label: site.label })),
            ]}
          />
        </Field>
        {report ? (
          <div className="field parking-vehicle-options" role="group" aria-label="Phương tiện">
            <span className="field-label">Phương tiện</span>
            <Segments options={[...parkingVehicles]} value={visible.vehicle}
              change={(vehicle) => update({ vehicle: vehicle as ParkingFilters["vehicle"] })} />
          </div>
        ) : (
          <Field label="Phương tiện">
            <Select aria-label="Phương tiện" value={visible.vehicle} options={[...parkingVehicles]}
              onChange={(e) => update({ vehicle: e.target.value as ParkingFilters["vehicle"] })} />
          </Field>
        )}
      </div>
      {lookup?.fields(lookupDraft, updateLookup)}
      {manual ? (
        <div className="filter-second-row">
          <ReportPeriodFields period={draft} max={cutoff} error={datesError} onChange={update} />
          <div className="run-report">
            <Button type="submit" variant="primary" disabled={!!(datesError || lookupError) || loading}>
              {loading ? <LoaderCircle size={16} className="spin" /> : report ? <ChartNoAxesCombined size={16} /> : <Search size={16} />}
              {report ? "Xem báo cáo" : "Áp dụng"}
            </Button>
          </div>
        </div>
      ) : <div className="filter-grid parking-lookup-grid">
        <Field label="Từ ngày" required error={datesError || undefined}>
          <Input
            aria-label="Từ ngày"
            type="date"
            max={cutoff}
            value={filters.start}
            onChange={(e) => change({ start: e.target.value })}
          />
        </Field>
        <Field label="Đến ngày" required>
          <Input
            aria-label="Đến ngày"
            type="date"
            max={cutoff}
            value={filters.end}
            onChange={(e) => change({ end: e.target.value })}
          />
        </Field>
        <Field label="Chọn nhanh">
          <Select
            aria-label="Chọn nhanh"
            value=""
            onChange={(e) => {
              if (e.target.value)
                change({
                  start: shiftDay(cutoff, 1 - Number(e.target.value)),
                  end: cutoff,
                })
            }}
            options={[
              allOption("Chọn kỳ"),
              { value: "7", label: "7 ngày trước" },
              { value: "30", label: "30 ngày trước" },
            ]}
          />
        </Field>
      </div>}
      {lookupError && <p className="lookup-filter-error" role="alert">{lookupError}</p>}
    </Form>
  )
}
export function Segments({
  options,
  value,
  change,
}: {
  options: string[]
  value: string
  change: (value: string) => void
}) {
  return (
    <div className="parking-segments">
      {options.map((option) => (
        <Button
          variant="ghost"
          key={option}
          aria-pressed={value === option}
          onClick={() => change(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  )
}
export function ParkingTabs({
  options,
  value,
  change,
  counts,
}: {
  options: string[]
  value: string
  change: (value: string) => void
  counts?: number[]
}) {
  return (
    <div className="parking-tabs" role="tablist">
      {options.map((option, index) => (
        <Button
          variant="ghost"
          role="tab"
          aria-selected={value === option}
          key={option}
          onClick={() => change(option)}
        >
          {option}
          {counts && <span className="tab-counter">{fmt(counts[index])}</span>}
        </Button>
      ))}
    </div>
  )
}
export function ParkingSearch({
  value,
  change,
  placeholder,
  minLength = 0,
}: {
  value: string
  change: (value: string) => void
  placeholder: string
  minLength?: number
}) {
  const [draft, setDraft] = useState(value)
  const tooShort = draft.trim().length > 0 && draft.trim().length < minLength
  useEffect(() => {
    setDraft(value)
  }, [value])
  useEffect(() => {
    if (value === draft) return
    const timer = window.setTimeout(() => change(draft), 400)
    return () => window.clearTimeout(timer)
  }, [draft, value, change])
  return (
    <div className="parking-search">
      <div className="search-box">
        <Search size={15} />
        <Input
          aria-label={placeholder}
          placeholder={placeholder}
          aria-invalid={tooShort || undefined}
          maxLength={100}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      {tooShort && (
        <span className="field-hint" role="status">
          Nhập ít nhất {minLength} ký tự để tìm.
        </span>
      )}
    </div>
  )
}
export interface TableColumn<T> {
  label: string
  cell: (row: T) => ReactNode
  numeric?: boolean
}
export function ParkingTable<T>({
  columns,
  rows,
  rowKey,
  rowClass,
  empty,
}: {
  columns: TableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  rowClass?: (row: T) => string
  empty?: ReactNode
}) {
  if (!rows.length)
    return <div className="parking-empty">{empty ?? "Chưa có dữ liệu"}</div>
  return (
    <div className="table-scroll parking-table-scroll">
      <table className="data-table parking-table">
        <thead>
          <tr>
            {columns.map(({ label, numeric }) => (
              <th
                className={numeric ? "parking-number" : ""}
                key={label}
                scope="col"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={rowClass?.(row)}>
              {columns.map(({ label, cell, numeric }) => (
                <td className={numeric ? "parking-number" : ""} key={label}>
                  {cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export const pageNumber = (value: string | null, count: number, size: number) =>
  Math.min(
    Math.max(1, Math.floor(Number(value) || 1)),
    Math.max(1, Math.ceil(count / size)),
  )
export const pageSize = (value: string | null) =>
  value === "100" ? 100 : value === "50" ? 50 : 20
export function ParkingPagination({
  count,
  size,
  page,
  change,
  changeSize,
}: {
  count: number
  size: number
  page: number
  change: (page: number) => void
  changeSize: (size: number) => void
}) {
  return (
    <div className="pagination parking-pagination">
      <span className="muted">
        {count
          ? `${fmt((page - 1) * size + 1)}–${fmt(Math.min(page * size, count))} trên ${fmt(count)}`
          : "0 kết quả"}
      </span>
      <div className="pagination-controls">
        <Button
          variant="ghost"
          aria-label="Trang trước"
          disabled={page <= 1}
          onClick={() => change(page - 1)}
        >
          <ChevronLeft size={16} />
        </Button>
        <span className="parking-page-number">{page}</span>
        <Button
          variant="ghost"
          aria-label="Trang sau"
          disabled={page * size >= count}
          onClick={() => change(page + 1)}
        >
          <ChevronRight size={16} />
        </Button>
        <Select
          aria-label="Số dòng mỗi trang"
          options={[20, 50, 100].map((value) => ({
            value: String(value),
            label: `${value}/trang`,
          }))}
          value={size}
          onChange={(e) => changeSize(Number(e.target.value))}
        />
      </div>
    </div>
  )
}
export function TextLink({
  children,
  onClick,
  label,
}: {
  children: ReactNode
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      className="parking-link"
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
export function NoMatches({ clear }: { clear: () => void }) {
  return (
    <>
      <p>Không có kết quả phù hợp</p>
      <Button onClick={clear}>Xóa bộ lọc</Button>
    </>
  )
}
