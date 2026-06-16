import { vi } from "vitest";

const store = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => {
    store.clear();
  },
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  get length() {
    return store.size;
  },
};

let opCounter = 0;

vi.stubGlobal("localStorage", localStorageMock);
vi.stubGlobal("sessionStorage", localStorageMock);
vi.stubGlobal("window", {
  localStorage: localStorageMock,
  sessionStorage: localStorageMock,
  dispatchEvent: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});
vi.stubGlobal("navigator", { onLine: true });
vi.stubGlobal("crypto", {
  randomUUID: () => {
    opCounter += 1;
    return `test-op-uuid-${String(opCounter).padStart(4, "0")}`;
  },
});
