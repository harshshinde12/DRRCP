// Hand-maintained OpenAPI 3.0 spec for the DRRCP REST API.
// Served as Swagger UI at GET /api/docs and raw JSON at GET /api/docs.json.
// Keep in sync with src/routes/* when endpoints change.

const bearer = [{ bearerAuth: [] }];

const pageParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
];

const err = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function op(summary: string, tags: string[], extra: Record<string, any> = {}) {
  return { summary, tags, security: bearer, ...extra };
}

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'DRRCP — Disaster Relief & Rescue Coordination Platform',
    version: '0.2.0',
    description:
      'Release 1.0 REST API. Citizens raise emergency requests; admins verify and dispatch rescue teams/volunteers; shelter managers track capacity; NGOs/admins manage relief inventory. Auth: `Authorization: Bearer <JWT>` (login to get one). Demo password for all seeded accounts: `Password@123`.',
  },
  servers: [{ url: '/api', description: 'Same-origin API base' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: {
        type: 'object',
        properties: { success: { type: 'boolean', example: false }, error: { type: 'object', properties: { message: { type: 'string' } } } },
      },
      PageMeta: {
        type: 'object',
        properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } },
      },
      User: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, role: { type: 'string', enum: ['CITIZEN', 'VOLUNTEER', 'RESCUE_TEAM', 'SHELTER_MANAGER', 'NGO', 'ADMIN'] }, phone: { type: 'string', nullable: true } },
      },
      Disaster: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, type: { type: 'string' }, affectedArea: { type: 'string' }, severity: { type: 'string' }, status: { type: 'string' }, startDate: { type: 'string', format: 'date-time' } },
      },
      EmergencyRequest: {
        type: 'object',
        properties: {
          id: { type: 'string' }, emergencyType: { type: 'string' }, description: { type: 'string' }, location: { type: 'string' },
          latitude: { type: 'number', nullable: true }, longitude: { type: 'number', nullable: true }, peopleAffected: { type: 'integer' },
          injuryPresent: { type: 'boolean' }, injurySeverity: { type: 'string', nullable: true }, priority: { type: 'string' }, status: { type: 'string' }, duplicateOfId: { type: 'string', nullable: true },
          missionStatus: { type: 'string', nullable: true }, displayStatus: { type: 'string' },
        },
      },
      RescueTeam: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, teamType: { type: 'string' }, memberCount: { type: 'integer' }, capability: { type: 'string' }, currentLocation: { type: 'string' }, latitude: { type: 'number', nullable: true }, longitude: { type: 'number', nullable: true }, availabilityStatus: { type: 'string' } },
      },
      RescueAssignment: {
        type: 'object',
        properties: { id: { type: 'string' }, requestId: { type: 'string' }, teamId: { type: 'string' }, status: { type: 'string' }, assignedAt: { type: 'string' } },
      },
      Shelter: {
        type: 'object',
        properties: { id: { type: 'string' }, name: { type: 'string' }, location: { type: 'string' }, totalCapacity: { type: 'integer' }, currentOccupancy: { type: 'integer' }, availableCapacity: { type: 'integer' }, facilities: { type: 'string' }, operatingStatus: { type: 'string' } },
      },
    },
  },
  paths: {
    '/health': {
      get: { summary: 'Health probe', tags: ['System'], responses: { '200': { description: 'ok' } } },
    },
    '/meta': {
      get: { summary: 'Display metadata: enum values, labels, color keys, lifecycles (public)', tags: ['System'], responses: { '200': { description: 'ok' } } },
    },
    // ── Auth ──
    '/auth/register': {
      post: {
        summary: 'Self-register (CITIZEN, VOLUNTEER, SHELTER_MANAGER, NGO only)',
        tags: ['Auth'],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' }, role: { type: 'string', default: 'CITIZEN' }, phone: { type: 'string' }, address: { type: 'string' }, skills: { type: 'string' }, availability: { type: 'string' }, serviceArea: { type: 'string' }, organizationName: { type: 'string' } } } } }},
        responses: { '201': { description: 'created' }, '403': err('ADMIN/RESCUE_TEAM rejected'), '409': err('email taken') },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login → { user, token }',
        tags: ['Auth'],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } } }},
        responses: { '200': { description: 'ok' }, '401': err('bad credentials') },
      },
    },
    '/auth/logout': { post: op('Logout (client discards token)', ['Auth'], { responses: { '200': { description: 'ok' } } }) },
    '/auth/me': { get: op('Current user', ['Auth'], { responses: { '200': { description: 'ok' }, '401': err('unauthorized') } }) },
    // ── Admin ──
    '/admin/users': {
      post: op('Provision any account (RESCUE_TEAM also creates team record)', ['Admin'], {
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['name', 'email', 'password', 'role'], properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' }, role: { type: 'string' }, team: { type: 'object', properties: { name: { type: 'string' }, teamType: { type: 'string' }, memberCount: { type: 'integer' }, capability: { type: 'string' }, currentLocation: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' } } } } } } }},
        responses: { '201': { description: 'created' }, '403': err('admin only'), '409': err('email taken') },
      }),
      get: op('List users (filter role, search)', ['Admin'], { parameters: [...pageParams, { name: 'role', in: 'query', schema: { type: 'string' } }, { name: 'search', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    // ── Disasters ──
    '/disasters': {
      post: op('Create disaster', ['Disasters'], {
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['name', 'type', 'affectedArea', 'severity', 'startDate'], properties: { name: { type: 'string' }, type: { type: 'string' }, affectedArea: { type: 'string' }, severity: { type: 'string', enum: ['LOW', 'MODERATE', 'SEVERE', 'CRITICAL'] }, status: { type: 'string', default: 'ACTIVE' }, startDate: { type: 'string', format: 'date-time' } } } } }},
        responses: { '201': { description: 'created' } },
      }),
      get: op('List disasters', ['Disasters'], { parameters: [...pageParams, { name: 'status', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/disasters/active': { get: op('Current active disaster', ['Disasters'], { responses: { '200': { description: 'ok' }, '404': err('none active') } }) },
    '/disasters/{id}': {
      get: op('Get disaster', ['Disasters'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' }, '404': err('not found') } }),
      patch: op('Update disaster', ['Admin'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/disasters/{id}/activate': { post: op('Activate (demotes other ACTIVE → MONITORING)', ['Disasters'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }) },
    '/disasters/{id}/close': { post: op('Close (→ RESOLVED)', ['Disasters'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }) },
    // ── Requests ──
    '/requests': {
      post: op('Submit emergency request (auto-links active disaster)', ['Requests'], {
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['emergencyType', 'description', 'location', 'peopleAffected'], properties: { emergencyType: { type: 'string' }, description: { type: 'string' }, location: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' }, peopleAffected: { type: 'integer' }, injuryPresent: { type: 'boolean' }, injurySeverity: { type: 'string' }, disasterId: { type: 'string' } } } } }},
        responses: { '201': { description: 'created' } },
      }),
      get: op('List requests (citizens: own only)', ['Requests'], {
        parameters: [...pageParams, { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'priority', in: 'query', schema: { type: 'string' } }, { name: 'emergencyType', in: 'query', schema: { type: 'string' } }, { name: 'disasterId', in: 'query', schema: { type: 'string' } }, { name: 'search', in: 'query', schema: { type: 'string' } }],
        responses: { '200': { description: 'ok' } },
      }),
    },
    '/requests/{id}': {
      get: op('Get request detail (incl. assignments)', ['Requests'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' }, '404': err('not found') } }),
    },
    '/requests/{id}/history': {
      get: op('Status-change history (audit trail)', ['Requests'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/requests/{id}/cancel': {
      post: op('Citizen cancels own SUBMITTED/VERIFIED request', ['Requests'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' }, '422': err('bad transition') } }),
    },
    '/requests/{id}/verify': {
      post: op('Admin triage: VERIFIED (+priority) | DUPLICATE (link) | REJECTED', ['Requests'], {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['decision'], properties: { decision: { type: 'string', enum: ['VERIFIED', 'DUPLICATE', 'REJECTED'] }, priority: { type: 'string', default: 'MEDIUM' }, duplicateOfId: { type: 'string' } } } } }},
        responses: { '200': { description: 'ok' }, '422': err('bad transition') },
      }),
    },
    '/requests/{id}/priority': {
      patch: op('Admin sets priority', ['Requests'], {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['priority'], properties: { priority: { type: 'string' } } } } }},
        responses: { '200': { description: 'ok' } },
      }),
    },
    '/requests/{id}/matching-teams': {
      get: op('Rank AVAILABLE teams by capability + distance', ['Rescue'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/requests/{id}/assign': {
      post: op('Assign team (must be AVAILABLE unless override:true)', ['Rescue'], {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['teamId'], properties: { teamId: { type: 'string' }, override: { type: 'boolean', default: false }, overrideReason: { type: 'string' } } } } }},
        responses: { '201': { description: 'created' }, '409': err('team unavailable') },
      }),
    },
    // ── Rescue ──
    '/teams': {
      post: op('Register rescue team', ['Rescue'], {
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['name', 'teamType', 'memberCount', 'capability', 'currentLocation'], properties: { name: { type: 'string' }, teamType: { type: 'string' }, memberCount: { type: 'integer' }, capability: { type: 'string' }, currentLocation: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' }, userId: { type: 'string' } } } } }},
        responses: { '201': { description: 'created' } },
      }),
      get: op('List teams', ['Rescue'], { parameters: [...pageParams, { name: 'availabilityStatus', in: 'query', schema: { type: 'string' } }, { name: 'teamType', in: 'query', schema: { type: 'string' } }, { name: 'capability', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/teams/{id}': {
      get: op('Get team', ['Rescue'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
      patch: op('Update team location/capability (availability moves only via mission flow or availability action)', ['Rescue'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/teams/{id}/availability': {
      post: op('Admin marks team AVAILABLE (audited; 409 while active assignments exist)', ['Rescue'], {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['availabilityStatus'], properties: { availabilityStatus: { type: 'string', enum: ['AVAILABLE'] } } } } } },
        responses: { '200': { description: 'ok' }, '409': err('active assignments') },
      }),
    },
    '/assignments': {
      get: op('List assignments (teams: own only)', ['Rescue'], { parameters: [...pageParams, { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'teamId', in: 'query', schema: { type: 'string' } }, { name: 'requestId', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/assignments/{id}': {
      get: op('Get assignment', ['Rescue'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/assignments/{id}/acknowledge': {
      post: op('Team acknowledges mission', ['Rescue'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/assignments/{id}/status': {
      patch: op('Team updates mission status', ['Rescue'], {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['ACKNOWLEDGED', 'ON_THE_WAY', 'RESCUE_IN_PROGRESS', 'CANCELLED'] } } } } }},
        responses: { '200': { description: 'ok' }, '422': err('bad transition') },
      }),
    },
    '/assignments/{id}/request-support': {
      post: op('Rescue unsuccessful → request additional support (alerts admins)', ['Rescue'], {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['notes'], properties: { notes: { type: 'string' } } } } } },
        responses: { '200': { description: 'ok' } },
      }),
    },
    '/assignments/{id}/report': {
      post: op('File rescue report → COMPLETED, team freed, request RESOLVED', ['Rescue'], {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['peopleRescued', 'injuredPeople'], properties: { peopleRescued: { type: 'integer' }, injuredPeople: { type: 'integer' }, notes: { type: 'string' } } } } }},
        responses: { '201': { description: 'created' }, '409': err('report exists') },
      }),
    },
    '/assignments/{id}/cancel': {
      post: op('Admin cancels assignment (team freed)', ['Rescue'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    // ── Volunteers ──
    '/volunteers': {
      get: op('List volunteers', ['Volunteers'], { parameters: [...pageParams, { name: 'skills', in: 'query', schema: { type: 'string' } }, { name: 'serviceArea', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/volunteers/suggest': {
      get: op('Rank volunteers by skill match + area (taskType, location)', ['Volunteers'], {
        parameters: [{ name: 'taskType', in: 'query', required: true, schema: { type: 'string' } }, { name: 'location', in: 'query', required: true, schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }],
        responses: { '200': { description: 'ok' } },
      }),
    },
    '/volunteers/{id}': {
      get: op('Get volunteer', ['Volunteers'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
      patch: op('Update volunteer profile (self or admin)', ['Volunteers'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/volunteer-tasks': {
      post: op('Assign task (skill match + low-risk enforced)', ['Volunteers'], {
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['volunteerId', 'title', 'taskType', 'location'], properties: { volunteerId: { type: 'string' }, title: { type: 'string' }, taskType: { type: 'string' }, location: { type: 'string' } } } } }},
        responses: { '201': { description: 'created' }, '422': err('skill mismatch / high-risk') },
      }),
      get: op('List tasks (volunteers: own only)', ['Volunteers'], { parameters: [...pageParams, { name: 'status', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/volunteer-tasks/{id}': {
      get: op('Get task', ['Volunteers'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/volunteer-tasks/{id}/accept': {
      post: op('Volunteer accepts task', ['Volunteers'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/volunteer-tasks/{id}/decline': {
      post: op('Volunteer declines task', ['Volunteers'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/volunteer-tasks/{id}/status': {
      patch: op('Update task status', ['Volunteers'], {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string' } } } } } },
        responses: { '200': { description: 'ok' } },
      }),
    },
    // ── Shelters (listings public) ──
    '/shelters': {
      post: op('Register shelter', ['Shelters'], {
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['name', 'location', 'totalCapacity', 'facilities'], properties: { name: { type: 'string' }, location: { type: 'string' }, latitude: { type: 'number' }, longitude: { type: 'number' }, totalCapacity: { type: 'integer' }, currentOccupancy: { type: 'integer' }, facilities: { type: 'string' }, operatingStatus: { type: 'string' }, managerId: { type: 'string' } } } } }},
        responses: { '201': { description: 'created' } },
      }),
      get: { summary: 'List shelters (public)', tags: ['Shelters'], parameters: [...pageParams, { name: 'operatingStatus', in: 'query', schema: { type: 'string' } }, { name: 'facility', in: 'query', schema: { type: 'string' } }, { name: 'openOnly', in: 'query', schema: { type: 'boolean' } }, { name: 'managerId', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } },
    },
    '/shelters/nearby': {
      get: { summary: 'Nearby OPEN shelters with free beds (public, Haversine)', tags: ['Shelters'], parameters: [{ name: 'lat', in: 'query', required: true, schema: { type: 'number' } }, { name: 'lng', in: 'query', required: true, schema: { type: 'number' } }, { name: 'radiusKm', in: 'query', schema: { type: 'number' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'ok' } } },
    },
    '/shelters/{id}': {
      get: { summary: 'Get shelter (public)', tags: ['Shelters'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } },
      patch: op('Update occupancy / facilities / status (occupancy ≤ capacity unless emergencyOverride + overrideReason, audited)', ['Shelters'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { currentOccupancy: { type: 'integer' }, operatingStatus: { type: 'string' }, emergencyOverride: { type: 'boolean' }, overrideReason: { type: 'string' } } } } } }, responses: { '200': { description: 'ok' }, '422': err('capacity exceeded / reason required') } }),
      delete: op('Delete shelter', ['Shelters'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    // ── Relief ──
    '/relief-items': {
      post: op('Register relief item', ['Relief'], {
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['itemName', 'category', 'unit'], properties: { itemName: { type: 'string' }, category: { type: 'string' }, unit: { type: 'string' } } } } }},
        responses: { '201': { description: 'created' } },
      }),
      get: op('List relief items', ['Relief'], { parameters: [...pageParams, { name: 'category', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/relief-items/{id}': {
      get: op('Get relief item', ['Relief'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
      patch: op('Update relief item', ['Relief'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
      delete: op('Delete relief item', ['Relief'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/inventory': {
      post: op('Register stock', ['Relief'], {
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['itemId', 'location', 'quantityAvailable'], properties: { itemId: { type: 'string' }, location: { type: 'string' }, organization: { type: 'string' }, quantityAvailable: { type: 'integer' } } } } }},
        responses: { '201': { description: 'created' } },
      }),
      get: op('List inventory', ['Relief'], { parameters: [...pageParams, { name: 'itemId', in: 'query', schema: { type: 'string' } }, { name: 'location', in: 'query', schema: { type: 'string' } }, { name: 'lowStock', in: 'query', schema: { type: 'boolean' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/inventory/shortages': { get: op('Shortage report (demand vs stock)', ['Relief'], { responses: { '200': { description: 'ok' } } }) },
    '/inventory/{id}': {
      get: op('Get inventory record', ['Relief'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
      patch: op('Adjust stock', ['Relief'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/resource-requests': {
      post: op('Raise resource request (own shelter)', ['Relief'], {
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['itemId', 'quantityRequired'], properties: { shelterId: { type: 'string' }, itemId: { type: 'string' }, quantityRequired: { type: 'integer' }, priority: { type: 'string', default: 'MEDIUM' } } } } }},
        responses: { '201': { description: 'created' } },
      }),
      get: op('List resource requests', ['Relief'], { parameters: [...pageParams, { name: 'status', in: 'query', schema: { type: 'string' } }, { name: 'itemId', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/resource-requests/{id}': {
      get: op('Get resource request', ['Relief'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/resource-requests/{id}/approve': {
      post: op('Approve request', ['Relief'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/resource-requests/{id}/reject': {
      post: op('Reject request', ['Relief'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/resource-requests/{id}/cancel': {
      post: op('Cancel request', ['Relief'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/allocations': {
      post: op('Allocate stock (atomic; blocks over-allocation)', ['Relief'], {
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['resourceRequestId', 'inventoryId', 'quantity'], properties: { resourceRequestId: { type: 'string' }, inventoryId: { type: 'string' }, quantity: { type: 'integer' } } } } }},
        responses: { '201': { description: 'created' }, '422': err('over-allocation blocked') },
      }),
      get: op('Allocation history', ['Relief'], { parameters: [...pageParams, { name: 'status', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/allocations/{id}': {
      get: op('Get allocation', ['Relief'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/allocations/{id}/status': {
      patch: op('Update allocation status (cancel restores stock)', ['Relief'], {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['status'], properties: { status: { type: 'string' } } } } } },
        responses: { '200': { description: 'ok' } },
      }),
    },
    // ── Notifications / dashboard ──
    '/notifications': {
      get: op('My notifications (newest first)', ['Notifications'], { parameters: [...pageParams, { name: 'isRead', in: 'query', schema: { type: 'boolean' } }, { name: 'type', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/notifications/unread-count': { get: op('Unread count', ['Notifications'], { responses: { '200': { description: 'ok' } } }) },
    '/notifications/{id}/read': {
      patch: op('Mark as read', ['Notifications'], { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
    '/notifications/read-all': { patch: op('Mark all as read', ['Notifications'], { responses: { '200': { description: 'ok' } } }) },
    '/alerts/broadcast': {
      post: op('Publish public alert to roles (default: all)', ['Notifications'], {
        requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' }, type: { type: 'string', default: 'PUBLIC_ALERT' }, roles: { type: 'array', items: { type: 'string' } } } } } }},
        responses: { '201': { description: 'created' } },
      }),
    },
    '/dashboard/summary': { get: op('Operational summary (requests, teams, shelters, stock, response time)', ['Dashboard'], { responses: { '200': { description: 'ok' } } }) },
    '/dashboard/timeseries': {
      get: op('Requests-per-day series for charts', ['Dashboard'], { parameters: [{ name: 'days', in: 'query', schema: { type: 'integer', default: 14 } }], responses: { '200': { description: 'ok' } } }),
    },
    '/audit-logs': {
      get: op('Audit trail (filter action/actor/target)', ['Dashboard'], { parameters: [...pageParams, { name: 'action', in: 'query', schema: { type: 'string' } }, { name: 'actorId', in: 'query', schema: { type: 'string' } }, { name: 'target', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'ok' } } }),
    },
  },
};
