const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { createWorkspace, getMyWorkspaces, getInviteCode, joinWorkspace, getMembers, leaveWorkspace, deleteWorkspace } = require('../controllers/workspaceController');

const router = express.Router();

router.post('/',              authMiddleware, createWorkspace);
router.get('/',               authMiddleware, getMyWorkspaces);
router.get('/:id/invite',     authMiddleware, getInviteCode);
router.post('/join',          authMiddleware, joinWorkspace);
router.get('/:id/members',    authMiddleware, getMembers);
router.delete('/:id/leave',   authMiddleware, leaveWorkspace);
router.delete('/:id',         authMiddleware, deleteWorkspace);

module.exports = router;
