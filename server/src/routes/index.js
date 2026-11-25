import { Router } from 'express'
import healthRoutes from './health.routes.js'
import servingsRoutes from './servings.js'
import keepAliveRoutes from './keep_alive.js'

/*
  Every feature router mounts here. Add a new file under routes/ and mount it on its own
  prefix below; app.js already mounts this router at '/'.
*/

const router = Router()

router.use('/', healthRoutes)
router.use('/servings', servingsRoutes)
router.use('/keep-alive', keepAliveRoutes)

// Example of a feature router to add later:
// router.use('/absence', absenceRoutes)

export default router
