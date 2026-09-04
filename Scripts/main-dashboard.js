import { requireAuth } from './auth-guard.js'

const session = await requireAuth()
// rest of dashboard logic