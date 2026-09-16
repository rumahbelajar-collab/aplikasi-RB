import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import type { Database } from "./db";
import {
  ensureDatabaseDefaults,
  recalculateAllLedgers,
} from "./db";

import {
  getFirestoreDb,
  ensureAnonymousAuth,
} from "./firebaseConfig";

/* =========================================================
   MODUL SINKRONISASI FIREBASE (Firestore - Multi Document)

   Mengatasi batas 1 MB Firestore dengan memecah database
   menjadi beberapa dokumen terpisah di dalam koleksi "rumahBelajar".
   Setiap key utama pada objek Database disimpan sebagai dokumen
   tersendiri (misal: dokumen "students", "tutors", "payments", dll).
========================================================= */

const LOCAL_STORAGE_KEY = "rumah_belajar_db_v2";
const COLLECTION_NAME = "rumahBelajar";

// Daftar tabel/koleksi yang ada di dalam Database
const DATABASE_KEYS: Array<keyof Database> = [
  "programs",
  "students",
  "tutors",
  "sessions",
  "payments",
  "slips",
  "otherIncomes",
  "expenses",
  "attendanceReports",
  "schedules",
  "raports",
  "studentLedger",
  "tutorLedger",
  "kas",
];

export interface SyncState {
  status: "idle" | "syncing" | "success" | "error";
  lastSynced: string | null;
  errorMessage: string | null;
}

let syncState: SyncState = {
  status: "idle",
  lastSynced: null,
  errorMessage: null,
};

const syncListeners = new Set<(state: SyncState) => void>();

function setSyncState(next: Partial<SyncState>) {
  syncState = { ...syncState, ...next };

  syncListeners.forEach((listener) => {
    try {
      listener({ ...syncState });
    } catch {
      // Jangan biarkan listener menghentikan proses sinkronisasi.
    }
  });
}

export function subscribeToSyncState(
  listener: (state: SyncState) => void
): () => void {
  syncListeners.add(listener);
  listener({ ...syncState });

  return () => {
    syncListeners.delete(listener);
  };
}

/* =========================================================
   DATABASE KOSONG?
========================================================= */

export function isEmptyDatabase(database: any): boolean {
  if (!database) return true;

  return DATABASE_KEYS.every((key) => {
    const value = database[key];

    if (Array.isArray(value)) return value.length === 0;

    return value === null || value === undefined;
  });
}

/* =========================================================
   CACHE LOKAL (offline fallback)
========================================================= */

function saveLocalCache(database: Database): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(database));
  } catch (error) {
    console.warn("[Firebase] Gagal menyimpan cache lokal:", error);
  }
}

function readLocalCache(): Database | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;

    return ensureDatabaseDefaults(JSON.parse(raw));
  } catch (error) {
    console.warn("[Firebase] Cache lokal rusak:", error);
    return null;
  }
}

/* =========================================================
   BERSIHKAN NILAI `undefined` SEBELUM DIKIRIM KE FIRESTORE
========================================================= */
function stripUndefinedDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/* =========================================================
   BACA DATABASE DARI CLOUD (Multi-Document Fetch)
========================================================= */

export async function readCloudDatabase(): Promise<{
  db: Database | null;
  updatedAt: string | null;
}> {
  try {
    await ensureAnonymousAuth();

    const dbRef = collection(getFirestoreDb(), COLLECTION_NAME);
    const snapshot = await getDocs(dbRef);

    if (snapshot.empty) {
      return { db: null, updatedAt: null };
    }

    const partialData: Record<string, any> = {};

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Setiap dokumen menyimpan property 'payload' atau langsung isinya
      if (data && "payload" in data) {
        partialData[docSnap.id] = data.payload;
      }
    });

    if (Object.keys(partialData).length === 0) {
      return { db: null, updatedAt: null };
    }

    const database = recalculateAllLedgers(
      ensureDatabaseDefaults(partialData)
    );

    saveLocalCache(database);

    return { db: database, updatedAt: database.lastUpdated || null };
  } catch (error) {
    console.warn("[Firebase] Gagal membaca database:", error);
    return { db: null, updatedAt: null };
  }
}

/* =========================================================
   PULL (dipakai saat pertama buka app / tombol refresh)
========================================================= */

export async function pullFromGoogleSheets(): Promise<Database | null> {
  setSyncState({ status: "syncing" });

  const cloud = await readCloudDatabase();

  if (cloud.db) {
    setSyncState({
      status: "success",
      lastSynced: cloud.updatedAt || new Date().toISOString(),
      errorMessage: null,
    });

    return cloud.db;
  }

  const cached = readLocalCache();

  if (cached) {
    setSyncState({
      status: "error",
      errorMessage: "Server tidak dapat diakses. Menampilkan cache sementara.",
    });

    return recalculateAllLedgers(cached);
  }

  setSyncState({
    status: "error",
    errorMessage: "Database Firebase tidak dapat diakses.",
  });

  return null;
}

/* =========================================================
   PUSH (kirim perubahan terpecah ke Firestore)
========================================================= */

let pushTimer: ReturnType<typeof window.setTimeout> | null = null;

let pendingPushResolvers: Array<
  (result: { success: boolean; db?: Database }) => void
> = [];

async function performPush(
  localDb: Database
): Promise<{ success: boolean; db?: Database }> {
  setSyncState({ status: "syncing" });

  try {
    await ensureAnonymousAuth();

    const normalized = recalculateAllLedgers(
      ensureDatabaseDefaults(localDb)
    );

    const dbInstance = getFirestoreDb();

    // Simpan tiap key/tabel ke dokumen terpisah agar ukuran < 1 MB per dokumen
    for (const key of DATABASE_KEYS) {
      const docRef = doc(dbInstance, COLLECTION_NAME, key);
      const sectionData = normalized[key];
      const payload = stripUndefinedDeep({ payload: sectionData });
      
      await setDoc(docRef, payload);
    }

    // Simpan juga metadata umum seperti lastUpdated jika ada
    const metaRef = doc(dbInstance, COLLECTION_NAME, "metadata");
    await setDoc(metaRef, {
      payload: { lastUpdated: normalized.lastUpdated || new Date().toISOString() }
    });

    saveLocalCache(normalized);

    setSyncState({
      status: "success",
      lastSynced: normalized.lastUpdated || new Date().toISOString(),
      errorMessage: null,
    });

    return { success: true, db: normalized };
  } catch (error: any) {
    console.error("[Firebase] Push gagal:", error);

    setSyncState({
      status: "error",
      errorMessage: error?.message || "Gagal menyimpan ke Firebase.",
    });

    return { success: false };
  }
}

export function pushToGoogleSheets(
  localDb: Database,
  force = false
): Promise<{ success: boolean; db?: Database }> {
  const normalizedDb = recalculateAllLedgers(
    ensureDatabaseDefaults(localDb)
  );

  return new Promise((resolve) => {
    pendingPushResolvers.push(resolve);

    if (pushTimer) {
      window.clearTimeout(pushTimer);
      pushTimer = null;
    }

    const execute = async () => {
      pushTimer = null;

      const result = await performPush(normalizedDb);

      const resolvers = pendingPushResolvers;
      pendingPushResolvers = [];

      resolvers.forEach((resolver) => {
        try {
          resolver(result);
        } catch {
          // ignore
        }
      });
    };

    if (force) {
      void execute();
    } else {
      pushTimer = window.setTimeout(() => {
        void execute();
      }, 500) as unknown as ReturnType<typeof window.setTimeout>;
    }
  });
}

/* =========================================================
   REALTIME: DENGARKAN PERUBAHAN DARI FIRESTORE (Multi-Document)
========================================================= */

export function subscribeToDatabaseChanges(
  callback: (db: Database) => void
): () => void {
  let stopped = false;
  const unsubscribers: Unsubscribe[] = [];

  ensureAnonymousAuth()
    .then(() => {
      if (stopped) return;

      const dbInstance = getFirestoreDb();
      const dbRef = collection(dbInstance, COLLECTION_NAME);

      // Gunakan onSnapshot pada koleksi untuk memantau perubahan dokumen apa pun di dalamnya
      const unsub = onSnapshot(
        dbRef,
        async (snapshot) => {
          if (snapshot.empty) return;

          const partialData: Record<string, any> = {};

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && "payload" in data) {
              partialData[docSnap.id] = data.payload;
            }
          });

          if (Object.keys(partialData).length === 0) return;

          const finalDb = recalculateAllLedgers(
            ensureDatabaseDefaults(partialData)
          );

          saveLocalCache(finalDb);

          setSyncState({
            status: "success",
            lastSynced: finalDb.lastUpdated || new Date().toISOString(),
            errorMessage: null,
          });

          callback(finalDb);
        },
        (error) => {
          console.warn("[Firebase] Listener realtime gagal:", error);

          setSyncState({
            status: "error",
            errorMessage: "Koneksi realtime ke Firebase terputus.",
          });
        }
      );

      unsubscribers.push(unsub);
    })
    .catch((error) => {
      console.warn("[Firebase] Gagal masuk (auth anonim):", error);

      setSyncState({
        status: "error",
        errorMessage: "Gagal terhubung ke Firebase.",
      });
    });

  return () => {
    stopped = true;
    unsubscribers.forEach((unsub) => unsub());
  };
}

/* =========================================================
   FORCE REFRESH
========================================================= */

export async function forceRefreshFromGoogleSheets(): Promise<Database | null> {
  return pullFromGoogleSheets();
}

/* =========================================================
   HAPUS CACHE LOKAL
========================================================= */

export function clearGoogleSheetsCache(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}