import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth as defaultAuth } from '../firebase.js'

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

  onChange(listener) {
    return onAuthStateChanged(this.auth, (user) => listener(view(user)))
  }

  async idToken(forceRefresh = false) {
    const user = this.auth.currentUser
    return user ? user.getIdToken(forceRefresh) : null
  }
}
