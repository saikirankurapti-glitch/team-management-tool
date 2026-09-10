import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../src/prisma.js';

describe('Google Drive Document Storage Integration Unit Tests', () => {
  beforeEach(async () => {
    await prisma.fileAttachment.deleteMany();
  });

  it('stores Google Drive file attachment metadata in FileAttachment table', async () => {
    const defaultOrg = await prisma.organization.findFirst() || await prisma.organization.create({
      data: { name: 'Test Org Drive', slug: 'test-org-drive' }
    });

    const defaultUser = await prisma.user.findFirst() || await prisma.user.create({
      data: {
        organizationId: defaultOrg.id,
        email: 'driveuser@example.com',
        passwordHash: 'hash',
        fullName: 'Drive User'
      }
    });

    const attachment = await prisma.fileAttachment.create({
      data: {
        organizationId: defaultOrg.id,
        filename: 'Project_Architecture_V2.pdf',
        filePath: 'https://drive.google.com/file/d/1234567890/view',
        fileType: 'application/pdf',
        fileSize: 1048576,
        uploadedById: defaultUser.id,
        driveFileId: '1234567890',
        storageProvider: 'GOOGLE_DRIVE',
      }
    });

    expect(attachment.id).toBeDefined();
    expect(attachment.storageProvider).toBe('GOOGLE_DRIVE');
    expect(attachment.driveFileId).toBe('1234567890');
    expect(attachment.filename).toBe('Project_Architecture_V2.pdf');
  });
});
