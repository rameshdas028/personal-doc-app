const express = require('express');
const crypto = require('crypto');
const { Workspace, WorkspaceMember, User } = require('../db');
const { authMiddleware } = require('./auth');

const router = express.Router();

function makeInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F9B2C1"
}

// Create workspace
router.post('/', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Workspace name required' });

  const invite_code = makeInviteCode();
  const ws = await Workspace.create({ name: name.trim(), owner_id: req.userId, invite_code });
  await WorkspaceMember.create({ workspace_id: ws._id.toString(), user_id: req.userId, role: 'owner', status: 'active' });

  res.json({ success: true, workspace: _fmt(ws, 'owner') });
});

// List my workspaces (active memberships)
router.get('/', authMiddleware, async (req, res) => {
  const memberships = await WorkspaceMember.find({ user_id: req.userId, status: 'active' });
  const ids = memberships.map(m => m.workspace_id);
  const workspaces = await Workspace.find({ _id: { $in: ids } });

  const result = workspaces.map(ws => {
    const mem = memberships.find(m => m.workspace_id === ws._id.toString());
    return _fmt(ws, mem?.role || 'member');
  });
  res.json({ workspaces: result });
});

// Get invite code (owner only)
router.get('/:id/invite', authMiddleware, async (req, res) => {
  const ws = await Workspace.findById(req.params.id);
  if (!ws) return res.status(404).json({ error: 'Not found' });
  if (ws.owner_id !== req.userId) return res.status(403).json({ error: 'Only owner can view invite code' });
  res.json({ invite_code: ws.invite_code });
});

// Join workspace by invite code
router.post('/join', authMiddleware, async (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ error: 'invite_code required' });

  const ws = await Workspace.findOne({ invite_code: invite_code.trim().toUpperCase() });
  if (!ws) return res.status(404).json({ error: 'Invalid invite code' });

  const wsId = ws._id.toString();
  const existing = await WorkspaceMember.findOne({ workspace_id: wsId, user_id: req.userId });
  if (existing) {
    if (existing.status === 'active') return res.json({ success: true, workspace: _fmt(ws, existing.role), already_member: true });
    await WorkspaceMember.updateOne({ _id: existing._id }, { status: 'active' });
    return res.json({ success: true, workspace: _fmt(ws, existing.role) });
  }

  await WorkspaceMember.create({ workspace_id: wsId, user_id: req.userId, role: 'member', status: 'active' });
  res.json({ success: true, workspace: _fmt(ws, 'member') });
});

// List members of a workspace
router.get('/:id/members', authMiddleware, async (req, res) => {
  const wsId = req.params.id;
  const me = await WorkspaceMember.findOne({ workspace_id: wsId, user_id: req.userId, status: 'active' });
  if (!me) return res.status(403).json({ error: 'Not a member' });

  const members = await WorkspaceMember.find({ workspace_id: wsId, status: 'active' });
  const users = await User.find({ _id: { $in: members.map(m => m.user_id) } });

  const result = members.map(m => {
    const u = users.find(u => u._id.toString() === m.user_id);
    return { user_id: m.user_id, role: m.role, name: u ? `${u.firstName} ${u.lastName}` : 'Unknown', phone: u?.phone || '' };
  });
  res.json({ members: result });
});

// Leave workspace (owner cannot leave — must delete)
router.delete('/:id/leave', authMiddleware, async (req, res) => {
  const wsId = req.params.id;
  const ws = await Workspace.findById(wsId);
  if (!ws) return res.status(404).json({ error: 'Not found' });
  if (ws.owner_id === req.userId) return res.status(400).json({ error: 'Owner cannot leave. Delete the workspace instead.' });

  await WorkspaceMember.deleteOne({ workspace_id: wsId, user_id: req.userId });
  res.json({ success: true });
});

// Delete workspace (owner only)
router.delete('/:id', authMiddleware, async (req, res) => {
  const ws = await Workspace.findById(req.params.id);
  if (!ws) return res.status(404).json({ error: 'Not found' });
  if (ws.owner_id !== req.userId) return res.status(403).json({ error: 'Only owner can delete' });

  await WorkspaceMember.deleteMany({ workspace_id: req.params.id });
  await Workspace.deleteOne({ _id: req.params.id });
  res.json({ success: true });
});

function _fmt(ws, role) {
  return { id: ws._id.toString(), name: ws.name, owner_id: ws.owner_id, role, created_at: ws.created_at };
}

module.exports = router;
