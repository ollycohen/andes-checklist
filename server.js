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

// GET /api/emails — return subscriber lists
app.get("/api/emails", requireAuth, (req, res) => {
  try {
    const data = readData();
    res.json({
      dailyEmails: data.dailyEmails || data.emails || [],
      weeklyEmails: data.weeklyEmails || [],
    });
  } catch (err) {
    console.error("Error reading emails:", err.message);
    res.status(500).json({ error: "Failed to read emails" });
  }
});

// PUT /api/emails — replace subscriber lists
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
app.put("/api/emails", requireAuth, (req, res) => {
  try {
    const { dailyEmails, weeklyEmails } = req.body;
    if (!Array.isArray(dailyEmails) || !Array.isArray(weeklyEmails)) {
      return res.status(400).json({ error: "dailyEmails and weeklyEmails arrays required" });
    }
    const allValid = [...dailyEmails, ...weeklyEmails].every(e => typeof e === "string" && emailRegex.test(e));
    if (!allValid) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    const data = readData();
    data.dailyEmails = dailyEmails;
    data.weeklyEmails = weeklyEmails;
    delete data.emails; // migrate away from old field
    writeData(data);
    res.json({ ok: true, dailyEmails, weeklyEmails });
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

// One-time migration: backfill completedAt on done items that lack it
function migrateCompletedAt() {
  const data = readData();
  if (!data.tasks || !Array.isArray(data.tasks)) return;
  let count = 0;
  const now = new Date().toISOString();
  for (const cat of data.tasks) {
    for (const item of cat.items) {
      if (item.done && !item.completedAt) {
        item.completedAt = now;
        count++;
      }
      if (item.subtasks) {
        for (const sub of item.subtasks) {
          if (sub.done && !sub.completedAt) {
            sub.completedAt = now;
            count++;
          }
        }
      }
    }
  }
  if (count > 0) {
    writeData(data);
    console.log(`Backfilled ${count} item(s) with completedAt`);
  }
}

migrateCompletedAt();

app.listen(PORT, () => {
  console.log("Andes checklist server running on http://localhost:" + PORT);
});
