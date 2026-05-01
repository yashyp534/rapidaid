const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyA2vqvnasBP_zbUADLiTfEhyQOI_c72Zig",
  authDomain: "algorithmx-a7e6a.firebaseapp.com",
  databaseURL: "https://algorithmx-a7e6a-default-rtdb.firebaseio.com",
  projectId: "algorithmx-a7e6a",
  storageBucket: "algorithmx-a7e6a.firebasestorage.app",
  messagingSenderId: "965115253574",
  appId: "1:965115253574:web:91575f97017a64b1de0b47",
  measurementId: "G-SQ8VCDMESZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

module.exports = { db };
