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

### Data Profiler

A full-featured, automatic data profiling engine triggered on any loaded CSV. Produces a six-tab interactive report entirely in-browser — no server, no upload.

#### Six-Tab Report

| Tab | What it shows |
|---|---|
| **Executive** | Readiness status (Ready / Needs Review / Not Ready), domain-aware business impact cards, plain-English narratives, key relationships without raw coefficients, prioritised action items with owner assignments |
| **Overview** | Row/column counts, overall quality score, missing-value heatmap, type breakdown, duplicate summary |
| **Columns** | Per-column deep-dive: distribution histogram, box plot, Q-Q plot, time-series (datetime), word frequency (text), top values, stats table, pattern validity, cardinality, outlier markers |
| **Correlations** | Pearson, Spearman, and Cramér's V heatmaps; scatter plot matrix; significance stars |
| **Diagnostics** | Anomaly rows, outlier detail, missing co-occurrence matrix, VIF scores, group statistics |
| **Samples** | First and last rows of the raw dataset |

#### Python-Side Intelligence (Pyodide)
- **Trend detection** — datetime columns are split into equal periods; linear regression slope determines `trendDirection` (`up` / `down` / `flat`) and `trendPctChange`
- **Concentration risk** — categorical columns report the dominant-value share as `concentrationRisk` with a `severe / high / medium / low` label
- **Distribution shape** — skewness + kurtosis mapped to human labels (`normal`, `skewed_right`, `leptokurtic`, etc.)
- **Pattern validation** — email, phone, URL, UUID, date formats detected and scored per column
- **Outlier detection** — IQR method with per-row indices and values for drill-down

#### Domain-Aware Executive Layer
Column names are tokenised (handles both `snake_case` and `camelCase`) and matched against domain vocabularies — `financial`, `customer`, `product`, `temporal`, `geographic`, `hr` — using exact word matching to avoid substring false-positives. Narratives and impact cards adapt their language accordingly (e.g. *"Financial totals for 'revenue' will be understated"* vs *"1,200 customer records are incomplete"*).

#### HTML Report Export
Downloads a standalone dark-theme HTML file containing:
- **Executive summary** at the top — readiness banner, business impact cards, numbered action list
- Dataset overview stats, key findings, missing-data table
- Per-column cards with sparkbar histograms and top-value bars
- Top correlation pairs table with significance stars

#### Chart Captions
Every chart (histogram, box plot, Q-Q plot, time series, word frequency, scatter, heatmap) renders a one-line plain-English caption beneath it derived from the column's computed statistics.

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
| Orchestration | Antigravity |
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

This project was built entirely using **Claude Sonnet** as the primary engineering resource — from blank repository to production-grade IDE — within a strict $100 API budget. Furthermore, the advanced Tri-Engine and Arrow IPC logic was finalized using **Antigravity's** agent-first environment.

### Financial Metrics

| Metric | Value |
|---|---|
| Total Budget | $100.00 |
| Total Spent | $99.16 |
| Remaining Balance | $0.84 |
| Tokens Processed | 32,000,000+ |
| Commits to Production | 27+ |
| Lines of Code Delivered | 11,500+ |

Every feature, bug fix, deployment configuration, and architectural decision was implemented within this single budget window — from first commit to live GitHub Pages deployment.

### Version 1.0 Project Retrospective

Architect-IDE has evolved into a fully-fledged, production-ready environment via a multi-phase engineering effort. The final architecture relies heavily on advanced browser APIs to ensure stability and extreme performance.

#### Phase 1: Distributed Architecture
Initially built as a single-thread Pyodide application, the environment was fundamentally re-architected into a **Tri-Engine WASM Architecture**. 
By shifting execution off the main UI thread, each language environment now operates within its own completely isolated Web Worker. This guarantees that intensive computations or blocked processes in Python (`pyodide.worker.ts`), R (`webr.worker.ts`), or SQL (`duckdb.worker.ts`) never freeze the graphical user interface.

| Engine | Role |
|---|---|
| **Pyodide (Python 3.11)** | Standard analysis, `pandas`, `plotly`, `micropip` AI code generation. Visualizations are processed off-thread via `OffscreenCanvas`. |
| **WebR (R Language)** | Statistical computing, base R plotting, package management. Fully isolated in its own Web Worker. |
| **DuckDB-WASM** | Heavy-duty SQL analytics engine. Capable of millions of rows of analytical aggregations in milliseconds. |

#### Phase 2: Universal Join (Semantic Bridge)
Instead of relying on the main React thread or inefficient string serializations (CSV/JSON) to pass data between these isolated engines, Architect-IDE utilizes a **Semantic Bridge** powered by `MessageChannel` and **Apache Arrow IPC**.
When a user executes a script and clicks "Export to SQL":
1. The respective Web Worker natively encodes its DataFrame environment into an Arrow RecordBatch binary buffer (`Uint8Array`).
2. This buffer is transmitted securely over a dedicated `MessagePort` directly to the DuckDB Worker, achieving zero-copy transfer.
3. DuckDB dynamically mounts the incoming binary payload via `db.registerFileBuffer(tableName)` as a virtual view (e.g., `python_data`, `r_data`).
4. Users can instantly run native cross-language joins: `SELECT * FROM python_data JOIN r_data ON id;`.

#### Phase 3: Stability Measures & Garbage Collection
To guarantee the resilience of the local environment for long-running sessions, multiple stability mechanisms were implemented:
- **Worker Garbage Collection**: The application enforces explicit `worker.terminate()` lifecycle hooks in `usePyodide`, `useWebR`, and `useDuckDB`. Navigating away from tools immediately kills background processes and frees localized WASM heap memory, preventing "Ghost Workers."
- **Progressive Web App (PWA) Offline Cache**: Architect-IDE utilizes `Workbox` Service Workers configured with a massive 100MB cache limit. The `pyodide.wasm`, `duckdb.wasm`, and `webr.wasm` binaries are pre-cached, ensuring near-instant load times and complete offline availability.
- **Memory Footprint Tracking**: The Active Tables UI intelligently extracts the `byteLength` directly from the underlying Arrow buffer representations, giving users complete transparency into the system's memory allocation and the absolute efficiency of the zero-copy pipeline.

---

## License

MIT — see [LICENSE](LICENSE) for details.
