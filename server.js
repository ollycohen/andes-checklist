const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = "bolivar";
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json({ limit: "2mb" }));

// Serve static files (index.html)
app.use(express.static(__dirname, { index: "index.html" }));

// Auth middleware for API routes
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || auth !== "Bearer " + PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// GET /api/tasks — return stored tasks
app.get("/api/tasks", requireAuth, (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json(null);
    }
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    console.error("Error reading data.json:", err.message);
    res.status(500).json({ error: "Failed to read data" });
  }
});

// PUT /api/tasks — replace stored tasks
app.put("/api/tasks", requireAuth, (req, res) => {
  try {
    const { tasks, updatedAt } = req.body;
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "Invalid payload: tasks array required" });
    }
    const data = { tasks, updatedAt: updatedAt || new Date().toISOString() };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    res.json({ ok: true, updatedAt: data.updatedAt });
  } catch (err) {
    console.error("Error writing data.json:", err.message);
    res.status(500).json({ error: "Failed to write data" });
  }
});

app.listen(PORT, () => {
  console.log("Andes checklist server running on http://localhost:" + PORT);
});
