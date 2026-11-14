import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth as defaultAuth, ready } from '../firebase.js'

function view(user) {
  if (!user) return null
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
  }
}

export class Auth {
  constructor(firebaseAuth = defaultAuth) {
    this.auth = firebaseAuth
  }

  async signUp(email, password) {
    const { user } = await createUserWithEmailAndPassword(this.auth, email, password)
    return view(user)
  }

  async signIn(email, password) {
    const { user } = await signInWithEmailAndPassword(this.auth, email, password)
    return view(user)
  }

  async signOut() {
    await signOut(this.auth)
    return null
  }

  current() {
    return view(this.auth.currentUser)
  }

  /*
    The listener is only attached once the storage choice in src/firebase.js has settled,
    so a slow IndexedDB read is never reported as a signed-out visitor. The first callback
    is therefore always the settled state.

    After that first callback only a change of person is passed on — signing out, or a
    different address. Firebase re-reports the same user whenever it reloads the account,
    and a page that fetches in its listener would fetch again on every one of those. A page
    that also navigated on each report is what looked like the app refreshing itself.
  */
  onChange(listener) {
    let stop = null
    let cancelled = false
    let seen = null
    let settled = false
    ready.then(() => {
      if (cancelled) return
      stop = onAuthStateChanged(this.auth, (user) => {
        const account = view(user)
        const who = account?.uid ?? null
        if (settled && who === seen) return
        settled = true
        seen = who
        listener(account)
      })
    })
    return () => {
      cancelled = true
      if (stop) stop()
    }
  }

  async idToken(forceRefresh = false) {
    const user = this.auth.currentUser
    return user ? user.getIdToken(forceRefresh) : null
  }
}
