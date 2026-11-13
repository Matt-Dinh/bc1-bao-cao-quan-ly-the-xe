import {
  alertTabs,
  buildParkingReport,
  dayMinutes,
  dayStart,
  durationHours,
  durationStats,
  effectiveRecord,
  nightsFor,
  parkingVehicles,
  ratio,
  shiftIntervals,
  siteById,
  statusAt,
  tripAlerts,
  inWindow,
} from "./parking-model"
import type {
  Adjustment,
  Aggregate,
  Interval,
  ParkingAccess,
  ParkingFilters,
  ParkingSettings,
  Trip,
} from "./parking-model"
import { excelDate } from "./parking-ui"
import type { ExportRow, Workbook } from "./parking-ui"
import { estates } from "./data"

export function tripExport(
  trip: Trip,
  filters: ParkingFilters,
  settings: ParkingSettings,
  days: string[],
  night?: string,
) {
  const end = dayStart(filters.end) + dayMinutes
  const site = siteById(trip.site)
  const closed = statusAt(trip, end) === "Đã ra"
  return {
    "Mã lượt": trip.id,
    "Biển số": trip.plate,
    "Khu đô thị": estates.find((estate) => estate.id === site?.estate)?.name,
    "Bãi xe": site?.name,
    "Loại xe": trip.vehicle,
    "Mã thẻ / vé": trip.ticket,
    "Nhóm khách": trip.group,
    "Giờ vào": excelDate(trip.entered),
    "Giờ ra": excelDate(closed ? trip.exited : null),
    "Thời gian đỗ (giờ)": durationHours(trip, end),
    "Trạng thái": statusAt(trip, end),
    "Cảnh báo": tripAlerts(trip, filters, settings).join(", "),
    "Làn vào": trip.laneIn,
    "Làn ra": closed ? trip.laneOut : "",
    "Nguồn vào": trip.sourceIn,
    "Nguồn ra": closed ? trip.sourceOut : "",
    "Số đêm": nightsFor(trip, days).length,
    "Ngày qua đêm": night ? excelDate(dayStart(night)) : null,
    "Chính sách": trip.policy,
    "Phải thu": trip.due,
    "Loại phí": closed ? "" : "Tạm tính",
    Voucher: trip.voucher,
    "Thực thu": closed ? trip.paid : null,
    "Chủ xe": trip.owner,
    "Số điện thoại": trip.phone,
  }
}
export const adjustmentExport = (changes: Adjustment[]): ExportRow[] =>
  changes.map((change) => ({
    "Mã lượt": change.trip.id,
    "Bãi xe": siteById(change.trip.site)?.label,
    "Loại xe": change.trip.vehicle,
    "Ngày bị ảnh hưởng": excelDate(dayStart(change.day)),
    "Loại thay đổi": change.title,
    "Người thực hiện": change.actor,
    "Thời điểm": excelDate(change.at),
  }))
export function utilizationExport(
  label: string,
  row: Aggregate,
  vehicle: string,
  additional = false,
): ExportRow {
  return {
    "Đơn vị": label,
    "Loại xe": vehicle,
    "Quy hoạch": row.design,
    "Thực tế": row.actual,
    ...(vehicle === "Ô tô" || additional
      ? { "Chỗ sạc": vehicle === "Ô tô" ? row.charging : null }
      : {}),
    "Tồn đầu kỳ": row.opening,
    Vào: row.incoming,
    Ra: row.outgoing,
    "Tồn cuối kỳ": row.closing,
    "Tồn cao nhất": row.peak,
    "Ngày giờ tồn cao nhất": excelDate(row.peakAt ?? null),
    "Giờ đỗ tối đa": row.maxHours,
    "Giờ đỗ thực tế": row.parkedHours,
    "Lấp đầy (%)": row.occupancy === null ? null : row.occupancy * 100,
    "Giờ đỗ kế hoạch": row.plannedHours,
    "Đạt kế hoạch (%)": row.attainment === null ? null : row.attainment * 100,
    ...(additional
      ? {
          "Chỗ kế hoạch": row.planned,
          "Giờ đỗ tối đa theo kế hoạch": row.plannedMax,
          "Tỷ lệ khai thác kế hoạch (%)":
            row.plannedMax && row.plannedHours !== null
              ? (row.plannedHours / row.plannedMax) * 100
              : null,
          "Chênh lệch giờ đỗ so với kế hoạch":
            row.planActual !== null && row.plannedHours !== null
              ? row.planActual - row.plannedHours
              : null,
        }
      : {}),
  }
}
export const flowExport = (
  site: string,
  vehicle: string,
  row: Interval,
): ExportRow => ({
  "Bãi xe": site,
  "Loại xe": vehicle,
  Ngày: excelDate(dayStart(row.day)),
  Khung: row.label,
  "Bắt đầu": excelDate(row.start),
  "Kết thúc": excelDate(row.end),
  "Tồn đầu": row.incomplete ? null : row.opening,
  "Xe vào": row.incomplete ? null : row.incoming,
  "Xe ra": row.incomplete ? null : row.outgoing,
  "Tồn cuối": row.incomplete ? null : row.closing,
  "Chỗ quy hoạch": row.design,
  "Chỗ trống":
    row.actual === null || row.incomplete ? null : row.actual - row.closing,
  "Tỷ lệ sử dụng (%)":
    !row.actual || row.incomplete ? null : (row.closing / row.actual) * 100,
  "Ghi chú": row.incomplete
    ? "Chưa đủ số liệu"
    : row.exceeded
      ? alertTabs[0]
      : "",
})
type Duration = ReturnType<typeof durationStats>
export function durationExport(
  label: string,
  vehicle: string,
  stats: Duration,
): ExportRow {
  const groups: ExportRow = {}
  for (const { label, trips } of stats.groups) {
    groups[label] = trips.length
    groups[`${label} (%)`] = ratio(trips.length * 100, stats.departed.length)
  }
  return {
    "Đơn vị": label,
    "Loại xe": vehicle,
    ...groups,
    "Tổng lượt ra": stats.departed.length,
    "TG đỗ TB (giờ)": stats.average,
    "Lượt qua đêm": stats.nightly.length,
    "Xe chưa ra": stats.remaining.length,
    "Tồn bất thường": stats.unusual.length,
  }
}
export function dayTypeExport(
  row: Aggregate & { label: string; days: string[] },
): ExportRow {
  return {
    "Loại ngày": row.label,
    "Số ngày": row.days.length,
    "Xe vào TB / ngày": row.incoming / row.days.length,
    "Giờ đỗ thực tế TB / ngày":
      row.parkedHours === null ? null : row.parkedHours / row.days.length,
    "Lấp đầy (%)": row.occupancy === null ? null : row.occupancy * 100,
  }
}
export function summaryWorkbook(
  trips: Trip[],
  settings: ParkingSettings,
  changes: Adjustment[],
  filters: ParkingFilters,
  access: ParkingAccess,
  cutoff: string,
  actor: string,
  exportedAt: number,
) {
  const workbook: Workbook = {
    "Thông tin": [
      {
        "Khu đô thị":
          estates.find((estate) => estate.id === filters.estate)?.name ??
          "Tất cả trong phạm vi quyền",
        "Bãi xe": siteById(filters.site)?.label ?? "Tất cả",
        "Từ ngày": excelDate(dayStart(filters.start)),
        "Đến ngày": excelDate(dayStart(filters.end)),
        "Dữ liệu chốt đến": excelDate(dayStart(cutoff) + dayMinutes - 1 / 60),
        "Loại xe đang xem": filters.vehicle,
        "Múi giờ": "GMT+7",
        "Người xuất": actor,
        "Thời điểm": excelDate(exportedAt),
      },
    ],
    "1-KhaiThac": [],
    "2-LuuLuongGio": [],
    "3-LuuLuongCa": [],
    "4-ThoiGianDo": [],
    "5-CanhBao": [],
    "6-ChiTiet": [],
    "7-LoaiNgay": [],
  }
  const scopedSites = new Set<string>()
  for (const vehicle of parkingVehicles) {
    const scope = { ...filters, vehicle }
    const report = buildParkingReport(trips, settings, scope, access)
    if (!report.bySite.length) continue
    workbook["1-KhaiThac"].push(
      utilizationExport("Tổng cộng", report.total, vehicle, true),
    )
    workbook["4-ThoiGianDo"].push(
      durationExport(
        "Tổng cộng",
        vehicle,
        durationStats(report.periodTrips, settings, scope, report.days),
      ),
    )
    for (const estate of report.byEstate) {
      workbook["1-KhaiThac"].push(
        utilizationExport(estate.name, estate.total, vehicle, true),
      )
      workbook["4-ThoiGianDo"].push(
        durationExport(
          estate.name,
          vehicle,
          durationStats(
            estate.children.flatMap((site) => site.trips),
            settings,
            scope,
            report.days,
          ),
        ),
      )
    }
    for (const site of report.bySite) {
      if (!scopedSites.has(site.id)) {
        const schedule = effectiveRecord(
          settings.schedules,
          site.id,
          filters.end,
        )
        workbook["Thông tin"].push({
          "Bãi xe": site.label,
          "Giờ khai thác": schedule
            ? `${schedule.from} – ${schedule.to}`
            : "Chưa khai báo",
          "Ngưỡng tồn bất thường (giờ)":
            effectiveRecord(settings.thresholds, site.estate, filters.end)
              ?.hours ?? 72,
        })
        scopedSites.add(site.id)
      }
      workbook["1-KhaiThac"].push(
        utilizationExport(site.label, site.total, vehicle, true),
      )
      workbook["2-LuuLuongGio"].push(
        ...site.daily.flatMap((day) =>
          day.hours.map((hour) => flowExport(site.label, vehicle, hour)),
        ),
      )
      workbook["3-LuuLuongCa"].push(
        ...report.days.flatMap((day) =>
          shiftIntervals(
            site.trips,
            settings,
            site.id,
            vehicle,
            day,
            cutoff,
          ).map((shift) => flowExport(site.label, vehicle, shift)),
        ),
      )
      const stats = durationStats(site.trips, settings, scope, report.days)
      workbook["4-ThoiGianDo"].push(durationExport(site.label, vehicle, stats))
      const alerts = report.periodTrips
        .filter((trip) => trip.site === site.id)
        .map((trip) => tripAlerts(trip, scope, settings))
      workbook["5-CanhBao"].push({
        "Bãi xe": site.label,
        "Loại xe": vehicle,
        [alertTabs[0]]: site.total.exceeded.length,
        [alertTabs[1]]: alerts.filter((items) => items.includes(alertTabs[1]))
          .length,
        [alertTabs[2]]: alerts.filter((items) => items.includes(alertTabs[2]))
          .length,
        [alertTabs[3]]: alerts.filter((items) => items.includes(alertTabs[3]))
          .length,
        "Tổng số lượt có cảnh báo": alerts.filter((items) => items.length)
          .length,
      })
    }
    workbook["6-ChiTiet"].push(
      ...report.periodTrips.map((trip) =>
        tripExport(trip, scope, settings, report.days),
      ),
    )
    workbook["7-LoaiNgay"].push(
      ...report.dayGroups.map((row) => ({
        "Loại xe": vehicle,
        ...dayTypeExport(row),
      })),
    )
  }
  const adjusted = changes.filter(
    (row) =>
      scopedSites.has(row.trip.site) &&
      inWindow(
        dayStart(row.day),
        dayStart(filters.start),
        dayStart(filters.end) + dayMinutes,
      ),
  )
  if (adjusted.length)
    workbook["8-DieuChinhSauKhoa"] = adjustmentExport(adjusted)
  return workbook
}
