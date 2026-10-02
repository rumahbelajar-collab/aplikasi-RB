/* =========================================================
   QR CODE HELPER

   Tidak pakai library QR generator apa pun (tidak perlu npm
   install) -- memakai layanan gambar QR gratis dari
   api.qrserver.com. Browser pengguna (yang punya internet)
   yang memanggil layanan ini, bukan komputer kerja saya.

   QR Code HANYA berisi ID anggota (tutor.id) -- tidak pernah
   berisi password atau data sensitif lain, sesuai permintaan.
========================================================= */

export function getQrImageUrl(data: string, size = 220): string {
  const encoded = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`;
}

/**
 * Mengambil gambar QR dan mengubahnya jadi data URL base64,
 * supaya bisa ditempel ke dalam PDF (jsPDF butuh base64/dataURL,
 * tidak bisa langsung pakai URL gambar dari internet).
 */
export async function getQrImageDataUrl(data: string, size = 220): Promise<string> {
  const url = getQrImageUrl(data, size);

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error("Tidak dapat mengambil gambar QR Code. Periksa koneksi internet Anda.");
  }

  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Gagal memproses gambar QR Code."));
    reader.readAsDataURL(blob);
  });
}
