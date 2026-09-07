import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';

export const meRouter = Router();

// Proves the auth pipeline end-to-end: valid JWT -> profile lookup -> role/client scope.
meRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
