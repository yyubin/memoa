/** 직업(클래스) 메타데이터. 그림은 components/JobArt.svelte */

export type JobId = 'paladin' | 'gunner' | 'spellblade' | 'witch'

export interface Job {
  id: JobId
  /** 화면 큰 제목 (레퍼런스처럼 영문) */
  name: string
  ko: string
  /** 공부 스타일과 엮은 한 줄 소개 */
  motto: string
}

export const JOBS: Job[] = [
  { id: 'paladin', name: 'Paladin', ko: '팔라딘', motto: '매일 복습으로 단어를 지키는 꾸준함의 기사' },
  { id: 'gunner', name: 'Gunner', ko: '거너', motto: '뜻을 한 발에 맞히는 정확도의 명사수' },
  { id: 'spellblade', name: 'Spellblade', ko: '마검사', motto: '어원과 예문을 검에 새겨 외우는 마법 검객' },
  { id: 'witch', name: 'Witch', ko: '마녀', motto: '단어를 물약처럼 조합해 기억에 녹이는 연금술사' },
]

/** 저장된 직업 id → 직업. 목록에 없는 id(예전 wizard/archer/rogue 등)는 '직업 없음'(null) */
export function getJob(id: unknown): Job | null {
  return JOBS.find((j) => j.id === id) ?? null
}
