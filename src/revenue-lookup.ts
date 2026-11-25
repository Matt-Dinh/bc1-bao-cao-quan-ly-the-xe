import { normalize } from "./data"
import { chargeMatches, revenueUnits, amountKeys, amountLabels, methods, scopeRows, subscriptionRevenue } from "./revenue-model"
import type { AmountKey, LedgerRow, RevenueFilter, RevenueState } from "./revenue-model"
import type { ParkingAccess } from "./parking-model"
import { siteById } from "./parking-model"
import { balances, voucherDebtMeasures } from "./revenue-tables"
import { revenueMatches, revenueValues } from "./revenue-filter-values"

export type RevenueDrill = { label: string; source?: string; estate?: string; site?: string; vehicle?: string; day?: string; shift?: string; policy?: string; review?: string; reason?: string; unit?: string; unitType?: string; amount?: string; month?: string; group?: string; countOnly?: string; freeOnly?: string }
export const revenueLookupKeys = ["source", "amount", "balance", "shift", "policy", "review", "reason", "unit", "unitType", "month", "group", "countOnly", "freeOnly", "closeStatus"] as const
export type RevenueLookupKey = typeof revenueLookupKeys[number]
export const measureOptions = [
  ...amountKeys.map((value) => ({ value, label: amountLabels[value] })),
  ...methods.map((method) => ({ value: `${method} (₫)`, label: `Tiền thu · ${method}` })),
  { value: "receivedOrVoucher", label: "Tiền thực nhận và voucher" },
  { value: "receivable", label: "Còn phải thu" }, { value: "debtPaid", label: "Voucher đã trả" },
  { value: "debtRemaining", label: "Voucher còn nợ" }, { value: "inTerm", label: "Voucher trong hạn" },
  { value: "overdue", label: "Voucher quá hạn" }, { value: "subPaid", label: "Thuê bao đã thu" },
  { value: "subUnpaid", label: "Thuê bao chưa thu" },
]
export const revenueLookupReset = Object.fromEntries(revenueLookupKeys.map((key) => [key, null]))

export function revenueDebtPatch(filter: RevenueFilter, drill: RevenueDrill, cutoff: string): Record<string, string | null> | null {
  if (!Object.prototype.hasOwnProperty.call(voucherDebtMeasures, drill.amount || "") ||
    ["source", "shift", "policy", "review", "reason", "month", "group", "countOnly", "freeOnly"].some((key) => !!drill[key as keyof RevenueDrill])) return null
  return { ...revenueLookupPatch(filter, drill), amount: null, debtMeasure: drill.amount!, debtPeriod: "1", debtAsOf: cutoff }
}

// Promote report context into ordinary, editable URL filters. Legacy report links still open.
export function revenueLookupPatch(filter: RevenueFilter, drill: RevenueDrill): Record<string, string | null> {
  const site = drill.site || drill.shift?.split("/")[0] || filter.site
  return {
    ...revenueLookupReset, ...filter,
    estate: drill.estate || siteById(site)?.estate || filter.estate, site,
    vehicle: drill.vehicle === "*" ? "" : drill.vehicle || filter.vehicle,
    start: drill.day || filter.start, end: drill.day || filter.end,
    ...Object.fromEntries(revenueLookupKeys.filter((key) => key in drill).map((key) => [key, drill[key as keyof RevenueDrill] || null])),
    countOnly: drill.countOnly || (drill.label.endsWith("Số lượt") ? "1" : null),
    freeOnly: drill.freeOnly || (drill.label.endsWith("Miễn toàn bộ") ? "1" : null),
    drill: null, detail: null, page: null, q: null, tab: null,
  }
}
export function readRevenueLookup(params: URLSearchParams, filter: RevenueFilter) {
  let legacy: RevenueDrill | null = null
  try { const value = JSON.parse(params.get("drill") || "null"); if (typeof value?.label === "string") legacy = value } catch {}
  const values = legacy ? new URLSearchParams(Object.entries(revenueLookupPatch(filter, legacy)).filter((entry): entry is [string, string] => entry[1] !== null)) : new URLSearchParams()
  for (const [key, value] of params) if (key !== "drill") values.set(key, value)
  // The clicked report dimension takes priority for old links as it did in the report.
  if (legacy) for (const [key, value] of Object.entries(revenueLookupPatch(filter, legacy))) if (value !== null && !["q", "tab"].includes(key)) values.set(key, value)
  return values
}

export function selectRevenueLookup(ledger: LedgerRow[], state: RevenueState, filter: RevenueFilter, access: ParkingAccess, cutoff: string, params: URLSearchParams) {
  const values = readRevenueLookup(params, filter)
  const scope = { ...filter, ...Object.fromEntries(["estate", "site", "vehicle", "start", "end"].filter((key) => values.has(key)).map((key) => [key, values.get(key)!])) }
  const get = (key: string) => values.get(key) || ""
  const measure = get("amount"), query = get("q")
  const base = scopeRows(ledger, scope, access).filter((row) => {
    const unit = row.voucher?.recipient ?? revenueUnits(state).find((item) => item.id === row.voucher?.unit)
    const source = get("source"), balance = get("balance"), policy = get("policy")
    const closed = state.periods[`${row.estate}/${row.revenueDay.slice(0, 7)}`] ? "period" : state.closes[row.shiftId] ? "shift" : "open"
    return chargeMatches(row, query) &&
      (!source || revenueValues(source).some((value) => value === "included" ? row.source !== "SUB" && row.source !== "FREE" : row.source === value)) &&
      (!balance || (balance === "paid" && row.revenue > 0 && row.paid >= row.revenue) || (balance === "unpaid" && row.debt + row.lost > 0) ||
        (balance === "debt" && row.debt > 0) || (balance === "lost" && row.lost > 0) || (balance === "excess" && row.excess > 0) || (balance === "free" && row.source === "FREE")) &&
      revenueMatches(row.shiftId, get("shift")) && (!get("reason") || revenueMatches(row.reason, get("reason")) && row.lost > 0) &&
      revenueMatches(row.voucher?.unit, get("unit")) && revenueMatches(unit?.type, get("unitType")) &&
      (!policy || row.discounts.some((item) => revenueValues(policy).some((value) => value === "*" || item.code === value))) &&
      (!get("review") || row.discounts.some((item) => item.review && (!policy || revenueValues(policy).some((value) => value === "*" || item.code === value)))) &&
      (!get("countOnly") || row.count > 0) && (!get("freeOnly") || row.source === "FREE") &&
      (!get("closeStatus") || closed === get("closeStatus"))
  })
  const debtValues = ["debtPaid", "debtRemaining", "overdue", "inTerm"].includes(measure)
    ? new Map(balances(ledger, base, state, cutoff).flatMap((unit) => unit.amounts.map((item) => [item.row.id,
      measure === "debtPaid" ? item.paid : measure === "overdue" ? item.overdue ? item.remaining : 0 :
        measure === "inTerm" ? item.overdue ? 0 : item.remaining : item.remaining] as const))) : null
  const method = methods.findIndex((method) => `${method} (₫)` === measure)
  const valueFor = (row: LedgerRow) => {
    if (measure === "receivedOrVoucher") return row.collected + row.debt
    if (measure === "receivable") return row.debt + row.lost
    if (debtValues) return debtValues.get(row.id) ?? 0
    if (method >= 0) return row.moneyByMethod[method]
    if (measure === "reduction" && get("policy") && get("policy") !== "*")
      return row.discounts.filter((item) => revenueMatches(item.code, get("policy"))).reduce((sum, item) => sum + item.amount, 0)
    return amountKeys.includes(measure as AmountKey) ? row[measure as AmountKey] : 0
  }
  const list = base.filter((row) => !measure || measure === "gross" || valueFor(row) !== 0)
    .sort((a, b) => get("sort") === "old" ? a.at - b.at : get("sort") === "amount" ? b.revenue - a.revenue : b.at - a.at)
  const subscriptions = get("month") ? subscriptionRevenue(get("month"), scope, access)
    .filter((row) => revenueMatches(row.group, get("group")) &&
      (measure === "subPaid" ? row.paid : measure === "subUnpaid" ? !row.paid : true) &&
      (!query || normalize(`${row.id} ${row.customer}`).includes(normalize(query)))) : null
  const subscriptionValue = (row: NonNullable<typeof subscriptions>[number]) => {
    if (measure === "net") return Math.round(row.gross / 1.1)
    if (measure === "vat") return row.gross - Math.round(row.gross / 1.1)
    return row.gross
  }
  return { values, scope, measure, list, subscriptions, valueFor, subscriptionValue }
}
