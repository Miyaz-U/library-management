const jwt = require("jsonwebtoken");
const { getDb } = require("../db/database");
const { HttpError } = require("../utils/httpError");

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set in .env");
  return secret;
}

function signToken(user) {
  return jwt.sign({ sub: user.id }, getSecret(), { expiresIn: "7d" });
}

// Checks the token and attaches the user to req.user
function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new HttpError(401, "Please log in to continue");
    }

    let payload;
    try {
      payload = jwt.verify(token, getSecret());
    } catch {
      throw new HttpError(401, "Your session is invalid or expired. Please log in again");
    }

    // Always load the user fresh from the database
    const user = getDb()
      .prepare("SELECT id, name, email, role FROM users WHERE id = ?")
      .get(payload.sub);
    if (!user) throw new HttpError(401, "Account no longer exists");

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Allows only certain roles, e.g. requireRole("librarian")
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, "You do not have permission to do this"));
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole };