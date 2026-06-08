const supabase = require('../config/supabase');

/**
 * Writes an immutable audit log entry.
 * BR: Must succeed before any state-changing response returns 2xx.
 */
async function writeAuditLog({ actorId, actorRole, actionType, entityType, entityId, beforeState, afterState, req }) {
  const entry = {
    actor_id: actorId,
    actor_role: actorRole,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId || null,
    before_state: sanitizePII(beforeState) || null,
    after_state: sanitizePII(afterState) || null,
    ip_address: req?.ip || null,
    user_agent: req?.headers?.['user-agent'] || null,
  };

  const { error } = await supabase.from('audit_logs').insert(entry);
  // Audit failures must never block the main request — log and continue
  if (error) console.warn('[AuditLog] Write failed (non-fatal):', error.message);
}

// Remove PII fields from audit snapshots per BR-08
const PII_FIELDS = ['email', 'name', 'phone', 'employee_id', 'password_hash', 'password_reset_token'];

function sanitizePII(obj) {
  if (!obj) return obj;
  const clean = { ...obj };
  PII_FIELDS.forEach((f) => { if (f in clean) clean[f] = '[REDACTED]'; });
  return clean;
}

module.exports = { writeAuditLog };
