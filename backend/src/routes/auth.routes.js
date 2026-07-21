import { Router } from 'express';
import { config } from '../config/index.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { requireOperator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { login, verify, logout, session, devLogin } from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', authLimiter, asyncHandler(login));
router.post('/verify', authLimiter, asyncHandler(verify));
router.post('/logout', asyncHandler(logout));
router.get('/session', requireOperator, asyncHandler(session));

// Development-only instant login. Never registered in production.
if (config.dev.enabled) {
  router.post('/dev-login', asyncHandler(devLogin));
}

export default router;
