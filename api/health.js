import { cors } from '../lib/cors.js'

export default async function handler(req, res) {
  if (cors(req, res)) return
  res.status(200).json({ status: 'ok' })
}
