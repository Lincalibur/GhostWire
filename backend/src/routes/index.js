import { Router } from 'express';
import authRoutes from './auth.routes.js';
import reconRoutes from './recon.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'OPERATIONAL', node: 'GW-991823', ts: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/recon', reconRoutes);

export default router;
