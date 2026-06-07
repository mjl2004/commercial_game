import type { WorldEventType, WorldEventItem } from './WorldEventToast';

let toastId = 0;
let listeners: Array<(event: WorldEventItem) => void> = [];

export function pushWorldToast(message: string, type: WorldEventType = 'market_shock') {
  const event: WorldEventItem = { id: `wt-${++toastId}`, message, type, timestamp: Date.now() };
  listeners.forEach((fn) => fn(event));
}

export function subscribeToasts(fn: (event: WorldEventItem) => void) {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}
