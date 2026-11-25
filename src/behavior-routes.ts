export const behaviorReport = "behavior-report"
export const behaviorOperations = "behavior-event-management"
export const behaviorConfig = "behavior-settings"
export const behaviorTitle = "Báo cáo phân tích hành vi"
export const behaviorOperationsTitle = "Phân tích hành vi khách hàng"
export const behaviorManagementTitle = "Sự kiện và ngày lễ"
export type BehaviorScreen = typeof behaviorReport | typeof behaviorOperations | typeof behaviorConfig

export const behaviorSections = {
  arrivals: "Lượt đến và lưu trú",
  time: "Theo thời gian",
  events: "Hiệu quả sự kiện",
  returning: "Khách quay lại",
} as const
export type BehaviorSection = keyof typeof behaviorSections

export function readBehaviorSection(value: string | null): BehaviorSection | null {
  return value && Object.prototype.hasOwnProperty.call(behaviorSections, value) ? value as BehaviorSection : null
}

export const isBehaviorScreen = (screen: string | null): screen is BehaviorScreen =>
  screen === behaviorReport || screen === behaviorOperations || screen === behaviorConfig

export function migrateBehaviorLocation(params: URLSearchParams) {
  const route = params.get("module")
  const section = route === "behavior-time" ? "time" : route === "behavior-events" ? "events" :
    route === "behavior-returning" ? "returning" : null
  if (section) {
    params.set("module", behaviorReport)
    params.set("behaviorSection", section)
    params.delete("eventNote")
  }
  if (route === behaviorConfig) {
    params.set("module", behaviorOperations)
    params.set("configView", params.has("configEvent") || params.has("configNote") || params.get("configView") === "Sự kiện"
      ? "Sự kiện" : "Ngày lễ")
  }
  return params
}
