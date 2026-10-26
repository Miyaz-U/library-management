const express = require("express");
const cors = require("cors");

const app = express();

// Allow the frontend (running on another port) to call this API
app.use(cors());

// Let Express read JSON sent in request bodies
app.use(express.json());

// Health check: a simple route to confirm the API is alive
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Library API is running" });
});

module.exports = app;