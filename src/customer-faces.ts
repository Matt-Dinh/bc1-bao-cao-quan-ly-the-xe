export const faceAngles = [
  { value: "CENTER", label: "Ảnh chính diện" },
  { value: "LEFT", label: "Ảnh góc trái" },
  { value: "RIGHT", label: "Ảnh góc phải" },
  { value: "UP", label: "Ảnh góc trên" },
  { value: "DOWN", label: "Ảnh góc dưới" },
] as const

export type FacePhoto = {
  angle: typeof faceAngles[number]["value"]
  src: string
}
export const maxFaceBytes = 5 * 1024 * 1024

export function validateFacePhotos(photos: FacePhoto[]) {
  if (photos.length > 5 || new Set(photos.map((photo) => photo.angle)).size !== photos.length)
    throw new Error("Mỗi góc khuôn mặt chỉ được có một ảnh, tối đa 5 ảnh.")
  if (photos.length && !photos.some((photo) => photo.angle === "CENTER"))
    throw new Error("Cần có ảnh chính diện trước các góc khuôn mặt khác.")
  for (const photo of photos) {
    const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo.src)
    if (!faceAngles.some((angle) => angle.value === photo.angle) || !match)
      throw new Error("Ảnh khuôn mặt phải là ảnh JPG hoặc PNG hợp lệ.")
    const bytes = match[2].length * 3 / 4 - (match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0)
    if (bytes > maxFaceBytes)
      throw new Error("Mỗi ảnh khuôn mặt không được vượt quá 5 MB.")
  }
}
