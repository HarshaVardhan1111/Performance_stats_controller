import { Fragment, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import InsertEditor from './InsertEditor.jsx';

function describe(at, layout) {
  const row = layout.rows.find((r) => r.row === at);
  return row ? `Above row ${at} · “${row.label}”` : `At the end · after row ${layout.lastRow}`;
}

function PendingCard({ insert, onEdit, onRemove }) {
  return (
    <div className="pending" style={{ '--block': insert.color }}>
      <span className="badge badge--new">New</span>
      <div className="pending__text">
        <strong>{insert.labels[0]}</strong>
        <span className="muted">
          {insert.labels.length} row{insert.labels.length === 1 ? '' : 's'}
        </span>
      </div>
      <button type="button" className="icon-btn icon-btn--sm" onClick={onEdit} aria-label="Edit">
        <Icon name="edit" size={15} />
      </button>
      <button type="button" className="icon-btn icon-btn--sm icon-btn--danger" onClick={onRemove} aria-label="Remove">
        <Icon name="trash" size={15} />
      </button>
    </div>
  );
}

function Slot({ at, layout, inserts, active, inner, label, onOpen, onEdit, onRemove }) {
  const here = inserts.filter((i) => i.at === at);
  return (
    <div className={`slot ${inner ? 'slot--inner' : ''} ${active ? 'is-active' : ''} ${here.length ? 'has-pending' : ''}`}>
      {here.map((ins) => (
        <PendingCard key={ins.uid} insert={ins} onEdit={() => onEdit(ins)} onRemove={() => onRemove(ins.uid)} />
      ))}
      <button type="button" className="slot__btn" onClick={() => onOpen(at)} aria-label={`Insert rows ${describe(at, layout).toLowerCase()}`}>
        <span className="slot__line" />
        <span className="slot__label">
          <Icon name="plus" size={14} /> {label ?? 'Insert here'}
        </span>
        <span className="slot__line" />
      </button>
    </div>
  );
}

export default function ProcessesTab({ layout, inserts, targetCount, onSave, onRemove }) {
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(() => new Set());

  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () => (q ? layout.groups.filter((g) => g.rows.some((r) => r.label.toLowerCase().includes(q))) : layout.groups),
    [layout, q],
  );
  const palette = layout.colorPalette.length ? layout.colorPalette : ['#D9E1F2'];

  const openNew = (at) => setDraft({ at, labels: [''], color: palette[palette.length - 1] ?? '#D9E1F2' });
  const toggle = (key) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const slotProps = { layout, inserts, onOpen: openNew, onEdit: (ins) => setDraft(ins), onRemove };

  return (
    <div className={`processes ${draft ? 'has-editor' : ''}`}>
      <section className="card outline-card">
        <div className="outline-head">
          <div>
            <h2>Processes</h2>
            <p className="muted">Pick any spot and insert new rows. Changes go into REF and every employee sheet.</p>
          </div>
          <label className="search">
            <Icon name="search" size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search rows…" aria-label="Search rows" />
          </label>
        </div>

        <div className="outline">
          {groups.length === 0 && <p className="empty-note">No rows match “{query}”.</p>}
          {groups.map((g) => {
            const expanded = open.has(g.key) || Boolean(q);
            return (
              <Fragment key={g.key}>
                <Slot at={g.startRow} active={draft?.at === g.startRow && !draft?.uid} {...slotProps} />
                <div className={`group ${expanded ? 'is-open' : ''}`} style={{ '--block': g.fill ?? 'transparent' }}>
                  <button type="button" className="group__head" onClick={() => toggle(g.key)} aria-expanded={expanded}>
                    <span className="group__swatch" />
                    <span className="group__title">{g.title}</span>
                    <span className="group__meta">
                      {g.rows.length} row{g.rows.length === 1 ? '' : 's'} · {g.startRow}
                      {g.endRow !== g.startRow ? `–${g.endRow}` : ''}
                    </span>
                    <Icon name="chevron" size={16} className="group__chev" />
                  </button>
                  {expanded && (
                    <div className="group__rows">
                      {g.rows.map((r, i) => (
                        <Fragment key={r.row}>
                          {i > 0 && <Slot inner at={r.row} active={draft?.at === r.row && !draft?.uid} {...slotProps} />}
                          <div className={`row-line ${q && r.label.toLowerCase().includes(q) ? 'is-hit' : ''}`}>
                            <span className="row-line__num">{r.row}</span>
                            <span>{r.label || <em className="muted">(empty)</em>}</span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
          {!q && <Slot at={layout.lastRow + 1} label="Add at the end" active={draft?.at === layout.lastRow + 1 && !draft?.uid} {...slotProps} />}
        </div>
      </section>

      {draft && (
        <aside className="editor-panel">
          <div className="editor-backdrop" onClick={() => setDraft(null)} />
          <div className="card editor-card">
            <InsertEditor
              key={draft.uid ?? `new-${draft.at}`}
              draft={draft}
              position={describe(draft.at, layout)}
              palette={palette}
              targetCount={targetCount}
              onCancel={() => setDraft(null)}
              onSave={(ins) => {
                onSave(ins);
                setDraft(null);
              }}
            />
          </div>
        </aside>
      )}
    </div>
  );
}
