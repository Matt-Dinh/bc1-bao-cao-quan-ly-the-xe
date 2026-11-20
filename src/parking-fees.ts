import type { Guest, Trip, Vehicle } from "./parking-model"
import type { Method, RevenueSource, Transaction } from "./revenue-model"
import { methods, sources } from "./revenue-model"

export interface ParkingFeeRequest {
  direction: "entry" | "exit"
  tripId: string
  siteId: string
  plate: string
  ticket: string
  vehicle: Vehicle
  customerGroup: Guest
  enteredAt: string
  exitedAt: string
  voucherCodes: string[]
  requestedPolicyCode?: string
}
export interface ParkingFeeQuote {
  id: string
  expiresAt: string
  currency: "VND"
  pricingName: string
  gross: number
  discounts: { code: string; label: string; kind: "policy" | "voucher"; amount: number }[]
  voucherFunding?: { code: string; unit: string; amount: number; negative: boolean }
  source?: RevenueSource
  customerPayable: number
  collected: number
  amountDue: number
  overpaid: number
  payments: Transaction[]
  pendingPayment?: ParkingPaymentSession
}
export interface ParkingPaymentSession {
  id: string
  quoteId: string
  amount: number
  status: "pending" | "paid" | "failed" | "expired"
  qrImageUrl?: string
}
export interface ParkingSupplementRequest {
  quoteId: string
  request: ParkingFeeRequest
  lane: string
  reason: string
  reference: string
  note: string
  evidence: File[]
  idempotencyKey: string
}
export interface ParkingFeeService {
  isDemo?: boolean
  quote(request: ParkingFeeRequest, signal: AbortSignal): Promise<ParkingFeeQuote>
  createPayment?(request: { quoteId: string; method: Method; amount: number; idempotencyKey: string }, signal: AbortSignal): Promise<ParkingPaymentSession>
  getPayment?(id: string, signal: AbortSignal): Promise<ParkingPaymentSession>
  completeSupplement?(request: ParkingSupplementRequest): Promise<{ trip: Trip; billing: ParkingFeeQuote }>
}

let service: ParkingFeeService | null = null
export const configureParkingFeeService = (next: ParkingFeeService | null) => { service = next }
export const getParkingFeeService = () => service
export const feeLocalTime = (value: number) => `${new Date(value * 60000).toISOString().slice(0, 19)}+07:00`
export const feeTripMinute = (isoTime: string) => Date.parse(isoTime) / 60000 + 7 * 60

export function parkingFeeQuoteError(quote: ParkingFeeQuote, now = Date.now(), checkExpiry = true) {
  const money = (value: number) => Number.isSafeInteger(value) && value >= 0
  if (!quote || !quote.id || quote.currency !== "VND" || !quote.pricingName ||
    !Number.isFinite(Date.parse(quote.expiresAt)) || quote.source && !Object.prototype.hasOwnProperty.call(sources, quote.source) ||
    !Array.isArray(quote.discounts) || !Array.isArray(quote.payments) ||
    ![quote.gross, quote.customerPayable, quote.collected, quote.amountDue, quote.overpaid].every(money))
    return "Kết quả tính phí chưa hợp lệ. Vui lòng tính lại."
  if (quote.discounts.some((row) => !row || !row.code || !row.label || !["policy", "voucher"].includes(row.kind) || !money(row.amount)) ||
    quote.voucherFunding && (!quote.voucherFunding.code || !quote.voucherFunding.unit || !money(quote.voucherFunding.amount) || typeof quote.voucherFunding.negative !== "boolean"))
    return "Thông tin miễn giảm hoặc voucher chưa hợp lệ."
  const reduction = quote.discounts.reduce((sum, row) => sum + row.amount, 0)
  const funding = quote.voucherFunding?.amount ?? 0
  if (quote.payments.some((row) => !row || !row.id || !Number.isFinite(row.at) || !methods.includes(row.method) ||
    !["Thành công", "Chờ xác nhận", "Thất bại", "Đã hoàn"].includes(row.status) ||
    !Number.isSafeInteger(row.amount) || (row.status === "Đã hoàn" ? row.amount >= 0 : row.amount < 0)))
    return "Thông tin giao dịch thanh toán chưa hợp lệ."
  const payments = quote.payments.filter((row) => row.status === "Thành công" || row.status === "Đã hoàn")
  const collected = payments.reduce((sum, row) => sum + row.amount, 0)
  if (quote.pendingPayment && (!quote.pendingPayment.id || quote.pendingPayment.status !== "pending" ||
    quote.pendingPayment.quoteId !== quote.id || quote.pendingPayment.amount !== quote.amountDue || quote.amountDue <= 0))
    return "Yêu cầu thanh toán đang chờ chưa khớp với kết quả tính phí."
  if (new Set(quote.payments.map((row) => row.id)).size !== quote.payments.length ||
    reduction > quote.gross || funding > quote.gross - reduction ||
    quote.voucherFunding?.negative && funding !== quote.gross - reduction ||
    quote.customerPayable !== quote.gross - reduction - funding || quote.collected !== collected ||
    quote.amountDue !== Math.max(0, quote.customerPayable - collected) ||
    quote.overpaid !== Math.max(0, collected - quote.customerPayable))
    return "Các khoản phí và thanh toán chưa khớp. Vui lòng đối soát lại."
  return checkExpiry && Date.parse(quote.expiresAt) <= now ? "Kết quả tính phí đã hết hạn. Vui lòng tính lại." : ""
}

export function tripWithParkingBilling(trip: Trip, billing: ParkingFeeQuote): Trip {
  const error = parkingFeeQuoteError(billing, Date.now(), false)
  if (error) throw new Error(error)
  return { ...trip, due: billing.gross - billing.discounts.reduce((sum, row) => sum + row.amount, 0),
    paid: billing.collected, voucher: billing.voucherFunding?.amount ?? 0,
    policy: billing.discounts.map((row) => row.code).join(", ") || undefined,
    supplementalBilling: billing }
}
