import { Router } from 'express'
import healthRoutes from './health.routes.js'
import servingsRoutes from './servings.js'
import keepAliveRoutes from './keep_alive.js'
import extraMembersRoutes from './extra_members.js'
import extraEventRoutes from './extra_event.js'
import extraTestimonyRoutes from './extra_testimony.js'
import extraFunctionAttendingRoutes from './extra_function_attending.js'
import extraFunctionPaidRoutes from './extra_function_paid.js'
import extraServingsRoutes from './extra_servings.js'
import testimonyRoutes from './testimony.js'
import uploadRoutes from './upload.js'
import prayerTopicsRoutes from './prayer_topics.js'

/*
  Every feature router mounts here. Add a new file under routes/ and mount it on its own
  prefix below; app.js already mounts this router at '/'.
*/

const router = Router()

router.use('/', healthRoutes)
router.use('/servings', servingsRoutes)
router.use('/keep-alive', keepAliveRoutes)

/*
  The extra_* tables — the people who never use the app and everything recorded about them. Each
  router speaks its own table and mounts on a prefix named for it, so a browser reaches one feature
  at a time (/extra-members, /extra-event, /extra-testimony, /extra-function-attending,
  /extra-function-paid) over the same base url the app already uses for servings.
*/
router.use('/extra-members', extraMembersRoutes)
router.use('/extra-event', extraEventRoutes)
router.use('/extra-testimony', extraTestimonyRoutes)
router.use('/extra-function-attending', extraFunctionAttendingRoutes)
router.use('/extra-function-paid', extraFunctionPaidRoutes)
router.use('/extra-servings', extraServingsRoutes)

/*
  The two writes the browser could not make for itself. `testimony` and the `kopano` bucket both
  carry row level security, and the anon client in the page is never signed in (auth lives in
  Firebase), so its INSERTs were refused with "new row violates row-level security policy". They are
  done here on the service key instead, the way every other write in this server already is:
  /testimony writes a sharing's row and /upload puts a testimony picture or a payment receipt in the
  bucket. The reads stay in the browser — an anon SELECT has a policy and works — only the writes move.
*/
router.use('/testimony', testimonyRoutes)
router.use('/upload', uploadRoutes)

/*
  prayer_topics is read as well as written here, unlike the extra_* tables it sits beside: the row
  carries the address that asked for the prayer, and the list is only ever wanted inside one
  community. So the table has row level security with no policy on it, and every request comes
  through these four endpoints on the service key rather than straight from the browser.
*/
router.use('/prayer-topics', prayerTopicsRoutes)

export default router
