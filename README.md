# Stats Controller

A browser tool for the **Team Level Stats** Excel workbook. With it you can:

- **Insert process rows anywhere**: at any position, with any number of rows. The rows are added to `REF` and every employee sheet, and formulas are corrected.
- **Add employees**: type an Emp ID and name, or drop an employee list. Each new sheet is a copy of `REF`.
- **Monthly fill**: copy each person's numbers from the monthly performance file into the right rows and month column.

**Privacy:** everything runs inside your browser. Files are never uploaded, and the code contains no employee data and no process names. Everything is read from the file you drop in.

Live site (after deploy): `https://<your-github-user>.github.io/Performance_stats_controller/`

---

## How to use

1. Open the site and drop the **Team Level Stats** `.xlsx` file.
2. Pick a tab:
   - **Processes**: open a process and hover between two rows (on a phone, tap the faint line), then click **Insert here**. Enter the title and as many rows as you need (type them, paste a list, or press **Standard rows**). Pick a colour. Tip: end a process with an `Error Cost $` row so the app shows it as its own block.
   - **Employees**: type an Emp ID and name, then press **Add**. To add many people at once, drop an Excel list with `Emp ID` and `Name` columns. Only people who don't have a sheet yet are picked. Existing sheets are never deleted.
   - **Monthly fill**: drop the performance file, choose the month, and check which sheet goes to which process. Matches are suggested from the names, and your choices are remembered in your browser.
3. Click **Apply & download**. You get `<file name> (updated).xlsx`. You can keep making changes, and the next run starts from the updated file.

### What the app expects in the workbook

| Item | Rule |
| --- | --- |
| Template | A sheet named `REF` |
| Employee sheets | Emp ID (digits) in cell `A1` |
| Row labels | Column A, starting at row 2 |
| Months | Dates in row 1 (if none, column B = Jan … M = Dec) |
| Process blocks | Each block ends with a row starting `Error Cost` |
| Performance file | One sheet per process, `Emp ID` (and optionally `Name`) in row 1, numbers in the next columns in row order |

### Safety checks

- Every insert is applied to `REF` and **all** employee sheets the same way. A sheet whose column A doesn't match `REF` is **skipped and reported**, never changed blindly.
- Formulas that point below an inserted row (in any sheet) are rewritten, so they keep pointing at the same cells.
- An Emp ID that already has a sheet is skipped. Sheet names are cleaned to fit Excel's rules (max 31 characters, no `[]:*?/\`).
- Excel recalculates all formulas when the file is opened.

---

## Architecture

```
src/
  core/                  Pure Excel logic (no React). Unit-tested.
    text.js              Cleaning text, IDs, sheet names
    layout.js            Reads REF: rows, process blocks, month columns, employee sheets
    formulas.js          Shifts formula references after rows are inserted
    insertRows.js        Inserts rows at any position in REF + every employee sheet
    sheetCopy.js         Copies REF into a new sheet (values, styles, sizes, merges)
    employees.js         Creates employee sheets, validates IDs, reads employee lists
    monthlyFill.js       Monthly fill: performance file -> stats rows (by label)
    matcher.js           Suggests sheet -> process matches by name similarity
    pipeline.js          analyzeStats() and applyChanges(): the one entry point
  worker/excel.worker.js Runs the pipeline in a Web Worker (the page never freezes)
  lib/excelWorker.js     Promise wrapper for the worker, download helper
  components/            React UI (Processes, Employees, Monthly fill, Apply bar)
  styles/app.css         Design tokens, light/dark theme, responsive layout
```

**Data flow:** File → Web Worker (ExcelJS) → `analyzeStats` → the UI shows the structure. Your changes are kept as a list in the UI. **Apply** sends them to the worker, which runs `applyChanges` in a fixed order (insert rows → create employee sheets → monthly fill), saves the file, and sends it back for download.

**Stack:** React 19, Vite, ExcelJS, Vitest. There is no backend.

---

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run dev       # local dev server
npm test          # unit tests (fake data only)
npm run build     # production build in dist/
npm run preview   # serve the build locally
```

Never commit real workbooks. `.gitignore` blocks `*.xlsx`, and the tests use made-up names and IDs.

## Deploy to GitHub Pages

1. Push to the `main` branch.
2. In the repo, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. You only do this once.
3. The workflow `.github/workflows/deploy.yml` runs the tests, builds, and publishes on every push to `main`.
