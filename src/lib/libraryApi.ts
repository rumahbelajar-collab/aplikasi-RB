/* =========================================================
   API PERPUSTAKAAN (Google Sheets via Apps Script)

   Backend fitur Perpustakaan TERPISAH dari Firebase -- sesuai
   permintaan: sumber data utamanya Google Spreadsheet, diakses
   lewat Apps Script yang sama dengan yang dipakai untuk upload
   foto absensi (satu Web App URL, dibedakan lewat parameter
   "action").
========================================================= */

// URL Web App Apps Script yang SAMA dengan yang dipakai driveUpload.ts
const LIBRARY_API_URL =
  "https://script.google.com/macros/s/AKfycby9Ke4mI99VdAOnxxtwPLIAKp2T5ef-ioLfAyD4ZsB7tmLQnigV20GhjXofCxxisF5zeA/exec";

export interface BookItem {
  id_buku: string;
  kode_buku?: string;
  isbn?: string;
  judul: string;
  penulis?: string;
  penerbit?: string;
  tahun_terbit?: string | number;
  kategori_id?: string;
  deskripsi?: string;
  cover_url?: string;
  lokasi_rak?: string;
  stok_total?: number;
  stok_tersedia?: number;
  status?: string;
}

export interface BookCategory {
  id: string;
  nama: string;
  deskripsi?: string;
  status?: string;
}

export interface LibraryLoan {
  id_peminjaman: string;
  user_id: string;
  nama_user: string;
  role_user: string;
  id_buku: string;
  judul_buku: string;
  tanggal_pengajuan?: string;
  tanggal_disetujui?: string;
  tanggal_pinjam?: string;
  tanggal_jatuh_tempo?: string;
  tanggal_dikembalikan?: string;
  status: "menunggu" | "dipinjam" | "ditolak" | "dikembalikan" | string;
  catatan_user?: string;
  catatan_admin?: string;
  verified_by?: string;
}

export interface RegulasiItem {
  urutan?: string | number;
  judul: string;
  isi: string;
}

export interface LibraryDashboardStats {
  totalBuku: number;
  stokTersedia: number;
  sedangDipinjam: number;
  menungguVerifikasi: number;
  terlambat: number;
}

async function libraryGet<T>(
  action: string,
  params: Record<string, string> = {}
): Promise<T> {
  const query = new URLSearchParams({ action, ...params }).toString();

  let response: Response;
  try {
    response = await fetch(`${LIBRARY_API_URL}?${query}`);
  } catch (error) {
    throw new Error(
      "Tidak dapat menghubungi server Perpustakaan. Periksa koneksi internet Anda."
    );
  }

  let result: any;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error("Respons server Perpustakaan tidak valid.");
  }

  if (!result || result.success !== true) {
    throw new Error(result?.error || "Gagal mengambil data Perpustakaan.");
  }

  return result.data as T;
}

async function libraryPost<T = { success: true }>(
  action: string,
  payload: Record<string, any> = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(LIBRARY_API_URL, {
      method: "POST",
      body: JSON.stringify({ action, payload })
    });
  } catch (error) {
    throw new Error(
      "Tidak dapat menghubungi server Perpustakaan. Periksa koneksi internet Anda."
    );
  }

  let result: any;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error("Respons server Perpustakaan tidak valid.");
  }

  if (!result || result.success !== true) {
    throw new Error(result?.error || "Gagal memproses permintaan Perpustakaan.");
  }

  return result as T;
}

/* ---------- BACA ---------- */

export function getBooks(): Promise<BookItem[]> {
  return libraryGet<BookItem[]>("getBooks");
}

export function getBookDetail(idBuku: string): Promise<BookItem> {
  return libraryGet<BookItem>("getBookDetail", { id_buku: idBuku });
}

export function getCategories(): Promise<BookCategory[]> {
  return libraryGet<BookCategory[]>("getCategories");
}

export function getMyLoans(userId: string): Promise<LibraryLoan[]> {
  return libraryGet<LibraryLoan[]>("getMyLoans", { user_id: userId });
}

export function getAllLoans(): Promise<LibraryLoan[]> {
  return libraryGet<LibraryLoan[]>("getAllLoans");
}

export function getRegulasi(): Promise<RegulasiItem[]> {
  return libraryGet<RegulasiItem[]>("getRegulasi");
}

export function getLibraryDashboard(): Promise<LibraryDashboardStats> {
  return libraryGet<LibraryDashboardStats>("getLibraryDashboard");
}

/* ---------- TULIS ---------- */

export function submitLoan(payload: {
  user_id: string;
  nama_user: string;
  role_user: string;
  id_buku: string;
  judul_buku: string;
  catatan_user?: string;
}) {
  return libraryPost<{ success: true; id_peminjaman: string }>(
    "submitLoan",
    payload
  );
}

export function approveLoan(payload: {
  id_peminjaman: string;
  verified_by: string;
  lama_pinjam_hari?: number;
}) {
  return libraryPost("approveLoan", payload);
}

export function rejectLoan(payload: {
  id_peminjaman: string;
  verified_by: string;
  catatan_admin?: string;
}) {
  return libraryPost("rejectLoan", payload);
}

export function returnBook(payload: { id_peminjaman: string }) {
  return libraryPost("returnBook", payload);
}

/**
 * Input peminjaman langsung oleh petugas: ajukan lalu setujui otomatis.
 * Memakai submitLoan + approveLoan yang sudah ada, jadi backend tidak berubah.
 */
export async function createLoan(payload: {
  user_id: string;
  nama_user: string;
  role_user: string;
  id_buku: string;
  judul_buku: string;
  durasi_hari: number;
  verified_by: string;
  langsung_disetujui?: boolean;
}) {
  const submitted = await submitLoan({
    user_id: payload.user_id,
    nama_user: payload.nama_user,
    role_user: payload.role_user,
    id_buku: payload.id_buku,
    judul_buku: payload.judul_buku,
    catatan_user: "Diinput oleh petugas: " + payload.verified_by
  });

  // false = biarkan "menunggu" supaya tetap lewat menu Verifikasi
  if (payload.langsung_disetujui === false) return submitted;

  try {
    await approveLoan({
      id_peminjaman: submitted.id_peminjaman,
      verified_by: payload.verified_by,
      lama_pinjam_hari: payload.durasi_hari
    });
  } catch (error) {
    // Hindari pengajuan "menunggu" yatim kalau persetujuan gagal
    try {
      await rejectLoan({
        id_peminjaman: submitted.id_peminjaman,
        verified_by: payload.verified_by,
        catatan_admin: "Dibatalkan otomatis: persetujuan gagal"
      });
    } catch {}
    throw error;
  }

  return submitted;
}

export function createBook(payload: Partial<BookItem>) {
  return libraryPost<{ success: true; id_buku: string }>(
    "createBook",
    payload
  );
}

export function updateBook(payload: Partial<BookItem> & { id_buku: string }) {
  return libraryPost("updateBook", payload);
}

export function deleteBook(idBuku: string) {
  return libraryPost("deleteBook", { id_buku: idBuku });
}

export function createCategory(payload: { nama: string; deskripsi?: string }) {
  return libraryPost<{ success: true; id: string }>(
    "createCategory",
    payload
  );
}