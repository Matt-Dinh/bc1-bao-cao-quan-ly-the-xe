import type { LedgerRow, RevenueState } from "./revenue-model"
import { discountRows } from "./revenue-tables"

export type DiscountChartGroup = { key: string; label: string; value: number; codes: string[]; count: number }

/** Voucher codes from one issuance share a slice; policy identities remain distinct. */
export function discountChartGroups(rows: LedgerRow[], state: RevenueState) {
  const groups = new Map<string, DiscountChartGroup & { trips: Set<string> }>()
  const applications = new Map((state.voucherWorkspace?.applications ?? [])
    .filter((row) => row.purpose === "VCR_DISCOUNT").map((row) => [row.code, row]))
  for (const row of discountRows(rows, state)) {
    const policy = state.policies.find((item) => item.code === row.code)
    const application = applications.get(row.code)
    const voucherLabel = application && (application.sourceName.includes(application.recipient.name)
      ? application.sourceName : `${application.sourceName} · ${application.recipient.name}`)
    const key = policy ? `policy/${row.code}` : application ? `voucher/${application.sourceId}` : `code/${row.code}`
    const group = groups.get(key) ?? { key, label: policy?.name ?? voucherLabel ?? `${row.label} · ${row.code}`, value: 0, codes: [], count: 0, trips: new Set<string>() }
    group.value += Number(row.data["Miễn / giảm (₫)"])
    group.codes.push(row.code)
    row.rows.forEach((item) => group.trips.add(item.id))
    groups.set(key, group)
  }
  return [...groups.values()].filter((row) => row.value > 0)
    .map(({ trips, ...row }) => ({ ...row, count: trips.size }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key))
}

export function topDiscountGroups(groups: DiscountChartGroup[], limit = 5): DiscountChartGroup[] {
  if (groups.length <= limit + 1) return groups
  const rest = groups.slice(limit)
  return [...groups.slice(0, limit), { key: "other", label: `Khác (${rest.length} nhóm)`,
    value: rest.reduce((sum, row) => sum + row.value, 0), codes: rest.flatMap((row) => row.codes),
    // A trip may receive more than one policy; don't present a summed trip count here.
    count: 0 }]
}
