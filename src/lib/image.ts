/** 첨부 이미지를 저장 전에 줄인다. 청첩장 스크린샷은 글자만 읽히면 되므로 긴 변 1600px 이면 충분하다. */
const MAX_EDGE = 1600
const QUALITY = 0.82

export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('이미지 파일만 첨부할 수 있습니다.')
  // GIF/HEIC 등 캔버스 변환이 어색한 포맷과 이미 작은 파일은 원본을 그대로 쓴다.
  if (file.type === 'image/gif' || file.size < 300 * 1024) return file

  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)
  if ('close' in bitmap) bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  )
  if (!blob) return file
  return blob.size < file.size ? blob : file
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // 폴백으로 진행
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'))
      img.src = url
    })
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

/** 클립보드/드래그 이벤트에서 이미지 파일을 찾는다. */
export function extractImageFile(items: DataTransferItemList | null): File | null {
  if (!items) return null
  for (const item of Array.from(items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  return null
}
