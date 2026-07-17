import { Router } from 'express';
import { reconLimiter } from '../middleware/rateLimiter.js';
import { requireOperator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { modules, query, history } from '../controllers/recon.controller.js';

const router = Router();

// Every recon route requires a valid operator session.
router.use(requireOperator);

router.get('/modules', asyncHandler(modules));
router.get('/history', asyncHandler(history));
router.post('/query', reconLimiter, asyncHandler(query));

export default router;
