import { useState } from "react"
import { Field, Input, Select } from "./ui"
import { normalize } from "./data"

export function EntityPicker({
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (id: string) => void
  options: { value: string; label: string }[]
  required?: boolean
  disabled?: boolean
}) {
  const [query, setQuery] = useState("")
  const matching = options
    .filter((option) => normalize(option.label).includes(normalize(query)))
    .slice(0, 60)
  const selected = options.find((option) => option.value === value)
  const visible =
    selected && !matching.some((option) => option.value === value)
      ? [selected, ...matching]
      : matching
  return (
    <Field label={label} required={required}>
      <Input
        disabled={disabled}
        type="search"
        aria-label={`Tìm ${label.toLocaleLowerCase("vi")}`}
        placeholder={label.includes("thẻ")?"Tìm mã thẻ, mã mặt trước hoặc mặt sau…":label.includes("Xe")?"Tìm biển số hoặc mã xe…":"Tìm theo tên, mã hoặc số điện thoại…"}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <Select
        disabled={disabled}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        options={[
          { value: "", label: `Chọn ${label.toLocaleLowerCase("vi")}` },
          ...visible,
        ]}
      />
    </Field>
  )
}
export function RelationChoices({
  label,
  value,
  options,
  onChange,
  max = 100,
}: {
  label: string
  value: string[]
  options: { value: string; label: string }[]
  onChange: (ids: string[]) => void
  max?: number
}) {
  const [query, setQuery] = useState("")
  const visible = options
    .filter(
      (option) =>
        value.includes(option.value) ||
        normalize(option.label).includes(normalize(query)),
    )
    .sort(
      (a, b) =>
        Number(value.includes(b.value)) - Number(value.includes(a.value)),
    )
    .slice(0, 20)
  return (
    <div className="sm-relations">
      <div className="sm-section-label">
        <strong>{label}</strong>
        <span>{value.length} đã chọn</span>
      </div>
      <Input
        type="search"
        aria-label={`Tìm ${label.toLocaleLowerCase("vi")}`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Nhập tên hoặc mã để tìm…"
      />
      <div className="sm-choice-list">
        {visible.map((option) => (
          <label key={option.value}>
            <input
              type="checkbox"
              checked={value.includes(option.value)}
              disabled={!value.includes(option.value) && value.length >= max}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, option.value]
                    : value.filter((id) => id !== option.value),
                )
              }
            />
            {option.label}
          </label>
        ))}
        {!visible.length && (
          <span className="muted">Chưa có dữ liệu phù hợp.</span>
        )}
      </div>
      {options.length > 20 && (
        <small className="muted">
          Hiện tối đa 20 kết quả; nhập từ khóa để tìm thêm.
        </small>
      )}
    </div>
  )
}
