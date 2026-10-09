import { useEffect, useRef, useState } from '../../vendor/hooks.module.js';
import { html } from './components.js';

export function Dropdown({ value, items, onChange, label, class: className = '' }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const closeEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);
  const current = items.find((item) => item.value === value);
  return html`<div class=${`ui-dropdown ${className}`} ref=${root}>
    <button type="button" class="ui-dropdown__trigger" aria-label=${label} aria-expanded=${open ? 'true' : 'false'}
      aria-haspopup="listbox" onClick=${() => setOpen(!open)}>
      <span>${current?.label ?? value}</span><span class="ui-dropdown__arrow" aria-hidden="true"></span>
    </button>
    ${open ? html`<div class="ui-dropdown__menu" role="listbox" aria-label=${label}>
      ${items.map((item) => html`<button key=${item.value} type="button" role="option" value=${item.value}
        lang=${item.lang || undefined} title=${item.title || undefined} aria-selected=${item.value === value ? 'true' : 'false'}
        class=${item.value === value ? 'is-on' : ''} onClick=${() => { onChange(item.value); setOpen(false); }}>${item.label}</button>`)}
    </div>` : null}
  </div>`;
}
