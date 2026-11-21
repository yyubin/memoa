/** 마지막으로 축하한 레벨 (기기별). 메인 화면에 돌아왔을 때 레벨업 연출을 한 번만 보여주려고 씀 */
const key = (userId: string) => `memoa:lastLevel:${userId}`

export function lastSeenLevel(userId: string): number | null {
  try {
    const v = localStorage.getItem(key(userId))
    return v === null ? null : Number(v) || null
  } catch {
    return null
  }
}

export function markLevelSeen(userId: string, level: number) {
  try {
    localStorage.setItem(key(userId), String(level))
  } catch {
    /* 저장 못 해도 연출만 한 번 더 나올 뿐 */
  }
}
