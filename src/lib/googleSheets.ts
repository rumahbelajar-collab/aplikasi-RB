import type { Database } from "./db";
import {
  ensureDatabaseDefaults,
  recalculateAllLedgers,
} from "./db";

const metaEnv = (import.meta as any)?.env || {};

export const GOOGLE_SCRIPT_URL = String(
  metaEnv.VITE_GOOGLE_SCRIPT_URL ||
    "https://script.google.com/macros/s/AKfycby96pNwFfC1m0jf38ojSvk-iiaKFW295mmMYYZb5VI__UjPKOPGncK0jd1ooxWg2g1i/exec"
);

const LOCAL_STORAGE_KEY = "rumah_belajar_db_v2";

/* =========================================================
   KOLEKSI YANG DISINKRONKAN BARIS-PER-BARIS

   Daftar ini HARUS sama dengan ALL_COLLECTION_KEYS di gas/Code.gs.
   studentLedger, tutorLedger & kas SENGAJA tidak dimasukkan karena
   itu data hasil hitungan otomatis (recalculateAllLedgers), bukan
   data yang perlu dikirim ke server.
========================================================= */

const SYNCABLE_COLLECTIONS = [
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
] as const;

type SyncableKey = (typeof SYNCABLE_COLLECTIONS)[number];

type Rec = { id?: string; [key: string]: any };

// Di atas jumlah ini, kirim SEKALI sebagai database penuh (action=save)
// dianggap lebih murah & lebih aman daripada banyak request kecil
// satu-satu (mis. saat impor data / pulihkan cadangan).
const MAX_LIGHT_BATCH_ITEMS = 25;

let isSyncingActive = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

// Salinan database TERAKHIR yang sudah dikonfirmasi tersimpan di
// server (baik lewat pull maupun push). Semua perubahan berikutnya
// di-diff terhadap salinan ini, supaya hanya baris yang BENAR-BENAR
// berubah yang dikirim ulang ke Google Spreadsheet -- bukan seluruh
// database setiap kali.
let lastSyncedSnapshot: Database | null = null;

let pendingPushResolvers: Array<
  (result: {
    success: boolean;
    db?: Database;
  }) => void
> = [];

export interface SyncState {
  status:
    | "idle"
    | "syncing"
    | "success"
    | "error";
  lastSynced: string | null;
  errorMessage: string | null;
}

let syncState: SyncState = {
  status: "idle",
  lastSynced: null,
  errorMessage: null,
};

const syncListeners = new Set<
  (state: SyncState) => void
>();

function setSyncState(
  next: Partial<SyncState>
) {
  syncState = {
    ...syncState,
    ...next,
  };

  syncListeners.forEach(
    (listener) => {
      try {
        listener({
          ...syncState,
        });
      } catch {
        // Jangan biarkan listener
        // menghentikan proses sinkronisasi.
      }
    }
  );
}

export function subscribeToSyncState(
  listener: (state: SyncState) => void
): () => void {
  syncListeners.add(listener);

  listener({
    ...syncState,
  });

  return () => {
    syncListeners.delete(listener);
  };
}

/* =========================================================
   DATABASE CHECK
========================================================= */

export function isEmptyDatabase(
  database: any
): boolean {
  if (!database) {
    return true;
  }

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

  return collections.every(
    (key) => {
      const value =
        database[key];

      if (Array.isArray(value)) {
        return value.length === 0;
      }

      return (
        value === null ||
        value === undefined
      );
    }
  );
}

/* =========================================================
   LOCAL CACHE
========================================================= */

function saveLocalCache(
  database: Database
): void {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(database)
    );
  } catch (error) {
    console.warn(
      "[GoogleSheets] Gagal menyimpan cache lokal:",
      error
    );
  }
}

function readLocalCache():
  Database | null {
  try {
    const raw =
      localStorage.getItem(
        LOCAL_STORAGE_KEY
      );

    if (!raw) {
      return null;
    }

    return ensureDatabaseDefaults(
      JSON.parse(raw)
    );
  } catch (error) {
    console.warn(
      "[GoogleSheets] Cache lokal rusak:",
      error
    );

    return null;
  }
}

/* =========================================================
   SNAPSHOT (baseline untuk diff)
========================================================= */

function cloneForSnapshot(
  database: Database
): Database {
  try {
    // Data database hanya berisi string/number/boolean/array/object
    // biasa (aman di-JSON), jadi round-trip ini adalah cara paling
    // sederhana & aman untuk deep clone tanpa dependency tambahan.
    return JSON.parse(
      JSON.stringify(database)
    );
  } catch {
    return database;
  }
}

/* =========================================================
   FETCH DENGAN TIMEOUT
========================================================= */

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller =
    new AbortController();

  const timer =
    window.setTimeout(
      () => {
        controller.abort();
      },
      timeoutMs
    );

  try {
    return await fetch(
      input,
      {
        ...init,
        signal:
          controller.signal,
      }
    );
  } finally {
    window.clearTimeout(
      timer
    );
  }
}

/* =========================================================
   META RINGAN (cek ada perubahan atau tidak)

   Hanya minta cap waktu terakhir update (satu baris kecil di sheet
   Settings), BUKAN seluruh database. Dipakai untuk polling berkala
   supaya tidak menyedot kuota & kuota data seluler pengguna saat
   tidak ada perubahan sama sekali.
========================================================= */

async function fetchServerMeta(): Promise<string | null> {
  try {
    const response =
      await fetchWithTimeout(
        `${GOOGLE_SCRIPT_URL}?action=meta&_=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        },
        6000
      );

    if (!response.ok) {
      return null;
    }

    const json = await response.json();

    if (!json || json.success !== true) {
      return null;
    }

    return json.lastUpdated || null;
  } catch (error) {
    console.warn(
      "[GoogleSheets] Cek meta gagal:",
      error
    );

    return null;
  }
}

/* =========================================================
   READ CLOUD (ambil seluruh database)
========================================================= */

export async function readCloudDatabase(): Promise<{
  db: Database | null;
  updatedAt: string | null;
}> {
  try {
    const response =
      await fetchWithTimeout(
        `${GOOGLE_SCRIPT_URL}?action=get&_=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        },
        10000
      );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}`
      );
    }

    const json =
      await response.json();

    if (!json) {
      return {
        db: null,
        updatedAt: null,
      };
    }

    if (
      json.success !== true &&
      json.status !== "success"
    ) {
      throw new Error(
        json.error ||
          "Google Apps Script mengembalikan status gagal."
      );
    }

    const rawData =
      json.data;

    if (
      !rawData ||
      typeof rawData !== "object"
    ) {
      return {
        db: null,
        updatedAt: null,
      };
    }

    const database =
      recalculateAllLedgers(
        ensureDatabaseDefaults(
          rawData
        )
      );

    saveLocalCache(
      database
    );

    // Database penuh dari server = sumber kebenaran terbaru.
    // Jadikan ini baseline baru untuk diff push berikutnya.
    lastSyncedSnapshot =
      cloneForSnapshot(database);

    return {
      db: database,
      updatedAt:
        json.lastUpdated ||
        json.updatedAt ||
        json.updated_at ||
        rawData.lastUpdated ||
        null,
    };
  } catch (error) {
    console.warn(
      "[GoogleSheets] Gagal membaca database cloud:",
      error
    );

    return {
      db: null,
      updatedAt: null,
    };
  }
}

/* =========================================================
   DIFF DATABASE

   Membandingkan database lokal terhadap baseline yang terakhir
   tersinkron, dan hanya mengembalikan baris yang benar-benar
   berubah (baru, diedit, atau dihapus) per koleksi. Inilah inti
   dari sinkronisasi yang ringan: daripada mengirim ULANG seluruh
   database (semua siswa, semua sesi, semua foto jurnal, dst) setiap
   kali ada 1 perubahan kecil, kita hanya kirim yang berubah saja.
========================================================= */

interface DiffResult {
  changes: Partial<Record<SyncableKey, Rec[]>>;
  deletions: Partial<Record<SyncableKey, string[]>>;
  settings: {
    broadcastMessage?: string;
    adminPassword?: string;
  } | null;
  changedCount: number;
}

function toIdMap(
  arr: Rec[] | undefined
): Map<string, Rec> {
  const map = new Map<string, Rec>();

  (arr || []).forEach((item) => {
    if (item && item.id) {
      map.set(String(item.id), item);
    }
  });

  return map;
}

function diffDatabase(
  prev: Database,
  next: Database
): DiffResult {
  const changes: DiffResult["changes"] = {};
  const deletions: DiffResult["deletions"] = {};
  let changedCount = 0;

  SYNCABLE_COLLECTIONS.forEach((key) => {
    const prevMap = toIdMap(
      (prev as any)[key]
    );
    const nextMap = toIdMap(
      (next as any)[key]
    );

    const upserts: Rec[] = [];

    nextMap.forEach((item, id) => {
      const before = prevMap.get(id);

      // Item baru, atau isinya berubah dibanding baseline terakhir.
      if (
        !before ||
        JSON.stringify(before) !==
          JSON.stringify(item)
      ) {
        upserts.push(item);
      }
    });

    if (upserts.length > 0) {
      changes[key] = upserts;
      changedCount += upserts.length;
    }

    const removedIds: string[] = [];

    prevMap.forEach((_item, id) => {
      if (!nextMap.has(id)) {
        removedIds.push(id);
      }
    });

    if (removedIds.length > 0) {
      deletions[key] = removedIds;
      changedCount += removedIds.length;
    }
  });

  let settings: DiffResult["settings"] = null;

  if (
    (next.broadcastMessage || "") !==
      (prev.broadcastMessage || "") ||
    (next.adminPassword || "") !==
      (prev.adminPassword || "")
  ) {
    settings = {
      broadcastMessage:
        next.broadcastMessage,
      adminPassword:
        next.adminPassword,
    };
    changedCount += 1;
  }

  return {
    changes,
    deletions,
    settings,
    changedCount,
  };
}

// Menerapkan balik item hasil respons server (misalnya foto jurnal
// yang otomatis sudah dikonversi jadi link Google Drive) ke database
// lokal, supaya state di layar langsung akurat tanpa menunggu polling
// berikutnya.
function applyServerItems(
  db: Database,
  items: Partial<Record<SyncableKey, Rec[]>>
): Database {
  const next: any = { ...db };

  Object.keys(items).forEach((key) => {
    const returned = (items as any)[key] as
      | Rec[]
      | undefined;

    if (!Array.isArray(returned) || returned.length === 0) {
      return;
    }

    const map = toIdMap(next[key]);

    returned.forEach((item) => {
      if (item && item.id) {
        map.set(String(item.id), item);
      }
    });

    next[key] = Array.from(map.values());
  });

  return next as Database;
}

/* =========================================================
   PUSH RINGAN (hanya kirim baris yang berubah)
========================================================= */

async function performLightPush(
  localDb: Database,
  diff: DiffResult
): Promise<{
  success: boolean;
  db?: Database;
}> {
  if (isSyncingActive) {
    return { success: false };
  }

  isSyncingActive = true;

  setSyncState({
    status: "syncing",
    errorMessage: null,
  });

  try {
    const payload: Record<string, unknown> = {
      action: "upsertBatch",
    };

    if (Object.keys(diff.changes).length > 0) {
      payload.changes = diff.changes;
    }

    if (Object.keys(diff.deletions).length > 0) {
      payload.deletions = diff.deletions;
    }

    if (diff.settings) {
      payload.settings = diff.settings;
    }

    const response = await fetchWithTimeout(
      GOOGLE_SCRIPT_URL,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
      15000
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}`
      );
    }

    const result = await response.json();

    if (!result || result.success !== true) {
      throw new Error(
        result?.error ||
          "Server menolak penyimpanan perubahan."
      );
    }

    let mergedDb = localDb;

    if (result.items) {
      mergedDb = applyServerItems(
        localDb,
        result.items
      );
    }

    const syncedAt =
      result.lastUpdated ||
      new Date().toISOString();

    const finalDb = recalculateAllLedgers(
      ensureDatabaseDefaults({
        ...mergedDb,
        lastUpdated: syncedAt,
      })
    );

    saveLocalCache(finalDb);
    lastSyncedSnapshot =
      cloneForSnapshot(finalDb);

    setSyncState({
      status: "success",
      lastSynced: syncedAt,
      errorMessage: null,
    });

    return {
      success: true,
      db: finalDb,
    };
  } catch (error: any) {
    console.error(
      "[GoogleSheets] Push ringan gagal:",
      error
    );

    setSyncState({
      status: "error",
      errorMessage:
        error?.message ||
        "Gagal menyimpan perubahan ke Google Spreadsheet.",
    });

    return { success: false };
  } finally {
    isSyncingActive = false;
  }
}

/* =========================================================
   PUSH PENUH (kirim seluruh database)

   Dipakai sebagai fallback yang aman: sinkronisasi pertama kali
   sejak aplikasi dibuka (belum ada baseline untuk di-diff), atau
   saat jumlah perubahan sekaligus terlalu besar (mis. impor data).
========================================================= */

async function performFullPush(
  localDb: Database
): Promise<{
  success: boolean;
  db?: Database;
}> {
  if (isSyncingActive) {
    return {
      success: false,
    };
  }

  isSyncingActive = true;

  setSyncState({
    status: "syncing",
    errorMessage: null,
  });

  try {
    const nowIso =
      new Date().toISOString();

    const databaseToSend =
      recalculateAllLedgers(
        ensureDatabaseDefaults({
          ...localDb,
          lastUpdated:
            nowIso,
        })
      );

    const payload =
      JSON.stringify({
        action: "save",
        data: databaseToSend,
      });

    const response =
      await fetchWithTimeout(
        GOOGLE_SCRIPT_URL,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "text/plain;charset=utf-8",
          },
          body: payload,
          cache: "no-store",
        },
        15000
      );

    if (!response.ok) {
      throw new Error(
        `HTTP error ${response.status}`
      );
    }

    const result =
      await response.json();

    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result?.error ||
          "Server menolak penyimpanan database."
      );
    }

    const serverDb =
      result.data
        ? recalculateAllLedgers(
            ensureDatabaseDefaults(
              result.data
            )
          )
        : databaseToSend;

    saveLocalCache(
      serverDb
    );

    lastSyncedSnapshot =
      cloneForSnapshot(serverDb);

    const syncedAt =
      result.lastUpdated ||
      result.updatedAt ||
      nowIso;

    setSyncState({
      status: "success",
      lastSynced: syncedAt,
      errorMessage: null,
    });

    return {
      success: true,
      db: serverDb,
    };
  } catch (error: any) {
    console.error(
      "[GoogleSheets] Push gagal:",
      error
    );

    setSyncState({
      status: "error",
      errorMessage:
        error?.message ||
        "Gagal menyimpan ke Google Spreadsheet.",
    });

    return {
      success: false,
    };
  } finally {
    isSyncingActive =
      false;
  }
}

/* =========================================================
   PUSH INTERNAL (pilih strategi: ringan vs penuh)
========================================================= */

async function performPush(
  localDb: Database
): Promise<{
  success: boolean;
  db?: Database;
}> {
  // Belum pernah punya baseline tersinkron sejak app dibuka (baru
  // buka app, atau baseline hilang karena error) -> kirim penuh dulu
  // supaya ada titik acuan yang valid untuk diff berikutnya.
  if (!lastSyncedSnapshot) {
    return performFullPush(localDb);
  }

  const diff = diffDatabase(
    lastSyncedSnapshot,
    localDb
  );

  if (diff.changedCount === 0) {
    // Tidak ada satu pun baris yang benar-benar berubah dibanding
    // yang terakhir tersimpan di server -> tidak perlu kirim apa pun.
    setSyncState({
      status: "success",
      errorMessage: null,
    });

    return {
      success: true,
      db: localDb,
    };
  }

  if (diff.changedCount > MAX_LIGHT_BATCH_ITEMS) {
    // Perubahan sekaligus terlalu banyak (mis. impor/pulihkan data) ->
    // lebih murah & lebih aman kirim penuh sekali jalan daripada
    // banyak request kecil satu-satu.
    return performFullPush(localDb);
  }

  return performLightPush(
    localDb,
    diff
  );
}

/* =========================================================
   PUSH GOOGLE SPREADSHEET
========================================================= */

export function pushToGoogleSheets(
  localDb: Database,
  force = false
): Promise<{
  success: boolean;
  db?: Database;
}> {
  const normalizedDb =
    recalculateAllLedgers(
      ensureDatabaseDefaults(
        localDb
      )
    );

  return new Promise(
    (resolve) => {
      pendingPushResolvers.push(
        resolve
      );

      if (pushTimer) {
        window.clearTimeout(
          pushTimer
        );

        pushTimer = null;
      }

      const execute =
        async () => {
          pushTimer = null;

          const result =
            await performPush(
              normalizedDb
            );

          const resolvers =
            pendingPushResolvers;

          pendingPushResolvers =
            [];

          resolvers.forEach(
            (resolver) => {
              try {
                resolver(
                  result
                );
              } catch {
                // ignore
              }
            }
          );
        };

      if (force) {
        void execute();
      } else {
        pushTimer =
          window.setTimeout(
            () => {
              void execute();
            },
            500
          );
      }
    }
  );
}

/* =========================================================
   PULL GOOGLE SPREADSHEET
========================================================= */

export async function pullFromGoogleSheets():
  Promise<Database | null> {
  const cloud =
    await readCloudDatabase();

  if (cloud.db) {
    const finalDb =
      recalculateAllLedgers(
        ensureDatabaseDefaults(
          cloud.db
        )
      );

    saveLocalCache(
      finalDb
    );

    setSyncState({
      status: "success",
      lastSynced:
        cloud.updatedAt ||
        new Date().toISOString(),
      errorMessage: null,
    });

    return finalDb;
  }

  const cached =
    readLocalCache();

  if (cached) {
    setSyncState({
      status: "error",
      errorMessage:
        "Server tidak dapat diakses. Menampilkan cache sementara.",
    });

    return recalculateAllLedgers(
      cached
    );
  }

  setSyncState({
    status: "error",
    errorMessage:
      "Database Google Spreadsheet tidak dapat diakses.",
  });

  return null;
}

/* =========================================================
   REALTIME POLLING (hemat kuota)

   Setiap 15 detik, aplikasi HANYA menanyakan "apakah ada perubahan?"
   lewat endpoint meta yang sangat kecil (action=meta). Database penuh
   HANYA diunduh kalau memang ada perubahan di server sejak terakhir
   kali disinkron. Perilaku yang terlihat oleh pengguna (auto-refresh
   tiap ±15 detik) TETAP SAMA seperti sebelumnya -- hanya biaya
   bandwidth di baliknya yang jauh lebih kecil saat tidak ada perubahan.
========================================================= */

export function subscribeToDatabaseChanges(
  callback: (db: Database) => void
): () => void {
  let stopped = false;
  let polling = false;

  const poll =
    async () => {
      if (
        stopped ||
        polling
      ) {
        return;
      }

      polling = true;

      try {
        const remoteLastUpdated =
          await fetchServerMeta();

        if (remoteLastUpdated === null) {
          // Gagal cek meta (mis. koneksi terputus sesaat). Jangan
          // dianggap "tidak ada perubahan" -- cukup coba lagi di
          // siklus polling berikutnya tanpa mengganggu tampilan.
          return;
        }

        const knownLastUpdated =
          lastSyncedSnapshot?.lastUpdated ||
          null;

        if (
          knownLastUpdated &&
          remoteLastUpdated === knownLastUpdated
        ) {
          // Tidak ada perubahan di server sejak terakhir disinkron ->
          // tidak perlu mengunduh seluruh database.
          return;
        }

        const cloud =
          await readCloudDatabase();

        if (
          cloud.db &&
          !stopped
        ) {
          const finalDb =
            recalculateAllLedgers(
              ensureDatabaseDefaults(
                cloud.db
              )
            );

          saveLocalCache(
            finalDb
          );

          setSyncState({
            status: "success",
            lastSynced:
              cloud.updatedAt ||
              new Date().toISOString(),
            errorMessage: null,
          });

          callback(
            finalDb
          );
        }
      } catch (error) {
        console.warn(
          "[GoogleSheets] Polling gagal:",
          error
        );
      } finally {
        polling = false;
      }
    };

  void poll();

  const interval =
    window.setInterval(
      () => {
        void poll();
      },
      15000
    );

  return () => {
    stopped = true;

    window.clearInterval(
      interval
    );
  };
}

/* =========================================================
   FORCE REFRESH
========================================================= */

export async function forceRefreshFromGoogleSheets():
  Promise<Database | null> {
  return pullFromGoogleSheets();
}

/* =========================================================
   CLEAR CACHE
========================================================= */

export function clearGoogleSheetsCache(): void {
  try {
    localStorage.removeItem(
      LOCAL_STORAGE_KEY
    );
  } catch {}

  lastSyncedSnapshot = null;
}
