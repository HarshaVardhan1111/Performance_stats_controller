import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

// Generic metric rows used across the template. Process titles are never stored here.
const STANDARD_ROWS = [
  'Average orders',
  'Team Average orders',
  'Internal Errors',
  'Internal Quality %',
  'External Errors',
  'External Quality %',
  'Error Cost $',
];

let keySeq = 0;
const row = (text = '') => ({ key: ++keySeq, text });

export default function InsertEditor({ draft, position, palette, targetCount, onSave, onCancel }) {
  const [title, setTitle] = useState(draft.labels[0] ?? '');
  const [rows, setRows] = useState(() => draft.labels.slice(1).map((t) => row(t)));
  const [color, setColor] = useState(draft.color);
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const focusKey = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (focusKey.current) {
      document.getElementById(`row-${focusKey.current}`)?.focus();
      focusKey.current = null;
    }
  });

  const update = (key, text) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, text } : r)));
  const remove = (key) => setRows((rs) => rs.filter((r) => r.key !== key));
  const move = (index, dir) =>
    setRows((rs) => {
      const next = [...rs];
      const j = index + dir;
      if (j < 0 || j >= next.length) return rs;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  const addAfter = (index) => {
    const r = row();
    focusKey.current = r.key;
    setRows((rs) => [...rs.slice(0, index + 1), r, ...rs.slice(index + 1)]);
  };
  const addMany = (texts) => setRows((rs) => [...rs.filter((r) => r.text.trim()), ...texts.map((t) => row(t))]);

  const labels = [title, ...rows.map((r) => r.text)].map((t) => t.trim()).filter(Boolean);
  const lastIsCost = /^error cost/i.test(labels[labels.length - 1] ?? '');
  const valid = title.trim().length > 0;

  const submit = (e) => {
    e.preventDefault();
    if (valid) onSave({ ...draft, labels, color });
  };

  return (
    <form className="editor" onSubmit={submit} aria-label="New rows editor">
      <div className="editor__head">
        <div>
          <h3>{draft.uid ? 'Edit new rows' : 'Insert new rows'}</h3>
          <p className="muted">{position}</p>
        </div>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close editor">
          <Icon name="x" />
        </button>
      </div>

      <label className="field">
        <span>Process title (first row)</span>
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. New Process Ticket Trend"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addAfter(-1);
            }
          }}
        />
      </label>

      <div className="field">
        <span>
          Rows <em className="muted">· no limit</em>
        </span>
        {rows.length === 0 && <p className="empty-note">No rows yet. Add rows one by one, paste a list, or use the standard rows.</p>}
        <ol className="row-list">
          {rows.map((r, i) => (
            <li key={r.key}>
              <span className="row-list__num">{i + 2}</span>
              <input
                id={`row-${r.key}`}
                value={r.text}
                onChange={(e) => update(r.key, e.target.value)}
                placeholder="Row label"
                aria-label={`Row ${i + 2}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAfter(i);
                  }
                }}
              />
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                <Icon name="up" size={15} />
              </button>
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">
                <Icon name="down" size={15} />
              </button>
              <button type="button" className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => remove(r.key)} aria-label="Remove row">
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ol>
        <div className="btn-row">
          <button type="button" className="btn btn--soft" onClick={() => addAfter(rows.length - 1)}>
            <Icon name="plus" size={16} /> Add row
          </button>
          <button type="button" className="btn btn--soft" onClick={() => setPasting((p) => !p)}>
            <Icon name="list" size={16} /> Paste list
          </button>
          <button type="button" className="btn btn--soft" onClick={() => addMany(STANDARD_ROWS)}>
            <Icon name="sparkle" size={16} /> Standard rows
          </button>
        </div>
        {pasting && (
          <div className="paste">
            <textarea
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'One row per line, for example:\nAverage orders\nInternal Errors\nError Cost $'}
            />
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => {
                addMany(pasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
                setPasteText('');
                setPasting(false);
              }}
            >
              Add these rows
            </button>
          </div>
        )}
        {labels.length > 1 && !lastIsCost && (
          <p className="hint">
            <Icon name="alert" size={14} /> Tip: end a process with an “Error Cost $” row so it shows as one block next time.
          </p>
        )}
      </div>

      <div className="field">
        <span>Row colour</span>
        <div className="swatches">
          {palette.slice(0, 14).map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch ${c.toUpperCase() === color.toUpperCase() ? 'is-active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Colour ${c}`}
            />
          ))}
          <label className="swatch swatch--custom" title="Custom colour">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} aria-label="Custom colour" />
            <Icon name="plus" size={14} />
          </label>
          <code className="muted">{color}</code>
        </div>
      </div>

      <div className="preview" aria-label="Preview">
        {labels.slice(0, 6).map((l, i) => (
          <div key={i} className="preview__row" style={{ background: color }}>
            {l}
          </div>
        ))}
        {labels.length > 6 && <div className="preview__more">+ {labels.length - 6} more rows</div>}
      </div>

      <div className="editor__foot">
        <span className="muted">
          {labels.length} row{labels.length === 1 ? '' : 's'} × {targetCount} sheets
        </span>
        <div className="btn-row">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!valid}>
            <Icon name="check" size={16} /> {draft.uid ? 'Update' : 'Add to changes'}
          </button>
        </div>
      </div>
    </form>
  );
}
