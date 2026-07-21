import { Router } from 'express';
import { config } from '../config/index.js';
import authRoutes from './auth.routes.js';
import reconRoutes from './recon.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'OPERATIONAL',
    node: 'GW-991823',
    ts: new Date().toISOString(),
    devMode: config.dev.enabled,
    devOperator: config.dev.enabled ? config.dev.operatorHandle : undefined,
    // Exposed only in dev mode to prefill the login form for convenience.
    devPassword: config.dev.enabled ? config.dev.operatorPassword : undefined,
  });
});

router.use('/auth', authRoutes);
router.use('/recon', reconRoutes);

export default router;
