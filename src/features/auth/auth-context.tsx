import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { apiRequest, configureHttpAuth } from '../../lib/http'
import { storage } from '../../lib/storage'
import { ApiError } from '../../types/api'
import type {
  AuthResponse,
  AuthSession,
  LoginRequest,
  SwitchContextRequest,
  SwitchContextResponse,
} from './types'

type AuthContextValue = {
  session: AuthSession | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (payload: LoginRequest) => Promise<void>
  switchContext: (payload: SwitchContextRequest) => Promise<SwitchContextResponse>
  logout: () => void
  refreshSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toSession(response: AuthResponse): AuthSession {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    userId: response.userId,
    email: response.email,
    role: response.role,
  }
}

function assertPlatformAdminRole(role: string | undefined): void {
  if ((role ?? '').toUpperCase() !== 'PLATFORM_ADMIN') {
    throw new ApiError('This console requires PLATFORM_ADMIN access.', 403)
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(() => storage.getSession())
  const [isLoading, setIsLoading] = useState(false)

  const persistSession = useCallback((next: AuthSession | null) => {
    setSession(next)
    if (next) storage.setSession(next)
    else storage.clearSession()
  }, [])

  const refreshSession = useCallback(async () => {
    const current = storage.getSession()
    if (!current?.refreshToken) throw new Error('No refresh token')
    const response = await apiRequest<AuthResponse>('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken: current.refreshToken },
    })
    assertPlatformAdminRole(response.role)
    persistSession(toSession(response))
  }, [persistSession])

  const login = useCallback(
    async (payload: LoginRequest) => {
      setIsLoading(true)
      try {
        const response = await apiRequest<AuthResponse>('/api/auth/login', {
          method: 'POST',
          body: payload,
        })
        assertPlatformAdminRole(response.role)
        persistSession(toSession(response))
      } finally {
        setIsLoading(false)
      }
    },
    [persistSession],
  )

  const logout = useCallback(() => {
    persistSession(null)
  }, [persistSession])

  const switchContext = useCallback(
    async (payload: SwitchContextRequest) => {
      const response = await apiRequest<SwitchContextResponse>('/api/auth/switch-context', {
        method: 'POST',
        body: payload,
      })
      persistSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        userId: response.userId,
        email: response.email,
        role: response.roleName,
      })
      return response
    },
    [persistSession],
  )

  useEffect(() => {
    configureHttpAuth(
      () => {
        const current = storage.getSession()
        if (!current) return null
        return {
          accessToken: current.accessToken,
          refreshToken: current.refreshToken,
        }
      },
      async () => {
        try {
          await refreshSession()
        } catch {
          logout()
        }
      },
    )
  }, [logout, refreshSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session?.accessToken),
      isLoading,
      login,
      switchContext,
      logout,
      refreshSession,
    }),
    [isLoading, login, logout, refreshSession, session, switchContext],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
