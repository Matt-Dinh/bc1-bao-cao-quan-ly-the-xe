import { normalize } from "./data"
import type { Card } from "./data"
import { cardTechnologies } from "./vehicle-energy"

export interface CardImportRow {
  id: string
  frontCode?: string
  rearCode?: string
  technology?: string
  error: string
}
export const emptyImportRow = (): CardImportRow => ({ id: "", frontCode: "", rearCode: "", technology: "", error: "" })
export function checkCardImportRows(rows: CardImportRow[], cards: Card[], defaultTechnology: string): CardImportRow[] {
  const seen = new Set<string>()
  const existing = new Set(cards.map((card) => normalize(card.id)))
  return rows.map((row) => {
    const id = row.id.trim(), code = normalize(id)
    const technology = row.technology || defaultTechnology
    const error = !id ? "Mã thẻ không được để trống" : id.length > 50 || /\s/.test(id)
      ? "Mã thẻ tối đa 50 ký tự, không có khoảng trắng"
      : existing.has(code) ? "Mã thẻ đã tồn tại trong hệ thống"
      : seen.has(code) ? "Trùng mã trong danh sách nhập"
      : (row.frontCode || "").trim().length > 50 || (row.rearCode || "").trim().length > 50
        ? "Mã mặt trước / mặt sau tối đa 50 ký tự"
        : !cardTechnologies.includes(technology as typeof cardTechnologies[number]) ? "Chọn kiểu thẻ Mifare hoặc Proximity (thẻ UHF không nhập kho)" : ""
    seen.add(code)
    return { ...row, id, error }
  })
}
