const { z } = require("zod");

// Validates a URL id like /api/books/5 and returns it as a number
function parseId(value) {
  return z.coerce
    .number({ message: "Id must be a number" })
    .int("Id must be a whole number")
    .positive("Id must be positive")
    .parse(value);
}

module.exports = { parseId };