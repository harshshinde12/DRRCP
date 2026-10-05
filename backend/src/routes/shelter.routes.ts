import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/httpErrors.js';
import * as shelterController from '../controllers/shelter.controller.js';

export const shelterRouter = Router();

// Listings are public per SRS SE-2 (citizens browse shelters without login).
shelterRouter.get('/shelters', asyncHandler(shelterController.listShelters));
shelterRouter.get('/shelters/nearby', asyncHandler(shelterController.nearbyShelters));
shelterRouter.get('/shelters/:id', asyncHandler(shelterController.getShelter));

shelterRouter.post('/shelters', authenticate, authorize('SHELTER_MANAGER', 'ADMIN'), asyncHandler(shelterController.createShelter));
shelterRouter.patch('/shelters/:id', authenticate, authorize('SHELTER_MANAGER', 'ADMIN'), asyncHandler(shelterController.updateShelter));
shelterRouter.delete('/shelters/:id', authenticate, authorize('ADMIN'), asyncHandler(shelterController.deleteShelter));
