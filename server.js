const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.PASSWORD || "bolivar";

// Use /data (Fly.io persistent volume) if it exists, otherwise local directory
const DATA_DIR = fs.existsSync("/data") ? "/data" : __dirname;
const DATA_FILE = path.join(DATA_DIR, "data.json");

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

// PUT /api/tasks — replace stored tasks (preserves other fields like emails)
app.put("/api/tasks", requireAuth, (req, res) => {
  try {
    const { tasks, updatedAt } = req.body;
    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: "Invalid payload: tasks array required" });
    }
    const existing = readData();
    existing.tasks = tasks;
    existing.updatedAt = updatedAt || new Date().toISOString();
    writeData(existing);
    res.json({ ok: true, updatedAt: existing.updatedAt });
  } catch (err) {
    console.error("Error writing data.json:", err.message);
    res.status(500).json({ error: "Failed to write data" });
  }
});

// Helper to read/write the whole data file
function readData() {
  if (!fs.existsSync(DATA_FILE)) return { tasks: [], emails: [] };
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

// GET /api/emails — return subscriber list
app.get("/api/emails", requireAuth, (req, res) => {
  try {
    const data = readData();
    res.json({ emails: data.emails || [] });
  } catch (err) {
    console.error("Error reading emails:", err.message);
    res.status(500).json({ error: "Failed to read emails" });
  }
});

// PUT /api/emails — replace subscriber list
app.put("/api/emails", requireAuth, (req, res) => {
  try {
    const { emails } = req.body;
    if (!Array.isArray(emails)) {
      return res.status(400).json({ error: "emails array required" });
    }
    const valid = emails.every(e => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (!valid) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    const data = readData();
    data.emails = emails;
    writeData(data);
    res.json({ ok: true, emails });
  } catch (err) {
    console.error("Error writing emails:", err.message);
    res.status(500).json({ error: "Failed to write emails" });
  }
});

// GET /api/title — return project title
app.get("/api/title", requireAuth, (req, res) => {
  try {
    const data = readData();
    res.json({ title: data.title || "Andes Expedition" });
  } catch (err) {
    console.error("Error reading title:", err.message);
    res.status(500).json({ error: "Failed to read title" });
  }
});

// PUT /api/title — update project title
app.put("/api/title", requireAuth, (req, res) => {
  try {
    const { title } = req.body;
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "Non-empty title string required" });
    }
    const data = readData();
    data.title = title.trim();
    writeData(data);
    res.json({ ok: true, title: data.title });
  } catch (err) {
    console.error("Error writing title:", err.message);
    res.status(500).json({ error: "Failed to write title" });
  }
});

// GET /api/name — return owner name
app.get("/api/name", requireAuth, (req, res) => {
  try {
    const data = readData();
    res.json({ name: data.name || "" });
  } catch (err) {
    console.error("Error reading name:", err.message);
    res.status(500).json({ error: "Failed to read name" });
  }
});

// PUT /api/name — update owner name
app.put("/api/name", requireAuth, (req, res) => {
  try {
    const { name } = req.body;
    if (typeof name !== "string") {
      return res.status(400).json({ error: "Name string required" });
    }
    const data = readData();
    data.name = name.trim();
    writeData(data);
    res.json({ ok: true, name: data.name });
  } catch (err) {
    console.error("Error writing name:", err.message);
    res.status(500).json({ error: "Failed to write name" });
  }
});

app.listen(PORT, () => {
  console.log("Andes checklist server running on http://localhost:" + PORT);
});
