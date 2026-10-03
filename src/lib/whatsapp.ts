/* =========================================================
   WHATSAPP HELPER (link siap-kirim, bukan auto-send)

   Memakai wa.me -- link resmi WhatsApp yang membuka chat
   dengan nomor & pesan yang sudah terisi otomatis. Pengguna
   (Tutor) tinggal menekan tombol Kirim di WhatsApp sekali.
   Tidak perlu API key, tidak ada biaya, tidak ada akun
   pihak ketiga.
========================================================= */

// GANTI dengan nomor WhatsApp Admin.
// Format: kode negara + nomor, TANPA "+" dan TANPA "0" di depan.
// Contoh: nomor 0812-3456-7890 -> ditulis "6281234567890"
export const ADMIN_WHATSAPP_NUMBER = "6282337663291";

export function buildWaLink(message: string, phone: string = ADMIN_WHATSAPP_NUMBER): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
