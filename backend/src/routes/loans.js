const express = require("express");
const { z } = require("zod");
const { getDb } = require("../db/database");
const { HttpError } = require("../utils/httpError");
const { parseId } = require("../utils/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const { issueCopy, returnLoan, getLoan, listLoans } = require("../services/loans");

const router = express.Router();

const issueSchema = z.object({
  memberId: z.number({ message: "memberId must be a number" }).int().positive(),
  copyCode: z.string().trim().min(1, "Copy code is required"),
});

const listSchema = z.object({
  status: z.enum(["open", "returned"], { message: "status must be open or returned" }).optional(),
});

// POST /api/loans  (librarian issues a copy to a member)
router.post("/", requireAuth, requireRole("librarian"), (req, res, next) => {
  try {
    const { memberId, copyCode } = issueSchema.parse(req.body);
    const db = getDb();
    const loanId = issueCopy(db, { memberId, copyCode, librarianId: req.user.id });
    res.status(201).json({ loan: getLoan(db, loanId) });
  } catch (err) {
    next(err);
  }
});

// POST /api/loans/:id/return  (librarian)
router.post("/:id/return", requireAuth, requireRole("librarian"), (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const db = getDb();
    returnLoan(db, id);
    res.json({ loan: getLoan(db, id) });
  } catch (err) {
    next(err);
  }
});

// GET /api/loans/mine  (any logged-in user: their own loans)
router.get("/mine", requireAuth, (req, res, next) => {
  try {
    res.json({ loans: listLoans(getDb(), { userId: req.user.id }) });
  } catch (err) {
    next(err);
  }
});

// GET /api/loans?status=open  (librarian: everyone's loans)
router.get("/", requireAuth, requireRole("librarian"), (req, res, next) => {
  try {
    const { status } = listSchema.parse(req.query);
    res.json({ loans: listLoans(getDb(), { status }) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;