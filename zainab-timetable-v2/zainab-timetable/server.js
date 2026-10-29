// Zainab Timetable server: shares data between devices and emails teachers even when no page is open.
// Run: node server.js  (no install needed). Settings come from environment variables, see README.
const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm");
try { fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }); } catch (e) {}
process.env.TZ = process.env.TZ || "Africa/Lagos";
const ROOT = __dirname, DB = path.join(__dirname, "state.json"), PORT = +process.env.PORT || 3000;
const D = vm.runInNewContext(fs.readFileSync(path.join(ROOT, "data.js"), "utf8") + ";({SCHOOL,SLOTS,CLASSES,SEED,TEACHERS_SEED})", { location: { protocol: "", origin: "" } });
let S = null; try { S = JSON.parse(fs.readFileSync(DB, "utf8")); } catch (e) {}
async function sendMail(to, subject, text) {
  const key = process.env.BREVO_API_KEY, from = process.env.MAIL_FROM;
  if (!key || !from) { console.log("[DRY RUN, email not set up]", to, "|", subject, "|", text); return "dry-run"; }
  const r = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ sender: { name: D.SCHOOL.name, email: from }, to: [{ email: to }], subject: D.SCHOOL.name + ": " + subject, textContent: text }) });
  if (!r.ok) throw new Error("Brevo " + r.status + " " + (await r.text()).slice(0, 150)); return "sent";
}
// ---- same lesson logic as the website ----
const mins = t => { const [a, b] = t.split(":"); return +a * 60 + +b; };
const parts = v => (v || "").split("/").map(x => x.trim()).filter(Boolean), norm = v => String(v).replace("?", "").trim().toUpperCase();
const teaches = (t, c, p) => t.subjects.map(norm).includes(norm(p)) && (!(t.classes || []).length || t.classes.map(norm).includes(norm(c)));
function lessons(t, d) {
  const out = []; (d < 4 ? D.SLOTS.mt : D.SLOTS.fri).filter(s => !s[2]).forEach((s, k) => S.classes.forEach(c => parts(((S.tt[c] || [])[d] || [])[k]).forEach(p => { if (teaches(t, c, p)) out.push({ s: s[0], e: s[1], c, p }); })));
  return out.sort((x, y) => mins(x.s) - mins(y.s));
}
let fired = { d: "", k: [] };
function once(k) { const d = new Date().toDateString(); if (fired.d !== d) fired = { d, k: [] }; if (fired.k.includes(k)) return false; fired.k.push(k); return true; }
async function tick() {
  if (!S || !S.alerts || !S.alerts.on) return;
  const now = new Date(), d = (now.getDay() + 6) % 7, n = now.getHours() * 60 + now.getMinutes(); if (d > 4) return;
  for (const t of S.teachers) { if (!t.email) continue; const L = lessons(t, d);
    const go = async (k, sub, txt) => { if (once(t.user + k)) try { console.log(new Date().toTimeString().slice(0, 5), await sendMail(t.email, sub, txt), t.email, sub); } catch (e) { console.log("Email failed for", t.email, e.message); } };
    if (S.alerts.dg && n >= 420 && n < 480) await go("dg", "Good morning", `Hello ${t.name},\n\n` + (L.length ? "Your periods today:\n" + L.map(l => `${l.s}-${l.e}  ${l.p} (${l.c})`).join("\n") : "You have no periods today."));
    for (const l of L) { const s = mins(l.s), e = mins(l.e), id = l.s + l.c + l.p;
      if (S.alerts.st && n >= s - 5 && n < s) await go(id + "s", "Starts in 5 min", `${l.p} with ${l.c} starts at ${l.s}.`);
      if (S.alerts.en && n >= e - 5 && n < e) await go(id + "e", "Ends in 5 min", `${l.p} with ${l.c} ends at ${l.e}. Please wrap up.`); } }
}
setInterval(() => tick().catch(e => console.log(e.message)), 30000);
// ---- storage (file, plus free Upstash cloud copy so data survives restarts) ----
const UP = process.env.UPSTASH_REDIS_REST_URL, UT = process.env.UPSTASH_REDIS_REST_TOKEN, crypto = require("crypto");
const up = cmd => fetch(UP, { method: "POST", headers: { Authorization: "Bearer " + UT }, body: JSON.stringify(cmd) }).then(r => r.json());
const seed = () => { const tt = {}; D.CLASSES.forEach(c => tt[c] = [0,1,2,3,4].map(d => D.SEED[c] ? [...D.SEED[c][d]] : Array(d < 4 ? 7 : 6).fill("")));
  return { tt, classes: [...D.CLASSES], teachers: JSON.parse(JSON.stringify(D.TEACHERS_SEED)), sp: {}, showPhone: true, showEmail: true, courses: [], log: [], alerts: { on: false, dg: true, st: true, en: true } }; };
async function load() { if (UP) try { const r = await up(["GET", "zma_state"]); if (r.result) S = JSON.parse(r.result); } catch (e) { console.log("Cloud load failed:", e.message); } S = S || seed(); }
async function persist() { const j = JSON.stringify(S); try { fs.writeFileSync(DB, j); } catch (e) {} if (UP) try { await up(["SET", "zma_state", j]); } catch (e) { console.log("Cloud save failed:", e.message); } }
// ---- login (checked here on the server) ----
const tokens = new Map(), tries = new Map();
function login(u, p) {
  u = String(u || "").trim().toLowerCase(); p = String(p || ""); const cls = S.classes.find(c => c.toLowerCase() === u);
  if (u === "admin" && p === (S.adminPass || "ZMAK123")) return { role: "admin", name: "Administrator" };
  if (cls && p === (S.sp[cls] || "ZMA-" + cls)) return { role: "student", name: cls, cls };
  const t = S.teachers.find(t => t.user.toLowerCase() === u && t.pass === p); return t ? { role: "teacher", name: t.name, user: t.user } : null;
}
const view = role => role === "admin" ? S : { ...S, sp: undefined, adminPass: undefined, log: undefined,
  teachers: S.teachers.map(({ pass, ...t }) => role === "student" ? { ...t, phone: S.showPhone ? t.phone : "", email: S.showEmail ? t.email : "" } : t) };
const body = req => new Promise(r => { let b = ""; req.on("data", c => b += c); req.on("end", () => r(b)); });
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const PUBLIC = ["index.html", "student.html", "teacher.html", "admin.html", "app.js", "data.js", "style.css", "logo.png"];
load().then(() => http.createServer(async (req, res) => {
  const j = (c, o) => { res.writeHead(c, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,X-Token", "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS" }); res.end(JSON.stringify(o)); };
  const url = req.url.split("?")[0], me = tokens.get(req.headers["x-token"]);
  if (req.method === "OPTIONS") return j(204, {});
  if (url === "/api/ping") return j(200, { ok: 1 });
  if (url === "/api/login" && req.method === "POST") {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress, t = (tries.get(ip) || []).filter(x => Date.now() - x < 300000);
    if (t.length >= 10) return j(429, { error: "Too many attempts. Wait 5 minutes." });
    let q = {}; try { q = JSON.parse(await body(req)); } catch (e) {}
    const a = login(q.u, q.p); if (!a) { t.push(Date.now()); tries.set(ip, t); return j(401, { error: "wrong" }); }
    const token = crypto.randomBytes(24).toString("hex"); tokens.set(token, a); return j(200, { ...a, token });
  }
  if (url === "/api/state" && req.method === "GET") return me ? j(200, view(me.role)) : j(401, {});
  if (url === "/api/state" && req.method === "PUT") { if (!me || me.role !== "admin") return j(401, {}); try { S = JSON.parse(await body(req)); await persist(); return j(200, { ok: 1 }); } catch (e) { return j(400, {}); } }
  if (url === "/api/test-email" && req.method === "POST") { if (!me || me.role !== "admin") return j(401, {}); try { j(200, { result: await sendMail(JSON.parse(await body(req)).to, "Test email", "This is a test from the school timetable. Email alerts are working.") }); } catch (e) { j(500, { error: e.message }); } return; }
  const f = url === "/" ? "index.html" : url.slice(1);
  if (!PUBLIC.includes(f)) return j(404, { error: "not found" });
  fs.readFile(path.join(ROOT, f), (e, d) => e ? j(404, {}) : (res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "text/plain" }), res.end(d)));
}).listen(PORT, () => console.log(`Timetable running on port ${PORT} | email: ${process.env.BREVO_API_KEY ? "Brevo on" : "dry run"} | storage: ${UP ? "cloud+file" : "file only"}`)));
