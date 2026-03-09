# Architect-WASM-IDE

**A Browser-Native, Serverless Data Science Environment.**

> **Live Demo → [somebeing2.github.io/architect-ide](https://somebeing2.github.io/architect-ide/)**

Architect-WASM-IDE is a professional workspace for data analysts and scientists. It runs a complete **Python 3.11 runtime** directly in the browser via **WebAssembly (Pyodide)** — no backend, no data upload, no server costs.

---

## Features

### Core IDE
- **Syntax-highlighted code editor** — Prism.js Python highlighting with line numbers
- **Integrated terminal** — real-time stdout/stderr capture from Pyodide
- **Split-pane plot viewer** — interactive Plotly charts in a dedicated panel
- **Auto-render** — any `plotly.graph_objects.Figure` in scope is detected and displayed automatically, regardless of variable name
- **Persistent history** — analysis runs saved to `localStorage`, survive page refresh, with relative timestamps

### Template Gallery (10 templates, 5 categories)
| Category | Templates |
|---|---|
| Explore | Basic Statistics, Business Pivot, Schema Auditor |
| Visualize | Correlation Matrix, Trend Plot, Spearman Heatmap, Interactive Filters |
| Clean | Data Janitor |
| Export | Smart Exporter (JSON + Markdown) |
| Education | Student Lab |

All templates include null handling, `dropna()` cleaning, and IQR outlier detection.

### Visual Builder (No-Code Mode)
- Select columns, chart type (Bar / Line / Scatter / Pie / Histogram / Box), and aggregation
- Generates and runs Plotly Python code automatically — no typing required

### AI Code Generation (BYOK)
- Natural language → Python via **Claude Sonnet** (Anthropic API)
- Bring Your Own Key — stored only in `localStorage`, never transmitted to any server

### UX & Accessibility
- **Dark / Light mode** toggle, preference persisted across sessions
- **Glowing notification dot** on the Visualizer tab when a chart is ready
- **5-step guided tour** in the empty visualization panel ("How do I see my chart?")
- **Processing overlay** — shows row count and elapsed seconds during heavy WASM computation
- **System Health drawer** — Pyodide status, WASM heap memory, package status, last run time
- **Security & Privacy badge** — explains the full local-execution model
- Responsive layout with mobile breakpoints

### Sample Data
One-click **Titanic dataset** loader (891 rows) for instant demos — no file required.

---

## Technical Highlights

- **Zero infrastructure cost** — hosted on GitHub Pages, zero backend
- **Pyodide v0.24.1** — pandas, plotly, micropip pre-loaded at startup
- **Data privacy** — CSV data is written to Pyodide's in-browser virtual FS (`/data.csv`) and never leaves the device
- **Global state** — React Context with localStorage persistence for history and theme
- **Framer Motion** animations throughout — gallery, drawers, history sidebar, overlays
- **TypeScript strict** — 0 `tsc --noEmit` errors, 0 ESLint warnings

---

## Built With

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Animation | Framer Motion |
| Python Engine | Pyodide (WebAssembly), Python 3.11 |
| Data / Viz | Pandas, Plotly |
| Syntax Highlight | Prism.js |
| AI | Anthropic Claude API (BYOK) |
| Icons | Lucide React |
| Deployment | GitHub Actions → GitHub Pages |

---

## 🛠️ Local Setup Instructions

To run **Architect-WASM** on your own machine, follow these steps:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/somebeing2/architect-ide.git
   cd architect-ide
   ```

2. **Install Dependencies**
   > Requires **Node.js v18 or higher**
   ```bash
   npm install
   ```

3. **Start the Development Server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:8080`.

---

## The $100 Engineering Challenge

This project was built entirely using **Claude Sonnet** as the sole engineering resource — from blank repository to production-grade IDE — within a strict $100 API budget.

### Financial Metrics

| Metric | Value |
|---|---|
| Total Budget | $100.00 |
| Total Spent | $99.16 |
| Remaining Balance | $0.84 |
| Tokens Processed | 32,000,000+ |
| Commits to Production | 25+ |
| Lines of Code Delivered | 7850+|

Every feature, bug fix, deployment configuration, and architectural decision was implemented within this single budget window — from first commit to live GitHub Pages deployment.

### Architectural Milestone: Tri-Engine WASM

The final architecture runs **three distinct WebAssembly engines simultaneously in the browser**, connected via dedicated `MessageChannel` Web Workers:

| Engine | Role |
|---|---|
| **Pyodide (Python 3.11)** | Standard analysis, `pandas`, `plotly`, `micropip` AI code generation. Visualizations are processed off-thread via `OffscreenCanvas`. |
| **WebR (R Language)** | Statistical computing, base R plotting, package management. Fully isolated in its own Web Worker. |
| **DuckDB-WASM** | Heavy-duty SQL analytics engine. Capable of millions of rows of analytical aggregations in milliseconds. |

**Zero-Copy Semantic Bridge (Arrow IPC)**
Instead of relying on the main React thread or string serialization (CSV/JSON) to pass data between these languages, Architect-WASM features a **Universal Join**. 
When a user clicks "Export to SQL" in either Python or R:
1. The respective Web Worker natively encodes its DataFrame environment variable into an **Apache Arrow RecordBatch buffer** (`Uint8Array`).
2. This binary buffer is transmitted directly over a `MessagePort` to the DuckDB Worker, entirely bypassing the main UI thread.
3. DuckDB dynamically mounts the buffer via `db.registerFileBuffer(tableName)` and creates a zero-copy virtual view.
4. Users can instantly run cross-language joins natively in the browser: `SELECT * FROM python_data JOIN r_data ON id;`.

**Progressive Web App (PWA) Offline-First Strategy**
Architect-WASM is a fully installable PWA. Due to the massive size of the underlying WASM engines, our Service Worker (via `Workbox`) is specifically configured with a 100MB cache limit to aggressively pre-cache and store the `pyodide.wasm`, `duckdb.wasm`, and `webr.wasm` binaries on the user's local disk. Once the application loads once, subsequent launches are near-instant and operate flawlessly without an internet connection.

### Elite Sprint: Premium Features

Added during the final engineering sprint:

- **IndexedDB Persistence** — CSV data and scripts auto-saved and restored on page refresh via `idb-keyval`; no session loss on reload
- **Virtual Scrolling** — `react-window` powers the data preview table; renders 10,000+ row datasets at 60fps with no DOM bloat
- **Interactive HTML Report Export** — one-click download of a fully self-contained HTML file containing the Plotly chart, data summary, Python code, and timestamp
- **Triple-Theme Engine** — Default Dark, High Contrast, and Cyberpunk (neon accents) themes with live switching via a Palette dropdown; preference persisted across sessions

---

## License

MIT — see [LICENSE](LICENSE) for details.
