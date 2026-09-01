import {
  ProgramBelajar,
  Siswa,
  Tutor,
  RiwayatPertemuan,
  TransaksiRekeningSiswa,
  PembayaranSiswa,
  TransaksiHonorTutor,
  SlipGaji,
  KasLembaga,
  PemasukanLain,
  LaporanKehadiran,
  JadwalTutor,
  RaportSiswa
} from "../types";


/* =========================================================
   TYPES
========================================================= */

export type ProgramRecord = ProgramBelajar & {
  deskripsi?: string;
};

export type TutorRecord = Tutor & {
  idLogin: string;
  status?: string;
  telepon?: string;
  alamat?: string;
};

export type KasRecord = KasLembaga & {
  referensiId?: string;
};

export type OtherIncomeRecord = PemasukanLain & {
  jenis?: string;
  nominal?: number;
};

export type ExpenseRecord = {
  id: string;
  tanggal: string;
  keterangan: string;
  jumlah: number;
};

export type ScheduleRecord = JadwalTutor & {
  waktu?: string;
  hari: string;
  tutorId: string;
  siswaId: string;
  programId: string;
};

export type AttendanceRecord = LaporanKehadiran & {
  status?:
    | "pending"
    | "setuju"
    | "tolak"
    | "disetujui"
    | "ditolak"
    | "diproses";
  catatanAdmin?: string;
  tanggalProses?: string;
};

export interface Database {
  programs: ProgramRecord[];
  students: Siswa[];
  tutors: TutorRecord[];

  sessions: RiwayatPertemuan[];
  payments: PembayaranSiswa[];
  slips: SlipGaji[];

  otherIncomes: OtherIncomeRecord[];
  expenses: ExpenseRecord[];

  attendanceReports: AttendanceRecord[];
  schedules: ScheduleRecord[];
  raports: RaportSiswa[];

  studentLedger: TransaksiRekeningSiswa[];
  tutorLedger: TransaksiHonorTutor[];
  kas: KasRecord[];

  broadcastMessage: string;
  adminPassword?: string;

  lastUpdated: string;

  deletedIds: string[];
}

/* =========================================================
   CONSTANT
========================================================= */

export const DB_STORAGE_KEY = "rumah_belajar_db_v2";

const DEFAULT_BROADCAST =
  "📢 PENGUMUMAN TUTOR: Mohon lakukan serah terima uang titipan pembayaran siswa kepada Staf Administrasi dan catat riwayat pertemuan secara tertib. Terima kasih!";

/* =========================================================
   FORMATTER
========================================================= */

const BULAN_INDO = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember"
];

/* =========================================================
   ID
========================================================= */

export function generateUniqueId(prefix: string): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random()
    .toString(36)
    .slice(2, 10)
    .toUpperCase();

  return `${prefix}-${time}-${random}`;
}

/* =========================================================
   RUPIAH
========================================================= */

export function formatRupiah(value: number): string {
  return (
    "Rp " +
    new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Number(value) || 0)
  );
}

/* =========================================================
   DATE FORMAT
========================================================= */

export function formatTanggalIndo(dateStr: string): string {
  if (!dateStr) return "-";

  const parts = dateStr.split("-");

  if (parts.length !== 3) return dateStr;

  return `${parts[2].padStart(2, "0")}/${parts[1].padStart(
    2,
    "0"
  )}/${parts[0]}`;
}

export function formatBulanTahun(dateStr: string): string {
  if (!dateStr) return "-";

  const parts = dateStr.split("-");

  if (parts.length >= 2) {
    const monthIndex = parseInt(parts[1], 10) - 1;

    return `${BULAN_INDO[monthIndex] || parts[1]} ${parts[0]}`;
  }

  return dateStr;
}

export function getTodayDateString(): string {
  const d = new Date();

  const tzOffset = d.getTimezoneOffset() * 60000;

  return new Date(d.getTime() - tzOffset)
    .toISOString()
    .slice(0, 10);
}

/* =========================================================
   HELPERS
========================================================= */

function amount(value: unknown): number {
  const n = Number(value);

  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" &&
          value.trim() !== ""
      )
    )
  );
}

function cloneDatabase(db: Database): Database {
  return {
    ...db,

    programs: [...(db.programs || [])],
    students: [...(db.students || [])],
    tutors: [...(db.tutors || [])],

    sessions: [...(db.sessions || [])],
    payments: [...(db.payments || [])],
    slips: [...(db.slips || [])],

    otherIncomes: [...(db.otherIncomes || [])],
    expenses: [...(db.expenses || [])],

    attendanceReports: [
      ...(db.attendanceReports || [])
    ],

    schedules: [...(db.schedules || [])],
    raports: [...(db.raports || [])],

    studentLedger: [...(db.studentLedger || [])],
    tutorLedger: [...(db.tutorLedger || [])],
    kas: [...(db.kas || [])],

    deletedIds: [...(db.deletedIds || [])]
  };
}


/* =========================================================
   SAVE HELPER
   GOOGLE SPREADSHEET MIGRATION
========================================================= */

function saveAndReturn(db: Database): Database {
  const normalized = ensureDatabaseDefaults(db);

  safeSetItem(
    DB_STORAGE_KEY,
    JSON.stringify(normalized)
  );

  return normalized;
}

/* =========================================================
   SAFE LOCAL STORAGE
========================================================= */

export function safeGetItem(
  key: string
): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(
      "[DB] localStorage get gagal:",
      error
    );

    return null;
  }
}

export function safeSetItem(
  key: string,
  value: string
): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(
      "[DB] localStorage set gagal:",
      error
    );
  }
}

/* =========================================================
   EMPTY DATABASE
========================================================= */

export function generateCleanDatabase(): Database {
  return {
    programs: [],
    students: [],
    tutors: [], // Akan langsung diisi oleh data dari Google Spreadsheet saat pull pertama kali
    sessions: [],
    payments: [],
    slips: [],
    otherIncomes: [],
    expenses: [],
    attendanceReports: [],
    schedules: [],
    raports: [],
    studentLedger: [],
    tutorLedger: [],
    kas: [],
    broadcastMessage: DEFAULT_BROADCAST,

    // Pertahankan password admin default
    adminPassword: "Rumahbelajar01",

    lastUpdated: new Date().toISOString(),
    deletedIds: []
  };
}

/* =========================================================
   NORMALIZE DATABASE
========================================================= */

export function ensureDatabaseDefaults(parsed: any): Database {
  if (!parsed || typeof parsed !== "object") {
    return generateCleanDatabase();
  }

  return {
    programs: Array.isArray(parsed.programs) ? parsed.programs : [],
    students: Array.isArray(parsed.students) ? parsed.students : [],
    tutors: Array.isArray(parsed.tutors) ? parsed.tutors : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    payments: Array.isArray(parsed.payments) ? parsed.payments : [],
    slips: Array.isArray(parsed.slips) ? parsed.slips : [],
    otherIncomes: Array.isArray(parsed.otherIncomes)
      ? parsed.otherIncomes
      : [],
    expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    attendanceReports: Array.isArray(parsed.attendanceReports)
      ? parsed.attendanceReports
      : [],
    schedules: Array.isArray(parsed.schedules) ? parsed.schedules : [],
    raports: Array.isArray(parsed.raports) ? parsed.raports : [],

    studentLedger: Array.isArray(parsed.studentLedger)
      ? parsed.studentLedger
      : [],

    tutorLedger: Array.isArray(parsed.tutorLedger)
      ? parsed.tutorLedger
      : [],

    kas: Array.isArray(parsed.kas) ? parsed.kas : [],

    broadcastMessage:
      typeof parsed.broadcastMessage === "string"
        ? parsed.broadcastMessage
        : DEFAULT_BROADCAST,

    adminPassword:
      typeof parsed.adminPassword === "string" &&
      parsed.adminPassword.trim() !== ""
        ? parsed.adminPassword
        : "Rumahbelajar01",

    lastUpdated:
      typeof parsed.lastUpdated === "string"
        ? parsed.lastUpdated
        : new Date().toISOString(),

    deletedIds: Array.isArray(parsed.deletedIds)
      ? uniqueStrings(parsed.deletedIds)
      : []
  };
}

/* =========================================================
   LOCAL DATABASE
========================================================= */

/**
 * Mengambil database dari localStorage.
 *
 * Fungsi ini sengaja dibuat synchronous karena
 * seluruh aplikasi lama menggunakan getDatabase()
 * secara langsung.
 */
export function getDatabase(): Database {
  try {
    const raw = safeGetItem(DB_STORAGE_KEY);

    if (!raw) {
      const clean = generateCleanDatabase();

      safeSetItem(
        DB_STORAGE_KEY,
        JSON.stringify(clean)
      );

      return clean;
    }

    const parsed = JSON.parse(raw);

    return ensureDatabaseDefaults(parsed);
  } catch (error) {
    console.warn(
      "[DB] Gagal membaca database lokal:",
      error
    );

    const clean = generateCleanDatabase();

    safeSetItem(
      DB_STORAGE_KEY,
      JSON.stringify(clean)
    );

    return clean;
  }
}

/* =========================================================
   SAVE DATABASE
========================================================= */

export function saveDatabase(
  db: Database
): void {
  const recalculated =
    recalculateAllLedgers(db);

  saveAndReturn(recalculated);
}

/**
 * Simpan data master tanpa rebuild ledger.
 */
export function saveDatabaseOnly(
  db: Database
): Database {
  const next = cloneDatabase(db);

  next.lastUpdated =
    new Date().toISOString();

  return saveAndReturn(next);
}

export function updateDatabase(
  db: Database
): Database {
  return saveAndReturn(
    recalculateAllLedgers(db)
  );
}

export function getLocalDatabase(): Database {
  return getDatabase();
}

export function saveLocalDatabase(
  db: Database
): void {
  saveDatabase(
    recalculateAllLedgers(db)
  );
}

export function clearPrototypeData(
  currentDb?: Database
): Database {
  const clean =
    generateCleanDatabase();

  clean.broadcastMessage =
    currentDb?.broadcastMessage ||
    DEFAULT_BROADCAST;

    if (currentDb?.adminPassword) {
      clean.adminPassword = currentDb.adminPassword;
    }

  return saveAndReturn(clean);
}

/* =========================================================
   SESSION DUPLICATE
========================================================= */

export function checkDuplicateSession(
  db: Database,
  data: {
    tanggal: string;
    siswaId: string;
    tutorId: string;
    programId?: string;
  }
): boolean {
  return db.sessions.some(
    (session) =>
      session.tanggal === data.tanggal &&
      session.siswaId === data.siswaId &&
      session.tutorId === data.tutorId &&
      (!data.programId ||
        session.programId === data.programId)
  );
}

/* =========================================================
   ADD SESSION
========================================================= */

export function addSessionTransaction(
  db: Database,
  data: {
    tanggal: string;
    siswaId: string;
    tutorId: string;
    programId: string;
    catatan?: string;
  }
): Database {
  const next = cloneDatabase(db);

  const student = next.students.find(
    (s) => s.id === data.siswaId
  );

  const tutor = next.tutors.find(
    (t) => t.id === data.tutorId
  );

  const program = next.programs.find(
    (p) => p.id === data.programId
  );

  if (!student || !tutor || !program) {
    throw new Error(
      "Data siswa, tutor, atau program tidak ditemukan."
    );
  }

  if (
    checkDuplicateSession(
      next,
      data
    )
  ) {
    throw new Error(
      "Sesi untuk tutor, siswa, program, dan tanggal tersebut sudah ada."
    );
  }

  const sessionId =
    generateUniqueId("RP");

  next.sessions.unshift({
    id: sessionId,

    tanggal: data.tanggal,

    siswaId: student.id,
    siswaNama: student.nama,

    tutorId: tutor.id,
    tutorNama: tutor.nama,

    programId: program.id,
    programNama: program.nama,

    tarifSiswaSnapshot:
      amount(program.tarifSiswa),

    honorTutorSnapshot:
      amount(program.honorTutor),

    catatan:
      data.catatan ||
      `Sesi pembelajaran ${program.nama}`
  });

  if (!student.programId) {
    next.students =
      next.students.map((s) =>
        s.id === student.id
          ? {
              ...s,
              programId: program.id
            }
          : s
      );
  }

  return saveAndReturn(
    recalculateAllLedgers(next)
  );
}

/* =========================================================
   PAYMENT
========================================================= */

export function addPaymentTransaction(
  db: Database,
  data: {
    tanggal: string;
    siswaId: string;
    jumlah: number;
    metode: "admin" | "tutor";
    tutorId?: string;
  }
): Database {
  const next = cloneDatabase(db);

  const student =
    next.students.find(
      (s) => s.id === data.siswaId
    );

  if (!student) {
    throw new Error(
      "Siswa tidak ditemukan."
    );
  }

  const jumlah =
    amount(data.jumlah);

  if (jumlah <= 0) {
    throw new Error(
      "Nominal pembayaran harus lebih dari 0."
    );
  }

  if (
    data.metode === "tutor" &&
    !data.tutorId
  ) {
    throw new Error(
      "Tutor wajib dipilih."
    );
  }

  const tutor =
    data.tutorId
      ? next.tutors.find(
          (t) => t.id === data.tutorId
        )
      : undefined;

  if (
    data.metode === "tutor" &&
    !tutor
  ) {
    throw new Error(
      "Tutor tidak ditemukan."
    );
  }

  next.payments.unshift({
    id: generateUniqueId("PAY"),

    tanggal: data.tanggal,

    siswaId: student.id,
    siswaNama: student.nama,

    jumlah,

    metode: data.metode,

    tutorId: data.tutorId,

    tutorNama: tutor?.nama,

    statusTitipan:
      data.metode === "tutor"
        ? "pending"
        : "diserahkan",

    tanggalSerah:
      data.metode === "admin"
        ? data.tanggal
        : undefined
  });

  return saveAndReturn(
    recalculateAllLedgers(next)
  );
}

/* =========================================================
   TUTOR DEPOSIT
========================================================= */

export function getTutorDepositBalance(
  db: Database,
  tutorId: string
): number {
  return db.payments
    .filter(
      (p) =>
        p.metode === "tutor" &&
        p.tutorId === tutorId &&
        p.statusTitipan === "pending"
    )
    .reduce(
      (total, p) =>
        total + amount(p.jumlah),
      0
    );
}

export function confirmTutorDepositHandover(
  db: Database,
  paymentId: string,
  tanggalSerah: string
): Database {
  const next = cloneDatabase(db);

  const index =
    next.payments.findIndex(
      (p) => p.id === paymentId
    );

  if (index === -1) return db;

  const payment =
    next.payments[index];

  if (
    payment.metode !== "tutor" ||
    payment.statusTitipan === "diserahkan"
  ) {
    return db;
  }

  next.payments[index] = {
    ...payment,

    statusTitipan: "diserahkan",

    tanggalSerah
  };

  return saveAndReturn(
    recalculateAllLedgers(next)
  );
}

export function undoTutorDepositHandover(
  db: Database,
  paymentId: string
): Database {
  const next = cloneDatabase(db);

  const index =
    next.payments.findIndex(
      (p) => p.id === paymentId
    );

  if (index === -1) return db;

  const payment =
    next.payments[index];

  if (
    payment.metode !== "tutor" ||
    payment.statusTitipan !== "diserahkan"
  ) {
    return db;
  }

  next.payments[index] = {
    ...payment,

    statusTitipan: "pending",

    tanggalSerah: undefined
  };

  return saveAndReturn(
    recalculateAllLedgers(next)
  );
}

/* =========================================================
   PAY TUTOR HONOR
========================================================= */

export function payTutorHonorTransaction(
  db: Database,
  data: {
    tanggal: string;
    tutorId: string;
    jumlah: number;
    periode: string;
    catatan?: string;
    potongan?: number;
    keteranganPotongan?: string;
  }
): Database {
  const next = cloneDatabase(db);

  const tutor =
    next.tutors.find(
      (t) => t.id === data.tutorId
    );

  if (!tutor) {
    throw new Error(
      "Tutor tidak ditemukan."
    );
  }

  const gross =
    amount(data.jumlah);

  const potongan =
    Math.min(
      gross,
      amount(data.potongan)
    );

  const netPaid =
    gross - potongan;

  if (gross <= 0) {
    throw new Error(
      "Nominal honor harus lebih dari 0."
    );
  }

  next.slips.unshift({
    id: generateUniqueId("SG"),

    tanggal: data.tanggal,

    tutorId: tutor.id,
    tutorNama: tutor.nama,

    jumlah: netPaid,

    periode: data.periode,

    catatan:
      data.catatan ||
      "Pembayaran Honor Tutor",

    potongan,

    keteranganPotongan:
      data.keteranganPotongan || "",

    totalHonor: gross
  });

  return saveAndReturn(
    recalculateAllLedgers(next)
  );
}

/* =========================================================
   GENERAL EXPENSE
========================================================= */

export function addGeneralExpenseTransaction(
  db: Database,
  data: {
    tanggal: string;
    keterangan: string;
    jumlah: number;
  }
): Database {
  const next = cloneDatabase(db);

  const jumlah =
    amount(data.jumlah);

  if (jumlah <= 0) {
    throw new Error(
      "Nominal pengeluaran harus lebih dari 0."
    );
  }

  next.expenses.unshift({
    id: generateUniqueId("EXP"),

    tanggal: data.tanggal,

    keterangan: data.keterangan,

    jumlah
  });

  return saveAndReturn(
    recalculateAllLedgers(next)
  );
}

/* =========================================================
   OTHER INCOME
========================================================= */

export function addOtherIncomeTransaction(
  db: Database,
  data: {
    tanggal: string;
    jenis: string;
    nominal: number;
    keterangan?: string;
  }
): Database {
  const next = cloneDatabase(db);

  const nominal =
    amount(data.nominal);

  if (nominal <= 0) {
    throw new Error(
      "Nominal pemasukan harus lebih dari 0."
    );
  }

  next.otherIncomes.unshift({
    id: generateUniqueId("PML"),

    tanggal: data.tanggal,

    sumber: data.jenis,

    jumlah: nominal,

    jenis: data.jenis,

    nominal,

    keterangan: data.keterangan
  });

  return saveAndReturn(
    recalculateAllLedgers(next)
  );
}

/* =========================================================
   BALANCES
========================================================= */

export function getStudentBalance(
  db: Database,
  studentId: string
): number {
  return db.studentLedger
    .filter(
      (tx) =>
        tx.siswaId === studentId
    )
    .reduce(
      (total, tx) =>
        total +
        (tx.tipe === "debit"
          ? amount(tx.jumlah)
          : -amount(tx.jumlah)),
      0
    );
}

export function getTutorHonorBalance(
  db: Database,
  tutorId: string
): number {
  return db.tutorLedger
    .filter(
      (tx) =>
        tx.tutorId === tutorId
    )
    .reduce(
      (total, tx) =>
        total +
        (tx.tipe === "kredit"
          ? amount(tx.jumlah)
          : -amount(tx.jumlah)),
      0
    );
}

export function getKasLembagaBalance(
  db: Database
): number {
  return db.kas.reduce(
    (total, tx) =>
      total +
      (tx.tipe === "masuk"
        ? amount(tx.jumlah)
        : -amount(tx.jumlah)),
    0
  );
}

/* =========================================================
   DATE FILTER
========================================================= */

export function filterByDateRange<
  T extends { tanggal: string }
>(
  items: T[],
  rangeType:
    | "hari"
    | "minggu"
    | "bulan"
    | "tahun"
    | "custom",
  customStart?: string,
  customEnd?: string,
  baseDate: string =
    getTodayDateString()
): T[] {
  const base =
    new Date(`${baseDate}T00:00:00`);

  let startStr = "";
  let endStr = "";

  const pad = (n: number) =>
    String(n).padStart(2, "0");

  if (rangeType === "hari") {
    startStr = baseDate;
    endStr = baseDate;
  }

  else if (rangeType === "minggu") {
    const day = base.getDay();

    const diff =
      base.getDate() -
      day +
      (day === 0 ? -6 : 1);

    const monday =
      new Date(base);

    monday.setDate(diff);

    const sunday =
      new Date(monday);

    sunday.setDate(
      monday.getDate() + 6
    );

    startStr =
      `${monday.getFullYear()}-${pad(
        monday.getMonth() + 1
      )}-${pad(monday.getDate())}`;

    endStr =
      `${sunday.getFullYear()}-${pad(
        sunday.getMonth() + 1
      )}-${pad(sunday.getDate())}`;
  }

  else if (rangeType === "bulan") {
    const year =
      base.getFullYear();

    const month =
      base.getMonth();

    const lastDay =
      new Date(
        year,
        month + 1,
        0
      ).getDate();

    startStr =
      `${year}-${pad(month + 1)}-01`;

    endStr =
      `${year}-${pad(month + 1)}-${pad(
        lastDay
      )}`;
  }

  else if (rangeType === "tahun") {
    startStr =
      `${base.getFullYear()}-01-01`;

    endStr =
      `${base.getFullYear()}-12-31`;
  }

  else if (rangeType === "custom") {
    if (!customStart || !customEnd) {
      return items;
    }

    startStr = customStart;
    endStr = customEnd;
  }

  else {
    return items;
  }

  return items.filter(
    (item) =>
      item.tanggal >= startStr &&
      item.tanggal <= endStr
  );
}

/* =========================================================
   ATTENDANCE
========================================================= */

export function submitAttendanceReport(
  db: Database,
  data: {
    tanggal: string;
    tutorId: string;
    siswaId: string;
    programId: string;
    fotoJurnal: string;
    keterangan?: string;
  }
): Database {
  const next = cloneDatabase(db);

  const tutor =
    next.tutors.find(
      (t) => t.id === data.tutorId
    );

  const student =
    next.students.find(
      (s) => s.id === data.siswaId
    );

  const program =
    next.programs.find(
      (p) => p.id === data.programId
    );

  if (
    !tutor ||
    !student ||
    !program
  ) {
    throw new Error(
      "Data tutor, siswa, atau program tidak lengkap."
    );
  }

  const duplicate =
    next.attendanceReports.some(
      (r) =>
        r.tanggal === data.tanggal &&
        r.tutorId === data.tutorId &&
        r.siswaId === data.siswaId &&
        r.programId === data.programId &&
        (
          r.status === "pending" ||
          r.status === "diproses"
        )
    );

  if (duplicate) {
    throw new Error(
      "Laporan kehadiran untuk sesi tersebut sudah ada."
    );
  }

  if (
    checkDuplicateSession(
      next,
      {
        tanggal: data.tanggal,
        siswaId: data.siswaId,
        tutorId: data.tutorId,
        programId: data.programId
      }
    )
  ) {
    throw new Error(
      "Sesi untuk tanggal tersebut sudah tercatat."
    );
  }

  next.attendanceReports.unshift({
    id: generateUniqueId("LPK"),

    tanggal: data.tanggal,

    tutorId: tutor.id,
    tutorNama: tutor.nama,

    siswaId: student.id,
    siswaNama: student.nama,

    programId: program.id,
    programNama: program.nama,

    fotoJurnal: data.fotoJurnal,

    keterangan:
      data.keterangan,

    status: "pending"
  });

  next.lastUpdated =
    new Date().toISOString();

  return saveAndReturn(next);
}

/* =========================================================
   VERIFY ATTENDANCE
========================================================= */

export function verifyAttendanceReport(
  db: Database,
  reportId: string,
  status: "setuju" | "tolak",
  catatanAdmin?: string,
  tanggalProses: string =
    getTodayDateString()
): Database {
  const next = cloneDatabase(db);

  const index =
    next.attendanceReports.findIndex(
      (r) => r.id === reportId
    );

  if (index === -1) return db;

  const report =
    next.attendanceReports[index];

  if (report.status !== "pending") {
    return db;
  }

  /* =========================
     TOLAK
  ========================= */

  if (status === "tolak") {
    next.attendanceReports[index] = {
      ...report,

      status: "tolak",

      tanggalProses,

      catatanAdmin
    };

    return saveAndReturn(
      recalculateAllLedgers(next)
    );
  }

  /* =========================
     SETUJU
  ========================= */

  let session =
    next.sessions.find(
      (s) =>
        s.tanggal === report.tanggal &&
        s.siswaId === report.siswaId &&
        s.tutorId === report.tutorId &&
        s.programId === report.programId
    );

  if (!session) {
    const student =
      next.students.find(
        (s) =>
          s.id === report.siswaId
      );

    const tutor =
      next.tutors.find(
        (t) =>
          t.id === report.tutorId
      );

    const program =
      next.programs.find(
        (p) =>
          p.id === report.programId
      );

    if (
      !student ||
      !tutor ||
      !program
    ) {
      throw new Error(
        "Data pendukung tidak lengkap."
      );
    }

    const newSession:
      RiwayatPertemuan = {
      id: generateUniqueId("RP"),

      tanggal: report.tanggal,

      siswaId: student.id,
      siswaNama: student.nama,

      tutorId: tutor.id,
      tutorNama: tutor.nama,

      programId: program.id,
      programNama: program.nama,

      tarifSiswaSnapshot:
        amount(program.tarifSiswa),

      honorTutorSnapshot:
        amount(program.honorTutor),

      catatan:
        `Verifikasi LPK [${report.id}]${
          report.keterangan
            ? ` - ${report.keterangan}`
            : ""
        }`
    };

    next.sessions.unshift(
      newSession
    );

    session = newSession;

    if (!student.programId) {
      const sIdx =
        next.students.findIndex(
          (s) =>
            s.id === student.id
        );

      if (sIdx !== -1) {
        next.students[sIdx] = {
          ...next.students[sIdx],
          programId: program.id
        };
      }
    }
  }

  if (!session) {
    throw new Error(
      "Gagal memproses sesi absensi."
    );
  }

  next.attendanceReports[index] = {
    ...report,

    status: "setuju",

    tanggalProses,

    catatanAdmin
  };

  next.lastUpdated =
    new Date().toISOString();

  return saveAndReturn(
    recalculateAllLedgers(next)
  );
}

/* =========================================================
   UNDO ATTENDANCE VERIFICATION
========================================================= */

export function undoVerifyAttendanceReport(
  db: Database,
  reportId: string
): Database {
  const next = cloneDatabase(db);

  const index =
    next.attendanceReports.findIndex(
      (r) => r.id === reportId
    );

  if (index === -1) return db;

  const report =
    next.attendanceReports[index];

  if (report.status === "pending") {
    return db;
  }

  const oldStatus =
    report.status;

  next.attendanceReports[index] = {
    ...report,

    status: "pending",

    tanggalProses: undefined,

    catatanAdmin: undefined
  };

  if (oldStatus === "setuju") {
    const sessionIndex =
      next.sessions.findIndex(
        (s) =>
          s.tanggal === report.tanggal &&
          s.siswaId === report.siswaId &&
          s.tutorId === report.tutorId &&
          s.programId === report.programId
      );

    if (sessionIndex !== -1) {
      const sessionToDelete =
        next.sessions[sessionIndex];

      next.sessions.splice(
        sessionIndex,
        1
      );

      next.deletedIds =
        uniqueStrings([
          ...next.deletedIds,
          sessionToDelete.id
        ]);
    }
  }

  return saveAndReturn(
    recalculateAllLedgers(next)
  );
}

/* =========================================================
   DELETE SESSION
========================================================= */

export function deleteSessionTransaction(
  db: Database,
  sessionId: string
): Database {
  const next = cloneDatabase(db);

  const session =
    next.sessions.find(
      (item) =>
        item.id === sessionId
    );

  if (!session) return db;

  next.sessions =
    next.sessions.filter(
      (item) =>
        item.id !== sessionId
    );

  next.deletedIds =
    uniqueStrings([
      ...next.deletedIds,
      sessionId
    ]);

  return saveAndReturn(
    recalculateAllLedgers(next)
  );
}

/* =========================================================
   DELETE ATTENDANCE REPORT
========================================================= */

export function deleteAttendanceReport(
  db: Database,
  reportId: string
): Database {
  let next =
    cloneDatabase(db);

  const report =
    next.attendanceReports.find(
      (item) =>
        item.id === reportId
    );

  if (!report) return db;

  if (report.status === "setuju") {
    const session =
      next.sessions.find(
        (s) =>
          s.tanggal === report.tanggal &&
          s.siswaId === report.siswaId &&
          s.tutorId === report.tutorId &&
          s.programId === report.programId
      );

    if (session) {
      next =
        deleteSessionTransaction(
          next,
          session.id
        );
    }
  }

  next.attendanceReports =
    next.attendanceReports.filter(
      (item) =>
        item.id !== reportId
    );

  next.deletedIds =
    uniqueStrings([
      ...next.deletedIds,
      reportId
    ]);

  return saveAndReturn(
    recalculateAllLedgers(next)
  );
}

/* =========================================================
   GENERIC DELETE
========================================================= */

export function deleteFromDatabase(
  db: Database,
  collection: keyof Database,
  id: string
): Database {
  const next =
    cloneDatabase(db);

  const current =
    (next as any)[collection];

  if (!Array.isArray(current)) {
    return next;
  }

  (next as any)[collection] =
    current.filter(
      (item: any) =>
        item?.id !== id
    );

  next.deletedIds =
    uniqueStrings([
      ...next.deletedIds,
      id
    ]);

  if (
    [
      "sessions",
      "payments",
      "slips",
      "otherIncomes",
      "expenses"
    ].includes(
      String(collection)
    )
  ) {
    return saveAndReturn(
      recalculateAllLedgers(next)
    );
  }

  return saveDatabaseOnly(next);
}

/* =========================================================
   MERGE HELPERS
========================================================= */

function mergeArrayById<
  T extends {
    id: string;
    lastUpdated?: string;
  }
>(
  local: T[] = [],
  remote: T[] = []
): T[] {
  const map =
    new Map<string, T>();

  for (const item of local) {
    if (item?.id) {
      map.set(item.id, item);
    }
  }

  for (const item of remote) {
    if (!item?.id) continue;

    const previous =
      map.get(item.id);

    if (!previous) {
      map.set(item.id, item);
    } else {
      const localTime =
        previous.lastUpdated
          ? new Date(
              previous.lastUpdated
            ).getTime()
          : 0;

      const remoteTime =
        item.lastUpdated
          ? new Date(
              item.lastUpdated
            ).getTime()
          : 1;

      if (remoteTime >= localTime) {
        map.set(
          item.id,
          {
            ...previous,
            ...item
          }
        );
      }
    }
  }

  return Array.from(
    map.values()
  );
}

/* =========================================================
   MERGE SESSIONS
========================================================= */

function mergeSessions(
  local: RiwayatPertemuan[],
  remote: RiwayatPertemuan[]
): RiwayatPertemuan[] {
  const merged =
    mergeArrayById(
      local,
      remote
    );

  const result:
    RiwayatPertemuan[] = [];

  const seenBusiness =
    new Set<string>();

  for (const item of merged) {
    if (!item?.id) continue;

    const key = [
      item.tanggal,
      item.tutorId,
      item.siswaId,
      item.programId
    ].join("|");

    if (seenBusiness.has(key)) {
      continue;
    }

    seenBusiness.add(key);

    result.push(item);
  }

  return result;
}

/* =========================================================
   MERGE ATTENDANCE
========================================================= */

function mergeAttendance(
  local: AttendanceRecord[],
  remote: AttendanceRecord[]
): AttendanceRecord[] {
  const merged =
    mergeArrayById(
      local,
      remote
    );

  const result:
    AttendanceRecord[] = [];

  const seenBusiness =
    new Set<string>();

  for (const item of merged) {
    if (!item?.id) continue;

    const key = [
      item.tanggal,
      item.tutorId,
      item.siswaId,
      item.programId
    ].join("|");

    if (seenBusiness.has(key)) {
      continue;
    }

    seenBusiness.add(key);

    result.push(item);
  }

  return result;
}

/* =========================================================
   MERGE DATABASE
========================================================= */

export function mergeDatabases(
  localInput:
    | Database
    | null
    | undefined,
  remoteInput:
    | Database
    | null
    | undefined
): Database {
  const local =
    ensureDatabaseDefaults(
      localInput
    );

  const remote =
    ensureDatabaseDefaults(
      remoteInput
    );

  const deletedIds =
    uniqueStrings([
      ...local.deletedIds,
      ...remote.deletedIds
    ]);

  const deletedSet =
    new Set(deletedIds);

  const filterDeleted = <
    T extends { id: string }
  >(
    items: T[]
  ): T[] =>
    items.filter(
      (item) =>
        Boolean(item?.id) &&
        !deletedSet.has(item.id)
    );

  const merged:
    Database = {
    programs: filterDeleted(
      mergeArrayById(
        local.programs,
        remote.programs
      )
    ),

    students: filterDeleted(
      mergeArrayById(
        local.students,
        remote.students
      )
    ),

    tutors: filterDeleted(
      mergeArrayById(
        local.tutors,
        remote.tutors
      )
    ),

    sessions: filterDeleted(
      mergeSessions(
        local.sessions,
        remote.sessions
      )
    ),

    payments: filterDeleted(
      mergeArrayById(
        local.payments,
        remote.payments
      )
    ),

    slips: filterDeleted(
      mergeArrayById(
        local.slips,
        remote.slips
      )
    ),

    otherIncomes: filterDeleted(
      mergeArrayById(
        local.otherIncomes,
        remote.otherIncomes
      )
    ),

    expenses: filterDeleted(
      mergeArrayById(
        local.expenses,
        remote.expenses
      )
    ),

    attendanceReports:
      filterDeleted(
        mergeAttendance(
          local.attendanceReports,
          remote.attendanceReports
        )
      ),

    schedules: filterDeleted(
      mergeArrayById(
        local.schedules,
        remote.schedules
      )
    ),

    raports: filterDeleted(
      mergeArrayById(
        local.raports,
        remote.raports
      )
    ),

    studentLedger: [],

    tutorLedger: [],

    kas: [],

    broadcastMessage:
      remote.broadcastMessage ||
      local.broadcastMessage ||
      DEFAULT_BROADCAST,

    adminPassword:
      remote.adminPassword ||
      local.adminPassword ||
      undefined,

    deletedIds,

    lastUpdated:
      new Date().toISOString()
  };

  return recalculateAllLedgers(
    merged
  );
}

/* =========================================================
   LEDGER REBUILD
========================================================= */

export function recalculateAllLedgers(
  input: Database
): Database {
  const db =
    cloneDatabase(input);

  db.studentLedger = [];
  db.tutorLedger = [];
  db.kas = [];

  /* =======================================================
     SESSIONS
  ======================================================= */

  const sessions =
    deduplicateSessions(
      db.sessions
    );

  for (const session of sessions) {
    const tarifSiswa =
      amount(
        session.tarifSiswaSnapshot
      );

    const honorTutor =
      amount(
        session.honorTutorSnapshot
      );

    if (tarifSiswa > 0) {
      db.studentLedger.push({
        id: `TXS-${session.id}`,

        tanggal:
          session.tanggal,

        siswaId:
          session.siswaId,

        tipe: "debit",

        keterangan:
          `Riwayat Pertemuan [${session.id}] - ${session.siswaNama} - ${session.programNama}`,

        jumlah:
          tarifSiswa,

        saldoBerjalan: 0,

        referensiId:
          session.id
      });
    }

    if (honorTutor > 0) {
      db.tutorLedger.push({
        id: `TXT-${session.id}`,

        tanggal:
          session.tanggal,

        tutorId:
          session.tutorId,

        tipe: "kredit",

        keterangan:
          `Riwayat Pertemuan [${session.id}] - Siswa: ${session.siswaNama} - ${session.programNama}`,

        jumlah:
          honorTutor,

        saldoBerjalan: 0,

        referensiId:
          session.id
      });
    }
  }

  /* =======================================================
     PAYMENTS
  ======================================================= */

  const payments =
    deduplicatePayments(
      db.payments
    );

  for (const payment of payments) {
    const jumlah =
      amount(payment.jumlah);

    if (jumlah <= 0) continue;

    const isAdmin =
      payment.metode === "admin";

    const isTutorHanded =
      payment.metode === "tutor" &&
      payment.statusTitipan ===
        "diserahkan";

    if (
      !isAdmin &&
      !isTutorHanded
    ) {
      continue;
    }

    const tgl =
      payment.tanggalSerah ||
      payment.tanggal;

    db.studentLedger.push({
      id: `TXS-${payment.id}`,

      tanggal: tgl,

      siswaId:
        payment.siswaId,

      tipe: "kredit",

      keterangan:
        isAdmin
          ? `Pembayaran Siswa [${payment.id}] - Ke Admin`
          : `Penerimaan Pembayaran via Tutor [${payment.id}] - ${
              payment.tutorNama || "-"
            }`,

      jumlah,

      saldoBerjalan: 0,

      referensiId:
        payment.id
    });

    db.kas.push({
      id: `KAS-${payment.id}`,

      tanggal: tgl,

      tipe: "masuk",

      keterangan:
        isAdmin
          ? `Pembayaran Siswa [${payment.id}] - ${payment.siswaNama}`
          : `Titipan Tutor [${payment.id}] - ${
              payment.tutorNama || "-"
            } (Siswa: ${payment.siswaNama})`,

      jumlah,

      saldoBerjalan: 0,

      referensiId:
        payment.id
    });
  }

  /* =======================================================
     TUTOR SLIPS
  ======================================================= */

  const slips =
    deduplicateSlips(
      db.slips
    );

  for (const slip of slips) {
    const gross =
      amount(
        slip.totalHonor ??
          slip.jumlah
      );

    const potongan =
      Math.min(
        gross,
        amount(slip.potongan)
      );

    const net =
      Math.max(
        0,
        gross - potongan
      );

    if (gross <= 0) continue;

    /*
     * Kredit = honor diperoleh tutor
     * Debit  = honor sudah dibayar
     */
    db.tutorLedger.push({
      id: `TXT-${slip.id}`,

      tanggal:
        slip.tanggal,

      tutorId:
        slip.tutorId,

      tipe: "debit",

      keterangan:
        potongan > 0
          ? `Honor [${slip.id}] - Periode ${slip.periode} (Potongan: ${formatRupiah(
              potongan
            )})`
          : `Honor [${slip.id}] - Periode ${slip.periode}`,

      /*
       * Yang dikurangi dari saldo honor
       * adalah TOTAL HONOR yang dibayar,
       * bukan sekadar nominal bersih.
       */
      jumlah: gross,

      saldoBerjalan: 0,

      referensiId:
        slip.id
    });

    /*
     * Kas hanya keluar sebesar nominal
     * yang benar-benar dibayarkan.
     */
    if (net > 0) {
      db.kas.push({
        id: `KAS-${slip.id}`,

        tanggal:
          slip.tanggal,

        tipe: "keluar",

        keterangan:
          potongan > 0
            ? `Honor Tutor [${slip.id}] - ${slip.tutorNama} (Bersih: ${formatRupiah(
                net
              )}, Pot: ${formatRupiah(
                potongan
              )})`
            : `Honor Tutor [${slip.id}] - ${slip.tutorNama}`,

        jumlah: net,

        saldoBerjalan: 0,

        referensiId:
          slip.id
      });
    }
  }

  /* =======================================================
     OTHER INCOMES
  ======================================================= */

  const incomes =
    deduplicateById(
      db.otherIncomes
    );

  for (const income of incomes) {
    const nominal =
      amount(
        income.nominal ??
          income.jumlah
      );

    if (nominal <= 0) continue;

    db.kas.push({
      id: `KAS-${income.id}`,

      tanggal:
        income.tanggal,

      tipe: "masuk",

      keterangan:
        `Pemasukan Lain [${income.id}] - ${
          income.jenis ||
          income.sumber ||
          "Pemasukan Lain"
        }${
          income.keterangan
            ? ` - ${income.keterangan}`
            : ""
        }`,

      jumlah: nominal,

      saldoBerjalan: 0,

      referensiId:
        income.id
    });
  }

  /* =======================================================
     EXPENSES
  ======================================================= */

  const expenses =
    deduplicateById(
      db.expenses
    );

  for (const expense of expenses) {
    const jumlah =
      amount(expense.jumlah);

    if (jumlah <= 0) continue;

    db.kas.push({
      id: `KAS-${expense.id}`,

      tanggal:
        expense.tanggal,

      tipe: "keluar",

      keterangan:
        `Pengeluaran Operasional [${expense.id}] - ${expense.keterangan}`,

      jumlah,

      saldoBerjalan: 0,

      referensiId:
        expense.id
    });
  }

  /* =======================================================
     RUNNING BALANCE
  ======================================================= */

  calculateStudentRunningBalance(
    db
  );

  calculateTutorRunningBalance(
    db
  );

  calculateKasRunningBalance(
    db
  );

  db.lastUpdated =
    new Date().toISOString();

  return db;
}

/* =========================================================
   RUNNING BALANCES
========================================================= */

function calculateStudentRunningBalance(
  db: Database
): void {
  const running =
    new Map<string, number>();

  db.studentLedger.sort(
    compareTransaction
  );

  for (const tx of db.studentLedger) {
    const previous =
      running.get(tx.siswaId) ||
      0;

    const next =
      previous +
      (tx.tipe === "debit"
        ? amount(tx.jumlah)
        : -amount(tx.jumlah));

    tx.saldoBerjalan =
      next;

    running.set(
      tx.siswaId,
      next
    );
  }
}

function calculateTutorRunningBalance(
  db: Database
): void {
  const running =
    new Map<string, number>();

  db.tutorLedger.sort(
    compareTransaction
  );

  for (const tx of db.tutorLedger) {
    const previous =
      running.get(tx.tutorId) ||
      0;

    const next =
      previous +
      (tx.tipe === "kredit"
        ? amount(tx.jumlah)
        : -amount(tx.jumlah));

    tx.saldoBerjalan =
      next;

    running.set(
      tx.tutorId,
      next
    );
  }
}

function calculateKasRunningBalance(
  db: Database
): void {
  let running = 0;

  db.kas.sort(
    compareTransaction
  );

  for (const tx of db.kas) {
    running +=
      tx.tipe === "masuk"
        ? amount(tx.jumlah)
        : -amount(tx.jumlah);

    tx.saldoBerjalan =
      running;
  }
}

function compareTransaction<
  T extends {
    tanggal: string;
    id: string;
  }
>(
  a: T,
  b: T
): number {
  const dateCompare =
    String(
      a.tanggal || ""
    ).localeCompare(
      String(
        b.tanggal || ""
      )
    );

  if (dateCompare !== 0) {
    return dateCompare;
  }

  return String(
    a.id || ""
  ).localeCompare(
    String(
      b.id || ""
    )
  );
}

/* =========================================================
   DEDUPLICATE
========================================================= */

function deduplicateById<
  T extends { id: string }
>(
  items: T[]
): T[] {
  const map =
    new Map<string, T>();

  for (const item of items) {
    if (item?.id) {
      map.set(
        item.id,
        item
      );
    }
  }

  return Array.from(
    map.values()
  );
}

function deduplicateSessions(
  sessions: RiwayatPertemuan[]
): RiwayatPertemuan[] {
  const map =
    new Map<
      string,
      RiwayatPertemuan
    >();

  for (const session of sessions) {
    if (!session?.id) {
      continue;
    }

    const businessKey = [
      session.tanggal,
      session.tutorId,
      session.siswaId,
      session.programId
    ].join("|");

    /*
     * Satu kombinasi:
     * tanggal + tutor + siswa + program
     * hanya boleh satu sesi.
     */
    if (
      !map.has(businessKey)
    ) {
      map.set(
        businessKey,
        session
      );
    }
  }

  return Array.from(
    map.values()
  );
}

function deduplicatePayments(
  payments: PembayaranSiswa[]
): PembayaranSiswa[] {
  return deduplicateById(
    payments
  );
}

function deduplicateSlips(
  slips: SlipGaji[]
): SlipGaji[] {
  return deduplicateById(
    slips
  );
}

/* =========================================================
   DAY
========================================================= */

export function getNamaHariIndo(
  dateStr: string
): string {
  if (!dateStr) {
    return "Senin";
  }

  const date =
    new Date(
      `${dateStr}T00:00:00`
    );

  const days = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu"
  ];

  return (
    days[date.getDay()] ||
    "Senin"
  );
}

/* =========================================================
   SCHEDULE
========================================================= */

export function addScheduleTransaction(
  db: Database,
  data: {
    hari:
      | "Senin"
      | "Selasa"
      | "Rabu"
      | "Kamis"
      | "Jumat"
      | "Sabtu"
      | "Minggu";

    waktu: string;

    tutorId: string;

    siswaId: string;

    programId: string;
  }
): Database {
  const next =
    cloneDatabase(db);

  const tutor =
    next.tutors.find(
      (t) =>
        t.id === data.tutorId
    );

  const student =
    next.students.find(
      (s) =>
        s.id === data.siswaId
    );

  const program =
    next.programs.find(
      (p) =>
        p.id === data.programId
    );

  if (
    !tutor ||
    !student ||
    !program
  ) {
    throw new Error(
      "Tutor, siswa, atau program tidak ditemukan."
    );
  }

  const duplicate =
    next.schedules.some(
      (s) =>
        s.hari === data.hari &&
        s.waktu === data.waktu &&
        s.tutorId === data.tutorId &&
        s.siswaId === data.siswaId &&
        s.programId === data.programId
    );

  if (duplicate) {
    throw new Error(
      "Jadwal yang sama sudah ada."
    );
  }

  next.schedules.push({
    id: generateUniqueId("JDW"),

    hari: data.hari,

    waktu: data.waktu,

    tutorId: tutor.id,
    tutorNama: tutor.nama,

    siswaId: student.id,
    siswaNama: student.nama,

    programId: program.id,
    programNama: program.nama
  });

  return saveDatabaseOnly(
    next
  );
}

export function deleteScheduleTransaction(
  db: Database,
  scheduleId: string
): Database {
  const next =
    cloneDatabase(db);

  const exists =
    next.schedules.some(
      (s) =>
        s.id === scheduleId
    );

  if (!exists) {
    return db;
  }

  next.schedules =
    next.schedules.filter(
      (s) =>
        s.id !== scheduleId
    );

  next.deletedIds =
    uniqueStrings([
      ...next.deletedIds,
      scheduleId
    ]);

  return saveDatabaseOnly(
    next
  );
}

/* =========================================================
   BROADCAST
========================================================= */

export function updateBroadcastMessageTransaction(
  db: Database,
  message: string
): Database {
  const next =
    cloneDatabase(db);

  next.broadcastMessage =
    message;

  return saveDatabaseOnly(
    next
  );
}

/* =========================================================
   DEFAULT EXPORT
========================================================= */

export default {
  getDatabase,

  saveDatabase,

  updateDatabase,

  getLocalDatabase,

  saveLocalDatabase,

  ensureDatabaseDefaults,

  generateCleanDatabase,

  clearPrototypeData,

  mergeDatabases,

  recalculateAllLedgers,

  generateUniqueId,

  formatRupiah,

  formatTanggalIndo,

  formatBulanTahun,

  getTodayDateString,

  getStudentBalance,

  getTutorHonorBalance,

  getTutorDepositBalance,

  getKasLembagaBalance,

  filterByDateRange,

  deleteFromDatabase,

  updateBroadcastMessageTransaction,

  checkDuplicateSession,

  addSessionTransaction,

  deleteSessionTransaction,

  addPaymentTransaction,

  confirmTutorDepositHandover,

  undoTutorDepositHandover,

  payTutorHonorTransaction,

  addGeneralExpenseTransaction,

  addOtherIncomeTransaction,

  submitAttendanceReport,

  verifyAttendanceReport,

  undoVerifyAttendanceReport,

  deleteAttendanceReport,

  getNamaHariIndo,

  addScheduleTransaction,

  deleteScheduleTransaction
};