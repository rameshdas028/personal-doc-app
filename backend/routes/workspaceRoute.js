const express = require('express');
const crypto = require('crypto');
const { Workspace, WorkspaceMember } = require('../models/workspaceModel');
const User = require('../models/userModel');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

function makeInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function formatWorkspace(ws, role) {
  return { id: ws._id.toString(), name: ws.name, ownerId: ws.ownerId, role, createdAt: ws.createdAt };
}

// POST /api/workspaces
router.post('/', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Workspace name required' });

  const inviteCode = makeInviteCode();
  const ws = await Workspace.create({ name: name.trim(), ownerId: req.userId, inviteCode });
  await WorkspaceMember.create({ workspaceId: ws._id.toString(), userId: req.userId, role: 'owner', status: 'active' });

  res.json({ success: true, workspace: formatWorkspace(ws, 'owner') });
});

// GET /api/workspaces
router.get('/', authMiddleware, async (req, res) => {
  const memberships = await WorkspaceMember.find({ userId: req.userId, status: 'active' });
  const ids = memberships.map(m => m.workspaceId);
  const workspaces = await Workspace.find({ _id: { $in: ids } });

  const result = workspaces.map(ws => {
    const mem = memberships.find(m => m.workspaceId === ws._id.toString());
    return formatWorkspace(ws, mem?.role || 'member');
  });
  res.json({ workspaces: result });
});

// GET /api/workspaces/:id/invite  (owner only)
router.get('/:id/invite', authMiddleware, async (req, res) => {
  const ws = await Workspace.findById(req.params.id);
  if (!ws) return res.status(404).json({ error: 'Not found' });
  if (ws.ownerId !== req.userId) return res.status(403).json({ error: 'Only owner can view invite code' });
  res.json({ invite_code: ws.inviteCode });
});

// POST /api/workspaces/join
router.post('/join', authMiddleware, async (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ error: 'invite_code required' });

  const ws = await Workspace.findOne({ inviteCode: invite_code.trim().toUpperCase() });
  if (!ws) return res.status(404).json({ error: 'Invalid invite code' });

  const wsId = ws._id.toString();
  const existing = await WorkspaceMember.findOne({ workspaceId: wsId, userId: req.userId });
  if (existing) {
    if (existing.status === 'active') return res.json({ success: true, workspace: formatWorkspace(ws, existing.role), already_member: true });
    await WorkspaceMember.updateOne({ _id: existing._id }, { status: 'active' });
    return res.json({ success: true, workspace: formatWorkspace(ws, existing.role) });
  }

  await WorkspaceMember.create({ workspaceId: wsId, userId: req.userId, role: 'member', status: 'active' });
  res.json({ success: true, workspace: formatWorkspace(ws, 'member') });
});

// GET /api/workspaces/:id/members
router.get('/:id/members', authMiddleware, async (req, res) => {
  const wsId = req.params.id;
  const me = await WorkspaceMember.findOne({ workspaceId: wsId, userId: req.userId, status: 'active' });
  if (!me) return res.status(403).json({ error: 'Not a member' });

  const members = await WorkspaceMember.find({ workspaceId: wsId, status: 'active' });
  const users = await User.find({ _id: { $in: members.map(m => m.userId) } });

  const result = members.map(m => {
    const u = users.find(u => u._id.toString() === m.userId);
    return { userId: m.userId, role: m.role, name: u ? `${u.firstName} ${u.lastName}` : 'Unknown', phone: u?.phone || '' };
  });
  res.json({ members: result });
});

// DELETE /api/workspaces/:id/leave
router.delete('/:id/leave', authMiddleware, async (req, res) => {
  const ws = await Workspace.findById(req.params.id);
  if (!ws) return res.status(404).json({ error: 'Not found' });
  if (ws.ownerId === req.userId) return res.status(400).json({ error: 'Owner cannot leave. Delete the workspace instead.' });
  await WorkspaceMember.deleteOne({ workspaceId: req.params.id, userId: req.userId });
  res.json({ success: true });
});

// DELETE /api/workspaces/:id  (owner only)
router.delete('/:id', authMiddleware, async (req, res) => {
  const ws = await Workspace.findById(req.params.id);
  if (!ws) return res.status(404).json({ error: 'Not found' });
  if (ws.ownerId !== req.userId) return res.status(403).json({ error: 'Only owner can delete' });
  await WorkspaceMember.deleteMany({ workspaceId: req.params.id });
  await Workspace.deleteOne({ _id: req.params.id });
  res.json({ success: true });
});

module.exports = router;
