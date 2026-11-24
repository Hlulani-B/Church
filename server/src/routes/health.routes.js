import { Router } from 'express'

const router = Router()

router.get('/', (req, res) => {
  res.json({ service: 'church-server', status: 'running' })
})

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'church-server' })
})

export default router
