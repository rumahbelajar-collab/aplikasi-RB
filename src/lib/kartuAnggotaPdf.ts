import { jsPDF } from "jspdf";
import { getQrImageDataUrl } from "./qrCode";

export interface AnggotaCardData {
  id: string;
  nama: string;
  role: string; // "tutor"
  status?: string; // "aktif" / "nonaktif"
}

const CARD_WIDTH = 85.6; // mm, ukuran standar kartu ID (CR80)
const CARD_HEIGHT = 54;
const MARGIN_X = 12;
const MARGIN_Y = 15;
const GAP_X = 8;
const GAP_Y = 8;
const COLS = 2;

function drawCard(doc: jsPDF, x: number, y: number, data: AnggotaCardData, qrDataUrl: string) {
  // Latar kartu
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, CARD_WIDTH, CARD_HEIGHT, 3, 3, "F");
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(x, y, CARD_WIDTH, CARD_HEIGHT, 3, 3, "S");

  // Header berwarna
  doc.setFillColor(37, 99, 235); // brand blue
  doc.roundedRect(x, y, CARD_WIDTH, 12, 3, 3, "F");
  doc.rect(x, y + 6, CARD_WIDTH, 6, "F"); // ratakan sudut bawah header

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("KARTU ANGGOTA PERPUSTAKAAN", x + 4, y + 7.5);

  // Nama & info
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.nama, x + 4, y + 22, { maxWidth: CARD_WIDTH - 28 });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`ID: ${data.id}`, x + 4, y + 28);
  doc.text(`Peran: ${data.role === "tutor" ? "Tutor" : data.role}`, x + 4, y + 33);
  doc.text(`Status: ${data.status || "Aktif"}`, x + 4, y + 38);

  // QR code di kanan
  const qrSize = 22;
  try {
    doc.addImage(qrDataUrl, "PNG", x + CARD_WIDTH - qrSize - 4, y + CARD_HEIGHT - qrSize - 4, qrSize, qrSize);
  } catch (e) {
    // Kalau gagal menempel gambar, kartu tetap tercetak tanpa QR
  }
}

/**
 * Membuat 1 file PDF berisi kartu anggota untuk semua member
 * yang diberikan (bisa 1 orang, bisa banyak sekaligus).
 */
export async function generateKartuAnggotaPDF(members: AnggotaCardData[]): Promise<void> {
  if (members.length === 0) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const perRow = COLS;
  const perPage = perRow * 5; // 2 kolom x 5 baris per halaman A4

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const posInPage = i % perPage;

    if (i > 0 && posInPage === 0) {
      doc.addPage();
    }

    const col = posInPage % perRow;
    const row = Math.floor(posInPage / perRow);

    const x = MARGIN_X + col * (CARD_WIDTH + GAP_X);
    const y = MARGIN_Y + row * (CARD_HEIGHT + GAP_Y);

    let qrDataUrl = "";
    try {
      qrDataUrl = await getQrImageDataUrl(member.id, 200);
    } catch (e) {
      // Lanjut tanpa QR kalau gagal mengambil gambarnya
    }

    drawCard(doc, x, y, member, qrDataUrl);
  }

  const filename =
    members.length === 1
      ? `Kartu-Anggota-${members[0].nama.replace(/\s+/g, "-")}.pdf`
      : `Kartu-Anggota-Perpustakaan-${members.length}-orang.pdf`;

  doc.save(filename);
}
