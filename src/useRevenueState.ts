import { useEffect, useState } from "react"
import { readRevenueState, revenueStorageKey } from "./revenue-model"
import type { RevenueSave } from "./revenue-operations"

/** Shared persistence for supplementary parking trips and their payment records. */
export function useRevenueState(notify: (message: string) => void) {
  const [state, setState] = useState(readRevenueState)
  useEffect(() => {
    const listener = (event: StorageEvent) => { if (event.key === revenueStorageKey) setState(readRevenueState()) }
    window.addEventListener("storage", listener)
    return () => window.removeEventListener("storage", listener)
  }, [])
  const save: RevenueSave = (change) => {
    try {
      const next = change(readRevenueState())
      localStorage.setItem(revenueStorageKey, JSON.stringify(next))
      setState(next)
      return true
    } catch (error) {
      notify(`Không thể lưu. ${error instanceof Error ? error.message : "Vui lòng thử lại."}`)
      return false
    }
  }
  return { state, save }
}
