/** 로그인한 사용자의 프로필(직업 포함)을 앱 전체에서 공유하는 작은 스토어 */
import { getProfile } from './api'
import { getJob, type Job } from './jobs'
import type { Profile } from './types'

export const me = $state<{ profile: Profile | null }>({ profile: null })

let pending: Promise<Profile> | null = null

/** 프로필을 불러와 스토어에 넣는다. 이미 있으면 그대로, force 면 새로 (진행 중인 요청은 공유) */
export function loadProfile(force = false): Promise<Profile> {
  if (pending) return pending
  if (!force && me.profile) return Promise.resolve(me.profile)
  pending = getProfile()
    .then((p) => (me.profile = p))
    .finally(() => (pending = null))
  return pending
}

export function clearProfile() {
  me.profile = null
}

/** 현재 직업 (모르거나 아직 안 골랐으면 null) */
export function myJob(): Job | null {
  return getJob(me.profile?.settings.job)
}
