import { date } from "./data"
import { parkingVehicles, shiftDay, siteById, vnNow } from "./parking-model"
import type { ExportCell, ExportRow, RawSheet, Workbook } from "./parking-ui"
import {
  configAt,
  dateCell,
  estateName,
  methods,
  timestampCell,
  totals,
} from "./revenue-model"
import type {
  Config,
  LedgerRow,
  RevenueChange,
  RevenueShift,
  RevenueState,
} from "./revenue-model"
import { changeRow, groupRows, methodColumns, percentage, selectAmounts } from "./revenue-tables"

export const ZFI014_CONSTANTS = {
  currency: "VND",
  headerText: "Doanh thu TGX",
  customerAccount: "300001749",
  reconAccount: "1310900000",
  revenueAccount: "5117502702",
  vatAccount: "3331100000",
  taxCode: "O4",
  contractType: "9",
  columnCount: 65,
} as const

/** VCR KT-18: ROUNDUP(total / (1 + vatRate/100)) on TTTM total, integer-safe to avoid float drift. */
export function roundUpNet(total: number, vatRate = 10): number {
  const value = Math.round(total)
  if (value <= 0) return 0
  if (vatRate <= 0) return value
  const denom = Math.round((100 + vatRate) * 100)
  const numer = value * 10000
  return Math.floor((numer + denom - 1) / denom)
}

export function sapDate(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return ""
  return `${day.slice(8, 10)}${day.slice(5, 7)}${day.slice(0, 4)}`
}

export function sapContractFields(raw: string): { assignment: string; contract: string } {
  const value = raw.trim()
  if (!value) return { assignment: "", contract: "" }
  if (/^\d+$/.test(value)) {
    return {
      assignment: value.padStart(13, "0"),
      contract: value.replace(/^0+/, "") || "0",
    }
  }
  return { assignment: value, contract: value }
}

export function isSapConfigComplete(config: Pick<Config, "mall" | "company" | "branch" | "customer">): boolean {
  return Boolean(
    config.mall.trim() &&
      config.company.trim() &&
      config.branch.trim() &&
      config.customer.trim(),
  )
}

function emptyRow(): ExportCell[] {
  return Array.from({ length: ZFI014_CONSTANTS.columnCount }, () => "")
}

export function zfi014HeaderRows(): ExportCell[][] {
  const row1 = emptyRow()
  row1[0] = "DOCUMENT HEADER"
  row1[14] = "DOCUMENT LINE ITEM"

  const row2 = emptyRow()
  row2[14] = "ACCOUNT"
  row2[19] = "DOCUMENT CURRENCY"
  row2[23] = "LOCAL CURRENCY"
  row2[26] = "PAYMENT/CASHFLOW"
  row2[29] = "COPA OBJECTS"
  row2[48] = "CO OBJECTS"
  row2[53] = "REFERENCE/TEXT"
  row2[60] = "ONE TIME INFORMATION"

  const row3: ExportCell[] = [
    "DOCUMENT HEADER", "BUDAT", "BLART", "BUKRS", "WAERS", "BUPLA", "XBLNR", "BKTXT",
    "TTEXT", "TTEXT", "TTEXT", "TTEXT", "TTEXT", "",
    "NEWBS", "NEWKO", "WW024_PA", "HKONT", "NEWUM",
    "WRBTR", "MWSKZ", "WMWST", "FWBAS",
    "DMBTR", "MWSTS", "HWBAS",
    "VALUT", "ZTERM", "ZFBDT",
    "VKORG", "SPART", "ARTNR", "KNDNR", "WERKS", "RKAUFNR", "MAKTL", "VTWEG", "PRCTR",
    "KUNRE", "LAND1", "MTART", "BZIRK", "KDGRP", "PAPH1", "PAPH2", "PAPH3", "PAPH4", "PAPH5",
    "PRCTR", "KOSTL", "AUFNR", "MENGE", "MEINS",
    "ZUONR", "SGTXT", "XREF1", "XREF2", "XREF3", "VERTN", "VERTT",
    "NAME1", "STRAS", "ORT01", "LAND1", "STCD1",
  ]

  const row4: ExportCell[] = [
    "DDMMYYYY", "DDMMYYYY", "C(2)", "C(4)", "C(5)", "C(6)", "C(16)", "C(25)",
    "(C30)", "(C30)", "(C30)", "(C30)", "(C30)", "",
    "C(2)", "C(017)", "C(6)", "C(010)", "C(1)",
    "DEC(13,2)\nXXXXXXXX.YY", "C(2)", "DEC(13,2)\nXXXXXXXX.YY", "DEC(13,2)\nXXXXXXXX.YY",
    "DEC(13,2)\nXXXXXXXX.YY", "DEC(13,2)\nXXXXXXXX.YY", "DEC(13,2)\nXXXXXXXX.YY",
    "DDMMYYYY", "C(4)", "DDMMYYYY",
    "C(4)", "C(2)", "C(8)", "C(18)", "C(4)", "", "C(9)", "C(2)", "",
    "", "", "", "", "", "", "", "", "", "",
    "C(10)", "C(10)", "C(10)", "C(13)", "C(03)",
    "C(18)", "C(50)", "C(12)", "C(12)", "C(20)", "C(13)", "C(1)",
    "C(35)", "C(35)", "C(35)", "C(2)", "C(16)",
  ]

  const row5: ExportCell[] = [
    "Document Date\nNgày chứng từ", "Posting Date\nNgày ghi sổ", "DocType\nLoại chứng từ",
    "Company Code\nMã công ty", "Currency\nTiền", "Business Place\nChi nhánh",
    "Reference\nSố hóa đơn", "Header Text\nDiễn giải đầu mục",
    "VAT Business partner name", "VAT Business partner address", "VAT Business partner VAT Reg.N",
    "Payer/Payee", "Payer/Payee address", "",
    "Posting Key", "Account\nTài khoản/ Mã đối tượng", "Trading Partner",
    "Alternative Reconciliatn A/C\nTài khoản thay thế", "Special G/L Ind.",
    "Amount\n(Doc Curr)\nSố tiền", "Tax Code", "Tax Amt\n(Doc Curr)", "Tax Base\n(Doc Curr)",
    "Amount\n(Local Curr)", "Tax Amt\n(Local Curr)", "Tax Base\n(Local Curr)",
    "Value Date", "Payment Term", "Baseline Date",
    "Sale. Org", "Division", "Product", "Customer", "Plant", "Order", "Material group", "Distribution channel", "Profit Center",
    "Bill-to party", "Sold to Country", "Material type", "Sales District", "Customer Group",
    "ProdHier01-1", "ProdHier01-2", "ProdHier01-3", "ProdHier01-4", "ProdHier01-5",
    "Profit Center", "Cost center", "Order", "Quantity", "Base Unit of Measure",
    "Assignment", "Text\nDiễn giải", "Reference Key 1", "Reference Key 2", "Reference Key 3",
    "Contract Number", "Contract Type",
    "Name", "Street", "City", "Country", "VAT Registration No.",
  ]

  return [row1, row2, row3, row4, row5]
}

export function buildZfi014DocumentLines(params: {
  day: string
  reference: number
  config: Pick<Config, "mall" | "company" | "branch" | "customer" | "vat">
  totalAmount: number
  docType?: "X1" | "X2"
  text?: string
}): ExportCell[][] {
  const { day, reference, config, totalAmount, docType = "X1" } = params
  const amount = Math.abs(Math.round(totalAmount))
  if (amount <= 0) return []
  const formattedDate = sapDate(day)
  const net = roundUpNet(amount, config.vat)
  const vat = amount - net
  const { assignment, contract } = sapContractFields(config.customer)
  const mall = config.mall.trim()
  const company = config.company.trim()
  const branch = config.branch.trim()
  const itemText = params.text ?? `Doanh Thu TGX ${formattedDate}`
  const customerKey = docType === "X2" ? "11" : "01"
  const glKey = docType === "X2" ? "40" : "50"

  const baseLine = () => {
    const line = emptyRow()
    line[0] = formattedDate
    line[1] = formattedDate
    line[2] = docType
    line[3] = company
    line[4] = ZFI014_CONSTANTS.currency
    line[5] = branch
    line[6] = String(reference)
    line[7] = ZFI014_CONSTANTS.headerText
    line[26] = formattedDate
    line[28] = formattedDate
    line[37] = mall
    line[48] = mall
    line[53] = assignment
    line[54] = itemText
    line[56] = mall
    line[58] = contract
    line[59] = ZFI014_CONSTANTS.contractType
    return line
  }

  const lineCustomer = baseLine()
  lineCustomer[14] = customerKey
  lineCustomer[15] = ZFI014_CONSTANTS.customerAccount
  lineCustomer[17] = ZFI014_CONSTANTS.reconAccount
  lineCustomer[19] = amount

  const lineRevenue = baseLine()
  lineRevenue[14] = glKey
  lineRevenue[15] = ZFI014_CONSTANTS.revenueAccount
  lineRevenue[19] = net
  lineRevenue[20] = ZFI014_CONSTANTS.taxCode

  const lineVat = baseLine()
  lineVat[14] = glKey
  lineVat[15] = ZFI014_CONSTANTS.vatAccount
  lineVat[19] = vat
  lineVat[20] = ZFI014_CONSTANTS.taxCode
  lineVat[22] = net

  return [lineCustomer, lineRevenue, lineVat]
}

const cashIndex = methods.indexOf("Tiền mặt")
const qrIndex = methods.indexOf("QR")

export function cashAndQrTotal(values: ReturnType<typeof totals>): number {
  return (values.moneyByMethod[cashIndex] ?? 0) + (values.moneyByMethod[qrIndex] ?? 0)
}

export interface Zfi014ExportInput {
  state: RevenueState
  ledger: LedgerRow[]
  scopedLedger: LedgerRow[]
  estates: string[]
  days: string[]
  adjustments: RevenueChange[]
  actor: string
  exportedAt?: number
}

export function buildZfi014Workbook(input: Zfi014ExportInput): Workbook {
  const { state, ledger, scopedLedger, estates: estateIds, days, adjustments, actor, exportedAt = vnNow() } = input
  const headers = zfi014HeaderRows()
  const tempDoRows: ExportCell[][] = [...headers]
  const soLieuRows: ExportRow[] = []
  const byEstateDay = groupRows(scopedLedger, (row) => `${row.estate}/${row.revenueDay}`)
  const allByEstateDay = groupRows(ledger, (row) => `${row.estate}/${row.revenueDay}`)

  let refNo = 0
  let stt = 0
  const sortedDays = [...days].sort()

  for (const day of sortedDays) {
    for (const estate of estateIds) {
      stt += 1
      const config = configAt(state, estate, day)
      const dayRows = byEstateDay.get(`${estate}/${day}`) ?? []
      const sum = totals(dayRows)
      const cash = sum.moneyByMethod[cashIndex] ?? 0
      const qr = sum.moneyByMethod[qrIndex] ?? 0
      const totalCashQr = cash + qr
      const net = roundUpNet(totalCashQr, config.vat)
      const vat = totalCashQr - net
      const prevDay = shiftDay(day, -1)
      const prevSum = totals(allByEstateDay.get(`${estate}/${prevDay}`) ?? [])
      const prevTotal = cashAndQrTotal(prevSum)
      const diffPct = prevTotal > 0 ? Math.abs(totalCashQr - prevTotal) / prevTotal * 100 : null
      const complete = isSapConfigComplete(config)
      const { assignment } = sapContractFields(config.customer)

      const warnings: string[] = []
      if (!complete) warnings.push("Chưa khai báo đủ mã SAP")
      if (totalCashQr === 0) warnings.push("Doanh thu = 0 · bỏ qua khi upload")
      else if (diffPct !== null && diffPct > 30) warnings.push("Chênh lệch > 30% so với T-2 · cần BQL rà soát")

      soLieuRows.push({
        "STT": stt,
        "Ngày doanh thu": dateCell(day),
        "Mã TTTM": config.mall || "Chưa khai báo",
        "Tên TTTM / Khu đô thị": estateName(estate),
        "Mã công ty": config.company || "Chưa khai báo",
        "Chi nhánh": config.branch || "Chưa khai báo",
        "Assignment": assignment || "Chưa khai báo",
        "Tổng tiền mặt (₫)": cash,
        "Tổng QR Code (₫)": qr,
        "Tổng tiền mặt + Tổng QR Code (₫)": totalCashQr,
        "Dthu chưa VAT (₫)": net,
        "VAT (₫)": vat,
        "Kiểm tra (C = D + E)": totalCashQr === net + vat ? "OK" : "Lệch",
        "Số ngày trước T-2 (₫)": prevTotal,
        "Chênh lệch so với T-2 (%)": diffPct === null ? "—" : `${diffPct.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`,
        "Ghi chú / Cảnh báo": warnings.join(" · "),
      })

      if (complete && totalCashQr > 0) {
        refNo += 1
        tempDoRows.push(
          ...buildZfi014DocumentLines({
            day,
            reference: refNo,
            config,
            totalAmount: totalCashQr,
            docType: "X1",
          }),
        )
      }
    }
  }

  const colWidths = Array.from({ length: ZFI014_CONSTANTS.columnCount }, (_, index) => {
    if (index === 0 || index === 1 || index === 26 || index === 28) return 14
    if (index === 7 || index === 54) return 24
    if (index === 15 || index === 17 || index === 19 || index === 22 || index === 53 || index === 58) return 18
    return 12
  })

  const tempDoSheet: RawSheet = { aoa: tempDoRows, cols: colWidths }

  const catalogRows: ExportRow[] = estateIds.map((estate, index) => {
    const config = configAt(state, estate, sortedDays[sortedDays.length - 1] ?? "")
    const { assignment, contract } = sapContractFields(config.customer)
    return {
      "STT": index + 1,
      "Profit Center (Mã TTTM)": config.mall || "Chưa khai báo",
      "Khu đô thị / TTTM": estateName(estate),
      "Company Code": config.company || "Chưa khai báo",
      "Business Place": config.branch || "Chưa khai báo",
      "Assignment": assignment || "Chưa khai báo",
      "Contract Number": contract || "Chưa khai báo",
      "Contract Type": ZFI014_CONSTANTS.contractType,
      "Thuế suất VAT (%)": config.vat,
      "Mã thuế": ZFI014_CONSTANTS.taxCode,
      "Trạng thái SAP": isSapConfigComplete(config) ? "Đầy đủ" : "Thiếu thông tin",
    }
  })

  const infoRows: ExportRow[] = [
    {
      "Biểu mẫu": "ZFI014 · Upload doanh thu TGX lên SAP",
      "Từ ngày doanh thu": sortedDays.length ? dateCell(sortedDays[0]) : null,
      "Đến ngày doanh thu": sortedDays.length ? dateCell(sortedDays[sortedDays.length - 1]) : null,
      "Số chứng từ (TEMP DO)": refNo,
      "Số dòng hạch toán": Math.max(0, tempDoRows.length - headers.length),
      "Tổng tiền mặt + QR (₫)": soLieuRows.reduce((sum, row) => sum + Number(row["Tổng tiền mặt + Tổng QR Code (₫)"] ?? 0), 0),
      "Người xuất": actor,
      "Thời điểm xuất": timestampCell(exportedAt),
      "Quy tắc VAT": "ROUNDUP(Tổng tiền mặt + QR / (1 + VAT%)) trên tổng từng TTTM",
    },
  ]

  const workbook: Workbook = {
    "TEMP DO": tempDoSheet,
    "1.so lieu": soLieuRows,
    "DanhMuc_TTTM": catalogRows,
    "ThongTin": infoRows,
  }

  const x2Rows: ExportCell[][] = [...headers]
  let x2Ref = 0
  for (const item of adjustments) {
    const deltaCashQr = (item.delta.moneyByMethod[cashIndex] ?? 0) + (item.delta.moneyByMethod[qrIndex] ?? 0)
    if (!deltaCashQr) continue
    const config = configAt(state, item.estate, item.recorded)
    if (!isSapConfigComplete(config)) continue
    x2Ref += 1
    x2Rows.push(
      ...buildZfi014DocumentLines({
        day: item.recorded,
        reference: x2Ref,
        config,
        totalAmount: Math.abs(deltaCashQr),
        docType: deltaCashQr < 0 ? "X2" : "X1",
        text: `Dieu chinh TGX ${sapDate(item.origin)}`,
      }),
    )
  }
  if (x2Ref > 0) {
    workbook["DieuChinh_X2"] = { aoa: x2Rows, cols: colWidths }
  }

  return workbook
}

export function summaryShiftRow(
  shift: RevenueShift,
  rows: LedgerRow[],
  showEstate: boolean,
): ExportRow {
  const summary = totals(rows)
  const cashQr = cashAndQrTotal(summary)
  return {
    "Ngày doanh thu": dateCell(shift.day),
    ...(showEstate ? { "Khu đô thị": estateName(shift.estate) } : {}),
    "Bãi xe": siteById(shift.site)?.label ?? shift.site,
    "Ca": shift.name,
    "Số lượt": summary.count,
    "Doanh thu (₫)": summary.revenue,
    "Chưa VAT (₫)": summary.net,
    "VAT (₫)": summary.vat,
    ...methodColumns(summary),
    "Tiền mặt + QR (₫)": cashQr,
    "Voucher (₫)": summary.debt,
    "Thất thu (₫)": summary.lost,
    "Thu thừa (₫)": summary.excess,
  }
}

export interface RevenueSummaryExportInput {
  state: RevenueState
  scopedLedger: LedgerRow[]
  shifts: RevenueShift[]
  estates: string[]
  siteFilter: string
  days: string[]
  cutoff: string
  adjustments: RevenueChange[]
  actor: string
  exportedAt?: number
}

export function buildRevenueSummaryWorkbook(input: RevenueSummaryExportInput): Workbook {
  const {
    state,
    scopedLedger,
    shifts,
    estates: estateIds,
    siteFilter,
    days,
    cutoff,
    adjustments,
    actor,
    exportedAt = vnNow(),
  } = input
  const sortedDays = [...days].sort()
  const byEstateDay = groupRows(scopedLedger, (row) => `${row.estate}/${row.revenueDay}`)
  const byShift = groupRows(scopedLedger, (row) => row.shiftId)

  const summaryRows: ExportRow[] = []
  const grandTotal = totals(scopedLedger)
  const grandLostCard = scopedLedger
    .filter((row) => row.source === "MT")
    .reduce((sum, row) => sum + row.revenue, 0)
  const grandCashQr = cashAndQrTotal(grandTotal)

  summaryRows.push({
    "Mã TTTM": "—",
    "Khu đô thị / TTTM": "Tổng cộng",
    "Ngày doanh thu": sortedDays.length ? `${date(sortedDays[0])} – ${date(sortedDays[sortedDays.length - 1])}` : "—",
    "Số hợp đồng": "—",
    "Số lượt": grandTotal.count,
    ...selectAmounts(grandTotal, ["gross", "reduction", "revenue", "net", "vat"]),
    "Vé âm / Voucher (₫)": grandTotal.debt,
    "Tiền thừa (₫)": grandTotal.excess,
    "Mất / hỏng thẻ (₫)": grandLostCard,
    ...methodColumns(grandTotal),
    "Tổng tiền mặt + QR (₫)": grandCashQr,
    "Tiền thực nhận (₫)": grandTotal.collected,
    "Thất thu (₫)": grandTotal.lost,
    "Tỷ lệ thất thu": percentage(grandTotal.lost, grandTotal.revenue),
  })

  for (const day of [...sortedDays].reverse()) {
    for (const estate of estateIds) {
      const config = configAt(state, estate, day)
      const rows = byEstateDay.get(`${estate}/${day}`) ?? []
      const sum = totals(rows)
      const lostCard = rows.filter((row) => row.source === "MT").reduce((acc, row) => acc + row.revenue, 0)
      const cashQr = cashAndQrTotal(sum)
      const netZfi = roundUpNet(cashQr, config.vat)
      summaryRows.push({
        "Mã TTTM": config.mall || "Chưa khai báo",
        "Khu đô thị / TTTM": estateName(estate),
        "Ngày doanh thu": dateCell(day),
        "Số hợp đồng": sapContractFields(config.customer).contract || "Chưa khai báo",
        "Số lượt": sum.count,
        ...selectAmounts(sum, ["gross", "reduction", "revenue"]),
        "Chưa VAT (₫)": netZfi,
        "VAT (₫)": cashQr - netZfi,
        "Vé âm / Voucher (₫)": sum.debt,
        "Tiền thừa (₫)": sum.excess,
        "Mất / hỏng thẻ (₫)": lostCard,
        ...methodColumns(sum),
        "Tổng tiền mặt + QR (₫)": cashQr,
        "Tiền thực nhận (₫)": sum.collected,
        "Thất thu (₫)": sum.lost,
        "Tỷ lệ thất thu": percentage(sum.lost, sum.revenue),
      })
    }
  }

  const shiftRows = [...shifts]
    .sort((a, b) => b.day.localeCompare(a.day) || a.estate.localeCompare(b.estate) || a.site.localeCompare(b.site) || a.name.localeCompare(b.name))
    .map((shift) => summaryShiftRow(shift, byShift.get(shift.id) ?? [], true))

  const vehicleRows: ExportRow[] = estateIds.flatMap((estate) => {
    const config = configAt(state, estate, sortedDays[sortedDays.length - 1] ?? cutoff)
    const estateRows = scopedLedger.filter((row) => row.estate === estate)
    return parkingVehicles.map((vehicle) => {
      const rows = estateRows.filter((row) => row.vehicle === vehicle)
      const sum = totals(rows)
      const lostCard = rows.filter((row) => row.source === "MT").reduce((acc, row) => acc + row.revenue, 0)
      return {
        "Mã TTTM": config.mall || "Chưa khai báo",
        "Khu đô thị / TTTM": estateName(estate),
        "Loại phương tiện": vehicle,
        "Số lượt tính doanh thu": sum.count,
        "Doanh thu (₫)": sum.revenue,
        "Vé âm / Voucher (₫)": sum.debt,
        "Tiền thừa (₫)": sum.excess,
        "Mất / hỏng thẻ (₫)": lostCard,
        ...methodColumns(sum),
        "Tổng tiền mặt + QR (₫)": cashAndQrTotal(sum),
        "Thất thu (₫)": sum.lost,
      }
    })
  })

  const startDay = sortedDays[0] ?? cutoff
  const endDay = sortedDays[sortedDays.length - 1] ?? cutoff
  const debtRows: ExportRow[] = [
    ...scopedLedger.filter((row) => row.debt > 0).map((row) => ({
      "Loại": "Phát sinh",
      "Ngày": dateCell(row.revenueDay),
      "Khu đô thị": estateName(row.estate),
      "Đơn vị": row.voucher?.recipient?.name ?? row.voucher?.unit ?? "Chưa xác định",
      "Chứng từ": row.id,
      "Số tiền (₫)": row.debt,
    })),
    ...state.payments
      .filter((row) => !row.canceled && row.day >= startDay && row.day <= endDay && estateIds.some((id) => row.unit.startsWith(`${id}-`) || row.unit.startsWith(`DEMO-${id}-`)))
      .map((row) => ({
        "Loại": "Đã thanh toán",
        "Ngày": dateCell(row.day),
        "Khu đô thị": estateIds.find((id) => row.unit.startsWith(`${id}-`) || row.unit.startsWith(`DEMO-${id}-`))
          ? estateName(estateIds.find((id) => row.unit.startsWith(`${id}-`) || row.unit.startsWith(`DEMO-${id}-`))!)
          : "—",
        "Đơn vị": row.unit,
        "Chứng từ": row.document,
        "Số tiền (₫)": row.amount,
      })),
  ]

  const workbook: Workbook = {
    "ThongTin": [
      {
        "Báo cáo": "Báo cáo doanh thu tổng hợp",
        "Từ ngày doanh thu": dateCell(startDay),
        "Đến ngày doanh thu": dateCell(endDay),
        "Số liệu tự động chốt đến": dateCell(cutoff),
        "Khu đô thị": estateIds.map(estateName).join(", "),
        "Bãi xe": siteFilter ? siteFilter.split("|").map((id) => siteById(id)?.label ?? id).join(", ") : "Tất cả bãi xe",
        "Người xuất": actor,
        "Thời điểm xuất": timestampCell(exportedAt),
      },
    ],
    "1-TongHopTTTM": summaryRows,
    "2-ChiTietTheoCa": shiftRows,
    "3-TheoLoaiXe": vehicleRows,
    "4-CongNoVoucher": debtRows,
    ...(adjustments.length ? { "5-DieuChinhSauChot": adjustments.map(changeRow) } : {}),
  }

  return workbook
}
