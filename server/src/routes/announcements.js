const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { scope_type, scope_id } = req.query;
    let query = supabase.from('announcements').select('*').is('deleted_at', null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('created_at', { ascending: false });
    if (scope_type) query = query.eq('scope_type', scope_type);
    if (scope_id) query = query.eq('scope_id', scope_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN, ROLES.ORG_ADMIN), async (req, res, next) => {
  try {
    const { title, body, announcement_type, scope_type, scope_id, expires_at } = req.body;
    if (!title || !body || !scope_type) return res.status(400).json({ error: { code: 'INVALID_INPUT' } });
    const { data, error } = await supabase.from('announcements').insert({ id: uuidv4(), title, body, announcement_type: announcement_type || 'info', scope_type, scope_id, expires_at, created_by: req.user.id }).select().single();
    if (error) throw error;
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'announcement.created', entityType: 'announcement', entityId: data.id, req });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
