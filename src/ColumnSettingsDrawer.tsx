import { useState } from "react"
import { Button, Input, Label, Overlay } from "./ui"

export function readColumnSelection(key: string): string[] | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null")
    if (Array.isArray(saved) && saved.every((value) => typeof value === "string"))
      return [...new Set(saved)]
  } catch {}
  return null
}

export default function ColumnSettingsDrawer({
  columns,
  selected,
  defaults,
  required,
  onClose,
  onSave,
}: {
  columns: Record<string, string>
  selected: string[]
  defaults: string[]
  required?: string
  onClose: () => void
  onSave: (selection: string[]) => void
}) {
  const [draft, setDraft] = useState(selected)
  function move(index: number, direction: number) {
    const next = [...draft]
    const [column] = next.splice(index, 1)
    next.splice(index + direction, 0, column)
    setDraft(next)
  }
  return (
    <Overlay drawer title="Tùy chỉnh cột" onClose={onClose} footer={
      <>
        <Button onClick={() => setDraft(defaults)}>Mặc định</Button>
        <Button variant="primary" onClick={() => onSave(draft)}>Lưu</Button>
      </>
    }>
      {[...draft, ...Object.keys(columns).filter((key) => !draft.includes(key))].map((key) => {
        const index = draft.indexOf(key)
        const label = columns[key]
        return (
          <div className="parking-column-setting" key={key}>
            <Label className="op-check">
              <Input type="checkbox" checked={index >= 0} disabled={key === required}
                onChange={() => setDraft(index >= 0 ? draft.filter((item) => item !== key) : [...draft, key])} />
              {label}
            </Label>
            {index >= 0 && <div className="parking-inline">
              <Button variant="ghost" aria-label={`Đưa ${label} lên`} disabled={index === 0}
                onClick={() => move(index, -1)}>↑</Button>
              <Button variant="ghost" aria-label={`Đưa ${label} xuống`} disabled={index === draft.length - 1}
                onClick={() => move(index, 1)}>↓</Button>
            </div>}
          </div>
        )
      })}
    </Overlay>
  )
}
