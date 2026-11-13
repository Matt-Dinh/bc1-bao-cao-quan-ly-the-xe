import { estates } from "./data"
import {
  allowedSites,
  canConfigure,
  canDeclare,
  declarationStatus,
  effectiveRecord,
  isDay,
  keyFor,
  parkingVehicles,
  shiftDay,
  timeSpan,
  vnToday,
} from "./parking-model"
import type {
  Declaration,
  DeclarationKind,
  ParkingAccess,
  ParkingSettings,
  Shift,
  Vehicle,
} from "./parking-model"

export const declarationLabels: Record<DeclarationKind, string> = {
  capacities: "Sức chứa",
  plans: "Kế hoạch giờ đỗ",
  schedules: "Giờ khai thác và ca trực",
  thresholds: "Ngưỡng cảnh báo",
  holidays: "Ngày lễ tết",
}
export interface DeclarationDraft {
  site: string
  vehicle: Vehicle
  estate: string
  effective: string
  month: string
  design: string
  actual: string
  planned: string
  charging: string
  hours: string
  from: string
  to: string
  shifts: Shift[]
  approval: string
  note: string
  name: string
  substitute: boolean
}
const allowedTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
const whole = (value: string) =>
  /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value))
export function newDraft(site = "", estate = ""): DeclarationDraft {
  const tomorrow = shiftDay(vnToday(), 1)
  return {
    site,
    estate,
    effective: tomorrow,
    month: tomorrow.slice(0, 7),
    vehicle: "Ô tô",
    design: "",
    actual: "",
    planned: "",
    charging: "0",
    hours: "",
    from: "",
    to: "",
    shifts: [{ name: "Ca 1", from: "", to: "" }],
    approval: "",
    note: "",
    name: "",
    substitute: false,
  }
}
export function editDraft(row: Declaration): DeclarationDraft {
  const draft = { ...newDraft(), ...row }
  return {
    ...draft,
    design: "design" in row ? String(row.design) : "",
    actual: "actual" in row ? String(row.actual) : "",
    planned: "planned" in row ? String(row.planned) : "",
    charging: "charging" in row ? String(row.charging) : "0",
    hours: "hours" in row ? String(row.hours) : "",
    shifts:
      "shifts" in row
        ? row.shifts.map((shift) => ({ ...shift }))
        : draft.shifts,
  }
}
export const declarationScope = (row: Declaration) =>
  "site" in row ? row.site.split(":")[0] : "estate" in row ? row.estate : ""

export function validateDeclaration(
  kind: DeclarationKind,
  draft: DeclarationDraft,
  settings: ParkingSettings,
  access: ParkingAccess,
  id?: string,
  today = vnToday(),
) {
  const errors: Partial<Record<keyof DeclarationDraft | "duplicate" | "permission", string>> =
    {}
  const operational =
    kind === "capacities" || kind === "plans" || kind === "schedules"
  if (!(operational ? canDeclare(access) : canConfigure(access)))
    errors.permission = "Bạn không có quyền khai báo."
  if (
    operational &&
    !allowedSites(access).some((site) => site.id === draft.site)
  )
    errors.site = "Vui lòng chọn bãi xe trong phạm vi quyền."
  if (
    kind === "thresholds" &&
    !estates.some(
      (estate) =>
        estate.id === draft.estate &&
        (!access.estate || access.estate === estate.id),
    )
  )
    errors.estate = "Vui lòng chọn khu đô thị."
  if (!isDay(draft.effective)) errors.effective = "Vui lòng chọn ngày áp dụng."
  else if (kind !== "holidays" && draft.effective <= today)
    errors.effective = `Ngày áp dụng phải từ ${shiftDay(today, 1).split("-").reverse().join("/")} trở đi.`
  if (kind === "capacities" || kind === "plans") {
    if (!parkingVehicles.slice(0, 3).includes(draft.vehicle))
      errors.vehicle = "Vui lòng chọn loại xe."
  }
  if (kind === "capacities") {
    const fields =
      draft.vehicle === "Ô tô"
        ? ["design", "planned", "actual", "charging"] as const
        : ["design", "planned", "actual"] as const
    for (const key of fields)
      if (!whole(draft[key])) errors[key] = "Nhập số nguyên không âm."
    if (
      !errors.planned &&
      !errors.design &&
      Number(draft.planned) > Number(draft.design)
    )
      errors.planned = "Số chỗ kế hoạch không được vượt số chỗ quy hoạch."
    if (
      !errors.actual &&
      !errors.design &&
      Number(draft.actual) > Number(draft.design)
    )
      errors.actual = `Số chỗ thực tế không được vượt số chỗ quy hoạch (${draft.design}).`
    if (
      draft.vehicle === "Ô tô" &&
      !errors.charging &&
      !errors.actual &&
      Number(draft.charging) > Number(draft.actual)
    )
      errors.charging = "Số chỗ sạc không được vượt số chỗ thực tế."
  }
  if (kind === "plans") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.month))
      errors.month = "Vui lòng chọn tháng."
    else if (draft.effective.slice(0, 7) !== draft.month)
      errors.effective = "Ngày áp dụng phải nằm trong tháng kế hoạch."
    if (!whole(draft.hours)) errors.hours = "Nhập số nguyên không âm."
  }
  if (kind === "schedules") {
    if (!allowedTime(draft.from)) errors.from = "Vui lòng nhập giờ bắt đầu."
    if (!allowedTime(draft.to)) errors.to = "Vui lòng nhập giờ kết thúc."
    if (!errors.from && !errors.to && timeSpan(draft.from, draft.to) < 60)
      errors.to = "Giờ khai thác phải từ 1 đến 24 giờ."
    if (
      draft.shifts.length < 1 ||
      draft.shifts.length > 4 ||
      draft.shifts.some(
        (shift) =>
          !shift.name.trim() ||
          !allowedTime(shift.from) ||
          !allowedTime(shift.to),
      )
    ) {
      errors.shifts = "Nhập đủ tên và giờ cho 1 đến 4 ca trực."
    } else if (
      draft.shifts.some(
        (shift, index) =>
          shift.to !== draft.shifts[(index + 1) % draft.shifts.length].from,
      ) ||
      draft.shifts.reduce(
        (total, shift) => total + timeSpan(shift.from, shift.to),
        0,
      ) !== 1440
    ) {
      errors.shifts = "Các ca phải nối tiếp, phủ đủ 24 giờ và không chồng nhau."
    }
  }
  if (kind === "thresholds") {
    if (
      !whole(draft.hours) ||
      Number(draft.hours) < 1 ||
      Number(draft.hours) > 720
    )
      errors.hours = "Ngưỡng phải từ 1 đến 720 giờ."
    if (!draft.approval.trim()) errors.approval = "Vui lòng nhập số phê duyệt."
    else if (!/^[a-zA-Z0-9_-]{1,255}$/.test(draft.approval.trim()))
      errors.approval = "Số PD chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới."
    if (draft.note.length > 500) errors.note = "Ghi chú tối đa 500 ký tự."
  }
  if (kind === "holidays" && (!draft.name.trim() || draft.name.length > 255))
    errors.name = "Vui lòng nhập tên ngày lễ, tối đa 255 ký tự."
  const row = fromDraft(kind, draft, "", "", id ?? "")
  if (
    settings[kind].some(
      (item) =>
        item.id !== id &&
        !item.canceled &&
        keyFor(item) === keyFor(row) &&
        (kind === "plans" || item.effective === row.effective),
    )
  )
    errors.duplicate = "Khai báo trùng với dữ liệu đã có."
  return errors
}
export function fromDraft(
  kind: DeclarationKind,
  draft: DeclarationDraft,
  actor: string,
  updated: string,
  id: string,
): Declaration {
  const version = { id, effective: draft.effective, actor, updated }
  switch (kind) {
    case "capacities":
      return {
        ...version,
        site: draft.site,
        vehicle: draft.vehicle,
        design: Number(draft.design),
        actual: Number(draft.actual),
        planned: Number(draft.planned),
        charging: draft.vehicle === "Ô tô" ? Number(draft.charging) : 0,
      }
    case "plans":
      return {
        ...version,
        site: draft.site,
        vehicle: draft.vehicle,
        month: draft.month,
        hours: Number(draft.hours),
      }
    case "schedules":
      return {
        ...version,
        site: draft.site,
        from: draft.from,
        to: draft.to,
        shifts: draft.shifts.map((shift) => ({
          ...shift,
          name: shift.name.trim(),
        })),
      }
    case "thresholds":
      return {
        ...version,
        estate: draft.estate,
        hours: Number(draft.hours),
        approval: draft.approval.trim(),
        note: draft.note.trim(),
      }
    case "holidays":
      return {
        ...version,
        name: draft.name.trim(),
        substitute: draft.substitute,
      }
  }
}
export function canEditRecord(
  kind: DeclarationKind,
  row: Declaration,
  settings: ParkingSettings,
  access: ParkingAccess,
  today = vnToday(),
) {
  const scope = declarationScope(row)
  const allowed =
    kind === "thresholds" || kind === "holidays"
      ? canConfigure(access)
      : canDeclare(access)
  return (
    allowed &&
    !row.canceled &&
    (!scope || !access.estate || scope === access.estate) &&
    (kind === "holidays" ||
      declarationStatus(row, settings[kind], today) === "Sắp áp dụng")
  )
}
export function planWarning(
  draft: DeclarationDraft,
  settings: ParkingSettings,
) {
  if (
    !isDay(draft.effective) ||
    !whole(draft.hours) ||
    !/^\d{4}-\d{2}$/.test(draft.month)
  )
    return ""
  const days = new Date(
    Date.UTC(
      Number(draft.month.slice(0, 4)),
      Number(draft.month.slice(5, 7)),
      0,
    ),
  ).getUTCDate()
  let max = 0
  for (let day = 1; day <= days; day++) {
    const date = `${draft.month}-${String(day).padStart(2, "0")}`
    const capacity = effectiveRecord(
      settings.capacities,
      `${draft.site}/${draft.vehicle}`,
      date,
    )
    const schedule = effectiveRecord(settings.schedules, draft.site, date)
    if (!capacity || !schedule) return ""
    max += (capacity.planned * timeSpan(schedule.from, schedule.to)) / 60
  }
  return Number(draft.hours) > max
    ? "Kế hoạch vượt giờ đỗ tối đa của tháng. Bạn vẫn có thể lưu."
    : ""
}
