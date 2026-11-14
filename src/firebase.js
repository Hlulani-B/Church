import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

export const firebaseConfig = {
  apiKey: 'AIzaSyBbLl30EPwn-QvF3AM8skLnX340a9aHJbw',
  authDomain: 'kopano-a0554.firebaseapp.com',
  projectId: 'kopano-a0554',
  storageBucket: 'kopano-a0554.firebasestorage.app',
  messagingSenderId: '507173134753',
  appId: '1:507173134753:web:d07c38eff8d59d61cc2be0',
  measurementId: 'G-WPBNW6B41N',
}

// The pages import this module and their own config, so whichever loads first
// owns the default app; initializing a second one throws app/duplicate-app.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
