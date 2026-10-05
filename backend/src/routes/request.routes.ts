import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/httpErrors.js';
import * as requestController from '../controllers/request.controller.js';

export const requestRouter = Router();

requestRouter.use(authenticate);

requestRouter.post('/', authorize('CITIZEN'), asyncHandler(requestController.submitRequest));
requestRouter.get('/', authorize('CITIZEN', 'ADMIN', 'RESCUE_TEAM'), asyncHandler(requestController.listRequests));
requestRouter.get('/:id', authorize('CITIZEN', 'ADMIN', 'RESCUE_TEAM'), asyncHandler(requestController.getRequest));
requestRouter.get('/:id/history', authorize('CITIZEN', 'ADMIN', 'RESCUE_TEAM'), asyncHandler(requestController.getHistory));
requestRouter.post('/:id/cancel', authorize('CITIZEN'), asyncHandler(requestController.cancelRequest));
requestRouter.post('/:id/verify', authorize('ADMIN'), asyncHandler(requestController.verifyRequest));
requestRouter.patch('/:id/priority', authorize('ADMIN'), asyncHandler(requestController.setPriority));
