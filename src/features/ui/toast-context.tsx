import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react'

type ToastTone = 'success' | 'error' | 'info'

type ToastItem = {
  id: number
  tone: ToastTone
  message: string
}

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((prev) => [...prev, { id, tone, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 3500)
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
      info: (message: string) => push('info', message),
    }),
    [push],
  )

  const toneClass = (tone: ToastTone) =>
    `rounded-lg border px-3 py-2 text-sm shadow ${
      tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : tone === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-blue-200 bg-blue-50 text-blue-800'
    }`

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[1000] space-y-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={toneClass(toast.tone)}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
