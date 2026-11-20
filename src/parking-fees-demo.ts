import { feeTripMinute, parkingFeeQuoteError } from "./parking-fees"
import type { ParkingFeeQuote, ParkingFeeRequest, ParkingFeeService, ParkingPaymentSession, ParkingSupplementRequest } from "./parking-fees"
import { normalizeTripSearch } from "./parking-model"
import type { Trip } from "./parking-model"
import type { Method, Transaction } from "./revenue-model"
import { methods } from "./revenue-model"

/** Local prototype only: no network, bank account, real QR or real payment. */
export function createDemoParkingFeeService(getTrip: (id: string) => Trip | undefined,
  options: { now?: () => number } = {}): ParkingFeeService {
  const now = options.now ?? Date.now
  type QuoteRecord = { request: ParkingFeeRequest; fingerprint: string; quote: ParkingFeeQuote }
  type SessionRecord = { session: ParkingPaymentSession; tripId: string; method: Method }
  const quotes = new Map<string, QuoteRecord>()
  const quoteKeys = new Map<string, string>()
  const sessions = new Map<string, SessionRecord>()
  const paymentKeys = new Map<string, string>()
  const receipts = new Map<string, Map<string, Transaction>>()
  const completed = new Map<string, { trip: Trip; billing: ParkingFeeQuote }>()
  const checkAbort = (signal: AbortSignal) => { if (signal.aborted) throw new DOMException("Đã hủy yêu cầu", "AbortError") }
  const fingerprint = (trip: Trip) => JSON.stringify([trip.id, trip.plate, trip.site, trip.vehicle,
    trip.group, trip.entered, trip.exited, trip.paid, trip.supplementalBilling?.id])
  const source = (request: ParkingFeeRequest) => {
    const trip = getTrip(request.tripId)
    if (!trip || trip.site !== request.siteId || trip.group !== request.customerGroup) throw new Error("Không tìm thấy lượt minh họa phù hợp.")
    const from = feeTripMinute(request.enteredAt), to = feeTripMinute(request.exitedAt)
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to > feeTripMinute(new Date(now()).toISOString()))
      throw new Error("Giờ ra phải sau giờ vào và không sau thời điểm hiện tại.")
    if (!normalizeTripSearch(request.plate) && request.vehicle !== "Xe đạp") throw new Error("Nhập biển số để tính phí minh họa.")
    return trip
  }
  const paymentsFor = (trip: Trip) => {
    const prior: Transaction[] = trip.supplementalBilling?.payments.filter((row) => row.status !== "Chờ xác nhận") ??
      (trip.paid && trip.paid > 0 ? [{ id: `DEMO-PRIOR-${trip.id}`, at: trip.exited ?? trip.entered,
        amount: trip.paid, method: "QR", status: "Thành công" }] : [])
    return [...new Map([...prior, ...(receipts.get(trip.id)?.values() ?? [])].map((row) => [row.id, row])).values()]
  }
  const qrPreview = (id: string) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect width="180" height="180" fill="white"/><g fill="none" stroke="#8290a6" stroke-width="6"><rect x="16" y="16" width="38" height="38"/><rect x="126" y="16" width="38" height="38"/><rect x="16" y="126" width="38" height="38"/></g><text x="90" y="88" text-anchor="middle" fill="#c33d64" font-family="sans-serif" font-size="19" font-weight="bold">QR DEMO</text><text x="90" y="110" text-anchor="middle" fill="#697483" font-family="sans-serif" font-size="10">KHONG DUNG DE CHUYEN TIEN</text><text x="90" y="160" text-anchor="middle" fill="#697483" font-family="sans-serif" font-size="8">${id.slice(-10)}</text></svg>`)
  const refreshQuote = (record: QuoteRecord) => {
    const trip = source(record.request)
    if (fingerprint(trip) !== record.fingerprint) throw new Error("Lượt xe vừa thay đổi. Vui lòng chọn lại lượt để đối soát.")
    const payments = paymentsFor(trip)
    const collected = payments.reduce((sum, row) => sum + (row.status === "Thành công" || row.status === "Đã hoàn" ? row.amount : 0), 0)
    const amountDue = Math.max(0, record.quote.customerPayable - collected)
    const pending = [...sessions.values()].find((row) => row.tripId === trip.id && row.session.status === "pending")
    if (pending && amountDue > 0) {
      pending.session = { ...pending.session, quoteId: record.quote.id }
      payments.push({ id: `DEMO-TX-${pending.session.id}`, at: feeTripMinute(record.request.exitedAt),
        method: pending.method, amount: pending.session.amount, status: "Chờ xác nhận" })
    }
    const result: ParkingFeeQuote = { ...record.quote, collected, amountDue,
      overpaid: Math.max(0, collected - record.quote.customerPayable), payments,
      pendingPayment: pending && amountDue > 0 ? { ...pending.session } : undefined }
    const error = parkingFeeQuoteError(result, now())
    if (error) throw new Error(error)
    return result
  }
  const requireQuote = (id: string) => {
    const record = quotes.get(id)
    if (!record) throw new Error("Chưa có kết quả tính phí minh họa.")
    return { record, quote: refreshQuote(record) }
  }
  return {
    isDemo: true,
    async quote(request, signal) {
      checkAbort(signal)
      const trip = source(request)
      const from = feeTripMinute(request.enteredAt), to = feeTripMinute(request.exitedAt)
      const rate = request.vehicle === "Ô tô" ? 10000 : request.vehicle === "Xe máy" ? 5000 : 2000
      const hours = Math.max(1, Math.ceil((to - from) / 60))
      const gross = hours * rate
      const discounts: ParkingFeeQuote["discounts"] = []
      const add = (code: string, label: string, kind: "policy" | "voucher", amount: number) => {
        const remaining = gross - discounts.reduce((sum, row) => sum + row.amount, 0)
        const value = Math.min(remaining, Math.max(0, Math.round(amount)))
        if (value > 0) discounts.push({ code, label, kind, amount: value })
      }
      if (request.customerGroup !== "Vãng lai") add("DEMO-SUB", "Miễn phí thuê bao / VIP minh họa", "policy", gross)
      else if (request.requestedPolicyCode === "CS-01") {
        if (request.vehicle !== "Ô tô") throw new Error("Mẫu miễn 5 giờ chỉ áp dụng cho ô tô.")
        add("CS-01", "Minh họa miễn 5 giờ đầu", "policy", Math.min(5, hours) * rate)
      } else if (request.requestedPolicyCode === "CS-02") add("CS-02", "Minh họa giảm 20%", "policy", gross * .2)
      else if (request.requestedPolicyCode === "CS-04") add("CS-04", "Minh họa giảm 5.000 đ", "policy", 5000)
      else if (request.requestedPolicyCode === "CS-03") throw new Error("Mẫu miễn phí VIP chỉ áp dụng cho nhóm khách VIP.")
      else if (request.requestedPolicyCode) throw new Error("Chính sách này chưa có dữ liệu mô phỏng.")
      for (const raw of [...new Set(request.voucherCodes.map((code) => code.toUpperCase()))]) {
        if (raw === "DEMO10K") add(raw, "Voucher mẫu giảm 10.000 đ", "voucher", 10000)
        else if (raw === "DEMO20") add(raw, "Voucher mẫu giảm 20%", "voucher", (gross - discounts.reduce((sum, row) => sum + row.amount, 0)) * .2)
        else throw new Error(`Voucher minh họa không hợp lệ: ${raw}. Có thể thử DEMO10K hoặc DEMO20.`)
      }
      const key = JSON.stringify([request, fingerprint(trip)])
      for (const pending of sessions.values()) {
        if (pending.tripId === trip.id && pending.session.status === "pending" &&
          JSON.stringify(quotes.get(pending.session.quoteId)?.request) !== JSON.stringify(request))
          pending.session = { ...pending.session, status: "expired" }
      }
      const previous = quoteKeys.get(key)
      if (previous && Date.parse(quotes.get(previous)!.quote.expiresAt) > now()) return refreshQuote(quotes.get(previous)!)
      const id = `DEMO-QUOTE-${crypto.randomUUID()}`
      const customerPayable = gross - discounts.reduce((sum, row) => sum + row.amount, 0)
      const quote: ParkingFeeQuote = { id, expiresAt: new Date(now() + 10 * 60 * 1000).toISOString(), currency: "VND",
        pricingName: `Mô phỏng · ${rate.toLocaleString("vi-VN")} đ/giờ · làm tròn giờ`, gross, discounts,
        customerPayable, collected: 0, amountDue: customerPayable, overpaid: 0, payments: [] }
      const record = { request: { ...request, voucherCodes: [...request.voucherCodes] }, fingerprint: fingerprint(trip), quote }
      quotes.set(id, record); quoteKeys.set(key, id)
      return refreshQuote(record)
    },
    async createPayment(request, signal) {
      checkAbort(signal)
      const { record, quote } = requireQuote(request.quoteId)
      const previous = paymentKeys.get(request.idempotencyKey)
      if (previous) return { ...sessions.get(previous)!.session }
      if (quote.pendingPayment) return quote.pendingPayment
      if (!methods.includes(request.method) || !Number.isSafeInteger(request.amount) || request.amount <= 0 || request.amount !== quote.amountDue)
        throw new Error("Chỉ tạo thanh toán mô phỏng cho đúng số tiền còn thiếu.")
      const id = `DEMO-PAY-${crypto.randomUUID()}`
      const session: ParkingPaymentSession = { id, quoteId: quote.id, amount: quote.amountDue, status: "pending",
        ...(request.method === "QR" ? { qrImageUrl: qrPreview(id) } : {}) }
      sessions.set(id, { session, tripId: record.request.tripId, method: request.method })
      paymentKeys.set(request.idempotencyKey, id)
      return { ...session }
    },
    async getPayment(id, signal) {
      checkAbort(signal)
      const record = sessions.get(id)
      if (!record) throw new Error("Không tìm thấy thanh toán mô phỏng.")
      if (record.session.status === "pending") {
        const quoteRecord = quotes.get(record.session.quoteId)!
        const rows = receipts.get(record.tripId) ?? new Map<string, Transaction>()
        const transactionId = `DEMO-TX-${id}`
        rows.set(transactionId, { id: transactionId, at: feeTripMinute(quoteRecord.request.exitedAt),
          method: record.method, amount: record.session.amount, status: "Thành công" })
        receipts.set(record.tripId, rows)
        record.session = { ...record.session, status: "paid" }
      }
      return { ...record.session }
    },
    async completeSupplement(request: ParkingSupplementRequest) {
      const saved = completed.get(request.idempotencyKey)
      if (saved) return saved
      const { record, quote } = requireQuote(request.quoteId)
      if (JSON.stringify(record.request) !== JSON.stringify(request.request)) throw new Error("Thông tin lượt xe đã đổi. Vui lòng tính lại phí.")
      if (quote.pendingPayment) throw new Error("Xác nhận thanh toán mô phỏng trước khi lưu.")
      if (!request.reference.trim() || !request.reason.trim() || !request.lane) throw new Error("Nhập làn, lý do và mã biên bản minh họa.")
      const original = source(record.request)
      const trip: Trip = { ...original, entered: feeTripMinute(record.request.enteredAt), exited: feeTripMinute(record.request.exitedAt),
        plate: record.request.plate, vehicle: record.request.vehicle,
        ...(record.request.direction === "exit" ? { laneOut: request.lane, sourceOut: "CSKH bổ sung" as const }
          : { laneIn: request.lane, sourceIn: "CSKH bổ sung" as const }) }
      const result = { trip, billing: quote }
      completed.set(request.idempotencyKey, result)
      return result
    },
  }
}
