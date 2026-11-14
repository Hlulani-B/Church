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
    The listener is only attached once the storage choice in src/firebase.js has
    settled, so a slow IndexedDB read cannot arrive as null and bounce a signed-in
    visitor to /login. The first callback is therefore always the settled state.
  */
  onChange(listener) {
    let stop = null
    let cancelled = false
    ready.then(() => {
      if (cancelled) return
      stop = onAuthStateChanged(this.auth, (user) => listener(view(user)))
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
