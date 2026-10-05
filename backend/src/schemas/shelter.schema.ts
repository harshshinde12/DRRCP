import { z } from 'zod';
import { SHELTER_STATUSES } from '../utils/enums.js';
import { strictBoolean } from './common.schema.js';

export const createShelterSchema = z.object({
  name: z.string().min(2).max(200),
  location: z.string().min(2).max(500),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  totalCapacity: z.coerce.number().int().min(1).max(100000),
  currentOccupancy: z.coerce.number().int().min(0).max(100000).default(0),
  facilities: z.string().min(1).max(500),
  operatingStatus: z.enum(SHELTER_STATUSES).default('OPEN'),
  managerId: z.string().min(1).optional(), // ADMIN may assign; managers own their shelters
});

export const updateShelterSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  location: z.string().min(2).max(500).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  totalCapacity: z.coerce.number().int().min(1).max(100000).optional(),
  currentOccupancy: z.coerce.number().int().min(0).max(100000).optional(),
  facilities: z.string().min(1).max(500).optional(),
  operatingStatus: z.enum(SHELTER_STATUSES).optional(),
  emergencyOverride: strictBoolean.optional(),
});

export const listSheltersQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  operatingStatus: z.enum(SHELTER_STATUSES).optional(),
  facility: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
  openOnly: strictBoolean.optional(),
});

export const nearbySheltersQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(500).default(25),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
