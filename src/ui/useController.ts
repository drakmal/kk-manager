import { useEffect, useState } from 'preact/hooks';

/** Re-renders the component whenever the controller (day or campaign) changes. */
export function useController<T extends { subscribe(listener: () => void): () => void }>(controller: T): T {
  const [, setVersion] = useState(0);
  useEffect(() => controller.subscribe(() => setVersion((n) => n + 1)), [controller]);
  return controller;
}
