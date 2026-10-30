// Tiny IndexedDB cache so the user only has to import the baseline bank once.
const DB = 'hd2-patcher';
const STORE = 'kv';

function open(): Promise<IDBDatabase> {
  return new Promise(function (resolve, reject) {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = function () {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

export async function putBank(name: string, bytes: Uint8Array): Promise<void> {
  const db = await open();
  await new Promise<void>(function (resolve, reject) {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ name: name, bytes: bytes, at: Date.now() }, 'baseline');
    tx.oncomplete = function () { resolve(); };
    tx.onerror = function () { reject(tx.error); };
  });
  db.close();
}

export async function getBank(): Promise<{ name: string; bytes: Uint8Array; at: number } | null> {
  try {
    const db = await open();
    const value = await new Promise<any>(function (resolve, reject) {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get('baseline');
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    db.close();
    if (!value || !value.bytes) return null;
    return { name: value.name, bytes: new Uint8Array(value.bytes), at: value.at };
  } catch (e) {
    return null;
  }
}

export async function clearBank(): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>(function (resolve) {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete('baseline');
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { resolve(); };
    });
    db.close();
  } catch (e) {
    /* ignore */
  }
}