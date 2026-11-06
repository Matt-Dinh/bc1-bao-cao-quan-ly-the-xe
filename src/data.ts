export type Screen = "stock" | "circulation" | "alerts" | "cards" | "settings"
interface ScreenMetadata {
  id: Screen
  title: string
  description: string
}
export const screens: ScreenMetadata[] = [
  {
    id: "stock",
    title: "Báo cáo quản lý thẻ",
    description:
      "Theo dõi biến động trong kỳ, cơ cấu thẻ lưu hành và các cảnh báo tại ngày cuối kỳ.",
  },
  {
    id: "circulation",
    title: "Cơ cấu thẻ lưu hành",
    description: "Phân tích cơ cấu và tình trạng sử dụng thẻ tại ngày chốt.",
  },
  {
    id: "alerts",
    title: "Cảnh báo thẻ",
    description: "Phát hiện bất thường và rà soát các thẻ cần xử lý.",
  },
  {
    id: "cards",
    title: "Chi tiết thẻ theo kỳ",
    description:
      "Danh sách thẻ đối chiếu với số liệu báo cáo tại ngày chốt, không phải trạng thái vận hành hiện tại.",
  },
  {
    id: "settings",
    title: "Tham số báo cáo thẻ xe",
    description: "Thiết lập ngưỡng cảnh báo và định mức cho từng khu đô thị.",
  },
]
export const estates = [
  {
    id: "A",
    name: "Vinhomes Ocean Park",
    short: "Ocean Park",
    code: "VHOCP",
    parks: ["Hầm B1 – S1", "Hầm B2 – S2", "Bãi ngoài trời"],
    values: [60, 740, 20, 80, 15, 4, 14, 802],
    threshold: 5,
    types: [20, 500, 282],
    locked: 16,
    expired: 8,
  },
  {
    id: "B",
    name: "Vinhomes Smart City",
    short: "Smart City",
    code: "VHSMC",
    parks: ["Hầm B1 – S3", "Hầm B2 – S4", "Bãi ngoài trời"],
    values: [52, 458, 20, 60, 10, 3, 21, 506],
    threshold: 0.5,
    types: [15, 320, 171],
    locked: 12,
    expired: 4,
  },
  {
    id: "C",
    name: "Vinhomes Times City",
    short: "Times City",
    code: "VHTMC",
    parks: ["Hầm B1 – T1", "Hầm B2 – T2", "Bãi ngoài trời"],
    values: [50, 640, 20, 60, 15, 3, 25, 682],
    threshold: 5,
    types: [15, 420, 247],
    locked: 14,
    expired: 6,
  },
]
export const cardTypes = ["VIP", "Thuê bao tháng", "Vãng lai"]
export const vehicles = ["Ô tô", "Xe máy", "Xe đạp"]
export const customerGroups = [
  "Cư dân",
  "Gian hàng",
  "Văn phòng",
  "CBNV BQL",
  "Nhà cung cấp dịch vụ",
  "Nội bộ",
  "Kích cầu",
  "Chưa phân nhóm",
]
export const alertNames = [
  "Sắp hết hạn",
  "Vẫn qua làn",
  "Không khớp thông tin",
  "Cấp nhưng không sử dụng",
]
export type Filters = {
  estate: string
  park: string
  type: string
  vehicle: string
  start: string
  end: string
  status: string
  alert: string
  expiry: string
}
export const defaults: Filters = {
  estate: "",
  park: "",
  type: "",
  vehicle: "",
  start: "2026-10-01",
  end: "2026-10-28",
  status: "",
  alert: "",
  expiry: "",
}
export const maxDate = "2026-10-28"
export const today = "2026-10-29"
export const fmt = (n: number) => n.toLocaleString("vi-VN")
export const date = (v: string) => (v ? v.split("-").reverse().join("/") : "—")
export const percent = (n: number, digits = 1) =>
  Number.isFinite(n)
    ? `${n.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
    : "—"
export const normalize = (s: string) => s.toUpperCase().replace(/[.\-\s]/g, "")
export type Card = {
  id: string
  estate: string
  park: string
  type: string
  vehicle: string
  owner: string
  plate: string
  status: string
  expiry: string
  group: string
  phone: string
  subscription: string
  batch: string
  apartment: string
  issued: string
  lastTrip: string
  unused: number
  alerts: number[]
  times: number
}
const names = [
  "Nguyễn Minh Anh",
  "Trần Hoàng Nam",
  "Lê Thu Hà",
  "Phạm Đức Thành",
  "Hoàng Ngọc Linh",
  "Vũ Hải Đăng",
  "Đặng Thị Mai",
  "Nguyễn Tuấn Kiệt",
  "Bùi Thanh Tâm",
  "Đỗ Quang Huy",
  "Trần Ngọc Ánh",
  "Lê Minh Khôi",
]
export const cards: Card[] = estates.flatMap((e, ei) => {
  const circulating = e.values[7]
  return Array.from(
    { length: circulating + e.values[6] + (ei === 0 ? 4 : 3) },
    (_, i) => {
      const inStock = i >= circulating && i < circulating + e.values[6]
      const lost = i >= circulating + e.values[6]
      const type =
        i < e.types[0]
          ? "VIP"
          : i < e.types[0] + e.types[1]
            ? "Thuê bao tháng"
            : "Vãng lai"
      const alerts =
        ei === 0 && i === 21
          ? [0]
          : ei === 1 && i === 20
            ? [0]
            : ei === 1 && i === 0
              ? [1]
              : ei === 0 && (i === 22 || i === 23)
                ? [2]
                : ei === 2 && i === 14
                  ? [3]
                  : []
      const status = lost
        ? "Mất / hỏng"
        : inStock
          ? "Trong kho"
          : i < e.locked
            ? "Khóa"
            : "Đang hoạt động"
      return {
        id: `${e.id}-${
          i % 3 === 1 ? "XM" : "OT"
        }-${String(i + 1).padStart(5, "0")}`,
        estate: e.id,
        park:
          inStock || lost
            ? ""
            : e.parks[
                i < [325, 169, 227][ei] ? 0 : i < [607, 337, 454][ei] ? 1 : 2
              ],
        type,
        vehicle: vehicles[i % 3],
        owner:
          inStock || lost || type === "Vãng lai"
            ? "—"
            : names[(i + ei * 3) % names.length],
        plate:
          inStock || type === "Vãng lai"
            ? "—"
            : i === 22 && ei === 0
              ? "30A-123.45"
              : i === 23 && ei === 0
                ? "—"
                : `30${["F", "A", "K"][ei]}-${String(11122 + i * 7).slice(-5, -2)}.${String(11122 + i * 7).slice(-2)}`,
        status,
        expiry:
          type === "VIP" || type === "Vãng lai" || inStock
            ? ""
            : i >= e.types[0] + 10 && i < e.types[0] + 10 + e.expired
              ? "2026-10-20"
              : alerts.includes(0)
                ? "2026-10-31"
                : "2026-12-31",
        group:
          type !== "Thuê bao tháng"
            ? "—"
            : ei === 0 && i === 23
              ? "Cư dân"
              : customerGroups[i % 8],
        phone: "0901****567",
        subscription: `TB-${String(ei * 1000 + i + 1).padStart(5, "0")}`,
        batch: `LO-${e.code}-202609`,
        apartment: i === 23 ? "—" : `S${ei + 1}.${(i % 4) + 1}-${1000 + i}`,
        issued: "2026-09-01",
        lastTrip: alerts.includes(3) ? "2026-09-12" : "2026-10-28",
        unused: alerts.includes(3) ? 46 : 0,
        alerts,
        times: i === 0 ? 2 : 1,
      }
    },
  )
})
export function filterCards(
  items: Card[],
  f: Filters,
  search = "",
  includeLost = false,
) {
  const q = normalize(search.trim())
  return items.filter(
    (c) =>
      (!f.estate || c.estate === f.estate) &&
      (!f.park || c.park === f.park) &&
      (!f.type || c.type === f.type) &&
      (!f.vehicle || c.vehicle === f.vehicle) &&
      (f.status
        ? c.status === f.status
        : includeLost || c.status !== "Mất / hỏng") &&
      (!f.alert || c.alerts.includes(Number(f.alert) - 1)) &&
      (!f.expiry || (!!c.expiry && c.expiry <= f.expiry)) &&
      (q.length < 3 ||
        [c.id, c.plate, c.subscription].some((v) => normalize(v).includes(q))),
  )
}
export const columnNames: Record<string, string> = {
  id: "Mã thẻ",
  estate: "Khu đô thị",
  park: "Bãi xe",
  type: "Loại thẻ",
  vehicle: "Phương tiện",
  owner: "Chủ thẻ",
  plate: "Biển số đăng ký",
  status: "Trạng thái",
  expiry: "Hiệu lực đến",
  alerts: "Cảnh báo",
  batch: "Lô nhập",
  subscription: "Mã thuê bao",
  group: "Nhóm khách",
  phone: "Số điện thoại",
  apartment: "Căn hộ / gian hàng",
  issued: "Ngày cấp gần nhất",
  lastTrip: "Lượt gần nhất",
  unused: "Số ngày không sử dụng",
}
export const defaultColumns = [
  "id",
  "estate",
  "park",
  "type",
  "vehicle",
  "owner",
  "plate",
  "status",
  "expiry",
  "alerts",
]
export type Threshold = {
  expiry: number
  loss: number
  unused: number
  effective: string
}
export const initialThresholds: Record<string, Threshold> = {
  A: { expiry: 7, loss: 5, unused: 30, effective: "2026-09-01" },
  B: { expiry: 7, loss: 0.5, unused: 30, effective: "2026-09-01" },
  C: { expiry: 14, loss: 5, unused: 30, effective: "2026-09-01" },
}
