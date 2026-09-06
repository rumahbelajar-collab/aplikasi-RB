import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
} from "firebase/auth";

/* =========================================================
   KONFIGURASI FIREBASE

   Semua nilai di bawah ini diambil dari file .env (lihat
   .env.example). Nilai ini AMAN untuk ditaruh di frontend --
   ini bukan password rahasia, hanya alamat proyek Firebase
   kamu. Yang menjaga keamanan data adalah Firestore Security
   Rules (lihat FIREBASE_SETUP.md), bukan nilai-nilai ini.
========================================================= */

const metaEnv = (import.meta as any)?.env || {};

// Ganti objek firebaseConfig yang lama dengan kode di bawah ini:
const firebaseConfig = {
  apiKey: "AIzaSyBcuFYd7Q5vTORyLGaTaKErx_g3IDAf-7g",
  authDomain: "belajar-ac66b.firebaseapp.com",
  projectId: "belajar-ac66b",
  storageBucket: "belajar-ac66b.firebasestorage.app",
  messagingSenderId: "788217061198",
  appId: "1:788217061198:web:7c73d25b4d72478b15c81f",
}; // Tanda koma dan databaseURL di atas sudah dihapus total



export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

function ensureApp(): FirebaseApp {
  if (!app) {
    if (!isFirebaseConfigured()) {
      throw new Error(
        "Konfigurasi Firebase belum diisi. Cek file .env kamu (lihat FIREBASE_SETUP.md)."
      );
    }

    app = initializeApp(firebaseConfig);
  }

  return app;
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    db = getFirestore(ensureApp());
  }

  return db;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(ensureApp());
  }

  return auth;
}

/* =========================================================
   AUTENTIKASI ANONIM

   Aplikasi ini punya sistem login sendiri (admin/tutor) di
   dalam database, jadi kita tidak memakai Firebase Auth untuk
   login pengguna. Tapi Firestore Security Rules butuh
   `request.auth != null` supaya database tidak bisa diakses
   sembarang orang dari internet. Sign-in anonim memenuhi itu
   secara diam-diam di belakang layar, tanpa pengguna perlu
   login dua kali.
========================================================= */

let anonymousAuthPromise: Promise<void> | null = null;

export function ensureAnonymousAuth(): Promise<void> {
  if (anonymousAuthPromise) {
    return anonymousAuthPromise;
  }

  anonymousAuthPromise = new Promise((resolve, reject) => {
    const authInstance = getFirebaseAuth();

    const unsubscribe = onAuthStateChanged(
      authInstance,
      (user) => {
        if (user) {
          unsubscribe();
          resolve();
        }
      },
      (error) => {
        unsubscribe();
        reject(error);
      }
    );

    signInAnonymously(authInstance).catch((error) => {
      unsubscribe();
      reject(error);
    });
  });

  return anonymousAuthPromise;
}
