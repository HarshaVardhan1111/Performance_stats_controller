import { useRef, useState } from 'react';
import Icon from './Icon.jsx';

/** Drag-and-drop or click to pick one .xlsx file. */
export default function DropZone({ title, hint, onFile, busy = false, compact = false }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);

  const pick = (files) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={`dropzone ${compact ? 'dropzone--compact' : ''} ${over ? 'is-over' : ''} ${busy ? 'is-busy' : ''}`}
      role="button"
      tabIndex={0}
      aria-busy={busy}
      onClick={() => !busy && input.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !busy) {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!busy) pick(e.dataTransfer.files);
      }}
    >
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="dropzone__icon">{busy ? <span className="spinner" /> : <Icon name="upload" size={compact ? 20 : 26} />}</div>
      <div className="dropzone__text">
        <strong>{busy ? 'Reading file…' : title}</strong>
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}
