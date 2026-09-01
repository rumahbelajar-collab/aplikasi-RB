import React, { useState, useMemo } from "react";
import {
  Users,
  BookOpen,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  Clock,
  PlusCircle,
  Receipt,
  UserCheck,
  Megaphone,
  ChevronDown,
  ChevronUp,
  Search,
  CalendarCheck,
  Send,
  HardDrive,
  BookA,
  Calendar
} from "lucide-react";

import {
  Database,
  formatRupiah,
  getKasLembagaBalance,
  updateBroadcastMessageTransaction,
  getTodayDateString,
  formatBulanTahun,
  formatTanggalIndo
} from "../lib/db";
import { matchesSearch } from "../lib/search";

interface AdminDashboardProps {
  db: Database;
  onNavigateToTab: (tab: string, subTab?: string) => void;
  onOpenQuickAction: (
    action: "session" | "payment" | "handover" | "honor" | "absensi"
  ) => void;
  onUpdateDb?: (newDb: Database) => void;
}

export default function AdminDashboard({
  db,
  onNavigateToTab,
  onOpenQuickAction,
  onUpdateDb
}: AdminDashboardProps) {
  const [broadcastInput, setBroadcastInput] = useState(
    db.broadcastMessage || ""
  );
  const [isBroadcastSaving, setIsBroadcastSaving] = useState(false);

  const [scheduleSearch, setScheduleSearch] = useState("");
  const [scheduleDayFilter, setScheduleDayFilter] = useState("Semua");
  const [showAktivitasTerbaru, setShowAktivitasTerbaru] = useState(false);
  const [showJadwalAkumulatif, setShowJadwalAkumulatif] = useState(false);

  const handleBroadcastSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!onUpdateDb) return;

    setIsBroadcastSaving(true);

    setTimeout(() => {
      const nextDb = updateBroadcastMessageTransaction(
        db,
        broadcastInput.trim()
      );

      onUpdateDb(nextDb);
      setIsBroadcastSaving(false);

      alert(
        "Pesan siaran (broadcast) berhasil diperbarui secara real-time!"
      );
    }, 400);
  };

  const stats = useMemo(() => {
    const activeStudents = (db.students || []).filter(
      (s) => s.status === "aktif"
    ).length;

    const activeTutors = (db.tutors || []).filter(
      (t) => t.status === "aktif"
    ).length;

    const todayStr = getTodayDateString();

    const sessionsToday = (db.sessions || []).filter(
      (s) => s.tanggal === todayStr
    );

    const kasBalance = getKasLembagaBalance(db);

    const base = new Date(todayStr);
    const year = base.getFullYear();
    const month = base.getMonth();

    const pad = (num: number) => String(num).padStart(2, "0");

    const monthStart = `${year}-${pad(month + 1)}-01`;

    const lastDay = new Date(year, month + 1, 0).getDate();

    const monthEnd = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

    const monthlyOtherIncomes = (db.otherIncomes || [])
      .filter(
        (item) =>
          item.tanggal >= monthStart &&
          item.tanggal <= monthEnd
      )
      .reduce((sum, item) => sum + item.jumlah, 0);

    const monthlyRevenue =
      (db.studentLedger || [])
        .filter(
          (tx) =>
            tx.tipe === "debit" &&
            tx.tanggal >= monthStart &&
            tx.tanggal <= monthEnd
        )
        .reduce((sum, tx) => sum + tx.jumlah, 0) +
      monthlyOtherIncomes;

    const monthlyTutorHonors = (db.tutorLedger || [])
      .filter(
        (tx) =>
          tx.tipe === "kredit" &&
          tx.tanggal >= monthStart &&
          tx.tanggal <= monthEnd
      )
      .reduce((sum, tx) => sum + tx.jumlah, 0);

    const monthlyGeneralExpenses = (db.kas || [])
      .filter(
        (k) =>
          k.tipe === "keluar" &&
          (!k.referensiId || !k.referensiId.startsWith("SG")) &&
          k.tanggal >= monthStart &&
          k.tanggal <= monthEnd
      )
      .reduce((sum, k) => sum + k.jumlah, 0);

    const monthlyExpense =
      monthlyTutorHonors + monthlyGeneralExpenses;

    const estimatedProfit =
      monthlyRevenue - monthlyExpense;

    const totalStudentBilled = (db.studentLedger || [])
      .filter((l) => l.tipe === "debit")
      .reduce((sum, l) => sum + l.jumlah, 0);

    const totalStudentPaid = (db.studentLedger || [])
      .filter((l) => l.tipe === "kredit")
      .reduce((sum, l) => sum + l.jumlah, 0);

    const totalOutstandingPiutang =
      totalStudentBilled - totalStudentPaid;

    const totalTutorEarned = (db.tutorLedger || [])
      .filter((l) => l.tipe === "kredit")
      .reduce((sum, l) => sum + l.jumlah, 0);

    const totalTutorPaid = (db.tutorLedger || [])
      .filter((l) => l.tipe === "debit")
      .reduce((sum, l) => sum + l.jumlah, 0);

    const totalOutstandingUtangHonor =
      totalTutorEarned - totalTutorPaid;

    const totalTitipanPending = (db.payments || [])
      .filter(
        (p) =>
          p.metode === "tutor" &&
          p.statusTitipan === "pending"
      )
      .reduce((sum, p) => sum + p.jumlah, 0);

    return {
      activeStudents,
      activeTutors,
      sessionsToday,
      kasBalance,
      monthlyRevenue,
      monthlyExpense,
      estimatedProfit,
      totalOutstandingPiutang,
      totalOutstandingUtangHonor,
      totalTitipanPending
    };
  }, [db]);

  return (
    <div
      id="admin-dashboard-container"
      className="flex flex-col space-y-6"
    >
      {/* BLUE HEADER HERO */}
      <div
        id="dashboard-hero"
        className="bg-gradient-to-br from-blue-500 to-brand-500 text-white p-6 rounded-b-[32px] shadow-lg mb-6 relative overflow-hidden"
      >
        <div className="absolute top-[-30px] right-[-30px] w-36 h-36 bg-white/5 rounded-full" />
        <div className="absolute bottom-[-50px] left-[-20px] w-48 h-48 bg-white/5 rounded-full" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <img
              src="public2.png"
              alt="logo"
              className="w-20 h-20 object-contain"
              referrerPolicy="no-referrer"
            />

            <div>
              <p className="text-[10px] text-brand-100 uppercase tracking-wider font-semibold">
                Sistem Informasi
              </p>

              <h2 className="text-sm font-bold tracking-tight font-display">
                RUMAH BELAJAR
              </h2>
            </div>
          </div>

          <div className="bg-white/15 px-2.5 py-1 rounded-full border border-white/20 flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[9.5px] font-bold uppercase tracking-wider">
              Admin Mode
            </span>
          </div>
        </div>

        <div className="mt-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-inner">
          <p className="text-[10.5px] text-brand-100 font-medium uppercase tracking-wider">
            Saldo Kas Lembaga
          </p>

          <div className="flex items-baseline justify-between mt-1">
            <h1 className="text-2xl font-black font-mono tracking-tight">
              {formatRupiah(stats.kasBalance)}
            </h1>

            <button
              id="view-kas-btn"
              onClick={() =>
                onNavigateToTab("keuangan", "kas")
              }
              className="text-[10.5px] font-bold text-white bg-white/15 px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/25 active:scale-95 transition-all cursor-pointer"
            >
              Buka Buku Kas
            </button>
          </div>
        </div>
      </div>

      <div className="px-2 md:px-0 pb-4 space-y-6">

        {/* OPERATIONAL STATS */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">

          <div
            id="stat-siswa-card"
            onClick={() =>
              onNavigateToTab("operasional", "siswa")
            }
            className="bg-slate-50 p-3 rounded-2xl flex flex-col gap-5 cursor-pointer hover:border-brand-300 transition-all active:scale-95 border border-slate-100"
          >
            <p className="text-[9.5px] text-brand-400 font-semibold uppercase tracking-wider text-left">
              Siswa Aktif
            </p>

            <div className="flex items-center gap-3 mt-0.5">
              <div className="w-6 h-6 bg-blue-50 text-brand-600 rounded-lg flex items-center justify-center shrink-0">
                <Users size={12} />
              </div>

              <p className="text-3xl font-extrabold text-brand-600 leading-none">
                {stats.activeStudents}
              </p>
            </div>
          </div>

          <div
            id="stat-tutor-card"
            onClick={() =>
              onNavigateToTab("operasional", "tutor")
            }
            className="bg-slate-50 p-3 rounded-2xl flex flex-col gap-5 cursor-pointer hover:border-brand-300 transition-all active:scale-95 border border-slate-100"
          >
            <p className="text-[9.5px] text-brand-400 font-semibold uppercase tracking-wider text-left">
              Tutor Aktif
            </p>

            <div className="flex items-center gap-3 mt-0.5">
              <div className="w-6 h-6 bg-blue-50 text-brand-600 rounded-lg flex items-center justify-center shrink-0">
                <UserCheck size={12} />
              </div>

              <p className="text-3xl font-extrabold text-brand-500 leading-none">
                {stats.activeTutors}
              </p>
            </div>
          </div>

          <div
            id="stat-sesi-card"
            onClick={() =>
              onNavigateToTab("keuangan", "rekening")
            }
            className="bg-slate-50 p-3 rounded-2xl flex flex-col gap-5 cursor-pointer hover:border-brand-300 transition-all active:scale-95 border border-slate-100"
          >
            <p className="text-[9.5px] text-amber-500 font-semibold uppercase tracking-wider text-left">
              Sesi Hari Ini
            </p>

            <div className="flex items-center gap-3 mt-0.5">
              <div className="w-6 h-6 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                <BookOpen size={12} />
              </div>

              <p className="text-3xl font-extrabold text-amber-500 leading-none">
                {stats.sessionsToday.length}
              </p>
            </div>
          </div>
        </div>

        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 ml-1">
          Tindakan Cepat
        </h3>

        {/* QUICK ACTIONS */}
        <div
          id="quick-actions-card"
          className="bg-white p-4 mb-5 rounded-2xl border border-slate-100 shadow-sm"
        >
          <div className="grid grid-cols-4 gap-2">

            <button
              id="action-btn-session"
              onClick={() =>
                onOpenQuickAction("session")
              }
              className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-xl shadow-2xs group cursor-pointer transition-all active:scale-95 min-h-[90px]"
            >
              <div className="w-11 h-11 bg-brand-50 group-hover:bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center border border-brand-100/50 transition-all">
                <PlusCircle size={20} />
              </div>

              <span className="text-[10px] text-slate-600 font-semibold leading-tight mt-1.5 text-center">
                Sesi Baru
              </span>
            </button>

            <button
              id="action-btn-payment"
              onClick={() =>
                onOpenQuickAction("payment")
              }
              className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-xl shadow-2xs group cursor-pointer transition-all active:scale-95 min-h-[90px]"
            >
              <div className="w-11 h-11 bg-emerald-50 group-hover:bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100/50 transition-all">
                <Coins size={20} />
              </div>

              <span className="text-[10px] text-slate-600 font-semibold leading-tight mt-1.5 text-center">
                Terima Bayar
              </span>
            </button>

            <button
              id="action-btn-handover"
              onClick={() =>
                onOpenQuickAction("handover")
              }
              className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-xl shadow-2xs group cursor-pointer transition-all active:scale-95 min-h-[90px]"
            >
              <div className="w-11 h-11 bg-amber-50 group-hover:bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-100/50 transition-all">
                <Wallet size={20} />
              </div>

              <span className="text-[10px] text-slate-600 font-semibold leading-tight mt-1.5 text-center">
                Setor Titipan
              </span>
            </button>

            <button
              id="action-btn-honor"
              onClick={() =>
                onOpenQuickAction("honor")
              }
              className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-xl shadow-2xs group cursor-pointer transition-all active:scale-95 min-h-[90px]"
            >
              <div className="w-11 h-11 bg-purple-50 group-hover:bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100/50 transition-all">
                <Receipt size={20} />
              </div>

              <span className="text-[10px] text-slate-600 font-semibold leading-tight mt-1.5 text-center">
                Bayar Honor
              </span>
            </button>

            <button
              id="action-btn-absensi"
              onClick={() =>
                onOpenQuickAction("absensi")
              }
              className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-xl shadow-2xs group cursor-pointer transition-all active:scale-95 min-h-[90px]"
            >
              <div className="w-11 h-11 bg-brand-50 group-hover:bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center border border-brand-100/50 transition-all">
                <CalendarCheck size={20} />
              </div>

              <span className="text-[10px] text-slate-600 font-semibold leading-tight mt-1.5 text-center">
                Absensi
              </span>
            </button>

            <a
              href="https://drive.google.com/drive/folders/1BLr6x5u5VYm97RowTLKoiffPKiQlqhCk?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-xl shadow-2xs group cursor-pointer transition-all active:scale-95 min-h-[90px]"
            >
              <div className="w-11 h-11 bg-emerald-50 group-hover:bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100/50 transition-all">
                <HardDrive size={20} />
              </div>

              <span className="text-[10px] text-slate-600 font-semibold leading-tight mt-1.5 text-center">
                Drive
              </span>
            </a>

            <a
              href="https://drive.google.com/drive/folders/1_ZRUqCkw9rMqJja2-5bK1xanrwoRZbbJ?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-xl shadow-2xs group cursor-pointer transition-all active:scale-95 min-h-[90px]"
            >
              <div className="w-11 h-11 bg-amber-50 group-hover:bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-100/50 transition-all">
                <BookOpen size={20} />
              </div>

              <span className="text-[10px] text-slate-600 font-semibold leading-tight mt-1.5 text-center">
                Modul
              </span>
            </a>

            <a
              href="https://drive.google.com/drive/folders/15AjFnEQevXIQo9Jy2B-_JDAgj8xE3Lho?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-xl shadow-2xs group cursor-pointer transition-all active:scale-95 min-h-[90px]"
            >
              <div className="w-11 h-11 bg-purple-50 group-hover:bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center border border-purple-100/50 transition-all">
                <BookA size={20} />
              </div>

              <span className="text-[10px] text-slate-600 font-semibold leading-tight mt-1.5 text-center">
                E-Rapor
              </span>
            </a>

          </div>
        </div>

        {/* BROADCAST */}
        <div
          id="broadcast-editor-card"
          className="bg-gradient-to-br from-amber-50/60 to-orange-50/30 p-4.5 mb-6 rounded-2xl border border-amber-200/60 shadow-xs transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-3 text-amber-900">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                <Megaphone
                  size={14}
                  className="animate-bounce"
                />
              </div>

              <div className="flex flex-col">
                <h3 className="text-xs font-black uppercase tracking-wide leading-none">
                  Siarkan Pengumuman
                </h3>

                <span className="text-[9px] font-bold text-amber-600/80 mt-0.5">
                  Kirim notifikasi langsung ke semua tutor
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleBroadcastSubmit}>
            <div className="relative flex flex-col bg-white border border-slate-200 focus-within:border-amber-500 rounded-xl shadow-2xs overflow-hidden transition-all duration-200">

              <textarea
                id="broadcast-input-field"
                placeholder="Ketik pengumuman penting baru untuk para tutor..."
                value={broadcastInput}
                onChange={(e) =>
                  setBroadcastInput(e.target.value)
                }
                rows={4}
                className="w-full bg-transparent px-4 pt-3.5 pb-14 text-xs font-semibold text-slate-800 placeholder-slate-400 border-0 outline-none focus:outline-none focus:ring-0 focus:border-transparent resize-none leading-relaxed"
                required
              />

              <div className="absolute bottom-0 inset-x-0 bg-white pt-3 pb-2.5 px-3 flex flex-row justify-between items-center z-10 border-t border-slate-100">

                <span className="text-[9px] text-slate-400 font-bold font-mono pl-1 select-none">
                  {broadcastInput.length} karakter
                </span>

                <button
                  type="submit"
                  id="broadcast-submit-btn"
                  disabled={isBroadcastSaving}
                  className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-[10px] uppercase tracking-wider px-4 py-1.5 rounded-lg shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  {isBroadcastSaving ? (
                    <span>Menyimpan...</span>
                  ) : (
                    <>
                      <span>Siarkan</span>
                      <Send size={11} />
                    </>
                  )}
                </button>

              </div>
            </div>
          </form>
        </div>

        {/* FINANCIAL */}
        <div
          id="financial-card"
          className="bg-white p-4.5 rounded-2xl shadow-sm border border-slate-100 mb-6"
        >
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-50">

            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Buku Operasional{" "}
              {formatBulanTahun(
                getTodayDateString()
              )}
            </h3>

            <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
              Bulan Ini
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">

            <div>
              <p className="text-[10px] text-slate-400 font-medium">
                ESTIMASI REVENUE
              </p>

              <div className="flex items-center gap-1 mt-0.5 text-emerald-600">
                <ArrowUpRight size={14} />

                <span className="text-sm font-black font-mono leading-none">
                  {formatRupiah(stats.monthlyRevenue)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-slate-400 font-medium">
                ESTIMASI BEBAN
              </p>

              <div className="flex items-center gap-1 mt-0.5 text-rose-600">
                <ArrowDownLeft size={14} />

                <span className="text-sm font-black font-mono leading-none">
                  {formatRupiah(stats.monthlyExpense)}
                </span>
              </div>
            </div>

          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between mb-4">
            <span className="text-[10.5px] font-bold text-slate-500">
              Estimasi Laba Bersih
            </span>

            <span
              className={`text-xs font-extrabold font-mono ${
                stats.estimatedProfit >= 0
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              {stats.estimatedProfit >= 0 ? "+" : ""}
              {formatRupiah(stats.estimatedProfit)}
            </span>
          </div>

          <div className="space-y-2.5 pt-1">

            <div
              id="piutang-row"
              onClick={() =>
                onNavigateToTab(
                  "keuangan",
                  "rekening"
                )
              }
              className="flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50/50 p-1 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                Piutang Tagihan Siswa
              </div>

              <span className="font-bold text-slate-700 font-mono">
                {formatRupiah(
                  stats.totalOutstandingPiutang
                )}
              </span>
            </div>

            <div
              id="utang-honor-row"
              onClick={() =>
                onNavigateToTab(
                  "keuangan",
                  "honor"
                )
              }
              className="flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50/50 p-1 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                Utang Honor Tutor
              </div>

              <span className="font-bold text-slate-700 font-mono">
                {formatRupiah(
                  stats.totalOutstandingUtangHonor
                )}
              </span>
            </div>

            <div
              id="titipan-row"
              onClick={() =>
                onNavigateToTab(
                  "keuangan",
                  "titipan"
                )
              }
              className="flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50/50 p-1 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Titipan di Tangan Tutor
              </div>

              <span className="font-bold text-slate-700 font-mono">
                {formatRupiah(
                  stats.totalTitipanPending
                )}
              </span>
            </div>

          </div>
        </div>

        {/* JADWAL */}
        {(() => {
          const dayOrder: Record<string, number> = {
            Senin: 1,
            Selasa: 2,
            Rabu: 3,
            Kamis: 4,
            Jumat: 5,
            Sabtu: 6,
            Minggu: 7
          };

          const rawSchedules = db.schedules || [];

          const filteredSchedules =
            rawSchedules.filter((s) => {
              const tutorNama =
                s.tutorNama || "";

              const siswaNama =
                s.siswaNama || "";

              const programNama =
                s.programNama || "";

              const hari =
                s.hari || "";

              const matchesSearchQuery =
                matchesSearch(
                  scheduleSearch,
                  tutorNama,
                  siswaNama,
                  programNama
                );

              const matchesDay =
                scheduleDayFilter === "Semua" ||
                hari.toLowerCase() ===
                  scheduleDayFilter.toLowerCase();

              return matchesSearchQuery && matchesDay;
            });

          const sortedSchedules =
            [...filteredSchedules].sort(
              (a, b) => {
                const dayA =
                  dayOrder[a.hari] || 99;

                const dayB =
                  dayOrder[b.hari] || 99;

                if (dayA !== dayB) {
                  return dayA - dayB;
                }

                return a.waktu.localeCompare(
                  b.waktu
                );
              }
            );

          return (
            <div
              id="accumulative-schedule-card"
              className="bg-white p-4.5 rounded-2xl shadow-sm border border-slate-100 mt-6"
            >
              <div
                className="flex items-center justify-between cursor-pointer group select-none mb-4"
                onClick={() =>
                  setShowJadwalAkumulatif(
                    !showJadwalAkumulatif
                  )
                }
              >
                <div className="flex items-center gap-2">

                  <div
                    className={`p-1.5 rounded-xl transition-colors ${
                      showJadwalAkumulatif
                        ? "bg-brand-50 text-brand-600"
                        : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    <Calendar size={15} />
                  </div>

                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Jadwal Tutor
                  </h3>
                </div>

                <div className="flex items-center gap-2.5">

                  <span className="text-[10px] font-black text-brand-600 bg-brand-50/70 px-2.5 py-0.5 rounded-md">
                    {rawSchedules.length} Jadwal
                  </span>

                  <div className="p-0.5 rounded-md group-hover:bg-slate-50 transition-colors">
                    {showJadwalAkumulatif ? (
                      <ChevronUp
                        size={15}
                        className="text-slate-400"
                      />
                    ) : (
                      <ChevronDown
                        size={15}
                        className="text-slate-400"
                      />
                    )}
                  </div>

                </div>
              </div>

              {showJadwalAkumulatif && (
                <div className="animate-fade-in space-y-4">

                  <div className="flex flex-col gap-2.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">

                    <div className="relative">
                      <Search
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        type="text"
                        placeholder="Cari nama tutor, siswa, atau program harian..."
                        value={scheduleSearch}
                        onChange={(e) =>
                          setScheduleSearch(
                            e.target.value
                          )
                        }
                        className="w-full pl-8.5 pr-3 py-2 text-xs font-semibold bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:border-brand-400 placeholder-slate-400 text-slate-800 shadow-2xs transition-colors"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none shrink-0">

                      {[
                        "Semua",
                        "Senin",
                        "Selasa",
                        "Rabu",
                        "Kamis",
                        "Jumat",
                        "Sabtu",
                        "Minggu"
                      ].map((day) => (
                        <button
                          key={day}
                          onClick={() =>
                            setScheduleDayFilter(day)
                          }
                          type="button"
                          className={`px-3 py-1 rounded-lg text-[10px] font-extrabold transition-all whitespace-nowrap border cursor-pointer ${
                            scheduleDayFilter === day
                              ? "bg-brand-600 text-white border-brand-600 shadow-2xs"
                              : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700"
                          }`}
                        >
                          {day}
                        </button>
                      ))}

                    </div>
                  </div>

                  <div className="space-y-2 max-h-[340px] overflow-y-auto scrollbar-none pr-1">

                    {sortedSchedules.map(
                      (schedule) => (
                        <div
                          key={schedule.id}
                          className="p-3 bg-white border border-slate-100 rounded-xl flex flex-col gap-2.5 shadow-2xs"
                        >

                          <div className="flex justify-between items-center w-full">

                            <div className="flex items-center gap-1.5">

                              <span className="text-[9px] font-black uppercase tracking-wider bg-brand-50 text-brand-600 px-2 py-0.5 rounded-md">
                                {schedule.hari}
                              </span>

                              <span className="text-[9px] font-bold font-mono text-slate-400">
                                #{schedule.id}
                              </span>

                            </div>

                            <span className="text-[10px] font-black font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                              {schedule.waktu}
                            </span>

                          </div>

                          <div className="grid grid-cols-3 gap-5 pt-2.5 w-full min-w-0 border-t border-slate-50">

                            <div className="flex flex-col min-w-0">
                              <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                Tutor
                              </span>

                              <p className="text-xs font-black text-slate-700 truncate leading-tight">
                                {schedule.tutorNama}
                              </p>
                            </div>

                            <div className="flex flex-col min-w-0">
                              <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                Siswa
                              </span>

                              <p className="text-xs font-extrabold text-slate-600 truncate leading-tight">
                                {schedule.siswaNama}
                              </p>
                            </div>

                            <div className="flex flex-col min-w-0">
                              <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                                Program
                              </span>

                              <p className="text-[10px] font-black text-slate-600 truncate leading-tight">
                                {schedule.programNama}
                              </p>
                            </div>

                          </div>
                        </div>
                      )
                    )}

                    {sortedSchedules.length === 0 && (
                      <div className="text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-xs font-semibold text-slate-400 italic">
                          Tidak ada jadwal bimbingan yang cocok.
                        </p>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* RECENT ACTIVITIES */}
        <div
          id="recent-activities-card"
          className="bg-white p-4.5 rounded-2xl shadow-sm border border-slate-100/80"
        >
          <div
            className="flex items-center justify-between cursor-pointer group select-none mb-3.5"
            onClick={() =>
              setShowAktivitasTerbaru(
                !showAktivitasTerbaru
              )
            }
          >
            <div className="flex items-center gap-2">

              <div
                className={`p-1.5 rounded-xl transition-colors duration-300 ${
                  showAktivitasTerbaru
                    ? "bg-brand-50 text-brand-600"
                    : "bg-slate-50 text-slate-400"
                }`}
              >
                <Clock size={15} />
              </div>

              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                Aktivitas Terbaru
              </h3>
            </div>

            <div className="flex items-center gap-2.5">

              <button
                id="view-all-sess-btn"
                onClick={(e) => {
                  e.stopPropagation();

                  onNavigateToTab(
                    "keuangan",
                    "rekening"
                  );
                }}
                className="text-[10px] font-black uppercase tracking-wider text-brand-600 bg-brand-50/60 hover:bg-brand-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                Semua
              </button>

              <div className="p-1 rounded-md group-hover:bg-slate-50 transition-colors">
                {showAktivitasTerbaru ? (
                  <ChevronUp
                    size={15}
                    className="text-slate-400"
                  />
                ) : (
                  <ChevronDown
                    size={15}
                    className="text-slate-400"
                  />
                )}
              </div>

            </div>
          </div>

          {showAktivitasTerbaru && (
            <div className="relative pl-1.5 space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-[1.5px] before:bg-slate-100">

              {(db.sessions || [])
                .slice(0, 4)
                .map((s) => (
                  <div
                    key={s.id}
                    id={`activity-sess-${s.id}`}
                    className="relative flex items-start gap-3.5 group/item cursor-default"
                  >
                    <div className="relative z-10 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-300 group-hover/item:border-brand-500 group-hover/item:scale-125 transition-all mt-1.5 shrink-0 shadow-2xs" />

                    <div className="flex-1 min-w-0 bg-slate-50/40 group-hover/item:bg-slate-50 border border-slate-100/50 group-hover/item:border-brand-100 p-3 rounded-xl transition-all duration-300 flex flex-col gap-1">

                      <div className="flex justify-between items-start gap-2 w-full">

                        <div className="flex flex-col min-w-0">

                          <p className="text-xs font-black text-slate-800 leading-tight truncate">
                            {s.siswaNama}
                          </p>

                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                            Tutor:{" "}
                            <span className="text-slate-600 font-bold">
                              {s.tutorNama}
                            </span>
                          </p>

                        </div>

                        <span className="text-[9px] text-slate-400 font-bold bg-white border border-slate-100 px-1.5 py-0.5 rounded-md shadow-2xs whitespace-nowrap">
                          {formatTanggalIndo(
                            s.tanggal
                          )}
                        </span>

                      </div>

                      <div className="mt-1 flex items-center justify-between">

                        <span className="inline-block text-[9px] font-extrabold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
                          {s.programNama}
                        </span>

                        <BookOpen
                          size={11}
                          className="text-slate-300 group-hover/item:text-brand-400 opacity-0 group-hover/item:opacity-100 transition-all"
                        />

                      </div>
                    </div>
                  </div>
                ))}

              {(!db.sessions ||
                db.sessions.length === 0) && (
                <div className="text-center py-6 flex flex-col items-center justify-center gap-1.5">

                  <BookOpen
                    size={24}
                    className="text-slate-300"
                  />

                  <p className="text-xs font-medium text-slate-400">
                    Belum ada riwayat pertemuan.
                  </p>

                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
  );
}