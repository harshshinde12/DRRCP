-- CreateIndex
CREATE INDEX "AuditLog_target_targetId_idx" ON "AuditLog"("target", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "EmergencyRequest_createdAt_idx" ON "EmergencyRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "RescueAssignment_status_idx" ON "RescueAssignment"("status");

-- CreateIndex
CREATE INDEX "ResourceAllocation_resourceRequestId_idx" ON "ResourceAllocation"("resourceRequestId");

-- CreateIndex
CREATE INDEX "ResourceAllocation_status_idx" ON "ResourceAllocation"("status");

-- CreateIndex
CREATE INDEX "ResourceRequest_requesterId_idx" ON "ResourceRequest"("requesterId");

-- CreateIndex
CREATE INDEX "ResourceRequest_itemId_idx" ON "ResourceRequest"("itemId");

-- CreateIndex
CREATE INDEX "Shelter_managerId_idx" ON "Shelter"("managerId");
