import { date, fmt } from "./data"
import { dayMinutes, dayStart, displayTime, siteById } from "./parking-model"
import type { ParkingSettings } from "./parking-model"
import type { ExportRow } from "./parking-ui"
import { amountKeys, amountLabels, closeStatus, configAt, dateCell, revenueUnits, estateName, lossReasons, methods, revenueShifts, sources, timestampCell, totals } from "./revenue-model"
import type { AmountKey, LedgerRow, RevenueChange, RevenueState, SubscriptionRevenue } from "./revenue-model"

export const money = (amount: number) => `${fmt(amount)} ₫`
export const percentage = (amount: number, total: number) => total ? `${(amount / total * 100).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}%` : "—"
export const amountColumn = (key: AmountKey) => `${amountLabels[key]} (₫)`
export const selectAmounts = (values: ReturnType<typeof totals>, keys: readonly AmountKey[]) =>
  Object.fromEntries(keys.map((key) => [amountColumn(key), values[key]]))
export const methodColumns = (values: ReturnType<typeof totals>) =>
  Object.fromEntries(methods.map((method, i) => [`${method} (₫)`, values.moneyByMethod[i]]))
export const groupRows = <T,>(rows: T[], key: (row: T) => string) => {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const id = key(row)
    const group = groups.get(id)
    if (group) group.push(row)
    else groups.set(id, [row])
  }
  return groups
}
export const sourceRow = (name: string, rows: LedgerRow[], source?: string): ExportRow => {
  const summary = totals(rows, true)
  return { "Đơn vị / nguồn thu": name, "Số lượt": summary.count,
    "Số biên bản / phiếu": source === "MT" || source === "CT" ? rows.length : null,
    ...selectAmounts(summary, ["gross", "reduction", "revenue", "net", "vat", "paid", "debt", "lost", "excess"]),
    ...methodColumns(summary), [amountColumn("collected")]: summary.collected, "Còn phải thu (₫)": summary.debt + summary.lost }
}
export const dayRow = (label: string, rows: LedgerRow[], status: string): ExportRow => {
  const summary = totals(rows)
  return { "Ngày doanh thu / ca": label, [amountColumn("revenue")]: summary.revenue, ...methodColumns(summary),
    "Voucher (₫)": summary.debt, ...selectAmounts(summary, ["lost", "excess"]), "Trạng thái chốt": status }
}
export const lossRow = (label: string, rows: LedgerRow[]): ExportRow => {
  const summary = totals(rows)
  return { "Đơn vị": label, ...selectAmounts(summary, ["revenue", "lost"]), "Tỷ lệ thất thu": percentage(summary.lost, summary.revenue),
    ...Object.fromEntries(lossReasons.map((reason) => [`${reason} (₫)`, totals(rows.filter((row) => row.reason === reason)).lost])),
    [amountColumn("excess")]: summary.excess }
}
export function discountRows(rows: LedgerRow[], state: RevenueState, split = false) {
  const result: { label: string; code: string; estate?: string; rows: LedgerRow[]; data: ExportRow }[] = []
  const codes = new Map<string, LedgerRow[]>()
  for (const row of rows) for (const code of new Set(row.discounts.map((item) => item.code))) {
    const group = codes.get(code)
    if (group) group.push(row)
    else codes.set(code, [row])
  }
  for (const [code, matching] of codes) {
    const policy = state.policies.find((row) => row.code === code)
    const applied = state.voucherWorkspace?.applications.find((row) => row.code === code && row.purpose === "VCR_DISCOUNT")
    const label = policy?.name ?? applied?.sourceName ?? "Chưa xác định chính sách"
    const groups = split ? groupRows(matching, (row) => row.estate) : new Map([["", matching]])
    for (const [estate, scope] of groups) {
      const amount = scope.reduce((sum, row) => sum + row.discounts.filter((item) => item.code === code).reduce((total, item) => total + item.amount, 0), 0)
      result.push({ label, code, estate, rows: scope, data: {
        "Mã chính sách": code, "Chính sách": label, ...(split ? { "Khu đô thị": estateName(estate) } : {}),
        "Bên chịu chi phí": policy?.payer || (applied ? "VCR" : "—"), "Số lượt": scope.length,
        "Miễn toàn bộ": scope.filter((row) => row.source === "FREE").length,
        "Giá niêm yết (₫)": totals(scope, true).gross, "Miễn / giảm (₫)": amount,
        "Cần kiểm tra": code === "CS-01" ? scope.filter((row) => row.discounts.some((item) => item.code === code && item.review)).length : null,
        "Hiệu lực đến": policy?.until ? dateCell(policy.until) : null,
      } })
    }
  }
  return result.sort((a, b) => Number(b.data["Miễn / giảm (₫)"]) - Number(a.data["Miễn / giảm (₫)"]))
}
export function balances(all: LedgerRow[], selected: LedgerRow[], state: RevenueState, cutoff: string) {
  const selectedIds = new Set(selected.map((row) => row.id))
  const allocated = new Map<string, number>()
  const byUnit = groupRows(all.filter((row) => row.debt > 0 && row.voucher && row.revenueDay <= cutoff), (row) => row.voucher!.unit)
  for (const [unit, rows] of byUnit) {
    const claims = [...rows].sort((a, b) => a.revenueDay.localeCompare(b.revenueDay) || a.at - b.at || a.id.localeCompare(b.id))
    const payments = state.payments.filter((row) => row.unit === unit && !row.canceled && row.day <= cutoff).sort((a, b) => a.at - b.at)
    for (const payment of payments) {
      let remaining = payment.amount
      for (const claim of claims) {
        if (!remaining) break
        if (payment.month && !claim.revenueDay.startsWith(payment.month)) continue
        const paid = allocated.get(claim.id) ?? 0
        const amount = Math.min(remaining, claim.debt - paid)
        allocated.set(claim.id, paid + amount)
        remaining -= amount
      }
    }
  }
  return [...byUnit].flatMap(([unit, allRows]) => {
    const rows = allRows.filter((row) => selectedIds.has(row.id))
    if (!rows.length) return []
    const meta = rows[0].voucher?.recipient ?? revenueUnits(state).find((item) => item.id === unit)
    const amounts = rows.map((row) => {
      const paid = allocated.get(row.id) ?? 0
      const age = (dayStart(cutoff) - dayStart(row.revenueDay)) / dayMinutes
      return { row, paid, remaining: row.debt - paid, overdue: age > configAt(state, row.estate, cutoff).overdue }
    })
    const paid = amounts.reduce((sum, item) => sum + item.paid, 0)
    const incurred = totals(rows).debt
    return [{ id: unit, estate: rows[0].estate, name: meta?.name ?? "Chưa xác định đơn vị", type: meta?.type ?? "Chưa xác định",
      contract: meta?.contract ?? "", rows, amounts, incurred, paid, remaining: incurred - paid,
      overdue: amounts.reduce((sum, item) => sum + (item.overdue ? item.remaining : 0), 0),
      last: state.payments.filter((row) => !row.canceled && row.unit === unit && row.day <= cutoff).map((row) => row.day).sort().slice(-1)[0],
    }]
  }).sort((a, b) => b.remaining - a.remaining)
}
export type Balance = ReturnType<typeof balances>[number]
export const voucherDebtMeasures = { debt: "Công nợ phát sinh", debtPaid: "Voucher đã trả", debtRemaining: "Voucher còn nợ", overdue: "Voucher quá hạn", inTerm: "Voucher trong hạn" } as const
export type VoucherDebtMeasure = keyof typeof voucherDebtMeasures
export const voucherDebtValue = (row: Balance, measure: VoucherDebtMeasure) => measure === "debt" ? row.incurred : measure === "debtPaid" ? row.paid : measure === "overdue" ? row.overdue : measure === "inTerm" ? row.remaining - row.overdue : row.remaining
export const debtRow = (row: Balance): ExportRow => ({
  "Đơn vị": row.name, "Khu đô thị": estateName(row.estate), "Loại đơn vị": row.type, "Hợp đồng": row.contract,
  "Loại voucher": [...new Set(row.rows.map((item) => item.voucher?.negative ? "Vé âm" : "Thu lại tiền"))].join(" · "), "Số lượt": row.rows.length,
  "Phát sinh (₫)": row.incurred, "Đã trả (₫)": row.paid, "Còn nợ (₫)": row.remaining, "Quá hạn (₫)": row.overdue,
  "Lần trả gần nhất": dateCell(row.last ?? ""),
})
export function subscriptionRow(label: string, rows: SubscriptionRevenue[]): ExportRow {
  const gross = rows.reduce((sum, row) => sum + row.gross, 0)
  const net = rows.reduce((sum, row) => sum + Math.round(row.gross / 1.1), 0)
  const paid = rows.reduce((sum, row) => sum + (row.paid ? row.gross : 0), 0)
  return { "Nhóm thuê bao": label, "Số thuê bao": rows.length, "Chưa VAT (₫)": net, "VAT (₫)": gross - net,
    "Doanh thu (₫)": gross, "Đã thu (₫)": paid, "Chưa thu (₫)": gross - paid }
}
export function ledgerRow(row: LedgerRow, state: RevenueState): ExportRow {
  return { "Mã lượt / khoản thu": row.id, "Giờ ra / lập": timestampCell(row.at), "Khu đô thị": estateName(row.estate),
    "Bãi xe": siteById(row.site)?.name, "Làn ra": row.trip?.laneOut, "Loại xe": row.vehicle,
    "Biển số": row.trip?.plate || row.trip?.ticket || row.id, "Nguồn thu": sources[row.source],
    "Số lượt": row.count, "Doanh thu (₫)": row.revenue, "Đã thu (₫)": row.paid, "Còn phải thu (₫)": row.debt + row.lost,
    "Loại / lý do": [row.debt ? row.voucher?.recipient?.name ?? revenueUnits(state).find((unit) => unit.id === row.voucher?.unit)?.name ?? "Công nợ voucher" : "", row.lost ? row.reason ?? "Không xác định" : ""].filter(Boolean).join(" · "),
    "Ngày doanh thu": dateCell(row.revenueDay), "Ca": row.shiftName,
    "Giờ vào": row.trip ? timestampCell(row.trip.entered) : null, "Nhóm khách": row.trip?.group,
    "Mã thẻ / vé": row.trip?.ticket, "Nguồn ghi nhận": row.trip?.sourceOut, "Giá niêm yết (₫)": row.gross,
    "Miễn / giảm (₫)": row.reduction, "Chưa VAT (₫)": row.net, "VAT (₫)": row.vat, ...methodColumns(row),
    "Tiền thực nhận (₫)": row.collected, "Công nợ (₫)": row.debt, "Thất thu (₫)": row.lost, "Thu thừa (₫)": row.excess,
    "Mã voucher": row.voucher?.code, "Mã giao dịch": row.payments.map((payment) => payment.id).join(", "),
    "Trạng thái chốt": state.periods[`${row.estate}/${row.revenueDay.slice(0, 7)}`] ? "Đã chốt kỳ" : state.closes[row.shiftId] ? "Đã chốt" : "Tạm tính",
    "Cờ": row.missing ? "Thiếu dữ liệu miễn / giảm" : row.lost ? "Ra không thu đủ" : "",
  }
}
export const changeRow = (row: RevenueChange): ExportRow => ({
  "Ngày ghi nhận": dateCell(row.recorded), "Kỳ điều chỉnh": row.recorded.slice(0, 7),
  "Ngày doanh thu gốc": dateCell(row.origin), "Kỳ phát sinh": row.origin.slice(0, 7), "Khu đô thị": estateName(row.estate),
  "Giao dịch gốc": row.reference, "Lý do": row.reason, ...selectAmounts(row.delta, amountKeys), "Người thực hiện": row.actor,
})
export function dayStatus(state: RevenueState, settings: ParkingSettings, estate: string, day: string, sites: string[]) {
  return closeStatus(state, estate, day, sites.flatMap((site) => revenueShifts(site, day, settings, state)))
}
export function formatCell(value: ExportRow[string]) {
  if (value instanceof Date) return displayTime(value.getTime() / 60000).replace(/ 00:00$/, "")
  if (typeof value === "number") return fmt(value)
  if (typeof value === "boolean") return value ? "Có" : "—"
  return value || "—"
}
export const dateSpan = (start: string, end: string) => `${date(start)} – ${date(end)}`
