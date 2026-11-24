import { CommunityMember } from '../src/functions/community_members.js'
import { ROLES } from '../src/functions/admin_dashboard.js'
import { cors } from '../lib/cors.js'
import {
  God,
  authenticate,
  matchesServerKey,
  roleGate,
  verifiedEmail,
  finish,
} from '../lib/god.js'

/*
  /api/admin — what an admin may change about the community they own.

  This is the third of the three endpoints god.js was split into by auth tier. Everything here
  changes who a community is: its people, their roles, its join code, and the row that carries the
  old code. A leader may read all of that but change none of it, so the gate below asks for the
  stricter of the two answers — an admin of the community named in the body, read off the caller's
  own community_members row against the email the Firebase token forces, never the body's.

  Reading the roster and the attendance, and running a check-in session, are a leader's to do and
  live in /api/leader; what a plain member does for themselves lives in /api/self. A request that
  belongs over there is refused here by the whitelist below, and one that belongs here is refused
  there, so no tier can borrow another's power by guessing an endpoint.
*/

/*
  No Supabase client is built here. Every read and write this endpoint makes goes through God and
  the table classes, which are handed god.url / god.key once the caller has been verified — the
  direct client this file used to open at module level read SUPABASE_SECRET_KEY, a name the root
  .env.local never had (it holds SUPABASE_SERVICE_ROLE_KEY), so supabase-js threw
  'supabaseKey is required.' while the file was still being imported. That killed /api/admin before
  its handler ran, and took the whole `vercel dev` down with it. The key lives in server/.env,
  because it belongs to the standalone Express server in server/, not to these endpoints.
*/

// What an admin browser may do at this tier, and nothing else.
const ADMIN_ACTIONS = {
  admin: ['changeCode', 'assign'],
  member: ['remove'],
  community: ['find'],
}

export default async function handler(req, res) {
  // Answer a cross-origin preflight before authenticate, which is POST-only and would 405 it.
  if (cors(req, res)) return
  const auth = await authenticate(req, res)
  if (!auth) return
  const { token } = auth

  let { action, params = {} } = req.body || {}
  const god = new God()

  if (!matchesServerKey(token)) {
    const { email, reason } = await verifiedEmail(token)
    if (!email) {
      console.warn('[admin] rejected bearer token:', reason)
      return res.status(401).json({
        error: 'that sign-in is not valid',
        reason: process.env.VERCEL_ENV === 'production' ? undefined : reason,
      })
    }
    if (!ADMIN_ACTIONS[action]?.includes(params.function)) {
      return res
        .status(403)
        .json({ error: 'a signed-in browser may only touch its own user row and communities' })
    }
    params = { ...params, email }
    /*
      These change what a community looks like to everybody in it: who belongs, who manages it,
      the code that lets a stranger walk in. An admin of this community settles it, taken from the
      token rather than the body, so an admin of one group cannot reach into another. 'community'
      find is on this tier only because the row it returns carries join_id.
    */
    const link = await roleGate(god, email, params.community_id, 'admin', res)
    if (!link) return
    const links = new CommunityMember(god.url, god.key)

    /*
      Removing somebody is the one browser action here that speaks about another person, so
      the target arrives as member_email and only becomes params.email — what the class
      deletes on — once the caller has been shown to be an admin of this community. Three
      things follow from that. An address that is not in the community is a 400 rather than
      a silent no-op. One admin cannot delete another; only the admin themselves can do
      that to their own row, because otherwise any admin could empty a group of its
      managers. And the last member cannot be removed at all: 'member' create is open to a
      browser while a community has no members, so an emptied community would be there for
      whoever guessed its id to claim as admin.
    */
    if (action === 'member' && params.function === 'remove') {
      const target = String(params.member_email || '').trim()
      if (!target) {
        return res.status(400).json({ error: 'params.member_email is required to remove a member' })
      }
      const row = await links.find(target, params.community_id)
      if (!row) {
        return res.status(400).json({ error: 'that person is not a member of this community' })
      }
      if (row.role === 'admin' && target !== email) {
        return res
          .status(403)
          .json({ error: 'only that admin can remove themselves from this community' })
      }
      const everyone = await links.all({ community_id: params.community_id })
      if (everyone.length <= 1) {
        return res
          .status(403)
          .json({ error: 'that community has only one member, so removing them would leave it unowned' })
      }
      params = { ...params, email: target }
    }
    /*
      Assigning a role is the second action here that speaks about another person, and it is
      guarded the same way: the caller is an admin of this community (checked above, off the
      token), the address has to hold a link in this community, and the role has to be one of
      the three the table allows. Then one refusal, the loudest: a community whose last admin
      stops being an admin has nobody left who can read its roster or change its code, and no
      way back in except the server key. It is the same rule whoever the address is, so an
      admin handing their own role to somebody else is allowed the moment a second admin
      already holds it — and not before.
    */
    if (action === 'admin' && params.function === 'assign') {
      const target = String(params.member_email || '').trim()
      if (!target) {
        return res.status(400).json({ error: 'params.member_email is required to assign a role' })
      }
      if (!ROLES.includes(params.role)) {
        return res
          .status(400)
          .json({ error: `params.role is required to assign a role, and it is one of ${ROLES.join(', ')}` })
      }
      const row = await links.find(target, params.community_id)
      if (!row) {
        return res.status(400).json({ error: 'that person is not a member of this community' })
      }
      if (params.role !== 'admin') {
        const everyone = await links.all({ community_id: params.community_id })
        const admins = everyone.filter((one) => one.role === 'admin')
        if (row.role === 'admin' && admins.length <= 1) {
          return res
            .status(403)
            .json({ error: 'that is the only admin, so the community would be left with nobody who can manage it' })
        }
      }
    }
  }

  return finish(god, action, params, null, res)
}




export async function attendance(){
  //The admin must take their own attendance
}