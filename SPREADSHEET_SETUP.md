# Panduan Setup Backend Google Spreadsheet — Aplikasi Rumah Belajar

Backend aplikasi ini **sepenuhnya memakai Google Spreadsheet** sebagai
satu-satunya sumber data (tidak lagi memakai Supabase / database lain).

Setiap jenis data (siswa, tutor, pembayaran, dll) punya **tab/sheet sendiri**
berbentuk baris & kolom biasa — jadi Anda bisa membuka Spreadsheet-nya kapan
saja dan **mengedit atau menghapus data langsung di sana**. Perubahan itu akan
otomatis muncul di aplikasi begitu aplikasi mengambil data lagi (refresh /
buka ulang, atau otomatis setiap ±15 detik saat aplikasi terbuka).

---

## Langkah 1: Siapkan Google Spreadsheet

1. Buka [Google Sheets](https://sheets.google.com) → buat Spreadsheet baru.
2. Beri nama, misalnya **"Database Rumah Belajar"**.
3. Salin **ID Spreadsheet** dari URL-nya:
   `https://docs.google.com/spreadsheets/d/`**`ID_SPREADSHEET_ADA_DI_SINI`**`/edit`
4. Anda tidak perlu membuat tab/sheet manual — Apps Script akan membuatnya
   otomatis (`Programs`, `Students`, `Tutors`, `Sessions`, `Payments`,
   `Slips`, `OtherIncomes`, `Expenses`, `AttendanceReports`, `Schedules`,
   `Raports`, `Settings`) saat pertama kali dijalankan.

---

## Langkah 2: Pasang Apps Script

1. Di Spreadsheet, klik **Ekstensi** → **Apps Script**.
2. Hapus semua kode default di editor.
3. Buka file `gas/Code.gs` pada project ini, salin **seluruh isinya**, lalu
   tempel ke editor Apps Script.
4. Di bagian atas file, pastikan baris ini berisi ID Spreadsheet Anda (kalau
   Anda memasang script langsung dari dalam Spreadsheet, boleh dikosongkan
   `""` — script otomatis memakai Spreadsheet aktif):

   ```javascript
   const SPREADSHEET_ID = "1KK-WJKyCx2aECeIDJtxZm0AWHAs5Vy9J7hltM6LYYTE";
   ```

5. Simpan project (ikon disket / `Ctrl+S`).
6. Di dropdown fungsi (sebelah tombol ▶️ Run), pilih fungsi
   **`initializeDatabase`**, lalu klik **Run**. Ini akan membuat semua
   tab/sheet yang dibutuhkan secara otomatis. Saat diminta, berikan izin
   akses (Authorize) menggunakan akun Google Anda.

---

## Langkah 3: Deploy sebagai Web App

1. Klik **Deploy** → **New deployment**.
2. Pilih tipe **Web app**.
3. Isi konfigurasi:
   - **Description**: `Rumah Belajar Backend v4`
   - **Execute as**: `Me` (akun Anda)
   - **Who has access**: `Anyone` (siapa saja, supaya aplikasi bisa
     mengaksesnya tanpa login Google)
4. Klik **Deploy**, lalu **Authorize access** kalau diminta.
5. Salin **Web app URL** yang muncul (bentuknya seperti
   `https://script.google.com/macros/s/xxxxxxxxxxxx/exec`).

> **Kalau Anda mengedit ulang `Code.gs` di kemudian hari**, gunakan
> **Deploy → Manage deployments → ✏️ (edit) → New version** supaya URL
> deployment lama tetap berfungsi dan tidak perlu ganti URL di aplikasi.

---

## Langkah 4: Hubungkan URL ke Aplikasi

Buka file `src/lib/googleSheets.ts`, cari baris berikut, lalu ganti dengan
Web App URL Anda dari Langkah 3:

```ts
export const GOOGLE_SCRIPT_URL = String(
  metaEnv.VITE_GOOGLE_SCRIPT_URL ||
    "GANTI_DENGAN_WEB_APP_URL_ANDA"
);
```

Atau (cara yang lebih rapi, tanpa mengubah kode) buat file `.env` di root
project dengan isi:

```
VITE_GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/xxxxxxxxxxxx/exec
```

---

## Struktur Data per Sheet

| Sheet               | Data                                                    |
|---------------------|----------------------------------------------------------|
| `Programs`           | Daftar program belajar (nama, jenjang, tarif, honor)     |
| `Students`           | Data siswa                                                |
| `Tutors`             | Data tutor (termasuk `idLogin` & `password` untuk login) |
| `Sessions`           | Riwayat pertemuan/sesi belajar                            |
| `Payments`           | Pembayaran dari siswa                                     |
| `Slips`              | Slip pembayaran honor tutor                                |
| `OtherIncomes`       | Pemasukan lain di luar pembayaran siswa                    |
| `Expenses`           | Pengeluaran operasional                                    |
| `AttendanceReports`  | Laporan kehadiran/absensi dari tutor (foto otomatis diunggah ke Google Drive, sel hanya berisi link) |
| `Schedules`          | Jadwal les mingguan                                        |
| `Raports`            | Rapor / nilai siswa                                        |
| `Settings`           | `broadcastMessage` (pengumuman) & `adminPassword`          |

**Boleh diedit langsung**: semua sheet di atas boleh Anda tambah, ubah, atau
hapus barisnya secara manual kapan saja — asalkan **kolom `id` tidak
dikosongkan/diduplikasi** dan **baris header (baris 1) tidak dihapus**.

**Jangan buat sheet manual bernama** `studentLedger`, `tutorLedger`, atau
`kas` — tiga data itu adalah **hasil hitungan otomatis** aplikasi (dari
Sessions, Payments, Slips, OtherIncomes & Expenses), jadi tidak disimpan
sebagai sheet dan akan selalu dihitung ulang setiap data dibuka.

> **Tips**: untuk kolom seperti `telepon`, `teleponOrangTua`, `idLogin`, atau
> nomor yang diawali angka `0`, format dulu kolomnya sebagai **Format →
> Angka → Teks biasa (Plain text)** di Google Sheets sebelum mengetik data,
> supaya angka `0` di depan tidak otomatis hilang.

---

## Aksi API yang Tersedia (dipakai otomatis oleh aplikasi)

| Aksi (`action`)     | Method | Fungsi                                              |
|---------------------|--------|------------------------------------------------------|
| `get`                | GET/POST | **Ambil** seluruh database dari semua sheet         |
| `save` / `upload`   | POST   | **Upload/simpan** data (upsert per baris berdasarkan `id`) |
| `upsertOne`         | POST   | Simpan/ubah 1 record saja di 1 koleksi               |
| `delete`            | POST   | **Hapus** 1 baris data (`collection` + `id`)         |
| `deleteAttendance`  | POST   | Hapus laporan kehadiran beserta sesi otomatis terkait |
| `initialize` / `repair` | POST | Menyiapkan/merapikan seluruh sheet                |
| `health`            | GET/POST | Cek API aktif                                       |

---

## Menguji Backend

Setelah deploy, buka URL Web App Anda di browser dengan menambahkan
`?action=health`, misalnya:

```
https://script.google.com/macros/s/xxxxxxxxxxxx/exec?action=health
```

Kalau muncul JSON `{"success": true, ...}`, backend sudah aktif dan siap
dipakai aplikasi.

Anda juga bisa menjalankan fungsi `testDatabase` atau `testApiHealth`
langsung dari editor Apps Script (tombol ▶️ Run) untuk melihat hasilnya di
**Execution log**.
