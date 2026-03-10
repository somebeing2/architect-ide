/// <reference lib="webworker" />
import { WebR, ChannelType } from 'webr';

let webr: WebR | null = null;
let duckDbPort: MessagePort | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    try {
      webr = new WebR({ channelType: ChannelType.PostMessage });
      await webr.init();

      self.postMessage({ type: 'LOG', msg: '>>> Installing core R packages (arrow, base64enc)…' });
      await webr.installPackages(['arrow', 'base64enc']);

      // Setup the capture helper
      await webr.evalRVoid(`
        .capture_output <- function(code) {
          out <- capture.output({
            eval(parse(text=code), envir = globalenv())
          })
          paste(out, collapse = "\\n")
        }
      `);

      self.postMessage({ type: 'LOG', msg: '>>> WebR ready. All execution is local (WASM).' });
      self.postMessage({ type: 'READY' });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }
  else if (type === 'SET_PORT') {
    duckDbPort = e.ports[0];
  else if (type === 'MOUNT_WORKSPACE') {
      if (!webr) return;
      self.postMessage({ type: 'LOG', msg: '>>> Mounting local directory to WebR /mnt...' });
      try {
        try { webr.FS.mkdir('/mnt'); } catch (e) { /* ignore if exists */ }
        try { webr.FS.unmount('/mnt'); } catch (e) { /* unmount old if needed */ }
        webr.FS.mount("WORKERFS", { files: payload.files }, '/mnt');
        self.postMessage({ type: 'LOG', msg: '>>> Workspace mounted.' });
      } catch (err: any) {
        self.postMessage({ type: 'ERROR', error: 'Failed to mount workspace in WebR: ' + err.message });
      }
    }
    else if (type === 'RUN_CODE') {
      if (!webr) return;
      self.postMessage({ type: 'LOG', msg: '>>> Running R analysis…' });
      try {
        if (payload.csvData) {
          webr.FS.writeFile('/data.csv', new TextEncoder().encode(payload.csvData));
        }

        const escapedCode = payload.code.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        const plotFile = '/plot.png';

        let capturedOutput = '';
        try {
          await webr.evalRVoid(`png("${plotFile}", width=800, height=600)`);

          const res = await webr.evalR(`.capture_output("${escapedCode}")`);
          capturedOutput = await res.toString();

          await webr.evalRVoid(`dev.off()`);
        } catch (execErr: any) {
          capturedOutput = `Error: ${execErr.message}`;
        }

        let plotHtml: string | undefined = undefined;
        const hasPlot = await webr.evalR(`file.exists("${plotFile}") && file.info("${plotFile}")$size > 0`);
        const plotExists = await hasPlot.toJs();
        if (plotExists) {
          const b64res = await webr.evalR(`base64enc::dataURI(file="${plotFile}", mime="image/png")`);
          const b64 = await b64res.toString();
          plotHtml = "<img src='" + b64 + "' style='width:100%;height:100%;object-fit:contain;' />";
          await webr.evalRVoid(`unlink("${plotFile}")`);
        }

        try {
          const dfNamesObj = await webr.evalR(`Filter(function(x) is.data.frame(get(x)), ls())`);
          const dfNames = await dfNamesObj.toJs() as string[];

          for (const name of dfNames) {
            try {
              const arrowObj = await webr.evalR(`arrow::write_to_raw(get("${name}"), format = "stream")`);
              const arrowType = await arrowObj.type();
              if (arrowType === 'raw' && duckDbPort) {
                const arrowBuffer = (await arrowObj.toJs() as unknown) as Uint8Array;
                duckDbPort.postMessage({
                  type: 'ARROW_DATA',
                  source: 'r',
                  tableName: name,
                  buffer: arrowBuffer
                }, [arrowBuffer.buffer]);
              }
            } catch (e) {
              console.error(`Failed to sync R dataframe ${name}:`, e);
            }
          }
        } catch { }

        self.postMessage({ type: 'CODE_RESULT', output: capturedOutput || 'Analysis complete.', plotHtml });
      } catch (err: any) {
        self.postMessage({ type: 'ERROR', error: err.message });
      }
    }
  };
