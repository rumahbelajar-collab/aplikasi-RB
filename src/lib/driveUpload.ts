/* =========================================================
   UPLOAD FOTO KE GOOGLE DRIVE (lewat Apps Script)

   Kenapa tidak Firebase Storage? Karena sejak awal 2026,
   Firebase mewajibkan project dihubungkan ke paket Blaze
   (billing) untuk bisa memakai Cloud Storage. Supaya tetap
   gratis, foto jurnal absensi dikirim ke sebuah "Web App"
   Google Apps Script (dibuat & dimiliki sendiri oleh pemilik
   aplikasi), yang tugasnya menyimpan foto ke folder Google
   Drive tertentu lalu mengembalikan link foto tersebut.

   Alur:
   1. Foto dari <input type="file"> dikompres dulu (resize +
      turunkan kualitas JPEG) supaya kecil & cepat diunggah.
   2. Hasil kompresi (base64) dikirim via fetch POST ke URL
      Web App Apps Script.
   3. Apps Script membalas { success: true, url: "..." }.
   4. URL itu (BUKAN base64) yang disimpan ke field
      `fotoJurnal` di database -- supaya dokumen Firestore
      tetap kecil.
========================================================= */

// URL "Web App" hasil deploy Google Apps Script.
// Ganti nilai ini kalau suatu saat deployment-nya diganti/dibuat ulang.
const DRIVE_UPLOAD_URL =
  "https://script.google.com/macros/s/AKfycbxKtLV2ZJaAPGpFtjEdaoPYJ_moeQ-fXkuTg_rTZ62GP2dYxlrfAkxftHC7c1fPVtKU/exec";

export interface CompressedImage {
  base64: string; // full data URL, contoh: "data:image/jpeg;base64,...."
  filename: string;
}

/**
 * Mengecilkan ukuran gambar (resize + kompres kualitas JPEG)
 * sebelum diunggah, supaya hemat kuota & cepat.
 */
export function compressImage(
  file: File,
  maxWidth = 1000,
  quality = 0.7
): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error("Gagal memuat gambar."));

      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const targetWidth = Math.round(img.width * scale);
        const targetHeight = Math.round(img.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas tidak didukung di perangkat ini."));
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        const originalName = file.name.replace(/\.[^/.]+$/, "");
        const filename = `${originalName || "jurnal"}.jpg`;

        resolve({ base64: dataUrl, filename });
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Mengunggah gambar (hasil compressImage) ke Google Drive
 * lewat Web App Apps Script, dan mengembalikan link fotonya.
 */
export async function uploadFotoToDrive(
  image: CompressedImage
): Promise<string> {
  // Buang header "data:image/jpeg;base64," -- Apps Script
  // hanya butuh data base64 murni.
  const commaIndex = image.base64.indexOf(",");
  const rawBase64 =
    commaIndex >= 0 ? image.base64.slice(commaIndex + 1) : image.base64;

  let response: Response;

  try {
    response = await fetch(DRIVE_UPLOAD_URL, {
      method: "POST",
      body: JSON.stringify({
        base64: rawBase64,
        filename: image.filename,
      }),
    });
  } catch (error) {
    throw new Error(
      "Tidak dapat menghubungi server penyimpanan foto. Periksa koneksi internet Anda."
    );
  }

  let result: any;

  try {
    result = await response.json();
  } catch (error) {
    throw new Error("Respons server penyimpanan foto tidak valid.");
  }

  if (!result || result.success !== true || !result.url) {
    throw new Error(
      result?.error || "Gagal mengunggah foto ke penyimpanan."
    );
  }

  return result.url as string;
}
