import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyAlRmcMNblir49SF9EryIkW9eIKhl8cjKw",
  authDomain: "no-emprendas-solo.firebaseapp.com",
  projectId: "no-emprendas-solo",
  storageBucket: "no-emprendas-solo.firebasestorage.app",
  messagingSenderId: "282295587203",
  appId: "1:282295587203:web:d61f752aec439c2cd9e6b6",
  measurementId: "G-PBJ7RKF5JD"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
