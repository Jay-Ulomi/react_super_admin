import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'

export function ProtectedRoute() {
  const { isAuthenticated, session } = useAuth()
  const location = useLocation()
  const isPlatformAdmin = (session?.role ?? '').toUpperCase() === 'PLATFORM_ADMIN'
  if (!isAuthenticated || !isPlatformAdmin) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function PublicOnlyRoute() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/app/overview" replace />
  return <Outlet />
}
