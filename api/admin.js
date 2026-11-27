import { CommunityMember } from '../src/functions/community_members.js'
import { Community } from '../src/functions/community.js'
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
  changes who a community is: its people, their roles, its join code, the row that carries the
  old code, and what the community is called and shown as. A leader may read all of that but change
  none of it, so the gate below asks for the
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
  /*
    'find' is here only because the row it returns carries join_id. 'update' is the settings page's
    write, and the branch below it keeps to two columns of `community` — see that comment for why
    nothing else on the row can be reached this way.
  */
  community: ['find', 'update'],
  /*
    The one irreversible thing a browser is allowed to ask for: every record inside this community,
    and the files those records point at. The community row and its members stay — this is a clearing
    of space, not a departure — and it answers to the creator of the community alone, not to every
    admin, which is why the branch below is stricter than the role gate above.
  */
  purge: ['deleteAll'],
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
    /*
      What a community is called, and the picture it is shown under. Two columns, and the only two:
      `join_id` is drawn by 'changeCode' rather than typed by anybody, and `created_by` is the record
      the delete-everything gate is compared against, so neither can be written from a browser at all
      — an update that named one would simply not carry it on. A name is required to be a name, since
      an empty one would leave every screen in the fellowship calling itself nothing. A picture is
      either a real http address, normalised through `new URL` so the column cannot hold a fragment
      that a page would later paint with, or null to take the picture away and go back to the plain
      band. Whether the caller is an admin of this community was settled by the role gate above.
    */
    if (action === 'community' && params.function === 'update') {
      const given = params.changes || {}
      const changes = {}
      if (given.name !== undefined) {
        const name = String(given.name).trim()
        if (!name) {
          return res
            .status(400)
            .json({ error: 'params.changes.name cannot be empty — a community is always called something' })
        }
        if (name.length > 120) {
          return res.status(400).json({ error: 'params.changes.name is too long for a community name' })
        }
        changes.name = name
      }
      if (given.picture !== undefined) {
        const typed = String(given.picture || '').trim()
        if (!typed) {
          changes.picture = null
        } else {
          let address = null
          try {
            address = new URL(typed)
          } catch {
            return res.status(400).json({
              error: 'params.changes.picture has to be the full web address of a picture, or empty to remove it',
            })
          }
          if (address.protocol !== 'https:' && address.protocol !== 'http:') {
            return res
              .status(400)
              .json({ error: 'params.changes.picture has to be an http(s) address' })
          }
          if (address.href.length > 600) {
            return res.status(400).json({ error: 'params.changes.picture is too long to be an address' })
          }
          changes.picture = address.href
        }
      }
      if (!Object.keys(changes).length) {
        return res
          .status(400)
          .json({ error: 'params.changes must hold a name, a picture, or both' })
      }
      params = { ...params, changes }
    }
    /*
      Emptying a community. Four things have to be true before a single row is touched, and none of
      them is the caller's word alone.

      The community exists, so an id that was mistyped or already cleared cannot come back as a
      success. The caller is an admin of it, which the role gate above already settled. The address
      that signed in — read off the id token, never out of the body — is the one `community.created_by`
      recorded when the fellowship was opened, which is what makes this the founder's decision rather
      than any admin's. And the name has to be typed back exactly as the table holds it, so the
      request carries proof that the person looking at this screen knows which fellowship they are
      about to empty.

      A community whose created_by was never written refuses and says why. Falling back to "any admin
      will do" would be the moment this rule stopped protecting anybody, and the column can be filled
      in once against the row.
    */
    if (action === 'purge' && params.function === 'deleteAll') {
      const one = await new Community(god.url, god.key).find(params.community_id)
      if (!one) {
        return res.status(400).json({ error: 'there is no community with that id' })
      }
      const founder = String(one.created_by || '').trim().toLowerCase()
      if (!founder) {
        return res.status(403).json({
          error:
            'this community was opened before the app recorded who created it, so nobody can be shown to own emptying it — set created_by on its row first',
        })
      }
      if (founder !== String(email).trim().toLowerCase()) {
        // The address is not named back: whoever is refused here is by definition not the person it
        // belongs to, and this app speaks about everybody else by name, never by email.
        return res
          .status(403)
          .json({ error: 'only the person who opened this community can delete all its data' })
      }
      const typed = String(params.name || '').trim()
      if (!typed) {
        return res
          .status(400)
          .json({ error: 'params.name is required — type the community’s name to delete its data' })
      }
      if (typed.toLowerCase() !== String(one.name || '').trim().toLowerCase()) {
        return res.status(400).json({ error: 'the name typed does not match the name of this community' })
      }
      params = { ...params, community_id: one.community_id, name: typed }
    }
  }

  return finish(god, action, params, null, res)
}




export async function attendance(){
  //The admin must take their own attendance
}