import React, { useEffect, useState } from 'react'

/**
 * Full-screen modal overlay that sits above the app sidebar (z-300)
 * and, on desktop, is inset to the main content area so the dialog
 * centers in the visible screen next to the sidebar.
 */
const ContentAreaOverlay = ({ open, onClose, children, panelClassName = '' }) => {
    const [leftOffset, setLeftOffset] = useState(0)

    useEffect(() => {
        if (!open) return undefined

        const updateOffset = () => {
            if (typeof window === 'undefined' || window.innerWidth < 1024) {
                setLeftOffset(0)
                return
            }
            const sidebar = document.querySelector('[data-app-sidebar]')
            if (!sidebar) {
                setLeftOffset(280)
                return
            }
            const rect = sidebar.getBoundingClientRect()
            // Only inset when the sidebar is visible on-screen (not off-canvas on mobile).
            setLeftOffset(rect.width > 0 && rect.right > 0 ? Math.round(rect.right) : 0)
        }

        updateOffset()
        window.addEventListener('resize', updateOffset)
        const sidebar = document.querySelector('[data-app-sidebar]')
        const observer = sidebar
            ? new MutationObserver(updateOffset)
            : null
        if (sidebar && observer) {
            observer.observe(sidebar, { attributes: true, attributeFilter: ['class', 'style'] })
        }

        return () => {
            window.removeEventListener('resize', updateOffset)
            observer?.disconnect()
        }
    }, [open])

    if (!open) return null

    return (
        <div
            className='fixed inset-0 z-500 flex items-center justify-center p-4'
            style={{ left: leftOffset }}
            role='dialog'
            aria-modal='true'
        >
            <div className='absolute inset-0 bg-black/40' onClick={onClose} aria-hidden='true' />
            <div className={`relative z-10 w-full max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-lg p-5 py-4 ${panelClassName}`}>
                {children}
            </div>
        </div>
    )
}

export default ContentAreaOverlay
