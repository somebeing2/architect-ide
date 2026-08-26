Architect-WASM-IDE
A browser-native, serverless data science environment.

Live Demo → somebeing2.github.io/architect-ide

Architect-WASM-IDE runs a complete Python 3.11 runtime directly in the browser via WebAssembly (Pyodide) — no backend, no data upload, no server costs. Your data never leaves your device.

Features
Core IDE

Syntax-highlighted code editor (Prism.js) with line numbers
Integrated terminal with real-time stdout/stderr capture from Pyodide
Split-pane plot viewer — any Plotly Figure in scope is auto-detected and rendered
Persistent run history via localStorage, survives page refresh
One-click Titanic sample dataset (891 rows) for instant demos
Template Gallery — 10 ready-made analysis templates across 5 categories (Explore, Visualize, Clean, Export, Education), all with null handling and IQR outlier detection.

Visual Builder (no-code) — pick columns, chart type (Bar / Line / Scatter / Pie / Histogram / Box) and aggregation; the Plotly Python code is generated and executed automatically.

AI Code Generation (BYOK) — natural language → Python via the Anthropic API. Bring your own key; it is stored only in localStorage and never sent to any server.

UX — dark/light mode, guided tour, processing overlay with row count and elapsed time, System Health drawer (Pyodide status, WASM heap, package status), responsive layout.

Data Profiler
Loading any CSV triggers an automatic profiling engine that produces a six-tab interactive report, entirely in-browser:

Tab	Contents
Executive	Readiness verdict, domain-aware business impact cards, plain-English narratives, prioritised action items
Overview	Row/column counts, quality score, missing-value heatmap, duplicates
Columns	Per-column histograms, box plots, Q-Q plots, time series, top values, pattern validity, outliers
Correlations	Pearson, Spearman and Cramér's V heatmaps; scatter matrix; significance stars
Diagnostics	Anomaly rows, missing co-occurrence matrix, VIF scores, group statistics
Samples	First and last rows of the raw dataset
Under the hood: linear-regression trend detection on datetime columns, concentration-risk scoring for categoricals, skewness/kurtosis shape labels, format validation (email/phone/URL/UUID/date), and IQR outlier detection with per-row drill-down. Column names are matched against domain vocabularies (financial, customer, product, temporal, geographic, HR) so narratives adapt to the dataset's domain. The full report exports as a standalone HTML file.

Architecture
Tri-engine WASM design. Each language runtime runs in its own isolated Web Worker, so heavy computation never freezes the UI:

Engine	Role
Pyodide (Python 3.11)	pandas / Plotly analysis, AI code generation, micropip packages
WebR	Statistical computing and base R plotting
DuckDB-WASM	SQL analytics on millions of rows
Zero-copy data bridge. Dataframes move between engines as Apache Arrow IPC buffers over dedicated MessagePort channels — no CSV/JSON serialization. DuckDB mounts incoming buffers as virtual views, enabling cross-language joins:

SQL

SELECT * FROM python_data JOIN r_data ON id;
Stability. Explicit worker.terminate() lifecycle hooks prevent ghost workers and free WASM heap memory; Workbox service workers pre-cache the WASM binaries (100MB cache) for fast loads and full offline use; the Active Tables UI reports live memory footprint from the Arrow buffers.

Tech Stack
Layer	Technology
Frontend	React 18, TypeScript (strict, 0 tsc errors), Tailwind CSS, Vite
Engines	Pyodide, WebR, DuckDB-WASM
Data interchange	Apache Arrow IPC
Analysis / viz	pandas, Plotly
AI	Anthropic Claude API (BYOK)
Deployment	GitHub Actions → GitHub Pages
Local Setup
Requires Node.js v18+.

Bash

git clone https://github.com/somebeing2/architect-ide.git
cd architect-ide
npm install
npm run dev
The app runs at http://localhost:8080.

How This Was Built: The $100 Challenge
I built this project solo as an exercise in AI-orchestrated engineering — acting as architect, reviewer and product owner, with Claude Sonnet as the implementation engine, under a strict $100 API budget ($99.16 spent). My role covered the system architecture (tri-engine worker design, Arrow IPC bridge, worker lifecycle strategy), feature specification and scoping, and reviewing, testing and debugging every change before it shipped — 27+ commits and 11,500+ lines of code from blank repository to live deployment, all within the single budget window.

License
MIT — see LICENSE.
