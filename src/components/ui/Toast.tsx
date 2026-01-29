
/** @jsxImportSource hono/jsx/dom */
import { useState, useEffect } from 'hono/jsx'

// Simple event bus for toasts
type ToastEvent = CustomEvent<{ message: string; type?: 'success' | 'error' | 'info' }>
const TOAST_EVENT = 'show-toast'

export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent(TOAST_EVENT, { detail: { message, type } })
    window.dispatchEvent(event)
  }
}

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string; closing?: boolean }[]>([])

  useEffect(() => {
    const handleToast = (e: Event) => {
      const event = e as ToastEvent
      const id = Date.now()
      setToasts(prev => [...prev, { id, ...event.detail, closing: false }])

      // Start exit animation
      setTimeout(() => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, closing: true } : t))
        
        // Remove after animation completes
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== id))
        }, 300)
      }, 3000)
    }

    window.addEventListener(TOAST_EVENT, handleToast)
    return () => window.removeEventListener(TOAST_EVENT, handleToast)
  }, [])

  return (
    <>
      <style>{`
        @keyframes toastFadeIn {
          0% { opacity: 0; transform: translateY(20px); scale: 0.9; }
          100% { opacity: 1; transform: translateY(0); scale: 1; }
        }
        @keyframes toastFadeOut {
          0% { opacity: 1; transform: translateY(0); scale: 1; }
          100% { opacity: 0; transform: translateY(10px); scale: 0.95; }
        }
        .toast-enter {
          animation: toastFadeIn 0.3s cubic-bezier(0.21, 1.02, 0.73, 1) forwards;
        }
        .toast-exit {
          animation: toastFadeOut 0.3s ease-in forwards;
        }
      `}</style>
      <div class="fixed bottom-10 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-3 pointer-events-none w-max max-w-[90vw]">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            class={`${toast.closing ? 'toast-exit' : 'toast-enter'} bg-[#1a1a1a] text-white px-6 py-3.5 rounded-full text-[15px] font-semibold shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-md border border-white/10 flex items-center gap-2 pointer-events-auto`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </>
  )
}
