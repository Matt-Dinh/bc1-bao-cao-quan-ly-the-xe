import type { ManagedService } from "./subscription-model"

export const priceKinds = [
  "Theo tháng",
  "Theo chu kỳ",
  "Theo khung giờ",
  "Theo block thời gian",
  "Theo lượt",
  "Miễn phí",
] as const
export type PriceKind = typeof priceKinds[number]
export interface PriceWindow {
  id: string
  from: string
  to: string
  price: number
  minutes: number
}
export interface ServicePrice {
  id: string
  name: string
  kind: PriceKind
  from: string
  to: string
  days: number[]
  start: string
  end: string
  amount: number
  blockMinutes: number
  cumulative: boolean
  windows: PriceWindow[]
  overnight: boolean
  nightStart: string
  nightEnd: string
  nightPrice: number
  free: boolean
  freeStart: string
  freeEnd: string
  freeMinutes: number
  freeTurns: number
  vinfastOnly: boolean
  note: string
}
export const newServicePrice = (
  from: string,
  kind: PriceKind = "Theo tháng",
): ServicePrice => ({
  id: `BG-${crypto.randomUUID()}`,
  name: "Biểu giá mới",
  kind,
  from,
  to: "",
  days: [1, 2, 3, 4, 5, 6, 0],
  start: "00:00",
  end: "24:00",
  amount: 0,
  blockMinutes: 60,
  cumulative: true,
  windows: [
    {
      id: `KG-${crypto.randomUUID()}`,
      from: "00:00",
      to: "24:00",
      price: 0,
      minutes: 60,
    },
  ],
  overnight: false,
  nightStart: "22:00",
  nightEnd: "06:00",
  nightPrice: 0,
  free: false,
  freeStart: "00:00",
  freeEnd: "24:00",
  freeMinutes: 15,
  freeTurns: 1,
  vinfastOnly: false,
  note: "",
})
export function servicePrices(service: ManagedService): ServicePrice[] {
  if (service.prices) return service.prices
  // A legacy single price becomes one complete schedule without discarding its amount.
  return [
    {
      ...newServicePrice(
        service.validFrom || "1970-01-01",
        service.pricing === "Theo giờ" ? "Theo khung giờ" : service.pricing,
      ),
      id: `BG-${service.id || "moi"}`,
      name: "Biểu giá hiện tại",
      to: service.validTo || "",
      amount: service.price,
      windows: [
        {
          id: "KG-1",
          from: "00:00",
          to: "24:00",
          price: service.price,
          minutes: 60,
        },
      ],
    },
  ]
}
const dayMs = 86400000,
  minuteMs = 60000
const fail = (message: string): never => {
  throw new Error(message)
}
export const timeMinute = (value: string) =>
  value === "24:00"
    ? 1440
    : /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
      ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
      : NaN
const validDay = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v
const ranges = (from: string, to: string): number[][] => {
  const a = timeMinute(from),
    b = timeMinute(to)
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b || a === 1440)
    fail(
      "Khung giờ cần giờ bắt đầu/kết thúc hợp lệ, khác nhau; dùng 00:00–24:00 cho cả ngày.",
    )
  return b > a
    ? [[a, b]]
    : [
        [a, 1440],
        [0, b],
      ]
}
const money = (n: number) => {
  if (!Number.isSafeInteger(n) || n < 0 || n > 100000000)
    fail("Giá phải là số nguyên từ 0 đến 100.000.000 đồng.")
}
const overlap = (a: number[][], b: number[][]) =>
  a.some(([x, y]) => b.some(([u, v]) => Math.max(x, u) < Math.min(y, v)))
export function validateServicePrices(
  prices: ServicePrice[],
  category: string,
  vehicle: string,
) {
  if (!prices.length || prices.length > 100)
    fail("Dịch vụ cần từ 1 đến 100 biểu giá.")
  if (new Set(prices.map((p) => p.id)).size !== prices.length)
    fail("Mã biểu giá bị trùng.")
  for (const p of prices) {
    if (!p.name.trim() || !priceKinds.includes(p.kind))
      fail("Nhập tên và chọn loại tính giá hợp lệ.")
    if (!validDay(p.from) || (p.to && (!validDay(p.to) || p.to < p.from)))
      fail("Kiểm tra thời gian hiệu lực của biểu giá.")
    if (
      !p.days.length ||
      new Set(p.days).size !== p.days.length ||
      p.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    )
      fail("Chọn ngày áp dụng hợp lệ, không trùng ngày.")
    if (category === "Thuê bao" && !["Theo tháng", "Miễn phí"].includes(p.kind))
      fail("Dịch vụ Thuê bao dùng biểu giá Theo tháng hoặc Miễn phí.")
    if (category === "Vãng lai" && p.kind === "Theo tháng")
      fail("Dịch vụ Vãng lai không dùng biểu giá Theo tháng.")
    if (p.kind === "Theo chu kỳ" && vehicle === "Ô tô")
      fail(
        "Ô tô dùng giá Theo khung giờ hoặc Theo block thời gian; giá chu kỳ dùng cho xe máy/xe đạp.",
      )
    if (["Theo tháng", "Theo lượt", "Theo block thời gian"].includes(p.kind))
      money(p.amount)
    if (p.kind === "Theo tháng") ranges(p.start, p.end)
    if (
      p.kind === "Theo block thời gian" &&
      (!Number.isInteger(p.blockMinutes) ||
        p.blockMinutes < 1 ||
        p.blockMinutes > 1440)
    )
      fail("Độ dài block từ 1 đến 1.440 phút.")
    if (["Theo khung giờ", "Theo chu kỳ"].includes(p.kind)) {
      if (
        !p.windows.length ||
        p.windows.length > 48 ||
        new Set(p.windows.map((w) => w.id)).size !== p.windows.length
      )
        fail("Nhập từ 1 đến 48 khung giá, không trùng mã.")
      p.windows.forEach((w, i) => {
        money(w.price)
        ranges(w.from, w.to)
        if (!Number.isInteger(w.minutes) || w.minutes < 1 || w.minutes > 1440)
          fail("Chu kỳ tính tiền từ 1 đến 1.440 phút.")
        if (
          p.windows
            .slice(i + 1)
            .some((v) => overlap(ranges(w.from, w.to), ranges(v.from, v.to)))
        )
          fail("Các khung giá trong cùng biểu giá không được chồng giờ.")
      })
      if (p.overnight) {
        money(p.nightPrice)
        ranges(p.nightStart, p.nightEnd)
        if (
          p.windows.some((w) =>
            overlap(ranges(w.from, w.to), ranges(p.nightStart, p.nightEnd)),
          )
        )
          fail("Giá đêm và khung giá ban ngày không được chồng giờ.")
      }
      if (p.free) {
        ranges(p.freeStart, p.freeEnd)
        if (
          !Number.isInteger(p.freeMinutes) ||
          p.freeMinutes < 1 ||
          p.freeMinutes > 1440 ||
          !Number.isInteger(p.freeTurns) ||
          p.freeTurns < 1 ||
          p.freeTurns > 100
        )
          fail(
            "Thời gian miễn phí từ 1–1.440 phút; số lượt miễn phí/ngày từ 1–100.",
          )
      }
    }
  }
  // Dates are inclusive. Separate schedules may share dates only on different weekdays.
  prices.forEach((p, i) => prices.slice(i + 1).forEach((q) => {
      const start = Math.max(Date.parse(p.from), Date.parse(q.from)),
        end = Math.min(
          Date.parse(p.to || "9999-12-31"),
          Date.parse(q.to || "9999-12-31"),
        )
      const common = p.days.filter((d) => q.days.includes(d))
      if (
        start <= end &&
        common.length &&
        Array.from(
          { length: Math.min(7, Math.floor((end - start) / dayMs) + 1) },
          (_, n) => new Date(start + n * dayMs).getUTCDay(),
        ).some((d) => common.includes(d))
      )
        fail(
          `Biểu giá “${p.name}” và “${q.name}” trùng ngày hiệu lực/ngày trong tuần.`,
        )
    }))
}
export interface PriceEstimate {
  total: number
  lines: { label: string; quantity: number; price: number; total: number }[]
  freeMinutes: number
}
const wallDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) && validDay(s.slice(0, 10))
    ? Date.parse(`${s}Z`)
    : NaN
export function serviceCoversPeriod(
  service: ManagedService,
  from: string,
  to: string,
) {
  if (!service.prices) return true
  const prices = service.prices
  if (!prices.length) return false
  // For an open-ended subscription, check every transition and a final full week.
  const lastChange = Math.max(
    Date.parse(from),
    ...prices.flatMap((p) => [
      Date.parse(p.from),
      ...(p.to ? [Date.parse(p.to) + dayMs] : []),
    ]),
  )
  const end = to ? Date.parse(to) : lastChange + 7 * dayMs
  if (!validDay(from) || (to && !validDay(to)) || end < Date.parse(from))
    return false
  const transitions = [
    Date.parse(from),
    end + dayMs,
    ...prices.flatMap((p) => [
      Date.parse(p.from),
      ...(p.to ? [Date.parse(p.to) + dayMs] : []),
    ]),
  ]
    .filter((t) => t >= Date.parse(from) && t <= end + dayMs)
    .sort((a, b) => a - b)
  for (let i = 0; i < transitions.length - 1; i++)
    for (
      let t = transitions[i];
      t < Math.min(transitions[i + 1], transitions[i] + 7 * dayMs);
      t += dayMs
    ) {
      const d = new Date(t),
        day = d.toISOString().slice(0, 10)
      if (
        !prices.some(
          (p) =>
            p.from <= day &&
            (!p.to || p.to >= day) &&
            p.days.includes(d.getUTCDay()),
        )
      )
        return false
    }
  return true
}
export function estimateServicePrice(
  service: ManagedService,
  entry: string,
  exit: string,
  options = { vinfast: false, previousFreeTurns: 0 },
): PriceEstimate {
  const prices = servicePrices(service)
  validateServicePrices(prices, service.category, service.vehicle)
  const a = wallDate(entry),
    b = wallDate(exit)
  if (
    !Number.isFinite(a) ||
    !Number.isFinite(b) ||
    b <= a ||
    b - a > 366 * dayMs
  )
    fail("Nhập thời gian vào/ra hợp lệ, giờ ra sau giờ vào và tối đa 366 ngày.")
  if (
    !Number.isInteger(options.previousFreeTurns) ||
    options.previousFreeTurns < 0
  )
    fail("Số lượt đã miễn trong ngày phải là số nguyên không âm.")
  const lines = new Map<string, {
    label: string
    quantity: number
    price: number
    total: number
  }>()
  let freeMinutes = 0
  const add = (key: string, label: string, quantity: number, price: number) => {
    const old = lines.get(key)
    if (old) {
      old.quantity += quantity
      old.total += quantity * price
    } else lines.set(key, { label, quantity, price, total: quantity * price })
  }
  const active = (t: number) => {
    const d = new Date(t),
      day = d.toISOString().slice(0, 10)
    return prices.find(
      (p) =>
        p.from <= day &&
        (!p.to || p.to >= day) &&
        p.days.includes(d.getUTCDay()),
    )
  }
  const contains = (from: string, to: string, m: number) =>
    ranges(from, to).some(([s, e]) => m >= s && m < e)
  const seenMonths = new Set<string>(),
    seenTurns = new Set<string>(),
    nights = new Set<string>()
  const durations = new Map<string, {
    p: ServicePrice
    w: PriceWindow
    minutes: number
  }>()
  const nonNight = new Map<string, number>()
  const lastWindows = new Map<string, PriceWindow>()
  // Split on each minute (including partial first/last minutes) so dates, weekdays,
  // midnight and tariff boundaries remain independent of the host timezone/DST.
  const entryPrice = active(a),
    entryMinute = new Date(a).getUTCHours() * 60 + new Date(a).getUTCMinutes()
  const freeUntil =
    entryPrice?.free &&
    ["Theo khung giờ", "Theo chu kỳ"].includes(entryPrice.kind) &&
    (!entryPrice.vinfastOnly || options.vinfast) &&
    options.previousFreeTurns < entryPrice.freeTurns &&
    contains(entryPrice.freeStart, entryPrice.freeEnd, entryMinute)
      ? a + entryPrice.freeMinutes * minuteMs
      : a
  for (let t = a; t < b; ) {
    const next = Math.min(
        b,
        (Math.floor(t / minuteMs) + 1) * minuteMs,
        t < freeUntil ? freeUntil : b,
      ),
      duration = (next - t) / minuteMs
    const p =
      active(t) ??
      fail(
        `Chưa có biểu giá cho ${new Date(t).toISOString().slice(0, 16).replace("T", " ")}.`,
      )
    const d = new Date(t),
      day = d.toISOString().slice(0, 10),
      m = d.getUTCHours() * 60 + d.getUTCMinutes()
    if (p.kind === "Miễn phí") {
      t = next
      continue
    }
    if (p.kind === "Theo tháng") {
      if (!contains(p.start, p.end, m))
        fail("Lượt dự tính nằm ngoài giờ hoạt động của gói tháng.")
      const key = `${p.id}:${day.slice(0, 7)}`
      if (!seenMonths.has(key)) {
        seenMonths.add(key)
        add(key, `${p.name} · tháng ${day.slice(0, 7)}`, 1, p.amount)
      }
    } else if (p.kind === "Theo lượt") {
      if (!seenTurns.has(p.id)) {
        seenTurns.add(p.id)
        add(p.id, `${p.name} · lượt`, 1, p.amount)
      }
    } else if (t < freeUntil) freeMinutes += duration
    else if (p.kind === "Theo block thời gian") {
      const key = p.id,
        old = durations.get(key)
      durations.set(key, {
        p,
        w: {
          id: key,
          from: "00:00",
          to: "24:00",
          price: p.amount,
          minutes: p.blockMinutes,
        },
        minutes: (old?.minutes || 0) + duration,
      })
    } else if (p.overnight && contains(p.nightStart, p.nightEnd, m)) {
      const anchor =
        m < timeMinute(p.nightEnd) &&
        timeMinute(p.nightEnd) < timeMinute(p.nightStart)
          ? new Date(Date.parse(day) - dayMs).toISOString().slice(0, 10)
          : day
      const key = `${p.id}:night:${anchor}`
      if (!nights.has(key)) {
        nights.add(key)
        add(key, `${p.name} · đêm ${anchor}`, 1, p.nightPrice)
      }
    } else {
      const w =
        p.windows.find((w) => contains(w.from, w.to, m)) ??
        fail(`Chưa có khung giá cho ${day} ${d.toISOString().slice(11, 16)}.`)
      nonNight.set(p.id, (nonNight.get(p.id) || 0) + duration)
      lastWindows.set(p.id, w)
      const anchor =
        m < timeMinute(w.to) && timeMinute(w.to) < timeMinute(w.from)
          ? new Date(Date.parse(day) - dayMs).toISOString().slice(0, 10)
          : day
      const key = `${p.id}:${w.id}:${anchor}`,
        old = durations.get(key)
      durations.set(key, { p, w, minutes: (old?.minutes || 0) + duration })
    }
    t = next
  }
  for (const [key, { p, w, minutes }] of durations) {
    if (p.kind !== "Theo block thời gian" && !p.cumulative) continue
    const quantity =
      p.kind === "Theo chu kỳ" ? 1 : Math.ceil((minutes - 1e-9) / w.minutes)
    add(
      key,
      `${p.name} · ${
        p.kind === "Theo chu kỳ" ? "chu kỳ" : `${w.minutes} phút/block`
      } (${w.from}–${w.to})`,
      quantity,
      w.price,
    )
  }
  // Non-cumulative rules use the last applicable daytime window of each schedule,
  // while overnight fees remain one charge for each night crossed.
  for (const [id, minutes] of nonNight) {
    const p = prices.find((p) => p.id === id)!,
      w = lastWindows.get(id)
    if (!w || p.cumulative) continue
    const quantity =
      p.kind === "Theo chu kỳ" ? 1 : Math.ceil((minutes - 1e-9) / w.minutes)
    add(`${id}:exit`, `${p.name} · khung cuối áp dụng`, quantity, w.price)
  }
  const result = [...lines.values()]
  return {
    total: result.reduce((n, r) => n + r.total, 0),
    lines: result,
    freeMinutes,
  }
}
