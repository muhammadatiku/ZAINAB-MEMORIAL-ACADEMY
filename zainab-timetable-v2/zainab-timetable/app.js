// app.js - login, page guards, timetable drawing, teacher info, alerts, light/dark mode.
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const mins = t => { const [a,b] = t.split(":"); return +a*60 + +b; };
const nowM = () => { const d = new Date(); return d.getHours()*60 + d.getMinutes(); };
const dayNow = () => (new Date().getDay() + 6) % 7;

// ---- Saved data (kept in this browser) ----
function fresh() {
  const tt = {};
  CLASSES.forEach(c => tt[c] = [0,1,2,3,4].map(d => SEED[c] ? [...SEED[c][d]] : Array(d < 4 ? 7 : 6).fill("")));
  return { tt, teachers: JSON.parse(JSON.stringify(TEACHERS_SEED)), sp: {}, showPhone: true, showEmail: true };
}
let S; try { S = JSON.parse(localStorage.getItem("zma_v1")); } catch (e) {}
if (!S) S = fresh();
function fix() {
  S.sp = S.sp || {}; if (S.showPhone === undefined) S.showPhone = true; if (S.showEmail === undefined) S.showEmail = true;
  S.classes = S.classes || [...CLASSES]; CLASSES.splice(0, CLASSES.length, ...S.classes);
  S.courses = S.courses || []; S.log = S.log || []; S.alerts = S.alerts || { on: false, dg: true, st: true, en: true };
  S.classes.forEach(c => { if (!S.tt[c]) S.tt[c] = [0,1,2,3,4].map(d => Array(d < 4 ? 7 : 6).fill("")); });
  S.teachers.forEach(t => { t.phone = t.phone || ""; t.email = t.email || ""; t.classes = t.classes || []; });
}
fix();
const tok = () => sessionStorage.getItem("zma_tok") || "";
const isAdm = () => { try { return JSON.parse(sessionStorage.getItem("zma_user")).role === "admin"; } catch (e) { return false; } };
const saveS = () => { try { localStorage.setItem("zma_v1", JSON.stringify(S)); } catch (e) {}
  if (typeof API_URL === "string" && API_URL && isAdm()) fetch(API_URL + "/api/state", { method: "PUT", headers: { "X-Token": tok() }, body: JSON.stringify(S) }).catch(() => {}); };
async function pull() { if (!API_URL || !tok()) return; try { const r = await fetch(API_URL + "/api/state", { headers: { "X-Token": tok() } }); if (r.status === 401) { logout(); return; } if (r.ok) { const n = await r.json(); if (n && n.tt) { S = n; fix(); localStorage.setItem("zma_v1", JSON.stringify(S)); } } } catch (e) {} }
const audit = t => { S.log.unshift(new Date().toLocaleString() + " — " + t); S.log = S.log.slice(0, 80); saveS(); };

// ---- Light / dark mode ----
try { const m = localStorage.getItem("zma_theme"); if (m) document.documentElement.dataset.theme = m; } catch (e) {}
const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t === "dark" : matchMedia("(prefers-color-scheme:dark)").matches; };
const paintMode = () => document.querySelectorAll(".mode").forEach(b => b.textContent = isDark() ? "☀️ Light" : "🌙 Dark");
function toggleTheme() { const n = isDark() ? "light" : "dark"; document.documentElement.dataset.theme = n; try { localStorage.setItem("zma_theme", n); } catch (e) {} paintMode(); }

// ---- Login (passwords are changed only by the admin) ----
async function signIn(u, p) {
  if (API_URL) { try { const r = await fetch(API_URL + "/api/login", { method: "POST", body: JSON.stringify({ u, p }) });
    if (r.status === 429) { $("#e").textContent = "Too many attempts. Wait 5 minutes."; return null; } if (!r.ok) return false;
    const a = await r.json(); sessionStorage.setItem("zma_tok", a.token); delete a.token; sessionStorage.setItem("zma_user", JSON.stringify(a)); location.href = a.role + ".html"; return true;
  } catch (e) { $("#e").textContent = "Cannot reach the school server. Try again."; return null; } }
  u = u.trim().toLowerCase();
  let a = null;
  const cls = CLASSES.find(c => c.toLowerCase() === u);
  if (u === "admin" && p === (S.adminPass || "ZMAK123")) a = { role: "admin", name: "Administrator" };
  else if (cls && p === (S.sp[cls] || "ZMA-" + cls)) a = { role: "student", name: cls, cls };
  else { const t = S.teachers.find(t => t.user.toLowerCase() === u && t.pass === p); if (t) a = { role: "teacher", name: t.name, user: t.user }; }
  if (!a) return false;
  sessionStorage.setItem("zma_user", JSON.stringify(a)); 
  location.href = a.role + ".html";
  return true;
}
const logout = () => { sessionStorage.removeItem("zma_user"); sessionStorage.removeItem("zma_tok"); location.href = "index.html"; };

// ---- Helpers: which teacher takes which subject ----
const parts = v => (v || "").split("/").map(x => x.trim()).filter(Boolean);
const norm = v => String(v).replace("?", "").trim().toUpperCase();
const teaches = (t, c, p) => t.subjects.map(norm).includes(norm(p)) && (!t.classes.length || t.classes.map(norm).includes(norm(c)));
function lessons(t, d) {
  const sl = (d < 4 ? SLOTS.mt : SLOTS.fri).filter(s => !s[2]), out = [];
  sl.forEach((s, k) => CLASSES.forEach(c => parts(S.tt[c][d][k]).forEach(p => { if (teaches(t, c, p)) out.push({ s: s[0], e: s[1], c, p }); })));
  return out.sort((x, y) => mins(x.s) - mins(y.s));
}
function modal(h) {
  let m = $("#modal");
  if (!m) { m = document.createElement("div"); m.id = "modal"; m.onclick = e => { if (e.target === m) m.className = ""; }; document.body.append(m); }
  m.innerHTML = `<div>${h}<button class="btn pri" onclick="this.closest('#modal').className=''">Close</button></div>`; m.className = "on";
}
function info(p, c) {
  const h = S.teachers.filter(t => teaches(t, c, p)).map(t => `<p><b>${esc(t.name)}</b>` +
    (S.showPhone && t.phone ? `<br>📞 <a href="tel:${esc(t.phone)}">${esc(t.phone)}</a>` : "") +
    (S.showEmail && t.email ? `<br>✉️ <a href="mailto:${esc(t.email)}">${esc(t.email)}</a>` : "") + "</p>").join("") || '<p class="mut">Teacher details have not been added yet.</p>';
  modal(`<h3 style="margin-top:0">${esc(p)} · ${esc(c)}</h3>${h}`);
}

// ---- Timetable drawing ----
function weekTable(cell) {
  const td = dayNow(), n = nowM();
  const one = (slots, days, title) => {
    let i = 0, h = `<h3>${title}</h3><div class="sc"><table><tr><th>Time</th>${days.map(d => `<th class="${d===td?"today":""}">${DAYS[d]}</th>`).join("")}</tr>`;
    slots.forEach(s => {
      const t = s[0] + (s[1] ? "–" + s[1] : "");
      if (s[2]) { h += `<tr class="brk"><th>${t}</th><td colspan="${days.length}">${s[2]}</td></tr>`; return; }
      const k = i++;
      h += `<tr><th>${t}</th>` + days.map(d => `<td class="${d===td && n>=mins(s[0]) && n<mins(s[1]) ? "now":""}">${cell(d,k)}</td>`).join("") + "</tr>";
    });
    return h + "</table></div>";
  };
  return one(SLOTS.mt, [0,1,2,3], "Monday to Thursday") + one(SLOTS.fri, [4], "Friday");
}
const note = '<p class="mut">Tap any subject to see the teacher’s name, phone and email. Two subjects in one box means the groups (Science, Arts, Commercial) learn different subjects at the same time.</p>';

// ---- Student side ----
function studentPage(a) {
  const btns = v => parts(v).map(p => `<button class="sub" data-p="${esc(p)}">${esc(p)}</button>`).join("") || '<span class="mut">–</span>';
  $("#app").innerHTML = `<div class="card"><h2>${esc(a.cls)} timetable</h2>${dayNow() > 4 ? '<p class="notice">📅 No school today (weekend). Showing the normal weekly timetable.</p>' : ""}${note}${weekTable((d,i) => btns(S.tt[a.cls][d][i]))}</div>`;
  $("#app").onclick = e => { const b = e.target.closest(".sub"); if (b) info(b.dataset.p, a.cls); };
}

// ---- Teacher side: week, daily summary and lesson alerts ----
function teacherPage(a) {
  const t = S.teachers.find(x => x.user === a.user) || { subjects: [], classes: [] };
  const cell = (d,i) => {
    const r = [];
    CLASSES.forEach(c => { const v = S.tt[c][d][i] || ""; const m = parts(v).filter(p => teaches(t, c, p)); if (m.length) r.push(`<button class="sub" data-c="${c}" data-p="${esc(m.join(" / "))}" data-d="${d}" data-i="${i}"><b>${c}</b> ${esc(m.join(" / "))}</button>`); });
    return r.join("<br>") || '<span class="mut">–</span>';
  };
  const digest = () => { const d = dayNow(); if (d > 4) return "No school today."; const L = lessons(t, d);
    return L.length ? `You have ${L.length} period(s) today: ` + L.map(l => `${l.s}–${l.e} ${l.p} (${l.c})`).join("; ") + "." : "You have no periods today."; };
  $("#app").innerHTML = `<div class="card"><h2>Today</h2>${dayNow() > 4 ? '<p class="notice">📅 Weekend: no school today. Enjoy your rest!</p>' : ""}<p>${esc(digest())}</p><p class="mut">Lesson alerts are ${S.alerts.on ? "<b>ON</b>" : "<b>OFF</b> (the admin has not switched them on)"}.</p>
  <div class="row"><button class="btn" id="en">Turn on phone/browser alerts</button><button class="btn" id="ts">Send me a test alert</button></div>
  <div id="alog" class="mut">Alerts appear here: a 7:00 AM summary, and a reminder 5 minutes before each period starts and ends.</div>
  <p class="mut">Alerts show while this page is open. Email alerts need the school’s email system.</p></div>
  <div class="card"><h2>${esc(a.name)}’s week</h2><p class="mut">Subjects: ${esc(t.subjects.join(", ") || "none set yet")}${t.classes.length ? " · Classes: " + esc(t.classes.join(", ")) : ""}</p>${weekTable(cell)}</div>`;
  $("#app").addEventListener("click", ev => { const b = ev.target.closest(".sub"); if (!b) return; const d = +b.dataset.d, i = +b.dataset.i, sl = (d < 4 ? SLOTS.mt : SLOTS.fri).filter(x => !x[2])[i];
    modal(`<h3 style="margin-top:0">${esc(b.dataset.p)}</h3><p><b>Class:</b> ${esc(b.dataset.c)}<br><b>Day:</b> ${DAYS[d]}<br><b>Time:</b> ${sl[0]}–${sl[1]}<br><b>Period:</b> ${i + 1}</p>`); });
  const log = [];
  function ring(title, body) {
    log.unshift(`${new Date().toTimeString().slice(0,5)} ${title}: ${body}`);
    $("#alog").innerHTML = log.slice(0,8).map(x => `<div>🔔 ${esc(x)}</div>`).join("");
    toast(title + ": " + body, 8000);
    try { if (Notification.permission === "granted") new Notification(title, { body }); } catch (e) {}
  }
  function once(k) {
    let f; try { f = JSON.parse(localStorage.getItem("zma_fired")); } catch (e) {}
    const d = new Date().toDateString(); if (!f || f.d !== d) f = { d, k: [] };
    if (f.k.includes(k)) return false; f.k.push(k);
    try { localStorage.setItem("zma_fired", JSON.stringify(f)); } catch (e) {} return true;
  }
  $("#en").onclick = () => { try { Notification.requestPermission().then(r => toast(r === "granted" ? "Alerts turned on" : "Alerts blocked in your browser")); } catch (e) { toast("This browser does not support alerts"); } };
  $("#ts").onclick = () => ring("Test alert", "This is how your lesson alerts will look.");
  const tick = () => {
    const d = dayNow(); if (d > 4 || !S.alerts.on) return; const n = nowM();
    if (S.alerts.dg && n >= 420 && n < 480 && once(a.user + "dg")) ring("Good morning", digest());
    lessons(t, d).forEach(l => {
      const s = mins(l.s), e = mins(l.e), id = a.user + l.s + l.c + l.p;
      if (S.alerts.st && n >= s - 5 && n < s && once(id + "s")) ring("Starts in 5 min", `${l.p} with ${l.c} at ${l.s}`);
      if (S.alerts.en && n >= e - 5 && n < e && once(id + "e")) ring("Ends in 5 min", `${l.p} with ${l.c} ends at ${l.e}`);
    });
  };
  tick(); setInterval(tick, 15000);
}

// ---- Admin side: Periods, Teachers, Courses & Classes, Alerts, Settings & Log ----
let ac = CLASSES[0], et = null, sub = "periods", showPw = false;
const TABS = [["periods","Periods"],["teachers","Teachers"],["courses","Courses & Classes"],["alerts","Alerts"],["settings","Settings & Log"]];
const list = v => v.split(",").map(x => x.trim()).filter(Boolean);
const genPw = () => Array.from({length:8}, () => "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random()*31)]).join("");
const pwShow = p => showPw ? `<code>${esc(p)}</code>` : "••••••••";
function dayMsgs(d) {
  const o = [];
  S.teachers.forEach(t => { const L = lessons(t, d);
    if (S.alerts.dg) o.push({ m: 420, who: t.name, k: "Morning digest", x: L.length ? L.map(l => `${l.s} ${l.p} (${l.c})`).join("; ") : "No periods today." });
    L.forEach(l => { if (S.alerts.st) o.push({ m: mins(l.s)-5, who: t.name, k: "Starts in 5 min", x: `${l.p} with ${l.c} at ${l.s}` });
      if (S.alerts.en) o.push({ m: mins(l.e)-5, who: t.name, k: "Ends in 5 min", x: `${l.p} with ${l.c} ends at ${l.e}` }); }); });
  return o.sort((a,b) => a.m - b.m);
}
function adminPage() {
  const e = et !== null ? S.teachers[et] : { name: "", user: "", subjects: [], classes: [], phone: "", email: "" };
  const used = [...new Set(CLASSES.flatMap(c => S.tt[c].flat().flatMap(parts).map(norm)))].filter(Boolean).sort();
  let b = "";
  if (sub === "periods") b = `<div class="card"><div class="row"><b>Class</b><select id="ac">${CLASSES.map(c => `<option ${c===ac?"selected":""}>${esc(c)}</option>`).join("")}</select><button class="btn pri" id="sv">Save timetable</button></div>
    <p class="mut">Type the subject in each box. Use / for two subjects at once (CHEM / ECONS). Leave empty for no lesson.</p>${weekTable((d,i) => `<input data-d="${d}" data-i="${i}" value="${esc(S.tt[ac][d][i])}">`)}</div>`;
  if (sub === "teachers") b = `<div class="card"><h2>Teachers</h2><div class="row"><button class="btn" id="spw">${showPw ? "Hide" : "Show"} passwords</button></div><div class="sc"><table><tr><th>Name</th><th>Username</th><th>Password</th><th>Subjects</th><th>Classes</th><th>Contact</th><th></th></tr>${S.teachers.map((t,i) => `<tr><td>${esc(t.name)}</td><td>${esc(t.user)}</td><td>${pwShow(t.pass)}</td><td>${esc(t.subjects.join(", "))}</td><td>${esc(t.classes.join(", ") || "All")}</td><td>${esc(t.phone)}<br>${esc(t.email)}</td><td><button class="btn" data-ed="${i}">Edit</button> <button class="btn" data-pw="${i}">Reset password</button> <button class="btn" data-rm="${i}">Remove</button></td></tr>`).join("")}</table></div>
    <h3>${et !== null ? "Edit teacher" : "Add teacher"}</h3><div class="row"><input id="tn" placeholder="Name" value="${esc(e.name)}"><input id="tu" placeholder="Username" value="${esc(e.user)}">${et === null ? `<input id="tp" placeholder="Password" value="${genPw()}">` : ""}<input id="tph" placeholder="Phone" value="${esc(e.phone)}"><input id="tem" placeholder="Email" value="${esc(e.email)}"></div>
    <div class="row"><input id="ts" placeholder="Subjects, e.g. MATHS, PHY" value="${esc(e.subjects.join(", "))}"><input id="tc" placeholder="Classes (blank = all)" value="${esc(e.classes.join(", "))}"><button class="btn pri" id="ta">${et !== null ? "Save changes" : "Add teacher"}</button>${et !== null ? '<button class="btn" id="tx">Cancel</button>' : ""}</div><p class="mut">Subjects in use: ${esc(used.join(", "))}</p></div>`;
  if (sub === "courses") b = `<div class="card"><h2>Courses</h2><div class="row"><input id="cn" placeholder="New course, e.g. FRENCH"><button class="btn pri" id="ca">Add course</button></div>${[...new Set([...used, ...S.courses])].sort().map(c => `<span class="pill">${esc(c)}${S.courses.includes(c) && !used.includes(c) ? ` <a href="#" data-dc="${esc(c)}">✕</a>` : ""}</span> `).join("")}</div>
    <div class="card"><h2>Classes and class passwords</h2><div class="row"><input id="cl" placeholder="New class, e.g. SS1B"><button class="btn pri" id="cla">Add class</button><button class="btn" id="spw">${showPw ? "Hide" : "Show"} passwords</button></div>
    <div class="sc"><table><tr><th>Class</th><th>Login</th><th>Password</th><th></th></tr>${CLASSES.map(c => `<tr><td>${esc(c)}</td><td>${esc(c.toLowerCase())}</td><td>${pwShow(S.sp[c] || "ZMA-" + c)}</td><td><button class="btn" data-cp="${esc(c)}">Reset password</button> <button class="btn" data-dl="${esc(c)}">Remove</button></td></tr>`).join("")}</table></div></div>`;
  if (sub === "alerts") b = `<div class="card"><h2>Lesson alerts</h2><label><input type="checkbox" id="aon" ${S.alerts.on ? "checked" : ""}> <b>Alerts switched ON for teachers</b></label><br>
    <label><input type="checkbox" id="adg" ${S.alerts.dg ? "checked" : ""}> 7:00 AM morning digest</label><br><label><input type="checkbox" id="ast" ${S.alerts.st ? "checked" : ""}> 5 minutes before a period starts</label><br><label><input type="checkbox" id="aen" ${S.alerts.en ? "checked" : ""}> 5 minutes before a period ends</label>
    <h3>Channels</h3><p>✅ On-screen pop-up · ✅ Browser/phone notification (while the teacher page is open)<br>${API_URL ? "✅ Email to teachers from the school server, even when no page is open (needs the server running)." : "⏳ Email needs the school server: set API_URL in data.js."}</p><div class="row"><input id="em" placeholder="Send a test email to…"><button class="btn" id="emb">Send test email</button></div></div>
    <div class="card"><h3 style="margin-top:0">Preview a day</h3><select id="ad">${DAYS.map((d,i) => `<option value="${i}" ${i===adDay?"selected":""}>${d}</option>`).join("")}</select>${dayMsgs(adDay).map(x => `<p><b>${fmt(x.m)}</b> ${esc(x.k)} → <b>${esc(x.who)}</b><br><span class="mut">${esc(x.x)}</span></p>`).join("") || '<p class="mut">No messages.</p>'}</div>`;
  if (sub === "settings") b = `<div class="card"><h2>Privacy and admin</h2><label><input type="checkbox" id="shp" ${S.showPhone ? "checked" : ""}> Students can see teacher phone numbers</label><br><label><input type="checkbox" id="she" ${S.showEmail ? "checked" : ""}> Students can see teacher emails</label>
    <div class="row" style="margin-top:10px"><input id="pa" placeholder="New admin password (6+ characters)"><button class="btn pri" id="pas">Change admin password</button></div></div>
    <div class="card"><h2>Backup</h2><div class="row"><button class="btn" id="bk">Download backup</button><label class="btn">Restore backup<input type="file" id="rsf" accept=".json" hidden></label><button class="btn" id="rs">Reset to starting timetable</button></div></div>
    <div class="card"><h2>Activity log</h2>${S.log.map(l => `<div class="mut">${esc(l)}</div>`).join("") || '<p class="mut">No changes yet.</p>'}</div>`;
  $("#app").innerHTML = `<div class="row tabs">${TABS.map(t => `<button class="btn ${sub===t[0]?"pri":""}" data-t="${t[0]}">${t[1]}</button>`).join("")}</div>` + b;
  const on = (id, f, ev = "onclick") => { const x = $("#" + id); if (x) x[ev] = f; }, q = (s, f) => document.querySelectorAll(s).forEach(f);
  q("[data-t]", x => x.onclick = () => { sub = x.dataset.t; et = null; adminPage(); });
  on("spw", () => { showPw = !showPw; adminPage(); });
  on("ac", x => { ac = x.target.value; adminPage(); }, "onchange");
  on("sv", () => { q("#app input[data-d]", x => S.tt[ac][+x.dataset.d][+x.dataset.i] = x.value.trim()); audit("Saved timetable for " + ac); toast(ac + " timetable saved"); });
  q("[data-rm]", x => x.onclick = () => { if (confirm("Remove this teacher?")) { audit("Removed teacher " + S.teachers[+x.dataset.rm].name); S.teachers.splice(+x.dataset.rm, 1); et = null; adminPage(); } });
  q("[data-ed]", x => x.onclick = () => { et = +x.dataset.ed; adminPage(); scrollTo(0, document.body.scrollHeight); });
  q("[data-pw]", x => x.onclick = () => { const t = S.teachers[+x.dataset.pw], p = prompt("New password for " + t.name, genPw()); if (p && p.trim()) { t.pass = p.trim(); audit("Reset password for " + t.name); toast("Password reset for " + t.name); adminPage(); } });
  on("tx", () => { et = null; adminPage(); });
  on("ta", () => {
    const t = { name: $("#tn").value.trim(), user: $("#tu").value.trim(), subjects: list($("#ts").value), classes: list($("#tc").value).map(x => x.toUpperCase()), phone: $("#tph").value.trim(), email: $("#tem").value.trim() };
    if (!t.name || !t.user) return toast("Enter a name and username");
    if (S.teachers.some((x,i) => i !== et && x.user.toLowerCase() === t.user.toLowerCase())) return toast("That username is already used");
    if (et !== null) Object.assign(S.teachers[et], t); else { t.pass = $("#tp").value.trim(); if (!t.pass) return toast("Enter a password"); S.teachers.push(t); }
    audit((et !== null ? "Edited" : "Added") + " teacher " + t.name); et = null; adminPage(); toast("Teacher saved");
  });
  on("ca", () => { const c = $("#cn").value.trim().toUpperCase(); if (c) { S.courses.push(c); audit("Added course " + c); adminPage(); } });
  q("[data-dc]", x => x.onclick = ev => { ev.preventDefault(); S.courses = S.courses.filter(c => c !== x.dataset.dc); audit("Removed course " + x.dataset.dc); adminPage(); });
  on("cla", () => { const c = $("#cl").value.trim().toUpperCase(); if (!c || CLASSES.includes(c)) return toast("Enter a new class name");
    S.classes.push(c); CLASSES.push(c); S.tt[c] = [0,1,2,3,4].map(d => Array(d < 4 ? 7 : 6).fill("")); audit("Added class " + c); adminPage(); });
  q("[data-dl]", x => x.onclick = () => { const c = x.dataset.dl; if (!confirm("Remove " + c + " and its timetable?")) return;
    S.classes = S.classes.filter(k => k !== c); CLASSES.splice(CLASSES.indexOf(c), 1); delete S.tt[c]; delete S.sp[c]; ac = CLASSES[0]; audit("Removed class " + c); adminPage(); });
  q("[data-cp]", x => x.onclick = () => { const c = x.dataset.cp, p = prompt("New password for " + c, genPw()); if (p && p.trim()) { S.sp[c] = p.trim(); audit("Reset password for " + c); adminPage(); } });
  [["aon","on"],["adg","dg"],["ast","st"],["aen","en"]].forEach(([id,k]) => on(id, x => { S.alerts[k] = x.target.checked; audit("Alert setting " + k + " = " + x.target.checked); saveS(); }, "onchange"));
  on("emb", () => fetch(API_URL + "/api/test-email", { method: "POST", headers: { "X-Token": tok() }, body: JSON.stringify({ to: $("#em").value.trim() }) }).then(r => r.json()).then(r => toast(r.result ? "Test email: " + r.result : "Failed: " + r.error, 5000)).catch(() => toast("Cannot reach the school server")));
  on("ad", x => { adDay = +x.target.value; adminPage(); }, "onchange");
  on("shp", x => { S.showPhone = x.target.checked; audit("Phone visibility " + x.target.checked); saveS(); }, "onchange");
  on("she", x => { S.showEmail = x.target.checked; audit("Email visibility " + x.target.checked); saveS(); }, "onchange");
  on("pas", () => { const p = $("#pa").value.trim(); if (p.length < 6) return toast("Use at least 6 characters"); S.adminPass = p; audit("Admin password changed"); toast("Admin password changed"); });
  on("bk", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" })); a.download = "zma-backup-" + new Date().toISOString().slice(0,10) + ".json"; a.click(); });
  on("rsf", x => { const f = x.target.files[0]; if (!f) return; f.text().then(t => { try { S = JSON.parse(t); fix(); audit("Restored backup"); adminPage(); toast("Backup restored"); } catch (er) { toast("That file is not a valid backup"); } }); }, "onchange");
  on("rs", () => { if (confirm("Replace all saved changes with the starting timetable?")) { S = fresh(); fix(); audit("Reset to starting data"); et = null; adminPage(); } });
}
const fmt = m => String(Math.floor(m/60)).padStart(2,"0") + ":" + String(m%60).padStart(2,"0");
let adDay = Math.min(dayNow(), 4);
function toast(m, ms = 3000) { const t = $("#toast"); t.textContent = m; t.className = "on"; clearTimeout(toast.t); toast.t = setTimeout(() => t.className = "", ms); }

// ---- Start-up ----
(async function () {
  await pull();
  const role = document.body.dataset.role;
  const me = JSON.parse(sessionStorage.getItem("zma_user") || "null");
  document.title = SCHOOL.name;
  document.documentElement.style.setProperty("--pri", SCHOOL.color);
  $("#foot").textContent = [SCHOOL.motto, SCHOOL.address, SCHOOL.phone, SCHOOL.email].filter(Boolean).join(" | ");
  if (role === "login") {
    if (me) { location.href = me.role + ".html"; return; }
    $("#sname").textContent = SCHOOL.name; $("#motto").textContent = SCHOOL.motto;
    const b = document.createElement("button"); b.className = "btn mode floating"; b.onclick = toggleTheme; document.body.append(b); paintMode();
    $("#f").onsubmit = e => { e.preventDefault(); $("#e").textContent = ""; signIn($("#u").value, $("#p").value).then(ok => { if (ok === false) $("#e").textContent = "Username or password is wrong. Check it and try again."; }); };
    return;
  }
  if (!me || me.role !== role) { location.href = "index.html"; return; }
  $("#top").innerHTML = `<img src="logo.png" alt=""><div><b>${esc(SCHOOL.name)}</b><small>${esc(me.name)} (${role})</small></div><button class="btn mode" onclick="toggleTheme()"></button><button class="btn" onclick="logout()">Sign out</button>`;
  paintMode();
  if (role !== "admin") addEventListener("storage", ev => { if (ev.key === "zma_v1") location.reload(); });
  if (API_URL && role !== "admin") setInterval(async () => { const b = JSON.stringify(S); await pull(); if (JSON.stringify(S) !== b) location.reload(); }, 20000);
  ({ student: studentPage, teacher: teacherPage, admin: adminPage })[role](me);
})();
