import { Response } from 'express';
import { prisma } from '../prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { executeWorkflowTransition } from '../services/workflowEngine.js';

export const getWorkflows = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const workflows = await prisma.workflow.findMany({
      where: { organizationId: orgId },
      include: {
        statuses: { orderBy: { order: 'asc' } },
        transitions: true,
        projects: { select: { id: true, name: true, key: true } },
      },
    });

    return res.json(workflows);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createWorkflow = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { name, description, isDefault, statuses, transitions } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });
    if (!name || !Array.isArray(statuses)) {
      return res.status(400).json({ message: 'Workflow name and statuses array are required' });
    }

    const workflow = await prisma.workflow.create({
      data: {
        organizationId: orgId,
        name,
        description: description || null,
        isDefault: isDefault || false,
        statuses: {
          create: statuses.map((s: any, idx: number) => ({
            name: s.name,
            category: s.category || 'IN_PROGRESS',
            color: s.color || '#6366f1',
            order: s.order ?? idx,
            wipLimit: s.wipLimit || null,
          })),
        },
        transitions: {
          create: (transitions || []).map((t: any) => ({
            fromStatus: t.fromStatus,
            toStatus: t.toStatus,
            allowedRoles: t.allowedRoles ? JSON.stringify(t.allowedRoles) : null,
            requiredFields: t.requiredFields ? JSON.stringify(t.requiredFields) : null,
          })),
        },
      },
      include: { statuses: true, transitions: true },
    });

    return res.status(201).json(workflow);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const assignProjectWorkflow = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const { projectId, workflowId } = req.body;

    if (!orgId) return res.status(401).json({ message: 'Unauthorized' });

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: orgId },
    });

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { workflowId: workflowId || null },
    });

    return res.json({ success: true, project: updated });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const transitionWorkItem = async (req: AuthRequest, res: Response) => {
  try {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;
    const userRole = req.user?.role || 'MEMBER';
    const { id } = req.params;
    const { targetStatus, payload } = req.body;

    if (!orgId || !userId) return res.status(401).json({ message: 'Unauthorized' });

    const item = await executeWorkflowTransition({
      organizationId: orgId,
      userId,
      userRole,
      workItemId: id,
      targetStatus,
      payload,
    });

    return res.json({ success: true, workItem: item });
  } catch (error: any) {
    return res.status(400).json({ message: error.message });
  }
};
