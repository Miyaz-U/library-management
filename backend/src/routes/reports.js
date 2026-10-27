const express = require("express");
const { getDb } = require("../db/database");
const { requireAuth, requireRole } = require("../middleware/auth");
const { overdueReport } = require("../services/loans");

const router = express.Router();

// GET /api/reports/overdue  (librarian)
router.get("/overdue", requireAuth, requireRole("librarian"), (req, res, next) => {
  try {
    res.json(overdueReport(getDb()));
  } catch (err) {
    next(err);
  }
});

module.exports = router;