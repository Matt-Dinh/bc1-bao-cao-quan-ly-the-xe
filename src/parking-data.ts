import {
  dayStart,
  daysIn,
  goLive,
  parkingVehicles,
  shiftDay,
  vnToday,
  laneIssues,
  dayMinutes,
  vnNow,
  effectiveRecord,
  allowedSites,
  isLocked,
  dayAt,
  parkingGroups,
} from "./parking-model"
import type {
  Adjustment,
  Capacity,
  ParkingAccess,
  ParkingSettings,
  Schedule,
  Trip,
  Vehicle,
} from "./parking-model"

const initialVersion = {
  effective: "2026-01-01",
  actor: "Admin Local",
  updated: "2025-12-20T09:00:00",
}
const carSites = [
  {
    site: "A:0",
    design: 300,
    planned: 290,
    actual: 280,
    charging: 0,
    plan: 130000,
  },
  {
    site: "A:1",
    design: 200,
    planned: 180,
    actual: 170,
    charging: 0,
    plan: 75000,
  },
  {
    site: "B:2",
    design: 47,
    planned: 47,
    actual: 47,
    charging: 16,
    plan: 24000,
  },
  {
    site: "C:0",
    design: 150,
    planned: 150,
    actual: 150,
    charging: 0,
    plan: null,
  },
]
const capacityRows: Omit<Capacity, keyof typeof initialVersion | "id">[] = [
  ...carSites.map(({ plan: _plan, ...row }) => ({
    ...row,
    vehicle: parkingVehicles[0],
  })),
  {
    site: "A:0",
    vehicle: "Xe máy",
    design: 500,
    planned: 500,
    actual: 480,
    charging: 0,
  },
  {
    site: "A:1",
    vehicle: "Xe máy",
    design: 650,
    planned: 650,
    actual: 650,
    charging: 0,
  },
  {
    site: "B:0",
    vehicle: "Xe máy",
    design: 320,
    planned: 300,
    actual: 290,
    charging: 0,
  },
  {
    site: "C:1",
    vehicle: "Xe máy",
    design: 500,
    planned: 500,
    actual: 470,
    charging: 0,
  },
  {
    site: "A:1",
    vehicle: "Xe đạp",
    design: 120,
    planned: 120,
    actual: 100,
    charging: 0,
  },
  {
    site: "B:1",
    vehicle: "Xe đạp",
    design: 85,
    planned: 75,
    actual: 75,
    charging: 0,
  },
]
const sampleSchedules: Schedule[] = [
  ...new Set(capacityRows.map((row) => row.site)),
].map((site, index) => ({
  ...initialVersion,
  id: `schedule-${index}`,
  site,
  from: "05:00",
  to: "02:00",
  shifts:
    site === "C:0"
      ? []
      : [
          { name: "Ca 1", from: "06:00", to: "14:00" },
          { name: "Ca 2", from: "14:00", to: "22:00" },
          { name: "Ca 3", from: "22:00", to: "06:00" },
        ],
}))
const sampleSettings = (): ParkingSettings => ({
  capacities: [
    ...capacityRows.map((row, index) => ({
      ...initialVersion,
      id: `cap-${index}`,
      ...row,
    })),
    {
      ...initialVersion,
      ...capacityRows[0],
      id: "cap-A-new",
      effective: shiftDay(vnToday(), 7),
    },
  ],
  plans: carSites.flatMap(({ site, plan }) =>
    plan === null
      ? []
      : [
          ...new Set(["2026-09", "2026-10", "2026-11", vnToday().slice(0, 7)]),
        ].map((month) => ({
          ...initialVersion,
          id: `plan-${site}-${month}`,
          site,
          vehicle: "Ô tô",
          effective: `${month}-01`,
          month,
          hours: plan,
        })),
  ),
  schedules: sampleSchedules,
  thresholds: [],
  holidays: ["2026-09-01", "2026-09-02"].map((effective, index) => ({
    ...initialVersion,
    id: `holiday-${index}`,
    effective,
    name: index ? "Quốc khánh" : "Nghỉ Quốc khánh",
    substitute: false,
  })),
  history: [],
})

export const settingsKey = "vparking:parking:settings:v1"
export function readSettings() {
  try {
    const saved = localStorage.getItem(settingsKey)
    if (saved) return JSON.parse(saved) as ParkingSettings
  } catch {
    /* The demo can still run with the initial declarations. */
  }
  return sampleSettings()
}
export const writeSettings = (settings: ParkingSettings) =>
  localStorage.setItem(settingsKey, JSON.stringify(settings))

const names = [
  "Nguyễn Minh Anh",
  "Trần Quốc Bảo",
  "Lê Thu Hà",
  "Phạm Hoàng Nam",
  "Đỗ Quang Huy",
]
function sampleTrip(
  id: number,
  site: string,
  vehicle: Vehicle,
  entered: number,
  exited: number | null,
): Trip {
  const group =
    id % 13 === 0
      ? parkingGroups[2]
      : id % 5 === 0
        ? parkingGroups[1]
        : parkingGroups[0]
  const hasVoucher = id % 37 === 0
  const due = id % 11 === 0 ? 0 : 30000
  const issue =
    id % 137 === 0
      ? laneIssues[Math.floor(id / 137) % laneIssues.length]
      : undefined
  const atExit = issue === laneIssues[1] || issue === laneIssues[2]
  const plate =
    issue === laneIssues[3] || vehicle === "Xe đạp"
      ? ""
      : `30${"ABCDEFG"[id % 7]}-${100 + (id % 900)}.${String(id % 100).padStart(2, "0")}`
  const laneIn = `Làn vào ${(id % 2) + 1}`,
    laneOut = `Làn ra ${(id % 2) + 1}`
  return {
    id: `LX-${id}`,
    site,
    vehicle,
    group,
    plate,
    ticket:
      vehicle === "Ô tô" && group === "Vãng lai" ? `QR-${id}` : `THE-${id}`,
    owner: names[id % names.length],
    phone: `090000${String(id % 10000).padStart(4, "0")}`,
    entered,
    exited,
    laneIn,
    laneOut,
    cameraIn: plate,
    cameraOut: plate,
    sourceIn: issue === laneIssues[1] ? "ANBV bổ sung" : "Làn tự động",
    sourceOut: issue === laneIssues[0] ? "ANBV bổ sung" : "Làn tự động",
    due,
    paid: exited === null ? null : hasVoucher || id % 113 === 0 ? 0 : due,
    voucher: hasVoucher ? due : 0,
    policy: hasVoucher ? "Voucher gian hàng" : due ? undefined : "Miễn phí",
    issue: issue
      ? {
          kind: issue,
          at: atExit ? (exited ?? entered) : entered,
          lane: atExit ? laneOut : laneIn,
          note:
            issue === laneIssues[3]
              ? "Camera chưa đọc được biển số."
              : "Ghi nhận tại làn để đối chiếu.",
          verifiedAt:
            issue === laneIssues[3] && id % 2 === 0
              ? entered + dayMinutes
              : undefined,
        }
      : undefined,
    actions:
      issue === laneIssues[0] || issue === laneIssues[1]
        ? [
            {
              at: exited ?? entered,
              actor: "ANBV",
              title: "Bổ sung lượt",
              reason: issue,
            },
          ]
        : undefined,
  }
}
export function seedTrips(today = vnToday()): Trip[] {
  const recent = shiftDay(today, -45)
  const days = [
    ...new Set([
      ...daysIn(goLive, today < "2026-11-30" ? today : "2026-11-30"),
      ...daysIn(recent < goLive ? goLive : recent, today),
    ]),
  ]
  const rows: Trip[] = []
  for (const day of days) {
    const midnight = dayStart(day)
    let id = 10001 + ((midnight - dayStart(goLive)) / dayMinutes) * 10000
    const dayNumber = Number(day.slice(-2))
    for (const config of capacityRows) {
      const isSmallCarLot = config.site === "B:2"
      const volumes = Math.ceil(
        config.actual * (isSmallCarLot ? 1.75 : 0.88) + (dayNumber % 13),
      )
      for (let index = 0; index < volumes; index++) {
        const time = 360 + ((index * 53 + dayNumber * 17) % 960)
        const durations = [9, 42, 125, 170, 300, 420, 565, 605]
        const duration =
          durations[(index + dayNumber) % durations.length] + (index % 20)
        rows.push(
          sampleTrip(
            id++,
            config.site,
            config.vehicle,
            midnight + time,
            midnight + time + duration,
          ),
        )
      }
      if (isSmallCarLot && dayNumber % 3 === 0) {
        for (let index = 0; index < 45; index++) {
          const entered = midnight + 17 * 60 + (index % 25)
          rows.push(
            sampleTrip(
              id++,
              config.site,
              config.vehicle,
              entered,
              entered + 245,
            ),
          )
        }
      }
      if (isSmallCarLot && dayNumber % 4 === 1) {
        for (let index = 0; index < 37; index++) {
          const entered = midnight + 9 * 60 + (index % 25)
          rows.push(
            sampleTrip(
              id++,
              config.site,
              config.vehicle,
              entered,
              entered + 375,
            ),
          )
        }
      }
    }
    if (dayNumber % 7 === 1)
      rows.push(
        sampleTrip(
          id++,
          "C:2",
          "Chưa xác định",
          midnight + 550,
          midnight + 810,
        ),
      )
  }
  rows.push({
    ...sampleTrip(
      9001,
      "B:2",
      "Ô tô",
      dayStart("2026-09-26") + 1200,
      dayStart("2026-10-04"),
    ),
    plate: "30A-999.88",
    group: "Vãng lai",
  })
  rows.push({
    ...sampleTrip(9002, "B:2", "Ô tô", dayStart("2026-11-06") + 1200, null),
    plate: "30F-456.78",
    group: "Vãng lai",
  })
  rows.push(
    sampleTrip(
      9003,
      "A:0",
      "Ô tô",
      dayStart(goLive) - 120,
      dayStart(goLive) + 600,
    ),
  )
  // A one-day demo event also exercises the notification feed during the morning.
  for (let index = 0; index < 50; index++) {
    rows.push(
      sampleTrip(
        9100 + index,
        "B:2",
        "Ô tô",
        dayStart("2026-11-13") + 5 * 60 + (index % 15),
        dayStart("2026-11-13") + 14 * 60,
      ),
    )
  }
  return rows
}

export const demoAdjustments: Adjustment[] = (() => {
  const entered = dayStart("2026-11-01") + 1200
  const trip = {
    ...sampleTrip(9004, "A:0", "Ô tô", entered, entered + 90),
    plate: "30A-891.24",
    sourceIn: "ANBV bổ sung" as const,
  }
  const at = dayStart("2026-11-06") + 610
  trip.actions = [
    {
      at,
      actor: "ANBV",
      title: "Bổ sung giờ vào",
      reason: "Đối chiếu xe ra không có lượt vào.",
      afterLock: true,
    },
  ]
  return [
    { trip, day: "2026-11-01", at, actor: "ANBV", title: "Bổ sung giờ vào" },
  ]
})()
export function applyTripCorrections(trips: Trip[], corrections: Adjustment[]) {
  const byId = new Map(trips.map((trip) => [trip.id, trip]))
  const afterLock: Adjustment[] = []
  for (const change of [...corrections].sort((a, b) => a.at - b.at)) {
    if (isLocked(change.day, change.at)) afterLock.push(change)
    else byId.set(change.trip.id, change.trip)
  }
  return { trips: [...byId.values()], afterLock }
}

export interface ParkingNotice {
  id: string
  site: string
  vehicle: Vehicle
  count: number
  design: number
  at: number
}
export function checkParkingCapacity(
  trips: Trip[],
  settings: ParkingSettings,
  access: ParkingAccess,
  previouslyOver: Set<string>,
  at = Math.floor(vnNow() / 15) * 15,
) {
  const day = dayAt(at)
  const over = new Set<string>()
  const notices: ParkingNotice[] = []
  for (const site of allowedSites(access))
    for (const vehicle of parkingVehicles) {
      const key = `${site.id}/${vehicle}`
      const design = effectiveRecord(settings.capacities, key, day)?.design
      if (design === undefined) continue
      const count = trips.filter(
        (trip) =>
          trip.site === site.id &&
          trip.vehicle === vehicle &&
          trip.entered <= at &&
          (trip.exited === null || trip.exited > at),
      ).length
      if (count <= design) continue
      over.add(key)
      if (!previouslyOver.has(key))
        notices.push({
          id: `${key}/${at}`,
          site: site.id,
          vehicle,
          count,
          design,
          at,
        })
    }
  return { over, notices }
}
