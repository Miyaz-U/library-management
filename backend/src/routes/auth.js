const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { getDb } = require("../db/database");
const { HttpError } = require("../utils/httpError");
const { signToken, requireAuth } = require("../middleware/auth");

const router = express.Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// POST /api/auth/register  (public sign-up always creates a MEMBER)
router.post("/register", (req, res, next) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);
    const db = getDb();

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) throw new HttpError(409, "An account with this email already exists");

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'member')")
      .run(name, email, passwordHash);

    const user = { id: result.lastInsertRowid, name, email, role: "member" };
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post("/login", (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const row = getDb().prepare("SELECT * FROM users WHERE email = ?").get(email);

    // Same message for "no such email" and "wrong password" so attackers learn nothing
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      throw new HttpError(401, "Incorrect email or password");
    }

    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me  (who am I?)
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;