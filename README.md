#  Architect-WASM-IDE
**A Browser-Native, Serverless Data Science Environment.**

Architect-WASM-IDE is a high-performance workspace designed for data analysts and scientists. It leverages **WebAssembly (WASM)** to run a complete Python runtime (3.11) directly in the user's browser, eliminating the need for expensive backend servers or data transfer to external APIs for processing.

 ## Technical Highlights
* **Zero-Cost Infrastructure**: Hosted entirely on GitHub Pages. No backend database or server costs, making it infinitely scalable for $0/month.
* **Pyodide Integration**: Runs **Pandas**, **NumPy**, and **Matplotlib/Plotly** locally via WASM. Data processing happens on the client's CPU.
* **BYOK Architecture**: Implements a "Bring Your Own Key" model for AI features. Users provide their own Anthropic API key (stored securely in `LocalStorage`) for custom analysis generation.
* **Data Privacy**: Files uploaded to the IDE never leave the browser; they are written to a virtual file system (`/data.csv`) local to the user's session.

##  Features
*  **Smart Ingestion**: Automatic schema detection, column statistics, and preview for CSV/JSON files.
*  **AI Analyst**: Natural language to Python generation using **Claude 3.5 Sonnet**.
*  **Template Library**: Pre-built professional analysis scripts for correlation matrices, outlier detection, and time-series forecasting.
*  **Integrated Terminal**: Real-time Python output and error logging.
*  **Interactive Visualizations**: Full support for interactive Plotly charts rendered in a dedicated split-pane viewer.

##  Built With
* **Frontend**: React, Tailwind CSS, Lucide Icons
* **Engine**: Pyodide (WebAssembly), Python 3.11
* **AI**: Anthropic Claude API (Agentic Workflows)
* **Deployment**: GitHub Actions & GitHub Pages

##  License
This project is licensed under the MIT License - see the LICENSE file for details.
