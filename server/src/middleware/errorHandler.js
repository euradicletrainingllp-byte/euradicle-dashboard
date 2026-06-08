const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err);

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message, details: err.details } });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
  }

  // Supabase / Postgres unique constraint
  if (err.code === '23505') {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Record already exists' } });
  }

  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';

  res.status(status).json({ error: { code, message } });
};

module.exports = { errorHandler };
