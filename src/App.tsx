import React, { useState, useEffect } from "react";
import {
  Home,
  Users,
  Wallet,
  TrendingUp,
  BookOpen,
  GraduationCap,
  LogOut,
  PlusCircle,
  FileText,
  Info,
  CheckCircle,
  AlertCircle,
  X,
  UserPlus,
  ArrowLeft,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";

import {
  getDatabase,
  Database,
  formatRupiah,
  saveDatabase,
  addSessionTransaction,
  getTodayDateString,
  ensureDatabaseDefaults,
} from "./lib/db";

import { UserSession, Tutor } from "./types";

import {
  pullFromGoogleSheets,
  pushToGoogleSheets,
  subscribeToSyncState,
  subscribeToDatabaseChanges,
  isEmptyDatabase,
  type SyncState,
} from "./lib/googleSheets";

// Admin Submodules
import AdminDashboard from "./components/AdminDashboard";
import AdminOperasional from "./components/AdminOperasional";
import AdminKeuangan from "./components/AdminKeuangan";
import AdminLaporan from "./components/AdminLaporan";

// Tutor Submodules
import TutorDashboard from "./components/TutorDashboard";
import TutorRiwayat from "./components/TutorRiwayat";
import TutorRekening from "./components/TutorRekening";
import TutorLaporan from "./components/TutorLaporan";

import CustomDatePicker from "./components/CustomDatePicker";

export default function App() {
  /* =========================================================
     DATABASE
  ========================================================= */

  const [db, setDb] = useState<Database>(() =>
    ensureDatabaseDefaults(getDatabase())
  );

  /* =========================================================
     CLOUD SYNC STATE (GOOGLE SPREADSHEET)
  ========================================================= */

  const [syncState, setSyncState] = useState<SyncState>({
    status: "idle",
    lastSynced: null,
    errorMessage: null,
  });

  useEffect(() => {
    const unsubscribe = subscribeToSyncState((state) => {
      setSyncState(state);
    });

    return unsubscribe;
  }, []);

  /* =========================================================
     SESSION
  ========================================================= */

  const [userSession, setUserSession] =
    useState<UserSession | null>(() => {
      const saved = localStorage.getItem(
        "rumah_belajar_session"
      );

      if (!saved) return null;

      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    });

  useEffect(() => {
    if (userSession) {
      localStorage.setItem(
        "rumah_belajar_session",
        JSON.stringify(userSession)
      );
    } else {
      localStorage.removeItem(
        "rumah_belajar_session"
      );
    }
  }, [userSession]);

  /* =========================================================
     TOAST
  ========================================================= */

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success"
  ) => {
    setToast({
      message,
      type,
    });
  };

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [toast]);

  /* =========================================================
     REPLACE WINDOW ALERT WITH TOAST
  ========================================================= */

  useEffect(() => {
    const originalAlert = window.alert;

    window.alert = (message: string) => {
      const lower = String(message).toLowerCase();

      let type: "success" | "error" | "info" = "info";

      if (
        lower.includes("berhasil") ||
        lower.includes("sukses") ||
        lower.includes("disalin") ||
        lower.includes("tersimpan")
      ) {
        type = "success";
      } else if (
        lower.includes("gagal") ||
        lower.includes("harap") ||
        lower.includes("wajib") ||
        lower.includes("salah") ||
        lower.includes("tidak valid") ||
        lower.includes("tidak ditemukan")
      ) {
        type = "error";
      }

      showToast(String(message), type);
    };

    return () => {
      window.alert = originalAlert;
    };
  }, []);

  /* =========================================================
     NAVIGATION
  ========================================================= */

  const [activeTab, setActiveTab] = useState<string>(() => {
    return (
      localStorage.getItem(
        "rumah_belajar_active_tab"
      ) || "home"
    );
  });

  useEffect(() => {
    localStorage.setItem(
      "rumah_belajar_active_tab",
      activeTab
    );

    if (window.history.state?.tab !== activeTab) {
      window.history.pushState(
        { tab: activeTab },
        ""
      );
    }
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.tab) {
        setActiveTab(e.state.tab);
      }
    };

    window.addEventListener(
      "popstate",
      handlePopState
    );

    return () => {
      window.removeEventListener(
        "popstate",
        handlePopState
      );
    };
  }, []);

  const [adminSubTab, setAdminSubTab] =
    useState<string>("");

  const [laporanSubTab, setLaporanSubTab] =
    useState<
      "pdf" | "absensi" | "verifikasi"
    >("pdf");

  const [selectedEntityId, setSelectedEntityId] =
    useState<string>("");

  /* =========================================================
     AUTH
  ========================================================= */

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] =
    useState(false);

  /* =========================================================
     REGISTRATION
  ========================================================= */

  const [isRegisterOpen, setIsRegisterOpen] =
    useState(false);

  const [regNama, setRegNama] = useState("");
  const [regIdLogin, setRegIdLogin] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] =
    useState(false);
  const [regTelepon, setRegTelepon] = useState("");
  const [regAlamat, setRegAlamat] = useState("");

  /* =========================================================
     QUICK ACTION
  ========================================================= */

  const [quickActionOpen, setQuickActionOpen] =
    useState<
      | "session"
      | "payment"
      | "handover"
      | "honor"
      | null
    >(null);

  /* =========================================================
     ADMIN SESSION
  ========================================================= */

  const [isAdminSessionOpen, setIsAdminSessionOpen] =
    useState(false);

  const [sessDate, setSessDate] =
    useState(getTodayDateString());

  const [sessSiswaId, setSessSiswaId] =
    useState("");

  const [sessTutorId, setSessTutorId] =
    useState("");

  const [sessProgramId, setSessProgramId] =
    useState("");

  const [sessCatatan, setSessCatatan] =
    useState("");

  /* =========================================================
     INITIAL LOADING
  ========================================================= */

  const [isInitialLoading, setIsInitialLoading] =
    useState(true);

  // true kalau ini device/browser BARU (belum ada cache sama sekali) dan
  // SEMUA percobaan sinkron awal ke Google Spreadsheet gagal. Dalam kondisi
  // ini kita SENGAJA tidak melempar user ke layar login, karena kalau
  // dibiarkan, tutor akan melihat daftar akun kosong dan dikira
  // "password salah" padahal sebenarnya cuma belum berhasil tersambung.
  const [initialSyncFailed, setInitialSyncFailed] =
    useState(false);

  const [isRetryingInitialSync, setIsRetryingInitialSync] =
    useState(false);

  /* =========================================================
     PWA INSTALL
  ========================================================= */

  const [deferredPrompt, setDeferredPrompt] =
    useState<any>(null);

  const [showInstallBtn, setShowInstallBtn] =
    useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (
      e: Event
    ) => {
      e.preventDefault();

      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  /* =========================================================
     STARTUP (dengan RETRY otomatis)

     Kenapa perlu retry: Google Apps Script Web App kadang butuh
     beberapa detik untuk "bangun" (cold start) di request pertama,
     apalagi kalau device/browser ini belum pernah menyimpan cache
     sama sekali (device baru / alamat lokal berbeda). Kalau cuma
     dicoba SEKALI lalu menyerah, tutor bisa berakhir di layar login
     dengan data (termasuk daftar tutor) kosong -> kelihatan seperti
     "password salah" padahal cuma belum berhasil tersambung.
  ========================================================= */

  const INITIAL_SYNC_RETRY_DELAYS_MS = [
    0, 2000, 5000, 10000,
  ];

  const attemptInitialSync = async (
    onSettled: (success: boolean, hadLocalData: boolean) => void
  ) => {
    // 1. Buka aplikasi SEKETIKA pakai cache lokal (kalau ada). Jangan
    // tahan layar login di belakang proses sinkron cloud -- itulah yang
    // dulu bikin tutor "menghubungkan terus" padahal cuma menunggu.
    let currentDb: Database;

    try {
      currentDb = ensureDatabaseDefaults(getDatabase());
    } catch (error) {
      console.error("Gagal memuat cache lokal:", error);
      currentDb = ensureDatabaseDefaults({} as Database);
    }

    const hadLocalData = !isEmptyDatabase(currentDb);

    setDb(currentDb);
    setIsInitialLoading(false);

    // 2. Tarik data terbaru dari Spreadsheet DI BELAKANG LAYAR, dengan
    // retry (Google Apps Script kadang butuh beberapa detik untuk
    // "bangun" di request pertama). Selama proses ini, layar login
    // tetap bisa dipakai -- kalau data tutor belum lengkap, pesan error
    // di handleLoginSubmit yang akan menjelaskan, bukan layar buntu.
    let success = false;

    for (
      let attempt = 0;
      attempt < INITIAL_SYNC_RETRY_DELAYS_MS.length;
      attempt++
    ) {
      const delay = INITIAL_SYNC_RETRY_DELAYS_MS[attempt];

      if (delay > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }

      try {
        const cloudDb = await pullFromGoogleSheets();

        if (cloudDb) {
          const normalized = ensureDatabaseDefaults(cloudDb);

          setDb(normalized);
          saveDatabase(normalized);

          success = true;
          break;
        }
      } catch (error) {
        console.error(
          `Gagal mengambil database dari Google Spreadsheet (percobaan ${
            attempt + 1
          }/${INITIAL_SYNC_RETRY_DELAYS_MS.length}):`,
          error
        );
      }
    }

    onSettled(success, hadLocalData);
  };

  useEffect(() => {
    let cancelled = false;

    // initialSyncFailed di sini artinya "belum pernah berhasil sinkron
    // ke cloud sejak app dibuka" -- dipakai untuk banner kecil di layar
    // login (lihat renderLoginSyncBanner), BUKAN untuk memblokir layar.
    setInitialSyncFailed(true);

    attemptInitialSync((success) => {
      if (cancelled) return;

      if (success) {
        setInitialSyncFailed(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRetryInitialSync = () => {
    setIsRetryingInitialSync(true);

    attemptInitialSync((success) => {
      setIsRetryingInitialSync(false);

      if (success) {
        setInitialSyncFailed(false);
      } else {
        showToast(
          "Masih belum bisa terhubung ke Google Spreadsheet. Periksa koneksi internet Anda.",
          "error"
        );
      }
    });
  };

  /* =========================================================
     REALTIME: PANTAU PERUBAHAN DI GOOGLE SPREADSHEET
  ========================================================= */

  useEffect(() => {
    const unsubscribe = subscribeToDatabaseChanges((cloudDb) => {
      const normalized = ensureDatabaseDefaults(cloudDb);

      setDb(normalized);
      saveDatabase(normalized);

      // Kalau sempat gagal total di awal tapi polling latar belakang ini
      // akhirnya berhasil, otomatis lepaskan layar "gagal terhubung".
      setInitialSyncFailed(false);
    });

    return unsubscribe;
  }, []);

  /* =========================================================
     CENTRAL DATABASE UPDATE
  ========================================================= */

  const handleUpdateDb = (
    newDb: Database
  ) => {
    const sanitized =
      ensureDatabaseDefaults({
        ...newDb,
        lastUpdated:
          new Date().toISOString(),
      });

    // Update UI & cache lokal dulu supaya terasa instan.
    setDb(sanitized);

    try {
      saveDatabase(sanitized);
    } catch (error) {
      console.error(
        "Gagal menyimpan cache lokal:",
        error
      );
    }

    // Google Spreadsheet = sumber utama.
    // Kirim perubahan ke cloud di background.
    pushToGoogleSheets(sanitized)
      .then((result) => {
        if (!result.success) {
          showToast(
            "Perubahan tersimpan lokal, tapi gagal disinkronkan ke Google Spreadsheet.",
            "error"
          );
          return;
        }

        if (result.db) {
          const normalized = ensureDatabaseDefaults(result.db);
          setDb(normalized);
          saveDatabase(normalized);
        }
      })
      .catch((error) => {
        console.error(
          "Gagal mengirim database ke Google Spreadsheet:",
          error
        );

        showToast(
          "Perubahan tersimpan lokal, tapi gagal disinkronkan ke Google Spreadsheet.",
          "error"
        );
      });
  };

  /* =========================================================
     REFRESH DATABASE
  ========================================================= */

  const handleRetryCloudSync =
    async () => {
      try {
        const cloudDb =
          await pullFromGoogleSheets();

        if (!cloudDb) {
          showToast(
            "Google Spreadsheet tidak dapat diakses. Menampilkan data cache.",
            "error"
          );
          return;
        }

        const normalized =
          ensureDatabaseDefaults(cloudDb);

        setDb(normalized);
        saveDatabase(normalized);

        showToast(
          "Data berhasil diperbarui dari Google Spreadsheet.",
          "success"
        );
      } catch (error) {
        console.error(
          "Gagal memperbarui database:",
          error
        );

        showToast(
          "Gagal memperbarui data.",
          "error"
        );
      }
    };

  /* =========================================================
     LOGIN
  ========================================================= */

  const handleLoginSubmit = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const allowedAdminPassword =
      db?.adminPassword || "admin123";

    if (
      loginId.trim().toLowerCase() ===
        "admin" &&
      password === allowedAdminPassword
    ) {
      setUserSession({
        role: "admin",
        userId: "admin",
        nama: "Administrator Utama",
      });

      setActiveTab("home");
      return;
    }

    const normalizedLogin =
      loginId.trim().toLowerCase();

    const matchedTutor =
      db.tutors.find((t) => {
        const tutorLogin =
          String(t.idLogin || "")
            .trim()
            .toLowerCase();

        return (
          tutorLogin === normalizedLogin &&
          t.status === "aktif"
        );
      });

    if (matchedTutor) {
      const expectedPassword =
        matchedTutor.password || "123";

      if (
        password === expectedPassword
      ) {
        setUserSession({
          role: "tutor",
          userId: matchedTutor.id,
          nama: matchedTutor.nama,
        });

        setActiveTab("home");
        return;
      }
    }

    if ((db.tutors || []).length === 0) {
      // Daftar tutor masih kosong -> tidak mungkin ada password tutor
      // yang cocok. Ini masalah data belum sinkron, bukan salah password.
      alert(
        "Data akun Tutor belum selesai dimuat dari Google Spreadsheet. Mohon tunggu beberapa detik lalu coba lagi, atau tekan tombol \"Coba sambungkan ulang\" di layar login."
      );
      return;
    }

    alert(
      "Username atau Password salah, atau akun Tutor Anda sedang dinonaktifkan."
    );
  };

  /* =========================================================
     REGISTER TUTOR
  ========================================================= */

  const handleRegisterSubmit = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !regNama.trim() ||
      !regIdLogin.trim() ||
      !regPassword.trim() ||
      !regTelepon.trim()
    ) {
      alert(
        "Harap lengkapi semua field bertanda bintang."
      );
      return;
    }

    const cleanedUsername =
      regIdLogin
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

    if (cleanedUsername === "admin") {
      alert(
        "Username 'admin' tidak dapat digunakan."
      );
      return;
    }

    const tutorsList = Array.isArray(
      db.tutors
    )
      ? db.tutors
      : [];

    /* =======================================================
       CEK USERNAME
    ======================================================= */

    const loginCheck =
      tutorsList.find((t) => {
        const existingLogin =
          String(t.idLogin || "")
            .trim()
            .toLowerCase();

        return (
          existingLogin ===
          cleanedUsername
        );
      });

    if (loginCheck) {
      alert(
        "Username sudah digunakan oleh Tutor lain. Silakan pilih username yang unik."
      );
      return;
    }

    /* =======================================================
       GENERATE ID TUTOR
       Format:
       RBT01
       RBT02
       RBT03
       dst.
    ======================================================= */

    let maxIdNum =
      tutorsList.reduce(
        (max, tutor) => {
          const tutorId =
            String(tutor.id || "").trim();

          const match =
            tutorId.match(
              /^(?:T-|RBT)(\d+)$/
            );

          if (!match) {
            return max;
          }

          const num =
            parseInt(
              match[1],
              10
            );

          if (Number.isNaN(num)) {
            return max;
          }

          return num > max
            ? num
            : max;
        },
        0
      );

    let nextIdNum =
      maxIdNum + 1;

    let nextId =
      "RBT" +
      String(nextIdNum).padStart(
        2,
        "0"
      );

    while (
      tutorsList.some(
        (t) =>
          String(t.id || "").trim() ===
          nextId
      )
    ) {
      nextIdNum++;

      nextId =
        "RBT" +
        String(nextIdNum).padStart(
          2,
          "0"
        );
    }

    /* =======================================================
       TUTOR BARU
    ======================================================= */

    const newTutor: Tutor = {
      id: nextId,
      nama: regNama.trim(),
      idLogin: cleanedUsername,
      password: regPassword,
      status: "nonaktif",
      telepon: regTelepon.trim(),
      alamat:
        regAlamat.trim() || undefined,
      tanggalBergabung:
        getTodayDateString(),
    };

    /* =======================================================
       DATABASE BARU
    ======================================================= */

    const nextDb: Database = {
      ...db,
      tutors: [
        ...tutorsList,
        newTutor,
      ],
    };

    handleUpdateDb(nextDb);

    alert(
      "Pendaftaran Tutor Berhasil! Status akun Anda saat ini 'Nonaktif' menunggu persetujuan dan aktivasi oleh Administrator."
    );

    setRegNama("");
    setRegIdLogin("");
    setRegPassword("");
    setRegTelepon("");
    setRegAlamat("");
    setShowRegPassword(false);
    setIsRegisterOpen(false);
  };

  /* =========================================================
     LOGOUT
  ========================================================= */

  const handleLogout = () => {
    if (
      window.confirm(
        "Apakah Anda yakin ingin keluar dari aplikasi?"
      )
    ) {
      setUserSession(null);
      setActiveTab("home");
      setLoginId("");
      setPassword("");
    }
  };

  /* =========================================================
     NAVIGATION
  ========================================================= */

  const handleNavigateToTab = (
    tab: string,
    subTab?: string,
    selectedId?: string
  ) => {
    setActiveTab(tab);

    if (subTab) {
      if (tab === "laporan") {
        setLaporanSubTab(
          subTab as
            | "pdf"
            | "absensi"
            | "verifikasi"
        );
      } else {
        setAdminSubTab(subTab);
      }
    }

    if (selectedId) {
      setSelectedEntityId(
        selectedId
      );
    }
  };

  /* =========================================================
     QUICK ACTION
  ========================================================= */

  const handleOpenQuickAction = (
    action:
      | "session"
      | "payment"
      | "handover"
      | "honor"
      | "absensi"
  ) => {
    if (action === "session") {
      setSessDate(
        getTodayDateString()
      );

      const firstStudent =
        db.students[0];

      const initialSiswaId =
        firstStudent?.id || "";

      setSessSiswaId(
        initialSiswaId
      );

      if (
        firstStudent &&
        firstStudent.programId
      ) {
        setSessProgramId(
          firstStudent.programId
        );
      } else {
        setSessProgramId("");
      }

      setSessTutorId(
        db.tutors.find(
          (t) =>
            t.status === "aktif"
        )?.id || ""
      );

      setSessCatatan("");
      setIsAdminSessionOpen(
        true
      );

      return;
    }

    if (action === "absensi") {
      setActiveTab("laporan");
      setLaporanSubTab("absensi");
      return;
    }

    setActiveTab("keuangan");
    setQuickActionOpen(
      action
    );
  };

  /* =========================================================
     ADMIN STUDENT CHANGE
  ========================================================= */

  const handleAdminStudentChange = (
    sId: string
  ) => {
    setSessSiswaId(sId);

    if (!sId) {
      setSessProgramId("");
      return;
    }

    const studentObj =
      db.students.find(
        (s) => s.id === sId
      );

    if (
      studentObj &&
      studentObj.programId
    ) {
      setSessProgramId(
        studentObj.programId
      );
    } else {
      setSessProgramId("");
    }
  };

  /* =========================================================
     ADMIN SESSION SUBMIT
  ========================================================= */

  const handleAdminSessionSubmit = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !sessSiswaId ||
      !sessTutorId ||
      !sessProgramId
    ) {
      alert(
        "Harap lengkapi semua isian termasuk Program Belajar."
      );
      return;
    }

    try {
      const nextDb =
        addSessionTransaction(
          db,
          {
            tanggal: sessDate,
            siswaId: sessSiswaId,
            tutorId: sessTutorId,
            programId:
              sessProgramId,
            catatan:
              sessCatatan.trim() ||
              undefined,
          }
        );

      handleUpdateDb(nextDb);

      setIsAdminSessionOpen(
        false
      );
      setSessCatatan("");

      alert(
        "Riwayat pertemuan baru berhasil disimpan oleh Admin."
      );
    } catch (error) {
      console.error(
        "Gagal menyimpan sesi:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan riwayat sesi."
      );
    }
  };

  /* =========================================================
     NAVIGATION RENDER
  ========================================================= */

  type NavItem = {
    id: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    isActive: boolean;
    onClick: () => void;
  };

  const navItems: NavItem[] =
    userSession?.role === "admin"
      ? [
          {
            id: "nav-admin-home",
            label: "Home",
            icon: Home,
            isActive: activeTab === "home",
            onClick: () => {
              setActiveTab("home");
              setAdminSubTab("");
            },
          },
          {
            id: "nav-admin-operasional",
            label: "Operasional",
            icon: Users,
            isActive: activeTab === "operasional",
            onClick: () => {
              setActiveTab("operasional");
              setAdminSubTab("siswa");
            },
          },
          {
            id: "nav-admin-keuangan",
            label: "Keuangan",
            icon: Wallet,
            isActive: activeTab === "keuangan",
            onClick: () => {
              setActiveTab("keuangan");
              setAdminSubTab("siswa");
            },
          },
          {
            id: "nav-admin-laporan",
            label: "Laporan",
            icon: TrendingUp,
            isActive: activeTab === "laporan",
            onClick: () => {
              setActiveTab("laporan");
              setAdminSubTab("");
            },
          },
        ]
      : userSession?.role === "tutor"
      ? [
          {
            id: "nav-tutor-home",
            label: "Home",
            icon: Home,
            isActive: activeTab === "home",
            onClick: () => setActiveTab("home"),
          },
          {
            id: "nav-tutor-laporan",
            label: "Laporan",
            icon: FileText,
            isActive: activeTab === "laporan_tutor",
            onClick: () => setActiveTab("laporan_tutor"),
          },
          {
            id: "nav-tutor-riwayat",
            label: "Riwayat",
            icon: BookOpen,
            isActive: activeTab === "riwayat",
            onClick: () => setActiveTab("riwayat"),
          },
          {
            id: "nav-tutor-rekening",
            label: "Rekening",
            icon: Wallet,
            isActive: activeTab === "rekening",
            onClick: () => setActiveTab("rekening"),
          },
        ]
      : [];

  // Sidebar (desktop, md ke atas) — daftar vertikal dengan label di samping ikon.
  const renderSidebarNav = () => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            id={item.id}
            onClick={item.onClick}
            className={`flex flex-row items-center gap-3 py-2.5 px-4 w-full justify-start rounded-2xl transition-all cursor-pointer ${
              item.isActive
                ? "text-brand-600 bg-white shadow-sm font-extrabold"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon size={19} />
            <span className="text-xs font-bold capitalize tracking-wider">
              {item.label}
            </span>
          </button>
        );
      })}
    </>
  );

  // Bottom nav (mobile, di bawah md) — gaya ala Dana: ikon aktif "mengambang"
  // dalam kapsul berwarna brand, label kecil di bawahnya.
  const renderMobileNav = () => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            id={item.id}
            onClick={item.onClick}
            className="relative flex flex-col items-center justify-end gap-1 flex-1 h-full pt-2 pb-1 cursor-pointer group"
          >
            <div
              className={`flex items-center justify-center rounded-2xl transition-all duration-300 ease-out ${
                item.isActive
                  ? "w-12 h-10 -translate-y-2.5 bg-brand-600 text-white shadow-lg shadow-brand-600/40"
                  : "w-10 h-10 translate-y-0 bg-transparent text-slate-400 group-active:scale-90"
              }`}
            >
              <Icon size={20} />
            </div>

            <span
              className={`text-[9.5px] font-bold uppercase tracking-wide transition-all duration-300 ${
                item.isActive
                  ? "text-brand-600 -translate-y-1"
                  : "text-slate-400"
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </>
  );

  /* =========================================================
     INITIAL LOADING SCREEN
  ========================================================= */

  if (
    isInitialLoading ||
    !db
  ) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white font-sans">
        <div className="flex items-center gap-2.5 mb-3">
          <RefreshCw
            size={24}
            className="text-brand-400 animate-spin"
          />

          <h3 className="text-base font-extrabold tracking-wide font-display text-white">
            Memuat Rumah Belajar...
          </h3>
        </div>

        <p className="text-xs text-slate-400 font-medium max-w-xs leading-relaxed">
          Menyiapkan sistem informasi dan data lokal Anda.
        </p>
      </div>
    );
  }

  /* =========================================================
     MAIN UI
  ========================================================= */

  return (
    <div className="h-screen bg-slate-50 font-sans antialiased relative overflow-hidden flex flex-col md:flex-row">

      {/* DESKTOP BACKGROUND */}

      <div className="hidden md:block absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] bg-brand-100/50 rounded-full blur-[120px] pointer-events-none" />

      <div className="hidden md:block absolute -bottom-[10%] -right-[10%] w-[40vw] h-[40vw] bg-purple-100/40 rounded-full blur-[100px] pointer-events-none" />

      {/* =====================================================
          DESKTOP SIDEBAR
      ===================================================== */}

      {userSession && (
        <aside className="hidden md:flex flex-col w-64 h-full bg-white/70 backdrop-blur-xl border-r border-white/40 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-30 shrink-0">

          <div className="p-6 pb-2 border-b border-slate-100/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-tr from-brand-600 to-brand-400 rounded-xl flex items-center justify-center shadow-lg shadow-brand-200">
                <GraduationCap
                  size={20}
                  className="text-white"
                />
              </div>

              <div>
                <h1 className="text-sm font-extrabold text-slate-800 tracking-tight font-display uppercase leading-none">
                  Rumah Belajar
                </h1>

                <p className="text-[9px] text-slate-500 font-medium mt-1">
                  Sistem Informasi
                </p>
              </div>
            </div>

            <div className="bg-slate-50/80 rounded-2xl p-3 flex items-center gap-3 border border-slate-100/50 shadow-sm mb-4">
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold shrink-0">
                {userSession.nama
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {userSession.nama}
                </p>

                <p className="text-[10px] text-slate-500 capitalize">
                  {userSession.role}
                </p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-2 mt-2">
              Menu Utama
            </p>

            {renderSidebarNav()}
          </nav>

          <div className="p-4 border-t border-slate-100/50">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-rose-500 hover:bg-rose-50 font-bold text-xs transition-all cursor-pointer"
            >
              <LogOut size={16} />
              Keluar
            </button>
          </div>
        </aside>
      )}

      {/* =====================================================
          MAIN SCREEN
      ===================================================== */}

      <div className="flex-1 flex flex-col relative h-full overflow-hidden w-full max-w-full z-20">

        <main className="flex-1 overflow-y-auto scrollbar-none w-full max-w-full md:max-w-[98%] xl:max-w-[96%] mx-auto flex flex-col pb-24 md:pb-8 md:p-8 p-0 md:pt-8">

          {/* =================================================
              LOGIN
          ================================================= */}

          {!userSession ? (
            <div
              id="login-screen"
              className="flex-1 flex flex-col justify-center items-center p-6 animate-fade-in my-auto"
            >
              <div className="w-full max-w-sm bg-white p-6 rounded-3xl shadow-xl border border-slate-100">

                <div className="text-center mb-6">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-3.5">
                    <img
                      src="/public9.png"
                      alt="Logo Rumah Belajar"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <h1 className="text-2xl font-extrabold tracking-tight font-display text-slate-800">
                    Let's{" "}
                    <span className="text-brand-600">
                      Get
                    </span>{" "}
                    Started
                    <span className="text-brand-600">
                      !
                    </span>
                  </h1>

                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Sistem Informasi &
                    Automatisasi Rumah
                    Belajar
                  </p>
                </div>

                {initialSyncFailed && (
                  <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
                    <RefreshCw
                      size={15}
                      className="text-amber-500 shrink-0 mt-0.5 animate-spin"
                    />

                    <div className="flex-1 text-left">
                      <p className="text-[11px] text-amber-800 font-semibold leading-relaxed">
                        Data sedang dipersiapkan
                        mohon tunggu sebentar sebelum login.
                      </p>

                      <button
                        type="button"
                        onClick={handleRetryInitialSync}
                        disabled={isRetryingInitialSync}
                        className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-amber-700 hover:text-amber-900 disabled:opacity-60 cursor-pointer transition-all"
                      >
                        <RefreshCw
                          size={12}
                          className={
                            isRetryingInitialSync
                              ? "animate-spin"
                              : ""
                          }
                        />
                        {isRetryingInitialSync
                          ? "Menyambungkan..."
                          : "Coba sambungkan ulang"}
                      </button>
                    </div>
                  </div>
                )}

                {isRegisterOpen ? (
                  <div>
                    <div className="flex items-center gap-2 mb-5 border-b border-slate-100 pb-3">
                      <button
                        type="button"
                        onClick={() =>
                          setIsRegisterOpen(
                            false
                          )
                        }
                        className="text-slate-400 hover:text-slate-600 transition-all p-1 hover:bg-slate-100 rounded-full cursor-pointer"
                      >
                        <ArrowLeft
                          size={16}
                        />
                      </button>

                      <div className="text-left">
                        <h2 className="text-xs font-extrabold text-slate-800 tracking-tight uppercase">
                          Registrasi Akun Tutor
                        </h2>

                        <p className="text-[10px] text-slate-400">
                          Isi formulir pendaftaran di bawah ini
                        </p>
                      </div>
                    </div>

                    <form
                      onSubmit={
                        handleRegisterSubmit
                      }
                      className="space-y-3"
                    >
                      <div className="text-left">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          Nama Lengkap Tutor *
                        </label>

                        <input
                          type="text"
                          required
                          placeholder="Contoh: Sarah Wijaya, S.Pd."
                          value={regNama}
                          onChange={(e) =>
                            setRegNama(
                              e.target.value
                            )
                          }
                          className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-none transition-all"
                        />
                      </div>

                      <div className="text-left">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          ID Login / Username *
                        </label>

                        <input
                          type="text"
                          required
                          placeholder="Contoh: sarah"
                          value={regIdLogin}
                          onChange={(e) =>
                            setRegIdLogin(
                              e.target.value
                                .toLowerCase()
                                .replace(
                                  /\s+/g,
                                  ""
                                )
                            )
                          }
                          className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-none transition-all"
                        />
                      </div>

                      <div className="text-left">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          Password Keamanan *
                        </label>

                        <div className="relative">
                          <input
                            type={
                              showRegPassword
                                ? "text"
                                : "password"
                            }
                            required
                            placeholder="Masukkan password Anda"
                            value={
                              regPassword
                            }
                            onChange={(e) =>
                              setRegPassword(
                                e.target
                                  .value
                              )
                            }
                            className="w-full text-xs font-semibold p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-none transition-all"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              setShowRegPassword(
                                !showRegPassword
                              )
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer transition-all"
                          >
                            {showRegPassword ? (
                              <EyeOff
                                size={16}
                              />
                            ) : (
                              <Eye
                                size={16}
                              />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="text-left">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          Nomor WhatsApp/Telepon *
                        </label>

                        <input
                          type="text"
                          required
                          placeholder="Contoh: 081234567890"
                          value={
                            regTelepon
                          }
                          onChange={(e) =>
                            setRegTelepon(
                              e.target.value.replace(
                                /[^0-9]/g,
                                ""
                              )
                            )
                          }
                          className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-none transition-all"
                        />
                      </div>

                      <div className="text-left">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          Alamat Lengkap (Opsional)
                        </label>

                        <textarea
                          rows={2}
                          placeholder="Masukkan alamat tinggal Anda saat ini"
                          value={
                            regAlamat
                          }
                          onChange={(e) =>
                            setRegAlamat(
                              e.target
                                .value
                            )
                          }
                          className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-none transition-all resize-none"
                        />
                      </div>

                      <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-xl flex items-start gap-1.5 mt-1 text-left">
                        <Info
                          size={14}
                          className="text-amber-600 shrink-0 mt-0.5"
                        />

                        <p className="text-[9.5px] text-amber-700 font-semibold leading-relaxed">
                          Akun baru akan berstatus{" "}
                          <span className="font-bold underline">
                            Nonaktif
                          </span>{" "}
                          terlebih dahulu untuk verifikasi keamanan oleh Administrator sebelum dapat digunakan untuk login.
                        </p>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white p-2.5 font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95 mt-2 flex items-center justify-center gap-1.5"
                      >
                        <UserPlus
                          size={14}
                        />
                        Kirim Pendaftaran
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setIsRegisterOpen(
                            false
                          )
                        }
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-95"
                      >
                        Kembali ke Login
                      </button>
                    </form>
                  </div>
                ) : (
                  <div>
                    <form
                      onSubmit={
                        handleLoginSubmit
                      }
                      className="space-y-4"
                    >
                      <div className="text-left">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          ID Login / Username
                        </label>

                        <input
                          type="text"
                          id="login-username-input"
                          required
                          placeholder="Masukkan ID login Anda"
                          value={
                            loginId
                          }
                          onChange={(e) =>
                            setLoginId(
                              e.target
                                .value
                            )
                          }
                          className="w-full text-xs font-semibold p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-none transition-all"
                        />
                      </div>

                      <div className="text-left">
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          Password
                        </label>

                        <div className="relative">
                          <input
                            type={
                              showLoginPassword
                                ? "text"
                                : "password"
                            }
                            id="login-password-input"
                            required
                            placeholder="Masukkan password Anda"
                            value={
                              password
                            }
                            onChange={(e) =>
                              setPassword(
                                e.target
                                  .value
                              )
                            }
                            className="w-full text-xs font-semibold p-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:border-brand-500 focus:outline-none transition-all"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              setShowLoginPassword(
                                !showLoginPassword
                              )
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer transition-all"
                          >
                            {showLoginPassword ? (
                              <EyeOff
                                size={16}
                              />
                            ) : (
                              <Eye
                                size={16}
                              />
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        id="login-submit-btn"
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white p-3 font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95 mt-2"
                      >
                        Masuk Sistem
                      </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                      <p className="text-xs text-slate-500">
                        Belum punya akun?{" "}
                        <button
                          type="button"
                          onClick={() =>
                            setIsRegisterOpen(
                              true
                            )
                          }
                          className="font-extrabold text-brand-600 hover:underline cursor-pointer"
                        >
                          Registrasi sekarang!
                        </button>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-grow shrink-0 animate-fade-in flex flex-col relative z-10 w-full min-h-full bg-white/40 md:bg-white/60 md:backdrop-blur-xl md:rounded-2xl md:shadow-[0_8px_32px_rgba(0,0,0,0.02)] md:border md:border-white/80 overflow-hidden">

              {/* HEADER */}

              <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-2.5 flex items-center justify-between sticky top-0 z-40 shrink-0 gap-2">
                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${
                      syncState.status === "error"
                        ? "bg-rose-50 border-rose-100"
                        : syncState.status === "syncing"
                        ? "bg-amber-50 border-amber-100"
                        : "bg-emerald-50 border-emerald-100"
                    }`}
                    title={
                      syncState.errorMessage ||
                      (syncState.lastSynced
                        ? `Sinkron terakhir: ${new Date(
                            syncState.lastSynced
                          ).toLocaleString("id-ID")}`
                        : "")
                    }
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        syncState.status === "error"
                          ? "bg-rose-500"
                          : syncState.status === "syncing"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-emerald-500"
                      }`}
                    />

                    <span
                      className={`text-[10px] font-bold ${
                        syncState.status === "error"
                          ? "text-rose-700"
                          : syncState.status === "syncing"
                          ? "text-amber-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {syncState.status === "error"
                        ? "Gagal sinkron"
                        : syncState.status === "syncing"
                        ? "Menyinkronkan..."
                        : "Spreadsheet tersinkron"}
                    </span>
                  </div>

                  <button
                    onClick={
                      handleRetryCloudSync
                    }
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
                    title="Refresh data dari Google Spreadsheet"
                  >
                    <RefreshCw
                      size={14}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="auth-logout-btn"
                    onClick={
                      handleLogout
                    }
                    className="flex items-center gap-1 text-[10.5px] font-black text-rose-600 bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    <LogOut
                      size={11}
                    />
                    Keluar
                  </button>
                </div>
              </div>

              {/* ROLE ROUTER */}

              {userSession.role ===
              "admin" ? (
                <>
                  {activeTab ===
                    "home" && (
                    <AdminDashboard
                      db={db}
                      onNavigateToTab={
                        handleNavigateToTab
                      }
                      onOpenQuickAction={
                        handleOpenQuickAction
                      }
                      onUpdateDb={
                        handleUpdateDb
                      }
                    />
                  )}

                  {activeTab ===
                    "operasional" && (
                    <AdminOperasional
                      db={db}
                      onUpdateDb={
                        handleUpdateDb
                      }
                      onNavigateToTab={
                        handleNavigateToTab
                      }
                    />
                  )}

                  {activeTab ===
                    "keuangan" && (
                    <AdminKeuangan
                      db={db}
                      onUpdateDb={
                        handleUpdateDb
                      }
                      selectedEntityId={
                        selectedEntityId
                      }
                      onClearSelectedId={() =>
                        setSelectedEntityId(
                          ""
                        )
                      }
                      quickActionOpen={
                        quickActionOpen
                      }
                      onCloseQuickAction={() =>
                        setQuickActionOpen(
                          null
                        )
                      }
                      defaultSubTab={
                        adminSubTab as any
                      }
                    />
                  )}

                  {activeTab ===
                    "laporan" && (
                    <AdminLaporan
                      db={db}
                      onUpdateDb={
                        handleUpdateDb
                      }
                      defaultMainTab={
                        laporanSubTab
                      }
                    />
                  )}
                </>
              ) : (
                <>
                  {activeTab ===
                    "home" && (
                    <TutorDashboard
                      db={db}
                      tutorId={
                        userSession.userId
                      }
                      onNavigateToTab={
                        handleNavigateToTab
                      }
                      onUpdateDb={
                        handleUpdateDb
                      }
                    />
                  )}

                  {activeTab ===
                    "laporan_tutor" && (
                    <TutorLaporan
                      db={db}
                      tutorId={
                        userSession.userId
                      }
                      onUpdateDb={
                        handleUpdateDb
                      }
                    />
                  )}

                  {activeTab ===
                    "riwayat" && (
                    <TutorRiwayat
                      db={db}
                      tutorId={
                        userSession.userId
                      }
                      onUpdateDb={
                        handleUpdateDb
                      }
                    />
                  )}

                  {activeTab ===
                    "rekening" && (
                    <TutorRekening
                      db={db}
                      tutorId={
                        userSession.userId
                      }
                    />
                  )}
                </>
              )}
            </div>
          )}
        </main>

        {/* MOBILE NAVIGATION */}

        {userSession && (
          <nav className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-100 shadow-[0_-10px_30px_rgba(0,0,0,0.06)] rounded-t-[28px] px-2 pt-1 h-[68px] pb-[env(safe-area-inset-bottom)] z-40 shrink-0 flex justify-around items-stretch">
            {renderMobileNav()}
          </nav>
        )}
      </div>

      {/* =====================================================
          ADMIN SESSION MODAL
      ===================================================== */}

      {isAdminSessionOpen && (
        <div
          id="admin-quick-session-modal"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fade-in"
        >
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl overflow-hidden animate-slide-up">
            <div className="bg-brand-600 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-tight">
                Catat Riwayat Sesi (Admin)
              </h3>

              <PlusCircle size={18} />
            </div>

            <form
              onSubmit={
                handleAdminSessionSubmit
              }
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-[10.5px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Tanggal Sesi *
                </label>

                <CustomDatePicker
                  id="quick-sess-date"
                  required
                  value={sessDate}
                  onChange={(val) =>
                    setSessDate(val)
                  }
                />
              </div>

              <div>
                <label className="block text-[10.5px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Pilih Siswa *
                </label>

                <select
                  id="quick-sess-siswa"
                  required
                  value={sessSiswaId}
                  onChange={(e) =>
                    handleAdminStudentChange(
                      e.target
                        .value
                    )
                  }
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                >
                  <option value="">
                    -- Pilih Siswa --
                  </option>

                  {db.students
                    .filter(
                      (s) =>
                        s.status ===
                        "aktif"
                    )
                    .map((s) => (
                      <option
                        key={s.id}
                        value={s.id}
                      >
                        {s.nama} (
                        {s.id})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Program Belajar *
                </label>

                <select
                  id="quick-sess-program"
                  required
                  value={
                    sessProgramId
                  }
                  onChange={(e) =>
                    setSessProgramId(
                      e.target
                        .value
                    )
                  }
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                >
                  <option value="">
                    -- Pilih Program Belajar --
                  </option>

                  {db.programs
                    .filter(
                      (p) =>
                        p.status ===
                        "aktif"
                    )
                    .map((p) => (
                      <option
                        key={p.id}
                        value={p.id}
                      >
                        {p.nama} (
                        {formatRupiah(
                          p.tarifSiswa
                        )}{" "}
                        / Sesi)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Pilih Tutor Pengajar *
                </label>

                <select
                  id="quick-sess-tutor"
                  required
                  value={
                    sessTutorId
                  }
                  onChange={(e) =>
                    setSessTutorId(
                      e.target
                        .value
                    )
                  }
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                >
                  <option value="">
                    -- Pilih Tutor --
                  </option>

                  {db.tutors
                    .filter(
                      (t) =>
                        t.status ===
                        "aktif"
                    )
                    .map((t) => (
                      <option
                        key={t.id}
                        value={t.id}
                      >
                        {t.nama}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[10.5px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Catatan Pertemuan
                </label>

                <textarea
                  id="quick-sess-notes"
                  placeholder="Contoh: Pembahasan PR Matematika bab 4"
                  value={
                    sessCatatan
                  }
                  onChange={(e) =>
                    setSessCatatan(
                      e.target
                        .value
                    )
                  }
                  className="w-full text-xs font-semibold p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none h-16 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-50">
                <button
                  type="button"
                  id="quick-sess-cancel"
                  onClick={() =>
                    setIsAdminSessionOpen(
                      false
                    )
                  }
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  id="quick-sess-submit"
                  className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Simpan Sesi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          TOAST
      ===================================================== */}

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-100 max-w-sm w-[90%] bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 p-4 flex items-start gap-3 animate-slide-up">

          {toast.type ===
            "success" && (
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle
                size={18}
                className="animate-bounce"
              />
            </div>
          )}

          {toast.type ===
            "error" && (
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle
                size={18}
              />
            </div>
          )}

          {toast.type ===
            "info" && (
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-xl">
              <Info size={18} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-800 leading-snug">
              {toast.message}
            </p>
          </div>

          <button
            onClick={() =>
              setToast(null)
            }
            className="text-slate-400 hover:text-slate-600 shrink-0 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}