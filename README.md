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

## Getting Started (local dev)

```bash
npm install
npm run dev        # http://localhost:8080
npm run build      # production build → dist/
```

---

## License

MIT — see [LICENSE](LICENSE) for details.
