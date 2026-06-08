require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const orgRoutes = require('./routes/organizations');
const cohortRoutes = require('./routes/cohorts');
const enrollmentRoutes = require('./routes/enrollments');
const assessmentRoutes = require('./routes/assessments');
const contentRoutes = require('./routes/content');
const analyticsRoutes = require('./routes/analytics');
const announcementRoutes = require('./routes/announcements');
const adminRoutes = require('./routes/admin');
const journeyRoutes = require('./routes/journeys');

const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  // Vercel preview + production URLs are same-origin (API lives on /api),
  // so browser requests come from the same domain — no CORS needed in prod.
  // Add your custom domain here if using one:
  // 'https://elop.euradicle.com',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin (no Origin header) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── Rate limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 10,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts' } },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1', apiLimiter);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/organizations', orgRoutes);
app.use('/api/v1/cohorts', cohortRoutes);
app.use('/api/v1/cohorts', enrollmentRoutes);
app.use('/api/v1/assessments', assessmentRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/announcements', announcementRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', journeyRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// ── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// Only start the server when run directly (not when imported by Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 ELOP API Server running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
}

module.exports = app;
