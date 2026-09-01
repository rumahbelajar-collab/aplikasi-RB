/* =========================================================
   src/types.ts — Rumah Belajar
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

export interface Siswa {
  id: string;
  nama: string;
  programId?: string;
  status?: string;
  teleponOrangTua?: string;
  alamat?: string;
  tanggalDaftar?: string;
}

export interface Tutor {
  id: string;
  nama: string;
  idLogin?: string;
  password?: string;
  status?: string;
  telepon?: string;
  alamat?: string;
  tanggalBergabung?: string;
}

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

export type TipeTransaksiSiswa = "debit" | "kredit";

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

export type TipeTransaksiTutor = "kredit" | "debit";

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

export type TipeKas = "masuk" | "keluar";

export interface KasLembaga {
  id: string;
  tanggal: string;
  tipe: TipeKas;
  keterangan: string;
  jumlah: number;
  saldoBerjalan: number;
  referensiId?: string;
}

export interface PemasukanLain {
  id: string;
  tanggal: string;
  sumber?: string;
  keterangan?: string;
  jumlah: number;
  metode?: string;
  lastUpdated?: string;
}

export type StatusLaporanKehadiran =
  | "pending" | "setuju" | "tolak"
  | "disetujui" | "ditolak" | "diproses";

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

export interface UserSession {
  role: "admin" | "tutor";
  userId: string;
  nama: string;
}

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
  expenses?: Array<{ id: string; tanggal: string; keterangan: string; jumlah: number }>;
  broadcastMessage: string;
  adminPassword?: string;
  lastUpdated: string;
  deletedIds: string[];
}
