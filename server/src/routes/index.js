import { Router } from 'express'
import healthRoutes from './health.routes.js'
import servingsRoutes from './servings.js'
import keepAliveRoutes from './keep_alive.js'
import extraMembersRoutes from './extra_members.js'
import extraEventRoutes from './extra_event.js'
import extraTestimonyRoutes from './extra_testimony.js'
import extraFunctionAttendingRoutes from './extra_function_attending.js'
import extraFunctionPaidRoutes from './extra_function_paid.js'

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

export default router
