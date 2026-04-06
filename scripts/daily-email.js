const { Resend } = require("resend");

const API_BASE = process.env.API_URL || "https://plan.ollycohen.com";
const API_TOKEN = process.env.API_TOKEN;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_TO_FALLBACK = process.env.EMAIL_TO;

const QUOTES = [
  "Tích tiểu thành đại — gather small things to make something great.",
  "Tích cốc phòng cơ — store grain against famine.",
  "Có công mài sắt, có ngày nên kim — if you persist in grinding iron, one day it becomes a needle.",
  "Đi một ngày đàng, học một sàng khôn — one day of travel teaches a basketful of wisdom.",
  "Lửa thử vàng, gian nan thử sức — fire tests gold, hardship tests strength.",
  "Một cây làm chẳng nên non, ba cây chụm lại nên hòn núi cao — one tree does not make a mountain, but three together do.",
  "Không thầy đố mày làm nên — without a teacher, try making something of yourself.",
];

async function main() {
  if (!API_TOKEN || !RESEND_API_KEY) {
    console.error("Missing required env vars: API_TOKEN, RESEND_API_KEY");
    process.exit(1);
  }

  const headers = { Authorization: `Bearer ${API_TOKEN}` };

  // Fetch recipients from the API, fall back to EMAIL_TO env var
  const emailRes = await fetch(`${API_BASE}/api/emails`, { headers });
  if (!emailRes.ok) {
    console.error(`Failed to fetch emails: ${emailRes.status} ${emailRes.statusText}`);
  }
  const emailData = emailRes.ok ? await emailRes.json() : { emails: [] };
  const recipients = emailData.emails && emailData.emails.length > 0
    ? emailData.emails
    : EMAIL_TO_FALLBACK ? [EMAIL_TO_FALLBACK] : [];

  if (recipients.length === 0) {
    console.log("No email recipients configured. Skipping.");
    return;
  }

  // Fetch tasks from the live API
  const res = await fetch(`${API_BASE}/api/tasks`, { headers });
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const data = await res.json();
  if (!data || !data.tasks) throw new Error("No task data returned");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = fmt(today);

  // End of this week (Sunday)
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

  // End of this month
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // Flatten all undone items with their category info
  const allItems = data.tasks.flatMap((cat) =>
    cat.items
      .filter((item) => !item.done)
      .map((item) => ({ ...item, category: cat.category, icon: cat.icon }))
  );

  // Items due today
  const dueToday = allItems.filter((item) => item.date === todayStr);

  // Items due this week (including today)
  const dueThisWeek = allItems.filter((item) => {
    if (!item.date) return false;
    const d = new Date(item.date + "T00:00:00");
    return d >= today && d <= endOfWeek;
  });

  // Items due this month (including today)
  const dueThisMonth = allItems.filter((item) => {
    if (!item.date) return false;
    const d = new Date(item.date + "T00:00:00");
    return d >= today && d <= endOfMonth;
  });

  // Undated high-priority items (P4-P5)
  const highPriUndated = allItems
    .filter((item) => !item.date && item.priority >= 4)
    .sort((a, b) => b.priority - a.priority);

  // Stats
  const totalItems = data.tasks.reduce((n, cat) => n + cat.items.length, 0);
  const doneItems = data.tasks.reduce(
    (n, cat) => n + cat.items.filter((i) => i.done).length,
    0
  );
  const pct = totalItems ? Math.round((doneItems / totalItems) * 100) : 0;

  // Pick quote of the day
  const dayOfYear = Math.floor(
    (today - new Date(today.getFullYear(), 0, 0)) / 86400000
  );
  const quote = QUOTES[dayOfYear % QUOTES.length];

  // Build HTML email
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'IBM Plex Mono', monospace, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fafafa; color: #1a1a1a;">

  <div style="text-align: center; padding: 20px 0 10px;">
    <h1 style="margin: 0; font-size: 22px; letter-spacing: 2px;">⛰️ ANDES CHECKLIST</h1>
    <p style="color: #888; font-size: 12px; margin: 4px 0;">${formatDate(today)}</p>
    <p style="color: #888; font-size: 12px; margin: 0;">${pct}% complete (${doneItems}/${totalItems})</p>
  </div>

  <div style="background: #f0ebe3; border-left: 3px solid #c9a96e; padding: 14px 18px; margin: 20px 0; border-radius: 0 6px 6px 0;">
    <p style="margin: 0; font-size: 13px; color: #6b5c3e; font-style: italic;">${quote}</p>
  </div>

  ${section("📌 Today", dueToday)}
  ${section("📅 This Week", dueThisWeek)}
  ${section("🗓️ This Month", dueThisMonth)}
  ${section("🔥 High Priority (undated)", highPriUndated)}

  <div style="text-align: center; padding: 20px 0; border-top: 1px solid #e0e0e0; margin-top: 20px;">
    <a href="https://plan.ollycohen.com" style="color: #c9a96e; text-decoration: none; font-size: 13px;">Open Checklist →</a>
  </div>

</body>
</html>`;

  // Send via Resend
  const resend = new Resend(RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: "Andes Checklist <onboarding@resend.dev>",
    to: recipients,
    subject: `⛰️ Andes Update — ${formatDate(today)}`,
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    process.exit(1);
  }
  console.log("Daily email sent successfully.");
}

function section(title, items) {
  if (items.length === 0) {
    return `
    <div style="margin: 16px 0;">
      <h3 style="font-size: 14px; margin: 0 0 8px; color: #555;">${title}</h3>
      <p style="font-size: 13px; color: #aaa; margin: 0 0 0 12px;">Nothing scheduled</p>
    </div>`;
  }
  const rows = items
    .map((item) => {
      const pips = "●".repeat(item.priority || 0) + "○".repeat(5 - (item.priority || 0));
      const dateTag = item.date ? `<span style="color: #888; font-size: 11px;"> — ${item.date}</span>` : "";
      return `<tr>
        <td style="padding: 4px 8px; font-size: 13px; color: #c9a96e; white-space: nowrap;">${pips}</td>
        <td style="padding: 4px 8px; font-size: 13px;">${item.icon} ${item.text}${dateTag}</td>
      </tr>`;
    })
    .join("");
  return `
  <div style="margin: 16px 0;">
    <h3 style="font-size: 14px; margin: 0 0 8px; color: #555;">${title}</h3>
    <table style="border-collapse: collapse; width: 100%;">${rows}</table>
  </div>`;
}

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

function formatDate(d) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
