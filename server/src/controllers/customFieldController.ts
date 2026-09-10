import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getCustomFields = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const fields = await prisma.customFieldDefinition.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });

    const workItemTypes = await prisma.customWorkItemType.findMany({
      where: { organizationId: orgId },
    });

    return res.json({ fields, customWorkItemTypes: workItemTypes });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createCustomField = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { name, fieldKey, fieldType, options, isRequired } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (!name || !fieldKey || !fieldType) {
      return res.status(400).json({ message: 'Field name, key, and type are required' });
    }

    const field = await prisma.customFieldDefinition.create({
      data: {
        organizationId: orgId,
        name,
        fieldKey,
        fieldType,
        options: options ? JSON.stringify(options) : null,
        isRequired: isRequired || false,
      },
    });

    return res.status(201).json(field);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createCustomWorkItemType = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { name, icon, description, color } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (!name) return res.status(400).json({ message: 'Custom type name is required' });

    const customType = await prisma.customWorkItemType.create({
      data: {
        organizationId: orgId,
        name,
        icon: icon || 'CheckSquare',
        description: description || null,
        color: color || '#8b5cf6',
      },
    });

    return res.status(201).json(customType);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const saveCustomFieldValues = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { workItemId, fieldValues } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (!workItemId || !fieldValues) {
      return res.status(400).json({ message: 'workItemId and fieldValues object required' });
    }

    const savedValues: any[] = [];
    for (const [fieldId, val] of Object.entries(fieldValues)) {
      const fieldVal = await prisma.customFieldValue.upsert({
        where: { id: `${workItemId}_${fieldId}` },
        update: { value: String(val) },
        create: {
          id: `${workItemId}_${fieldId}`,
          fieldId,
          workItemId,
          value: String(val),
        },
      });
      savedValues.push(fieldVal);
    }

    return res.json({ success: true, savedValues });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};
