/** Where saves live. Every method is safe to call even when the browser blocks storage. */
export interface SaveStorage {
  get(key: string): string | null;
  /** False when the value could not be stored. */
  set(key: string, value: string): boolean;
  remove(key: string): void;
  readonly available: boolean;
}

export function memoryStorage(): SaveStorage {
  const map = new Map<string, string>();
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => (map.set(k, v), true),
    remove: (k) => void map.delete(k),
    available: true,
  };
}

/** localStorage behind try/catch. Private windows and blocked site data give available=false. */
export function browserStorage(): SaveStorage {
  const ls = (): Storage | undefined => {
    try {
      return (globalThis as { localStorage?: Storage }).localStorage ?? undefined;
    } catch {
      return undefined;
    }
  };
  const probe = () => {
    try {
      const s = ls();
      if (!s) return false;
      s.setItem('kkm.probe', '1');
      s.removeItem('kkm.probe');
      return true;
    } catch {
      return false;
    }
  };
  return {
    get: (k) => {
      try {
        return ls()?.getItem(k) ?? null;
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        const s = ls();
        if (!s) return false;
        s.setItem(k, v);
        return true;
      } catch {
        return false;
      }
    },
    remove: (k) => {
      try {
        ls()?.removeItem(k);
      } catch {
        /* nothing to do */
      }
    },
    available: probe(),
  };
}
