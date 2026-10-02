/* =========================================================
   PROGRAM
========================================================= */

export interface ProgramBelajar {
  id: string;
  nama: string;
  jenjang: string;
  mapel: string;
  durasi: number;
  tarifSiswa: number;
  honorTutor: number;
  status?: string;
}

/* =========================================================
   SISWA
========================================================= */

export interface Siswa {
  id: string;
  nama: string;
  programId?: string;
  status?: string;
  teleponOrangTua?: string;
  alamat?: string;
  tanggalDaftar?: string;
}

/* =========================================================
   TUTOR
========================================================= */

export interface Tutor {
  id: string;
  nama: string;

  /**
   * ID untuk login tutor.
   */
  idLogin?: string;

  password?: string;

  status?: string;

  telepon?: string;
  alamat?: string;

  tanggalBergabung?: string;
}

/* =========================================================
   RIWAYAT PERTEMUAN
========================================================= */

export interface RiwayatPertemuan {
  id: string;
  tanggal: string;

  siswaId: string;
  siswaNama: string;

  tutorId: string;
  tutorNama: string;

  programId: string;
  programNama: string;

  tarifSiswaSnapshot: number;
  honorTutorSnapshot: number;

  catatan?: string;
  lastUpdated?: string;
}

/* =========================================================
   TRANSAKSI REKENING SISWA
========================================================= */

export type TipeTransaksiSiswa =
  | "debit"
  | "kredit";

export interface TransaksiRekeningSiswa {
  id: string;
  tanggal: string;

  siswaId: string;

  tipe: TipeTransaksiSiswa;

  keterangan: string;

  jumlah: number;

  saldoBerjalan: number;

  referensiId?: string;
}

/* =========================================================
   PEMBAYARAN SISWA
========================================================= */

export interface PembayaranSiswa {
  id: string;
  tanggal: string;

  siswaId: string;
  siswaNama: string;

  jumlah: number;

  metode: string;

  tutorId?: string;
  tutorNama?: string;

  statusTitipan: string;

  tanggalSerah?: string;
  lastUpdated?: string;
}

/* =========================================================
   TRANSAKSI HONOR TUTOR
========================================================= */

export type TipeTransaksiTutor =
  | "kredit"
  | "debit";

export interface TransaksiHonorTutor {
  id: string;
  tanggal: string;

  tutorId: string;

  tipe: TipeTransaksiTutor;

  keterangan: string;

  jumlah: number;

  saldoBerjalan: number;

  referensiId?: string;
}

/* =========================================================
   SLIP GAJI
========================================================= */

export interface SlipGaji {
  id: string;
  tanggal: string;

  tutorId: string;
  tutorNama: string;

  jumlah: number;

  periode: string;

  catatan?: string;

  potongan?: number;

  keteranganPotongan?: string;

  totalHonor?: number;
  lastUpdated?: string;
}

/* =========================================================
   KAS LEMBAGA
========================================================= */

export type TipeKas =
  | "masuk"
  | "keluar";

export interface KasLembaga {
  id: string;
  tanggal: string;

  tipe: TipeKas;

  keterangan: string;

  jumlah: number;

  saldoBerjalan: number;
}

/* =========================================================
   PEMASUKAN LAIN
========================================================= */

export interface PemasukanLain {
  id: string;
  tanggal: string;

  sumber?: string;
  keterangan?: string;

  jumlah: number;

  metode?: string;
  lastUpdated?: string;
}

/* =========================================================
   LAPORAN KEHADIRAN
========================================================= */

export type StatusLaporanKehadiran =
  | "pending"
  | "setuju"
  | "tolak"
  | "disetujui"
  | "ditolak"
  | "diproses";

export interface LaporanKehadiran {
  id: string;

  tanggal: string;

  tutorId: string;
  tutorNama: string;

  siswaId: string;
  siswaNama: string;

  programId: string;
  programNama: string;

  fotoJurnal: string;

  keterangan?: string;

  status?: StatusLaporanKehadiran;

  catatanAdmin?: string;

  tanggalProses?: string;
  lastUpdated?: string;
}

/* =========================================================
   JADWAL TUTOR
========================================================= */

export interface JadwalTutor {
  id: string;

  tanggal?: string;
  hari?: string;

  jamMulai?: string;
  jamSelesai?: string;

  tutorId?: string;
  tutorNama?: string;

  siswaId?: string;
  siswaNama?: string;

  programId?: string;
  programNama?: string;

  status?: string;

  catatan?: string;
  lastUpdated?: string;
}

/* =========================================================
   RAPORT
========================================================= */

export interface RaportSubject {
  name: string;
  to1: number;
  to2: number;
  to3: number;
}

export interface RaportSiswa {
  id: string;

  siswaId: string;
  siswaNama?: string;

  programId?: string;
  programNama?: string;

  periode?: string;

  nilai?: number;
  predikat?: string;

  catatan?: string;

  createdAt?: string;
  updatedAt?: string;
  lastUpdated?: string;
}

/* =========================================================
   USER SESSION TYPE
========================================================= */

export interface UserSession {
  role: "admin" | "tutor" | "perpustakaan";
  userId: string;
  nama: string;
}

/* =========================================================
   DATABASE ROOT OBJECT
========================================================= */

export interface Database {
  programs: ProgramBelajar[];
  students: Siswa[];
  tutors: Tutor[];
  sessions: RiwayatPertemuan[];
  studentLedger: TransaksiRekeningSiswa[];
  payments: PembayaranSiswa[];
  tutorLedger: TransaksiHonorTutor[];
  slips: SlipGaji[];
  kas: KasLembaga[];
  otherIncomes: PemasukanLain[];
  attendanceReports: LaporanKehadiran[];
  schedules: JadwalTutor[];
  raports: RaportSiswa[];

  broadcastMessage: string;
  adminPassword?: string;
  perpustakaanPassword?: string;
  lastUpdated: string;
  deletedIds: string[];
}