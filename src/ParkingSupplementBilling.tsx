import { useEffect, useRef, useState } from "react"
import { LoaderCircle, QrCode } from "lucide-react"
import { Button, Field, Heading, Select } from "./ui"
import { methods } from "./revenue-model"
import type { Method } from "./revenue-model"
import { fmt } from "./data"
import { parkingFeeQuoteError } from "./parking-fees"
import type { ParkingFeeQuote, ParkingFeeRequest, ParkingFeeService, ParkingPaymentSession } from "./parking-fees"

const money = (amount: number) => `${fmt(amount)} ₫`

export function useParkingSupplementFee(request: ParkingFeeRequest | null, service: ParkingFeeService | null) {
  const key = request ? JSON.stringify(request) : ""
  const [revision, setRevision] = useState(0)
  const [clock, setClock] = useState(Date.now())
  const [result, setResult] = useState<{ key: string; service?: ParkingFeeService; quote?: ParkingFeeQuote; busy?: boolean; error?: string }>({ key: "" })
  const [payment, setPayment] = useState<{ key: string; session: ParkingPaymentSession } | null>(null)
  const [payBusy, setPayBusy] = useState(false)
  const [payError, setPayError] = useState("")
  const payController = useRef<AbortController | null>(null)
  const payRunning = useRef(false)
  const paymentKeys = useRef(new Map<string, string>())
  const refresh = () => {
    if (service) setResult({ key, service, busy: true })
    setRevision((value) => value + 1)
  }
  useEffect(() => {
    if (!request || !service) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setResult({ key, service, busy: true })
      try {
        const quote = await service.quote(request, controller.signal)
        if (controller.signal.aborted) return
        const error = parkingFeeQuoteError(quote)
        setResult(error ? { key, service, error } : { key, service, quote })
        setClock(Date.now())
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, service, error: error instanceof Error ? error.message : "Chưa lấy được phí. Vui lòng thử lại." })
      }
    }, 400)
    return () => { clearTimeout(timer); controller.abort() }
  }, [key, service, revision])
  useEffect(() => {
    if (!key) return
    const timer = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [key])
  useEffect(() => {
    payController.current?.abort()
    payRunning.current = false
    setPayBusy(false)
    setPayError("")
    return () => { payController.current?.abort() }
  }, [key])
  const quote = result.key === key && result.service === service ? result.quote : undefined
  const quoteError = quote ? parkingFeeQuoteError(quote, clock) : ""
  const busy = !!service && !!request && (result.key !== key || result.service !== service || !!result.busy)
  const valid = !!quote && !busy && !quoteError
  const session = payment?.key === key && payment.session.quoteId === quote?.id ? payment.session : quote?.pendingPayment
  const paymentPending = session?.status === "pending" || !!quote?.payments.some((row) => row.status === "Chờ xác nhận")
  const checkSession = (value: ParkingPaymentSession, quoteId: string, amount: number) => {
    if (!value?.id || value.quoteId !== quoteId || value.amount !== amount || !["pending", "paid", "failed", "expired"].includes(value.status))
      throw new Error("Kết quả thanh toán chưa khớp với khoản cần thu.")
    return value
  }
  const checkPayment = async () => {
    if (!session || !service?.getPayment || payRunning.current) return
    const controller = new AbortController()
    payController.current?.abort()
    payController.current = controller
    payRunning.current = true
    setPayBusy(true)
    setPayError("")
    try {
      const next = checkSession(await service.getPayment(session.id, controller.signal), session.quoteId, session.amount)
      if (controller.signal.aborted) return
      setPayment({ key, session: next })
      if (next.status !== "pending") refresh()
    } catch (error) {
      if (!controller.signal.aborted) setPayError(error instanceof Error ? error.message : "Chưa kiểm tra được thanh toán.")
    } finally {
      if (!controller.signal.aborted) { payRunning.current = false; setPayBusy(false) }
    }
  }
  const createPayment = async (method: Method) => {
    if (!valid || !quote || quote.amountDue <= 0 || !service?.createPayment || payRunning.current || paymentPending) return
    const error = parkingFeeQuoteError(quote)
    if (error) { setPayError(error); return }
    const controller = new AbortController()
    payController.current = controller
    payRunning.current = true
    setPayBusy(true)
    setPayError("")
    const paymentKey = `${quote.id}/${method}`
    if (!paymentKeys.current.has(paymentKey)) paymentKeys.current.set(paymentKey, crypto.randomUUID())
    try {
      const next = checkSession(await service.createPayment({ quoteId: quote.id, amount: quote.amountDue, method,
        idempotencyKey: paymentKeys.current.get(paymentKey)! }, controller.signal), quote.id, quote.amountDue)
      if (controller.signal.aborted) return
      setPayment({ key, session: next })
      if (next.status === "paid") refresh()
    } catch (error) {
      if (!controller.signal.aborted) setPayError(error instanceof Error ? error.message : "Chưa tạo được yêu cầu thanh toán.")
    } finally {
      if (!controller.signal.aborted) { payRunning.current = false; setPayBusy(false) }
    }
  }
  return { key, request, quote, valid, busy, session, paymentPending, payBusy, payError, refresh, createPayment, checkPayment,
    error: quoteError || (result.key === key ? result.error : "") || "" }
}

export function ParkingSupplementBilling({ fee, service, method, changeMethod, disabled = false }: {
  fee: ReturnType<typeof useParkingSupplementFee>; service: ParkingFeeService | null
  method: Method; changeMethod: (method: Method) => void
  disabled?: boolean
}) {
  const quote = fee.quote
  const rows = [
    ["Phí gửi xe gốc", quote?.gross],
    ["Miễn / giảm theo chính sách", quote ? quote.discounts.filter((row) => row.kind === "policy").reduce((sum, row) => sum + row.amount, 0) : undefined],
    ["Voucher giảm phí", quote ? quote.discounts.filter((row) => row.kind === "voucher").reduce((sum, row) => sum + row.amount, 0) : undefined],
    ...(quote?.voucherFunding ? [["Voucher bên thứ ba thanh toán", quote.voucherFunding.amount]] : []),
    ["Khách phải thanh toán", quote?.customerPayable],
    ["Đã thanh toán", quote?.collected],
    ["Còn phải thanh toán", quote?.amountDue],
    ...(quote?.overpaid ? [["Đã thu thừa cần đối soát", quote.overpaid]] : []),
  ] as const
  const status = fee.session ? { pending: "Đang chờ thanh toán", paid: "Đã xác nhận thanh toán", failed: "Thanh toán thất bại", expired: "Yêu cầu thanh toán đã hết hạn" }[fee.session.status] : ""
  return <fieldset className="parking-fee-panel" disabled={disabled}>
    <Heading level={3}>Tiền vé và thanh toán</Heading>
    {service?.isDemo && <p className="parking-demo-fee-label">MÔ PHỎNG · Không thu tiền thật</p>}
    <p className="parking-supplement-help">Phí được lấy từ hệ thống tính phí theo bãi, loại xe và thời gian đỗ. Khoản đã thanh toán được đối soát trước khi thu thêm.</p>
    <div className="parking-fee-status" role="status">
      {!service ? "Tính phí tự động chưa được kết nối. Chưa có kết quả tiền vé."
        : !fee.request ? "Nhập đầy đủ biển số, ngày và giờ để tính phí."
          : fee.busy ? <><LoaderCircle size={14} className="spin" /> Đang tính phí…</> : quote?.pricingName || "Chưa có kết quả tính phí."}
    </div>
    <dl className="parking-fee-totals">{rows.map(([label, value]) => <div key={String(label)}>
      <dt>{label}</dt><dd>{value === undefined ? "—" : money(Number(value))}</dd>
    </div>)}</dl>
    {quote?.discounts.length ? <p className="field-hint">{quote.discounts.map((row) => `${row.label}: ${money(row.amount)}`).join(" · ")}</p> : null}
    {fee.error && <p className="field-message" role="alert">{fee.error}</p>}
    <Button onClick={fee.refresh} disabled={!service || !fee.request || fee.busy || fee.payBusy || fee.session?.status === "pending"}>Tính lại phí</Button>
    <div className="parking-fee-payment">
      <Field label="Phương thức thanh toán">
        <Select aria-label="Phương thức thanh toán" value={method} options={[...methods]}
          disabled={fee.payBusy || fee.paymentPending}
          onChange={(event) => changeMethod(event.target.value as Method)} />
      </Field>
      {method === "QR" && <div className="parking-payment-qr">
        {fee.session?.status === "pending" && fee.session.qrImageUrl ? <img src={fee.session.qrImageUrl} alt="Mã QR thanh toán do hệ thống cung cấp" />
          : <><QrCode size={30} /><span>Chưa có mã QR</span></>}
      </div>}
      <Button onClick={() => fee.createPayment(method)} disabled={!fee.valid || !quote?.amountDue || !service?.createPayment || fee.payBusy || fee.paymentPending}>
        {service?.isDemo ? method === "QR" ? "Tạo mã mô phỏng" : "Tạo thanh toán mô phỏng" : method === "QR" ? "Tạo mã thanh toán" : "Ghi nhận thanh toán"}
      </Button>
      {status && <p role="status" className="field-hint">{status}</p>}
      {fee.paymentPending && !fee.session && <p className="field-hint">Có giao dịch đang chờ xác nhận. Kiểm tra kết quả trên hệ thống thanh toán trước khi tạo yêu cầu mới.</p>}
      {fee.session?.status === "pending" && <Button disabled={!service?.getPayment || fee.payBusy} onClick={fee.checkPayment}>
        {service?.isDemo ? "Mô phỏng thanh toán thành công" : "Kiểm tra thanh toán"}
      </Button>}
      {fee.payError && <p className="field-message" role="alert">{fee.payError}</p>}
      {fee.valid && quote?.amountDue === 0 && <p className="field-hint">Không cần thanh toán thêm.</p>}
      {!!quote?.overpaid && <p className="field-hint">Đối soát khoản thu thừa theo quy trình hoàn tiền hiện tại.</p>}
    </div>
  </fieldset>
}
