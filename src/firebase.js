// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDNgGC-3qksHbOWsKcEh50_5ZE6wH3n8aQ",
  authDomain: "dnd-tools-1dd87.firebaseapp.com",
  projectId: "dnd-tools-1dd87",
  storageBucket: "dnd-tools-1dd87.firebasestorage.app",
  messagingSenderId: "866582352851",
  appId: "1:866582352851:web:269ec8b40fc5764425d526",
  measurementId: "G-NDMWX2DC07"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
