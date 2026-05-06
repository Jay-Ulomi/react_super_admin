import type { AuthSession } from '../features/auth/types'

const SESSION_KEY = 'super_admin_session'

export const storage = {
  getSession(): AuthSession | null {
    const value = localStorage.getItem(SESSION_KEY)
    if (!value) return null
    try {
      return JSON.parse(value) as AuthSession
    } catch {
      return null
    }
  },

  setSession(session: AuthSession): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  },

  clearSession(): void {
    localStorage.removeItem(SESSION_KEY)
  },
}
