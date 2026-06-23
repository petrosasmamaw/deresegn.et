import { useEffect, useId } from 'react'
import { X } from 'lucide-react'

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
  className = '',
  contentClassName = '',
  showHeader = true,
}) {
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return undefined

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`modal-content${wide ? ' modal-content-wide' : ''} ${contentClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <div className="modal-sheet-handle" aria-hidden="true" />

        {showHeader && (
          <div className="modal-header">
            <div className="modal-header-text">
              {title && (
                <h2 id={titleId} className="section-title modal-title">
                  {title}
                </h2>
              )}
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Close dialog"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
        )}

        <div className={`modal-inner ${className}`.trim()}>
          {children}
        </div>
      </div>
    </div>
  )
}
