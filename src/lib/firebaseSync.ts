import {
  doc,
  getDoc,
  setDoc,
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
   MODUL SINKRONISASI FIREBASE (Firestore)

   Ini pengganti src/lib/googleSheets.ts. Nama-nama fungsi
   SENGAJA dibuat sama seperti sebelumnya (pullFromGoogleSheets,
   pushToGoogleSheets, dst) supaya App.tsx cukup ganti satu
   baris import saja, tanpa perlu menulis ulang logic di
   App.tsx.

   Seluruh database (satu objek besar `Database` dari db.ts)
   disimpan sebagai SATU dokumen Firestore di:
     koleksi "rumahBelajar" -> dokumen "database"

   Ini pas untuk skala aplikasi ini (data satu lembaga
   bimbingan belajar). Kalau suatu saat datanya sudah sangat
   besar (>1MB, batas ukuran 1 dokumen Firestore), baru perlu
   dipecah per koleksi (siswa, tutor, dst) -- tapi untuk
   sekarang belum perlu.
========================================================= */

const LOCAL_STORAGE_KEY = "rumah_belajar_db_v2";
const COLLECTION_NAME = "rumahBelajar";
const DOCUMENT_ID = "database";

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

  const collections = [
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

  return collections.every((key) => {
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

function getDatabaseDocRef() {
  return doc(getFirestoreDb(), COLLECTION_NAME, DOCUMENT_ID);
}

/* =========================================================
   BACA DATABASE DARI CLOUD (sekali ambil)
========================================================= */

export async function readCloudDatabase(): Promise<{
  db: Database | null;
  updatedAt: string | null;
}> {
  try {
    await ensureAnonymousAuth();

    const snapshot = await getDoc(getDatabaseDocRef());

    if (!snapshot.exists()) {
      return { db: null, updatedAt: null };
    }

    const rawData = snapshot.data();

    if (!rawData || typeof rawData !== "object") {
      return { db: null, updatedAt: null };
    }

    const database = recalculateAllLedgers(
      ensureDatabaseDefaults(rawData)
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
   PUSH (kirim perubahan ke Firestore)
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

    await setDoc(getDatabaseDocRef(), normalized);

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
   REALTIME: DENGARKAN PERUBAHAN LANGSUNG DARI FIRESTORE

   Ini pengganti polling 15 detik ala Google Spreadsheet.
   Firestore mendukung listener realtime bawaan (onSnapshot),
   jadi perubahan dari perangkat lain langsung masuk dalam
   hitungan detik, tanpa perlu polling berkala -- lebih hemat
   kuota & lebih cepat.
========================================================= */

export function subscribeToDatabaseChanges(
  callback: (db: Database) => void
): () => void {
  let unsubscribeSnapshot: Unsubscribe | null = null;
  let stopped = false;

  ensureAnonymousAuth()
    .then(() => {
      if (stopped) return;

      unsubscribeSnapshot = onSnapshot(
        getDatabaseDocRef(),
        (snapshot) => {
          if (!snapshot.exists()) return;

          const rawData = snapshot.data();
          if (!rawData || typeof rawData !== "object") return;

          const finalDb = recalculateAllLedgers(
            ensureDatabaseDefaults(rawData)
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

    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
    }
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
