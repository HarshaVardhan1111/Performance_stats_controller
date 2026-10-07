import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

/** Sticky bottom bar: what will change + the Apply button + live progress. */
export function ApplyBar({ counts, running, lastMessage, onApply, onReset }) {
  const total = counts.inserts + counts.employees;
  const parts = [];
  if (counts.inserts) parts.push(`${counts.inserts} row block${counts.inserts === 1 ? '' : 's'}`);
  if (counts.employees) parts.push(`${counts.employees} new sheet${counts.employees === 1 ? '' : 's'}`);

  return (
    <div className={`applybar ${running ? 'is-running' : ''}`}>
      <div className="applybar__inner">
        <div className="applybar__info">
          {running ? (
            <>
              <span className="spinner" />
              <span className="applybar__msg">{lastMessage || 'Working…'}</span>
            </>
          ) : total ? (
            <>
              <span className="count">{total}</span>
              <span>{parts.join(' · ')}</span>
            </>
          ) : (
            <span className="muted">No changes yet</span>
          )}
        </div>
        <div className="btn-row">
          {!running && total > 0 && (
            <button type="button" className="btn btn--ghost" onClick={onReset}>
              Discard
            </button>
          )}
          <button type="button" className="btn btn--primary btn--lg" onClick={onApply} disabled={running || !total}>
            <Icon name="download" size={18} /> {running ? 'Working…' : 'Apply & download'}
          </button>
        </div>
      </div>
      {running && <div className="applybar__progress" />}
    </div>
  );
}

export function ResultCard({ result, onDownload, onDismiss }) {
  const s = result.summary;
  const lines = [];
  if (s.rowsAdded) lines.push(`${s.rowsAdded} row(s) inserted in every sheet${s.formulasUpdated ? `, ${s.formulasUpdated} formula(s) adjusted` : ''}`);
  if (s.sheetsCreated.length) lines.push(`${s.sheetsCreated.length} new employee sheet(s) created`);
  return (
    <section className="card card--ok result" role="status">
      <div className="result__icon">
        <Icon name="check" size={22} />
      </div>
      <div className="result__body">
        <h2>Done — “{result.fileName}” downloaded</h2>
        <ul className="plain-list">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
          {s.employeesSkipped.length > 0 && <li className="warn-text">{s.employeesSkipped.length} employee(s) skipped (already had a sheet)</li>}
          {s.sheetsSkipped.length > 0 && <li className="warn-text">{s.sheetsSkipped.length} sheet(s) skipped because their rows differ from REF: {s.sheetsSkipped.join(', ')}</li>}
        </ul>
        <p className="muted small">You can keep editing — the next run starts from this updated file.</p>
      </div>
      <div className="btn-row result__actions">
        <button type="button" className="btn btn--soft" onClick={onDownload}>
          <Icon name="download" size={16} /> Download again
        </button>
        <button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dismiss">
          <Icon name="x" />
        </button>
      </div>
    </section>
  );
}

export function LogPanel({ log }) {
  const [open, setOpen] = useState(false);
  const end = useRef(null);
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: 'nearest' });
  }, [log, open]);
  if (!log.length) return null;
  return (
    <details className="card details log" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Activity log ({log.length})</summary>
      <ol className="log__list">
        {log.map((l, i) => (
          <li key={i} className={`log--${l.level}`}>
            <time>{l.time}</time> {l.message}
          </li>
        ))}
        <li ref={end} aria-hidden="true" />
      </ol>
    </details>
  );
}
