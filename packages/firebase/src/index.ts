import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Environment Check to support both Next.js (Web) and Expo (Mobile)
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[`EXPO_PUBLIC_${key}`] || process.env[`NEXT_PUBLIC_${key}`];
  }
  return "";
};

const firebaseConfig = {
  apiKey: getEnv("FIREBASE_API_KEY"),
  authDomain: getEnv("FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("FIREBASE_APP_ID"),
  measurementId: getEnv("FIREBASE_MEASUREMENT_ID"),
};

// Initialize Firebase App
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore explicitly with Offline Persistence
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // Fallback if already initialized (hot reloads)
  db = getFirestore(app);
}

export { app, auth, db };
