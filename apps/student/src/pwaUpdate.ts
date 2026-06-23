type Listener = () => void;

let updateFn: (() => void) | null = null;
let updating = false;
const listeners: Set<Listener> = new Set();

export function setPwaUpdateReady(fn: () => void) {
  updateFn = fn;
  listeners.forEach((l) => l());
}

export function getPwaUpdateFn() {
  return updateFn;
}

/** True once the user opted into the update — lets unload guards (e.g. the exam) allow the reload. */
export function isPwaUpdating() {
  return updating;
}

/** Apply the pending update (reloads to the new version). No-op if none is ready. */
export function triggerPwaUpdate() {
  if (!updateFn) return;
  updating = true;
  updateFn();
}

export function subscribePwaUpdate(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
