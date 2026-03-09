(function(){"use strict";let t=null,s=null;self.window=self;async function n(){return t||(importScripts("https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"),t=await self.loadPyodide({indexURL:"https://cdn.jsdelivr.net/pyodide/v0.24.1/full/"}),self.postMessage({type:"LOG",msg:">>> Installing core packages (pandas, micropip, pyarrow)…"}),await t.loadPackage(["pandas","micropip"]),self.postMessage({type:"LOG",msg:">>> Installing plotly, openpyxl, pyarrow via micropip…"}),await t.runPythonAsync(`
import micropip
await micropip.install(['plotly', 'openpyxl', 'pyarrow'])

import sys
from io import StringIO
class OutputCapture:
    def __init__(self):
        self.outputs = []
    def write(self, text):
        if text.strip():
            self.outputs.append(text)
    def flush(self):
        pass
    def get_output(self):
        result = '\\n'.join(self.outputs)
        self.outputs = []
        return result

_capture = OutputCapture()
sys.stdout = _capture
sys.stderr = _capture
`),self.postMessage({type:"LOG",msg:">>> Pyodide ready. All execution is local (WASM)."}),t)}self.onmessage=async o=>{const{type:a,payload:l}=o.data;if(a==="INIT")try{await n(),self.postMessage({type:"READY"})}catch(e){self.postMessage({type:"ERROR",error:e.message})}else if(a==="SET_PORT")s=o.ports[0];else if(a==="SET_CANVAS")o.data.canvas;else if(a==="LOAD_EXCEL"){self.postMessage({type:"LOG",msg:">>> Converting Excel file via pandas to Arrow…"});try{t.FS.writeFile("/data.xlsx",new Uint8Array(l.buffer)),await t.runPythonAsync(`
import pandas as pd
import pyarrow as pa
import pyarrow.ipc as ipc

df = pd.read_excel('/data.xlsx')
table = pa.Table.from_pandas(df)
sink = pa.BufferOutputStream()
with ipc.RecordBatchStreamWriter(sink, table.schema) as writer:
    writer.write_table(table)
_arrow_buffer = sink.getvalue().to_pybytes()
`);const e=t.globals.get("_arrow_buffer"),r=new Uint8Array(e);t.globals.get("_arrow_buffer").destroy(),s&&s.postMessage({type:"ARROW_DATA",name:"data",buffer:r},[r.buffer]),self.postMessage({type:"EXCEL_LOADED"})}catch(e){self.postMessage({type:"ERROR",error:e.message})}}else if(a==="RUN_CODE"){self.postMessage({type:"LOG",msg:">>> Running analysis…"});try{l.csvData&&t.FS.writeFile("/data.csv",new TextEncoder().encode(l.csvData)),await t.runPythonAsync(`${l.code}

_output = _capture.get_output()`);const e=t.globals.get("_output")||"";let r;try{await t.runPythonAsync(`
try:
    import plotly.graph_objects as _go_cls
    _fig_candidates = [v for v in list(globals().values()) if isinstance(v, _go_cls.Figure)]
    if '_fig' in globals() and isinstance(globals()['_fig'], _go_cls.Figure):
        _plot_html = globals()['_fig'].to_html(include_plotlyjs='cdn', full_html=False)
    elif _fig_candidates:
        _plot_html = _fig_candidates[-1].to_html(include_plotlyjs='cdn', full_html=False)
    else:
        _plot_html = ''
except Exception:
    _plot_html = ''
`),r=t.globals.get("_plot_html")||void 0}catch{}try{await t.runPythonAsync(`
try:
    if 'data' in globals() and isinstance(globals()['data'], pd.DataFrame):
        table = pa.Table.from_pandas(globals()['data'])
        sink = pa.BufferOutputStream()
        with ipc.RecordBatchStreamWriter(sink, table.schema) as writer:
            writer.write_table(table)
        _out_arrow = sink.getvalue().to_pybytes()
    else:
        _out_arrow = None
except Exception:
    _out_arrow = None
`);const i=t.globals.get("_out_arrow");if(i&&s){const p=new Uint8Array(i);s.postMessage({type:"ARROW_DATA",name:"data",buffer:p},[p.buffer]),i.destroy()}}catch{}self.postMessage({type:"CODE_RESULT",output:e||"Analysis complete.",plotHtml:r})}catch(e){self.postMessage({type:"ERROR",error:e.message})}}}})();
