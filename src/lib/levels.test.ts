import { describe, expect, it } from 'vitest'
import { levelFromExp, expToReach, expFromRatingCounts, expForRating, MAX_LEVEL } from './levels'

describe('levels', () => {
  it('starts at level 1 with 0 exp', () => {
    expect(levelFromExp(0)).toEqual({ level: 1, exp: 0, curLevelExp: 0, nextLevelExp: 100, progress: 0, maxed: false })
  })

  it('follows the 50·L·(L−1) curve', () => {
    expect([1, 2, 3, 4, 5, 10].map(expToReach)).toEqual([0, 100, 300, 600, 1000, 4500])
  })

  it('levels up exactly at the threshold', () => {
    expect(levelFromExp(99).level).toBe(1)
    expect(levelFromExp(100).level).toBe(2)
    expect(levelFromExp(299).level).toBe(2)
    expect(levelFromExp(300).level).toBe(3)
  })

  it('reports current level bounds and progress', () => {
    const info = levelFromExp(450)
    expect(info.level).toBe(3)
    expect(info.curLevelExp).toBe(300)
    expect(info.nextLevelExp).toBe(600)
    expect(info.progress).toBeCloseTo(0.5)
  })

  it('caps at the max level', () => {
    const info = levelFromExp(10_000_000)
    expect(info.level).toBe(MAX_LEVEL)
    expect(info.maxed).toBe(true)
    expect(info.progress).toBe(1)
    expect(info.nextLevelExp).toBe(info.curLevelExp)
  })

  it('sanitizes bad input', () => {
    expect(levelFromExp(-5).exp).toBe(0)
    expect(levelFromExp(Number.NaN).level).toBe(1)
    expect(levelFromExp(150.9).exp).toBe(150)
  })

  it('weights exp by rating', () => {
    expect(expForRating(1)).toBe(4)
    expect(expForRating(4)).toBe(12)
    expect(expForRating(7)).toBe(0)
    expect(expFromRatingCounts({ 1: 2, 3: 10, 4: 1 })).toBe(8 + 100 + 12)
  })
})
