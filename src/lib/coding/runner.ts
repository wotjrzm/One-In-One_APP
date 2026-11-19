export type RunOutcome = { stdout: string } | { error: string };

export type WorkerLike = {
  postMessage(message: unknown): void;
  terminate(): void;
  addEventListener(type: "message" | "error", fn: (e: MessageEvent) => void): void;
  removeEventListener(type: "message" | "error", fn: (e: MessageEvent) => void): void;
};

export const EXEC_TIMEOUT_MS = 5000;
export const LOAD_TIMEOUT_MS = 30000;

const defaultFactory = (): WorkerLike => new Worker("/pyodide-worker.js") as unknown as WorkerLike;
let factory: () => WorkerLike = defaultFactory;
let worker: WorkerLike | null = null;
let ready: Promise<void> | null = null;
let queue: Promise<unknown> = Promise.resolve();
let nextId = 1;

/** Test hook: inject a worker factory (null restores the real one) and clear all state. */
export function __configureRunner(f: (() => WorkerLike) | null) {
  worker?.terminate();
  worker = null;
  ready = null;
  queue = Promise.resolve();
  factory = f ?? defaultFactory;
}

function reset(w: WorkerLike) {
  w.terminate();
  if (worker === w) {
    worker = null;
    ready = null;
  }
}

function create(): Promise<void> {
  const w = factory();
  worker = w;
  const id = nextId++;
  const p = new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      w.removeEventListener("message", onMsg);
      w.removeEventListener("error", fail);
    };
    const fail = () => {
      cleanup();
      reset(w);
      reject(new Error("load_failed"));
    };
    const onMsg = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      if (e.data.ready) {
        cleanup();
        resolve();
      } else if (e.data.error) fail();
    };
    const timer = setTimeout(fail, LOAD_TIMEOUT_MS);
    w.addEventListener("message", onMsg);
    w.addEventListener("error", fail);
    w.postMessage({ init: true, id });
  });
  ready = p;
  return p;
}

/** Loads Pyodide (once). Rejects with load_failed after 30s; a retry creates a fresh worker. */
export function ensureReady(): Promise<void> {
  return ready ?? create();
}

async function runOne(source: string): Promise<RunOutcome> {
  try {
    await ensureReady();
  } catch {
    return { error: "load_failed" };
  }
  const w = worker;
  if (!w) return { error: "load_failed" };
  const id = nextId++;
  return new Promise<RunOutcome>((resolve) => {
    const finish = (r: RunOutcome) => {
      clearTimeout(timer);
      w.removeEventListener("message", onMsg);
      w.removeEventListener("error", onErr);
      resolve(r);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.data?.id !== id) return;
      if (e.data.stdout !== undefined) finish({ stdout: String(e.data.stdout) });
      else if (e.data.error) finish({ error: String(e.data.error) });
    };
    const onErr = () => {
      reset(w);
      finish({ error: "worker_error" });
    };
    const timer = setTimeout(() => {
      reset(w);
      finish({ error: "timeout" });
    }, EXEC_TIMEOUT_MS);
    w.addEventListener("message", onMsg);
    w.addEventListener("error", onErr);
    w.postMessage({ id, source });
  });
}

/** Runs a Python source with a 5s execution limit. Runs are serialized; the limit starts when a run starts. */
export function runPython(source: string): Promise<RunOutcome> {
  const result = queue.then(() => runOne(source));
  queue = result.catch(() => undefined);
  return result;
}
