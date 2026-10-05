/**
 * DRRCP demo seed — realistic data for Phase 1.
 * Run: npm run seed --workspace=backend
 * Idempotent: wipes domain tables (dev only) then re-creates.
 */
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Password@123';

async function main() {
  console.log('[seed] clearing existing data…');
  // Delete in reverse-FK order
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.rescueReport.deleteMany();
  await prisma.rescueAssignment.deleteMany();
  await prisma.resourceAllocation.deleteMany();
  await prisma.resourceRequest.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.reliefItem.deleteMany();
  await prisma.volunteerTask.deleteMany();
  await prisma.emergencyRequest.deleteMany();
  await prisma.shelter.deleteMany();
  await prisma.rescueTeam.deleteMany();
  await prisma.disaster.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  type NewUser = {
    name: string; email: string; role: string; phone?: string; address?: string;
    skills?: string; availability?: string; serviceArea?: string; organizationName?: string;
    registrationNumber?: string; authority?: string; contactNumber?: string;
  };
  const user = (data: NewUser) => prisma.user.create({ data: { passwordHash, ...data } });

  console.log('[seed] creating users…');
  const admin = await user({ name: 'Aarav Admin', email: 'admin@drrcp.local', role: 'ADMIN', authority: 'Disaster Management Authority', phone: '+91-9000000001' });

  const citizens = [];
  citizens.push(await user({ name: 'Priya Patil', email: 'citizen1@drrcp.local', role: 'CITIZEN', address: 'Andheri West, Mumbai', phone: '+91-9000000011' }));
  citizens.push(await user({ name: 'Rahul Deshmukh', email: 'citizen2@drrcp.local', role: 'CITIZEN', address: 'Kurla, Mumbai', phone: '+91-9000000012' }));
  citizens.push(await user({ name: 'Sneha Kulkarni', email: 'citizen3@drrcp.local', role: 'CITIZEN', address: 'Dadar, Mumbai', phone: '+91-9000000013' }));

  const volunteers = [];
  volunteers.push(await user({ name: 'Amit Verma', email: 'volunteer1@drrcp.local', role: 'VOLUNTEER', skills: 'FIRST_AID,COMMUNICATION', availability: 'FULL_TIME', serviceArea: 'Andheri', phone: '+91-9000000021' }));
  volunteers.push(await user({ name: 'Neha Joshi', email: 'volunteer2@drrcp.local', role: 'VOLUNTEER', skills: 'LOGISTICS,DISTRIBUTION', availability: 'WEEKENDS', serviceArea: 'Bandra', phone: '+91-9000000022' }));
  volunteers.push(await user({ name: 'Karan Mehta', email: 'volunteer3@drrcp.local', role: 'VOLUNTEER', skills: 'COOKING,DISTRIBUTION', availability: 'FULL_TIME', serviceArea: 'Kurla', phone: '+91-9000000023' }));
  volunteers.push(await user({ name: 'Divya Nair', email: 'volunteer4@drrcp.local', role: 'VOLUNTEER', skills: 'FIRST_AID,LOGISTICS', availability: 'WEEKDAYS', serviceArea: 'Dadar', phone: '+91-9000000024' }));

  const shelterManager = await user({ name: 'Meera Iyer', email: 'shelter.manager@drrcp.local', role: 'SHELTER_MANAGER', contactNumber: '+91-9000000031', phone: '+91-9000000031' });

  const ngos = [];
  ngos.push(await user({ name: 'Mumbai Relief Foundation', email: 'ngo1@drrcp.local', role: 'NGO', organizationName: 'Mumbai Relief Foundation', registrationNumber: 'NGO-MH-001', serviceArea: 'Mumbai', phone: '+91-9000000041' }));
  ngos.push(await user({ name: 'Seva Sahayog Trust', email: 'ngo2@drrcp.local', role: 'NGO', organizationName: 'Seva Sahayog Trust', registrationNumber: 'NGO-MH-002', serviceArea: 'Thane', phone: '+91-9000000042' }));

  // Rescue-team login accounts + team profiles
  const teamUsers = [];
  teamUsers.push(await user({ name: 'Alpha Flood Rescue', email: 'team.alpha@drrcp.local', role: 'RESCUE_TEAM', serviceArea: 'Western Suburbs', phone: '+91-9000000051' }));
  teamUsers.push(await user({ name: 'Bravo Medical Unit', email: 'team.bravo@drrcp.local', role: 'RESCUE_TEAM', serviceArea: 'Central Mumbai', phone: '+91-9000000052' }));
  teamUsers.push(await user({ name: 'Charlie Fire Squad', email: 'team.charlie@drrcp.local', role: 'RESCUE_TEAM', serviceArea: 'Harbour Line', phone: '+91-9000000053' }));

  console.log('[seed] creating disaster…');
  const disaster = await prisma.disaster.create({
    data: {
      name: 'Mumbai Floods 2026',
      type: 'FLOOD',
      affectedArea: 'Mumbai Metropolitan Region — Andheri, Kurla, Dadar, Thane creek',
      severity: 'SEVERE',
      status: 'ACTIVE',
      startDate: new Date('2026-07-15T06:00:00Z'),
    },
  });

  console.log('[seed] creating rescue teams…');
  const teamAlpha = await prisma.rescueTeam.create({ data: { name: 'Alpha Flood Rescue', teamType: 'FLOOD_RESCUE', memberCount: 12, capability: 'BOAT_RESCUE,SWIMMING,FIRST_AID', currentLocation: 'Andheri Sports Complex', latitude: 19.1362, longitude: 72.8272, availabilityStatus: 'ASSIGNED', userId: teamUsers[0].id } });
  const teamBravo = await prisma.rescueTeam.create({ data: { name: 'Bravo Medical Unit', teamType: 'MEDICAL', memberCount: 8, capability: 'TRIAGE,OXYGEN,AMBULANCE', currentLocation: 'KEM Hospital, Parel', latitude: 19.0120, longitude: 72.8417, availabilityStatus: 'ON_THE_WAY', userId: teamUsers[1].id } });
  const teamCharlie = await prisma.rescueTeam.create({ data: { name: 'Charlie Fire Squad', teamType: 'FIRE', memberCount: 10, capability: 'FIRE_SUPPRESSION,STRUCTURAL', currentLocation: 'Dadar Fire Station', latitude: 19.0178, longitude: 72.8478, availabilityStatus: 'AVAILABLE', userId: teamUsers[2].id } });

  console.log('[seed] creating emergency requests (mixed statuses)…');
  const req1 = await prisma.emergencyRequest.create({
    data: { requesterId: citizens[0].id, disasterId: disaster.id, emergencyType: 'RESCUE', description: 'Water up to 4ft in ground floor, 2 elderly + 1 child stranded', location: 'Bldg 7, Andheri West, Mumbai', latitude: 19.1362, longitude: 72.8272, peopleAffected: 3, injuryPresent: false, priority: 'CRITICAL', status: 'ASSIGNED' },
  });
  const req2 = await prisma.emergencyRequest.create({
    data: { requesterId: citizens[1].id, disasterId: disaster.id, emergencyType: 'MEDICAL', description: 'Neighbour unconscious, need oxygen + ambulance', location: 'Kurla West, Near Station', latitude: 19.0726, longitude: 72.8839, peopleAffected: 1, injuryPresent: true, injurySeverity: 'SEVERE', priority: 'CRITICAL', status: 'RESCUE_IN_PROGRESS' },
  });
  const req3 = await prisma.emergencyRequest.create({
    data: { requesterId: citizens[2].id, disasterId: disaster.id, emergencyType: 'FOOD', description: 'Society of 40 people needs cooked food + drinking water', location: 'Dadar East, Mumbai', peopleAffected: 40, injuryPresent: false, priority: 'HIGH', status: 'VERIFIED' },
  });
  const req4 = await prisma.emergencyRequest.create({
    data: { requesterId: citizens[0].id, disasterId: disaster.id, emergencyType: 'WATER', description: 'Duplicate report of Andheri flooding from same lane', location: 'Andheri West, Mumbai', peopleAffected: 5, injuryPresent: false, priority: 'MEDIUM', status: 'DUPLICATE', duplicateOfId: req1.id },
  });
  const req5 = await prisma.emergencyRequest.create({
    data: { requesterId: citizens[1].id, disasterId: disaster.id, emergencyType: 'SHELTER', description: 'Family of 4 needs shelter for tonight', location: 'Kurla, Mumbai', peopleAffected: 4, injuryPresent: false, priority: 'MEDIUM', status: 'SUBMITTED' },
  });
  const req6 = await prisma.emergencyRequest.create({
    data: { requesterId: citizens[2].id, disasterId: disaster.id, emergencyType: 'RESCUE', description: 'Dog + owner stuck on terrace, resolved yesterday', location: 'Dadar West', peopleAffected: 1, injuryPresent: false, priority: 'LOW', status: 'RESOLVED' },
  });

  console.log('[seed] creating assignments + report…');
  const asg1 = await prisma.rescueAssignment.create({ data: { requestId: req1.id, teamId: teamAlpha.id, assignedById: admin.id, status: 'ASSIGNED' } });
  const asg2 = await prisma.rescueAssignment.create({ data: { requestId: req2.id, teamId: teamBravo.id, assignedById: admin.id, status: 'RESCUE_IN_PROGRESS' } });
  const asg3 = await prisma.rescueAssignment.create({ data: { requestId: req6.id, teamId: teamCharlie.id, assignedById: admin.id, status: 'COMPLETED', completedAt: new Date() } });
  await prisma.rescueReport.create({ data: { assignmentId: asg3.id, peopleRescued: 1, injuredPeople: 0, notes: 'Owner + pet evacuated safely via ladder. No injuries.' } });

  console.log('[seed] creating volunteer tasks…');
  await prisma.volunteerTask.create({ data: { volunteerId: volunteers[0].id, title: 'First-aid post at Andheri shelter', taskType: 'FIRST_AID', location: 'Andheri Sports Complex Shelter', status: 'IN_PROGRESS', assignedById: admin.id } });
  await prisma.volunteerTask.create({ data: { volunteerId: volunteers[1].id, title: 'Distribute water bottles in Bandra', taskType: 'DISTRIBUTION', location: 'Bandra Relief Point', status: 'ACCEPTED', assignedById: admin.id } });
  await prisma.volunteerTask.create({ data: { volunteerId: volunteers[2].id, title: 'Community kitchen support Kurla', taskType: 'COOKING', location: 'Kurla Community Hall', status: 'ASSIGNED', assignedById: admin.id } });

  console.log('[seed] creating shelters…');
  const shelter1 = await prisma.shelter.create({ data: { managerId: shelterManager.id, name: 'Andheri Sports Complex Shelter', location: 'Andheri West, Mumbai', latitude: 19.1362, longitude: 72.8272, totalCapacity: 500, currentOccupancy: 320, facilities: 'FOOD,WATER,MEDICAL,SANITATION', operatingStatus: 'OPEN' } });
  const shelter2 = await prisma.shelter.create({ data: { managerId: shelterManager.id, name: 'Kurla Community Hall Shelter', location: 'Kurla West, Mumbai', latitude: 19.0726, longitude: 72.8839, totalCapacity: 300, currentOccupancy: 295, facilities: 'FOOD,WATER,SANITATION', operatingStatus: 'OPEN' } });
  const shelter3 = await prisma.shelter.create({ data: { managerId: shelterManager.id, name: 'Dadar School Shelter', location: 'Dadar East, Mumbai', latitude: 19.0178, longitude: 72.8550, totalCapacity: 200, currentOccupancy: 200, facilities: 'FOOD,WATER', operatingStatus: 'FULL' } });

  console.log('[seed] creating relief items + inventory…');
  const rice = await prisma.reliefItem.create({ data: { itemName: 'Rice bags', category: 'FOOD', unit: 'kg' } });
  const water = await prisma.reliefItem.create({ data: { itemName: 'Drinking water bottles', category: 'WATER', unit: 'litres' } });
  const medkit = await prisma.reliefItem.create({ data: { itemName: 'First-aid kits', category: 'MEDICINE', unit: 'kits' } });
  const blankets = await prisma.reliefItem.create({ data: { itemName: 'Blankets', category: 'CLOTHING', unit: 'pieces' } });

  const inv1 = await prisma.inventory.create({ data: { itemId: rice.id, location: 'Andheri Warehouse', organization: 'Mumbai Relief Foundation', quantityAvailable: 2000, managedById: ngos[0].id } });
  const inv2 = await prisma.inventory.create({ data: { itemId: water.id, location: 'Andheri Warehouse', organization: 'Mumbai Relief Foundation', quantityAvailable: 5000, managedById: ngos[0].id } });
  const inv3 = await prisma.inventory.create({ data: { itemId: medkit.id, location: 'KEM Hospital Depot', organization: 'Seva Sahayog Trust', quantityAvailable: 150, managedById: ngos[1].id } });
  const inv4 = await prisma.inventory.create({ data: { itemId: blankets.id, location: 'Dadar Depot', organization: 'Seva Sahayog Trust', quantityAvailable: 800, managedById: ngos[1].id } });

  console.log('[seed] creating resource requests + allocations…');
  const rr1 = await prisma.resourceRequest.create({ data: { requesterId: shelterManager.id, shelterId: shelter2.id, itemId: rice.id, quantityRequired: 500, quantityFulfilled: 300, priority: 'HIGH', status: 'PARTIALLY_FULFILLED' } });
  const rr2 = await prisma.resourceRequest.create({ data: { requesterId: shelterManager.id, shelterId: shelter1.id, itemId: water.id, quantityRequired: 1000, quantityFulfilled: 0, priority: 'CRITICAL', status: 'PENDING' } });
  await prisma.resourceAllocation.create({ data: { resourceRequestId: rr1.id, inventoryId: inv1.id, quantity: 300, allocatedById: admin.id, status: 'IN_TRANSIT' } });

  console.log('[seed] creating notifications + audit logs…');
  await prisma.notification.createMany({
    data: [
      { recipientId: citizens[0].id, message: 'Your request is now ASSIGNED to Alpha Flood Rescue.', type: 'REQUEST_UPDATE' },
      { recipientId: teamUsers[0].id, message: 'New incident assigned: Andheri West rescue (3 people).', type: 'ASSIGNMENT' },
      { recipientId: admin.id, message: 'Kurla Community Hall Shelter is 98% full.', type: 'SHELTER_ALERT' },
      { recipientId: citizens[2].id, message: 'Mumbai Floods 2026: avoid Thane creek area. Shelters open in Andheri/Kurla.', type: 'PUBLIC_ALERT' },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { actorId: admin.id, action: 'REQUEST_VERIFY', target: 'EmergencyRequest', targetId: req3.id, metadata: JSON.stringify({ from: 'SUBMITTED', to: 'VERIFIED' }) },
      { actorId: admin.id, action: 'TEAM_ASSIGN', target: 'RescueAssignment', targetId: asg1.id, metadata: JSON.stringify({ team: 'Alpha Flood Rescue' }) },
      { actorId: admin.id, action: 'RESOURCE_ALLOCATE', target: 'ResourceAllocation', targetId: rr1.id, metadata: JSON.stringify({ qty: 300 }) },
    ],
  });

  console.log('\n[seed] DONE ✔');
  console.log('Demo credentials (password for ALL): ' + DEMO_PASSWORD);
  console.log('  admin            admin@drrcp.local');
  console.log('  citizen x3       citizen1@drrcp.local, citizen2@drrcp.local, citizen3@drrcp.local');
  console.log('  volunteer x4     volunteer1@drrcp.local … volunteer4@drrcp.local');
  console.log('  rescue teams x3  team.alpha@drrcp.local, team.bravo@drrcp.local, team.charlie@drrcp.local');
  console.log('  shelter manager  shelter.manager@drrcp.local');
  console.log('  ngo x2           ngo1@drrcp.local, ngo2@drrcp.local');
  console.log(`  disaster: ${disaster.name} (${disaster.status})`);
}

main()
  .catch((e) => { console.error('[seed] FAILED', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
