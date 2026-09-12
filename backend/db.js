const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/docvault';

mongoose.connect(MONGO_URI)
  .then(() => console.log('[MongoDB] Connected:', MONGO_URI))
  .catch(err => console.error('[MongoDB] Connection failed:', err.message));

const UserSchema = new mongoose.Schema({
  firstName:   { type: String, required: true, trim: true },
  lastName:    { type: String, required: true, trim: true },
  phone:       { type: String, unique: true, required: true },
  password:    { type: String, required: true },
  resetOtp:    { type: String },
  resetOtpExp: { type: Date },
  created_at:  { type: Date, default: Date.now },
});

// Workspace — a shared group (e.g. "Family", "Office")
const WorkspaceSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  owner_id:   { type: String, required: true },   // userId of creator
  invite_code:{ type: String, unique: true },      // short code to join
  created_at: { type: Date, default: Date.now },
});

// WorkspaceMember — who is in which workspace
const WorkspaceMemberSchema = new mongoose.Schema({
  workspace_id: { type: String, required: true },
  user_id:      { type: String, required: true },
  role:         { type: String, enum: ['owner', 'member'], default: 'member' },
  status:       { type: String, enum: ['pending', 'active'], default: 'active' },
  joined_at:    { type: Date, default: Date.now },
});
WorkspaceMemberSchema.index({ workspace_id: 1, user_id: 1 }, { unique: true });

const User = mongoose.model('User', UserSchema);
const Workspace = mongoose.model('Workspace', WorkspaceSchema);
const WorkspaceMember = mongoose.model('WorkspaceMember', WorkspaceMemberSchema);

module.exports = { User, Workspace, WorkspaceMember };
