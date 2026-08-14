const DB_NAME = "BoardCaOfflineDocs";
const STORE_NAME = "documents";
const METADATA_STORE = "metadata";

// Ouvre ou crée la base de données IndexedDB
export async function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME); // Clé: storagePath
      }
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// Enregistre un document (Blob) pour le hors-ligne
export async function saveDocumentOffline(storagePath: string, blob: Blob): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, METADATA_STORE], "readwrite");
    const docStore = tx.objectStore(STORE_NAME);
    const metaStore = tx.objectStore(METADATA_STORE);

    docStore.put(blob, storagePath);
    // On met à jour la date de dernier téléchargement global pour l'UI
    metaStore.put(new Date().toISOString(), "last_download_date");
    metaStore.put(true, "has_downloaded_docs");

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Récupère un document hors-ligne via son storagePath
export async function getOfflineDocument(storagePath: string): Promise<Blob | undefined> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(storagePath);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Vérifie de manière rapide si un document est disponible hors-ligne
export async function isDocumentOffline(storagePath: string): Promise<boolean> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    // getKey est plus performant que get car il ne charge pas le Blob en mémoire
    const request = store.getKey(storagePath);

    request.onsuccess = () => resolve(request.result !== undefined);
    request.onerror = () => reject(request.error);
  });
}

// Vérifie si on a au moins un fichier en hors-ligne (pour la pastille UI)
export async function hasAnyOfflineDocument(): Promise<boolean> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(METADATA_STORE, "readonly");
    const store = tx.objectStore(METADATA_STORE);
    const request = store.get("has_downloaded_docs");

    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

// Efface tous les documents hors-ligne
export async function clearOfflineDocuments(): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, METADATA_STORE], "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.objectStore(METADATA_STORE).clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
