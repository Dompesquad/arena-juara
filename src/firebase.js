import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAoCwdDO7BX9_u35B8Ermao8DYP8SDA_yA",
  authDomain: "arena-juara.firebaseapp.com",
  projectId: "arena-juara",
  storageBucket: "arena-juara.firebasestorage.app",
  messagingSenderId: "846173174059",
  appId: "1:846173174059:web:8bc5aff889d943b81fad6e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
