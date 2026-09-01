/*******************************************************
 * UTILITAS PENCARIAN TEKS
 *
 * Kenapa perlu ini: pencarian sederhana `a.includes(b)` gampang
 * "meleset" begitu data sudah banyak (ratusan siswa/tutor/sesi),
 * misalnya karena:
 * - ada spasi ganda / spasi di ujung teks (umum kalau data
 *   diketik manual atau ditempel dari WhatsApp/Word)
 * - user mengetik kata dengan urutan berbeda dari nama aslinya
 *   (contoh: cari "santoso budi" padahal nama aslinya
 *   "Budi Santoso")
 * - user tidak sengaja menambahkan spasi di awal/akhir kotak cari
 *
 * `normalizeSearchText` merapikan teks (huruf kecil, rapikan
 * spasi). `matchesSearch` mencocokkan SETIAP KATA di kueri
 * terhadap teks target (tidak harus berurutan/berdekatan),
 * sehingga jauh lebih toleran untuk pencarian nama di antara
 * data yang banyak.
 *******************************************************/

export function normalizeSearchText(
  value: unknown
): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cocokkan `query` terhadap satu atau lebih `targets` (nama,
 * kode, dll). Setiap kata di `query` harus muncul sebagai
 * substring di SALAH SATU target (tidak peduli urutan kata).
 *
 * Kueri kosong selalu dianggap cocok (supaya daftar tidak
 * terfilter habis saat kotak cari masih kosong).
 */
export function matchesSearch(
  query: string,
  ...targets: unknown[]
): boolean {
  const normalizedQuery =
    normalizeSearchText(query);

  if (normalizedQuery === "") return true;

  const queryWords = normalizedQuery.split(" ");

  const normalizedTargets = targets.map(
    normalizeSearchText
  );

  return queryWords.every((word) =>
    normalizedTargets.some((target) =>
      target.includes(word)
    )
  );
}
