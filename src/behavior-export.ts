import type { ExportRow, Workbook } from "./parking-ui"
import { excelDate } from "./parking-ui"
import { dayStart, siteById, vnNow } from "./parking-model"
import {
  arrivalStats, behaviorGuests, behaviorVehicles, dayKinds, dwellBands, estateName, eventLabels, hourLabel, hourOf,
  hours, inBand, proportion, repeatBands, returningVehicles, weekday, weekdays,
} from "./behavior-model"
import type { BehaviorArrival, BehaviorData, BehaviorFilters, EventSummary } from "./behavior-model"
import type { BehaviorSection } from "./behavior-routes"

const rounded = (n: number | null, digits = 1) => n === null ? null : Math.round(n * 10 ** digits) / 10 ** digits
const share = (n: number, base: number) => rounded(proportion(n, base))
const hasEvent = (row: BehaviorArrival) => row.events.length > 0
const metrics = (rows: BehaviorArrival[]) => {
  const stat = arrivalStats(rows)
  return {
    "Lượt đến": stat.count, "Lượt đã ra": stat.exited, "Có lưu trú": stat.n, "Trung bình (phút)": stat.average,
    "Trung vị (phút)": stat.median, "Ngắn nhất (phút)": stat.min, "Dài nhất (phút)": stat.max,
    "Dưới 30 phút (%)": rounded(stat.brief), "Từ 2 giờ (%)": rounded(stat.two), "Từ 4 giờ (%)": rounded(stat.four),
    "Giờ vào cao điểm": stat.peakIn, "Giờ ra cao điểm": stat.peakOut,
  }
}
function course(data: BehaviorData, total: string) {
  const all = data.arrivals
  const daily: ExportRow[] = [{ "Nhóm": total, ...metrics(all), "Sự kiện": all.filter(hasEvent).length,
    "Không sự kiện": all.filter((row) => !hasEvent(row)).length,
    ...Object.fromEntries(behaviorVehicles.map((vehicle) => [vehicle, all.filter((row) => row.vehicle === vehicle).length])) },
  ...data.days.map(({ day, kind, events, rows }) => ({
    Ngày: excelDate(dayStart(day)), Thứ: weekdays[weekday(day)], "Loại ngày": kind,
    "Mã sự kiện": events.map(({ id }) => id).join(", "), ...metrics(rows),
    "Sự kiện": rows.filter(hasEvent).length, "Không sự kiện": rows.filter((row) => !hasEvent(row)).length,
    ...Object.fromEntries(behaviorVehicles.map((vehicle) => [vehicle, rows.filter((row) => row.vehicle === vehicle).length])),
  }))]
  const types = [...dayKinds.map((kind) => ({ label: kind, days: data.days.filter((day) => day.kind === kind) })),
    ...["Có sự kiện", "Không có sự kiện"].map((label, i) => ({ label, days: data.days.filter(({ events }) => Boolean(events.length) === (i === 0)) }))]
  const byDayType = types.map(({ label, days }) => {
    const rows = days.flatMap((day) => day.rows)
    return { "Loại ngày": label, "Số ngày": days.length, ...metrics(rows),
      "Lượt TB mỗi ngày": days.length ? rounded(rows.length / days.length) : null }
  })
  const stats = arrivalStats(all)
  const weekCounts = weekdays.map((_, i) => data.days.filter(({ day }) => weekday(day) === i).length)
  const arrivalsByHourAndWeekday = hours.map(() => weekdays.map(() => 0))
  for (const { day, rows } of data.days) {
    const i = weekday(day)
    for (const { trip } of rows) arrivalsByHourAndWeekday[hourOf(trip.entered)][i]++
  }
  const byHour = hours.map((hour) => ({
    "Khung giờ": hourLabel(hour), ...Object.fromEntries(weekdays.flatMap((label, i) => {
      const n = arrivalsByHourAndWeekday[hour][i]
      return [[`${label} (${weekCounts[i]} ngày)`, n], [`${label} · TB/ngày`, weekCounts[i] ? rounded(n / weekCounts[i]) : null]]
    })), "Tổng vào": stats.inCounts[hour], "Tổng ra": stats.outCounts[hour],
    "Giờ vào cao điểm": stats.peakIn.startsWith(hourLabel(hour)), "Giờ ra cao điểm": stats.peakOut.startsWith(hourLabel(hour)),
  }))
  return { daily, byDayType, byHour }
}
function eventSheets(events: EventSummary[], label: string) {
  const unique = [...new Map(events.flatMap(({ rows }) => rows).map((row) => [row.trip.id, row])).values()]
  const results: ExportRow[] = [...(events.length ? [{ "Tên sự kiện": label, ...metrics(unique),
    ...Object.fromEntries(behaviorVehicles.map((vehicle) => [vehicle, unique.filter((row) => row.vehicle === vehicle).length])) }] : []),
  ...events.map(({ event, rows, expected, gain, windows, partial }) => ({
    "Mã sự kiện": event.id, "Tên sự kiện": event.name, "Loại sự kiện": event.type, "Khu đô thị": estateName(event.estate),
    "Bãi xe": event.sites.map((id) => siteById(id)?.name ?? id).join(", "), "Bắt đầu": excelDate(windows[0]?.start ?? null),
    "Kết thúc": excelDate(windows.at(-1)?.end ?? null), "Một phần ngoài kỳ": partial,
    ...metrics(rows), ...Object.fromEntries(behaviorVehicles.map((vehicle) => [vehicle, rows.filter((row) => row.vehicle === vehicle).length])),
    "Lượt dự kiến": rounded(expected), "Tăng thêm": rounded(gain), "Tăng thêm (%)": gain === null || !expected ? null : share(gain, expected),
    "Chú thích": event.notes[0]?.text, "Người ghi": event.notes[0]?.actor,
    "Thời điểm ghi": event.notes[0] ? excelDate(Date.parse(event.notes[0].at) / 60_000 + 7 * 60) : null,
  }))]
  const windows = events.flatMap(({ event, windows }) => windows.flatMap((slot) => (slot.weeks.length ? slot.weeks : [{ day: "", count: null }]).map((week) => ({
    "Mã sự kiện": event.id, "Bắt đầu khung": excelDate(slot.start), "Kết thúc khung": excelDate(slot.end),
    "Ngày đối chiếu": week.day ? excelDate(dayStart(week.day)) : null, "Lượt đối chiếu": week.count,
    "Lượt dự kiến": rounded(slot.expected), "Lượt sự kiện": slot.rows.length,
  }))))
  return { results, windows }
}
function returningSheets(data: BehaviorData, total: string): Workbook {
  const all = data.arrivals
  const plates = returningVehicles(data)
  const byType = [total, ...behaviorVehicles].map((label) => {
    const set = plates.filter(({ vehicle }) => label === total || label === vehicle)
    const trips = all.filter(({ vehicle }) => label === total || label === vehicle)
    const covered = trips.filter(({ plate }) => plate).length
    const repeat = set.filter(({ rows }) => rows.length > 1).length
    const familiar = set.filter((row) => row.familiar).length
    return { "Loại xe": label, "Lượt đến": trips.length, "Lượt có biển số": label === "Xe đạp" ? null : covered,
      "Tỷ lệ có biển số (%)": label === "Xe đạp" ? null : share(covered, trips.length), "Số xe": label === "Xe đạp" ? null : set.length,
      "Quay lại từ 2 lần": label === "Xe đạp" ? null : repeat, "Tỷ lệ quay lại (%)": share(repeat, set.length),
      "Lượt TB mỗi xe": set.length ? rounded(set.reduce((n, item) => n + item.rows.length, 0) / set.length, 2) : null,
      "Khách quen": label === "Xe đạp" ? null : familiar, "Tỷ lệ khách quen (%)": share(familiar, set.length) }
  })
  const byFrequency = repeatBands.map(([low, high, label]) => {
    const set = plates.filter(({ rows }) => rows.length >= low && rows.length < high)
    return { "Số lần đến": label, ...Object.fromEntries([...behaviorVehicles.filter((vehicle) => vehicle !== "Xe đạp"), total].flatMap((group) => {
      const rows = set.filter(({ vehicle }) => group === total || vehicle === group)
      return [[`${group} · Số xe`, rows.length], [`${group} · Số lượt`, rows.reduce((n, item) => n + item.rows.length, 0)]]
    })) }
  })
  return { "Theo loại xe": byType, "Theo số lần": byFrequency }
}

export function behaviorWorkbook(section: BehaviorSection | undefined, data: BehaviorData, filters: BehaviorFilters, events: EventSummary[],
  cutoff: string, actor: string, total: string): Workbook {
  const info: Workbook = { "Thông tin": [{
    "Từ ngày": excelDate(dayStart(filters.start)), "Đến ngày": excelDate(dayStart(filters.end)),
    "Số liệu đến": excelDate(dayStart(cutoff)), "Khu đô thị": filters.estates.map(estateName).join(", ") || "Tất cả trong phạm vi quyền",
    "Bãi xe": filters.sites.map((id) => siteById(id)?.name ?? id).join(", ") || "Tất cả",
    "Loại xe": filters.vehicles.join(", ") || "Tất cả", "Loại khách": filters.guests.join(", ") || "Tất cả",
    "Loại sự kiện": filters.type || "Tất cả", "Người xuất": actor, "Thời điểm xuất": excelDate(vnNow()),
  }] }
  if (section === "returning") return { ...info, ...returningSheets(data, total) }
  if (section === "time") {
    const { daily, byDayType, byHour } = course(data, total)
    return { ...info, "Theo ngày": daily, "Theo loại ngày": byDayType, "Theo khung giờ": byHour }
  }
  const reportEvents = eventSheets(events, total)
  if (section === "events") return { ...info, "Sự kiện": reportEvents.results, "Theo khung giờ": reportEvents.windows }
  const all = data.arrivals
  const eventGroups = eventLabels.map((label, i) => ({ label, rows: all.filter((row) => hasEvent(row) === (i === 0)) }))
  const cohorts = [{ label: total, rows: all }, ...eventGroups]
  const byBand = (bands: typeof dwellBands.fine | typeof dwellBands.compare) => bands.map((band) => ({
    "Nhóm thời gian": band[2], ...Object.fromEntries(cohorts.flatMap(({ label, rows }) => {
      const eligible = rows.filter(({ dwell }) => dwell !== null)
      const n = eligible.filter(({ dwell }) => inBand(dwell, band)).length
      return [[`${label} · Lượt`, n], [`${label} · Tỷ trọng (%)`, share(n, eligible.length)]]
    })),
  }))
  const period = course(data, total)
  return { ...info,
    "1-ChiTieu": [{ Nhóm: total, ...metrics(all), "Tỷ lệ sự kiện (%)": share(eventGroups[0].rows.length, all.length) },
      ...behaviorGuests.filter((guest) => filters.guests.length ? filters.guests.includes(guest) : true).map((guest) => ({
        Nhóm: guest, "Phân loại theo": "Loại khách", ...metrics(all.filter((row) => row.guest === guest)),
      })),
      ...eventGroups.map(({ label, rows }) => ({ Nhóm: label, "Phân loại theo": "Sự kiện / Không sự kiện", ...metrics(rows) }))],
    "2-LoaiXe": [total, ...behaviorVehicles.filter((label) => label !== "Chưa xác định" || all.some((row) => row.vehicle === label))]
      .map((label) => { const rows = label === total ? all : all.filter((row) => row.vehicle === label)
        return { "Loại xe": label, ...metrics(rows), "Tỷ trọng (%)": share(rows.length, all.length),
          "Sự kiện": rows.filter(hasEvent).length, "Không sự kiện": rows.filter((row) => !hasEvent(row)).length } }),
    "3-PhanBo": byBand(dwellBands.fine),
    "4-SoSanh": [...eventGroups.map(({ label, rows }) => ({ "Nhóm thời gian": label, ...metrics(rows) })), ...byBand(dwellBands.compare)],
    "5-TheoNgay": period.daily, "6-SuKien": reportEvents.results,
    ...(!section && { "Theo loại ngày": period.byDayType, "Theo khung giờ": period.byHour,
      "Khung giờ sự kiện": reportEvents.windows, ...returningSheets(data, total) }),
  }
}

