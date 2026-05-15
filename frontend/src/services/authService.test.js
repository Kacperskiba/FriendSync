import { vi, describe, it, expect, beforeEach } from 'vitest'
import axios from 'axios'
import { login, register } from './authService'

vi.mock('axios')

describe('authService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('wysyła POST na endpoint /login', async () => {
      axios.post.mockResolvedValue({ data: { access_token: 'tok', token_type: 'bearer' } })
      await login('testuser', 'pass123')
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/login'),
        expect.any(FormData)
      )
    })

    it('wysyła dane jako FormData (wymagane przez OAuth2)', async () => {
      axios.post.mockResolvedValue({ data: { access_token: 'tok', token_type: 'bearer' } })
      await login('testuser', 'pass123')

      const [, formData] = axios.post.mock.calls[0]
      expect(formData).toBeInstanceOf(FormData)
      expect(formData.get('username')).toBe('testuser')
      expect(formData.get('password')).toBe('pass123')
    })

    it('zapisuje access_token w localStorage', async () => {
      axios.post.mockResolvedValue({ data: { access_token: 'abc123', token_type: 'bearer' } })
      await login('testuser', 'pass123')
      expect(localStorage.getItem('token')).toBe('abc123')
    })

    it('zwraca dane odpowiedzi', async () => {
      const mockData = { access_token: 'token123', token_type: 'bearer' }
      axios.post.mockResolvedValue({ data: mockData })
      const result = await login('testuser', 'pass')
      expect(result).toEqual(mockData)
    })

    it('nie zapisuje tokena gdy brak access_token w odpowiedzi', async () => {
      axios.post.mockResolvedValue({ data: {} })
      await login('testuser', 'pass')
      expect(localStorage.getItem('token')).toBeNull()
    })

    it('propaguje błąd gdy API zwraca błąd', async () => {
      axios.post.mockRejectedValue(new Error('Network Error'))
      await expect(login('user', 'pass')).rejects.toThrow('Network Error')
    })

    it('token z poprzedniej sesji jest nadpisywany', async () => {
      localStorage.setItem('token', 'old-token')
      axios.post.mockResolvedValue({ data: { access_token: 'new-token', token_type: 'bearer' } })
      await login('user', 'pass')
      expect(localStorage.getItem('token')).toBe('new-token')
    })
  })

  describe('register', () => {
    it('wysyła POST na endpoint /register', async () => {
      axios.post.mockResolvedValue({ data: { id: 1, username: 'newuser' } })
      const formData = new FormData()
      formData.append('username', 'newuser')
      await register(formData)
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/register'),
        formData
      )
    })

    it('zwraca dane nowo utworzonego użytkownika', async () => {
      const mockUser = { id: 1, username: 'newuser', email: 'new@example.com' }
      axios.post.mockResolvedValue({ data: mockUser })
      const result = await register({})
      expect(result).toEqual(mockUser)
    })

    it('propaguje błąd gdy rejestracja się nie powiedzie', async () => {
      const error = new Error('Email zajęty')
      axios.post.mockRejectedValue(error)
      await expect(register({})).rejects.toThrow('Email zajęty')
    })

    it('nie modyfikuje localStorage podczas rejestracji', async () => {
      axios.post.mockResolvedValue({ data: { id: 1, username: 'u' } })
      await register({})
      expect(localStorage.getItem('token')).toBeNull()
    })
  })
})
