import { useEffect } from 'react';
import './MobileMenu.css';

/*
 * Phone ke liye: sirf ek hamburger icon dikhta hai.
 * Dabane par left se drawer khulta hai jisme saare controls hain.
 */
export default function MobileMenu({ open, onOpen, onClose, children }) {
  // Esc se band
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        className={`burger ${open ? 'is-open' : ''}`}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={open ? onClose : onOpen}
      >
        <span />
        <span />
        <span />
      </button>

      <div className={`drawer-scrim ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />

      <aside className={`drawer ${open ? 'is-open' : ''}`} aria-label="Menu" aria-hidden={!open}>
        <div className="drawer__head">
          <span className="drawer__stripe" aria-hidden="true" />
          <div>
            <h1 className="drawer__title">Gymnastics Academy</h1>
            <p className="drawer__sub">Training warehouse, three floors</p>
          </div>
        </div>
        <div className="drawer__body">{open && children}</div>
      </aside>
    </>
  );
}