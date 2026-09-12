const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  ownerId:     { type: String, required: true },
  inviteCode:  { type: String, unique: true },
  createdAt:   { type: Date, default: Date.now },
});

const workspaceMemberSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true },
  userId:      { type: String, required: true },
  role:        { type: String, enum: ['owner', 'member'], default: 'member' },
  status:      { type: String, enum: ['pending', 'active'], default: 'active' },
  joinedAt:    { type: Date, default: Date.now },
});
workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

const Workspace = mongoose.model('Workspace', workspaceSchema);
const WorkspaceMember = mongoose.model('WorkspaceMember', workspaceMemberSchema);

module.exports = { Workspace, WorkspaceMember };
