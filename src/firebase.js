import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDp6f3Y4NC6I0JUV3NSmz1GXanfxv6apD8",
  authDomain: "iot-inventory-9e532.firebaseapp.com",
  databaseURL:
    "https://iot-inventory-9e532-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "iot-inventory-9e532",
  storageBucket: "iot-inventory-9e532.firebasestorage.app",
  messagingSenderId: "977998849134",
  appId: "1:977998849134:web:394882abea9db8c954f27f",
  measurementId: "G-FJFH3CE89Y",
};

// Main Firebase app
const app = initializeApp(firebaseConfig);

// Main authentication
// Used for Admin and Staff login
export const auth = getAuth(app);

// Realtime Database
export const database = getDatabase(app);

// Export config so RegisterStaff.jsx
// can create a separate authentication instance
export { firebaseConfig };

export default app;