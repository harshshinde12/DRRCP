-- CreateIndex
CREATE INDEX "Disaster_status_idx" ON "Disaster"("status");

-- CreateIndex
CREATE INDEX "EmergencyRequest_emergencyType_idx" ON "EmergencyRequest"("emergencyType");

-- CreateIndex
CREATE INDEX "RescueTeam_availabilityStatus_idx" ON "RescueTeam"("availabilityStatus");

-- CreateIndex
CREATE INDEX "ResourceRequest_shelterId_idx" ON "ResourceRequest"("shelterId");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "VolunteerTask_taskType_idx" ON "VolunteerTask"("taskType");
