import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isWindowOpen, getWindowRemainingMs } from './window-utils'

describe('isWindowOpen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-19T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna false quando não há mensagem do cliente (null)', () => {
    expect(isWindowOpen(null)).toBe(false)
  })

  it('retorna true quando a última mensagem foi há 1 hora', () => {
    const oneHourAgo = new Date('2026-06-19T11:00:00.000Z').toISOString()
    expect(isWindowOpen(oneHourAgo)).toBe(true)
  })

  it('retorna true quando a última mensagem foi há 23h59m', () => {
    const almostExpired = new Date('2026-06-18T12:01:00.000Z').toISOString()
    expect(isWindowOpen(almostExpired)).toBe(true)
  })

  it('retorna false quando a última mensagem foi há exatamente 24h', () => {
    const exactlyExpired = new Date('2026-06-18T12:00:00.000Z').toISOString()
    expect(isWindowOpen(exactlyExpired)).toBe(false)
  })

  it('retorna false quando a última mensagem foi há 25h', () => {
    const expired = new Date('2026-06-18T11:00:00.000Z').toISOString()
    expect(isWindowOpen(expired)).toBe(false)
  })
})

describe('getWindowRemainingMs', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-19T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna 0 quando null', () => {
    expect(getWindowRemainingMs(null)).toBe(0)
  })

  it('retorna 0 quando expirado', () => {
    const expired = new Date('2026-06-18T10:00:00.000Z').toISOString()
    expect(getWindowRemainingMs(expired)).toBe(0)
  })

  it('retorna ms restantes quando dentro da janela', () => {
    const oneHourAgo = new Date('2026-06-19T11:00:00.000Z').toISOString()
    const expected = 23 * 60 * 60 * 1000
    expect(getWindowRemainingMs(oneHourAgo)).toBe(expected)
  })
})
