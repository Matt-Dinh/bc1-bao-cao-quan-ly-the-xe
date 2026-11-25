// Creation is a child flow of the invoice list, with no separate sidebar entry.
export const voucherPages = [
  { id: "sources", title: "Quản lý voucher hóa đơn", tab: "sources" },
  { id: "units", title: "Quản lý gian hàng", tab: "units" },
  { id: "history", title: "Lịch sử voucher", tab: "history" },
  { id: "report", title: "Báo cáo Voucher", tab: "report" },
] as const

export function voucherPage(params: URLSearchParams) {
  if (params.get("voucherEdit")) return voucherPages[0]
  return voucherPages.find((page) => page.tab === params.get("voucherTab")) ?? voucherPages[0]
}

export function voucherPageParams(id: typeof voucherPages[number]["id"] | "create"): Record<string, string | null> {
  // Keep existing links to the creation form usable.
  if (id === "create") return { voucherTab: "sources", voucherEdit: "new" }
  const page = voucherPages.find((page) => page.id === id) ?? voucherPages[0]
  return { voucherTab: page.tab, voucherEdit: null }
}
