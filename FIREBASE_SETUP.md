# Panduan Setup Firebase (Gratis) untuk Aplikasi Rumah Belajar

Aplikasi ini sekarang memakai **Firebase Firestore** sebagai database cloud,
menggantikan Google Spreadsheet. Firebase gratis untuk skala aplikasi seperti
ini (paket "Spark").

Ikuti langkah-langkah ini dari atas ke bawah, jangan ada yang dilewati.

## 1. Buat Project Firebase

1. Buka https://console.firebase.google.com
2. Login pakai akun Google kamu.
3. Klik **"Add project" / "Tambahkan project"**.
4. Beri nama, misalnya `rumah-belajar`. Klik **Continue**.
5. Untuk "Google Analytics" boleh dimatikan (tidak wajib). Klik **Create project**.
6. Tunggu sampai selesai, lalu klik **Continue**.

## 2. Aktifkan Firestore Database

1. Di menu sebelah kiri, klik **Build → Firestore Database**.
2. Klik **Create database**.
3. Pilih lokasi server: pilih yang paling dekat, misalnya `asia-southeast2 (Jakarta)`.
4. Pilih mode **Start in production mode**, lalu klik **Enable**.
   (Jangan pilih "test mode" — nanti kita pasang aturan keamanan sendiri di langkah 4.)

## 3. Aktifkan Anonymous Authentication

Ini dipakai supaya database tidak bisa diakses sembarang orang dari internet,
tapi tetap tidak mengganggu sistem login admin/tutor yang sudah ada di aplikasi.

1. Di menu kiri, klik **Build → Authentication**.
2. Klik **Get started**.
3. Di tab **Sign-in method**, cari **Anonymous**, klik, lalu **Enable**, klik **Save**.

## 4. Pasang Aturan Keamanan (Security Rules)

1. Kembali ke **Firestore Database**, klik tab **Rules**.
2. Ganti seluruh isinya dengan ini:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rumahBelajar/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Klik **Publish**.

Artinya: hanya perangkat yang sudah "sign-in anonim" (otomatis dilakukan oleh
aplikasi ini) yang boleh baca/tulis data. Orang random di internet yang cuma
tahu alamat project kamu tidak bisa mengakses datanya.

## 5. Daftarkan Aplikasi Web & Ambil Kunci Konfigurasi

1. Klik ikon **gear ⚙️ (Project settings)** di pojok kiri atas, dekat "Project Overview".
2. Scroll ke bawah ke bagian **"Your apps"**.
3. Klik ikon **`</>`** (Web).
4. Beri nickname, misalnya `rumah-belajar-web`. **Jangan** centang Firebase Hosting (tidak perlu).
5. Klik **Register app**.
6. Kamu akan melihat kode seperti ini — **salin semua nilainya**:

```js
const firebaseConfig = {
  apiKey: "AIzaSy........................",
  authDomain: "rumah-belajar-xxxxx.firebaseapp.com",
  projectId: "rumah-belajar-xxxxx",
  storageBucket: "rumah-belajar-xxxxx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

## 6. Masukkan Kunci ke File `.env`

1. Di folder project aplikasi, salin file `.env.example` menjadi `.env` (buat file baru bernama persis `.env`).
2. Isi dengan nilai-nilai yang kamu salin di langkah 5:

```
VITE_FIREBASE_API_KEY="AIzaSy........................"
VITE_FIREBASE_AUTH_DOMAIN="rumah-belajar-xxxxx.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="rumah-belajar-xxxxx"
VITE_FIREBASE_STORAGE_BUCKET="rumah-belajar-xxxxx.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="123456789012"
VITE_FIREBASE_APP_ID="1:123456789012:web:abcdef1234567890"
```

3. Simpan file.

> File `.env` **jangan diunggah ke GitHub / repo publik** kalau kamu deploy
> lewat Netlify/Vercel — nanti isinya dimasukkan lewat menu "Environment
> Variables" di platform hosting itu, bukan lewat file `.env` langsung.

## 7. Jalankan Aplikasi

Di terminal, dari folder project:

```
npm install
npm run dev
```

Buka alamat yang muncul (biasanya `http://localhost:3000`). Kalau semua
berhasil, saat pertama kali dibuka aplikasi akan otomatis membuat dokumen
database kosong di Firestore. Kamu bisa cek isinya langsung di Firebase
Console → Firestore Database → koleksi `rumahBelajar` → dokumen `database`.

## 8. Deploy (Kalau Sebelumnya Pakai Netlify)

Project ini sudah ada `netlify.toml`, jadi kalau kamu deploy ke Netlify:

1. Push kode ke GitHub.
2. Hubungkan repo ke Netlify.
3. Di Netlify, buka **Site settings → Environment variables**, masukkan 6
   variabel `VITE_FIREBASE_...` yang sama seperti di file `.env` kamu.
4. Deploy.

## Kalau Ada Masalah

- **"Konfigurasi Firebase belum diisi"** → file `.env` belum ada / salah nama variabel. Cek ulang langkah 6.
- **Data tidak muncul / error permission-denied** → cek lagi Security Rules di langkah 4, dan pastikan Anonymous Authentication sudah aktif (langkah 3).
- **Mau pindah/backup data lama dari Google Spreadsheet** → buka spreadsheet lama kamu, ekspor tiap sheet-nya, dan beri tahu saya kalau kamu mau saya bantu buatkan skrip import satu kali ke Firestore.

## Kenapa Firebase Lebih Cocok Dibanding Google Spreadsheet?

- **Realtime sebenarnya**: perubahan data langsung tersebar ke semua
  perangkat dalam hitungan detik (sebelumnya polling tiap 15 detik ke Apps
  Script).
- **Tidak ada limit request Apps Script** yang sering bikin sinkronisasi gagal
  saat banyak pengguna aktif bersamaan.
- **Gratis untuk skala kecil–menengah** (paket Spark: 50rb baca & 20rb tulis
  per hari — lebih dari cukup untuk satu lembaga bimbingan belajar).
- Struktur database (`Database` di `src/lib/db.ts`) **tidak berubah sama
  sekali** — semua fitur, laporan, dan perhitungan saldo tetap identik.
