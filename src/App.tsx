import { RouterProvider } from 'react-router-dom'
import { appRouter } from './app/router'
import { ToastProvider } from './features/ui/toast-context'

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={appRouter} />
    </ToastProvider>
  )
}
