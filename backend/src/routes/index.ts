import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { authRouter } from './auth.routes.js';
import { adminRouter } from './admin.routes.js';
import { disasterRouter } from './disaster.routes.js';
import { requestRouter } from './request.routes.js';
import { rescueRouter } from './rescue.routes.js';
import { volunteerRouter } from './volunteer.routes.js';
import { shelterRouter } from './shelter.routes.js';
import { reliefRouter } from './relief.routes.js';
import { notifyRouter } from './notify.routes.js';
import { openApiSpec } from '../docs/openapi.js';
import { META } from '../utils/enums.js';
import { ok } from '../utils/response.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => ok(res, { status: 'ok', service: 'drrcp-backend', time: new Date().toISOString() }));

// Public reference data: enum values + labels + color keys + lifecycles.
// The frontend consumes this and never hardcodes domain values.
apiRouter.get('/meta', (_req, res) => ok(res, META));

// Interactive API reference (works against the seeded DB).
apiRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
apiRouter.get('/docs.json', (_req, res) => res.json(openApiSpec));

apiRouter.use('/auth', authRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/disasters', disasterRouter);
apiRouter.use('/requests', requestRouter);
apiRouter.use('/', rescueRouter); // /teams, /assignments, /requests/:id/{assign,matching-teams}
apiRouter.use('/', volunteerRouter); // /volunteers, /volunteer-tasks
apiRouter.use('/', shelterRouter); // /shelters (list/nearby are public)
apiRouter.use('/', reliefRouter); // /relief-items, /inventory, /resource-requests, /allocations
apiRouter.use('/', notifyRouter); // /notifications, /alerts, /dashboard, /audit-logs
