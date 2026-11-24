import { useState } from "react"
import { Plus, Trash2, Calculator } from "lucide-react"
import { Button, Field, Input, Select, Textarea } from "./ui"
import type { ManagedService } from "./subscription-model"
import {
  estimateServicePrice,
  newServicePrice,
  priceKinds,
  servicePrices,
} from "./service-pricing"
import type { ServicePrice, PriceEstimate } from "./service-pricing"
import { date, fmt, today } from "./data"

const weekdays = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" },
]
export default function ServicePricing({
  service,
  onChange,
}: {
  service: ManagedService
  onChange?: (prices: ServicePrice[]) => void
}) {
  const prices = servicePrices(service)
  const [entry, setEntry] = useState(`${today}T08:00`),
    [exit, setExit] = useState(`${today}T10:00`)
  const [vinfast, setVinfast] = useState(false),
    [used, setUsed] = useState(0)
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null),
    [error, setError] = useState("")
  // Derived results must never survive edits to their inputs or to the service draft.
  const signature = JSON.stringify([
    prices,
    service.category,
    service.vehicle,
    entry,
    exit,
    vinfast,
    used,
  ])
  const [calculatedFor, setCalculatedFor] = useState("")
  const update = (id: string, patch: Partial<ServicePrice>) =>
    onChange?.(prices.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const number = (
    label: string,
    value: number,
    onValue: (v: number) => void,
    min = 0,
    max = 100000000,
  ) => (
    <Field label={label} required>
      <Input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={1}
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) =>
          onValue(e.target.value === "" ? NaN : Number(e.target.value))
        }
      />
    </Field>
  )
  const time = (label: string, value: string, onValue: (v: string) => void) => (
    <Field label={label} required>
      <Input
        aria-label={label}
        value={value}
        placeholder="HH:mm"
        maxLength={5}
        onChange={(e) => onValue(e.target.value)}
      />
    </Field>
  )
  return (
    <section className="sm-pricing" aria-label="Quản lý biểu giá">
      <div className="sm-section-label">
        <h3 className="sm-subheading">Quản lý biểu giá</h3>
        <span>{prices.length} biểu giá</span>
        {onChange && (
          <Button
            className="sm-price-add"
            disabled={prices.length >= 100}
            onClick={() =>
              onChange([
                ...prices,
                newServicePrice(
                  today,
                  service.category === "Thuê bao"
                    ? "Theo tháng"
                    : "Theo khung giờ",
                ),
              ])
            }
          >
            <Plus size={14} />
            Thêm biểu giá
          </Button>
        )}
      </div>
      {prices.map((p, index) => (
        <details className="sm-price-card" key={p.id} open>
          <summary>
            <strong>{p.name || `Biểu giá ${index + 1}`}</strong>
            <span>
              {p.kind} · {date(p.from)} – {p.to ? date(p.to) : "Không giới hạn"}
            </span>
          </summary>
          {onChange ? (
            <div className="sm-price-body">
              <div className="sm-form-grid">
                <Field label="Tên biểu giá" required>
                  <Input
                    aria-label={`Tên biểu giá ${index + 1}`}
                    maxLength={120}
                    value={p.name}
                    onChange={(e) => update(p.id, { name: e.target.value })}
                  />
                </Field>
                <Field label="Loại tính giá" required>
                  <Select
                    aria-label={`Loại tính giá ${index + 1}`}
                    value={p.kind}
                    onChange={(e) =>
                      update(p.id, {
                        kind: e.target.value as ServicePrice["kind"],
                      })
                    }
                    options={
                      priceKinds.filter((k) =>
                        service.category === "Thuê bao"
                          ? ["Theo tháng", "Miễn phí"].includes(k)
                          : k !== "Theo tháng" &&
                            (service.vehicle !== "Ô tô" || k !== "Theo chu kỳ"),
                      )
                    }
                  />
                </Field>
                <Field label="Biểu giá hiệu lực từ" required>
                  <Input
                    type="date"
                    aria-label={`Biểu giá ${index + 1} từ`}
                    value={p.from}
                    onChange={(e) => update(p.id, { from: e.target.value })}
                  />
                </Field>
                <Field label="Biểu giá hiệu lực đến">
                  <Input
                    type="date"
                    aria-label={`Biểu giá ${index + 1} đến`}
                    min={p.from}
                    value={p.to}
                    onChange={(e) => update(p.id, { to: e.target.value })}
                  />
                </Field>
              </div>
              <div className="sm-weekdays">
                <strong>Ngày áp dụng *</strong>
                {weekdays.map((d) => (
                  <label key={d.value}>
                    <input
                      type="checkbox"
                      checked={p.days.includes(d.value)}
                      onChange={(e) =>
                        update(p.id, {
                          days: e.target.checked
                            ? [...p.days, d.value]
                            : p.days.filter((v) => v !== d.value),
                        })
                      }
                    />
                    {d.label}
                  </label>
                ))}
              </div>
              {["Theo tháng", "Theo lượt", "Theo block thời gian"].includes(
                p.kind,
              ) && (
                <div className="sm-form-grid">
                  {number(
                    p.kind === "Theo tháng"
                      ? "Giá tháng (đ)"
                      : p.kind === "Theo lượt"
                        ? "Giá lượt (đ)"
                        : "Giá mỗi block (đ)",
                    p.amount,
                    (v) => update(p.id, { amount: v }),
                  )}
                  {p.kind === "Theo block thời gian" &&
                    number(
                      "Độ dài block (phút)",
                      p.blockMinutes,
                      (v) => update(p.id, { blockMinutes: v }),
                      1,
                      1440,
                    )}
                  {p.kind === "Theo tháng" && (
                    <>
                      {time("Giờ bắt đầu gói tháng", p.start, (v) =>
                        update(p.id, { start: v }),
                      )}
                      {time("Giờ kết thúc gói tháng", p.end, (v) =>
                        update(p.id, { end: v }),
                      )}
                    </>
                  )}
                </div>
              )}
              {["Theo chu kỳ", "Theo khung giờ"].includes(p.kind) && (
                <>
                  <div className="sm-section-label">
                    <strong>Khung giá ban ngày</strong>
                    <Button
                      onClick={() =>
                        update(p.id, {
                          windows: [
                            ...p.windows,
                            {
                              id: crypto.randomUUID(),
                              from: "06:00",
                              to: "22:00",
                              price: 0,
                              minutes: 60,
                            },
                          ],
                        })
                      }
                      disabled={p.windows.length >= 48}
                    >
                      <Plus size={13} />
                      Thêm khung giá
                    </Button>
                  </div>
                  {p.windows.map((w, i) => (
                    <div
                      key={w.id}
                      className="sm-window-row"
                      aria-label={`Khung giá ${i + 1}`}
                    >
                      {time(`Khung ${i + 1} từ`, w.from, (v) =>
                        update(p.id, {
                          windows: p.windows.map((r) =>
                            r.id === w.id ? { ...r, from: v } : r,
                          ),
                        }),
                      )}
                      {time(`Khung ${i + 1} đến`, w.to, (v) =>
                        update(p.id, {
                          windows: p.windows.map((r) =>
                            r.id === w.id ? { ...r, to: v } : r,
                          ),
                        }),
                      )}
                      {number(`Khung ${i + 1} giá (đ)`, w.price, (v) =>
                        update(p.id, {
                          windows: p.windows.map((r) =>
                            r.id === w.id ? { ...r, price: v } : r,
                          ),
                        }),
                      )}
                      {p.kind !== "Theo chu kỳ" &&
                        number(
                          `Khung ${i + 1} phút/block`,
                          w.minutes,
                          (v) =>
                            update(p.id, {
                              windows: p.windows.map((r) =>
                                r.id === w.id ? { ...r, minutes: v } : r,
                              ),
                            }),
                          1,
                          1440,
                        )}
                      <Button
                        variant="ghost"
                        aria-label={`Xóa khung giá ${i + 1}`}
                        onClick={() =>
                          update(p.id, {
                            windows: p.windows.filter((r) => r.id !== w.id),
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                  <p className="sm-note">
                    Giờ kết thúc không tính vào khung hiện tại. Dùng 00:00–24:00
                    cho cả ngày; có thể nhập khung qua nửa đêm, ví dụ
                    22:00–06:00. Giá chu kỳ tính một lần cho mỗi khung/ngày; giá
                    khung giờ làm tròn lên theo số phút/block.
                  </p>
                  <label className="sm-check">
                    <input
                      type="checkbox"
                      checked={p.overnight}
                      onChange={(e) =>
                        update(p.id, { overnight: e.target.checked })
                      }
                    />
                    Giá qua đêm
                  </label>
                  {p.overnight && (
                    <div className="sm-form-grid">
                      {time("Giờ đêm từ", p.nightStart, (v) =>
                        update(p.id, { nightStart: v }),
                      )}
                      {time("Giờ đêm đến", p.nightEnd, (v) =>
                        update(p.id, { nightEnd: v }),
                      )}
                      {number("Giá mỗi đêm (đ)", p.nightPrice, (v) =>
                        update(p.id, { nightPrice: v }),
                      )}
                    </div>
                  )}
                  <label className="sm-check">
                    <input
                      type="checkbox"
                      checked={p.free}
                      onChange={(e) => update(p.id, { free: e.target.checked })}
                    />
                    Miễn phí thời gian đầu
                  </label>
                  {p.free && (
                    <div className="sm-form-grid">
                      {time("Khung miễn phí từ", p.freeStart, (v) =>
                        update(p.id, { freeStart: v }),
                      )}
                      {time("Khung miễn phí đến", p.freeEnd, (v) =>
                        update(p.id, { freeEnd: v }),
                      )}
                      {number(
                        "Số phút miễn phí",
                        p.freeMinutes,
                        (v) => update(p.id, { freeMinutes: v }),
                        1,
                        1440,
                      )}
                      {number(
                        "Số lượt miễn phí/ngày",
                        p.freeTurns,
                        (v) => update(p.id, { freeTurns: v }),
                        1,
                        100,
                      )}
                      <label className="sm-check">
                        <input
                          type="checkbox"
                          checked={p.vinfastOnly}
                          onChange={(e) =>
                            update(p.id, { vinfastOnly: e.target.checked })
                          }
                        />
                        Chỉ xe điện VinFast
                      </label>
                    </div>
                  )}
                  <label className="sm-check">
                    <input
                      type="checkbox"
                      checked={p.cumulative}
                      onChange={(e) =>
                        update(p.id, { cumulative: e.target.checked })
                      }
                    />
                    Cộng dồn các khung đã gửi
                  </label>
                  <p className="sm-note">
                    Bật: cộng phí từng khung đã sử dụng và giá đêm. Tắt: dùng
                    mức giá của khung ban ngày cuối cùng cho thời gian ban ngày,
                    cộng từng đêm đã gửi.
                  </p>
                </>
              )}
              <Field label="Mô tả biểu giá">
                <Textarea
                  aria-label={`Mô tả biểu giá ${index + 1}`}
                  maxLength={500}
                  value={p.note}
                  onChange={(e) => update(p.id, { note: e.target.value })}
                />
              </Field>
              <Button
                variant="ghost"
                aria-label={`Xóa biểu giá ${index + 1}`}
                onClick={() => onChange(prices.filter((r) => r.id !== p.id))}
              >
                <Trash2 size={14} />
                Xóa biểu giá
              </Button>
            </div>
          ) : (
            <div className="sm-price-body">
              <p>
                Ngày áp dụng:{" "}
                {weekdays
                  .filter((d) => p.days.includes(d.value))
                  .map((d) => d.label)
                  .join(", ")}
              </p>
              {["Theo tháng", "Theo lượt", "Theo block thời gian"].includes(
                p.kind,
              ) && (
                <p>
                  {fmt(p.amount)} đ
                  {p.kind === "Theo tháng"
                    ? `/tháng · ${p.start}–${p.end}`
                    : p.kind === "Theo lượt"
                      ? "/lượt"
                      : `/${p.blockMinutes} phút`}
                </p>
              )}
              {["Theo khung giờ", "Theo chu kỳ"].includes(p.kind) && (
                <>
                  {p.windows.map((w) => (
                    <p key={w.id}>
                      {w.from}–{w.to}: {fmt(w.price)} đ/
                      {p.kind === "Theo chu kỳ"
                        ? "chu kỳ"
                        : `${w.minutes} phút`}
                    </p>
                  ))}
                  <p>
                    {p.cumulative ? "Cộng dồn" : "Tính theo khung cuối"}
                    {p.overnight
                      ? ` · Qua đêm ${p.nightStart}–${p.nightEnd}: ${fmt(p.nightPrice)} đ`
                      : ""}
                  </p>
                  {p.free && (
                    <p>
                      Miễn {p.freeMinutes} phút đầu khi vào {p.freeStart}–
                      {p.freeEnd}, tối đa {p.freeTurns} lượt/ngày
                      {p.vinfastOnly ? ", chỉ xe điện VinFast" : ""}.
                    </p>
                  )}
                </>
              )}
              {p.note && <p>{p.note}</p>}
            </div>
          )}
        </details>
      ))}
      <h3 className="sm-subheading">
        <Calculator size={15} /> Bảng dự tính tiền
      </h3>
      <div className="sm-form-grid">
        <Field label="Thời gian vào" required>
          <Input
            type="datetime-local"
            aria-label="Thời gian vào dự tính"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
        </Field>
        <Field label="Thời gian ra" required>
          <Input
            type="datetime-local"
            aria-label="Thời gian ra dự tính"
            value={exit}
            onChange={(e) => setExit(e.target.value)}
          />
        </Field>
        <Field label="Số lượt đã được miễn trong ngày">
          <Input
            type="number"
            aria-label="Số lượt đã miễn"
            min={0}
            step={1}
            value={used}
            onChange={(e) => setUsed(Number(e.target.value))}
          />
        </Field>
        <label className="sm-check">
          <input
            type="checkbox"
            checked={vinfast}
            onChange={(e) => setVinfast(e.target.checked)}
          />
          Xe điện VinFast
        </label>
      </div>
      <p className="sm-note">
        Thời gian theo giờ Việt Nam. Giá tháng tính trọn từng tháng dương lịch
        có sử dụng; block lẻ làm tròn lên. Tiền dự tính chưa áp dụng voucher.
      </p>
      <Button
        onClick={() => {
          try {
            setEstimate(
              estimateServicePrice(service, entry, exit, {
                vinfast,
                previousFreeTurns: used,
              }),
            )
            setError("")
          } catch (e) {
            setEstimate(null)
            setError((e as Error).message)
          }
          setCalculatedFor(signature)
        }}
      >
        Tính tiền
      </Button>
      {calculatedFor !== signature && calculatedFor && (
        <p className="sm-note">
          Thông tin đã thay đổi. Bấm Tính tiền để cập nhật kết quả.
        </p>
      )}
      {calculatedFor === signature && error && (
        <p role="alert" className="sm-error">
          {error}
        </p>
      )}
      {calculatedFor === signature && estimate && (
        <div className="sm-estimate" aria-live="polite">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Khoản tính</th>
                  <th>Số lượng</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {estimate.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.label}</td>
                    <td>{l.quantity}</td>
                    <td>{fmt(l.price)} đ</td>
                    <td>{fmt(l.total)} đ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {estimate.freeMinutes > 0 && (
            <p>
              Đã miễn {Math.round(estimate.freeMinutes * 100) / 100} phút đầu.
            </p>
          )}
          <strong>Tổng dự tính: {fmt(estimate.total)} đ</strong>
        </div>
      )}
    </section>
  )
}
