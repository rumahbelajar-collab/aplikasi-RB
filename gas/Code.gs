/*******************************************************
 * =====================================================
 * RUMAH BELAJAR
 * GOOGLE APPS SCRIPT DATABASE API (v4)
 *
 * GOOGLE SPREADSHEET = SATU-SATUNYA SUMBER DATA (SOURCE OF TRUTH)
 *
 * Perbedaan dari versi sebelumnya:
 * - TIDAK lagi menyimpan seluruh database sebagai 1 blok JSON
 *   raksasa di satu sel. Setiap koleksi data (siswa, tutor,
 *   pembayaran, dst) punya SHEET/TAB sendiri, satu baris = satu
 *   data, satu kolom = satu field.
 * - Karena disimpan sebagai baris & kolom biasa, Anda BISA
 *   membuka Spreadsheet dan mengedit/menghapus data secara
 *   manual langsung dari Google Sheets. Perubahan itu akan
 *   otomatis terbaca oleh aplikasi saat action=get dipanggil.
 * - Jika Anda menambah kolom baru secara manual di sebuah
 *   sheet, kolom itu akan tetap ikut terbaca & tertulis lagi
 *   (tidak akan hilang), selama header di baris 1 tidak dihapus.
 * - Foto jurnal (base64) yang dikirim dari aplikasi otomatis
 *   diunggah ke Google Drive lalu hanya URL-nya yang disimpan
 *   di Spreadsheet, supaya sel tidak melebihi batas ukuran.
 *
 * Aksi yang didukung:
 * - GET  ?action=get       -> ambil seluruh database
 * - GET  ?action=meta      -> HANYA cap waktu terakhir update (ringan,
 *                             dipakai frontend untuk polling hemat kuota)
 * - GET  ?action=health    -> cek API aktif
 * - POST action=get        -> ambil seluruh database
 * - POST action=meta       -> sama seperti GET ?action=meta
 * - POST action=save       -> upload / simpan SELURUH database (upsert
 *                             per baris). Dipakai saat sinkronisasi
 *                             pertama kali / perubahan besar sekaligus.
 * - POST action=upsertOne  -> simpan 1 baris data dari 1 koleksi (ringan)
 * - POST action=upsertBatch-> simpan beberapa baris dari beberapa
 *                             koleksi + hapus baris tertentu + ubah
 *                             pengaturan, SEMUA DALAM SATU REQUEST.
 *                             Inilah jalur utama yang dipakai frontend
 *                             untuk mengirim HANYA data yang berubah.
 * - POST action=saveSettings -> ubah broadcast/password admin saja
 * - POST action=delete     -> hapus 1 baris data dari 1 koleksi
 * - POST action=deleteAttendance -> hapus laporan kehadiran + sesi terkait
 * - POST action=initialize / repair -> siapkan / rapikan semua sheet
 * =====================================================
 *******************************************************/


/*******************************************************
 * KONFIGURASI
 *******************************************************/

// Kosongkan ("") supaya otomatis memakai Spreadsheet tempat
// script ini ditempelkan (Ekstensi > Apps Script).
// Isi dengan ID Spreadsheet kalau mau menunjuk spreadsheet lain.
const SPREADSHEET_ID = "1KK-WJKyCx2aECeIDJtxZm0AWHAs5Vy9J7hltM6LYYTE";

const DB_VERSION = 4;

const SETTINGS_SHEET = "Settings";

const DEFAULT_BROADCAST =
  "📢 PENGUMUMAN TUTOR: Mohon lakukan serah terima uang titipan pembayaran siswa kepada Staf Administrasi dan catat riwayat pertemuan secara tertib. Terima kasih!";

const DEFAULT_ADMIN_PASSWORD = "Rumahbelajar01";

// Nama folder Google Drive tempat menyimpan foto jurnal kehadiran.
const DRIVE_FOLDER_NAME = "Rumah Belajar - Foto Jurnal";


/*******************************************************
 * DEFINISI KOLEKSI -> SHEET
 *
 * "sheet"    = nama tab di Spreadsheet (boleh diganti sesukanya,
 *              tinggal sesuaikan di sini).
 * "columns"  = urutan kolom default yang dibuat pertama kali.
 *              Kalau Anda menambah kolom baru manual di Sheets,
 *              kolom itu akan otomatis ikut terbawa juga.
 *
 * CATATAN: studentLedger, tutorLedger, dan kas SENGAJA tidak
 * disimpan di sini karena itu adalah data HASIL HITUNGAN
 * (dihitung ulang otomatis oleh aplikasi dari sessions, payments,
 * slips, otherIncomes & expenses). Mengedit sheet-sheet itu
 * manual tidak akan berpengaruh karena akan ditimpa ulang oleh
 * hasil perhitungan aplikasi.
 *******************************************************/

const COLLECTIONS = {
  programs: {
    sheet: "Programs",
    columns: ["id", "nama", "jenjang", "mapel", "durasi", "tarifSiswa", "honorTutor", "status", "deskripsi"]
  },
  students: {
    sheet: "Students",
    columns: ["id", "nama", "programId", "status", "teleponOrangTua", "alamat", "tanggalDaftar"]
  },
  tutors: {
    sheet: "Tutors",
    columns: ["id", "nama", "idLogin", "password", "status", "telepon", "alamat", "tanggalBergabung"]
  },
  sessions: {
    sheet: "Sessions",
    columns: ["id", "tanggal", "siswaId", "siswaNama", "tutorId", "tutorNama", "programId", "programNama", "tarifSiswaSnapshot", "honorTutorSnapshot", "catatan", "lastUpdated"]
  },
  payments: {
    sheet: "Payments",
    columns: ["id", "tanggal", "siswaId", "siswaNama", "jumlah", "metode", "tutorId", "tutorNama", "statusTitipan", "tanggalSerah", "lastUpdated"]
  },
  slips: {
    sheet: "Slips",
    columns: ["id", "tanggal", "tutorId", "tutorNama", "jumlah", "periode", "catatan", "potongan", "keteranganPotongan", "totalHonor", "lastUpdated"]
  },
  otherIncomes: {
    sheet: "OtherIncomes",
    columns: ["id", "tanggal", "sumber", "keterangan", "jumlah", "metode", "jenis", "nominal", "lastUpdated"]
  },
  expenses: {
    sheet: "Expenses",
    columns: ["id", "tanggal", "keterangan", "jumlah"]
  },
  attendanceReports: {
    sheet: "AttendanceReports",
    columns: ["id", "tanggal", "tutorId", "tutorNama", "siswaId", "siswaNama", "programId", "programNama", "fotoJurnal", "keterangan", "status", "catatanAdmin", "tanggalProses", "lastUpdated"]
  },
  schedules: {
    sheet: "Schedules",
    columns: ["id", "tanggal", "hari", "waktu", "jamMulai", "jamSelesai", "tutorId", "tutorNama", "siswaId", "siswaNama", "programId", "programNama", "status", "catatan", "lastUpdated"]
  },
  raports: {
    sheet: "Raports",
    columns: ["id", "siswaId", "siswaNama", "programId", "programNama", "periode", "nilai", "predikat", "catatan", "createdAt", "updatedAt", "lastUpdated"]
  }
};

// Koleksi yang dihitung otomatis oleh aplikasi (jangan diedit manual).
const COMPUTED_COLLECTIONS = ["studentLedger", "tutorLedger", "kas"];

const ALL_COLLECTION_KEYS = Object.keys(COLLECTIONS);


/*******************************************************
 * ENTRY POINT GET
 *******************************************************/

function doGet(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const action =
      e && e.parameter && e.parameter.action
        ? String(e.parameter.action)
        : "get";

    if (action === "health") {
      const ss = getSpreadsheet();

      return jsonResponse({
        success: true,
        message: "Rumah Belajar API aktif",
        version: DB_VERSION,
        spreadsheetName: ss.getName(),
        spreadsheetId: ss.getId(),
        timestamp: new Date().toISOString()
      });
    }

    if (action === "get") {
      const db = loadDatabase();

      return jsonResponse({
        success: true,
        data: db,
        lastUpdated: db.lastUpdated,
        serverTime: new Date().toISOString()
      });
    }

    // Endpoint RINGAN: hanya kembalikan cap waktu terakhir update
    // (satu baris kecil di sheet Settings), TANPA membaca seluruh
    // sheet database. Dipakai untuk polling berkala yang hemat
    // kuota & bandwidth (lihat subscribeToDatabaseChanges di frontend).
    if (action === "meta") {
      const settings = readSettings();

      return jsonResponse({
        success: true,
        lastUpdated: settings.lastUpdated,
        serverTime: new Date().toISOString()
      });
    }

    return jsonResponse({
      success: false,
      error: "Action GET tidak dikenal: " + action
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: errorToString(error)
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}


/*******************************************************
 * ENTRY POINT POST
 *******************************************************/

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const body = parseRequestBody(e);

    if (!body) {
      return jsonResponse({ success: false, error: "Request body kosong" });
    }

    const action = String(body.action || "save");

    // ---------------------------------------------------
    // GET / HEALTH (lewat POST, untuk kompatibilitas CORS)
    // ---------------------------------------------------

    if (action === "get") {
      const db = loadDatabase();
      return jsonResponse({
        success: true,
        data: db,
        lastUpdated: db.lastUpdated
      });
    }

    if (action === "ping" || action === "health") {
      return jsonResponse({
        success: true,
        message: "Rumah Belajar API aktif",
        timestamp: new Date().toISOString()
      });
    }

    // Endpoint RINGAN: hanya cap waktu terakhir update, dipakai untuk
    // polling hemat bandwidth. Lihat juga action=meta di doGet.
    if (action === "meta") {
      const settings = readSettings();
      return jsonResponse({
        success: true,
        lastUpdated: settings.lastUpdated
      });
    }

    // ---------------------------------------------------
    // INITIALIZE / REPAIR
    // ---------------------------------------------------

    if (action === "initialize" || action === "repair") {
      ALL_COLLECTION_KEYS.forEach(function (key) {
        getOrCreateCollectionSheet(key);
      });
      getOrCreateSettingsSheet();

      const db = loadDatabase();

      return jsonResponse({
        success: true,
        data: db,
        lastUpdated: db.lastUpdated,
        message: "Semua sheet database sudah disiapkan."
      });
    }

    // ---------------------------------------------------
    // UPLOAD / SIMPAN DATABASE ("harus bisa upload")
    // ---------------------------------------------------
    //
    // Kirim seluruh objek database (bisa berisi sebagian
    // koleksi saja). Setiap koleksi akan di-UPSERT (data
    // dengan id yang sudah ada akan diperbarui, id baru
    // akan ditambahkan). Baris yang ada di Spreadsheet tapi
    // TIDAK ada di data yang dikirim akan TETAP DIBIARKAN,
    // supaya edit manual langsung di Spreadsheet tidak hilang.

    if (action === "save" || action === "upload" || action === "sync") {
      if (!body.data || typeof body.data !== "object") {
        throw new Error("Data database tidak ditemukan.");
      }

      const incoming = body.data;

      ALL_COLLECTION_KEYS.forEach(function (key) {
        if (Array.isArray(incoming[key])) {
          upsertCollection(key, incoming[key]);
        }
      });

      if (typeof incoming.broadcastMessage === "string" || typeof incoming.adminPassword === "string") {
        saveSettings({
          broadcastMessage: incoming.broadcastMessage,
          adminPassword: incoming.adminPassword
        });
      }

      const saved = loadDatabase();

      return jsonResponse({
        success: true,
        data: saved,
        lastUpdated: saved.lastUpdated,
        serverTime: new Date().toISOString(),
        message: "Database berhasil diunggah ke Google Spreadsheet."
      });
    }

    // ---------------------------------------------------
    // UPSERT SATU RECORD SAJA (opsional, lebih ringan
    // daripada mengirim seluruh database)
    // ---------------------------------------------------

    if (action === "upsertOne") {
      const collection = String(body.collection || "");
      const item = body.item;

      if (ALL_COLLECTION_KEYS.indexOf(collection) === -1) {
        throw new Error("Collection tidak dikenal: " + collection);
      }
      if (!item || typeof item !== "object" || !item.id) {
        throw new Error("Data record tidak valid (wajib punya id).");
      }

      upsertCollection(collection, [item]);

      // RINGAN: hanya baca ulang 1 sheet (koleksi yang baru saja
      // diubah) untuk mengambil nilai final baris tsb (misalnya foto
      // jurnal yang sudah dikonversi jadi link Google Drive),
      // BUKAN loadDatabase() yang membaca SEMUA sheet.
      const savedRows = readCollection(collection);
      const savedItem = savedRows.filter(function (r) {
        return String(r.id) === String(item.id);
      })[0] || item;

      const lastUpdated = touchLastUpdated();

      return jsonResponse({
        success: true,
        collection: collection,
        item: savedItem,
        lastUpdated: lastUpdated
      });
    }

    // ---------------------------------------------------
    // UPSERT BEBERAPA RECORD SEKALIGUS DARI BEBERAPA KOLEKSI
    // (dipakai frontend untuk mengirim HANYA data yang benar-benar
    // berubah, bukan seluruh database)
    // ---------------------------------------------------

    if (action === "upsertBatch") {
      const changes = body.changes && typeof body.changes === "object" ? body.changes : {};
      const deletions = body.deletions && typeof body.deletions === "object" ? body.deletions : {};
      const resultItems = {};

      Object.keys(changes).forEach(function (collection) {
        if (ALL_COLLECTION_KEYS.indexOf(collection) === -1) return;
        const items = Array.isArray(changes[collection]) ? changes[collection] : [];
        if (items.length === 0) return;

        upsertCollection(collection, items);

        const savedRows = readCollection(collection);
        const ids = items.map(function (it) { return String(it.id); });
        resultItems[collection] = savedRows.filter(function (r) {
          return ids.indexOf(String(r.id)) !== -1;
        });
      });

      Object.keys(deletions).forEach(function (collection) {
        if (ALL_COLLECTION_KEYS.indexOf(collection) === -1) return;
        const ids = Array.isArray(deletions[collection]) ? deletions[collection] : [];
        ids.forEach(function (id) {
          if (id) deleteRowById(collection, String(id));
        });
      });

      if (body.settings && typeof body.settings === "object") {
        saveSettings(body.settings);
      }

      const lastUpdated = touchLastUpdated();

      return jsonResponse({
        success: true,
        items: resultItems,
        lastUpdated: lastUpdated
      });
    }

    // ---------------------------------------------------
    // SIMPAN PENGATURAN SAJA (broadcast / password admin)
    // TANPA mengirim ulang seluruh database.
    // ---------------------------------------------------

    if (action === "saveSettings") {
      const saved = saveSettings({
        broadcastMessage: body.broadcastMessage,
        adminPassword: body.adminPassword
      });

      return jsonResponse({
        success: true,
        broadcastMessage: saved.broadcastMessage,
        lastUpdated: saved.lastUpdated
      });
    }

    // ---------------------------------------------------
    // AMBIL DATA ("harus bisa ambil data") -> pakai action=get di atas
    // ---------------------------------------------------

    // ---------------------------------------------------
    // HAPUS DATA ("harus bisa hapus")
    // ---------------------------------------------------

    if (action === "delete") {
      const collection = String(body.collection || "");
      const id = String(body.id || "");

      if (!collection) throw new Error("Collection wajib diisi.");
      if (!id) throw new Error("ID wajib diisi.");
      if (ALL_COLLECTION_KEYS.indexOf(collection) === -1) {
        throw new Error("Collection tidak dikenal: " + collection);
      }

      deleteRowById(collection, id);

      const lastUpdated = touchLastUpdated();

      return jsonResponse({
        success: true,
        deletedId: id,
        collection: collection,
        lastUpdated: lastUpdated
      });
    }

    if (action === "deleteAttendance") {
      const id = String(body.id || "");
      if (!id) throw new Error("ID attendance wajib diisi.");

      deleteAttendanceCascade(id);

      const lastUpdated = touchLastUpdated();

      return jsonResponse({
        success: true,
        deletedId: id,
        lastUpdated: lastUpdated
      });
    }

    return jsonResponse({
      success: false,
      error: "Action POST tidak dikenal: " + action
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: errorToString(error)
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}


/*******************************************************
 * SPREADSHEET HELPERS
 *******************************************************/

function getSpreadsheet() {
  if (SPREADSHEET_ID && String(SPREADSHEET_ID).trim() !== "") {
    return SpreadsheetApp.openById(String(SPREADSHEET_ID).trim());
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("Spreadsheet tidak ditemukan. Isi SPREADSHEET_ID pada Code.gs.");
  }
  return active;
}

function getOrCreateCollectionSheet(collectionKey) {
  const def = COLLECTIONS[collectionKey];
  if (!def) throw new Error("Collection tidak dikenal: " + collectionKey);

  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(def.sheet);

  if (!sheet) {
    sheet = ss.insertSheet(def.sheet);
    sheet.getRange(1, 1, 1, def.columns.length).setValues([def.columns]);
    sheet.setFrozenRows(1);
    return sheet;
  }

  // Kalau sheet sudah ada tapi masih kosong (belum ada header), tulis header.
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, def.columns.length).setValues([def.columns]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function getOrCreateSettingsSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SETTINGS_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS_SHEET);
    sheet.getRange(1, 1, 1, 2).setValues([["key", "value"]]);
    sheet.setFrozenRows(1);
    sheet.getRange(2, 1, 2, 2).setValues([
      ["broadcastMessage", DEFAULT_BROADCAST],
      ["adminPassword", DEFAULT_ADMIN_PASSWORD]
    ]);
  }

  return sheet;
}


/*******************************************************
 * BACA HEADER SHEET (kolom bisa bertambah manual)
 *******************************************************/

function getSheetHeaders(sheet, fallbackColumns) {
  const lastCol = sheet.getLastColumn();

  if (lastCol < 1) {
    return fallbackColumns.slice();
  }

  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const headers = headerRow
    .map(function (h) { return String(h || "").trim(); })
    .filter(function (h) { return h !== ""; });

  if (headers.length === 0) {
    return fallbackColumns.slice();
  }

  // Pastikan semua kolom default ikut ada (kalau baris header
  // pernah tertimpa manual sebagian), lalu tambahkan kolom ekstra
  // yang mungkin ditambahkan user secara manual di Spreadsheet.
  const merged = fallbackColumns.slice();
  headers.forEach(function (h) {
    if (merged.indexOf(h) === -1) merged.push(h);
  });

  return merged;
}


/*******************************************************
 * SHEET -> ARRAY OF OBJECTS
 *******************************************************/

function readCollection(collectionKey) {
  const def = COLLECTIONS[collectionKey];
  const sheet = getOrCreateCollectionSheet(collectionKey);

  const headers = getSheetHeaders(sheet, def.columns);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const results = [];

  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    const hasId = row[headers.indexOf("id")];

    if (hasId === "" || hasId === null || typeof hasId === "undefined") {
      continue; // lewati baris kosong
    }

    const obj = {};
    headers.forEach(function (col, i) {
      obj[col] = normalizeCellValue(row[i]);
    });

    results.push(obj);
  }

  return results;
}

function normalizeCellValue(value) {
  if (value instanceof Date) {
    // Kolom bertipe tanggal murni (yyyy-MM-dd) disimpan sebagai teks
    // supaya konsisten, tapi kalau user mengetik/format sebagai Date
    // di Sheets, kita ubah balik ke format yyyy-MM-dd.
    return Utilities.formatDate(value, Session.getScriptTimeZone() || "GMT+7", "yyyy-MM-dd");
  }
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  return String(value);
}


/*******************************************************
 * ARRAY OF OBJECTS -> UPSERT KE SHEET
 *******************************************************/

function upsertCollection(collectionKey, items) {
  const def = COLLECTIONS[collectionKey];
  const sheet = getOrCreateCollectionSheet(collectionKey);

  // Kumpulkan semua kolom tambahan yang mungkin dibawa oleh data masuk.
  let headers = getSheetHeaders(sheet, def.columns);
  items.forEach(function (item) {
    Object.keys(item || {}).forEach(function (k) {
      if (headers.indexOf(k) === -1) headers.push(k);
    });
  });

  // Tulis ulang header kalau ada kolom baru.
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const idCol = headers.indexOf("id");
  const lastRow = sheet.getLastRow();
  const prevColCount = sheet.getLastColumn();

  // Baca data lama dengan lebar kolom LAMA, lalu pad ke lebar header
  // BARU (kalau ada kolom baru yang baru saja ditambahkan di atas),
  // supaya semua baris punya panjang array yang sama saat ditulis balik.
  let existingRows = [];
  if (lastRow >= 2 && prevColCount >= 1) {
    existingRows = sheet.getRange(2, 1, lastRow - 1, prevColCount).getValues();
  }
  existingRows = existingRows.map(function (row) {
    const padded = row.slice();
    while (padded.length < headers.length) padded.push("");
    return padded;
  });

  const idToRowIndex = {}; // id -> index di existingRows
  existingRows.forEach(function (row, idx) {
    const id = String(row[idCol] || "");
    if (id) idToRowIndex[id] = idx;
  });

  items.forEach(function (item) {
    if (!item || !item.id) return;

    const id = String(item.id);
    const rowValues = headers.map(function (col) {
      const v = item[col];
      return typeof v === "undefined" || v === null ? "" : v;
    });

    if (Object.prototype.hasOwnProperty.call(idToRowIndex, id)) {
      existingRows[idToRowIndex[id]] = rowValues;
    } else {
      idToRowIndex[id] = existingRows.length;
      existingRows.push(rowValues);
    }
  });

  // Foto jurnal (base64) -> upload ke Drive supaya sel tidak kepenuhan.
  if (collectionKey === "attendanceReports") {
    const fotoCol = headers.indexOf("fotoJurnal");
    if (fotoCol !== -1) {
      for (let r = 0; r < existingRows.length; r++) {
        existingRows[r][fotoCol] = offloadPhotoIfNeeded(existingRows[r][fotoCol]);
      }
    }
  }

  if (existingRows.length > 0) {
    sheet.getRange(2, 1, existingRows.length, headers.length).setValues(existingRows);
  }

  touchLastUpdated();
}


/*******************************************************
 * HAPUS 1 BARIS BERDASARKAN ID
 *******************************************************/

function deleteRowById(collectionKey, id) {
  const def = COLLECTIONS[collectionKey];
  const sheet = getOrCreateCollectionSheet(collectionKey);
  const headers = getSheetHeaders(sheet, def.columns);
  const idCol = headers.indexOf("id");

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const targetId = String(id);

  for (let r = values.length - 1; r >= 0; r--) {
    if (String(values[r][idCol] || "") === targetId) {
      sheet.deleteRow(r + 2); // +2 karena baris 1 = header, index dimulai dari 0
    }
  }

  touchLastUpdated();
}

function deleteAttendanceCascade(reportId) {
  const reports = readCollection("attendanceReports");
  const report = reports.find(function (r) { return String(r.id) === String(reportId); });

  deleteRowById("attendanceReports", reportId);

  if (!report || report.status !== "setuju") return;

  // Hapus juga sesi yang otomatis dibuat dari verifikasi laporan ini.
  const sessions = readCollection("sessions");
  const marker = "Verifikasi LPK [" + report.id + "]";

  sessions.forEach(function (s) {
    const sameCombo =
      String(s.tanggal) === String(report.tanggal) &&
      String(s.tutorId) === String(report.tutorId) &&
      String(s.siswaId) === String(report.siswaId) &&
      String(s.programId) === String(report.programId);

    const generated = String(s.catatan || "").indexOf(marker) !== -1;

    if (sameCombo && generated) {
      deleteRowById("sessions", s.id);
    }
  });
}


/*******************************************************
 * SETTINGS (broadcastMessage, adminPassword)
 *******************************************************/

function readSettings() {
  const sheet = getOrCreateSettingsSheet();
  const lastRow = sheet.getLastRow();

  const result = {
    broadcastMessage: DEFAULT_BROADCAST,
    adminPassword: DEFAULT_ADMIN_PASSWORD,
    lastUpdated: new Date().toISOString()
  };

  if (lastRow < 2) return result;

  const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  values.forEach(function (row) {
    const key = String(row[0] || "").trim();
    const value = row[1];
    if (!key) return;
    result[key] = value === "" || value === null || typeof value === "undefined"
      ? result[key]
      : String(value);
  });

  return result;
}

function saveSettings(partial) {
  const sheet = getOrCreateSettingsSheet();
  const current = readSettings();

  const next = {
    broadcastMessage:
      typeof partial.broadcastMessage === "string" && partial.broadcastMessage !== ""
        ? partial.broadcastMessage
        : current.broadcastMessage,
    adminPassword:
      typeof partial.adminPassword === "string" && partial.adminPassword !== ""
        ? partial.adminPassword
        : current.adminPassword,
    lastUpdated: new Date().toISOString()
  };

  sheet.getRange(2, 1, 3, 2).setValues([
    ["broadcastMessage", next.broadcastMessage],
    ["adminPassword", next.adminPassword],
    ["lastUpdated", next.lastUpdated]
  ]);

  touchLastUpdated();

  return next;
}

function touchLastUpdated() {
  const stamp = new Date().toISOString();
  try {
    const sheet = getOrCreateSettingsSheet();
    sheet.getRange(4, 1, 1, 2).setValues([["lastUpdated", stamp]]);
  } catch (_) {
    // abaikan
  }
  return stamp;
}


/*******************************************************
 * MUAT SELURUH DATABASE (semua sheet -> 1 objek JSON)
 *
 * Ledger (studentLedger, tutorLedger, kas) sengaja dikirim
 * kosong karena akan dihitung ulang otomatis oleh aplikasi
 * dari sessions, payments, slips, otherIncomes & expenses.
 *******************************************************/

function loadDatabase() {
  const db = {
    __version: DB_VERSION,
    deletedIds: []
  };

  ALL_COLLECTION_KEYS.forEach(function (key) {
    db[key] = readCollection(key);
  });

  COMPUTED_COLLECTIONS.forEach(function (key) {
    db[key] = [];
  });

  const settings = readSettings();
  db.broadcastMessage = settings.broadcastMessage;
  db.adminPassword = settings.adminPassword;
  db.lastUpdated = settings.lastUpdated || new Date().toISOString();

  return db;
}


/*******************************************************
 * UPLOAD FOTO JURNAL (base64) KE GOOGLE DRIVE
 *******************************************************/

function offloadPhotoIfNeeded(value) {
  const text = String(value || "");

  if (text.indexOf("data:") !== 0) {
    return value; // sudah berupa URL / kosong, biarkan
  }

  try {
    const match = text.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) return value;

    const mimeType = match[1];
    const base64Data = match[2];
    const bytes = Utilities.base64Decode(base64Data);
    const extension = mimeType.split("/")[1] || "jpg";

    const blob = Utilities.newBlob(bytes, mimeType, "jurnal-" + Date.now() + "." + extension);

    const folder = getOrCreateDriveFolder();
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return "https://drive.google.com/uc?export=view&id=" + file.getId();
  } catch (error) {
    // Kalau upload ke Drive gagal, jangan sampai seluruh proses simpan gagal.
    // Biarkan data base64 apa adanya (mungkin akan gagal ditulis kalau
    // terlalu besar, tapi tidak menghentikan record lain).
    Logger.log("Gagal upload foto ke Drive: " + errorToString(error));
    return value;
  }
}

function getOrCreateDriveFolder() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty("PHOTO_FOLDER_ID");

  if (savedId) {
    try {
      return DriveApp.getFolderById(savedId);
    } catch (_) {
      // folder mungkin sudah dihapus manual, buat lagi di bawah
    }
  }

  const iterator = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  const folder = iterator.hasNext() ? iterator.next() : DriveApp.createFolder(DRIVE_FOLDER_NAME);

  props.setProperty("PHOTO_FOLDER_ID", folder.getId());
  return folder;
}


/*******************************************************
 * UTILITAS
 *******************************************************/

function parseRequestBody(e) {
  if (!e) return null;
  let raw = "";
  if (e.postData && e.postData.contents) {
    raw = e.postData.contents;
  }
  if (!raw && e.parameter && e.parameter.data) {
    raw = e.parameter.data;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error("JSON request tidak valid: " + errorToString(error));
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorToString(error) {
  if (!error) return "Unknown error";
  if (error.message) return String(error.message);
  return String(error);
}


/*******************************************************
 * FUNGSI MANUAL (jalankan dari editor Apps Script)
 *******************************************************/

function initializeDatabase() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    ALL_COLLECTION_KEYS.forEach(function (key) {
      getOrCreateCollectionSheet(key);
    });
    getOrCreateSettingsSheet();
    Logger.log("Semua sheet database Rumah Belajar sudah disiapkan.");
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function testDatabase() {
  const db = loadDatabase();
  Logger.log(JSON.stringify(db, null, 2));
  return db;
}

function testApiHealth() {
  const ss = getSpreadsheet();
  const result = {
    success: true,
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    timestamp: new Date().toISOString()
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function fixAdminPassword() {
  const saved = saveSettings({ adminPassword: DEFAULT_ADMIN_PASSWORD });
  Logger.log("ADMIN PASSWORD = " + saved.adminPassword);
  return saved;
}
