import * as XLSX from "xlsx"
import type { Workbook } from "./parking-ui"

export function workbookBytes(sheets: Workbook): ArrayBuffer {
  const book = XLSX.utils.book_new()
  for (const [title, rows] of Object.entries(sheets)) {
    // Excel serial dates preserve the GMT+7 wall-clock values regardless of browser time zone.
    const values = rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          value instanceof Date ? value.getTime() / 86_400_000 + 25569 : value,
        ]),
      ),
    )
    const sheet = XLSX.utils.json_to_sheet(values)
    const columns = [...new Set(rows.flatMap(Object.keys))]
    for (const [index, row] of rows.entries())
      for (const [key, value] of Object.entries(row)) {
        if (!(value instanceof Date)) continue
        const cell = sheet[
          XLSX.utils.encode_cell({ r: index + 1, c: columns.indexOf(key) })
        ] as XLSX.CellObject
        cell.z = "dd/mm/yyyy hh:mm:ss"
      }
    for (const key of Object.keys(sheet)) {
      const cell = sheet[key] as XLSX.CellObject
      if (cell.t === "s") delete cell.f
    }
    XLSX.utils.book_append_sheet(
      book,
      sheet,
      title.replace(/[\\/?*\[\]:]/g, " ").slice(0, 31),
    )
  }
  return XLSX.write(book, {
    bookType: "xlsx",
    type: "array",
    compression: true,
  }) as ArrayBuffer
}
