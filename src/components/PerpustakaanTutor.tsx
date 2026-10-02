import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Search,
  BookOpen,
  Library,
  Info,
  Clock,
  History,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageCircle
} from "lucide-react";
import { Database } from "../lib/db";
import { buildWaLink } from "../lib/whatsapp";
import {
  BookItem,
  LibraryLoan,
  RegulasiItem,
  getBooks,
  getMyLoans,
  getRegulasi,
  submitLoan
} from "../lib/libraryApi";

interface PerpustakaanTutorProps {
  db: Database;
  tutorId: string;
  tutorNama: string;
  onBack: () => void;
  onUpdateDb: (newDb: Database) => void;
}

type SubTab = "katalog" | "bukuSaya" | "riwayat";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  menunggu: { label: "Menunggu Verifikasi", className: "bg-amber-50 text-amber-700" },
  dipinjam: { label: "Dipinjam", className: "bg-brand-50 text-brand-700" },
  ditolak: { label: "Ditolak", className: "bg-rose-50 text-rose-700" },
  dikembalikan: { label: "Dikembalikan", className: "bg-slate-100 text-slate-500" }
};

export default function PerpustakaanTutor({
  tutorId,
  tutorNama,
  onBack
}: PerpustakaanTutorProps) {
  const [subTab, setSubTab] = useState<SubTab>("katalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllBooks, setShowAllBooks] = useState(false);

  const [books, setBooks] = useState<BookItem[]>([]);
  const [regulasi, setRegulasi] = useState<RegulasiItem[]>([]);
  const [myLoans, setMyLoans] = useState<LibraryLoan[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedBook, setSelectedBook] = useState<BookItem | null>(null);
  const [agreeRegulasi, setAgreeRegulasi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    try {
      const [booksRes, regulasiRes, loansRes] = await Promise.all([
        getBooks(),
        getRegulasi(),
        getMyLoans(tutorId)
      ]);
      setBooks(booksRes);
      setRegulasi(regulasiRes);
      setMyLoans(loansRes);
    } catch (error: any) {
      setLoadError(
        error?.message ||
          "Gagal memuat data Perpustakaan. Periksa koneksi internet Anda."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredBooks = books.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.judul?.toLowerCase().includes(q) ||
      b.penulis?.toLowerCase().includes(q)
    );
  });

  const displayedBooks = showAllBooks
    ? filteredBooks
    : filteredBooks.slice(0, 6);

  const sedangDipinjam = myLoans.filter((l) => l.status === "dipinjam");

  async function handleAjukanPeminjaman() {
    if (!selectedBook || !agreeRegulasi) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      await submitLoan({
        user_id: tutorId,
        nama_user: tutorNama,
        role_user: "tutor",
        id_buku: selectedBook.id_buku,
        judul_buku: selectedBook.judul
      });
      setSubmitMsg({
        type: "success",
        text: "Pengajuan peminjaman berhasil dikirim! Menunggu verifikasi petugas Perpustakaan."
      });
      setAgreeRegulasi(false);
      await loadAll();
    } catch (error: any) {
      setSubmitMsg({
        type: "error",
        text: error?.message || "Gagal mengajukan peminjaman."
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div id="perpustakaan-tutor-container" className="px-4 py-4 pb-20">
      <div className="flex items-center gap-2 mb-5 border-b border-slate-100 pb-3">
        <button
          type="button"
          onClick={onBack}
          className="text-slate-400 hover:text-brand-600 transition-all p-1 hover:bg-slate-100 rounded-full cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="text-left">
          <h2 className="text-xs font-extrabold text-brand-800 tracking-tight uppercase">
            Perpustakaan
          </h2>
          <p className="text-[10px] text-brand-400">
            Katalog, peminjaman, dan riwayat buku Anda
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <Loader2 size={22} className="text-brand-500 animate-spin" />
          <p className="text-[11px] text-brand-400 font-medium">Memuat data Perpustakaan...</p>
        </div>
      )}

      {!loading && loadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col items-center text-center gap-2">
          <AlertTriangle size={22} className="text-rose-400" />
          <p className="text-[11px] text-rose-600 font-medium">{loadError}</p>
          <button
            type="button"
            onClick={loadAll}
            className="text-[10.5px] font-bold text-brand-600 underline"
          >
            Coba lagi
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul atau penulis buku..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-100 focus:border-brand-300 transition-all"
            />
          </div>

          <div className="grid grid-cols-3 bg-white p-1 rounded-xl border border-slate-100 shadow-2xs mb-5">
            <button
              onClick={() => setSubTab("katalog")}
              className={"py-2 text-[10.5px] font-bold rounded-lg cursor-pointer transition-all " + (subTab === "katalog" ? "bg-brand-600 text-white shadow-sm" : "text-slate-400")}
            >
              Katalog
            </button>
            <button
              onClick={() => setSubTab("bukuSaya")}
              className={"py-2 text-[10.5px] font-bold rounded-lg cursor-pointer transition-all " + (subTab === "bukuSaya" ? "bg-brand-600 text-white shadow-sm" : "text-slate-400")}
            >
              Buku Saya
              {sedangDipinjam.length > 0 && (
                <span className="ml-1 bg-white/25 rounded-full px-1.5">{sedangDipinjam.length}</span>
              )}
            </button>
            <button
              onClick={() => setSubTab("riwayat")}
              className={"py-2 text-[10.5px] font-bold rounded-lg cursor-pointer transition-all " + (subTab === "riwayat" ? "bg-brand-600 text-white shadow-sm" : "text-slate-400")}
            >
              Riwayat
            </button>
          </div>

          {subTab === "katalog" && (
            <div className="space-y-5">
              <div className="relative bg-brand-600 border border-brand-200 p-3 pt-5 rounded-lg shadow-3xs">
                <div className="absolute -top-2 left-3 flex items-center gap-1 bg-amber-500 text-white px-2 py-0.5 rounded-lg text-[8.5px] font-extrabold uppercase tracking-wide">
                  <Info size={10} />
                  <span>Regulasi Peminjaman</span>
                </div>
                {regulasi.length === 0 ? (
                  <p className="text-[11px] font-medium text-white leading-relaxed">
                    Belum ada regulasi yang ditetapkan petugas Perpustakaan.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {regulasi
                      .slice()
                      .sort((a, b) => Number(a.urutan || 0) - Number(b.urutan || 0))
                      .map((r, idx) => (
                        <li key={idx} className="text-[11px] font-medium text-white leading-relaxed">
                          <span className="font-bold">{r.judul}</span> {r.isi}
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-blue-500 uppercase tracking-tight flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600">
                      <BookOpen size={14} />
                    </div>
                    {showAllBooks ? "Semua Buku" : "Buku Pilihan"}
                  </h3>
                </div>

                {filteredBooks.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-3xs flex flex-col items-center justify-center text-center gap-2">
                    <Library size={28} className="text-slate-200" />
                    <p className="text-[11px] text-slate-400 font-medium">
                      {searchQuery ? "Buku tidak ditemukan." : "Belum ada buku di katalog."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {displayedBooks.map((book) => (
                      <button
                        key={book.id_buku}
                        onClick={() => {
                          setSelectedBook(book);
                          setSubmitMsg(null);
                          setAgreeRegulasi(false);
                        }}
                        className="bg-white rounded-2xl border border-blue-400 shadow-3xs overflow-hidden text-left flex flex-col cursor-pointer active:scale-95 transition-all"
                      >
                        <div className="w-full aspect-[4/4] bg-slate-50 flex items-center justify-center overflow-hidden">
                          {book.cover_url ? (
                            <img
                              src={book.cover_url}
                              alt={book.judul}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <BookOpen size={26} className="text-slate-200" />
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="text-[11px] font-black text-slate-800 leading-tight line-clamp-2">
                            {book.judul}
                          </p>
                          <p className="text-[9.5px] text-slate-400 font-medium mt-0.5 truncate">
                            {book.penulis || "-"}
                          </p>
                          <span
                            className={"inline-block mt-1.5 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full " + (Number(book.stok_tersedia) > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}
                          >
                            {Number(book.stok_tersedia) > 0 ? "Tersedia" : "Habis"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {!showAllBooks && filteredBooks.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllBooks(true)}
                    className="bg-brand-500 w-full mt-3 py-2.5 rounded-xl border border-slate-200 text-brand-200 text-[11px] font-bold hover:bg-brand-50 transition-colors"
                  >
                    Lihat Semua Buku
                  </button>
                )}
              </div>
            </div>
          )}

          {subTab === "bukuSaya" && (
            <div className="space-y-2.5">
              {sedangDipinjam.length === 0 ? (
                <div className="bg-brand-600 p-6 rounded-2xl border border-slate-100 shadow-3xs flex flex-col items-center justify-center text-center gap-2">
                  <Clock size={28} className="text-slate-50" />
                  <p className="text-[11px] text-slate-50 font-medium">
                    Belum ada buku yang sedang dipinjam.
                  </p>
                </div>
              ) : (
                sedangDipinjam.map((loan) => (
                  <div
                    key={loan.id_peminjaman}
                    className="bg-brand-600 p-6 rounded-2xl border border-slate-100 shadow-3xs space-y-2.5"
                  >
                    <div>
                      <p className="text-[12px] font-black text-slate-100">{loan.judul_buku}</p>
                      <p className="text-[10px] text-slate-50 font-medium mt-1">
                        Dipinjam:{" "}
                        {loan.tanggal_pinjam
                          ? new Date(loan.tanggal_pinjam).toLocaleDateString("id-ID")
                          : "-"}{" "}
                        &middot; Jatuh tempo:{" "}
                        {loan.tanggal_jatuh_tempo
                          ? new Date(loan.tanggal_jatuh_tempo).toLocaleDateString("id-ID")
                          : "-"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          buildWaLink(
                            `Halo Admin, saya ${tutorNama} ingin mengembalikan buku "${loan.judul_buku}" yang saya pinjam. Mohon dikonfirmasi pengembaliannya. Terima kasih.`
                          ),
                          "_blank"
                        )
                      }
                      className="w-full py-2 rounded-xl bg-emerald-50 text-emerald-700 text-[10.5px] font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle size={13} />
                      Kembalikan Buku
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {subTab === "riwayat" && (
            <div className="space-y-2.5">
              {myLoans.length === 0 ? (
                <div className="bg-brand-600 p-6 rounded-2xl border border-slate-100 shadow-3xs flex flex-col items-center justify-center text-center gap-2">
                  <History size={28} className="text-slate-50" />
                  <p className="text-[11px] text-slate-50 font-medium">
                    Riwayat peminjaman akan tampil di sini.
                  </p>
                </div>
              ) : (
                myLoans
                  .slice()
                  .reverse()
                  .map((loan) => {
                    const badge = STATUS_BADGE[loan.status] || {
                      label: loan.status,
                      className: "bg-slate-100 text-slate-500"
                    };
                    return (
                      <div
                        key={loan.id_peminjaman}
                        className="bg-blue-600 p-7 rounded-2xl border border-slate-100 shadow-3xs flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-[12px] font-black text-slate-100 truncate">{loan.judul_buku}</p>
                          <p className="text-[10px] text-slate-50 font-medium mt-0.5">
                            Diajukan:{" "}
                            {loan.tanggal_pengajuan
                              ? new Date(loan.tanggal_pengajuan).toLocaleDateString("id-ID")
                              : "-"}
                          </p>
                        </div>
                        <span className={"shrink-0 text-[9px] font-bold px-2 py-1 rounded-full " + badge.className}>
                          {badge.label}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </>
      )}

      {selectedBook && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end md:items-center justify-center z-55"
          onClick={() => setSelectedBook(null)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-t-3xl md:rounded-3xl shadow-xl overflow-hidden max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full aspect-[16/9] bg-slate-50 flex items-center justify-center overflow-hidden">
              {selectedBook.cover_url ? (
                <img
                  src={selectedBook.cover_url}
                  alt={selectedBook.judul}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <BookOpen size={40} className="text-slate-200" />
              )}
            </div>

            <div className="p-5 space-y-3">
              <div>
                <h3 className="text-base font-black text-slate-800 leading-tight">{selectedBook.judul}</h3>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  {selectedBook.penulis || "-"} &middot; {selectedBook.penerbit || "-"} &middot;{" "}
                  {selectedBook.tahun_terbit || "-"}
                </p>
              </div>

              {selectedBook.deskripsi && (
                <p className="text-[11.5px] text-slate-600 leading-relaxed">{selectedBook.deskripsi}</p>
              )}

              <div className="flex items-center gap-3 text-[10.5px] text-slate-500 font-medium">
                <span>Lokasi rak: {selectedBook.lokasi_rak || "-"}</span>
                <span>&middot;</span>
                <span>Stok tersedia: {selectedBook.stok_tersedia ?? 0}</span>
              </div>

              {submitMsg && (
                <div
                  className={"flex items-start gap-2 p-3 rounded-xl text-[11px] font-medium " + (submitMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}
                >
                  {submitMsg.type === "success" ? (
                    <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={15} className="shrink-0 mt-0.5" />
                  )}
                  <span>{submitMsg.text}</span>
                </div>
              )}

              {submitMsg?.type === "success" && selectedBook && (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      buildWaLink(
                        `Halo Admin, saya ${tutorNama} mengajukan peminjaman buku "${selectedBook.judul}" di Perpustakaan. Mohon diverifikasi. Terima kasih.`
                      ),
                      "_blank"
                    )
                  }
                  className="w-full py-3 rounded-xl bg-emerald-500 text-white text-[12px] font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle size={15} />
                  Kirim Notifikasi ke WhatsApp Admin
                </button>
              )}

              {Number(selectedBook.stok_tersedia) > 0 &&
                !(submitMsg && submitMsg.type === "success") && (
                  <>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreeRegulasi}
                        onChange={(e) => setAgreeRegulasi(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span className="text-[10.5px] text-slate-500 font-medium leading-relaxed">
                        Saya telah membaca dan menyetujui Regulasi Peminjaman yang berlaku.
                      </span>
                    </label>

                    <button
                      type="button"
                      disabled={!agreeRegulasi || submitting}
                      onClick={handleAjukanPeminjaman}
                      className="w-full py-3 rounded-xl bg-brand-600 text-white text-[12px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
                    >
                      {submitting && <Loader2 size={14} className="animate-spin" />}
                      Ajukan Peminjaman
                    </button>
                  </>
                )}

              {Number(selectedBook.stok_tersedia) <= 0 && (
                <div className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 text-[12px] font-bold text-center">
                  Buku Tidak Tersedia
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
