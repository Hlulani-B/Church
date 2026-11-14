import { getIdToken } from 'firebase/auth'
import { auth, ready } from '../firebase.js'

/*
  The one fetch every page in src/page_functions/ goes through. It posts to /api/god,
  where the God class runs on the server with the service key.

  Pages must never import api/god.js directly: that pulls it into the browser bundle,
  where process.env does not exist and the inlined SUPABASE_SERVICE_ROLE_KEY would ship
  to every visitor. The only credential that leaves the browser is the caller's Firebase
  id token, and /api/god reads the email off that rather than off the request body.

  `ready` is the same promise `Auth.onChange` waits on: storage has settled, so
  `auth.currentUser` is the real answer and not a slow read pretending to be nobody. A
  request made before that used to call getIdToken on null, and the page showed the
  TypeError rather than waiting.
*/
export async function callGod(action, params = {}) {
  await ready
  const user = auth.currentUser
  if (!user) throw new Error('You are signed out, so this could not be loaded.')
  const idToken = await getIdToken(user)
  const response = await fetch('/api/god', {
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
    throw new Error('The server did not answer /api/god. Run the app with vercel dev.')
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
