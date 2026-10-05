import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/httpErrors.js';
import * as reliefController from '../controllers/relief.controller.js';

export const reliefRouter = Router();

// NOTE: per-route authenticate (not router.use) — shared `/` mount with public routers.
const auth = authenticate;

// Relief items
reliefRouter.post('/relief-items', auth, authorize('NGO', 'ADMIN'), asyncHandler(reliefController.createItem));
reliefRouter.get('/relief-items', auth, asyncHandler(reliefController.listItems));
reliefRouter.get('/relief-items/:id', auth, asyncHandler(reliefController.getItem));
reliefRouter.patch('/relief-items/:id', auth, authorize('NGO', 'ADMIN'), asyncHandler(reliefController.updateItem));
reliefRouter.delete('/relief-items/:id', auth, authorize('ADMIN'), asyncHandler(reliefController.deleteItem));

// Inventory
reliefRouter.post('/inventory', auth, authorize('NGO', 'ADMIN'), asyncHandler(reliefController.createInventory));
reliefRouter.get('/inventory', auth, asyncHandler(reliefController.listInventory));
reliefRouter.get('/inventory/shortages', auth, authorize('ADMIN', 'NGO'), asyncHandler(reliefController.shortages));
reliefRouter.get('/inventory/:id', auth, asyncHandler(reliefController.getInventory));
reliefRouter.patch('/inventory/:id', auth, authorize('NGO', 'ADMIN'), asyncHandler(reliefController.updateInventory));

// Resource requests
reliefRouter.post('/resource-requests', auth, authorize('SHELTER_MANAGER', 'ADMIN'), asyncHandler(reliefController.createResourceRequest));
reliefRouter.get('/resource-requests', auth, authorize('SHELTER_MANAGER', 'ADMIN', 'NGO'), asyncHandler(reliefController.listResourceRequests));
reliefRouter.get('/resource-requests/:id', auth, authorize('SHELTER_MANAGER', 'ADMIN', 'NGO'), asyncHandler(reliefController.getResourceRequest));
reliefRouter.post('/resource-requests/:id/approve', auth, authorize('ADMIN', 'NGO'), asyncHandler(reliefController.approveResourceRequest));
reliefRouter.post('/resource-requests/:id/reject', auth, authorize('ADMIN', 'NGO'), asyncHandler(reliefController.rejectResourceRequest));
reliefRouter.post('/resource-requests/:id/cancel', auth, authorize('SHELTER_MANAGER', 'ADMIN'), asyncHandler(reliefController.cancelResourceRequest));

// Allocations
reliefRouter.post('/allocations', auth, authorize('ADMIN', 'NGO'), asyncHandler(reliefController.createAllocation));
reliefRouter.get('/allocations', auth, authorize('ADMIN', 'NGO'), asyncHandler(reliefController.listAllocations));
reliefRouter.get('/allocations/:id', auth, authorize('ADMIN', 'NGO'), asyncHandler(reliefController.getAllocation));
reliefRouter.patch('/allocations/:id/status', auth, authorize('ADMIN', 'NGO'), asyncHandler(reliefController.updateAllocationStatus));
