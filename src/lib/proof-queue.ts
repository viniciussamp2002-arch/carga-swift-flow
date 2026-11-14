// Local photo queue in IndexedDB, isolated per account (user id in the key).
export interface QueuedProof { id: string; userId: string; blob: Blob; capturedAt: string; tries: number; lastError?: string }
const DB = "transmerida-canhotos", STORE = "fila";
function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" }).createIndex("user", "userId");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const transaction = db.transaction(STORE, mode);
    const q = fn(transaction.objectStore(STORE));
    transaction.oncomplete = () => { db.close(); res(q.result); };
    transaction.onabort = () => { db.close(); rej(transaction.error); };
    transaction.onerror = () => { db.close(); rej(transaction.error); };
  });
}
export const queueAdd = (p: QueuedProof) => tx("readwrite", (s) => s.put(p));
export const queueRemove = (id: string) => tx("readwrite", (s) => s.delete(id));
export const queueList = (userId: string) => tx<QueuedProof[]>("readonly", (s) => s.index("user").getAll(userId));
