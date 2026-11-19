import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __configureRunner, ensureReady, runPython, type WorkerLike } from "@/lib/coding/runner";

type Msg = { id: number; init?: boolean; source?: string };

class FakeWorker implements WorkerLike {
  static all: FakeWorker[] = [];
  listeners = new Set<(e: MessageEvent) => void>();
  posted: Msg[] = [];
  terminated = false;
  autoReady = true;
  constructor() {
    FakeWorker.all.push(this);
  }
  postMessage(m: unknown) {
    const msg = m as Msg;
    this.posted.push(msg);
    if (msg.init && this.autoReady) this.reply({ id: msg.id, ready: true });
  }
  terminate() {
    this.terminated = true;
  }
  addEventListener(t: string, fn: (e: MessageEvent) => void) {
    if (t === "message") this.listeners.add(fn);
  }
  removeEventListener(t: string, fn: (e: MessageEvent) => void) {
    if (t === "message") this.listeners.delete(fn);
  }
  reply(data: unknown) {
    for (const fn of [...this.listeners]) fn({ data } as MessageEvent);
  }
  runs() {
    return this.posted.filter((m) => m.source !== undefined);
  }
}

const tick = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  FakeWorker.all = [];
  __configureRunner(() => new FakeWorker());
});
afterEach(() => {
  __configureRunner(null);
  vi.useRealTimers();
});

describe("runPython", () => {
  it("serializes runs and matches replies by id", async () => {
    const a = runPython("A");
    const b = runPython("B");
    await tick();
    const w = FakeWorker.all[0];
    expect(w.runs().map((m) => m.source)).toEqual(["A"]);
    w.reply({ id: 9999, stdout: "stray" });
    w.reply({ id: w.runs()[0].id, stdout: "out-A" });
    await expect(a).resolves.toEqual({ stdout: "out-A" });
    await tick();
    expect(w.runs().map((m) => m.source)).toEqual(["A", "B"]);
    w.reply({ id: w.runs()[1].id, stdout: "out-B" });
    await expect(b).resolves.toEqual({ stdout: "out-B" });
  });

  it("times out after 5s, replaces the worker, and the queued run still executes", async () => {
    const a = runPython("loop");
    const b = runPython("next");
    await tick();
    await vi.advanceTimersByTimeAsync(5000);
    await expect(a).resolves.toEqual({ error: "timeout" });
    expect(FakeWorker.all[0].terminated).toBe(true);
    await tick();
    expect(FakeWorker.all).toHaveLength(2);
    const w2 = FakeWorker.all[1];
    expect(w2.runs().map((m) => m.source)).toEqual(["next"]);
    w2.reply({ id: w2.runs()[0].id, stdout: "ok" });
    await expect(b).resolves.toEqual({ stdout: "ok" });
  });
});

describe("loading", () => {
  it("rejects load_failed after 30s, terminates, and a retry makes a fresh worker", async () => {
    __configureRunner(() => {
      const w = new FakeWorker();
      w.autoReady = FakeWorker.all.length > 1;
      return w;
    });
    const caught = ensureReady().catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(30000);
    await expect(caught).resolves.toBe("load_failed");
    expect(FakeWorker.all[0].terminated).toBe(true);
    await expect(ensureReady()).resolves.toBeUndefined();
    expect(FakeWorker.all).toHaveLength(2);
  });

  it("runPython reports load_failed when loading hangs", async () => {
    __configureRunner(() => {
      const w = new FakeWorker();
      w.autoReady = false;
      return w;
    });
    const r = runPython("x");
    await vi.advanceTimersByTimeAsync(30000);
    await expect(r).resolves.toEqual({ error: "load_failed" });
  });
});
