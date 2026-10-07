import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import DropZone from './DropZone.jsx';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SOURCE_BADGE = { saved: ['Saved', 'badge--ok'], auto: ['Suggested', 'badge--info'], manual: ['Chosen', 'badge--ok'] };

export default function MonthlyFillTab({
  analysis,
  perf,
  perfBusy,
  perfError,
  onLoadPerf,
  month,
  onMonth,
  mappings,
  onMapping,
  enabled,
  onEnabled,
  pendingEmployees,
  onAddEmployees,
}) {
  const [showAll, setShowAll] = useState(false);
  const targets = analysis.targets;
  const byKey = useMemo(() => new Map(targets.map((t) => [t.key, t])), [targets]);

  const missing = useMemo(() => {
    if (!perf) return [];
    const have = new Set([...analysis.employees.map((e) => e.id), ...pendingEmployees.map((e) => e.id)]);
    const out = new Map();
    for (const s of perf.info.sheets) for (const p of s.people) if (!have.has(p.id) && !out.has(p.id)) out.set(p.id, p.name);
    return [...out].map(([id, name]) => ({ id, name }));
  }, [perf, analysis, pendingEmployees]);

  const sheets = perf?.info.sheets ?? [];
  const mapped = sheets.filter((s) => mappings[s.name]?.key).length;
  const visible = showAll ? sheets : sheets.slice(0, 40);

  return (
    <div className="stack">
      <section className="card">
        <div className="section-head">
          <div>
            <h2>Monthly fill</h2>
            <p className="muted">Copies each person’s numbers from the monthly performance file into their sheet. Rows are found by name, not by fixed row numbers.</p>
          </div>
          {perf && (
            <label className="switch">
              <input type="checkbox" checked={enabled} onChange={(e) => onEnabled(e.target.checked)} />
              <span className="switch__track" />
              <span>Include in this run</span>
            </label>
          )}
        </div>
        <DropZone
          compact
          title={perf ? `Loaded: ${perf.fileName} — drop another to replace` : 'Drop the monthly performance file (.xlsx)'}
          hint={perf ? `${sheets.length} sheets with an “Emp ID” column` : 'Each sheet needs an “Emp ID” column in row 1'}
          onFile={onLoadPerf}
          busy={perfBusy}
        />
        {perfError && (
          <p className="form-error" role="alert">
            <Icon name="alert" size={14} /> {perfError}
          </p>
        )}

        <div className="field">
          <span>
            <Icon name="calendar" size={14} /> Month
          </span>
          <div className="months" role="radiogroup" aria-label="Month">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={month === i + 1}
                className={`month ${month === i + 1 ? 'is-active' : ''}`}
                onClick={() => onMonth(i + 1)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </section>

      {perf && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2>Match sheets to rows</h2>
              <p className="muted">
                {mapped} of {sheets.length} sheets matched. Your choices are remembered in this browser only.
              </p>
            </div>
          </div>
          {sheets.length === 0 ? (
            <p className="empty-note">No sheet in this file has an “Emp ID” header in row 1.</p>
          ) : (
            <div className="table-wrap">
              <table className="table table--map">
                <thead>
                  <tr>
                    <th>Performance sheet</th>
                    <th>Goes into</th>
                    <th>Rows copied</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => {
                    const m = mappings[s.name];
                    const t = m?.key ? byKey.get(m.key) : null;
                    const count = t ? Math.min(s.headers.length, t.span) : 0;
                    const badge = m?.key ? SOURCE_BADGE[m.source] : null;
                    return (
                      <tr key={s.name} className={t ? '' : 'is-off'}>
                        <td>
                          <strong>{s.name}</strong>
                          <div className="muted small">
                            {s.people.length} people · {s.headers.length} column{s.headers.length === 1 ? '' : 's'}
                          </div>
                        </td>
                        <td>
                          <div className="map-cell">
                            {t && <span className="dot" style={{ background: t.fill ?? 'transparent' }} />}
                            <select value={m?.key ?? ''} onChange={(e) => onMapping(s.name, e.target.value)} aria-label={`Target for ${s.name}`}>
                              <option value="">— Skip —</option>
                              {t?.kind === 'row' && (
                                <option value={t.key}>
                                  {t.label} (row {t.row})
                                </option>
                              )}
                              <optgroup label="Processes">
                                {targets
                                  .filter((x) => x.kind === 'process')
                                  .map((x) => (
                                    <option key={x.key} value={x.key}>
                                      {x.label} ({x.span} rows)
                                    </option>
                                  ))}
                              </optgroup>
                              <optgroup label="Other rows">
                                {targets
                                  .filter((x) => x.kind === 'other')
                                  .map((x) => (
                                    <option key={x.key} value={x.key}>
                                      {x.label} (row {x.row})
                                    </option>
                                  ))}
                              </optgroup>
                            </select>
                            {badge && <span className={`badge ${badge[1]}`}>{badge[0]}</span>}
                          </div>
                        </td>
                        <td>
                          {t ? (
                            <>
                              {count} row{count === 1 ? '' : 's'}
                              {s.headers.length > t.span && (
                                <div className="small warn-text" title={s.headers.join(', ')}>
                                  file has {s.headers.length} columns, block has {t.span}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sheets.length > visible.length && (
                <button type="button" className="btn btn--ghost" onClick={() => setShowAll(true)}>
                  Show all {sheets.length}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {perf && missing.length > 0 && (
        <section className="card card--warn">
          <div className="section-head">
            <div>
              <h2>
                <Icon name="alert" size={18} /> {missing.length} person(s) have no sheet yet
              </h2>
              <p className="muted">Their numbers are skipped unless you create their sheets in the same run.</p>
            </div>
            {missing.some((m) => m.name) && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onAddEmployees(missing.filter((m) => m.name).map((m) => ({ ...m, source: 'performance' })))}
              >
                <Icon name="plus" size={16} /> Create their sheets
              </button>
            )}
          </div>
          <ul className="plain-list plain-list--cols">
            {missing.slice(0, 60).map((m) => (
              <li key={m.id}>
                <code>{m.id}</code> {m.name || <em className="muted">no name in file</em>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
