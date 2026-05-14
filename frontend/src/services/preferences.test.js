import { describe, it, expect, beforeEach } from 'vitest'
import { prefStorage, applyAppearancePrefs } from './preferences'

// Tworzy minimalny token JWT z podanym user id
function makeToken(userId) {
  const payload = btoa(JSON.stringify({ sub: String(userId) }))
  return `header.${payload}.signature`
}

describe('prefStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('bez zalogowanego użytkownika (gość)', () => {
    it('get zwraca fallback gdy klucz nie istnieje', () => {
      expect(prefStorage.get('accent_color', 'green')).toBe('green')
    })

    it('get zwraca null gdy brak fallbacka i brak klucza', () => {
      expect(prefStorage.get('nonexistent')).toBeNull()
    })

    it('set zapisuje wartość pod prefiksem guest', () => {
      prefStorage.set('theme', 'dark')
      expect(localStorage.getItem('pref_guest_theme')).toBe('dark')
    })

    it('get pobiera wcześniej zapisaną wartość', () => {
      prefStorage.set('accent_color', 'blue')
      expect(prefStorage.get('accent_color')).toBe('blue')
    })

    it('remove usuwa klucz', () => {
      prefStorage.set('to_remove', 'value')
      prefStorage.remove('to_remove')
      expect(prefStorage.get('to_remove')).toBeNull()
    })

    it('remove nie rzuca błędu gdy klucz nie istnieje', () => {
      expect(() => prefStorage.remove('nonexistent')).not.toThrow()
    })
  })

  describe('z zalogowanym użytkownikiem', () => {
    beforeEach(() => {
      localStorage.setItem('token', makeToken('42'))
    })

    it('set zapisuje wartość pod prefiksem user_id', () => {
      prefStorage.set('currency', 'EUR')
      expect(localStorage.getItem('pref_42_currency')).toBe('EUR')
    })

    it('get odczytuje wartość z prefiksu user_id', () => {
      prefStorage.set('sound', '1')
      expect(prefStorage.get('sound')).toBe('1')
    })

    it('różni użytkownicy mają izolowane preferencje', () => {
      prefStorage.set('accent_color', 'blue')

      // Logujemy się jako inny użytkownik
      localStorage.setItem('token', makeToken('99'))
      expect(prefStorage.get('accent_color')).toBeNull()
    })

    it('guest i user_42 mają osobne przestrzenie kluczy', () => {
      prefStorage.set('key', 'user_value')

      localStorage.removeItem('token')
      expect(prefStorage.get('key')).toBeNull()
    })
  })

  describe('z niepoprawnym tokenem', () => {
    it('get używa prefiksu guest gdy token jest uszkodzony', () => {
      localStorage.setItem('token', 'invalid.token')
      prefStorage.set('key', 'val')
      expect(localStorage.getItem('pref_guest_key')).toBe('val')
    })
  })
})

describe('applyAppearancePrefs', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-accent')
    document.documentElement.removeAttribute('data-reduce-motion')
  })

  it('usuwa data-accent gdy kolor to green (domyślny)', () => {
    prefStorage.set('accent_color', 'green')
    applyAppearancePrefs()
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false)
  })

  it('ustawia data-accent dla niestandardowego koloru', () => {
    prefStorage.set('accent_color', 'blue')
    applyAppearancePrefs()
    expect(document.documentElement.getAttribute('data-accent')).toBe('blue')
  })

  it('zmienia kolor akcentu na purple', () => {
    prefStorage.set('accent_color', 'purple')
    applyAppearancePrefs()
    expect(document.documentElement.getAttribute('data-accent')).toBe('purple')
  })

  it('ustawia data-reduce-motion gdy reduce_motion = "1"', () => {
    prefStorage.set('reduce_motion', '1')
    applyAppearancePrefs()
    expect(document.documentElement.hasAttribute('data-reduce-motion')).toBe(true)
  })

  it('usuwa data-reduce-motion gdy reduce_motion != "1"', () => {
    document.documentElement.setAttribute('data-reduce-motion', '')
    prefStorage.set('reduce_motion', '0')
    applyAppearancePrefs()
    expect(document.documentElement.hasAttribute('data-reduce-motion')).toBe(false)
  })

  it('nie ustawia data-accent gdy brak preferencji (domyślnie green)', () => {
    applyAppearancePrefs()
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false)
  })

  it('nadpisuje poprzedni kolor akcentu', () => {
    document.documentElement.setAttribute('data-accent', 'orange')
    prefStorage.set('accent_color', 'blue')
    applyAppearancePrefs()
    expect(document.documentElement.getAttribute('data-accent')).toBe('blue')
  })
})
