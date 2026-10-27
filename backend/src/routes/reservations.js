const express = require("express");
const { z } = require("zod");
const { getDb } = require("../db/database");
const { parseId } = require("../utils/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const {
  reserveBook,
  cancelReservation,
  listReservations,
} = require("../services/reservations");

const router = express.Router();

const reserveSchema = z.object({
  bookId: z.number({ message: "bookId must be a number" }).int().positive(),
});

const listSchema = z.object({
  status: z
    .enum(["waiting", "offered", "fulfilled", "cancelled"], {
      message: "status must be waiting, offered, fulfilled or cancelled",
    })
    .optional(),
});

// POST /api/reservations  (member joins the queue)
router.post("/", requireAuth, requireRole("member"), (req, res, next) => {
  try {
    const { bookId } = reserveSchema.parse(req.body);
    const db = getDb();
    const id = reserveBook(db, { userId: req.user.id, bookId });
    res.status(201).json({ reservation: listReservations(db, { id })[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/reservations/mine
router.get("/mine", requireAuth, (req, res, next) => {
  try {
    res.json({ reservations: listReservations(getDb(), { userId: req.user.id }) });
  } catch (err) {
    next(err);
  }
});

// GET /api/reservations  (librarian)
router.get("/", requireAuth, requireRole("librarian"), (req, res, next) => {
  try {
    const { status } = listSchema.parse(req.query);
    res.json({ reservations: listReservations(getDb(), { status }) });
  } catch (err) {
    next(err);
  }
});

// POST /api/reservations/:id/cancel  (owner or librarian)
router.post("/:id/cancel", requireAuth, (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const db = getDb();
    cancelReservation(db, id, req.user);
    res.json({ reservation: listReservations(db, { id })[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;