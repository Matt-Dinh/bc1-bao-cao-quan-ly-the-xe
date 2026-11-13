import { workbookBytes } from "./parking-workbook"
import type { Workbook } from "./parking-ui"

self.onmessage = ({ data }: MessageEvent<Workbook>) => {
  try {
    const bytes = workbookBytes(data)
    self.postMessage({ bytes }, { transfer: [bytes] })
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Không thể tạo file Excel.",
    })
  }
}
