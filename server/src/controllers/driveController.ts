import { Request, Response } from 'express';
import multer from 'multer';
import {
  uploadFileToDrive,
  listDriveFiles,
  downloadDriveFileStream,
  deleteDriveFile,
} from '../services/googleDriveService.js';

const upload = multer({ storage: multer.memoryStorage() });

export const uploadDriveMiddleware = upload.single('file');

export const uploadDriveFileHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided in request' });
    }

    const { projectId, workItemId, messageId } = req.body;

    const result = await uploadFileToDrive({
      filename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      organizationId: orgId,
      userId: user.id,
      projectId: projectId || undefined,
      workItemId: workItemId || undefined,
      messageId: messageId || undefined,
    });

    return res.status(201).json({
      message: 'File successfully uploaded to Google Drive',
      fileAttachment: result.fileAttachment,
      driveFile: result.driveFile,
    });
  } catch (error: any) {
    console.error('[DriveController] Upload error:', error);
    return res.status(400).json({ error: error.message || 'Failed to upload file to Google Drive' });
  }
};

export const listDriveFilesHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const { pageSize, pageToken } = req.query;

    const result = await listDriveFiles(
      user.id,
      orgId,
      pageSize ? parseInt(pageSize as string, 10) : 50,
      pageToken as string | undefined
    );

    return res.json(result);
  } catch (error: any) {
    console.error('[DriveController] List files error:', error);
    return res.status(400).json({ error: error.message || 'Failed to list Google Drive files' });
  }
};

export const downloadDriveFileHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const driveFileId = req.params.id;

    const { metadata, streamResponse } = await downloadDriveFileStream(user.id, orgId, driveFileId);

    res.setHeader('Content-Type', metadata.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(metadata.name || 'file')}"`);
    if (metadata.size) {
      res.setHeader('Content-Length', metadata.size);
    }

    const arrayBuffer = await streamResponse.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (error: any) {
    console.error('[DriveController] Download file error:', error);
    return res.status(400).json({ error: error.message || 'Failed to download file from Google Drive' });
  }
};

export const deleteDriveFileHandler = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const orgId = user?.organizationId;
    const fileAttachmentId = req.params.id;

    await deleteDriveFile(user.id, orgId, fileAttachmentId);

    return res.json({ success: true, message: 'File deleted from Google Drive' });
  } catch (error: any) {
    console.error('[DriveController] Delete file error:', error);
    return res.status(400).json({ error: error.message || 'Failed to delete Google Drive file' });
  }
};
