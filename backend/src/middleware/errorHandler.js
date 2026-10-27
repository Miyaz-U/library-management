const { ZodError } = require("zod");

// Runs for every error. Always replies with JSON: { error, details? }
function errorHandler(err, req, res, next) {
  // Invalid input caught by Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // Errors we throw on purpose (e.g. "Book not found")
  if (err.status) {
    return res.status(err.status).json({
      error: err.message,
      details: err.details,
    });
  }

  // Malformed JSON in the request body
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }

  // Anything unexpected: log it, but don't leak internals to the client
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
}

module.exports = { errorHandler };