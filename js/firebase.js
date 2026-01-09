/**
 * SabziXpress - Firebase Initialization
 * Uses Firebase Web v8 (CDN style)
 */

// 1. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCi0pzEGkSIVZ5XlcYpyWzKBeZZPOmmtLc",
    authDomain: "sabzee-6c5ad.firebaseapp.com",
    projectId: "sabzee-6c5ad",
    storageBucket: "sabzee-6c5ad.appspot.com", // Included standard bucket format just in case, though unused
    messagingSenderId: "537431620130",
    appId: "1:537431620130:web:2b11f3bae972928fa4287b"
};

// 2. Initialize App
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase App Initialized");
} else {
    firebase.app(); // if already initialized, use that one
}

// 3. Export Services globally for easy access in other files
const auth = firebase.auth();
const db = firebase.database();
const messaging = firebase.messaging(); // For foreground messages

// FCM Key for manual trigger via fetch (Client-side trigger workaround for Free Tier)
// WARNING: In a real production app with backend, this stays on the server.
// Allowed here strictly per prompt constraints (No Cloud Functions/Free Tier only).
const FCM_SERVER_KEY = "key=lznMin_z3Eg1D6alixGXXxDP0sBo4eXJioTeNEqJJMQ"; 

// Helper to get current timestamp
const getServerTimestamp = () => firebase.database.ServerValue.TIMESTAMP;

// Global Error Handler Helper
const handleFirebaseError = (error, context = "") => {
    console.error(`Firebase Error [${context}]:`, error);
    if(window.app && window.app.toast) {
        window.app.toast(error.message);
    } else if (window.adminUI && window.adminUI.toast) {
        window.adminUI.toast(error.message);
    } else {
        alert(error.message);
    }
};