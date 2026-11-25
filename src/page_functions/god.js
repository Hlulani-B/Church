import { getIdToken } from 'firebase/auth'
import { auth, ready } from '../firebase.js'

/*
  The one fetch every page in src/page_functions/ goes through. It posts to the serverless
  endpoint whose auth tier owns the call — /api/self, /api/leader or /api/admin — where the God
  class runs with the service key. god.js used to be one endpoint for all of it; it was split by
  who may call something, so this picks the door by (action, params.function).

  Pages must never import an api/ function directly: that pulls it into the browser bundle,
  where process.env does not exist and the inlined SUPABASE_SERVICE_ROLE_KEY would ship
  to every visitor. The only credential that leaves the browser is the caller's Firebase
  id token, and the endpoint reads the email off that rather than off the request body.

  `ready` is the same promise `Auth.onChange` waits on: storage has settled, so
  `auth.currentUser` is the real answer and not a slow read pretending to be nobody. A
  request made before that used to call getIdToken on null, and the page showed the
  TypeError rather than waiting.
*/

// Which tier owns each call. A plain string is the whole action; a function routes within an
// action by params.function. This mirrors the whitelists the three endpoints check their side of.
const TIER = {
  // 'getUsers' names the community's people, which is a leader's read; the caller's own row stays self.
  user: (fn) => (fn === 'getUsers' ? 'leader' : 'self'),
  community: (fn) => (fn === 'find' ? 'admin' : 'self'),
  member: (fn) => (fn === 'remove' ? 'admin' : 'self'),
  admin: (fn) => (fn === 'roster' ? 'leader' : fn === 'hosts' ? 'self' : 'admin'),
  attendance: 'leader',
  // A member's own notice is self-tier; naming somebody else in it is a leader's move.
  event: (fn) => (fn === 'record_for' ? 'leader' : 'self'),
  session: (fn) => (fn === 'open' || fn === 'live' ? 'self' : 'leader'),
  feedback: 'self',
  // The functions page belongs to whoever runs the fellowship, admin or leader. A member's own three
  // moves — what is still to come, what one function says about me, and my answer to it — belong to
  // the caller rather than to the fellowship, so they go to /api/self.
  church_function: (fn) =>
    fn === 'list' || fn === 'create' || fn === 'details' ? 'leader' : 'self',
}
const PATH = { self: '/api/self', leader: '/api/leader', admin: '/api/admin' }

function endpointFor(action, fn) {
  const tier = TIER[action]
  const door = typeof tier === 'function' ? tier(fn) : tier
  if (!door) throw new Error(`unknown action '${action}'`)
  return PATH[door]
}

export async function callGod(action, params = {}) {
  await ready
  const user = auth.currentUser
  if (!user) throw new Error('You are signed out, so this could not be loaded.')
  const path = endpointFor(action, params.function)
  const idToken = await getIdToken(user)
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action, params }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.headers.get('content-type')?.includes('application/json')) {
    // npm run dev has no /api functions, so this would otherwise look like success.
    throw new Error(`The server did not answer ${path}. Run the app with vercel dev.`)
  }
  if (!response.ok) {
    const error = new Error(
      (body.reason ? `${body.error} (${body.reason})` : body.error) ||
        `Request failed (${response.status})`,
    )
    error.code = body.code
    throw error
  }
  return body.data
}
