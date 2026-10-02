import React, { useEffect, useState } from "react";
import {
  Library,
  BookOpen,
  Tag,
  ClipboardList,
  CheckCircle2,
  RotateCcw,
  Users,
  IdCard,
  ScanLine,
  FileWarning,
  BarChart3,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Plus,
  X,
  XCircle
} from "lucide-react";
import { Database } from "../lib/db";
import {
  BookItem,
  BookCategory,
  LibraryLoan,
  RegulasiItem,
  LibraryDashboardStats,
  getBooks,
  getCategories,
  getAllLoans,
  getRegulasi,
  getLibraryDashboard,
  createBook,
  updateBook,
  deleteBook,
  createCategory,
  approveLoan,
  rejectLoan,
  returnBook
} from "../lib/libraryApi";
import { generateKartuAnggotaPDF } from "../lib/kartuAnggotaPdf";
import { getQrImageUrl } from "../lib/qrCode";
import ScanKartuPanel from "./ScanKartuPanel";

interface PerpustakaanDashboardProps {
  db: Database;
  onUpdateDb: (newDb: Database) => void;
  petugasNama: string;
}

type MenuId =
  | "buku"
  | "kategori"
  | "peminjaman"
  | "verifikasi"
  | "pengembalian"
  | "anggota"
  | "kartu"
  | "scan"
  | "regulasi"
  | "laporan";

const MENU_ITEMS: {
  id: MenuId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  boxClass: string;
  ready: boolean;
}[] = [
  { id: "buku", label: "Kelola Buku", icon: BookOpen, boxClass: "bg-brand-50 text-brand-600", ready: true },
  { id: "kategori", label: "Kategori Buku", icon: Tag, boxClass: "bg-blue-50 text-blue-600", ready: true },
  { id: "peminjaman", label: "Peminjaman", icon: ClipboardList, boxClass: "bg-amber-50 text-amber-600", ready: true },
  { id: "verifikasi", label: "Verifikasi Peminjaman", icon: CheckCircle2, boxClass: "bg-emerald-50 text-emerald-600", ready: true },
  { id: "pengembalian", label: "Pengembalian", icon: RotateCcw, boxClass: "bg-indigo-50 text-indigo-600", ready: true },
  { id: "anggota", label: "Anggota", icon: Users, boxClass: "bg-purple-50 text-purple-600", ready: true },
];

export default function PerpustakaanDashboard({ db, petugasNama }: PerpustakaanDashboardProps) {
  const [activeMenu, setActiveMenu] = useState<MenuId | null>(null);

  const [stats, setStats] = useState<LibraryDashboardStats | null>(null);
  const [books, setBooks] = useState<BookItem[]>([]);
  const [categories, setCategories] = useState<BookCategory[]>([]);
  const [loans, setLoans] = useState<LibraryLoan[]>([]);
  const [regulasi, setRegulasi] = useState<RegulasiItem[]>([]);

  const [loadingAll, setLoadingAll] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBook, setEditingBook] = useState<BookItem | null>(null);
  const [bookForm, setBookForm] = useState({
    judul: "", penulis: "", penerbit: "", tahun_terbit: "", isbn: "",
    kode_buku: "", kategori_id: "", deskripsi: "", cover_url: "",
    lokasi_rak: "", stok_total: "1"
  });
  const [savingBook, setSavingBook] = useState(false);

  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState({ nama: "", deskripsi: "" });
  const [savingCat, setSavingCat] = useState(false);

  const [selectedAnggotaIds, setSelectedAnggotaIds] = useState<string[]>([]);
  const [previewAnggota, setPreviewAnggota] = useState<{ id: string; nama: string } | null>(null);
  const [printing, setPrinting] = useState(false);

  async function loadAll() {
    setLoadingAll(true);
    setLoadError("");
    try {
      const [statsRes, booksRes, catsRes, loansRes, regulasiRes] = await Promise.all([
        getLibraryDashboard(),
        getBooks(),
        getCategories(),
        getAllLoans(),
        getRegulasi()
      ]);
      setStats(statsRes);
      setBooks(booksRes);
      setCategories(catsRes);
      setLoans(loansRes);
      setRegulasi(regulasiRes);
    } catch (error: any) {
      setLoadError(error?.message || "Gagal memuat data Perpustakaan.");
    } finally {
      setLoadingAll(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const activeMenuItem = MENU_ITEMS.find((m) => m.id === activeMenu);

  function categoryName(id?: string) {
    return categories.find((c) => c.id === id)?.nama || "-";
  }

  async function handleSaveBook() {
    if (!bookForm.judul.trim()) return;
    setSavingBook(true);
    try {
      if (editingBook) {
        await updateBook({ id_buku: editingBook.id_buku, ...bookForm, stok_total: Number(bookForm.stok_total) as any });
      } else {
        await createBook({ ...bookForm, stok_total: Number(bookForm.stok_total) as any });
      }
      setShowBookForm(false);
      setEditingBook(null);
      setBookForm({ judul: "", penulis: "", penerbit: "", tahun_terbit: "", isbn: "", kode_buku: "", kategori_id: "", deskripsi: "", cover_url: "", lokasi_rak: "", stok_total: "1" });
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Gagal menyimpan buku.");
    } finally {
      setSavingBook(false);
    }
  }

  function openEditBook(book: BookItem) {
    setEditingBook(book);
    setBookForm({
      judul: book.judul || "",
      penulis: book.penulis || "",
      penerbit: book.penerbit || "",
      tahun_terbit: String(book.tahun_terbit || ""),
      isbn: book.isbn || "",
      kode_buku: book.kode_buku || "",
      kategori_id: book.kategori_id || "",
      deskripsi: book.deskripsi || "",
      cover_url: book.cover_url || "",
      lokasi_rak: book.lokasi_rak || "",
      stok_total: String(book.stok_total ?? 1)
    });
    setShowBookForm(true);
  }

  async function handleNonaktifkanBuku(idBuku: string) {
    if (!confirm("Nonaktifkan buku ini? Buku tidak akan muncul lagi di katalog Tutor.")) return;
    setBusyId(idBuku);
    try {
      await deleteBook(idBuku);
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Gagal menonaktifkan buku.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveCategory() {
    if (!catForm.nama.trim()) return;
    setSavingCat(true);
    try {
      await createCategory(catForm);
      setShowCatForm(false);
      setCatForm({ nama: "", deskripsi: "" });
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Gagal menyimpan kategori.");
    } finally {
      setSavingCat(false);
    }
  }

  async function handleApprove(loan: LibraryLoan) {
    setBusyId(loan.id_peminjaman);
    setActionMsg("");
    try {
      await approveLoan({ id_peminjaman: loan.id_peminjaman, verified_by: petugasNama });
      setActionMsg("Peminjaman disetujui.");
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Gagal menyetujui peminjaman.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(loan: LibraryLoan) {
    const alasan = prompt("Alasan penolakan (opsional):") || "";
    setBusyId(loan.id_peminjaman);
    try {
      await rejectLoan({ id_peminjaman: loan.id_peminjaman, verified_by: petugasNama, catatan_admin: alasan });
      setActionMsg("Peminjaman ditolak.");
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Gagal menolak peminjaman.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReturn(loan: LibraryLoan) {
    if (!confirm("Tandai buku \"" + loan.judul_buku + "\" sudah dikembalikan?")) return;
    setBusyId(loan.id_peminjaman);
    try {
      await returnBook({ id_peminjaman: loan.id_peminjaman });
      await loadAll();
    } catch (error: any) {
      alert(error?.message || "Gagal memproses pengembalian.");
    } finally {
      setBusyId(null);
    }
  }


  function toggleSelectAnggota(id: string) {
    setSelectedAnggotaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const pendingLoans = loans.filter((l) => l.status === "menunggu");
  const activeLoans = loans.filter((l) => l.status === "dipinjam");

  const anggotaMap = new Map<string, { nama: string; role: string; totalPinjam: number; sedangDipinjam: number }>();
  loans.forEach((l) => {
    const existing = anggotaMap.get(l.user_id) || { nama: l.nama_user, role: l.role_user, totalPinjam: 0, sedangDipinjam: 0 };
    existing.totalPinjam += 1;
    if (l.status === "dipinjam") existing.sedangDipinjam += 1;
    anggotaMap.set(l.user_id, existing);
  });

  const today = new Date();

  return (
    <div id="perpustakaan-dashboard-container" className="flex flex-col space-y-10">
      <div className="bg-gradient-to-br from-blue-500 to-brand-500 text-white p-6 rounded-b-[32px] shadow-lg mb-6 relative overflow-hidden">
        <div className="absolute top-[-30px] right-[-30px] w-36 h-36 bg-white/5 rounded-full" />
        <div className="flex items-center gap-2.5">
          <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center shrink-0">
            <Library size={26} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight font-display">Dashboard Perpustakaan</h2>
            <p className="text-xs text-brand-100 mt-1 font-medium">Kelola koleksi buku dan peminjaman</p>
          </div>
        </div>
      </div>

      <div className="px-2 md:px-0 pb-6 space-y-6">
        {loadingAll && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Loader2 size={22} className="text-brand-500 animate-spin" />
            <p className="text-[11px] text-slate-400 font-medium">Memuat data Perpustakaan...</p>
          </div>
        )}

        {!loadingAll && loadError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex flex-col items-center text-center gap-2">
            <AlertTriangle size={22} className="text-rose-400" />
            <p className="text-[11px] text-rose-600 font-medium">{loadError}</p>
            <button type="button" onClick={loadAll} className="text-[10.5px] font-bold text-brand-600 underline">Coba lagi</button>
          </div>
        )}

        {!loadingAll && !loadError && (
          <>
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  { 
                    label: "Total Buku", 
                    value: stats?.totalBuku ?? 0,
                    bgColor: "bg-slate-50/40",
                    labelColor: "text-blue-600",
                    valColor: "text-blue-900" 
                  },
                  { 
                    label: "Buku Tersedia", 
                    value: stats?.stokTersedia ?? 0,
                    bgColor: "bg-slate-50/40",
                    labelColor: "text-emerald-600",
                    valColor: "text-emerald-900" 
                  },
                  { 
                    label: "Sedang Dipinjam", 
                    value: stats?.sedangDipinjam ?? 0,
                    bgColor: "bg-slate-50/40",
                    labelColor: "text-amber-600",
                    valColor: "text-amber-900" 
                  },
                  { 
                    label: "Menunggu Verifikasi", 
                    value: stats?.menungguVerifikasi ?? 0,
                    bgColor: "bg-slate-50/40",
                    labelColor: "text-rose-600",
                    valColor: "text-rose-900" 
                  },
                ].map((item) => (
                  <div 
                    key={item.label} 
                    className={`${item.bgColor} p-3 rounded-2xl flex flex-col justify-between min-h-[75px] transition-all hover:scale-[1.02]`}
                  >
                    <p className={`text-[9px] ${item.labelColor} font-black uppercase tracking-wider text-left leading-tight`}>
                      {item.label}
                    </p>
                    <p className={`text-2xl font-black ${item.valColor} leading-none mt-1.5`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          <div className="bg-slate-50 p-2 rounded-lg">
            <p className="text-[12px] text-brand-600 font-black uppercase tracking-wider text-left mb-3">
              Menu Perpustakaan
            </p>
            <div className="flex flex-col gap-2.5">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeMenu === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveMenu(item.id)}
                    className={`bg-white p-6 rounded-2xl border shadow-3xs flex items-center justify-between text-left group cursor-pointer transition-all active:scale-[0.98] w-full relative ${
                      isActive ? "border-brand-500 ring-1 ring-brand-500" : "border-slate-100"
                    }`}
                  >
                    {/* Sisi Kiri: Icon & Teks */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 ${item.boxClass} rounded-xl flex items-center justify-center shrink-0`}>
                        <Icon size={20} />
                      </div>
                      
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12px] font-black text-slate-800 leading-tight truncate">
                          {item.label}
                        </span>
                        {item.description && (
                          <span className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5 truncate">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sisi Kanan: Badge Notification jika ada */}
                    {item.id === "verifikasi" && pendingLoans.length > 0 && (
                      <span className="bg-rose-500 text-white text-[9px] font-black rounded-full px-2 py-0.5 shrink-0 ml-2">
                        {pendingLoans.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          </>
        )}
      </div>

      {activeMenu && activeMenuItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end md:items-center justify-center z-55" onClick={() => setActiveMenu(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-brand-600 text-white p-4 flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => setActiveMenu(null)} className="text-white/80 hover:text-white transition-all cursor-pointer">
                <ArrowLeft size={16} />
              </button>
              <h3 className="font-bold text-sm tracking-tight">{activeMenuItem.label}</h3>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {activeMenu === "kartu" && (
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={selectedAnggotaIds.length === 0 || printing}
                    onClick={() => handleCetakKartu(selectedAnggotaIds)}
                    className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-[11px] font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {printing && <Loader2 size={14} className="animate-spin" />}
                    Cetak {selectedAnggotaIds.length > 0 ? `${selectedAnggotaIds.length} Kartu Terpilih` : "Kartu Terpilih"}
                  </button>

                  {db.tutors.length === 0 && (
                    <p className="text-[11px] text-slate-400 text-center py-6">Belum ada data Tutor.</p>
                  )}

                  {db.tutors.map((tutor) => (
                    <div key={tutor.id} className="bg-slate-50 p-3 rounded-xl flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedAnggotaIds.includes(tutor.id)}
                        onChange={() => toggleSelectAnggota(tutor.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11.5px] font-bold text-slate-800 truncate">{tutor.nama}</p>
                        <p className="text-[10px] text-slate-400 truncate">ID: {tutor.id}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewAnggota({ id: tutor.id, nama: tutor.nama })}
                        className="text-[10px] font-bold text-brand-600 px-2 py-1 rounded-lg hover:bg-brand-50 shrink-0"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        disabled={printing}
                        onClick={() => handleCetakKartu([tutor.id])}
                        className="text-[10px] font-bold text-slate-500 px-2 py-1 rounded-lg hover:bg-white shrink-0 disabled:opacity-40"
                      >
                        Cetak
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activeMenu === "scan" && <ScanKartuPanel db={db} />}

              {activeMenu === "buku" && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => { setEditingBook(null); setBookForm({ judul: "", penulis: "", penerbit: "", tahun_terbit: "", isbn: "", kode_buku: "", kategori_id: "", deskripsi: "", cover_url: "", lokasi_rak: "", stok_total: "1" }); setShowBookForm(true); }}
                    className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} /> Tambah Buku
                  </button>

                  {books.length === 0 && <p className="text-[11px] text-slate-400 text-center py-6">Belum ada buku.</p>}

                  {books.map((book) => (
                    <div key={book.id_buku} className="bg-slate-50 p-3 rounded-xl flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-bold text-slate-800 truncate">{book.judul}</p>
                        <p className="text-[10px] text-slate-400 truncate">{book.penulis || "-"} &middot; {categoryName(book.kategori_id)} &middot; Stok: {book.stok_tersedia}/{book.stok_total}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => openEditBook(book)} className="text-[10px] font-bold text-brand-600 px-2 py-1 rounded-lg hover:bg-brand-50">Edit</button>
                        <button
                          type="button"
                          disabled={busyId === book.id_buku}
                          onClick={() => handleNonaktifkanBuku(book.id_buku)}
                          className="text-[10px] font-bold text-rose-500 px-2 py-1 rounded-lg hover:bg-rose-50 disabled:opacity-40"
                        >
                          Nonaktifkan
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeMenu === "kategori" && (
                <div className="space-y-3">
                  <button type="button" onClick={() => setShowCatForm(true)} className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center gap-1.5">
                    <Plus size={14} /> Tambah Kategori
                  </button>
                  {categories.length === 0 && <p className="text-[11px] text-slate-400 text-center py-6">Belum ada kategori.</p>}
                  {categories.map((cat) => (
                    <div key={cat.id} className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-[11.5px] font-bold text-slate-800">{cat.nama}</p>
                      {cat.deskripsi && <p className="text-[10px] text-slate-400 mt-0.5">{cat.deskripsi}</p>}
                    </div>
                  ))}
                </div>
              )}

              {activeMenu === "peminjaman" && (
                <div className="space-y-2.5">
                  {loans.length === 0 && <p className="text-[11px] text-slate-400 text-center py-6">Belum ada peminjaman.</p>}
                  {loans.slice().reverse().map((loan) => (
                    <div key={loan.id_peminjaman} className="bg-slate-50 p-3 rounded-xl flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-bold text-slate-800 truncate">{loan.judul_buku}</p>
                        <p className="text-[10px] text-slate-400 truncate">{loan.nama_user} &middot; {loan.role_user}</p>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-500 shrink-0">{loan.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {activeMenu === "verifikasi" && (
                <div className="space-y-2.5">
                  {actionMsg && <p className="text-[11px] text-emerald-600 font-bold text-center">{actionMsg}</p>}
                  {pendingLoans.length === 0 && <p className="text-[11px] text-slate-400 text-center py-6">Tidak ada pengajuan yang menunggu verifikasi.</p>}
                  {pendingLoans.map((loan) => (
                    <div key={loan.id_peminjaman} className="bg-slate-50 p-3 rounded-xl space-y-2">
                      <div>
                        <p className="text-[11.5px] font-bold text-slate-800">{loan.judul_buku}</p>
                        <p className="text-[10px] text-slate-400">Pemohon: {loan.nama_user} ({loan.role_user})</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === loan.id_peminjaman}
                          onClick={() => handleApprove(loan)}
                          className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-[10.5px] font-bold disabled:opacity-40"
                        >
                          Setujui
                        </button>
                        <button
                          type="button"
                          disabled={busyId === loan.id_peminjaman}
                          onClick={() => handleReject(loan)}
                          className="flex-1 py-2 rounded-lg bg-rose-50 text-rose-600 text-[10.5px] font-bold disabled:opacity-40"
                        >
                          Tolak
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeMenu === "pengembalian" && (
                <div className="space-y-2.5">
                  {activeLoans.length === 0 && <p className="text-[11px] text-slate-400 text-center py-6">Tidak ada buku yang sedang dipinjam.</p>}
                  {activeLoans.map((loan) => {
                    const terlambat = loan.tanggal_jatuh_tempo ? new Date(loan.tanggal_jatuh_tempo) < today : false;
                    return (
                      <div key={loan.id_peminjaman} className="bg-slate-50 p-3 rounded-xl flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-bold text-slate-800 truncate">{loan.judul_buku}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {loan.nama_user} &middot; Jatuh tempo: {loan.tanggal_jatuh_tempo ? new Date(loan.tanggal_jatuh_tempo).toLocaleDateString("id-ID") : "-"}
                            {terlambat && <span className="text-rose-500 font-bold"> &middot; Terlambat</span>}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busyId === loan.id_peminjaman}
                          onClick={() => handleReturn(loan)}
                          className="text-[10px] font-bold text-brand-600 px-2.5 py-1.5 rounded-lg bg-white border border-brand-200 shrink-0 disabled:opacity-40"
                        >
                          Tandai Dikembalikan
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeMenu === "anggota" && (
                <div className="space-y-2.5">
                  {anggotaMap.size === 0 && <p className="text-[11px] text-slate-400 text-center py-6">Belum ada anggota yang pernah meminjam.</p>}
                  {Array.from(anggotaMap.entries()).map(([userId, info]) => (
                    <div key={userId} className="bg-slate-50 p-3 rounded-xl flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11.5px] font-bold text-slate-800 truncate">{info.nama}</p>
                        <p className="text-[10px] text-slate-400 truncate">{info.role} &middot; Total pinjam: {info.totalPinjam}</p>
                      </div>
                      {info.sedangDipinjam > 0 && (
                        <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-brand-50 text-brand-700 shrink-0">{info.sedangDipinjam} dipinjam</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeMenu === "regulasi" && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                    <p className="text-[10.5px] text-amber-800 font-medium leading-relaxed">
                      Untuk mengubah atau menambah regulasi, edit langsung sheet "Regulasi" di Google Spreadsheet Perpustakaan -- tidak perlu mengubah kode aplikasi.
                    </p>
                  </div>
                  {regulasi.length === 0 && <p className="text-[11px] text-slate-400 text-center py-6">Belum ada regulasi.</p>}
                  {regulasi.slice().sort((a, b) => Number(a.urutan || 0) - Number(b.urutan || 0)).map((r, idx) => (
                    <div key={idx} className="bg-slate-50 p-3 rounded-xl">
                      <p className="text-[11.5px] font-bold text-slate-800">{r.judul}</p>
                      <p className="text-[10.5px] text-slate-500 mt-0.5">{r.isi}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeMenu === "laporan" && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[9px] text-slate-400 font-black uppercase">Total Peminjaman</p><p className="text-xl font-black text-slate-800 mt-1">{loans.length}</p></div>
                    <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[9px] text-slate-400 font-black uppercase">Sedang Dipinjam</p><p className="text-xl font-black text-slate-800 mt-1">{activeLoans.length}</p></div>
                    <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[9px] text-slate-400 font-black uppercase">Menunggu Verifikasi</p><p className="text-xl font-black text-slate-800 mt-1">{pendingLoans.length}</p></div>
                    <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[9px] text-slate-400 font-black uppercase">Total Anggota Aktif</p><p className="text-xl font-black text-slate-800 mt-1">{anggotaMap.size}</p></div>
                  </div>
                  <p className="text-[10px] text-slate-400 text-center pt-2">Untuk laporan lebih rinci, buka langsung Google Spreadsheet Perpustakaan.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showBookForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end md:items-center justify-center z-60" onClick={() => setShowBookForm(false)}>
          <div className="bg-white w-full max-w-sm rounded-t-3xl md:rounded-3xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-sm text-slate-800">{editingBook ? "Edit Buku" : "Tambah Buku"}</h3>
              <button type="button" onClick={() => setShowBookForm(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-4 space-y-2.5 overflow-y-auto">
              <input placeholder="Judul buku *" value={bookForm.judul} onChange={(e) => setBookForm({ ...bookForm, judul: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
              <input placeholder="Penulis" value={bookForm.penulis} onChange={(e) => setBookForm({ ...bookForm, penulis: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
              <input placeholder="Penerbit" value={bookForm.penerbit} onChange={(e) => setBookForm({ ...bookForm, penerbit: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Tahun terbit" value={bookForm.tahun_terbit} onChange={(e) => setBookForm({ ...bookForm, tahun_terbit: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-xs" />
                <input placeholder="ISBN" value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })} className="px-3 py-2 rounded-lg border border-slate-200 text-xs" />
              </div>
              <select value={bookForm.kategori_id} onChange={(e) => setBookForm({ ...bookForm, kategori_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs">
                <option value="">Pilih kategori</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}
              </select>
              <input placeholder="Lokasi rak" value={bookForm.lokasi_rak} onChange={(e) => setBookForm({ ...bookForm, lokasi_rak: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
              <input placeholder="URL cover (opsional)" value={bookForm.cover_url} onChange={(e) => setBookForm({ ...bookForm, cover_url: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
              <textarea placeholder="Deskripsi" value={bookForm.deskripsi} onChange={(e) => setBookForm({ ...bookForm, deskripsi: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" rows={2} />
              <input type="number" min={0} placeholder="Stok total" value={bookForm.stok_total} onChange={(e) => setBookForm({ ...bookForm, stok_total: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
              <button type="button" disabled={savingBook || !bookForm.judul.trim()} onClick={handleSaveBook} className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-[11px] font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                {savingBook && <Loader2 size={14} className="animate-spin" />} Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {showCatForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end md:items-center justify-center z-60" onClick={() => setShowCatForm(false)}>
          <div className="bg-white w-full max-w-sm rounded-t-3xl md:rounded-3xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800">Tambah Kategori</h3>
              <button type="button" onClick={() => setShowCatForm(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-4 space-y-2.5">
              <input placeholder="Nama kategori *" value={catForm.nama} onChange={(e) => setCatForm({ ...catForm, nama: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
              <input placeholder="Deskripsi (opsional)" value={catForm.deskripsi} onChange={(e) => setCatForm({ ...catForm, deskripsi: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs" />
              <button type="button" disabled={savingCat || !catForm.nama.trim()} onClick={handleSaveCategory} className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-[11px] font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                {savingCat && <Loader2 size={14} className="animate-spin" />} Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      {previewAnggota && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-60" onClick={() => setPreviewAnggota(null)}>
          <div className="bg-white w-full max-w-xs rounded-3xl shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800">Preview Kartu</h3>
              <button type="button" onClick={() => setPreviewAnggota(null)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-5">
              <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-black text-slate-800 truncate">{previewAnggota.nama}</p>
                    <p className="text-[10px] text-slate-400 mt-1">ID: {previewAnggota.id}</p>
                    <p className="text-[10px] text-slate-400">Peran: Tutor</p>
                    <p className="text-[10px] text-slate-400">Status: Aktif</p>
                  </div>
                  <img
                    src={getQrImageUrl(previewAnggota.id, 150)}
                    alt="QR Anggota"
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 shrink-0"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={printing}
                onClick={() => handleCetakKartu([previewAnggota.id])}
                className="w-full mt-4 py-2.5 rounded-xl bg-brand-600 text-white text-[11px] font-bold disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {printing && <Loader2 size={14} className="animate-spin" />} Cetak Kartu Ini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
