// Content items — Sprint 4 (stub for now)
const express = require('express');
const router = express.Router();
const { authenticate, authorize, ROLES } = require('../middleware/auth');
const supabase = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');
const { writeAuditLog } = require('../utils/auditLog');

router.use(authenticate);

router.get('/', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { library_status, content_type, page = 1, limit = 20 } = req.query;
    let query = supabase.from('content_items').select('id,title,description,content_type,library_status,estimated_minutes,tags_competency,created_at', { count: 'exact' }).is('deleted_at', null);
    if (library_status) query = query.eq('library_status', library_status);
    if (content_type) query = query.eq('content_type', content_type);
    const offset = (page - 1) * limit;
    const { data, error, count } = await query.range(offset, offset + limit - 1).order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data, meta: { total: count, page: +page, limit: +limit } });
  } catch (err) { next(err); }
});

router.post('/', authorize(ROLES.SUPER_ADMIN, ROLES.MINI_SUPER_ADMIN), async (req, res, next) => {
  try {
    const { title, description, content_type, file_url, external_url, rich_text_body, estimated_minutes, tags_competency, tags_industry, tags_level, tags_program_type } = req.body;
    if (!title || !content_type) return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'title and content_type required' } });
    const item = { id: uuidv4(), title, description, content_type, file_url, external_url, rich_text_body, estimated_minutes, tags_competency: tags_competency || [], tags_industry: tags_industry || [], tags_level: tags_level || [], tags_program_type: tags_program_type || [], library_status: 'draft', version: 1, created_by: req.user.id };
    const { data, error } = await supabase.from('content_items').insert(item).select().single();
    if (error) throw error;
    await writeAuditLog({ actorId: req.user.id, actorRole: req.user.role, actionType: 'content_item.created', entityType: 'content_item', entityId: data.id, req });
    res.status(201).json({ data });
  } catch (err) { next(err); }
});

module.exports = router;
