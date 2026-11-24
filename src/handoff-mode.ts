export const handoffModes = [
  { id: "all", label: "Tất cả màn hình", title: "Tất cả màn hình" },
  { id: "cards", label: "Quản lý thẻ", title: "Báo cáo quản lý thẻ" },
  { id: "parking", label: "Chỗ đỗ", title: "Báo cáo chỗ đỗ" },
  { id: "revenue", label: "Doanh thu", title: "Báo cáo doanh thu" },
  { id: "behavior", label: "Hành vi khách hàng", title: "Báo cáo phân tích hành vi khách hàng" },
] as const
export type HandoffMode = typeof handoffModes[number]["id"]
export const handoffModeStorageKey = "vparking:handoff-mode"
export const isHandoffMode = (value: unknown): value is HandoffMode =>
  handoffModes.some(mode => mode.id === value)

const cardScreens = new Set([
  "stock", "circulation", "alerts", "cards", "settings", "inventory", "imports",
  "subscriptions", "customers", "vehicles", "services", "handoffs", "lookup", "incidents",
])
const parkingScreens = new Set([
  "parking-report", "parking-trips", "parking-alerts", "parking-capacity", "parking-settings",
])
const revenueScreens = new Set([
  "revenue-report", "revenue-lookup", "revenue-close", "revenue-debt", "revenue-paper",
  "revenue-receipt", "revenue-voucher", "revenue-policies", "revenue-settings",
  // Revenue detail links need the original trip and its fee/transaction information.
  "parking-trips",
])
export function modeAllowsScreen(mode: HandoffMode, screen: string, revenueAvailable = true) {
  if (!revenueAvailable && mode === "revenue") return screen === "revenue-report"
  if (!revenueAvailable && screen.startsWith("revenue-")) return mode === "all" && screen === "revenue-report"
  if (mode === "all") return cardScreens.has(screen) || parkingScreens.has(screen) ||
    revenueScreens.has(screen) || screen === "behavior-report"
  if (mode === "cards") return cardScreens.has(screen)
  if (mode === "parking") return parkingScreens.has(screen)
  if (mode === "revenue") return revenueScreens.has(screen)
  return screen === "behavior-report"
}
export const modeHome = (mode: HandoffMode) =>
  mode === "parking" ? "parking-report" : mode === "revenue" ? "revenue-report" :
    mode === "behavior" ? "behavior-report" : "stock"

/** A shared URL wins over a saved preference; old deep links retain their filters. */
export function initialHandoffLocation(search: string, saved?: string | null, revenueAvailable = true) {
  let params = new URLSearchParams(search)
  const requested = params.get("mode")
  const route = params.get("module") || params.get("screen") || "stock"
  const explicitRoute = params.has("module") || params.has("screen")
  let mode: HandoffMode = isHandoffMode(requested) ? requested :
    isHandoffMode(saved) ? saved : "all"
  if (!isHandoffMode(requested) && explicitRoute && !modeAllowsScreen(mode, route, revenueAvailable)) mode = "all"
  if (!modeAllowsScreen(mode, route, revenueAvailable) || !explicitRoute && mode !== "all") {
    const home = modeHome(mode)
    params = new URLSearchParams(home === "stock" ? { screen: home } : { module: home })
  }
  params.set("mode", mode)
  return { mode, params }
}
