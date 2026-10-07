import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || "AIzaSyBYPe-yK4jSszqAB9Y7XQ-m8YYlpKBwD2s",
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || "careerosv5.firebaseapp.com",
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || "careerosv5",
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || "careerosv5.firebasestorage.app",
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "110298742300",
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || "1:110298742300:web:a70ff1d7415643cec929d9",
  measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID || "G-6WRBMNGM2B"
};

// Initialize Firebase safely
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, onAuthStateChanged };
export type { User };
