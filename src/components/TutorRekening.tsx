import React, { useState } from "react";
import {
  Download,
  Pencil,
  Info
} from "lucide-react";
import {
  Database,
  LedgerContext,
  formatRupiah,
  formatTanggalIndo,
  getTutorHonorBalance,
  updateTransactionAmount,
  updateSessionDetails,
  findTransactionSource
} from "../lib/db";
import { downloadSlipGajiPDF } from "../lib/pdfGenerator";

interface TutorRekeningProps {
  db: Database;
  tutorId: string;
  // WAJIB: harus memakai handler yang sama dengan AdminKeuangan (yang mengubah state db
  // di parent dan memicu sinkronisasi), supaya perubahan benar-benar tersimpan.
  onUpdateDb: (newDb: Database) => void;
}

interface EditTarget {
  refId: string;
  context: LedgerContext;
  keterangan: string;
}

export default function TutorRekening({ db, tutorId, onUpdateDb }: TutorRekeningProps) {
  const [subTab, setSubTab] = useState<"mutasi" | "slips">("mutasi");

  const tutor = db.tutors.find(t => t.id === tutorId)!;
  const ledger = db.tutorLedger.filter(tx => tx.tutorId === tutorId);
  const slips = db.slips.filter(sl => sl.tutorId === tutorId);

  const currentOwed = getTutorHonorBalance(db, tutorId);

  // Daftar siswa & program (untuk edit absensi)
  const sortedStudents = [...(db.students || [])].sort((a, b) =>
    (a.id || "").localeCompare(b.id || "", undefined, { numeric: true, sensitivity: "base" })
  );

  // Edit state
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editJumlah, setEditJumlah] = useState(0);
  const [editSiswaId, setEditSiswaId] = useState("");
  const [editProgramId, setEditProgramId] = useState("");

  // Terapkan hasil perubahan lewat parent
  const applyDb = (nextDb: Database) => {
    onUpdateDb(nextDb);
  };

  const getEditHint = (refId: string): string => {
    const kind = findTransactionSource(db, refId);
    if (kind === "session") {
      return "Nominal honor tutor untuk sesi ini. Jika program diganti, honor dan tarif siswa otomatis mengikuti program baru (nominal masih bisa diubah manual).";
    }
    if (kind === "slip") {
      return "Total honor (sebelum potongan). Potongan tetap, nominal bersih di Buku Kas ikut menyesuaikan.";
    }
    return "";
  };

  const openEdit = (refId: string, context: LedgerContext, keterangan: string, jumlah: number) => {
    setEditTarget({ refId, context, keterangan });
    setEditJumlah(jumlah);

    const session = db.sessions.find(s => s.id === refId);
    if (session) {
      setEditSiswaId(session.siswaId);
      setEditProgramId(session.programId);
    } else {
      setEditSiswaId("");
      setEditProgramId("");
    }
  };

  const handleEditProgramChange = (programId: string) => {
    setEditProgramId(programId);
    const prog = db.programs.find(p => p.id === programId);
    if (prog) {
      setEditJumlah(Number(prog.honorTutor) || 0);
    }
  };

  const handleEditSiswaChange = (siswaId: string) => {
    setEditSiswaId(siswaId);
    const st = db.students.find(x => x.id === siswaId);
    if (st?.programId && st.programId !== editProgramId) {
      handleEditProgramChange(st.programId);
    }
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editJumlah || editJumlah <= 0) {
      alert("Nominal harus lebih dari 0.");
      return;
    }
    try {
      const isSession = findTransactionSource(db, editTarget.refId) === "session";
      const nextDb = isSession
        ? updateSessionDetails(db, editTarget.refId, {
            siswaId: editSiswaId,
            programId: editProgramId,
            nominal: Number(editJumlah),
            context: editTarget.context
          })
        : updateTransactionAmount(
            db,
            editTarget.refId,
            Number(editJumlah),
            editTarget.context
          );
      applyDb(nextDb);
      setEditTarget(null);
    } catch (err: any) {
      alert(err?.message || "Gagal mengubah transaksi.");
    }
  };

  // Tutor hanya boleh MENGEDIT absensi harian (riwayat pertemuan).
  // Tidak ada hapus, dan honor/slip gaji tidak bisa diedit.
  const renderRowActions = (
    refId: string | undefined,
    keterangan: string,
    jumlah: number
  ) => {
    if (!refId || findTransactionSource(db, refId) !== "session") {
      return <span className="text-slate-300 text-[10px]">-</span>;
    }
    return (
      <div className="flex items-center justify-center">
        <button
          type="button"
          title="Edit absensi"
          onClick={() => openEdit(refId, "honor", keterangan, jumlah)}
          className="p-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 cursor-pointer active:scale-95 transition-all"
        >
          <Pencil size={12} />
        </button>
      </div>
    );
  };

  const showActions = true;

  return (
    <div id="tutor-rekening-container" className="px-4 py-4 pb-20">

      {/* Financial Summary card */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-3xl shadow-sm flex flex-col gap-1 mb-5 relative overflow-hidden">
        <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-white/5 rounded-full" />
        <span className="text-[9.5px] text-indigo-100 uppercase tracking-widest font-bold">Saldo Honor Anda</span>
        <h2 className="text-3xl font-black font-mono tracking-tight">{formatRupiah(currentOwed)}</h2>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 bg-white p-1 rounded-xl border border-slate-100 shadow-2xs mb-5">
        <button
          id="tab-mutasi-honor"
          onClick={() => setSubTab("mutasi")}
          className={`py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
            subTab === "mutasi" ? "bg-indigo-50 text-indigo-600 font-extrabold" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          Mutasi Honor
        </button>
        <button
          id="tab-slips-honor"
          onClick={() => setSubTab("slips")}
          className={`py-2 text-xs font-bold rounded-lg cursor-pointer transition-all ${
            subTab === "slips" ? "bg-indigo-50 text-indigo-600 font-extrabold" : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          Slip Gaji ({slips.length})
        </button>
      </div>

      {/* 1. MUTASI ACCOUNT TABUNGAN */}
      {subTab === "mutasi" && (
        <div className="space-y-3">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Riwayat Mutasi</p>

          <div className="border border-slate-100 rounded-2xl bg-white overflow-hidden overflow-x-auto scrollbar-none text-[11px] shadow-3xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-bold uppercase text-[8.5px] border-b border-slate-100">
                  <th className="p-2.5">Tanggal</th>
                  <th className="p-2.5">Keterangan</th>
                  <th className="p-2.5 text-right">Debit (Penarikan)</th>
                  <th className="p-2.5 text-right">Kredit (Pendapatan)</th>
                  <th className="p-2.5 text-right">Saldo</th>
                  {showActions && <th className="p-2.5 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {[...ledger].sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || "")).map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="p-2.5 font-medium font-mono text-slate-500 whitespace-nowrap">{formatTanggalIndo(item.tanggal)}</td>
                    <td className="p-2.5 font-semibold text-slate-700 leading-tight">{item.keterangan}</td>
                    <td className="p-2.5 text-right font-mono font-medium text-rose-500">{item.tipe === "debit" ? formatRupiah(item.jumlah) : "-"}</td>
                    <td className="p-2.5 text-right font-mono font-medium text-emerald-600">{item.tipe === "kredit" ? formatRupiah(item.jumlah) : "-"}</td>
                    <td className="p-2.5 text-right font-mono font-semibold text-slate-600">{formatRupiah(item.saldoBerjalan)}</td>
                    {showActions && (
                      <td className="p-2.5">
                        {renderRowActions((item as any).referensiId, item.keterangan, item.jumlah)}
                      </td>
                    )}
                  </tr>
                ))}

                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={showActions ? 6 : 5} className="p-6 text-center text-xs text-slate-400">Belum ada catatan mutasi tabungan honor.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. SALARY SLIPS TAB */}
      {subTab === "slips" && (
        <div className="space-y-3.5">
          {[...slips].sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || "")).map((sl) => (
            <div
              key={sl.id}
              id={`slip-card-${sl.id}`}
              className="bg-white p-4 rounded-2xl border border-slate-100 shadow-3xs flex items-center justify-between hover:border-brand-300 transition-all"
            >
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9.5px] font-bold font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                    {sl.id}
                  </span>
                  <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    {sl.periode}
                  </span>
                </div>
                <h4 className="text-xs font-black text-slate-800 leading-tight mt-2">Diterima: {formatTanggalIndo(sl.tanggal)}</h4>
                <p className="text-[11px] font-black font-mono text-indigo-600 mt-1">{formatRupiah(sl.jumlah)}</p>
                {sl.potongan && sl.potongan > 0 ? (
                  <p className="text-[10px] text-amber-600 font-bold mt-0.5">
                    Potongan: -{formatRupiah(sl.potongan)} {sl.keteranganPotongan ? `(${sl.keteranganPotongan})` : ""}
                  </p>
                ) : null}
                {sl.catatan && (
                  <p className="text-[10px] text-slate-400 truncate mt-1">Catatan: {sl.catatan}</p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  id={`download-slip-btn-${sl.id}`}
                  onClick={() => downloadSlipGajiPDF(sl, tutor, ledger)}
                  className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer border border-indigo-100 active:scale-95"
                  title="Download PDF Slip Gaji"
                >
                  <Download size={15} />
                </button>
              </div>
            </div>
          ))}

          {slips.length === 0 && (
            <p className="text-center py-12 text-xs text-slate-400">Anda belum menerima Slip Gaji resmi.</p>
          )}
        </div>
      )}

      {/* EDIT MODAL */}
      {editTarget && (
        <div id="tutor-edit-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl overflow-hidden animate-slide-up">
            <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-tight">
                {findTransactionSource(db, editTarget.refId) === "session" ? "Edit Absensi / Pertemuan" : "Edit Nominal Transaksi"}
              </h3>
              <Pencil size={18} />
            </div>

            <form onSubmit={handleEditSave} className="p-5 space-y-4">
              <p className="text-xs text-slate-600 font-semibold leading-snug">{editTarget.keterangan}</p>

              {findTransactionSource(db, editTarget.refId) === "session" && (
                <>
                  <div>
                    <label className="block text-[10.5px] text-slate-400 font-bold uppercase tracking-wider mb-1">Nama Siswa *</label>
                    <select
                      value={editSiswaId}
                      onChange={(e) => handleEditSiswaChange(e.target.value)}
                      className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    >
                      {sortedStudents.map((s) => (
                        <option key={s.id} value={s.id}>{s.nama} ({s.id})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10.5px] text-slate-400 font-bold uppercase tracking-wider mb-1">Program Belajar *</label>
                    <select
                      value={editProgramId}
                      onChange={(e) => handleEditProgramChange(e.target.value)}
                      className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    >
                      {db.programs.map((p) => (
                        <option key={p.id} value={p.id}>{p.nama}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-50">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
