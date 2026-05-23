import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA13Fc3RgxE4GP0Nw9u6pyYgI-5H-g2dlg",
  authDomain: "jak-game.firebaseapp.com",
  databaseURL: "https://jak-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jak-game",
  storageBucket: "jak-game.firebasestorage.app",
  messagingSenderId: "625153148059",
  appId: "1:625153148059:web:92191c6c5f99b7c030f23e",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
