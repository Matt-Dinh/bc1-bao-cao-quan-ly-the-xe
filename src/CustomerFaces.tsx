import { useEffect, useRef, useState } from "react"
import { Camera, ImageOff, ScanFace, Upload, X } from "lucide-react"
import { Button, Field, Select } from "./ui"
import { faceAngles, maxFaceBytes } from "./customer-faces"
import type { FacePhoto } from "./customer-faces"

interface Props {
  value?: FacePhoto[]
  onChange?: (photos: FacePhoto[]) => void
  onBusyChange?: (busy: boolean) => void
}

export default function CustomerFaces({ value = [], onChange, onBusyChange }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const request = useRef(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => () => { request.current++; onBusyChange?.(false) }, [onBusyChange])

  async function upload(file?: File) {
    if (!file) return
    setError("")
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Chỉ nhận ảnh JPG hoặc PNG.")
      return
    }
    if (file.size > maxFaceBytes || !file.size) {
      setError("Chọn ảnh có dung lượng lớn hơn 0 và không quá 5 MB.")
      return
    }
    const current = ++request.current
    setBusy(true)
    onBusyChange?.(true)
    try {
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error("Không đọc được ảnh. Vui lòng chọn lại."))
        reader.readAsDataURL(file)
      })
      await new Promise<void>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve()
        image.onerror = () => reject(new Error("Tệp không phải ảnh hợp lệ. Vui lòng chọn lại."))
        image.src = src
      })
      if (current === request.current)
        onChange?.([{ angle: "CENTER", src }, ...value.filter((photo) => photo.angle !== "CENTER")])
    } catch (cause) {
      if (current === request.current) setError(cause instanceof Error ? cause.message : "Không đọc được ảnh.")
    } finally {
      if (current === request.current) { setBusy(false); onBusyChange?.(false) }
    }
  }

  return <section className="sm-faces" aria-label="Đăng ký khuôn mặt">
    <div className="sm-faces-heading">
      <ScanFace size={19} />
      <div><h3>Khuôn mặt</h3><p>Tối đa 5 ảnh, mỗi góc chụp 1 ảnh dùng để nhận diện khách hàng.</p></div>
    </div>
    {onChange && <>
      <Field label="Thiết bị đăng ký">
        <Select aria-label="Thiết bị đăng ký khuôn mặt" disabled value=""
          options={[{ value: "", label: "Chưa có camera khuôn mặt được kết nối" }]} />
      </Field>
      <p className="sm-face-hint">Ảnh chính diện có thể tải từ máy (JPG, PNG, tối đa 5 MB). Các góc còn lại chỉ chụp từ thiết bị và cần có ảnh chính diện trước.</p>
      <input ref={input} type="file" accept="image/jpeg,image/png" className="sm-face-file"
        aria-label="Tải ảnh khuôn mặt chính diện" disabled={busy}
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file) }} />
    </>}
    <div className="sm-faces-count" aria-live="polite">Ảnh khuôn mặt ({value.length}/5){busy && " · Đang đọc ảnh…"}</div>
    <div className="sm-face-grid">
      {faceAngles.map((angle) => {
        const photo = value.find((item) => item.angle === angle.value)
        return <div className="sm-face-card" key={angle.value}>
          <h4>{angle.label}</h4>
          <div className="sm-face-preview">
            {photo ? <img src={photo.src} alt={angle.label} /> : <span><ImageOff size={23} />Chưa có ảnh</span>}
          </div>
          {onChange && <div className="sm-face-actions">
            {angle.value === "CENTER" && <Button disabled={busy} onClick={() => input.current?.click()}>
              <Upload size={13} />{photo ? "Đổi ảnh" : "Tải ảnh"}
            </Button>}
            <Button disabled title="Chưa có camera khuôn mặt được kết nối">
              <Camera size={13} />Chụp từ thiết bị
            </Button>
            {photo && <Button variant="ghost" disabled={busy} aria-label={`Xóa ${angle.label.toLocaleLowerCase("vi")}`}
              onClick={() => {
                setError("")
                // Other poses depend on the center image belonging to the same capture set.
                onChange(angle.value === "CENTER" ? [] : value.filter((item) => item.angle !== angle.value))
              }}><X size={13} />{angle.value === "CENTER" && value.length > 1 ? "Xóa bộ ảnh" : "Xóa ảnh"}</Button>}
          </div>}
        </div>
      })}
    </div>
    {onChange && <p className="sm-face-hint">Chụp từ thiết bị sẽ khả dụng khi có camera khuôn mặt được kết nối. Ảnh đã chọn chỉ được lưu khi bấm “Lưu thông tin”.</p>}
    {error && <p className="sm-face-error" role="alert">{error}</p>}
  </section>
}
