import { daysIn, shiftDay, vnToday } from "./parking-model"
import type { Audit, Holiday, ParkingSettings, Vehicle } from "./parking-model"
import { eventFields, migrateBehaviorEvent } from "./behavior-model"
import type { BehaviorEvent, EventWindow } from "./behavior-model"

const slot = (day: string, start: string, end: string): EventWindow => ({ day, start, end, overnight: end <= start })
const stamp = (day: string, hours: string) => new Date(`${day}T${hours}:00+07:00`).toISOString()
const manager = "Ban quản lý"
const operator = "Điều phối vận hành"

export function demoBehaviorEvents(today = vnToday()): BehaviorEvent[] {
  function event(id: number, name: string, type: BehaviorEvent["type"], sites: string[], windows: EventWindow[],
    description: string, { annotations = [], previousEnd, deleted = false }: {
      annotations?: string[]; previousEnd?: string; deleted?: boolean
    } = {}): BehaviorEvent {
    const value: BehaviorEvent = { id: `SK-${String(id).padStart(2, "0")}`, name, type, estate: sites[0].split(":")[0],
      sites, windows, description, notes: [], history: [], deleted }
    const creationDay = shiftDay(windows[0].day, -7)
    const activityDay = windows.at(-1)!.day
    const after = eventFields(value)
    const before = { ...after, deleted: false, windows: previousEnd
      ? [slot(windows[0].day, windows[0].start, previousEnd), ...windows.slice(1)] : windows }
    value.history = [
      ...(deleted ? [{ text: "Xóa sự kiện", at: stamp(shiftDay(activityDay, -1), "10:15"), actor: manager, before, after }] : []),
      ...(previousEnd ? [{ text: "Sửa khung giờ", at: stamp(shiftDay(activityDay, -2), "14:10"), actor: operator, before, after }] : []),
      { text: "Thêm sự kiện", at: stamp(creationDay, "09:00"), actor: manager, after: before },
    ]
    value.notes = annotations.map((text, revision) => ({
      text, actor: revision ? operator : manager, at: stamp(shiftDay(activityDay, annotations.length - revision), "09:30"),
    }))
    return value
  }
  return [
    event(1, "Triển lãm cuối tuần", "Triển lãm", ["A:0", "A:1"], [slot("2026-09-11", "17:00", "21:00")],
      "Trưng bày tại sảnh chính, phân luồng giữa hai bãi."),
    event(2, "Đêm nhạc cuối tuần", "Biểu diễn", ["B:0", "B:1"], [slot("2026-09-18", "20:00", "01:00")],
      "Khung giờ qua nửa đêm. Giữ làn ra hoạt động sau khi chương trình kết thúc."),
    event(3, "Lễ hội ẩm thực", "Lễ hội", ["A:0", "A:1"], [slot("2026-09-19", "17:00", "22:00")],
      "Có một tiết mục trùng khung giờ tại bãi A:0. Báo cáo ngày gộp các lượt liên quan.",
      { annotations: ["Lượt đến tập trung từ 18:00. Bố trí thêm một làn ra trong giờ cuối của chương trình."] }),
    event(4, "Biểu diễn tại sảnh", "Biểu diễn", ["A:0"], [slot("2026-09-19", "18:00", "20:00")],
      "Tiết mục trong khuôn khổ lễ hội ẩm thực, chỉ dùng bãi A:0."),
    event(5, "Ngày hội mua sắm", "Khuyến mại", ["A:0", "A:1"], [slot("2026-09-25", "17:30", "21:00")],
      "Đón khách từ 17:30 tại cả hai bãi."),
    event(6, "Hội chợ cuối tuần", "Triển lãm", ["A:0", "A:1"], [slot("2026-11-14", "16:45", "22:00")],
      "Hội chợ tối thứ Bảy. Đón khách từ 16:45 ở cả hai bãi.",
      { previousEnd: "21:30", annotations: [
        "Khách đến đông trong giờ đầu, giảm dần sau 20:00. Bổ sung người hướng dẫn ở lối vào từ 16:45 trong kỳ tới.",
        "Đã ghi nhận đợt khách đến trước giờ bắt đầu. Chờ đối chiếu lưu lượng làn ra trước khi chốt đề xuất.",
      ] }),
    event(7, "Đêm nhạc tháng 11", "Biểu diễn", ["B:0", "B:2"], [slot("2026-11-21", "18:00", "23:00")],
      "Chương trình ngoài trời tại khu đô thị B.",
      { annotations: ["Lượng khách vào gần mức đối chiếu. Cần bố trí điều phối tại làn ra vào lúc kết thúc chương trình."] }),
    event(8, "Ngày hội mua sắm cuối năm", "Khuyến mại", ["A:0", "A:1"], [slot("2026-12-05", "14:00", "21:00")],
      "Áp dụng tại cả hai bãi trong ngày mở màn."),
    event(101, "Hội thảo cư dân", "Hội thảo", ["C:0", "C:1"], [slot("2026-10-10", "08:30", "11:30")],
      "Đợt khách đến tập trung trong buổi sáng."),
    event(102, "Ngày hội thiết kế", "Triển lãm", ["C:0", "C:1"], daysIn("2026-11-06", "2026-11-08").map((day) => slot(day, "10:00", "18:00")),
      "Trưng bày trong ba ngày. Khung giờ lặp lại từ 10:00 đến 18:00.",
      { annotations: ["Chủ nhật có lượt đến cao nhất trong ba ngày. Nhóm gửi từ hai giờ trở lên tập trung vào buổi chiều."] }),
    event(103, "Phố đêm cuối tuần", "Lễ hội", ["B:0", "B:2"], [slot("2026-11-13", "19:30", "01:30")],
      "Phiên chợ đêm có khung qua ngày hôm sau."),
    event(104, "Tuần lễ sản phẩm địa phương", "Khuyến mại", ["A:0", "A:1"],
      [slot("2026-11-20", "11:00", "14:00"), slot("2026-11-22", "16:00", "21:00")],
      "Hai đợt khuyến mại với thời gian khác nhau. Theo dõi riêng lượt đến theo từng khung."),
    event(105, "Chiếu phim ngoài trời", "Biểu diễn", ["C:0"], [slot("2026-11-24", "19:00", "22:00")],
      "Lịch dự kiến đã được hủy. Giữ bản ghi để minh họa màn lịch sử.", { deleted: true }),
    event(106, "Gặp gỡ cộng đồng", "Khác", ["C:0", "C:1"],
      [slot(today, "00:00", "00:00")], "Hoạt động diễn ra trong ngày tại khu vực sinh hoạt cộng đồng."),
    event(107, "Ngày hội gia đình", "Lễ hội", ["B:0", "B:2"],
      [slot(shiftDay(today, 6), "08:45", "18:00"), slot(shiftDay(today, 7), "08:45", "18:00")],
      "Hai ngày liên tiếp. Mở hai bãi từ 08:45 để đón khách."),
    event(108, "Buổi giới thiệu dịch vụ", "Hội thảo", ["C:0"], [slot("2026-11-18", "08:00", "10:00")],
      "Phiên giới thiệu quy mô nhỏ, dùng để đối chiếu lượt thực tế với ngày thông thường.",
      { annotations: ["Lượt đến thấp hơn đợt đối chiếu. Duy trì một làn vào và một làn ra cho các phiên sáng tương tự."] }),
    event(109, "Hội chợ tháng này", "Triển lãm", ["A:0", "A:1"], [slot(shiftDay(today, -7), "16:00", "21:00")],
      "Kịch bản gần ngày hiện tại để có dữ liệu trong kỳ gần nhất."),
    event(110, "Giao lưu cuối ngày", "Khác", ["C:0", "C:1"], [slot(shiftDay(today, -3), "17:30", "22:00")],
      "Mở cả khu ô tô và khu xe máy trong khung giờ tối."),
  ]
}

const holidaySamples = [
  ["2026-01-01", "2026-01-01", "Tết Dương lịch"],
  ["2026-02-16", "2026-02-20", "Tết Nguyên đán"],
  ["2026-04-30", "2026-05-01", "Nghỉ lễ 30/4 và 1/5"],
  ["2026-11-16", "2026-11-16", "Ngày nghỉ toàn hệ thống (minh họa)"],
  ["2027-01-01", "2027-01-01", "Tết Dương lịch"],
]
const demoHolidays: Holiday[] = holidaySamples.flatMap(([start, end, name]) => daysIn(start, end).map((day) => ({
  id: `behavior-demo-holiday-${day}`, effective: day, name, substitute: false, actor: operator,
  updated: `${shiftDay(start, -10)}T09:00:00`,
})))

export function withBehaviorDemoSettings(settings: ParkingSettings, today = vnToday()): ParkingSettings {
  const migrated = settings.behaviorEvents?.map(migrateBehaviorEvent)
  const snapshotEvents = settings.behaviorSnapshot?.events.map(migrateBehaviorEvent)
  if (migrated?.some((event, i) => event !== settings.behaviorEvents![i]) ||
      snapshotEvents?.some((event, i) => event !== settings.behaviorSnapshot!.events[i])) {
    settings = { ...settings, behaviorEvents: migrated, behaviorSnapshot: settings.behaviorSnapshot && {
      ...settings.behaviorSnapshot, events: snapshotEvents!,
    } }
  }
  if (settings.behaviorDemoVersion === 1) return settings
  const fixtures = demoBehaviorEvents(today)
  const fixtureIds = new Map(fixtures.map((event) => [event.id, event]))
  const current = settings.behaviorEvents ?? []
  const existingEvents = new Set(current.map((event) => event.id))
  const newEvents = fixtures.filter((event) => !existingEvents.has(event.id))
  const events = [...current.map((event) => {
    const sample = fixtureIds.get(event.id)
    if (!sample || sample.name !== event.name || event.deleted || event.history.length) return event
    return { ...sample, notes: event.notes.length ? event.notes : sample.notes }
  }), ...newEvents]
  const existingDays = new Set(settings.holidays.map((holiday) => holiday.effective))
  const newHolidays = demoHolidays.filter(({ effective }) => !existingDays.has(effective))
  const history: Audit[] = newHolidays.map((holiday) => ({
    id: `audit-${holiday.id}`, at: holiday.updated, actor: holiday.actor, action: "Thêm ngày lễ", scope: "",
    detail: holiday.name, after: holiday, kind: "holidays",
  }))
  const snapshot = settings.behaviorSnapshot
  return { ...settings, behaviorDemoVersion: 1, behaviorEvents: events, holidays: [...settings.holidays, ...newHolidays],
    history: [...settings.history, ...history], behaviorSnapshot: snapshot && {
      ...snapshot, events: [...snapshot.events, ...newEvents], holidays: [...snapshot.holidays, ...newHolidays],
    } }
}

// Different visit cadences keep the returning-customer cohorts visible in the shared demo ledger.
export function behaviorDemoPlate(id: number, dayIndex: number, vehicle: Vehicle, original: string) {
  if (!original) return original
  const index = id % 10_000
  const cohort = (Math.imul(index, 0x9e3779b1) >>> 0) % 100
  if (cohort >= 37 && cohort < 54) return original
  const oneTime = cohort < 37 || cohort < 68
  const serial = oneTime ? id : Math.floor(dayIndex / (cohort < 82 ? 3 : 8)) * 3_000 + index
  const district = oneTime ? 29 : cohort < 82 ? 31 : 32
  const plateLetter = "ABCEFGHJKLMNPQRSTUVXYZ"[Math.floor(serial / 100_000) % 21]
  const vehicleMark = oneTime ? "" : vehicle === "Ô tô" ? "A" : "B"
  const number = String(serial % 100_000).padStart(5, "0")
  return `${district}${plateLetter}${vehicleMark}-${number.slice(0, 3)}.${number.slice(3)}`
}

export function demoBehaviorTraffic(today: string) {
  return demoBehaviorEvents(today).flatMap((event) => {
    // Quiet events retain their shared baseline traffic.
    if (event.deleted || ![3, 6, 102, 103, 104, 109, 110].includes(Number(event.id.split("-")[1]))) return []
    return event.windows.filter(({ day }) => day <= today).flatMap((window) =>
      event.sites.map((site) => ({ id: `${event.id}-${window.day}-${window.start}-${site}`, day: window.day, start: window.start, site,
        count: event.type === "Triển lãm" ? 65 : 40 })))
  })
}
