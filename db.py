"""
DRRCP Database Layer for Streamlit
Connects to backend/prisma/dev.db if present, or initializes an in-memory/local SQLite database with seed data.
"""
import os
import sqlite3
import datetime
import uuid
import pandas as pd

DB_PATH = os.path.join(os.path.dirname(__file__), "backend", "prisma", "dev.db")
FALLBACK_DB_PATH = os.path.join(os.path.dirname(__file__), "drrcp.db")

def get_connection():
    if os.path.exists(DB_PATH):
        conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    else:
        conn = sqlite3.connect(FALLBACK_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cur = conn.cursor()
    
    # Check if tables exist
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='EmergencyRequest'")
    if cur.fetchone():
        conn.close()
        return

    # Create tables matching Prisma schema
    cur.executescript("""
    CREATE TABLE IF NOT EXISTS User (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'CITIZEN',
        address TEXT,
        skills TEXT,
        availability TEXT,
        serviceArea TEXT,
        organizationName TEXT,
        registrationNumber TEXT,
        authority TEXT,
        contactNumber TEXT,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Disaster (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        affectedArea TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        startDate DATETIME NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS EmergencyRequest (
        id TEXT PRIMARY KEY,
        requesterId TEXT NOT NULL,
        disasterId TEXT,
        emergencyType TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        peopleAffected INTEGER NOT NULL,
        injuryPresent INTEGER NOT NULL DEFAULT 0,
        injurySeverity TEXT,
        priority TEXT NOT NULL DEFAULT 'MEDIUM',
        status TEXT NOT NULL DEFAULT 'SUBMITTED',
        duplicateOfId TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS RescueTeam (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        teamType TEXT NOT NULL,
        memberCount INTEGER NOT NULL,
        capability TEXT NOT NULL,
        currentLocation TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        availabilityStatus TEXT NOT NULL DEFAULT 'AVAILABLE',
        userId TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS RescueAssignment (
        id TEXT PRIMARY KEY,
        requestId TEXT NOT NULL,
        teamId TEXT NOT NULL,
        assignedById TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ASSIGNED',
        assignedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completedAt DATETIME,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS RescueReport (
        id TEXT PRIMARY KEY,
        assignmentId TEXT UNIQUE NOT NULL,
        peopleRescued INTEGER NOT NULL DEFAULT 0,
        injuredPeople INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        completedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS VolunteerTask (
        id TEXT PRIMARY KEY,
        volunteerId TEXT NOT NULL,
        title TEXT NOT NULL,
        taskType TEXT NOT NULL,
        location TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ASSIGNED',
        assignedById TEXT,
        assignedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Shelter (
        id TEXT PRIMARY KEY,
        managerId TEXT NOT NULL,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        totalCapacity INTEGER NOT NULL,
        currentOccupancy INTEGER NOT NULL DEFAULT 0,
        facilities TEXT NOT NULL,
        operatingStatus TEXT NOT NULL DEFAULT 'OPEN',
        emergencyOverride INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ReliefItem (
        id TEXT PRIMARY KEY,
        itemName TEXT NOT NULL,
        category TEXT NOT NULL,
        unit TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Inventory (
        id TEXT PRIMARY KEY,
        itemId TEXT NOT NULL,
        location TEXT NOT NULL,
        organization TEXT,
        quantityAvailable INTEGER NOT NULL DEFAULT 0,
        managedById TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ResourceRequest (
        id TEXT PRIMARY KEY,
        requesterId TEXT NOT NULL,
        shelterId TEXT,
        itemId TEXT NOT NULL,
        quantityRequired INTEGER NOT NULL,
        quantityFulfilled INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'MEDIUM',
        status TEXT NOT NULL DEFAULT 'PENDING',
        requestedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ResourceAllocation (
        id TEXT PRIMARY KEY,
        resourceRequestId TEXT NOT NULL,
        inventoryId TEXT,
        quantity INTEGER NOT NULL,
        allocatedById TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'IN_TRANSIT',
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS AuditLog (
        id TEXT PRIMARY KEY,
        actorId TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT NOT NULL,
        targetId TEXT NOT NULL,
        metadata TEXT,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Notification (
        id TEXT PRIMARY KEY,
        recipientId TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'SYSTEM',
        isRead INTEGER NOT NULL DEFAULT 0,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Seed initial demo data matching seed.ts
    now = datetime.datetime.utcnow().isoformat()
    
    # Users
    admin_id = str(uuid.uuid4())
    cit1_id = str(uuid.uuid4())
    cit2_id = str(uuid.uuid4())
    vol1_id = str(uuid.uuid4())
    mgr_id = str(uuid.uuid4())
    ngo1_id = str(uuid.uuid4())
    team1_uid = str(uuid.uuid4())
    team2_uid = str(uuid.uuid4())
    team3_uid = str(uuid.uuid4())

    cur.execute("INSERT INTO User (id, name, email, role, phone, passwordHash) VALUES (?, ?, ?, ?, ?, ?)",
                (admin_id, 'Aarav Admin', 'admin@drrcp.local', 'ADMIN', '+91-9000000001', 'hash'))
    cur.execute("INSERT INTO User (id, name, email, role, phone, passwordHash, address) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (cit1_id, 'Priya Patil', 'citizen1@drrcp.local', 'CITIZEN', '+91-9000000011', 'hash', 'Andheri West, Mumbai'))
    cur.execute("INSERT INTO User (id, name, email, role, phone, passwordHash, address) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (cit2_id, 'Rahul Deshmukh', 'citizen2@drrcp.local', 'CITIZEN', '+91-9000000012', 'hash', 'Kurla, Mumbai'))
    cur.execute("INSERT INTO User (id, name, email, role, phone, passwordHash, skills, serviceArea) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (vol1_id, 'Amit Verma', 'volunteer1@drrcp.local', 'VOLUNTEER', '+91-9000000021', 'hash', 'FIRST_AID,COMMUNICATION', 'Andheri'))
    cur.execute("INSERT INTO User (id, name, email, role, phone, passwordHash) VALUES (?, ?, ?, ?, ?, ?)",
                (mgr_id, 'Meera Iyer', 'shelter.manager@drrcp.local', 'SHELTER_MANAGER', '+91-9000000031', 'hash'))
    cur.execute("INSERT INTO User (id, name, email, role, phone, passwordHash, organizationName) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (ngo1_id, 'Mumbai Relief Foundation', 'ngo1@drrcp.local', 'NGO', '+91-9000000041', 'hash', 'Mumbai Relief Foundation'))

    # Disaster
    disaster_id = str(uuid.uuid4())
    cur.execute("INSERT INTO Disaster (id, name, type, affectedArea, severity, status, startDate) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (disaster_id, 'Mumbai Floods 2026', 'FLOOD', 'Mumbai Metropolitan Region — Andheri, Kurla, Dadar', 'SEVERE', 'ACTIVE', now))

    # Rescue Teams
    t1_id = str(uuid.uuid4())
    t2_id = str(uuid.uuid4())
    t3_id = str(uuid.uuid4())
    cur.execute("INSERT INTO RescueTeam (id, name, teamType, memberCount, capability, currentLocation, latitude, longitude, availabilityStatus, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (t1_id, 'Alpha Flood Rescue', 'FLOOD_RESCUE', 12, 'BOAT_RESCUE,SWIMMING,FIRST_AID', 'Andheri Sports Complex', 19.1362, 72.8272, 'ASSIGNED', team1_uid))
    cur.execute("INSERT INTO RescueTeam (id, name, teamType, memberCount, capability, currentLocation, latitude, longitude, availabilityStatus, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (t2_id, 'Bravo Medical Unit', 'MEDICAL', 8, 'TRIAGE,OXYGEN,AMBULANCE', 'KEM Hospital, Parel', 19.0120, 72.8417, 'ON_THE_WAY', team2_uid))
    cur.execute("INSERT INTO RescueTeam (id, name, teamType, memberCount, capability, currentLocation, latitude, longitude, availabilityStatus, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (t3_id, 'Charlie Fire Squad', 'FIRE', 10, 'FIRE_SUPPRESSION,STRUCTURAL', 'Dadar Fire Station', 19.0178, 72.8478, 'AVAILABLE', team3_uid))

    # Emergency Requests
    r1_id = str(uuid.uuid4())
    r2_id = str(uuid.uuid4())
    r3_id = str(uuid.uuid4())
    r4_id = str(uuid.uuid4())
    r5_id = str(uuid.uuid4())
    r6_id = str(uuid.uuid4())

    cur.execute("""INSERT INTO EmergencyRequest 
        (id, requesterId, disasterId, emergencyType, description, location, latitude, longitude, peopleAffected, injuryPresent, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (r1_id, cit1_id, disaster_id, 'RESCUE', 'Water up to 4ft in ground floor, 2 elderly + 1 child stranded', 'Bldg 7, Andheri West, Mumbai', 19.1362, 72.8272, 3, 0, 'CRITICAL', 'ASSIGNED'))
    cur.execute("""INSERT INTO EmergencyRequest 
        (id, requesterId, disasterId, emergencyType, description, location, latitude, longitude, peopleAffected, injuryPresent, injurySeverity, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (r2_id, cit2_id, disaster_id, 'MEDICAL', 'Neighbour unconscious, need oxygen + ambulance', 'Kurla West, Near Station', 19.0726, 72.8839, 1, 1, 'SEVERE', 'CRITICAL', 'RESCUE_IN_PROGRESS'))
    cur.execute("""INSERT INTO EmergencyRequest 
        (id, requesterId, disasterId, emergencyType, description, location, latitude, longitude, peopleAffected, injuryPresent, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (r3_id, cit1_id, disaster_id, 'FOOD', 'Society of 40 people needs cooked food + drinking water', 'Dadar East, Mumbai', 19.0178, 72.8550, 40, 0, 'HIGH', 'VERIFIED'))
    cur.execute("""INSERT INTO EmergencyRequest 
        (id, requesterId, disasterId, emergencyType, description, location, latitude, longitude, peopleAffected, injuryPresent, priority, status, duplicateOfId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (r4_id, cit1_id, disaster_id, 'WATER', 'Duplicate report of Andheri flooding from same lane', 'Andheri West, Mumbai', 19.1350, 72.8290, 5, 0, 'MEDIUM', 'DUPLICATE', r1_id))
    cur.execute("""INSERT INTO EmergencyRequest 
        (id, requesterId, disasterId, emergencyType, description, location, latitude, longitude, peopleAffected, injuryPresent, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (r5_id, cit2_id, disaster_id, 'SHELTER', 'Family of 4 needs shelter for tonight', 'Kurla East, Mumbai', 19.0650, 72.8790, 4, 0, 'MEDIUM', 'SUBMITTED'))
    cur.execute("""INSERT INTO EmergencyRequest 
        (id, requesterId, disasterId, emergencyType, description, location, latitude, longitude, peopleAffected, injuryPresent, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (r6_id, cit1_id, disaster_id, 'RESCUE', 'Dog + owner stuck on terrace, safely evacuated', 'Dadar West', 19.0200, 72.8430, 1, 0, 'LOW', 'RESOLVED'))

    # Assignments
    asg1_id = str(uuid.uuid4())
    asg2_id = str(uuid.uuid4())
    asg3_id = str(uuid.uuid4())
    cur.execute("INSERT INTO RescueAssignment (id, requestId, teamId, assignedById, status) VALUES (?, ?, ?, ?, ?)",
                (asg1_id, r1_id, t1_id, admin_id, 'ASSIGNED'))
    cur.execute("INSERT INTO RescueAssignment (id, requestId, teamId, assignedById, status) VALUES (?, ?, ?, ?, ?)",
                (asg2_id, r2_id, t2_id, admin_id, 'RESCUE_IN_PROGRESS'))
    cur.execute("INSERT INTO RescueAssignment (id, requestId, teamId, assignedById, status, completedAt) VALUES (?, ?, ?, ?, ?, ?)",
                (asg3_id, r6_id, t3_id, admin_id, 'COMPLETED', now))
    cur.execute("INSERT INTO RescueReport (id, assignmentId, peopleRescued, injuredPeople, notes) VALUES (?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), asg3_id, 1, 0, 'Owner + pet evacuated safely via ladder. No injuries.'))

    # Shelters
    sh1_id = str(uuid.uuid4())
    sh2_id = str(uuid.uuid4())
    sh3_id = str(uuid.uuid4())
    cur.execute("INSERT INTO Shelter (id, managerId, name, location, latitude, longitude, totalCapacity, currentOccupancy, facilities, operatingStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (sh1_id, mgr_id, 'Andheri Sports Complex Shelter', 'Andheri West, Mumbai', 19.1362, 72.8272, 500, 320, 'FOOD,WATER,MEDICAL,SANITATION', 'OPEN'))
    cur.execute("INSERT INTO Shelter (id, managerId, name, location, latitude, longitude, totalCapacity, currentOccupancy, facilities, operatingStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (sh2_id, mgr_id, 'Kurla Community Hall Shelter', 'Kurla West, Mumbai', 19.0726, 72.8839, 300, 295, 'FOOD,WATER,SANITATION', 'OPEN'))
    cur.execute("INSERT INTO Shelter (id, managerId, name, location, latitude, longitude, totalCapacity, currentOccupancy, facilities, operatingStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (sh3_id, mgr_id, 'Dadar School Shelter', 'Dadar East, Mumbai', 19.0178, 72.8550, 200, 200, 'FOOD,WATER', 'FULL'))

    # Relief Items & Inventory
    it1_id = str(uuid.uuid4())
    it2_id = str(uuid.uuid4())
    it3_id = str(uuid.uuid4())
    it4_id = str(uuid.uuid4())
    cur.execute("INSERT INTO ReliefItem (id, itemName, category, unit) VALUES (?, ?, ?, ?)", (it1_id, 'Rice Bags', 'FOOD', 'kg'))
    cur.execute("INSERT INTO ReliefItem (id, itemName, category, unit) VALUES (?, ?, ?, ?)", (it2_id, 'Drinking Water', 'WATER', 'litres'))
    cur.execute("INSERT INTO ReliefItem (id, itemName, category, unit) VALUES (?, ?, ?, ?)", (it3_id, 'First-Aid Kits', 'MEDICINE', 'kits'))
    cur.execute("INSERT INTO ReliefItem (id, itemName, category, unit) VALUES (?, ?, ?, ?)", (it4_id, 'Warm Blankets', 'CLOTHING', 'pieces'))

    cur.execute("INSERT INTO Inventory (id, itemId, location, organization, quantityAvailable, managedById) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), it1_id, 'Andheri Central Warehouse', 'Mumbai Relief Foundation', 2000, ngo1_id))
    cur.execute("INSERT INTO Inventory (id, itemId, location, organization, quantityAvailable, managedById) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), it2_id, 'Andheri Central Warehouse', 'Mumbai Relief Foundation', 5000, ngo1_id))
    cur.execute("INSERT INTO Inventory (id, itemId, location, organization, quantityAvailable, managedById) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), it3_id, 'KEM Hospital Depot', 'Seva Sahayog Trust', 150, ngo1_id))
    cur.execute("INSERT INTO Inventory (id, itemId, location, organization, quantityAvailable, managedById) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), it4_id, 'Dadar Depot', 'Seva Sahayog Trust', 800, ngo1_id))

    # Audit Logs
    cur.execute("INSERT INTO AuditLog (id, actorId, action, target, targetId, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), admin_id, 'REQUEST_VERIFY', 'EmergencyRequest', r3_id, '{"decision":"VERIFIED","priority":"HIGH"}'))
    cur.execute("INSERT INTO AuditLog (id, actorId, action, target, targetId, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), admin_id, 'TEAM_ASSIGN', 'RescueAssignment', asg1_id, '{"team":"Alpha Flood Rescue"}'))

    conn.commit()
    conn.close()

# Auto-initialize on import
init_db()

def get_disaster_summary():
    conn = get_connection()
    disaster = conn.execute("SELECT * FROM Disaster WHERE status='ACTIVE' LIMIT 1").fetchone()
    reqs_total = conn.execute("SELECT COUNT(*) FROM EmergencyRequest").fetchone()[0]
    critical_reqs = conn.execute("SELECT COUNT(*) FROM EmergencyRequest WHERE priority='CRITICAL' AND status NOT IN ('RESOLVED','REJECTED','DUPLICATE')").fetchone()[0]
    people_rescued = conn.execute("SELECT COALESCE(SUM(peopleRescued), 0) FROM RescueReport").fetchone()[0]
    active_teams = conn.execute("SELECT COUNT(*) FROM RescueTeam WHERE availabilityStatus IN ('ASSIGNED','ON_THE_WAY','RESCUE_IN_PROGRESS')").fetchone()[0]
    open_shelters = conn.execute("SELECT COUNT(*) FROM Shelter WHERE operatingStatus='OPEN'").fetchone()[0]
    available_beds = conn.execute("SELECT COALESCE(SUM(totalCapacity - currentOccupancy), 0) FROM Shelter WHERE operatingStatus='OPEN'").fetchone()[0]
    conn.close()
    return {
        "disaster": dict(disaster) if disaster else None,
        "total_requests": reqs_total,
        "critical_requests": critical_reqs,
        "people_rescued": people_rescued,
        "active_teams": active_teams,
        "open_shelters": open_shelters,
        "available_beds": available_beds
    }

def get_requests(status_filter=None, priority_filter=None):
    conn = get_connection()
    query = "SELECT r.*, t.name as assignedTeamName, a.status as missionStatus FROM EmergencyRequest r " \
            "LEFT JOIN RescueAssignment a ON r.id = a.requestId AND a.status != 'CANCELLED' " \
            "LEFT JOIN RescueTeam t ON a.teamId = t.id WHERE 1=1"
    params = []
    if status_filter and status_filter != 'ALL':
        query += " AND r.status = ?"
        params.append(status_filter)
    if priority_filter and priority_filter != 'ALL':
        query += " AND r.priority = ?"
        params.append(priority_filter)
    query += " ORDER BY r.createdAt DESC"
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    return df

def submit_emergency_request(emergency_type, description, location, lat, lng, people_count, injured, severity, priority):
    conn = get_connection()
    cur = conn.cursor()
    req_id = str(uuid.uuid4())
    # find or fallback citizen
    cit = conn.execute("SELECT id FROM User WHERE role='CITIZEN' LIMIT 1").fetchone()
    cit_id = cit['id'] if cit else 'demo-citizen'
    disaster = conn.execute("SELECT id FROM Disaster WHERE status='ACTIVE' LIMIT 1").fetchone()
    disaster_id = disaster['id'] if disaster else None

    cur.execute("""
        INSERT INTO EmergencyRequest (id, requesterId, disasterId, emergencyType, description, location, latitude, longitude, peopleAffected, injuryPresent, injurySeverity, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')
    """, (req_id, cit_id, disaster_id, emergency_type, description, location, lat, lng, people_count, 1 if injured else 0, severity if injured else None, priority))
    conn.commit()
    conn.close()
    return req_id

def verify_and_prioritize(request_id, decision, priority, actor_name="Admin"):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE EmergencyRequest SET status = ?, priority = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
                (decision, priority, request_id))
    cur.execute("INSERT INTO AuditLog (id, actorId, action, target, targetId, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), actor_name, 'REQUEST_VERIFY', 'EmergencyRequest', request_id, f'{{"decision":"{decision}","priority":"{priority}"}}'))
    conn.commit()
    conn.close()

def assign_rescue_team(request_id, team_id, actor_name="Admin"):
    conn = get_connection()
    cur = conn.cursor()
    asg_id = str(uuid.uuid4())
    cur.execute("INSERT INTO RescueAssignment (id, requestId, teamId, assignedById, status) VALUES (?, ?, ?, ?, 'ASSIGNED')",
                (asg_id, request_id, team_id, actor_name))
    cur.execute("UPDATE EmergencyRequest SET status = 'ASSIGNED', updatedAt = CURRENT_TIMESTAMP WHERE id = ?", (request_id,))
    cur.execute("UPDATE RescueTeam SET availabilityStatus = 'ASSIGNED', updatedAt = CURRENT_TIMESTAMP WHERE id = ?", (team_id,))
    cur.execute("INSERT INTO AuditLog (id, actorId, action, target, targetId, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), actor_name, 'TEAM_ASSIGN', 'RescueAssignment', asg_id, f'{{"teamId":"{team_id}"}}'))
    conn.commit()
    conn.close()

def get_teams():
    conn = get_connection()
    df = pd.read_sql_query("SELECT * FROM RescueTeam ORDER BY name ASC", conn)
    conn.close()
    return df

def get_shelters():
    conn = get_connection()
    df = pd.read_sql_query("SELECT *, (totalCapacity - currentOccupancy) as availableBeds FROM Shelter ORDER BY operatingStatus ASC, availableBeds DESC", conn)
    conn.close()
    return df

def update_shelter_occupancy(shelter_id, delta):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("UPDATE Shelter SET currentOccupancy = MAX(0, MIN(totalCapacity, currentOccupancy + ?)), updatedAt = CURRENT_TIMESTAMP WHERE id = ?", (delta, shelter_id))
    conn.commit()
    conn.close()

def get_inventory():
    conn = get_connection()
    df = pd.read_sql_query("""
        SELECT i.id, r.itemName, r.category, r.unit, i.quantityAvailable, i.location, i.organization 
        FROM Inventory i JOIN ReliefItem r ON i.itemId = r.id
        ORDER BY r.category ASC, r.itemName ASC
    """, conn)
    conn.close()
    return df

def get_resource_requests():
    conn = get_connection()
    df = pd.read_sql_query("""
        SELECT rr.id, s.name as shelterName, ri.itemName, ri.unit, rr.quantityRequired, rr.quantityFulfilled, rr.priority, rr.status
        FROM ResourceRequest rr
        JOIN Shelter s ON rr.shelterId = s.id
        JOIN ReliefItem ri ON rr.itemId = ri.id
        ORDER BY rr.requestedAt DESC
    """, conn)
    conn.close()
    return df

def allocate_inventory(req_id, item_name, quantity, actor_name="Admin"):
    conn = get_connection()
    cur = conn.cursor()
    inv = conn.execute("""
        SELECT i.id, i.quantityAvailable FROM Inventory i 
        JOIN ReliefItem r ON i.itemId = r.id WHERE r.itemName = ? AND i.quantityAvailable >= ? LIMIT 1
    """, (item_name, quantity)).fetchone()
    
    if inv:
        cur.execute("UPDATE Inventory SET quantityAvailable = quantityAvailable - ? WHERE id = ?", (quantity, inv['id']))
        cur.execute("UPDATE ResourceRequest SET quantityFulfilled = quantityFulfilled + ?, status = 'FULFILLED' WHERE id = ?", (quantity, req_id))
        cur.execute("INSERT INTO ResourceAllocation (id, resourceRequestId, inventoryId, quantity, allocatedById, status) VALUES (?, ?, ?, ?, ?, 'IN_TRANSIT')",
                    (str(uuid.uuid4()), req_id, inv['id'], quantity, actor_name))
        cur.execute("INSERT INTO AuditLog (id, actorId, action, target, targetId, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                    (str(uuid.uuid4()), actor_name, 'RESOURCE_ALLOCATE', 'ResourceAllocation', req_id, f'{{"qty":{quantity},"item":"{item_name}"}}'))
        conn.commit()
        conn.close()
        return True
    conn.close()
    return False

def get_audit_logs():
    conn = get_connection()
    df = pd.read_sql_query("SELECT * FROM AuditLog ORDER BY createdAt DESC LIMIT 50", conn)
    conn.close()
    return df
