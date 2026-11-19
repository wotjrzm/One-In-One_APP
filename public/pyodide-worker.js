/* Classic worker: loads Pyodide from the CDN once and runs Python sources on request. */
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

var pyodideReady = loadPyodide();

self.onmessage = async function (event) {
  var data = event.data || {};
  try {
    var pyodide = await pyodideReady;
    if (data.init) {
      self.postMessage({ ready: true });
      return;
    }
    var lines = [];
    pyodide.setStdout({
      batched: function (s) {
        lines.push(s);
      },
    });
    pyodide.setStderr({ batched: function () {} });
    var globals = pyodide.globals.get("dict")();
    try {
      await pyodide.runPythonAsync(String(data.source), { globals: globals });
    } finally {
      globals.destroy();
    }
    self.postMessage({ stdout: lines.join("\n") });
  } catch (e) {
    self.postMessage({ error: String((e && e.message) || e) });
  }
};
