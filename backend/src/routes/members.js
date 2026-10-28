const express = require("express");
const { getDb } = require("../db/database");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/members  (librarian): members and how many books each has out
router.get("/", requireAuth, requireRole("librarian"), (req, res, next) => {
  try {
    const members = getDb()
      .prepare(
        `SELECT u.id, u.name, u.email,
                (SELECT COUNT(*) FROM loans l
                 WHERE l.user_id = u.id AND l.returned_at IS NULL) AS active_loans
         FROM users u
         WHERE u.role = 'member'
         ORDER BY u.name`
      )
      .all();
    res.json({ members });
  } catch (err) {
    next(err);
  }
});

module.exports = router;