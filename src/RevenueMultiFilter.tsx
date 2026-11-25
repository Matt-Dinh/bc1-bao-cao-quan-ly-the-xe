import CardLookupMultiFilter from "./CardLookupMultiFilter"
import { revenueValues } from "./revenue-filter-values"

export default function RevenueMultiFilter({ label, value, options, allLabel, change }: {
  label: string; value: string; options: readonly (string | { value: string; label: string })[]; allLabel: string; change: (value: string) => void;
}) {
  return <CardLookupMultiFilter label={label} value={revenueValues(value)} options={options.map((option) => typeof option === "string" ? { value: option, label: option } : option).filter((option) => option.value)}
    allLabel={allLabel} onChange={(values) => change(values.join("|"))} />
}
