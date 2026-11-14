import { initializeApp, getApps, getApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth'

export const firebaseConfig = {
  apiKey: 'AIzaSyBbLl30EPwn-QvF3AM8skLnX340a9aHJbw',
  authDomain: 'kopano-a0554.firebaseapp.com',
  projectId: 'kopano-a0554',
  storageBucket: 'kopano-a0554.firebasestorage.app',
  messagingSenderId: '507173134753',
  appId: '1:507173134753:web:d07c38eff8d59d61cc2be0',
  measurementId: 'G-WPBNW6B41N',
}

// One app and one config for the whole site. Every page and every fetch function takes
// auth from this module, so the session is always written and read under the same key.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)

/*
  Stay signed in until Log out is pressed. Firebase keeps the session in IndexedDB when
  storage is available and falls back to memory-only when it is refused or slow, which is
  what makes a reload look like a sign-out. Asking for local persistence by name keeps
  that choice, and the failure is logged instead of silent. `Auth.onChange` waits for this
  promise before reporting anything, so a slow read is never mistaken for no session.
*/
export const ready = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('[auth] storage refused, so a reload will lose the session:', error)
})
