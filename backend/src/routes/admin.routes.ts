import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/httpErrors.js';
import * as adminController from '../controllers/admin.controller.js';

export const adminRouter = Router();

adminRouter.use(authenticate, authorize('ADMIN'));

adminRouter.post('/users', asyncHandler(adminController.createUser));
adminRouter.get('/users', asyncHandler(adminController.listUsers));
