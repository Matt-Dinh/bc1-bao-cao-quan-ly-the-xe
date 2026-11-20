import { useEffect, useMemo, useRef, useState } from "react"
import { LockKeyhole, Pencil, Plus } from "lucide-react"
import { Button, Field, Input, Overlay, Select, Textarea } from "./ui"
import { allowedSites, displayTime, normalizeTripSearch, parkingVehicles, searchTrips, siteById, supplementTripCandidates, vnNow } from "./parking-model"
import type { ParkingAccess, ParkingSettings, Trip, Vehicle } from "./parking-model"
import { allOption, ParkingTable, Segments } from "./parking-ui"
import { inputTime, revenueDay, revenueShifts, revenueWrite, timeInput } from "./revenue-model"
import type { Method, RevenueState } from "./revenue-model"
import { applyRevenueTrip } from "./revenue-operations"
import type { RevenueSave } from "./revenue-operations"
import { getParkingFeeService, feeLocalTime, parkingFeeQuoteError, tripWithParkingBilling } from "./parking-fees"
import type { ParkingFeeRequest, ParkingFeeService } from "./parking-fees"
import { ParkingSupplementBilling, useParkingSupplementFee } from "./ParkingSupplementBilling"

type Mode = "plate" | "exit" | "entry" | "choose"
export interface RevenueTripActions {
  state: RevenueState; save: RevenueSave; feeService?: ParkingFeeService
}
export function RevenueTripEditor({ existing, pendingTrips = [], access, state, save, trips, settings, actor, notify, feeService }: RevenueTripActions & {
  existing?: Trip; pendingTrips?: Trip[]; access: ParkingAccess; trips: Trip[]; settings: ParkingSettings; actor: string; notify: (text: string) => void
}) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [search, setSearch] = useState("")
  const [chooseAction, setChooseAction] = useState<"exit" | "entry">("exit")
  const [plate, setPlate] = useState("")
  const [timestamp, setTimestamp] = useState("")
  const [lane, setLane] = useState("")
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [vehicle, setVehicle] = useState<Vehicle>("Ô tô")
  const [paymentMethod, setPaymentMethod] = useState<Method>("QR")
  const [reference, setReference] = useState("")
  const [error, setError] = useState("")
  const candidates = useMemo(() => mode === "choose" && !!search.trim()
    ? supplementTripCandidates(trips, state.tripUpdates.map(({ trip }) => trip), access, search)
    : { available: [], recorded: [], tooShort: false }, [mode, trips, state.tripUpdates, access, search])
  const [policyCode, setPolicyCode] = useState("")
  const [voucherText, setVoucherText] = useState("")
  const [evidence, setEvidence] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const commitKeys = useRef(new Map<string, string>())
  const committing = useRef(false)
  useEffect(() => {
    const urls = evidence.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [evidence])
  const start = (next: Mode, selection: Trip | null = null) => {
    const row = existing ?? selection
    setSelectedTrip(selection)
    setPlate(row?.plate ?? ""); setTimestamp(""); setLane(""); setReason("")
    setNote(""); setError(""); setVehicle(row?.vehicle ?? "Ô tô"); setMode(next)
    setPaymentMethod("QR"); setReference(""); setPolicyCode(""); setVoucherText(""); setEvidence([])
    if (service?.isDemo && row && (next === "entry" || next === "exit")) {
      const sampleTime = next === "exit" ? Math.min(row.entered + 180, vnNow()) : (row.exited ?? vnNow()) - 120
      setTimestamp(inputTime(sampleTime))
      setVoucherText(row.supplementalBilling?.discounts.filter((item) => item.kind === "voucher").map((item) => item.code).join(", ") || "")
    }
    if (next === "choose") { setSearch(""); setChooseAction("exit") }
  }
  const trip = existing ?? selectedTrip
  const permittedSites = new Set(allowedSites(access).map(({ id }) => id))
  const canAddExit = new Set(candidates.available.map((row) => row.id))
  const exitCandidates = normalizeTripSearch(search).length >= 3 ? [...candidates.available, ...candidates.recorded].slice(0, 20) : []
  const entryCandidates = pendingTrips.filter((row) => permittedSites.has(row.site) &&
    !candidates.tooShort && (!search.trim() || searchTrips(row, search))).slice(0, 20)
  const choices = chooseAction === "exit" ? exitCandidates : entryCandidates
  const estate = siteById(trip?.site ?? "")?.estate ?? ""
  const day = trip?.exited != null ? revenueDay(trip.exited, estate, state) : ""
  const shift = trip && day ? revenueShifts(trip.site, day, settings, state).find((shift) =>
    shift.parts.some((part) => trip.exited! >= part.from && trip.exited! < part.until)) : undefined
  const locked = !!shift && (!!state.closes[shift.id] || !!state.periods[`${estate}/${day.slice(0, 7)}`])
  const canEdit = !locked || revenueWrite(access, "adjust")
  const time = timeInput(timestamp)
  const service = feeService ?? getParkingFeeService()
  const exampleTrips = service?.isDemo ? trips.filter((row) => row.demoSupplement)
    .map((row) => state.tripUpdates.find((item) => item.trip.id === row.id)?.trip ?? row)
    .filter((row) => row.exited == null && row.entered <= vnNow() && permittedSites.has(row.site)) : []
  const entryAt = mode === "entry" ? time : trip?.entered
  const exitAt = mode === "exit" ? time : trip?.exited
  const feePlate = plate.trim().toUpperCase()
  const feeRequest: ParkingFeeRequest | null = revenueWrite(access, "trip") && (mode === "entry" || mode === "exit") && trip &&
    (feePlate || ((mode === "entry" ? vehicle : trip.vehicle) === "Xe đạp" && trip.ticket)) &&
    Number.isFinite(entryAt) && Number.isFinite(exitAt) && exitAt! > entryAt! && exitAt! <= vnNow()
    ? { direction: mode, tripId: trip.id, siteId: trip.site, plate: feePlate, ticket: trip.ticket,
      vehicle: mode === "entry" ? vehicle : trip.vehicle, customerGroup: trip.group,
      enteredAt: feeLocalTime(entryAt!), exitedAt: feeLocalTime(exitAt!),
      voucherCodes: [...new Set(voucherText.split(/[,;\n]/).map((value) => value.trim()).filter(Boolean))],
      ...(policyCode ? { requestedPolicyCode: policyCode } : {}) }
    : null
  const fee = useParkingSupplementFee(feeRequest, service)
  const processingPayment = fee.payBusy || fee.paymentPending
  const availablePolicies = state.policies.filter((row) => row.active &&
    (!row.sites.length || row.sites.includes(trip?.site || "")) && (!row.vehicle || row.vehicle === (mode === "entry" ? vehicle : trip?.vehicle)))
  const title = mode === "plate" ? "Sửa biển số" : mode === "exit" ? "Bổ sung giờ ra" : "Bổ sung giờ vào"
  const submit = async () => {
    if (committing.current) return
    if (!trip || !allowedSites(access).some((site) => site.id === trip.site)) { setError("Lượt xe ngoài phạm vi quyền."); return }
    const needsPlate = mode === "plate" || (mode === "entry" ? vehicle : trip.vehicle) !== "Xe đạp"
    if (needsPlate && !plate.trim() || plate.trim() && !/^[A-Za-z0-9.\s-]{1,32}$/.test(plate.trim())) { setError("Vui lòng nhập biển số hợp lệ."); return }
    if (!reason.trim() || reason === "Khác" && !note.trim()) { setError("Vui lòng nhập lý do và ghi chú khi chọn Khác."); return }
    if (mode === "plate") {
      const next = { ...trip, plate: plate.trim().toUpperCase(),
        issue: trip.issue?.kind === "Không nhận diện biển số" ? { ...trip.issue, verifiedAt: vnNow() } : trip.issue }
      if (save((latest) => applyRevenueTrip(latest, existing ?? selectedTrip ?? undefined, next, reason.trim(),
        trips, settings, actor, revenueWrite(access, "adjust")))) { setMode(null); notify("Đã cập nhật biển số.") }
      return
    }
    if (!lane || !Number.isFinite(time) || time > vnNow() || !feeRequest) {
      setError("Kiểm tra ngày, giờ và làn. Giờ ra phải sau giờ vào và không sau thời điểm hiện tại."); return
    }
    if (!reference.trim()) { setError("Nhập số biên bản hoặc mã xác minh cho lượt bổ sung."); return }
    if (!fee.valid || !fee.quote || !service?.completeSupplement || processingPayment) {
      setError("Cần có kết quả tính phí và đối soát thanh toán hợp lệ trước khi lưu."); return
    }
    const quoteError = parkingFeeQuoteError(fee.quote)
    if (quoteError) { setError(quoteError); return }
    const commitKey = `${fee.key}/${fee.quote.id}/${reference.trim()}`
    if (!commitKeys.current.has(commitKey)) commitKeys.current.set(commitKey, crypto.randomUUID())
    committing.current = true
    setSaving(true)
    setError("")
    try {
      const result = await service.completeSupplement({ quoteId: fee.quote.id, request: feeRequest, lane,
        reason: reason.trim(), reference: reference.trim(), note: note.trim(), evidence,
        idempotencyKey: commitKeys.current.get(commitKey)! })
      if (result.trip.id !== trip.id || result.trip.site !== trip.site || result.trip.group !== feeRequest.customerGroup || result.trip.entered !== entryAt ||
        result.trip.exited !== exitAt || result.trip.vehicle !== feeRequest.vehicle ||
        normalizeTripSearch(result.trip.plate) !== normalizeTripSearch(feeRequest.plate) ||
        result.billing.id !== fee.quote.id || result.billing.customerPayable !== fee.quote.customerPayable)
        throw new Error("Kết quả lưu chưa khớp với lượt xe và phí đã đối soát. Vui lòng kiểm tra lại.")
      const next = tripWithParkingBilling(result.trip, result.billing)
      const saved = save((latest) => applyRevenueTrip(latest, existing ?? selectedTrip ?? undefined, next,
        [reason.trim(), `Biên bản ${reference.trim()}`, note.trim()].filter(Boolean).join(" · "),
        trips, settings, actor, revenueWrite(access, "adjust")))
      if (saved) { setMode(null); notify(service.isDemo ? "Đã lưu lượt bổ sung và thanh toán mô phỏng." : "Đã lưu lượt bổ sung và kết quả đối soát tiền vé.") }
      else setError("Hệ thống đã xử lý lượt bổ sung nhưng dữ liệu hiển thị chưa được cập nhật. Vui lòng tải lại để đối chiếu.")
    } catch (error) { setError(error instanceof Error ? error.message : "Chưa lưu được lượt bổ sung.") }
    finally { committing.current = false; setSaving(false) }
  }
  if (!revenueWrite(access, "trip")) return null
  return <>
    {locked && <span title="Lượt thuộc ca đã chốt"><LockKeyhole size={15} /></span>}
    {existing && canEdit && <Button onClick={() => start("plate")}><Pencil size={15} />Sửa biển số</Button>}
    {existing && canEdit && existing.exited == null && <Button onClick={() => start("exit")}><Plus size={15} />Tạo bổ sung giờ ra</Button>}
    {!existing && <Button variant="primary" onClick={() => start("choose")}><Plus size={15} />Tạo lượt bổ sung</Button>}
    {mode === "choose" && <Overlay title="Tạo lượt bổ sung" wide onClose={() => setMode(null)}
      subtitle="Chọn loại bổ sung, tìm lượt xe, rồi nhập thông tin còn thiếu."
      footer={<Button onClick={() => setMode(null)}>Đóng</Button>}>
      <Segments options={["Bổ sung giờ ra", "Bổ sung giờ vào"]}
        value={chooseAction === "exit" ? "Bổ sung giờ ra" : "Bổ sung giờ vào"}
        change={(value) => { setChooseAction(value === "Bổ sung giờ ra" ? "exit" : "entry"); setSearch("") }} />
      <p className="parking-supplement-help">{chooseAction === "exit"
        ? "Chỉ bổ sung khi lượt chưa ghi nhận giờ ra và đã xác minh xe thực tế đã ra khỏi bãi. Trạng thái ‘Đang trong bãi’ tại mốc tra cứu trong quá khứ không có nghĩa là hiện tại lượt còn thiếu giờ ra."
        : "Dùng khi đã ghi nhận xe ra nhưng còn thiếu lượt vào. Chọn lượt cần bổ sung từ danh sách chờ đối soát."}</p>
      {service?.isDemo && <div className="parking-demo-notice">
        <strong>Dữ liệu và thanh toán mô phỏng</strong>
        <span>Chỉ dùng để thử giao diện, không phát sinh giao dịch thật.</span>
        {chooseAction === "exit" && exampleTrips.length > 0 && <div className="parking-inline">
          <span>Thử biển số:</span>{exampleTrips.map((row) => <Button key={row.id} variant="ghost" onClick={() => setSearch(row.plate)}>{row.plate}</Button>)}
        </div>}
      </div>}
      <Field label="Tìm lượt xe" hint={candidates.tooShort ? "Nhập ít nhất 3 chữ hoặc số, không tính dấu cách và dấu phân cách." : "Tìm trong toàn bộ dữ liệu được phân quyền, không giới hạn theo ngày hoặc bộ lọc của bảng tra cứu."}>
        <Input type="search" aria-label="Tìm lượt xe cần bổ sung" maxLength={100} value={search}
          placeholder={chooseAction === "exit" ? "Nhập biển số, mã lượt, mã thẻ hoặc mã vé" : "Nhập mã lượt, mã thẻ hoặc mã vé đang chờ đối soát"}
          onChange={(e) => setSearch(e.target.value)} />
      </Field>
      <div className="parking-supplement-results">
        <ParkingTable rows={choices} rowKey={(row) => row.id}
          empty={chooseAction === "exit" && !search.trim() ? "Nhập biển số hoặc mã thẻ / vé của lượt đã xác minh cần bổ sung giờ ra."
            : candidates.tooShort ? "Nhập thêm ký tự để tìm lượt xe." : "Không tìm thấy lượt phù hợp. Hãy kiểm tra biển số hoặc mã thẻ / vé và phạm vi bãi xe được phân quyền."}
          columns={[
            { label: "Biển số / Mã lượt", cell: (row) => <><strong>{row.plate || row.ticket}</strong><span className="parking-trip-reference">{row.id}</span></> },
            { label: "Bãi xe", cell: (row) => siteById(row.site)?.label },
            { label: "Giờ vào", cell: (row) => chooseAction === "entry" ? "Chưa ghi nhận" : displayTime(row.entered) },
            { label: "Giờ ra", cell: (row) => displayTime(row.exited) },
            { label: "Thao tác", cell: (row) => chooseAction === "entry" || canAddExit.has(row.id)
              ? <Button onClick={() => start(chooseAction, row)}>Chọn lượt này</Button>
              : <span className="field-hint">{row.exited !== null ? "Đã có giờ ra, không cần bổ sung." : "Chưa đến thời điểm xe vào."}</span> },
          ]} />
      </div>
      {chooseAction === "exit" && candidates.recorded.length > 0 && <p className="parking-supplement-help">
        Trạng thái ở bảng tra cứu được tính tại thời điểm kết thúc đã chọn. Lượt từng hiện “Đang trong bãi” có thể đã được ghi nhận giờ ra sau đó.
      </p>}
      {choices.length === 20 && <p className="field-hint">Đang hiển thị tối đa 20 lượt. Nhập đầy đủ biển số hoặc mã lượt để tìm chính xác.</p>}
    </Overlay>}
    {mode && mode !== "choose" && <Overlay title={title} wide={mode !== "plate"} onClose={() => { if (!saving) setMode(null) }} dismissOnBackdrop={!saving} footer={<>
      <Button disabled={saving || processingPayment} onClick={() => setMode(existing ? null : "choose")}>{existing ? "Hủy" : "Chọn lượt khác"}</Button><Button variant="primary" disabled={saving || (mode !== "plate" && (!fee.valid || !service?.completeSupplement || processingPayment))} onClick={submit}>{saving ? "Đang lưu…" : mode === "plate" ? "Lưu biển số" : "Lưu bổ sung và đối soát"}</Button></>}>
      <strong className="parking-selected-plate">{trip?.plate || trip?.ticket}</strong>
      <p className="muted">{trip?.id} · {siteById(trip?.site ?? "")?.label} · {trip?.vehicle} · {trip?.group} · {mode === "entry" ? `Ra ${displayTime(trip?.exited ?? null)}` : `Vào ${displayTime(trip?.entered ?? null)}`}</p>
      {service?.isDemo && mode !== "plate" && <div className="parking-demo-notice">
        <strong>Đang thử bằng dữ liệu mô phỏng</strong>
        <span>Ngày giờ đã được điền mẫu để xem tiền vé. Bạn có thể sửa lại; không có giao dịch thật.</span>
        <Button variant="ghost" onClick={() => {
          setLane(mode === "exit" ? "Làn ra 1" : "Làn vào 1")
          setReason("Làn lỗi không ghi nhận")
          setReference(`BB-DEMO-${trip?.id}`)
          setNote("Thông tin minh họa để thử quy trình bổ sung và thanh toán.")
        }}>Điền biên bản mẫu</Button>
      </div>}
      <div className={mode !== "plate" ? "parking-supplement-layout" : undefined}>
      <div>
      <fieldset disabled={saving || processingPayment} className="parking-supplement-fields">
      <div className="parking-form-grid">
        <Field label={mode === "plate" ? "Biển số mới" : "Biển số"} required={mode === "plate" || (mode === "entry" ? vehicle : trip?.vehicle) !== "Xe đạp"}><Input maxLength={32} value={plate} onChange={(e) => setPlate(e.target.value)} /></Field>
        {mode === "entry" && <Field label="Loại xe" required><Select value={vehicle} options={[...parkingVehicles]} onChange={(e) => setVehicle(e.target.value as Vehicle)} /></Field>}
        {mode !== "plate" && <>
          <Field label={mode === "exit" ? "Ngày ra" : "Ngày vào"} required>
            <Input type="date" aria-label={mode === "exit" ? "Ngày ra" : "Ngày vào"} max={inputTime(vnNow()).slice(0, 10)}
              value={timestamp.split("T")[0] || ""}
              onChange={(event) => setTimestamp(`${event.target.value}T${timestamp.split("T")[1] || ""}`)} />
          </Field>
          <Field label={mode === "exit" ? "Giờ ra" : "Giờ vào"} required>
            <Input type="time" aria-label={mode === "exit" ? "Giờ ra" : "Giờ vào"} lang="vi-VN" step={60}
              value={timestamp.split("T")[1] || ""}
              onChange={(event) => setTimestamp(`${timestamp.split("T")[0] || ""}T${event.target.value}`)} />
          </Field>
          <Field label={mode === "exit" ? "Làn ra" : "Làn vào"} required><Select value={lane}
            options={[allOption("Chọn làn"), ...[1, 2].map((id) => `Làn ${mode === "exit" ? "ra" : "vào"} ${id}`)]} onChange={(e) => setLane(e.target.value)} /></Field>
        </>}
        {mode === "plate" ? <Field label="Lý do" required><Textarea maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          <span className="character-count">{reason.length}/500</span></Field> :
          <><Field label="Lý do bổ sung" required><Select value={reason} options={[allOption("Chọn lý do"),
            mode === "exit" ? "Xe vào lại khi lượt cũ chưa ra" : "Xe ra không có lượt vào", "Mất điện", "Làn lỗi không ghi nhận", "Khác"]} onChange={(e) => setReason(e.target.value)} /></Field>
            <Field label="Ghi chú" required={reason === "Khác"}><Textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
              <span className="character-count">{note.length}/500</span></Field></>}
      </div>
      {mode !== "plate" && <>
        <div className="parking-form-grid mt-3">
          <Field label="Số biên bản / Mã xác minh" required><Input aria-label="Số biên bản / Mã xác minh" value={reference} maxLength={100} onChange={(event) => setReference(event.target.value)} /></Field>
          <Field label="Chính sách đề nghị áp dụng" hint="Hệ thống kiểm tra điều kiện trước khi áp dụng.">
            <Select aria-label="Chính sách đề nghị áp dụng" value={policyCode}
              options={[allOption("Tự động theo chính sách hiện hành"), ...availablePolicies.map((row) => ({ value: row.code, label: row.name }))]}
              onChange={(event) => setPolicyCode(event.target.value)} />
          </Field>
          <Field label="Mã voucher" hint="Để trống nếu không có. Có thể nhập nhiều mã, cách nhau bằng dấu phẩy.">
            <Input aria-label="Mã voucher" maxLength={300} value={voucherText} onChange={(event) => setVoucherText(event.target.value)} />
          </Field>
          <Field label="Ảnh xác minh" hint="Ảnh được gửi kèm yêu cầu lưu lượt bổ sung.">
            <Input aria-label="Ảnh xác minh" type="file" accept="image/*" multiple onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              if (files.length > 4 || files.some((file) => !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)) {
                setError("Chọn tối đa 4 ảnh, mỗi ảnh không quá 10 MB."); return
              }
              setEvidence(files); setError("")
            }} />
          </Field>
        </div>
        <div className="parking-supplement-photos">
          <div><strong>Ảnh chiều vào</strong>{trip?.photoIn ? <img src={trip.photoIn} alt="Ảnh xe vào đã ghi nhận" /> : <p>Chưa có ảnh</p>}</div>
          <div><strong>Ảnh chiều ra</strong>{trip?.photoOut ? <img src={trip.photoOut} alt="Ảnh xe ra đã ghi nhận" /> : <p>Chưa có ảnh</p>}</div>
          {previews.map((url, index) => <div key={url}><strong>{evidence[index]?.name}</strong><img src={url} alt={`Ảnh xác minh ${index + 1}`} /></div>)}
        </div>
      </>}
      </fieldset>
      </div>
      {mode !== "plate" && <ParkingSupplementBilling fee={fee} service={service} method={paymentMethod} changeMethod={setPaymentMethod} disabled={saving} />}
      </div>
      {error && <p className="field-message" role="alert">{error}</p>}
    </Overlay>}
  </>
}
