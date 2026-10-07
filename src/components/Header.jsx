import Icon from './Icon.jsx';

const NEXT = { system: 'light', light: 'dark', dark: 'system' };
const ICON = { system: 'monitor', light: 'sun', dark: 'moon' };

export default function Header({ theme, onTheme }) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src="./favicon.svg" alt="" width="30" height="30" />
        <div>
          <div className="brand__name">Stats Controller</div>
          <div className="brand__sub">Team Level Stats workbook tools</div>
        </div>
      </div>
      <div className="topbar__right">
        <span className="pill pill--private" title="Files are processed inside this browser tab and never uploaded.">
          <Icon name="lock" size={14} /> Private · runs in your browser
        </span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onTheme(NEXT[theme])}
          aria-label={`Theme: ${theme}. Switch to ${NEXT[theme]}`}
          title={`Theme: ${theme}`}
        >
          <Icon name={ICON[theme]} />
        </button>
      </div>
    </header>
  );
}
