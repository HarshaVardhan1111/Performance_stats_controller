import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import DropZone from './components/DropZone.jsx';
import FileBar from './components/FileBar.jsx';
import Icon from './components/Icon.jsx';
import ProcessesTab from './components/ProcessesTab.jsx';
import EmployeesTab from './components/EmployeesTab.jsx';
import { ApplyBar, LogPanel, ResultCard } from './components/RunPanel.jsx';
import { downloadBuffer, readFile, runTask, storage, updatedFileName } from './lib/excelWorker.js';

let uidSeq = 0;

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function App() {
  const [theme, setTheme] = useState(() => storage.get('theme', 'system'));
  const [stats, setStats] = useState(null); // { fileName, size, version, analysis }
  const [statsBusy, setStatsBusy] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('processes');

  const [inserts, setInserts] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [result, setResult] = useState(null);
  const fileBytes = useRef(null); // the current workbook; the worker keeps no copy
  const replaceInput = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    storage.set('theme', theme);
  }, [theme]);

  const addLog = useCallback((message, level = 'info') => setLog((l) => [...l, { message, level, time: now() }]), []);

  const pendingCount = inserts.length + employees.length;

  useEffect(() => {
    const warn = (e) => {
      if (pendingCount && !running) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pendingCount, running]);

  const loadStats = async (file) => {
    if (pendingCount && !window.confirm('Loading a new file discards your pending changes. Continue?')) return;
    setStatsBusy(true);
    setError(null);
    try {
      const buffer = await readFile(file);
      const copy = buffer.slice(0);
      const analysis = await runTask('analyze', { buffer: copy }, { transfer: [copy] });
      if (!analysis.ok) throw new Error(analysis.error);
      fileBytes.current = buffer;
      setStats({ fileName: file.name, size: buffer.byteLength, version: 1, analysis });
      setInserts([]);
      setEmployees([]);
      setResult(null);
      addLog(`Loaded “${file.name}”: ${analysis.employees.length} employees, ${analysis.layout.groups.length} groups`, 'success');
    } catch (err) {
      setError(err.message);
      addLog(err.message, 'error');
    } finally {
      setStatsBusy(false);
    }
  };

  const readEmployeeList = async (file) => {
    const buffer = await readFile(file);
    return runTask('parseEmployeeList', { buffer }, { transfer: [buffer] });
  };

  const addEmployees = (list) =>
    setEmployees((cur) => {
      const ids = new Set(cur.map((e) => e.id));
      return [...cur, ...list.filter((e) => !ids.has(e.id))];
    });

  const apply = async () => {
    setRunning(true);
    setResult(null);
    addLog('Applying changes…');
    const changes = {
      inserts: inserts.map(({ at, labels, color }) => ({ at, labels, color })),
      employees: employees.map(({ id, name }) => ({ id, name })),
    };
    const copy = fileBytes.current.slice(0);
    try {
      const out = await runTask('apply', { buffer: copy, changes }, { onProgress: addLog, transfer: [copy] });
      const fileName = updatedFileName(stats.fileName);
      fileBytes.current = out.buffer;
      downloadBuffer(out.buffer, fileName);
      setStats((s) => ({ ...s, size: out.buffer.byteLength, version: s.version + 1, analysis: out.analysis }));
      setInserts([]);
      setEmployees([]);
      setResult({ summary: out.summary, fileName });
      addLog(`Saved “${fileName}”`, 'success');
    } catch (err) {
      addLog(`Failed: ${err.message}`, 'error');
      setError(`Could not apply changes: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    if (!window.confirm('Discard all pending changes?')) return;
    setInserts([]);
    setEmployees([]);
  };

  const counts = { inserts: inserts.length, employees: employees.length };
  const lastMessage = log[log.length - 1]?.message;
  const targetCount = stats?.analysis.targetCount ?? 0;

  const tabs = useMemo(
    () => [
      { id: 'processes', label: 'Processes', icon: 'layers', count: inserts.length },
      { id: 'employees', label: 'Employees', icon: 'users', count: employees.length },
    ],
    [inserts.length, employees.length],
  );

  return (
    <div className="app">
      <Header theme={theme} onTheme={setTheme} />

      <main className="main">
        {error && (
          <div className="alert" role="alert">
            <Icon name="alert" /> <span>{error}</span>
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => setError(null)} aria-label="Dismiss">
              <Icon name="x" size={15} />
            </button>
          </div>
        )}

        {!stats ? (
          <section className="hero">
            <h1>Update your Team Level Stats file</h1>
            <p className="hero__lead">Insert process rows anywhere and add new employee sheets — all inside your browser.</p>
            <DropZone title="Drop the Team Level Stats file here" hint="or click to choose an .xlsx file" onFile={loadStats} busy={statsBusy} />
            <ul className="features">
              <li>
                <Icon name="layers" /> <b>Insert anywhere</b> <span>Any position, any number of rows. Formulas stay correct.</span>
              </li>
              <li>
                <Icon name="users" /> <b>New employees</b> <span>Type an ID and name, or drop a list. Sheets are copied from REF.</span>
              </li>
              <li>
                <Icon name="lock" /> <b>Private</b> <span>Your files never leave this computer. Nothing is uploaded.</span>
              </li>
            </ul>
          </section>
        ) : (
          <>
            <input
              ref={replaceInput}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                if (e.target.files[0]) loadStats(e.target.files[0]);
                e.target.value = '';
              }}
            />
            <FileBar stats={stats} busy={running || statsBusy} onReplace={() => replaceInput.current?.click()} />

            {result && (
              <ResultCard
                result={result}
                onDismiss={() => setResult(null)}
                onDownload={() => fileBytes.current && downloadBuffer(fileBytes.current, result.fileName)}
              />
            )}

            <nav className="tabs" role="tablist" aria-label="Tools">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`tab ${tab === t.id ? 'is-active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <Icon name={t.icon} size={16} /> {t.label}
                  {t.count > 0 && <span className="tab__count">{t.count}</span>}
                </button>
              ))}
            </nav>

            <div role="tabpanel">
              {tab === 'processes' && (
                <ProcessesTab
                  layout={stats.analysis.layout}
                  inserts={inserts}
                  targetCount={targetCount}
                  onSave={(ins) =>
                    setInserts((cur) => (ins.uid ? cur.map((x) => (x.uid === ins.uid ? ins : x)) : [...cur, { ...ins, uid: ++uidSeq }]))
                  }
                  onRemove={(uid) => setInserts((cur) => cur.filter((x) => x.uid !== uid))}
                />
              )}
              {tab === 'employees' && (
                <EmployeesTab
                  existing={stats.analysis.employees}
                  pending={employees}
                  onAdd={addEmployees}
                  onRemove={(id) => setEmployees((cur) => cur.filter((e) => e.id !== id))}
                  onClear={() => setEmployees([])}
                  onReadList={readEmployeeList}
                />
              )}
            </div>

            <LogPanel log={log} />
          </>
        )}
      </main>

      {stats && <ApplyBar counts={counts} running={running || statsBusy} lastMessage={lastMessage} onApply={apply} onReset={reset} />}

      <footer className="footer">
        <Icon name="lock" size={14} /> Files are processed locally in your browser and are never uploaded.
      </footer>
    </div>
  );
}
