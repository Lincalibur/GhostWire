import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimiter.js';
import { requireOperator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { login, verify, logout, session } from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', authLimiter, asyncHandler(login));
router.post('/verify', authLimiter, asyncHandler(verify));
router.post('/logout', asyncHandler(logout));
router.get('/session', requireOperator, asyncHandler(session));

export default router;
