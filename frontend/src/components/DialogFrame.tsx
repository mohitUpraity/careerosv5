import React, { useEffect, useRef } from 'react';

const dialogStack: HTMLElement[] = [];
let originalOverflow = '';
const focusableSelector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

interface DialogFrameProps {
  children: React.ReactNode;
  label: string;
  onClose: () => void;
  busy?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const DialogFrame: React.FC<DialogFrameProps> = ({ children, label, onClose, busy = false, className = '', style }) => {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (!dialogStack.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    dialogStack.push(dialog);
    const targets = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(el => el.getClientRects().length && !el.closest('[hidden]'));
    const frame = requestAnimationFrame(() => (dialog.querySelector<HTMLElement>('[autofocus]') || targets()[0] || dialog).focus());
    const handleKey = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!busyRef.current) closeRef.current();
      }
      if (event.key === 'Tab') {
        const items = targets();
        const first = items[0], last = items[items.length - 1];
        if (!items.length) { event.preventDefault(); dialog.focus(); }
        else if (!dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKey, true);
      dialogStack.splice(dialogStack.indexOf(dialog), 1);
      if (!dialogStack.length) document.body.style.overflow = originalOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return <div ref={ref} role="dialog" aria-modal="true" aria-label={label} aria-busy={busy} tabIndex={-1} className={`workspace-dialog-overlay ${className}`} style={style} onPointerDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>{children}</div>;
};
