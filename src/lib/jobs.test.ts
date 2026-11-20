import { describe, expect, it } from 'vitest'
import { JOBS, getJob } from './jobs'

describe('jobs', () => {
  it('has exactly the four classes', () => {
    expect(JOBS.map((j) => j.id)).toEqual(['paladin', 'gunner', 'spellblade', 'witch'])
  })

  it('resolves known ids', () => {
    expect(getJob('witch')?.ko).toBe('마녀')
  })

  it('treats retired or unknown ids as no job', () => {
    for (const id of ['wizard', 'archer', 'rogue', '', undefined, null, 3]) expect(getJob(id)).toBeNull()
  })
})
