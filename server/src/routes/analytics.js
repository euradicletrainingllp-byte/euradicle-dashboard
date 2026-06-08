// Analytics routes — Sprint 5 (stubs for Sprint 1)
const express = require('express');
const router = express.Router();
router.use(require('../middleware/auth').authenticate);
router.get('/platform', (req, res) => res.json({ message: 'Platform analytics — Sprint 5' }));
module.exports = router;
