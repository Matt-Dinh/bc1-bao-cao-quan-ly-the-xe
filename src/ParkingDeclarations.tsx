import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import {
  ArrowLeft,
  Ban,
  History,
  ListFilter,
  Pencil,
  Plus,
  TriangleAlert,
  Upload,
} from "lucide-react"
import {
  Badge,
  Button,
  Field,
  Form,
  Heading,
  Input,
  Label,
  Overlay,
  Select,
  Textarea,
} from "./ui"
import { date, estates, fmt, normalize } from "./data"
import {
  allowedSites,
  canConfigure,
  canDeclare,
  canExport,
  declarationStatus,
  effectiveEnd,
  minuteIso,
  parkingVehicles,
  shiftDay,
  siteById,
  vnNow,
  vnToday,
} from "./parking-model"
import type {
  Audit,
  Declaration,
  DeclarationKind,
  ParkingAccess,
  ParkingSettings,
} from "./parking-model"
import {
  canEditRecord,
  declarationLabels,
  declarationScope,
  editDraft,
  fromDraft,
  newDraft,
  planWarning,
  validateDeclaration,
} from "./parking-declarations"
import type { DeclarationDraft } from "./parking-declarations"
import {
  allOption,
  ExportButton,
  NoMatches,
  numberText,
  pageNumber,
  pageSize,
  ParkingHeading,
  ParkingPagination,
  ParkingSearch,
  ParkingTable,
  ParkingTabs,
  TextLink,
} from "./parking-ui"
import type {
  ExportParking,
  ExportRow,
  TableColumn,
  UpdateParams,
} from "./parking-ui"

const operationalTabs: DeclarationKind[] = ["capacities", "plans", "schedules"]
const configTabs: DeclarationKind[] = ["thresholds", "holidays"]
const statuses = ["Đang áp dụng", "Sắp áp dụng", "Hết hiệu lực", "Đã hủy"]
const excelColumns: Record<"capacities" | "plans", string[]> = {
  capacities: [
    "Mã bãi",
    "Loại xe",
    "Ngày áp dụng",
    "Quy hoạch",
    "Kế hoạch",
    "Thực tế",
    "Chỗ sạc",
  ],
  plans: ["Mã bãi", "Loại xe", "Ngày áp dụng", "Tháng", "Giờ đỗ kế hoạch"],
}
type BatchRow = {
  index: number
  cells: ExportRow
  draft: DeclarationDraft
  status: "Hợp lệ" | "Lỗi dữ liệu" | "Trùng lặp"
  message: string
}
type Editing = {
  draft: DeclarationDraft
  original?: Declaration
  baseline: string
}
interface Props {
  configuration: boolean
  settings: ParkingSettings
  params: URLSearchParams
  update: UpdateParams
  access: ParkingAccess
  actor: string
  cutoff: string
  exportFile: ExportParking
  save: (change: (latest: ParkingSettings) => ParkingSettings) => boolean
  onDirty: (dirty: boolean) => void
  notify: (message: string) => void
}
export default function ParkingDeclarations({
  configuration,
  settings,
  params,
  update,
  access,
  actor,
  cutoff,
  exportFile,
  save,
  onDirty,
  notify,
}: Props) {
  const tabs = configuration ? configTabs : operationalTabs
  const kind = tabs.find((tab) => tab === params.get("configTab")) ?? tabs[0]
  const editable = configuration ? canConfigure(access) : canDeclare(access)
  const [editor, setEditor] = useState<Editing | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [cancel, setCancel] = useState<Declaration | null>(null)
  const [drawer, setDrawer] = useState<"history" | "filters" | null>(null)
  const [upload, setUpload] = useState(false)
  const [batch, setBatch] = useState<BatchRow[]>([])
  const [uploadError, setUploadError] = useState("")
  const [reading, setReading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [historySize, setHistorySize] = useState(20)
  const today = vnToday()
  const tomorrow = shiftDay(today, 1)
  const estate = params.get("configEstate") || ""
  const search = params.get("q")?.slice(0, 100) || ""
  const status = params.get("configStatus") || ""
  const vehicle = params.get("configVehicle") || ""
  const title = configuration ? "Tham số chỗ đỗ" : "Sức chứa và kế hoạch bãi xe"
  const estateOptions = estates.filter(
    (row) => !access.estate || row.id === access.estate,
  )
  const sites = allowedSites(access)
  const dirty = !!editor && JSON.stringify(editor.draft) !== editor.baseline
  const uploadDirty = upload && !!selectedFile
  useEffect(() => {
    onDirty(dirty || uploadDirty)
    return () => onDirty(false)
  }, [dirty, uploadDirty, onDirty])
  const close = () => {
    if (dirty || uploadDirty) setDiscard(true)
    else {
      setEditor(null)
      setUpload(false)
    }
  }
  const start = (row?: Declaration) => {
    const draft = row
      ? editDraft(row)
      : newDraft(
          sites.filter((site) => !estate || site.estate === estate)[0]?.id,
          estate || access.estate,
        )
    setSubmitted(false)
    setEditor({ draft, original: row, baseline: JSON.stringify(draft) })
    if (kind === "schedules") window.scrollTo(0, 0)
  }
  const draft = editor?.draft
  const set = <K extends keyof DeclarationDraft,>(
    key: K,
    value: DeclarationDraft[K],
  ) =>
    setEditor(
      (current) =>
        current && { ...current, draft: { ...current.draft, [key]: value } },
    )
  const errors = draft
    ? validateDeclaration(
        kind,
        draft,
        settings,
        access,
        editor?.original?.id,
        today,
      )
    : {}
  const warning = kind === "plans" && draft ? planWarning(draft, settings) : ""
  const scope = (row: Declaration) => {
    const id = declarationScope(row)
    return (
      (!id || !access.estate || id === access.estate) &&
      (!id || !estate || id === estate)
    )
  }
  const label = (row: Declaration) =>
    "site" in row
      ? (siteById(row.site)?.label ?? "—")
      : "estate" in row
        ? (estates.find((item) => item.id === row.estate)?.name ?? "—")
        : row.name
  const collection: Declaration[] = settings[kind]
  const rows = collection
    .filter(
      (row) =>
        scope(row) &&
        (!status || status === declarationStatus(row, collection, today)) &&
        (!vehicle || !("vehicle" in row) || row.vehicle === vehicle) &&
        (!search || normalize(label(row)).includes(normalize(search))),
    )
    .sort(
      (a, b) =>
        label(a).localeCompare(label(b), "vi") ||
        b.effective.localeCompare(a.effective),
    )
  const size = pageSize(params.get("size")),
    page = pageNumber(params.get("page"), rows.length, size)
  const changeEntry = (
    latest: ParkingSettings,
    next: Declaration,
    action: string,
    before?: Declaration,
  ) => {
    const history: Audit = {
      id: crypto.randomUUID(),
      at: next.updated,
      actor,
      action,
      scope: declarationScope(next),
      detail: label(next),
      kind,
      before,
      after: next,
    }
    return {
      ...latest,
      [kind]: [...latest[kind].filter((row) => row.id !== next.id), next],
      history: [history, ...latest.history],
    }
  }
  const ensureCurrent = (latest: ParkingSettings, row: Declaration) => {
    const previous = latest[kind].find((item) => item.id === row.id)
    if (
      JSON.stringify(previous) !== JSON.stringify(row) ||
      !canEditRecord(kind, row, latest, access)
    )
      throw new Error("Dữ liệu đã được người khác cập nhật, vui lòng tải lại.")
  }
  const saveEditor = () => {
    if (!editor) return
    setSubmitted(true)
    if (Object.keys(errors).length) return
    const success = save((latest) => {
      if (editor.original) ensureCurrent(latest, editor.original)
      const problems = validateDeclaration(
        kind,
        editor.draft,
        latest,
        access,
        editor.original?.id,
      )
      if (Object.keys(problems).length)
        throw new Error(
          "Dữ liệu đã được người khác cập nhật, vui lòng tải lại.",
        )
      const next = fromDraft(
        kind,
        editor.draft,
        actor,
        minuteIso(vnNow()),
        editor.original?.id ?? crypto.randomUUID(),
      )
      return changeEntry(
        latest,
        next,
        editor.original ? "Sửa khai báo" : "Thêm khai báo",
        editor.original,
      )
    })
    if (success) {
      setEditor(null)
      notify("Đã lưu khai báo.")
    }
  }
  const cancelRecord = () => {
    if (!cancel) return
    const success = save((latest) => {
      ensureCurrent(latest, cancel)
      return changeEntry(
        latest,
        { ...cancel, actor, updated: minuteIso(vnNow()), canceled: true },
        "Hủy khai báo",
        cancel,
      )
    })
    if (success) notify("Đã hủy khai báo.")
    setCancel(null)
  }
  const textField = (
    key: keyof DeclarationDraft,
    title: string,
    type = "text",
    maxLength?: number,
  ) =>
    draft && (
      <Field label={title} required error={submitted ? errors[key] : undefined}>
        <Input
          aria-label={title}
          type={type}
          value={String(draft[key])}
          min={
            type === "number"
              ? 0
              : key === "effective" && kind !== "holidays"
                ? tomorrow
                : undefined
          }
          step={type === "number" ? 1 : undefined}
          maxLength={maxLength}
          onChange={(e) => set(key, e.target.value)}
        />
      </Field>
    )
  const fields = draft && (
    <div className="parking-form-grid">
      {!configuration && (
        <Field
          label="Bãi xe"
          required
          error={submitted ? errors.site : undefined}
        >
          <Select
            value={draft.site}
            options={[
              allOption("Chọn bãi xe"),
              ...sites.map((site) => ({ value: site.id, label: site.label })),
            ]}
            onChange={(e) => set("site", e.target.value)}
          />
        </Field>
      )}
      {(kind === "capacities" || kind === "plans") && (
        <Field
          label="Loại xe"
          required
          error={submitted ? errors.vehicle : undefined}
        >
          <Select
            value={draft.vehicle}
            options={parkingVehicles.slice(0, 3)}
            onChange={(e) =>
              set("vehicle", e.target.value as DeclarationDraft["vehicle"])
            }
          />
        </Field>
      )}
      {kind === "thresholds" && (
        <Field
          label="Khu đô thị"
          required
          error={submitted ? errors.estate : undefined}
        >
          <Select
            value={draft.estate}
            options={[
              allOption("Chọn khu đô thị"),
              ...estateOptions.map((item) => ({
                value: item.id,
                label: item.name,
              })),
            ]}
            onChange={(e) => set("estate", e.target.value)}
          />
        </Field>
      )}
      {kind === "capacities" && (
        <>
          {textField("design", "Chỗ quy hoạch", "number")}
          {textField("planned", "Chỗ kế hoạch", "number")}
          {textField("actual", "Chỗ thực tế", "number")}
          {draft.vehicle === "Ô tô" &&
            textField("charging", "Trong đó chỗ sạc", "number")}
        </>
      )}
      {kind === "plans" && (
        <>
          <Field
            label="Tháng kế hoạch"
            required
            error={submitted ? errors.month : undefined}
          >
            <Input
              aria-label="Tháng kế hoạch"
              type="month"
              min={tomorrow.slice(0, 7)}
              value={draft.month}
              onChange={(e) => {
                const month = e.target.value
                const effective = `${month}-01`
                setEditor({
                  ...editor!,
                  draft: {
                    ...draft,
                    month,
                    effective: effective < tomorrow ? tomorrow : effective,
                  },
                })
              }}
            />
          </Field>
          {textField("hours", "Giờ đỗ kế hoạch", "number")}
        </>
      )}
      {kind === "schedules" && (
        <>
          {textField("from", "Bắt đầu khai thác", "time")}
          {textField("to", "Kết thúc khai thác", "time")}
        </>
      )}
      {kind === "thresholds" && (
        <>
          {textField("hours", "Ngưỡng tồn bất thường (giờ)", "number")}
          {textField("approval", "Số phê duyệt (PD)", "text", 255)}
        </>
      )}
      {kind === "holidays" && textField("name", "Tên ngày lễ tết", "text", 255)}
      {textField(
        "effective",
        kind === "holidays" ? "Ngày lễ" : "Áp dụng từ",
        "date",
      )}
      {kind === "holidays" && (
        <Label className="op-check">
          <Input
            type="checkbox"
            checked={draft.substitute}
            onChange={(e) => set("substitute", e.target.checked)}
          />
          Ngày nghỉ bù
        </Label>
      )}
      {kind === "thresholds" && (
        <div className="op-full">
          <Field label="Ghi chú" error={submitted ? errors.note : undefined}>
            <Textarea
              rows={3}
              maxLength={500}
              value={draft.note}
              onChange={(e) => set("note", e.target.value)}
            />
            <span className="character-count">{draft.note.length}/500</span>
          </Field>
        </div>
      )}
      {submitted && (errors.duplicate || errors.permission) && (
        <p className="field-message op-full" role="alert">
          {errors.duplicate || errors.permission}
        </p>
      )}
      {warning && (
        <p className="parking-banner warning op-full">
          <TriangleAlert size={16} />
          {warning}
        </p>
      )}
    </div>
  )
  const footer = (
    <>
      <Button onClick={close}>Hủy</Button>
      <Button variant="primary" onClick={saveEditor}>
        Lưu
      </Button>
    </>
  )
  const editorTitle = `${
    editor?.original ? "Sửa" : "Khai báo"
  } ${declarationLabels[kind].toLowerCase()}`
  const saveForm = (e: React.FormEvent) => {
    e.preventDefault()
    saveEditor()
  }
  if (editor && draft && kind === "schedules")
    return (
      <>
        <ParkingHeading
          title={editorTitle}
          group="Quản lý chỗ đỗ / Sức chứa và kế hoạch bãi xe"
          cutoff={cutoff}
          actions={
            <Button onClick={close}>
              <ArrowLeft size={15} /> Quay lại
            </Button>
          }
        />
        <Form onSubmit={saveForm}>
          <section className="panel parking-detail-panel">
            <Heading>Giờ khai thác</Heading>
            {fields}
          </section>
          <section className="panel parking-detail-panel">
            <div className="parking-toolbar">
              <Heading>Ca trực</Heading>
              <Button
                disabled={draft.shifts.length >= 4}
                onClick={() =>
                  set("shifts", [
                    ...draft.shifts,
                    {
                      name: `Ca ${draft.shifts.length + 1}`,
                      from: draft.shifts[draft.shifts.length - 1].to,
                      to: "",
                    },
                  ])
                }
              >
                <Plus size={15} /> Thêm ca
              </Button>
            </div>
            <p className="muted">
              Khai báo 1–4 ca nối tiếp và phủ đủ 24 giờ. Ca qua nửa đêm thuộc
              ngày bắt đầu ca.
            </p>
            {draft.shifts.map((shift, index) => (
              <div className="parking-shift-fields" key={index}>
                {(["name", "from", "to"] as const).map((key, column) => (
                  <Field
                    label={["Tên ca", "Bắt đầu", "Kết thúc"][column]}
                    required
                    key={key}
                  >
                    <Input
                      type={key === "name" ? "text" : "time"}
                      maxLength={key === "name" ? 100 : undefined}
                      value={shift[key]}
                      onChange={(e) =>
                        set(
                          "shifts",
                          draft.shifts.map((item, row) =>
                            row === index
                              ? { ...item, [key]: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                ))}
                <Button
                  disabled={draft.shifts.length <= 1}
                  onClick={() =>
                    set(
                      "shifts",
                      draft.shifts.filter((_, row) => row !== index),
                    )
                  }
                >
                  Bỏ ca
                </Button>
              </div>
            ))}
            {submitted && errors.shifts && (
              <p className="field-message" role="alert">
                {errors.shifts}
              </p>
            )}
          </section>
          <div className="parking-actions parking-form-footer">{footer}</div>
        </Form>
        {discard && (
          <Discard
            onStay={() => setDiscard(false)}
            onLeave={() => {
              setDiscard(false)
              setEditor(null)
            }}
          />
        )}
      </>
    )

  const exportData = (row: Declaration): ExportRow => {
    const until = effectiveEnd(row, collection)
    const values =
      "design" in row
        ? {
            "Loại xe": row.vehicle,
            "Quy hoạch": row.design,
            "Kế hoạch": row.planned,
            "Thực tế": row.actual,
            "Chỗ sạc": row.charging,
          }
        : "month" in row
          ? {
              "Loại xe": row.vehicle,
              Tháng: row.month,
              "Giờ đỗ kế hoạch": row.hours,
            }
          : "shifts" in row
            ? {
                "Bắt đầu": row.from,
                "Kết thúc": row.to,
                "Ca trực": row.shifts
                  .map((shift) => `${shift.name} ${shift.from}–${shift.to}`)
                  .join("; "),
              }
            : "approval" in row
              ? {
                  "Ngưỡng (giờ)": row.hours,
                  "Số PD": row.approval,
                  "Ghi chú": row.note,
                }
              : {
                  "Tên ngày lễ": row.name,
                  "Nghỉ bù": row.substitute ? "Có" : "",
                }
    return {
      "Đơn vị": label(row),
      ...values,
      "Áp dụng từ": new Date(`${row.effective}T00:00:00Z`),
      Đến: until ? new Date(`${until}T00:00:00Z`) : null,
      "Trạng thái": declarationStatus(row, collection, today),
      "Người cập nhật": row.actor,
      "Ngày cập nhật": new Date(`${row.updated}Z`),
    }
  }
  const table: TableColumn<Declaration>[] = [
    {
      label:
        kind === "holidays"
          ? "Tên ngày lễ tết"
          : configuration
            ? "Khu đô thị"
            : "Bãi xe",
      cell: label,
    },
    ...(kind === "capacities" || kind === "plans"
      ? [
          {
            label: "Loại xe",
            cell: (row: Declaration) => ("vehicle" in row ? row.vehicle : "—"),
          },
        ]
      : []),
    ...(kind === "capacities"
      ? ([
          ["Quy hoạch", "design"],
          ["Kế hoạch", "planned"],
          ["Thực tế", "actual"],
          ["Trong đó chỗ sạc", "charging"],
        ] as const).map(([label, key]) => ({
          label,
          numeric: true,
          cell: (row: Declaration) =>
            "design" in row && (key !== "charging" || row.vehicle === "Ô tô")
              ? fmt(row[key])
              : "—",
        }))
      : []),
    ...(kind === "plans"
      ? [
          {
            label: "Tháng",
            cell: (row: Declaration) =>
              "month" in row ? row.month.split("-").reverse().join("/") : "—",
          },
          {
            label: "Giờ đỗ kế hoạch",
            numeric: true,
            cell: (row: Declaration) => ("month" in row ? fmt(row.hours) : "—"),
          },
        ]
      : []),
    ...(kind === "schedules"
      ? [
          {
            label: "Giờ khai thác",
            cell: (row: Declaration) =>
              "shifts" in row ? `${row.from} – ${row.to}` : "—",
          },
          {
            label: "Ca trực",
            cell: (row: Declaration) =>
              "shifts" in row
                ? row.shifts
                    .map((shift) => `${shift.name} ${shift.from}–${shift.to}`)
                    .join(" · ") || "Chưa khai báo"
                : "—",
          },
        ]
      : []),
    ...(kind === "thresholds"
      ? [
          {
            label: "Ngưỡng (giờ)",
            numeric: true,
            cell: (row: Declaration) =>
              "approval" in row ? fmt(row.hours) : "—",
          },
          {
            label: "Số PD",
            cell: (row: Declaration) =>
              "approval" in row ? row.approval : "—",
          },
          {
            label: "Ghi chú",
            cell: (row: Declaration) =>
              "approval" in row ? (
                <span title={row.note} className="parking-truncate">
                  {row.note || "—"}
                </span>
              ) : (
                "—"
              ),
          },
        ]
      : []),
    ...(kind === "holidays"
      ? [
          {
            label: "Ngày nghỉ bù",
            cell: (row: Declaration) =>
              "substitute" in row && row.substitute ? "Có" : "—",
          },
        ]
      : []),
    {
      label: kind === "holidays" ? "Ngày lễ" : "Áp dụng từ",
      cell: (row) => date(row.effective),
    },
    ...(kind !== "holidays"
      ? [
          {
            label: "Đến",
            cell: (row: Declaration) => date(effectiveEnd(row, collection)),
          },
          {
            label: "Trạng thái",
            cell: (row: Declaration) => {
              const state = declarationStatus(row, collection, today)
              return (
                <Badge
                  tone={
                    state === statuses[0]
                      ? "green"
                      : state === statuses[1]
                        ? "amber"
                        : "neutral"
                  }
                >
                  {state}
                </Badge>
              )
            },
          },
        ]
      : []),
    { label: "Người cập nhật", cell: (row) => row.actor },
    { label: "Ngày cập nhật", cell: (row) => date(row.updated.slice(0, 10)) },
    ...(editable
      ? [
          {
            label: "Thao tác",
            cell: (row: Declaration) =>
              canEditRecord(kind, row, settings, access) ? (
                <div className="parking-inline">
                  <Button
                    variant="ghost"
                    aria-label={`Sửa ${label(row)}`}
                    onClick={() => start(row)}
                  >
                    <Pencil size={15} />
                  </Button>
                  {kind !== "holidays" && (
                    <Button
                      variant="ghost"
                      aria-label={`Hủy ${label(row)}`}
                      onClick={() => setCancel(row)}
                    >
                      <Ban size={15} />
                    </Button>
                  )}
                </div>
              ) : (
                "—"
              ),
          },
        ]
      : []),
  ]
  const importKind = kind === "capacities" || kind === "plans" ? kind : null
  const checkFile = async () => {
    if (!selectedFile || !importKind) return
    setUploadError("")
    setBatch([])
    if (
      !/\.(xlsx|xls)$/i.test(selectedFile.name) ||
      selectedFile.size > 10 * 1024 * 1024
    ) {
      setUploadError("Chỉ nhận tệp XLSX hoặc XLS tối đa 10 MB.")
      return
    }
    setReading(true)
    try {
      const XLSX = await import("xlsx")
      const book = XLSX.read(await selectedFile.arrayBuffer(), {
        type: "array",
        cellDates: true,
      })
      const sheet = book.Sheets[book.SheetNames[0]]
      const header =
        XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? []
      if (
        !excelColumns[importKind]
          .filter((column) => column !== "Chỗ sạc")
          .every((column) => header.includes(column))
      )
        throw new Error("Tiêu đề cột chưa đúng. Vui lòng sử dụng file mẫu.")
      const source = XLSX.utils.sheet_to_json<ExportRow>(sheet, { defval: "" })
      if (!source.length) throw new Error("File chưa có dòng dữ liệu.")
      let checked = settings
      const dateValue = (value: ExportRow[string]) => {
        if (value instanceof Date) return value.toISOString().slice(0, 10)
        if (typeof value === "number") {
          const result = XLSX.SSF.parse_date_code(value)
          if (result)
            return `${result.y}-${String(result.m).padStart(2, "0")}-${String(result.d).padStart(2, "0")}`
        }
        const text = String(value ?? "").trim()
        return /^\d{2}\/\d{2}\/\d{4}$/.test(text)
          ? text.split("/").reverse().join("-")
          : text
      }
      setBatch(
        source.map((cells, i): BatchRow => {
          const draft: DeclarationDraft = {
            ...newDraft(),
            site: String(cells["Mã bãi"]).trim(),
            vehicle: String(
              cells["Loại xe"],
            ).trim() as DeclarationDraft["vehicle"],
            effective: dateValue(cells["Ngày áp dụng"]),
            month: dateValue(cells["Tháng"]).slice(0, 7),
            design: String(cells["Quy hoạch"] ?? ""),
            planned: String(cells["Kế hoạch"] ?? ""),
            actual: String(cells["Thực tế"] ?? ""),
            charging: String(cells["Chỗ sạc"] || "0"),
            hours: String(cells["Giờ đỗ kế hoạch"] ?? ""),
          }
          const errors = validateDeclaration(importKind, draft, checked, access)
          const dataErrors = Object.entries(errors)
            .filter(([key]) => key !== "duplicate")
            .map(([, message]) => message)
          const status = dataErrors.length
            ? "Lỗi dữ liệu"
            : errors.duplicate
              ? "Trùng lặp"
              : "Hợp lệ"
          if (status === "Hợp lệ")
            checked = {
              ...checked,
              [importKind]: [
                ...checked[importKind],
                fromDraft(importKind, draft, actor, "", String(i)),
              ],
            }
          return {
            index: i + 2,
            cells,
            draft,
            status,
            message: dataErrors.join(" · ") || errors.duplicate || "",
          }
        }),
      )
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Không thể đọc file.",
      )
    } finally {
      setReading(false)
    }
  }
  const accepted = batch.filter((row) => row.status === "Hợp lệ")
  const failed = batch.filter((row) => row.status !== "Hợp lệ")
  const saveBatch = () => {
    if (!importKind || !accepted.length) return
    const success = save((latest) => {
      let next = latest
      for (const { draft } of accepted) {
        if (
          Object.keys(validateDeclaration(importKind, draft, next, access))
            .length
        )
          throw new Error(
            "Dữ liệu đã được cập nhật. Vui lòng kiểm tra lại file.",
          )
        next = changeEntry(
          next,
          fromDraft(
            importKind,
            draft,
            actor,
            minuteIso(vnNow()),
            crypto.randomUUID(),
          ),
          "Tải lên khai báo",
        )
      }
      return next
    })
    if (success) {
      setUpload(false)
      setSelectedFile(null)
      notify(`Đã lưu ${fmt(accepted.length)} dòng hợp lệ.`)
    }
  }
  const history = settings.history.filter(
    (item) =>
      item.kind &&
      tabs.includes(item.kind) &&
      (!item.scope ||
        ((!access.estate || item.scope === access.estate) &&
          (!estate || item.scope === estate))),
  )
  return (
    <>
      <ParkingHeading
        title={title}
        group={configuration ? "Cấu hình" : "Quản lý chỗ đỗ"}
        cutoff={cutoff}
        actions={
          <>
            {editable && importKind && (
              <Button
                onClick={() => {
                  setBatch([])
                  setUploadError("")
                  setSelectedFile(null)
                  setUpload(true)
                }}
              >
                <Upload size={15} /> Tải lên
              </Button>
            )}
            {canExport(access) && (
              <ExportButton
                onClick={() =>
                  exportFile(
                    configuration ? "ThamSoChoDo" : "SucChuaVaKeHoach",
                    () => ({ [declarationLabels[kind]]: rows.map(exportData) }),
                    rows.length,
                  )
                }
              />
            )}
            {editable && (
              <Button variant="primary" onClick={() => start()}>
                <Plus size={15} /> Thêm mới
              </Button>
            )}
          </>
        }
      />
      {kind === "thresholds" && (
        <div className="parking-banner">
          Khu đô thị chưa khai báo ngưỡng riêng dùng mặc định 72 giờ.
        </div>
      )}
      <div className="panel">
        <ParkingTabs
          options={tabs.map((tab) => declarationLabels[tab])}
          value={declarationLabels[kind]}
          change={(value) =>
            update({
              configTab:
                tabs.find((tab) => declarationLabels[tab] === value) ?? null,
              configStatus: null,
              configVehicle: null,
              page: null,
            })
          }
        />
        <div className="parking-toolbar">
          <div className="parking-inline">
            {kind !== "holidays" && (
              <Select
                aria-label="Lọc khu đô thị"
                value={estate}
                options={[
                  allOption("Tất cả khu đô thị"),
                  ...estateOptions.map((item) => ({
                    value: item.id,
                    label: item.name,
                  })),
                ]}
                onChange={(e) =>
                  update({ configEstate: e.target.value, page: null })
                }
              />
            )}
            <ParkingSearch
              placeholder={
                kind === "holidays"
                  ? "Tìm tên ngày lễ tết"
                  : configuration
                    ? "Tìm khu đô thị"
                    : "Tìm tên bãi xe"
              }
              value={search}
              change={(q) => update({ q, page: null })}
            />
          </div>
          <div className="parking-inline">
            <Button
              onClick={() => {
                setHistoryPage(1)
                setDrawer("history")
              }}
            >
              <History size={15} /> Lịch sử thay đổi
            </Button>
            {kind !== "holidays" && (
              <Button onClick={() => setDrawer("filters")}>
                <ListFilter size={15} /> Bộ lọc
              </Button>
            )}
          </div>
        </div>
        <ParkingTable
          columns={table}
          rows={rows.slice((page - 1) * size, page * size)}
          rowKey={(row) => row.id}
          empty={
            search || estate || status || vehicle ? (
              <NoMatches
                clear={() =>
                  update({
                    q: null,
                    configEstate: null,
                    configStatus: null,
                    configVehicle: null,
                  })
                }
              />
            ) : (
              "Chưa có khai báo"
            )
          }
        />
        <ParkingPagination
          count={rows.length}
          page={page}
          size={size}
          change={(value) => update({ page: String(value) })}
          changeSize={(value) => update({ size: String(value), page: null })}
        />
      </div>
      {editor && (
        <Overlay title={editorTitle} onClose={close} footer={footer}>
          <Form onSubmit={saveForm}>{fields}</Form>
        </Overlay>
      )}
      {cancel && (
        <Overlay
          title="Hủy khai báo sắp áp dụng"
          onClose={() => setCancel(null)}
          footer={
            <>
              <Button autoFocus onClick={() => setCancel(null)}>
                Hủy
              </Button>
              <Button variant="primary" onClick={cancelRecord}>
                Xác nhận hủy khai báo
              </Button>
            </>
          }
        >
          Khai báo của <strong>{label(cancel)}</strong> từ{" "}
          {date(cancel.effective)} sẽ bị hủy. Khai báo có hiệu lực trước đó sẽ
          tiếp tục áp dụng.
        </Overlay>
      )}
      {drawer === "filters" && (
        <Overlay
          drawer
          title="Bộ lọc khai báo"
          onClose={() => setDrawer(null)}
          footer={<Button onClick={() => setDrawer(null)}>Đóng</Button>}
        >
          <div className="parking-drawer-fields">
            <Field label="Trạng thái">
              <Select
                value={status}
                options={[allOption("Tất cả"), ...statuses]}
                onChange={(e) =>
                  update({ configStatus: e.target.value, page: null })
                }
              />
            </Field>
            {importKind && (
              <Field label="Loại xe">
                <Select
                  value={vehicle}
                  options={[
                    allOption("Tất cả"),
                    ...parkingVehicles.slice(0, 3),
                  ]}
                  onChange={(e) =>
                    update({ configVehicle: e.target.value, page: null })
                  }
                />
              </Field>
            )}
            <Button
              onClick={() =>
                update({ configStatus: null, configVehicle: null, page: null })
              }
            >
              Xóa bộ lọc
            </Button>
          </div>
        </Overlay>
      )}
      {drawer === "history" && (
        <Overlay
          drawer
          title="Lịch sử thay đổi"
          onClose={() => setDrawer(null)}
        >
          {history
            .slice((historyPage - 1) * historySize, historyPage * historySize)
            .map((item) => (
              <div className="parking-history-entry" key={item.id}>
                <strong>
                  {item.action} · {item.detail}
                </strong>
                <span>
                  {item.actor} · {date(item.at.slice(0, 10))}{" "}
                  {item.at.slice(11, 16)}
                </span>
                {item.before && (
                  <div>
                    <span className="muted">Trước</span>{" "}
                    {historyValue(item.before)}
                  </div>
                )}
                {item.after && (
                  <div>
                    <span className="muted">Sau</span>{" "}
                    {historyValue(item.after)}
                  </div>
                )}
              </div>
            ))}
          {!history.length && (
            <div className="parking-empty">Chưa có thay đổi</div>
          )}
          <ParkingPagination
            count={history.length}
            page={historyPage}
            size={historySize}
            change={setHistoryPage}
            changeSize={(size) => {
              setHistorySize(size)
              setHistoryPage(1)
            }}
          />
        </Overlay>
      )}
      {upload && importKind && (
        <Overlay
          wide
          title={`Tải lên ${declarationLabels[importKind].toLowerCase()}`}
          onClose={close}
          footer={
            <>
              <Button onClick={close}>Hủy</Button>
              <Button disabled={!selectedFile || reading} onClick={checkFile}>
                {reading ? "Đang kiểm tra…" : "Kiểm tra file"}
              </Button>
              <Button
                variant="primary"
                disabled={!accepted.length || reading}
                onClick={saveBatch}
              >
                Xác nhận tải lên
              </Button>
            </>
          }
        >
          <div className="parking-inline parking-upload">
            <Field label="Tệp khai báo">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] ?? null)
                  setBatch([])
                  setUploadError("")
                }}
              />
            </Field>
            <TextLink
              onClick={() =>
                exportFile("MauKhaiBao", () => ({
                  Mẫu: [
                    Object.fromEntries(
                      excelColumns[importKind].map((label) => [label, ""]),
                    ),
                  ],
                  "Mã bãi": sites.map((site) => ({
                    "Mã bãi": site.id,
                    "Bãi xe": site.label,
                  })),
                }))
              }
            >
              Tải file mẫu
            </TextLink>
          </div>
          {uploadError && (
            <p className="field-message" role="alert">
              {uploadError}
            </p>
          )}
          {batch.length > 0 && (
            <>
              <div className="parking-toolbar">
                <div className="parking-inline">
                  <Badge tone="green">Hợp lệ {fmt(accepted.length)}</Badge>
                  <Badge tone="red">
                    Lỗi dữ liệu{" "}
                    {fmt(
                      batch.filter((row) => row.status === "Lỗi dữ liệu")
                        .length,
                    )}
                  </Badge>
                  <Badge tone="amber">
                    Trùng lặp{" "}
                    {fmt(
                      batch.filter((row) => row.status === "Trùng lặp").length,
                    )}
                  </Badge>
                </div>
                {failed.length > 0 && (
                  <TextLink
                    onClick={() =>
                      exportFile(
                        "LoiKhaiBao",
                        () => ({
                          "Dòng lỗi": failed.map((row) => ({
                            ...row.cells,
                            Dòng: row.index,
                            Lỗi: row.message,
                          })),
                        }),
                        failed.length,
                      )
                    }
                  >
                    Tải file lỗi
                  </TextLink>
                )}
              </div>
              <ParkingTable
                rows={batch}
                rowKey={(row) => String(row.index)}
                columns={[
                  { label: "Dòng", cell: (row) => row.index },
                  {
                    label: "Bãi xe",
                    cell: (row) =>
                      siteById(row.draft.site)?.label || row.draft.site || "—",
                  },
                  { label: "Loại xe", cell: (row) => row.draft.vehicle },
                  { label: "Kết quả", cell: (row) => row.status },
                  { label: "Diễn giải", cell: (row) => row.message || "—" },
                ]}
              />
            </>
          )}
        </Overlay>
      )}
      {discard && (
        <Discard
          onStay={() => setDiscard(false)}
          onLeave={() => {
            setDiscard(false)
            setEditor(null)
            setUpload(false)
            setSelectedFile(null)
          }}
        />
      )}
    </>
  )
}
function historyValue(row: Declaration): ReactNode {
  if (row.canceled) return "Đã hủy"
  const effective = date(row.effective)
  if ("design" in row)
    return `${row.vehicle} · QH ${fmt(row.design)} · KH ${fmt(row.planned)} · TT ${fmt(row.actual)} · Sạc ${fmt(row.charging)} · ${effective}`
  if ("month" in row)
    return `${row.vehicle} · ${row.month} · ${numberText(row.hours)} giờ · ${effective}`
  if ("shifts" in row)
    return `${row.from}–${row.to} · ${row.shifts.map((shift) => `${shift.name} ${shift.from}–${shift.to}`).join(", ")} · ${effective}`
  if ("approval" in row)
    return `${row.hours} giờ · PD ${row.approval} · ${effective}${
      row.note ? ` · ${row.note}` : ""
    }`
  return `${row.name} · ${effective}${row.substitute ? " · Nghỉ bù" : ""}`
}
function Discard({
  onStay,
  onLeave,
}: {
  onStay: () => void
  onLeave: () => void
}) {
  return (
    <Overlay
      title="Bạn có thay đổi chưa lưu"
      dismissOnBackdrop={false}
      onClose={onStay}
      footer={
        <>
          <Button autoFocus onClick={onStay}>
            Ở lại
          </Button>
          <Button variant="primary" onClick={onLeave}>
            Bỏ thay đổi
          </Button>
        </>
      }
    >
      Rời đi sẽ mất các thay đổi này.
    </Overlay>
  )
}
