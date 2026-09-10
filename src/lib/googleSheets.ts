import type { Database } from "./db";
import {
  ensureDatabaseDefaults,
  recalculateAllLedgers,
  generateCleanDatabase,
  mergeDatabases,
} from "./db";

const metaEnv = (import.meta as any)?.env || {};

export const GOOGLE_SCRIPT_URL = String(
  metaEnv.VITE_GOOGLE_SCRIPT_URL ||
    "https://script.google.com/macros/s/AKfycbwhRJ9jWeRkbLKPwkIc0nfIhbekysZcths0xPZi2M_thOBG-tbsMNaf-yLjZekZ0YgV/exec"
);

// ============================================================
// KUNCI PENYIMPANAN LOKAL
// ============================================================
// LOCAL_STORAGE_KEY  : database kerja saat ini (dipakai UI, boleh
//                       berisi perubahan yang BELUM tersinkron).
// SNAPSHOT_STORAGE_KEY: salinan TERAKHIR YANG DIKONFIRMASI SERVER.
//                       Dipakai untuk membandingkan (diff) supaya
//                       kita hanya mengirim baris yang benar-benar
//                       berubah, bukan seluruh database setiap kali.
const LOCAL_STORAGE_KEY = "rumah_belajar_db_v2";
const SNAPSHOT_STORAGE_KEY = "rumah_belajar_synced_snapshot_v1";

// Semua koleksi yang benar-benar disimpan di Spreadsheet (harus
// SAMA PERSIS dengan ALL_COLLECTION_KEYS di gas/Code.gs). Ledger
// (studentLedger/tutorLedger/kas) sengaja tidak diikutkan karena
// itu hasil hitungan otomatis di aplikasi, bukan data mentah.
const SYNCED_COLLECTION_KEYS = [
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

type SyncedCollectionKey = (typeof SYNCED_COLLECTION_KEYS)[number];

const REQUEST_TIMEOUT_MS = 20000;
const POLL_INTERVAL_MS = 25000;
const RETRY_INTERVAL_MS = 15000;

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
      // jangan sampai listener yang error mematikan proses sync
    }
  });
}

export function subscribeToSyncState(listener: (state: SyncState) => void): () => void {
  syncListeners.add(listener);
  listener({ ...syncState });
  return () => {
    syncListeners.delete(listener);
  };
}

export function isEmptyDatabase(database: any): boolean {
  return !database || typeof database !== "object";
}

// ============================================================
// LOCAL CACHE (kerja) & SNAPSHOT (terakhir konfirmasi server)
// ============================================================

function saveLocalCache(database: Database): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(database));
  } catch (error) {
    console.warn("Gagal simpan cache lokal:", error);
  }
}

function readLocalCache(): Database | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return ensureDatabaseDefaults(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveSyncedSnapshot(database: Database): void {
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(database));
  } catch (error) {
    console.warn("Gagal simpan snapshot sinkronisasi:", error);
  }
}

function readSyncedSnapshot(): Database | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    return ensureDatabaseDefaults(JSON.parse(raw));
  } catch {
    return null;
  }
}

// ============================================================
// HELPER FETCH DENGAN TIMEOUT (supaya tidak "menggantung" lama
// di jaringan HP yang lemot / putus-putus)
// ============================================================

async function postToScript(payload: Record<string, any>): Promise<any> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("Server merespon status " + response.status);
    }

    const json = await response.json();
    if (!json || json.success !== true) {
      throw new Error((json && json.error) || "Server menolak permintaan.");
    }
    return json;
  } finally {
    window.clearTimeout(timer);
  }
}

// ============================================================
// DIFF ENGINE: bandingkan db kerja saat ini vs snapshot terakhir
// yang sudah dikonfirmasi server, hasilkan payload SEMINIMAL
// mungkin untuk action=upsertBatch.
// ============================================================

interface DiffResult {
  changes: Partial<Record<SyncedCollectionKey, any[]>>;
  deletions: Partial<Record<SyncedCollectionKey, string[]>>;
  settings: { broadcastMessage?: string; adminPassword?: string } | null;
  isEmpty: boolean;
}

function diffDatabases(current: Database, snapshot: Database | null): DiffResult {
  const changes: Partial<Record<SyncedCollectionKey, any[]>> = {};
  const deletions: Partial<Record<SyncedCollectionKey, string[]>> = {};
  const deletedSet = new Set(current.deletedIds || []);
  let hasAny = false;

  for (const key of SYNCED_COLLECTION_KEYS) {
    const currentItems: any[] = Array.isArray((current as any)[key]) ? (current as any)[key] : [];
    const snapshotItems: any[] = snapshot && Array.isArray((snapshot as any)[key]) ? (snapshot as any)[key] : [];

    const snapshotMap = new Map<string, string>();
    snapshotItems.forEach((item) => {
      if (item && item.id) snapshotMap.set(String(item.id), JSON.stringify(item));
    });

    const currentIds = new Set<string>();
    const changedItems: any[] = [];

    currentItems.forEach((item) => {
      if (!item || !item.id) return;
      const id = String(item.id);
      currentIds.add(id);
      const prevSerialized = snapshotMap.get(id);
      const nowSerialized = JSON.stringify(item);
      if (prevSerialized === undefined || prevSerialized !== nowSerialized) {
        changedItems.push(item);
      }
    });

    if (changedItems.length > 0) {
      changes[key] = changedItems;
      hasAny = true;
    }

    // Hanya kirim penghapusan untuk id yang memang secara eksplisit
    // ditandai terhapus di aplikasi (deletedIds), supaya baris yang
    // sekadar "belum termuat" di device ini tidak ikut kehapus.
    const removedIds = snapshotItems
      .map((item) => (item && item.id ? String(item.id) : ""))
      .filter((id) => id && !currentIds.has(id) && deletedSet.has(id));

    if (removedIds.length > 0) {
      deletions[key] = removedIds;
      hasAny = true;
    }
  }

  let settings: DiffResult["settings"] = null;
  const snapBroadcast = snapshot?.broadcastMessage;
  const snapPassword = snapshot?.adminPassword;
  if (current.broadcastMessage !== undefined && current.broadcastMessage !== snapBroadcast) {
    settings = { ...(settings || {}), broadcastMessage: current.broadcastMessage };
    hasAny = true;
  }
  if (current.adminPassword !== undefined && current.adminPassword !== snapPassword) {
    settings = { ...(settings || {}), adminPassword: current.adminPassword };
    hasAny = true;
  }

  return { changes, deletions, settings, isEmpty: !hasAny };
}

// Setelah upsertBatch sukses, perbarui snapshot: item yang baru
// dikirim diganti dengan versi final dari server (mis. URL foto
// jurnal yang sudah dipindah ke Drive), item lain di snapshot
// dibiarkan, dan id yang berhasil dihapus dibuang dari snapshot.
function applySyncedDiffToSnapshot(
  snapshot: Database | null,
  diff: DiffResult,
  serverItems: Partial<Record<SyncedCollectionKey, any[]>>
): Database {
  const base: Database = snapshot ? { ...snapshot } : generateCleanDatabase();

  for (const key of SYNCED_COLLECTION_KEYS) {
    const existing: any[] = Array.isArray((base as any)[key]) ? (base as any)[key] : [];
    const byId = new Map<string, any>();
    existing.forEach((item) => item && item.id && byId.set(String(item.id), item));

    const confirmed = serverItems[key] || diff.changes[key] || [];
    confirmed.forEach((item) => {
      if (item && item.id) byId.set(String(item.id), item);
    });

    const removed = diff.deletions[key] || [];
    removed.forEach((id) => byId.delete(String(id)));

    (base as any)[key] = Array.from(byId.values());
  }

  if (diff.settings?.broadcastMessage !== undefined) {
    base.broadcastMessage = diff.settings.broadcastMessage;
  }
  if (diff.settings?.adminPassword !== undefined) {
    base.adminPassword = diff.settings.adminPassword;
  }

  return ensureDatabaseDefaults(base);
}

// ============================================================
// PULL: ambil data ASLI dari Google Spreadsheet, gabungkan
// dengan cache lokal (supaya perubahan yang belum sempat
// terkirim tidak ikut hilang), lalu simpan sebagai snapshot baru.
// ============================================================

async function pullAndMerge(): Promise<Database | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "get" }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) throw new Error("Server merespon status " + response.status);

    const json = await response.json();
    if (!json || json.success !== true || !json.data) {
      throw new Error((json && json.error) || "Data dari server tidak valid.");
    }

    const remote = ensureDatabaseDefaults(json.data);
    const local = readLocalCache() || generateCleanDatabase();

    // Snapshot = persis apa yang server punya saat ini (dipakai
    // untuk diff push berikutnya).
    saveSyncedSnapshot(remote);

    // Working copy = gabungan, supaya edit lokal yang belum sempat
    // terkirim (misalnya waktu HP sempat offline) tetap ada di UI
    // dan otomatis akan dikirim ulang di push berikutnya.
    const merged = recalculateAllLedgers(mergeDatabases(local, remote));
    saveLocalCache(merged);

    return merged;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function pullFromGoogleSheets(): Promise<Database | null> {
  try {
    setSyncState({ status: "syncing", errorMessage: null });
    const merged = await pullAndMerge();
    setSyncState({ status: "success", lastSynced: new Date().toISOString(), errorMessage: null });

    // Kalau ternyata masih ada perbedaan antara working copy (hasil
    // merge) dan snapshot server (artinya ada edit lokal yang belum
    // terkirim, misalnya push sebelumnya gagal karena offline),
    // langsung coba kirim lagi di belakang layar tanpa diminta user.
    void flushPendingChanges();

    return merged;
  } catch (error) {
    console.warn("Gagal mengambil data dari Google Spreadsheet:", error);
    setSyncState({
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Gagal terhubung ke server.",
    });

    // Kalau gagal, jangan biarkan layar kosong: pakai cache lokal
    // (kalau ada), atau database bersih kalau device ini baru sama
    // sekali.
    const cached = readLocalCache();
    if (cached) return recalculateAllLedgers(cached);
    return recalculateAllLedgers(generateCleanDatabase());
  }
}

export async function forceRefreshFromGoogleSheets(): Promise<Database | null> {
  return pullFromGoogleSheets();
}

export async function readCloudDatabase(): Promise<{ db: Database | null; updatedAt: string | null }> {
  try {
    const merged = await pullAndMerge();
    return { db: merged, updatedAt: merged?.lastUpdated || null };
  } catch {
    return { db: null, updatedAt: null };
  }
}

// ============================================================
// PUSH: simpan lokal instan, lalu kirim HANYA perubahan (diff)
// ke Google Spreadsheet lewat action=upsertBatch. Menunggu
// balasan server sebelum melapor "berhasil" - tidak lagi
// fire-and-forget yang diam-diam gagal.
// ============================================================

let latestPendingDb: Database | null = null;
let pushDebounceTimer: number | null = null;
let pushInFlight: Promise<{ success: boolean; db?: Database }> | null = null;
type PendingResolver = (result: { success: boolean; db?: Database }) => void;
let pendingResolvers: PendingResolver[] = [];
let retryTimer: number | null = null;

async function performPush(db: Database): Promise<{ success: boolean; db?: Database }> {
  const snapshot = readSyncedSnapshot();
  const diff = diffDatabases(db, snapshot);

  if (diff.isEmpty) {
    // Tidak ada apa pun yang berubah dibanding server -> tidak perlu
    // request sama sekali. Ini penting supaya app tidak "berat" karena
    // kirim data terus-menerus padahal tidak ada yang baru.
    setSyncState({ status: "success", lastSynced: new Date().toISOString(), errorMessage: null });
    return { success: true, db };
  }

  setSyncState({ status: "syncing", errorMessage: null });

  try {
    const payload: Record<string, any> = { action: "upsertBatch", changes: diff.changes, deletions: diff.deletions };
    if (diff.settings) payload.settings = diff.settings;

    const json = await postToScript(payload);
    const serverItems: Partial<Record<SyncedCollectionKey, any[]>> = json.items || {};

    const newSnapshot = applySyncedDiffToSnapshot(snapshot, diff, serverItems);
    saveSyncedSnapshot(newSnapshot);

    // Selipkan versi final dari server (misal URL foto jurnal) ke
    // working copy juga, supaya UI langsung menampilkan nilai yang
    // benar-benar tersimpan.
    const updatedDb = ensureDatabaseDefaults({ ...db, lastUpdated: json.lastUpdated || db.lastUpdated });
    for (const key of SYNCED_COLLECTION_KEYS) {
      const confirmed = serverItems[key];
      if (!confirmed || confirmed.length === 0) continue;
      const byId = new Map<string, any>();
      (confirmed as any[]).forEach((item) => item && item.id && byId.set(String(item.id), item));
      (updatedDb as any)[key] = ((updatedDb as any)[key] || []).map((item: any) =>
        item && byId.has(String(item.id)) ? byId.get(String(item.id)) : item
      );
    }
    saveLocalCache(updatedDb);

    setSyncState({ status: "success", lastSynced: new Date().toISOString(), errorMessage: null });
    return { success: true, db: updatedDb };
  } catch (error) {
    console.warn("Gagal mengirim perubahan ke Google Spreadsheet:", error);
    setSyncState({
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Gagal terhubung ke server.",
    });
    scheduleRetry();
    return { success: false };
  }
}

function scheduleRetry() {
  if (retryTimer !== null) return;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    void flushPendingChanges();
  }, RETRY_INTERVAL_MS);
}

// Coba kirim ulang perubahan yang belum tersinkron (dipanggil saat
// koneksi kembali online, saat polling berhasil, atau lewat retry
// timer di atas). Aman dipanggil kapan saja - kalau memang tidak ada
// yang berubah, performPush akan langsung selesai tanpa request.
export async function flushPendingChanges(): Promise<void> {
  const db = readLocalCache();
  if (!db) return;
  await performPush(db);
}

export function pushToGoogleSheets(localDb: Database, force = false): Promise<{ success: boolean; db?: Database }> {
  const normalizedDb = recalculateAllLedgers(ensureDatabaseDefaults(localDb));

  // Simpan ke cache lokal SEKETIKA supaya UI & reload halaman tidak
  // pernah kehilangan perubahan, terlepas dari sukses/gagalnya kirim
  // ke server.
  saveLocalCache(normalizedDb);
  latestPendingDb = normalizedDb;

  // Debounce singkat: kalau ada beberapa handleUpdateDb beruntun
  // dalam waktu berdekatan (mis. beberapa field disimpan cepat),
  // gabungkan jadi SATU request saja memakai data paling akhir,
  // supaya tidak spam network request ke HP yang koneksinya lemah.
  return new Promise((resolve) => {
    pendingResolvers.push(resolve);

    if (pushDebounceTimer !== null) {
      window.clearTimeout(pushDebounceTimer);
    }

    pushDebounceTimer = window.setTimeout(() => {
      pushDebounceTimer = null;
      const dbToSend = latestPendingDb || normalizedDb;
      const resolvers = pendingResolvers;
      pendingResolvers = [];

      pushInFlight = performPush(dbToSend).then((result) => {
        resolvers.forEach((r) => r(result));
        return result;
      });
    }, force ? 0 : 350);
  });
}

// ============================================================
// REALTIME (polling ringan): cek action=meta secara berkala,
// kalau timestamp berubah baru tarik data penuh. Berhenti polling
// saat tab tidak aktif (hemat baterai/kuota di HP), dan langsung
// cek ulang begitu koneksi internet kembali.
// ============================================================

export function subscribeToDatabaseChanges(callback: (db: Database) => void): () => void {
  let stopped = false;
  let intervalId: number | null = null;
  let lastKnownUpdatedAt: string | null = readSyncedSnapshot()?.lastUpdated || null;

  const checkForChanges = async () => {
    if (stopped || document.hidden) return;
    try {
      const json = await postToScript({ action: "meta" });
      if (stopped) return;

      if (json.lastUpdated && json.lastUpdated !== lastKnownUpdatedAt) {
        lastKnownUpdatedAt = json.lastUpdated;
        const merged = await pullAndMerge();
        if (!stopped && merged) callback(merged);
      } else {
        // Tidak ada perubahan di server, tapi manfaatkan kesempatan
        // ini untuk mengirim ulang perubahan lokal kalau ada yang
        // sebelumnya gagal terkirim.
        void flushPendingChanges();
      }
    } catch {
      // Diam-diam gagal (mis. tidak ada internet) - akan dicoba lagi
      // di interval berikutnya, tidak perlu mengganggu user.
    }
  };

  const start = () => {
    if (intervalId !== null) return;
    intervalId = window.setInterval(checkForChanges, POLL_INTERVAL_MS);
  };
  const stop = () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      stop();
    } else {
      start();
      void checkForChanges();
    }
  };
  const onOnline = () => {
    void checkForChanges();
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", onOnline);
  if (!document.hidden) start();

  return () => {
    stopped = true;
    stop();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("online", onOnline);
  };
}
