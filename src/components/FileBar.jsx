import Icon from './Icon.jsx';
import { formatBytes } from '../lib/excelWorker.js';

export default function FileBar({ stats, onReplace, busy }) {
  const { analysis } = stats;
  const processes = analysis.layout.groups.filter((g) => g.kind === 'process').length;
  return (
    <section className="card filebar">
      <div className="filebar__main">
        <div className="filebar__icon">
          <Icon name="file" size={22} />
        </div>
        <div className="filebar__name">
          <strong title={stats.fileName}>{stats.fileName}</strong>
          <span>
            {formatBytes(stats.size)}
            {stats.version > 1 && ` · edited ${stats.version - 1}×`}
          </span>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onReplace} disabled={busy}>
          Change file
        </button>
      </div>
      <div className="chips">
        <span className="chip">
          <b>{analysis.employees.length}</b> employees
        </span>
        <span className="chip">
          <b>{processes}</b> processes
        </span>
        <span className="chip">
          <b>{analysis.layout.lastRow}</b> rows
        </span>
        <span className="chip chip--ok">
          <Icon name="check" size={14} /> {analysis.templateName} template
        </span>
        {analysis.mismatched.length > 0 && (
          <span className="chip chip--warn" title={analysis.mismatched.join(', ')}>
            <Icon name="alert" size={14} /> {analysis.mismatched.length} sheet(s) differ from {analysis.templateName} — skipped
          </span>
        )}
        {analysis.noIdSheets.length > 0 && (
          <span className="chip chip--warn" title={analysis.noIdSheets.join(', ')}>
            <Icon name="alert" size={14} /> {analysis.noIdSheets.length} sheet(s) have no Emp ID in A1
          </span>
        )}
      </div>
    </section>
  );
}
