import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../types/api'
import { useAuth } from '../features/auth/auth-context'
import { useToast } from '../features/ui/toast-context'

type FromState = {
  from?: string
}

export function LoginPage() {
  const toast = useToast()
  const { login, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('jayulomi160@gmail.com')
  const [password, setPassword] = useState('Admin@123')

  const from = (location.state as FromState | null)?.from ?? '/app/overview'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await login({ email, password })
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Login failed')
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-blue-100 bg-white/95 p-6 shadow-sm">
        <img src="/logo.png" alt="Aduinola" className="mx-auto mb-4 h-12" />
        <h1 className="mt-2 text-center font-display text-2xl text-slate-900">Super Admin</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Sign in with your platform admin account.</p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm text-slate-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-blue-400 focus:ring"
            />
          </label>
          <label className="block text-sm text-slate-700">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none ring-blue-400 focus:ring"
            />
          </label>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-70"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
