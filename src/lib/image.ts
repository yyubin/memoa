/** 사진을 긴 변 최대 maxSide 로 줄이고 JPEG base64 로 변환 (폰 사진 수 MB → 수백 KB) */
export async function prepareImage(file: File, maxSide = 1800, quality = 0.85): Promise<{ base64: string; mediaType: 'image/jpeg'; preview: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { base64: dataUrl.split(',')[1], mediaType: 'image/jpeg', preview: dataUrl }
}
