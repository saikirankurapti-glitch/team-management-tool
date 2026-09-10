import { prisma } from '../prisma.js';
import { getValidAccessTokenForUser } from './googleAuthService.js';

export const isGoogleDriveConfigured = (): boolean => {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
};

export interface DriveUploadInput {
  filename: string;
  mimeType: string;
  buffer: Buffer;
  organizationId: string;
  userId: string;
  projectId?: string;
  workItemId?: string;
  messageId?: string;
}

export const getOrCreateDriveFolder = async (
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<string> => {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  } else {
    query += ` and 'root' in parents`;
  }

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error('[GoogleDriveService] Create folder error:', createRes.status, errText);
    throw new Error(`Failed to create Drive folder '${folderName}': ${createRes.status}`);
  }

  const folderData = await createRes.json();
  return folderData.id;
};

export const uploadFileToDrive = async (input: DriveUploadInput) => {
  const { accessToken } = await getValidAccessTokenForUser(input.userId, input.organizationId);

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
  });
  const orgName = org?.name || 'Organization Files';

  const rootFolderId = await getOrCreateDriveFolder(accessToken, 'GenQuantaa Workstation');
  const orgFolderId = await getOrCreateDriveFolder(accessToken, orgName, rootFolderId);

  let targetFolderId = orgFolderId;
  if (input.projectId) {
    const project = await prisma.project.findUnique({ where: { id: input.projectId } });
    if (project) {
      const projectsFolderId = await getOrCreateDriveFolder(accessToken, 'Projects', orgFolderId);
      targetFolderId = await getOrCreateDriveFolder(accessToken, project.name, projectsFolderId);
    }
  }

  const fileMetadata = {
    name: input.filename,
    parents: [targetFolderId],
  };

  const boundary = `-------GenQuantaaBoundary${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody = Buffer.concat([
    Buffer.from(
      delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(fileMetadata) +
        delimiter +
        `Content-Type: ${input.mimeType || 'application/octet-stream'}\r\n\r\n`
    ),
    input.buffer,
    Buffer.from(closeDelimiter),
  ]);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error('[GoogleDriveService] Upload error:', response.status, errText);
    throw new Error(`Google Drive file upload failed: ${response.status} ${errText}`);
  }

  const driveFile = await response.json();

  const fileAttachment = await prisma.fileAttachment.create({
    data: {
      organizationId: input.organizationId,
      projectId: input.projectId || null,
      workItemId: input.workItemId || null,
      messageId: input.messageId || null,
      filename: input.filename,
      filePath: driveFile.webViewLink || driveFile.webContentLink || driveFile.id,
      fileType: input.mimeType || driveFile.mimeType || 'application/octet-stream',
      fileSize: input.buffer.length || parseInt(driveFile.size || '0', 10),
      uploadedById: input.userId,
      driveFileId: driveFile.id,
      storageProvider: 'GOOGLE_DRIVE',
    },
  });

  return { fileAttachment, driveFile };
};

export const listDriveFiles = async (
  userId: string,
  organizationId: string,
  pageSize = 50,
  pageToken?: string
) => {
  const { accessToken } = await getValidAccessTokenForUser(userId, organizationId);

  const params = new URLSearchParams({
    pageSize: pageSize.toString(),
    fields: 'nextPageToken, files(id, name, mimeType, size, webViewLink, webContentLink, createdTime, modifiedTime, iconLink, thumbnailLink)',
    q: "trashed=false and 'me' in owners",
    orderBy: 'modifiedTime desc',
  });
  if (pageToken) params.append('pageToken', pageToken);

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[GoogleDriveService] List files error:', response.status, errText);
    throw new Error(`Google Drive list files failed: ${response.status}`);
  }

  const driveData = await response.json();

  const dbFiles = await prisma.fileAttachment.findMany({
    where: {
      organizationId,
      storageProvider: 'GOOGLE_DRIVE',
    },
    orderBy: { createdAt: 'desc' },
  });

  return { driveFiles: driveData.files || [], nextPageToken: driveData.nextPageToken, dbFiles };
};

export const downloadDriveFileStream = async (userId: string, organizationId: string, driveFileId: string) => {
  const { accessToken } = await getValidAccessTokenForUser(userId, organizationId);

  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=id,name,mimeType,size`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaRes.ok) {
    throw new Error(`Failed to fetch Drive file metadata: ${metaRes.status}`);
  }

  const metadata = await metaRes.json();

  const mediaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!mediaRes.ok) {
    throw new Error(`Failed to download Drive file content: ${mediaRes.status}`);
  }

  return { metadata, streamResponse: mediaRes };
};

export const deleteDriveFile = async (userId: string, organizationId: string, fileAttachmentId: string) => {
  const attachment = await prisma.fileAttachment.findUnique({
    where: { id: fileAttachmentId },
  });

  if (!attachment) {
    throw new Error('File attachment not found');
  }

  if (attachment.driveFileId) {
    try {
      const { accessToken } = await getValidAccessTokenForUser(userId, organizationId);
      await fetch(`https://www.googleapis.com/drive/v3/files/${attachment.driveFileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      console.error('[GoogleDriveService] Error deleting Google Drive file:', err);
    }
  }

  await prisma.fileAttachment.delete({
    where: { id: fileAttachmentId },
  });

  return { success: true };
};
