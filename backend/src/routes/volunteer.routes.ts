import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/httpErrors.js';
import * as volunteerController from '../controllers/volunteer.controller.js';

// NOTE: per-route authenticate (not router.use) — shared `/` mount with public routers.
const auth = authenticate;

export const volunteerRouter = Router();

volunteerRouter.get('/volunteers', auth, authorize('ADMIN'), asyncHandler(volunteerController.listVolunteers));
volunteerRouter.get('/volunteers/suggest', auth, authorize('ADMIN'), asyncHandler(volunteerController.suggestVolunteers));
volunteerRouter.get('/volunteers/:id', auth, authorize('ADMIN', 'VOLUNTEER'), asyncHandler(volunteerController.getVolunteer));
volunteerRouter.patch('/volunteers/:id', auth, authorize('ADMIN', 'VOLUNTEER'), asyncHandler(volunteerController.updateVolunteer));

volunteerRouter.post('/volunteer-tasks', auth, authorize('ADMIN'), asyncHandler(volunteerController.createTask));
volunteerRouter.get('/volunteer-tasks', auth, authorize('ADMIN', 'VOLUNTEER'), asyncHandler(volunteerController.listTasks));
volunteerRouter.get('/volunteer-tasks/:id', auth, authorize('ADMIN', 'VOLUNTEER'), asyncHandler(volunteerController.getTask));
volunteerRouter.post('/volunteer-tasks/:id/accept', auth, authorize('VOLUNTEER'), asyncHandler(volunteerController.acceptTask));
volunteerRouter.post('/volunteer-tasks/:id/decline', auth, authorize('VOLUNTEER'), asyncHandler(volunteerController.declineTask));
volunteerRouter.patch('/volunteer-tasks/:id/status', auth, authorize('VOLUNTEER', 'ADMIN'), asyncHandler(volunteerController.updateTaskStatus));
