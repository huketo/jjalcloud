
/** @jsxImportSource hono/jsx/dom */
import { render } from 'hono/jsx/dom'
import { ToastContainer } from './components/ui/Toast'
import { DetailActions } from './islands/DetailActions'

// Mount Toast Container globally
const toastRoot = document.getElementById('toast-root')
if (toastRoot) {
  render(<ToastContainer />, toastRoot)
}

// Mount Detail Actions if present
const detailActionsRoot = document.getElementById('detail-actions-root')
if (detailActionsRoot) {
  const propsInJSON = detailActionsRoot.getAttribute('data-props');
  const props = propsInJSON ? JSON.parse(propsInJSON) : {};
  render(<DetailActions {...props} />, detailActionsRoot)
}

// Global Event Delegation for simple interactions (like Card Copy)
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('[data-copy-text]') as HTMLElement | null
  const menuTrigger = (e.target as HTMLElement).closest('[data-toggle-menu]') as HTMLElement | null
  const mobileMenu = document.getElementById('mobile-menu')
  
  // Handle Copy Button
  if (target) {
    const text = target.getAttribute('data-copy-text')
    const message = target.getAttribute('data-copy-message') || '✅ Link copied to clipboard!'
    
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        // Dispatch custom event that ToastContainer listens to
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type: 'success' } }))
      }).catch(err => {
        console.error('Failed to copy', err)
      })
    }
  }

  // Handle Mobile Menu Toggle
  if (menuTrigger) {
    if (mobileMenu) {
      mobileMenu.classList.toggle('hidden')
      const isExpanded = !mobileMenu.classList.contains('hidden')
      menuTrigger.setAttribute('aria-expanded', String(isExpanded))
    }
  } else if (mobileMenu && !mobileMenu.classList.contains('hidden') && !(e.target as HTMLElement).closest('#mobile-menu')) {
    // Close menu when clicking outside
    mobileMenu.classList.add('hidden')
    const trigger = document.querySelector('[data-toggle-menu]')
    if (trigger) trigger.setAttribute('aria-expanded', 'false')
  }
})
