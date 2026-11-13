import { useEffect, useRef, useState } from "react"
import {
  applyTripCorrections,
  checkParkingCapacity,
  demoAdjustments,
  readSettings,
  seedTrips,
  settingsKey,
  writeSettings,
} from "./parking-data"
import type { ParkingNotice } from "./parking-data"
import {
  canReceiveParkingAlerts,
  lastReportDay,
  minuteIso,
  parkingRoles,
  vnNow,
} from "./parking-model"
import type { ParkingAccess, ParkingSettings } from "./parking-model"
import type { ExportParking, Workbook } from "./parking-ui"

interface ExportNotice {
  id: string
  name: string
  url: string
  owner: string
  expires: number
}
const dayMs = 86_400_000
function download(name: string, url: string) {
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
}
const workbookUrl = (bytes: ArrayBuffer) =>
  URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  )
const limitMessage =
  "Số bản ghi vượt quá giới hạn cho phép. Vui lòng thu hẹp điều kiện lọc."
function buildInWorker(workbook: Workbook) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const worker = new Worker(
      new URL("./parking-export.worker.ts", import.meta.url),
      { type: "module" },
    )
    worker.onmessage = ({
      data,
    }: MessageEvent<{ bytes?: ArrayBuffer; error?: string }>) => {
      worker.terminate()
      if (data.bytes) resolve(data.bytes)
      else reject(new Error(data.error || "Không thể tạo file Excel."))
    }
    worker.onerror = () => {
      worker.terminate()
      reject(new Error("Không thể tạo file Excel."))
    }
    try {
      worker.postMessage(workbook)
    } catch (error) {
      worker.terminate()
      reject(error)
    }
  })
}
export default function useParking(
  access: ParkingAccess,
  notify: (message: string) => void,
) {
  const [settings, setSettings] = useState(readSettings)
  const [ledger, setLedger] =
    useState<ReturnType<typeof applyTripCorrections> | null>(null)
  const trips = ledger?.trips ?? null
  const [cutoff, setCutoff] = useState(lastReportDay)
  const [notices, setNotices] = useState<ParkingNotice[]>([])
  const [exports, setExports] = useState<ExportNotice[]>([])
  const running = useRef(new Map<string, number>())
  const readyExports = useRef(new Map<string, ExportNotice>())
  const over = useRef(new Set<string>())
  const account = `${access.role}/${access.estate}`
  const actor = parkingRoles[access.role]
  useEffect(() => {
    const refresh = () => {
      setCutoff(lastReportDay())
      setLedger(applyTripCorrections(seedTrips(), demoAdjustments))
    }
    const timer = window.setTimeout(refresh, 0)
    const interval = window.setInterval(() => {
      const day = lastReportDay()
      if (day !== cutoff) refresh()
    }, 60_000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [cutoff])
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === settingsKey) setSettings(readSettings())
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])
  useEffect(() => {
    if (!trips || !canReceiveParkingAlerts(access)) return
    const check = () => {
      const result = checkParkingCapacity(trips, settings, access, over.current)
      over.current = result.over
      if (result.notices.length)
        setNotices((current) =>
          [
            ...result.notices.filter(
              (notice) => !current.some(({ id }) => id === notice.id),
            ),
            ...current,
          ].slice(0, 50),
        )
    }
    check()
    const interval = window.setInterval(check, 15 * 60_000)
    return () => window.clearInterval(interval)
  }, [trips, settings, access])
  const save = (change: (latest: ParkingSettings) => ParkingSettings) => {
    try {
      const next = change(readSettings())
      writeSettings(next)
      setSettings(next)
      return true
    } catch (error) {
      notify(
        `Không thể lưu. ${
          error instanceof Error ? error.message : "Vui lòng thử lại."
        }`,
      )
      return false
    }
  }
  const audit = (action: string, detail: string, scope = access.estate) => {
    save((latest) => ({
      ...latest,
      history: [
        {
          id: crypto.randomUUID(),
          at: minuteIso(vnNow()),
          actor,
          action,
          detail,
          scope,
        },
        ...latest.history,
      ],
    }))
  }
  const exportFile: ExportParking = (name, make, count = 0) => {
    if (count > 100000) {
      notify(limitMessage)
      return
    }
    const pending = running.current.get(account) ?? 0
    if (count > 10000 && pending >= 2) {
      notify("Bạn đang tạo 2 file. Vui lòng chờ một file hoàn tất.")
      return
    }
    const stamp = minuteIso(vnNow()).replace(/\D/g, "")
    const filename = `VParking_${name}_${stamp}.xlsx`
    const background = count > 10000
    if (background) {
      running.current.set(account, pending + 1)
      notify("Đang tạo file. Bạn sẽ nhận thông báo khi file sẵn sàng.")
    }
    window.setTimeout(async () => {
      try {
        const workbook = make()
        const detailCount =
          workbook["6-ChiTiet"]?.length ?? workbook["Lượt xe"]?.length ?? count
        if (detailCount > 100000) {
          notify(limitMessage)
          return
        }
        const bytes = background
          ? await buildInWorker(workbook)
          : (await import("./parking-workbook")).workbookBytes(workbook)
        const url = workbookUrl(bytes)
        if (!background) {
          download(filename, url)
          window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
          notify("Đã xuất dữ liệu.")
        } else {
          const file = {
            id: crypto.randomUUID(),
            name: filename,
            url,
            owner: account,
            expires: Date.now() + dayMs,
          }
          readyExports.current.set(file.id, file)
          setExports((current) => [file, ...current])
          window.setTimeout(() => {
            readyExports.current.delete(file.id)
            URL.revokeObjectURL(url)
            setExports((current) => current.filter(({ id }) => id !== file.id))
          }, dayMs)
        }
      } catch {
        notify("Không thể xuất dữ liệu. Vui lòng thử lại.")
      } finally {
        if (background)
          running.current.set(account, (running.current.get(account) ?? 1) - 1)
      }
    }, 0)
  }
  const downloadExport = (id: string) => {
    const file = readyExports.current.get(id)
    if (!file || file.owner !== account || file.expires <= Date.now()) return
    download(file.name, file.url)
  }
  return {
    trips,
    settings,
    cutoff,
    changes: ledger?.afterLock ?? [],
    actor,
    save,
    audit,
    exportFile,
    downloadExport,
    notices: canReceiveParkingAlerts(access)
      ? notices.filter(
          (notice) =>
            !access.estate || notice.site.startsWith(`${access.estate}:`),
        )
      : [],
    exports: exports.filter(
      (file) => file.owner === account && file.expires > Date.now(),
    ),
  }
}
