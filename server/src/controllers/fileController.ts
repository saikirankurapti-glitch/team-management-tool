import { Response } from 'express';
import multer from 'multer';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { uploadFileToDrive } from '../services/googleDriveService.js';

const storage = multer.memoryStorage();
export const uploadMiddleware = multer({ storage });

export const uploadFile = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const file = req.file;

    if (!orgId || !userId || !file) {
      return res.status(400).json({ message: 'File is required' });
    }

    const { projectId, workItemId, messageId } = req.body;

    const driveResult = await uploadFileToDrive({
      filename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      organizationId: orgId,
      userId,
      projectId: projectId || undefined,
      workItemId: workItemId || undefined,
      messageId: messageId || undefined,
    });

    return res.status(201).json(driveResult.fileAttachment);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getFiles = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { projectId, workItemId } = req.query;

    const where: any = { organizationId: orgId };
    if (projectId) where.projectId = String(projectId);
    if (workItemId) where.workItemId = String(workItemId);

    const files = await prisma.fileAttachment.findMany({
      where,
      include: {
        uploadedBy: { select: { id: true, fullName: true, avatarUrl: true } },
        project: { select: { name: true, key: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(files);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
