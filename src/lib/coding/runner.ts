export type RunOutcome = { stdout: string } | { error: string };

const EXEC_TIMEOUT_MS = 5000;

let worker: Worker | null = null;
let ready: Promise<void> | null = null;

function create(): Promise<void> {
  const w = new Worker("/pyodide-worker.js");
  worker = w;
  ready = new Promise<void>((resolve, reject) => {
    const done = () => {
      w.removeEventListener("message", onMsg);
      w.removeEventListener("error", onErr);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.data?.ready) {
        done();
        resolve();
      } else if (e.data?.error) {
        done();
        reject(new Error(String(e.data.error)));
      }
    };
    const onErr = () => {
      done();
      reject(new Error("load_failed"));
    };
    w.addEventListener("message", onMsg);
    w.addEventListener("error", onErr);
    w.postMessage({ init: true });
  });
  ready.catch(() => {
    if (worker === w) reset();
  });
  return ready;
}

function reset() {
  worker?.terminate();
  worker = null;
  ready = null;
}

/** Loads Pyodide (once). Loading time is not part of the execution limit. */
export function ensureReady(): Promise<void> {
  return ready ?? create();
}

/** Runs a Python source with a 5s execution limit; on timeout the worker is replaced. */
export async function runPython(source: string): Promise<RunOutcome> {
  try {
    await ensureReady();
  } catch {
    return { error: "load_failed" };
  }
  const w = worker;
  if (!w) return { error: "load_failed" };
  return new Promise<RunOutcome>((resolve) => {
    const finish = (r: RunOutcome) => {
      clearTimeout(timer);
      w.removeEventListener("message", onMsg);
      w.removeEventListener("error", onErr);
      resolve(r);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.data?.stdout !== undefined) finish({ stdout: String(e.data.stdout) });
      else if (e.data?.error) finish({ error: String(e.data.error) });
    };
    const onErr = () => finish({ error: "worker_error" });
    const timer = setTimeout(() => {
      if (worker === w) reset();
      else w.terminate();
      finish({ error: "timeout" });
    }, EXEC_TIMEOUT_MS);
    w.addEventListener("message", onMsg);
    w.addEventListener("error", onErr);
    w.postMessage({ source });
  });
}
