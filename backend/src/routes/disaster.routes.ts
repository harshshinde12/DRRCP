import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/httpErrors.js';
import * as disasterController from '../controllers/disaster.controller.js';

export const disasterRouter = Router();

disasterRouter.use(authenticate);

disasterRouter.post('/', authorize('ADMIN'), asyncHandler(disasterController.createDisaster));
disasterRouter.get('/', asyncHandler(disasterController.listDisasters));
disasterRouter.get('/active', asyncHandler(disasterController.getActiveDisaster));
disasterRouter.get('/:id', asyncHandler(disasterController.getDisaster));
disasterRouter.patch('/:id', authorize('ADMIN'), asyncHandler(disasterController.updateDisaster));
disasterRouter.post('/:id/activate', authorize('ADMIN'), asyncHandler(disasterController.activateDisaster));
disasterRouter.post('/:id/close', authorize('ADMIN'), asyncHandler(disasterController.closeDisaster));
