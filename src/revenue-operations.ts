import { dayAt, dayStart, isDay, siteById, vnNow } from "./parking-model"
import type { ParkingSettings, Trip } from "./parking-model"
import { parkingFeeQuoteError } from "./parking-fees"
import { auditRevenue, buildLedger, methods, recordChange } from "./revenue-model"
import type { Charge, LedgerRow, RevenueState } from "./revenue-model"

export type RevenueSave = (change: (latest: RevenueState) => RevenueState) => boolean
export function changeLedger(
  previous: RevenueState, next: RevenueState, trips: Trip[], parking: ParkingSettings,
  ids: string[], reason: string, actor: string, adjustmentAllowed: boolean,
  incidentChanges?: { before: Charge[]; after: Charge[] },
) {
  const match = new Set(ids)
  const before = new Map(buildLedger(trips, parking, { ...previous, closes: {} }, incidentChanges?.before).filter((row) => match.has(row.id)).map((row) => [row.id, row]))
  const after = new Map(buildLedger(trips, parking, { ...next, closes: {} }, incidentChanges?.after).filter((row) => match.has(row.id)).map((row) => [row.id, row]))
  for (const id of ids) {
    const oldRow = before.get(id), newRow = after.get(id)
    const closed = (row?: LedgerRow) => row && (previous.closes[row.shiftId] || previous.periods[`${row.estate}/${row.revenueDay.slice(0, 7)}`])
    if (!closed(oldRow) && !closed(newRow)) continue
    if (!adjustmentAllowed) throw new Error("Ca đã chốt. Bạn cần quyền Điều chỉnh sau chốt.")
    next = recordChange(next, oldRow, newRow, reason, actor)
  }
  return next
}
export function applyRevenueTrip(
  state: RevenueState, original: Trip | undefined, trip: Trip, reason: string,
  trips: Trip[], parking: ParkingSettings, actor: string, adjustmentAllowed: boolean,
) {
  if (trip.supplementalBilling) {
    const error = parkingFeeQuoteError(trip.supplementalBilling, Date.now(), false)
    if (error) throw new Error(error)
  }
  if (trip.supplementalExit && (
    !trip.supplementalExit.reference.trim() || !methods.includes(trip.supplementalExit.method) ||
    !Number.isFinite(trip.entered) || trip.exited === null || !Number.isFinite(trip.exited) ||
    trip.exited <= trip.entered || trip.exited > vnNow() || trip.due === null || trip.paid === null ||
    !Number.isSafeInteger(trip.due) || trip.due < 0 || !Number.isSafeInteger(trip.paid) || trip.paid < 0
  )) throw new Error("Kiểm tra giờ ra, biên bản và số tiền đã thu.")
  const prior = state.tripUpdates.find((row) => row.trip.id === trip.id)
  if (prior && JSON.stringify(prior.trip) !== JSON.stringify(original))
    throw new Error("Lượt vừa được cập nhật. Vui lòng tải lại.")
  const at = vnNow()
  const updated = {
    ...trip, actions: [...trip.actions ?? [], { at, actor, title: "CSKH bổ sung / sửa lượt", reason }],
  }
  const next = { ...state, tripUpdates: [
    { trip: updated, original: prior?.original ?? original, at, reason },
    ...state.tripUpdates.filter((row) => row.trip.id !== trip.id),
  ] }
  const changed = changeLedger(state, next, trips, parking, [trip.id], reason, actor, adjustmentAllowed)
  return auditRevenue(changed, actor, "CSKH bổ sung / sửa lượt", siteById(trip.site)?.estate ?? "", `${trip.id} · ${reason}`)
}
export const isPositiveMoney = (value: string | number) => Number.isSafeInteger(Number(value)) && Number(value) > 0
export const referencePattern = /^[A-Za-z0-9_-]{1,255}$/
export const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
export const validDayUntil = (day: string, max = dayAt(vnNow())) => isDay(day) && day <= max
