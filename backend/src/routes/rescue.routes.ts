import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/httpErrors.js';
import * as rescueController from '../controllers/rescue.controller.js';

// NOTE: per-route authenticate (not router.use) — this router shares the `/`
// mount with public routers, and a blanket use() would 401 their traffic.
const auth = authenticate;

export const rescueRouter = Router();

// Teams
rescueRouter.post('/teams', auth, authorize('ADMIN'), asyncHandler(rescueController.createTeam));
rescueRouter.get('/teams', auth, authorize('ADMIN', 'RESCUE_TEAM'), asyncHandler(rescueController.listTeams));
rescueRouter.get('/teams/:id', auth, authorize('ADMIN', 'RESCUE_TEAM'), asyncHandler(rescueController.getTeam));
rescueRouter.patch('/teams/:id', auth, authorize('ADMIN'), asyncHandler(rescueController.updateTeam));
rescueRouter.post('/teams/:id/availability', auth, authorize('ADMIN'), asyncHandler(rescueController.setAvailability));

// Assignments
rescueRouter.get('/assignments', auth, authorize('ADMIN', 'RESCUE_TEAM'), asyncHandler(rescueController.listAssignments));
rescueRouter.get('/assignments/:id', auth, authorize('ADMIN', 'RESCUE_TEAM'), asyncHandler(rescueController.getAssignment));
rescueRouter.post('/assignments/:id/acknowledge', auth, authorize('RESCUE_TEAM'), asyncHandler(rescueController.acknowledge));
rescueRouter.patch('/assignments/:id/status', auth, authorize('RESCUE_TEAM'), asyncHandler(rescueController.updateStatus));
rescueRouter.post('/assignments/:id/request-support', auth, authorize('RESCUE_TEAM'), asyncHandler(rescueController.requestSupport));
rescueRouter.post('/assignments/:id/report', auth, authorize('RESCUE_TEAM'), asyncHandler(rescueController.submitReport));
rescueRouter.post('/assignments/:id/cancel', auth, authorize('ADMIN'), asyncHandler(rescueController.cancelAssignment));

// Assignment entry points scoped under requests
rescueRouter.get('/requests/:id/matching-teams', auth, authorize('ADMIN'), asyncHandler(rescueController.matchingTeams));
rescueRouter.post('/requests/:id/assign', auth, authorize('ADMIN'), asyncHandler(rescueController.assignTeam));
