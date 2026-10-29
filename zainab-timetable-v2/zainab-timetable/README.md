# Zainab Memorial Academy timetable (v2, with server)
Logins: admin / ZMAK123 | students: ss2 / ZMA-SS2 (same pattern per class) | demo teacher: teacher / teacher123. Change them in Admin after first login.

All files sit in ONE flat folder so they can be uploaded from a phone.
- server.js runs the website, checks logins, shares data between phones and emails teachers (7:00 digest, 5 min before start/end).
- Settings go in environment variables (see env-example.txt): BREVO_API_KEY, MAIL_FROM, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, TZ.
- Without them it still runs: emails are printed in the log and data is kept in a file (lost when a free host restarts).
- Start command: node server.js (no install needed).
