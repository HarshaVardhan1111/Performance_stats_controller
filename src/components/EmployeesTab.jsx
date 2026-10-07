import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import DropZone from './DropZone.jsx';
import { validateNewEmployee } from '../core/employees.js';
import { cleanText } from '../core/text.js';

const SOURCE = { manual: 'Typed', list: 'From list' };

export default function EmployeesTab({ existing, pending, onAdd, onRemove, onClear, onReadList }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [imported, setImported] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState(null);
  const [query, setQuery] = useState('');

  const add = (e) => {
    e.preventDefault();
    const problem = validateNewEmployee({ id, name }, { existing, pending });
    setError(problem);
    if (problem) return;
    onAdd([{ id: id.trim(), name: cleanText(name), source: 'manual' }]);
    setId('');
    setName('');
    document.getElementById('emp-id')?.focus();
  };

  const readList = async (file) => {
    setImportBusy(true);
    setImportError(null);
    try {
      const { employees } = await onReadList(file);
      if (!employees.length) throw new Error('No Emp ID / Name rows found in that file.');
      const have = new Set(existing.map((e) => e.id));
      const listed = new Set(employees.map((e) => e.id));
      const fresh = employees.filter((e) => !have.has(e.id));
      setImported({
        fileName: file.name,
        total: employees.length,
        fresh,
        selected: new Set(fresh.map((e) => e.id)),
        notInList: existing.filter((e) => !listed.has(e.id)),
      });
    } catch (err) {
      setImportError(err.message);
      setImported(null);
    } finally {
      setImportBusy(false);
    }
  };

  const toggle = (empId) =>
    setImported((imp) => {
      const selected = new Set(imp.selected);
      if (selected.has(empId)) selected.delete(empId);
      else selected.add(empId);
      return { ...imp, selected };
    });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? existing.filter((e) => e.id.includes(q) || e.sheetName.toLowerCase().includes(q)) : existing;
  }, [existing, query]);

  const pendingIds = new Set(pending.map((p) => p.id));

  return (
    <div className="stack">
      <div className="grid-2">
        <section className="card">
          <h2>Add an employee</h2>
          <p className="muted">A new sheet is copied from REF with the Emp ID in A1.</p>
          <form className="emp-form" onSubmit={add}>
            <label className="field">
              <span>Emp ID</span>
              <input
                id="emp-id"
                inputMode="numeric"
                value={id}
                onChange={(e) => {
                  setId(e.target.value.replace(/\D/g, ''));
                  setError(null);
                }}
                placeholder="e.g. 10500001"
                aria-invalid={Boolean(error)}
              />
            </label>
            <label className="field">
              <span>Name (sheet name)</span>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="First Last"
                aria-invalid={Boolean(error)}
              />
            </label>
            <button type="submit" className="btn btn--primary">
              <Icon name="plus" size={16} /> Add
            </button>
          </form>
          {error && (
            <p className="form-error" role="alert">
              <Icon name="alert" size={14} /> {error}
            </p>
          )}
        </section>

        <section className="card">
          <h2>
            Many people? <span className="muted">(optional)</span>
          </h2>
          <p className="muted">Drop an Excel list with Emp ID and Name. Only people without a sheet are picked.</p>
          <DropZone compact title="Drop employee list (.xlsx)" hint="or click to browse" onFile={readList} busy={importBusy} />
          {importError && (
            <p className="form-error" role="alert">
              <Icon name="alert" size={14} /> {importError}
            </p>
          )}
        </section>
      </div>

      {imported && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2>{imported.fresh.length} new in “{imported.fileName}”</h2>
              <p className="muted">
                {imported.total} people in the list · {imported.total - imported.fresh.length} already have a sheet
              </p>
            </div>
            <div className="btn-row">
              <button type="button" className="btn btn--ghost" onClick={() => setImported(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!imported.fresh.some((e) => imported.selected.has(e.id) && !pendingIds.has(e.id))}
                onClick={() => {
                  onAdd(imported.fresh.filter((e) => imported.selected.has(e.id) && !pendingIds.has(e.id)).map((e) => ({ ...e, source: 'list' })));
                  setImported(null);
                }}
              >
                <Icon name="plus" size={16} /> Add selected
              </button>
            </div>
          </div>
          {imported.fresh.length === 0 ? (
            <p className="empty-note">Everyone in the list already has a sheet.</p>
          ) : (
            <ul className="check-list">
              {imported.fresh.map((e) => (
                <li key={e.id}>
                  <label>
                    <input type="checkbox" checked={imported.selected.has(e.id)} onChange={() => toggle(e.id)} disabled={pendingIds.has(e.id)} />
                    <code>{e.id}</code> {e.name}
                    {pendingIds.has(e.id) && <span className="badge">already added</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {imported.notInList.length > 0 && (
            <details className="details">
              <summary>
                {imported.notInList.length} sheet(s) belong to people not in this list (left the team?) — kept as they are
              </summary>
              <ul className="plain-list">
                {imported.notInList.map((e) => (
                  <li key={e.id}>
                    <code>{e.id}</code> {e.sheetName}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <div>
            <h2>New sheets to create</h2>
            <p className="muted">{pending.length ? `${pending.length} pending` : 'Nothing added yet.'}</p>
          </div>
          {pending.length > 0 && (
            <button type="button" className="btn btn--ghost" onClick={onClear}>
              Clear all
            </button>
          )}
        </div>
        {pending.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Emp ID</th>
                  <th>Name</th>
                  <th>Source</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <code>{p.id}</code>
                    </td>
                    <td>{p.name}</td>
                    <td className="muted">{SOURCE[p.source] ?? p.source}</td>
                    <td className="right">
                      <button type="button" className="icon-btn icon-btn--sm icon-btn--danger" onClick={() => onRemove(p.id)} aria-label={`Remove ${p.name}`}>
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <details className="card details">
        <summary>
          <Icon name="users" size={16} /> {existing.length} existing employee sheets
        </summary>
        <label className="search search--block">
          <Icon name="search" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or ID…" aria-label="Search employees" />
        </label>
        <ul className="emp-grid">
          {filtered.map((e) => (
            <li key={e.id}>
              <span>{e.sheetName}</span>
              <code>{e.id}</code>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
