import React, { useEffect, useRef, useState } from "react";
import { Camera, Loader2, AlertTriangle, User, BookOpen, X } from "lucide-react";
import { Database } from "../lib/db";
import { getMyLoans, LibraryLoan } from "../lib/libraryApi";

interface ScanKartuPanelProps {
  db: Database;
}

declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

export default function ScanKartuPanel({ db }: ScanKartuPanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    tutorNama: string;
    tutorId: string;
    status?: string;
    loans: LibraryLoan[];
  } | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
    return () => {
      stopScanning();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    };
  }, []);

  function stopScanning() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }

  async function startScanning() {
    setError("");
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setScanning(true);

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

      const loop = async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const value = codes[0].rawValue;
            stopScanning();
            await handleDetected(value);
            return;
          }
        } catch (e) {
          // Lewati frame yang gagal dibaca, lanjut ke frame berikutnya
        }
        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
    } catch (err: any) {
      setError(
        err?.name === "NotAllowedError"
          ? "Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser."
          : "Gagal mengakses kamera. Pastikan perangkat memiliki kamera yang aktif."
      );
    }
  }

  async function handleDetected(tutorId: string) {
    setLoadingResult(true);
    try {
      const tutor = db.tutors.find((t) => t.id === tutorId);
      const loans = await getMyLoans(tutorId);
      setResult({
        tutorNama: tutor?.nama || "(Anggota tidak dikenali)",
        tutorId,
        status: tutor?.status,
        loans
      });
    } catch (e: any) {
      setError(e?.message || "Gagal mengambil data anggota.");
    } finally {
      setLoadingResult(false);
    }
  }

  if (supported === false) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-6">
        <AlertTriangle size={32} className="text-amber-400" />
        <p className="text-[12px] text-slate-500 font-medium leading-relaxed">
          Browser ini belum mendukung pemindaian QR langsung. Fitur ini otomatis
          berfungsi di Chrome/Edge versi terbaru (desktop maupun Android).
          Coba buka halaman ini lewat Chrome.
        </p>
      </div>
    );
  }

  const sedangDipinjam = result?.loans.filter((l) => l.status === "dipinjam") || [];
  const menunggu = result?.loans.filter((l) => l.status === "menunggu") || [];

  return (
    <div className="space-y-3">
      {!result && (
        <>
          <div className="relative w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                <Camera size={32} />
                <p className="text-[10.5px] font-medium">Kamera belum aktif</p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-[10.5px] text-rose-500 font-medium text-center">{error}</p>
          )}

          {loadingResult && (
            <div className="flex items-center justify-center gap-2 py-3">
              <Loader2 size={16} className="animate-spin text-brand-500" />
              <span className="text-[11px] text-slate-400 font-medium">Mengambil data anggota...</span>
            </div>
          )}

          <button
            type="button"
            onClick={scanning ? stopScanning : startScanning}
            className={
              "w-full py-2.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 " +
              (scanning ? "bg-rose-50 text-rose-600" : "bg-brand-600 text-white")
            }
          >
            <Camera size={14} />
            {scanning ? "Berhenti Scan" : "Mulai Scan"}
          </button>
        </>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
                <User size={18} />
              </div>
              <div>
                <p className="text-[12.5px] font-black text-slate-800">{result.tutorNama}</p>
                <p className="text-[10px] text-slate-400">ID: {result.tutorId} &middot; {result.status || "Aktif"}</p>
              </div>
            </div>
            <button type="button" onClick={() => setResult(null)}>
              <X size={16} className="text-slate-400" />
            </button>
          </div>

          <div>
            <p className="text-[9.5px] font-black text-slate-400 uppercase mb-1.5">Sedang Dipinjam ({sedangDipinjam.length})</p>
            {sedangDipinjam.length === 0 ? (
              <p className="text-[10.5px] text-slate-400">Tidak ada buku yang sedang dipinjam.</p>
            ) : (
              <div className="space-y-1.5">
                {sedangDipinjam.map((l) => (
                  <div key={l.id_peminjaman} className="bg-slate-50 p-2 rounded-lg flex items-center gap-2">
                    <BookOpen size={13} className="text-slate-400 shrink-0" />
                    <span className="text-[10.5px] font-medium text-slate-700 truncate">{l.judul_buku}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {menunggu.length > 0 && (
            <div>
              <p className="text-[9.5px] font-black text-slate-400 uppercase mb-1.5">Menunggu Verifikasi ({menunggu.length})</p>
              <div className="space-y-1.5">
                {menunggu.map((l) => (
                  <div key={l.id_peminjaman} className="bg-amber-50 p-2 rounded-lg flex items-center gap-2">
                    <BookOpen size={13} className="text-amber-500 shrink-0" />
                    <span className="text-[10.5px] font-medium text-amber-700 truncate">{l.judul_buku}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setResult(null)}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 text-[11px] font-bold"
          >
            Scan Lagi
          </button>
        </div>
      )}
    </div>
  );
}
