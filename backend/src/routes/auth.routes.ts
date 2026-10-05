import { Router } from 'express';
import { login, logout, me, register } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/httpErrors.js';
import { loginSchema, registerSchema } from '../schemas/auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validateBody(registerSchema), asyncHandler(register));
authRouter.post('/login', authLimiter, validateBody(loginSchema), asyncHandler(login));
authRouter.post('/logout', authenticate, asyncHandler(logout));
authRouter.get('/me', authenticate, asyncHandler(me));
