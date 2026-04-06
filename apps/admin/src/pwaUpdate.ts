type Listener = () => void;

let updateFn: (() => void) | null = null;
const listeners: Set<Listener> = new Set();

export function setPwaUpdateReady(fn: () => void) {
  updateFn = fn;
  listeners.forEach((l) => l());
}

export function getPwaUpdateFn() {
  return updateFn;
}

export function subscribePwaUpdate(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
