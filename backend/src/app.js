const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const bookRoutes = require("./routes/books");
const loanRoutes = require("./routes/loans");
const reservationRoutes = require("./routes/reservations");
const reportRoutes = require("./routes/reports");
const memberRoutes = require("./routes/members");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Library API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/members", memberRoutes);

// Unknown URLs
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Must be last: catches every error thrown above
app.use(errorHandler);

module.exports = app;