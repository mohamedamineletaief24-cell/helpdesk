# Helpdesk - stories 6.1 to 6.11 (all stories of the backlog)

## Easiest way to run it (Windows)
1. Unzip the project, then open the folder that contains `package.json`.
2. Double-click **start.bat**. The first time, it installs everything and creates the test accounts
   (it can take a few minutes). Then it starts the backend and the frontend and opens the site
   at http://localhost:5173.
3. To stop everything, double-click **stop.bat**.

MongoDB must be installed (it runs as a Windows service). If start.bat says that MongoDB is not
running, right-click start.bat and choose "Run as administrator".

Done:
- 6.1 login (roles, JWT, an account that is not approved gets 403)
- 6.2 open a ticket, 6.3 my tickets
- 6.4 take in charge (limit of 5 En cours)
- 6.5 comment and resolve (mandatory comment, the counter n/5 goes down)
- 6.6 close and reopen (reopen only within 7 days, the technician is removed)
- 6.7 Kanban board with 4 columns and combined filters (status + priority + technician)
- 6.8 statistics (per status, per category, average resolution time) and technician activity table
- 6.9 the administrator adds a technician
- 6.10 a visitor creates an account (status pending)
- 6.11 the administrator approves or rejects account requests

Bonus (not done): drag and drop, file attachment, automatic escalation after 24 hours.

## Requirements
Node.js 18+ and MongoDB running locally on port 27017.

## Install and run (3 steps, in this order)
IMPORTANT: this version adds a library (chart.js), so run `npm install` again in the project root,
even if you already installed an older version.

1. MongoDB: it runs as a Windows service. Check with `sc query MongoDB` (STATE: RUNNING).
2. Backend (terminal 1):
       cd server
       npm install
       npm run seed      (once: creates the 3 test accounts)
       npm run dev       (http://localhost:5000)
3. Frontend (terminal 2, in the project root, the folder that contains package.json):
       npm install
       npm run dev       (http://localhost:5173)

The `.env` file is in the project root (not in server/).
Optional in `.env`: ALLOWED_EMAIL_DOMAIN=school.tn (registration only accepts this domain).
The automatic tests use @school.tn emails, so keep it empty or school.tn.

## How accounts are created
| Role | How |
|---|---|
| user | The person clicks "Create an account" (/register). The account is pending until the administrator approves it. |
| technician | Only the administrator, from the Admin page ("Add a technician"). Active at once. |
| admin | Only the seed script. |

## Test accounts (created by `npm run seed`, for development)
| Role | Email | Password |
|---|---|---|
| user | user@school.tn | user123 |
| technician | tech@school.tn | tech123 |
| admin | admin@school.tn | admin123 |

## Automatic API test (about 160 checks)
With MongoDB and the backend running, in the project root:

    powershell -ExecutionPolicy Bypass -File tests\test-api.ps1

Every line shows [PASS] or [FAIL]. It creates tickets named "AUTO-TEST ..." and accounts
named "autotest-...@school.tn". Clean them afterwards:

    mongosh "mongodb://127.0.0.1:27017/helpdesk" --file tests/reset-test-data.js

T5 (reopen after 7 days) uses mongosh to make a ticket 8 days old. Without mongosh in the PATH, the test is skipped.

## Manual test in the browser
1. Visitor: open /register, send a request. Then try to log in with it: "waiting for approval".
2. admin: log in, "Account requests" shows the request. Click Approve.
3. The new user logs in and opens a ticket, then "Tickets I opened" shows it (Ouvert).
4. admin: "Add a technician" creates a technician. That technician logs in at once.
5. technician: the Kanban board shows 4 columns. "En cours: n/5", click "Take in charge".
   Take 5, then a 6th: red message, counter stays 5/5.
6. technician: on one of your tickets En cours, click "Resolve". Empty comment: red message.
   With a comment: the ticket moves to the Résolu column and the counter goes down. Take the 6th again: it works.
7. technician: use the filters (status, priority, technician) together. A combination with no ticket shows empty columns.
8. user: the resolved ticket shows the technician comment and two buttons: "Close ticket" and "Reopen".
   Reopen: the ticket goes back to Ouvert, without technician. Close: the ticket becomes Fermé and cannot be reopened.
9. admin: the Statistics section shows the tiles and the two charts. "Technician activity" lists every technician
   (a technician with no ticket shows 0/5, 0, and "-").
10. Route guard: logged in as user, type localhost:5173/admin: you are sent back to /user.

## Manual tests that cannot be automated
- T10 (no resolved ticket): on an empty database, the admin page shows "Average resolution time: 0" and no error.
  To try it: in mongosh, run db.tickets.deleteMany({}) then reload the admin page.
- T5 in the browser: in mongosh, make a resolved ticket 8 days old, then click Reopen as its owner:
      db.tickets.updateOne({ title: "YOUR TITLE" }, { $set: { resolved_at: new Date(Date.now() - 8*24*3600*1000) } })
  The server answers "Reopening is only possible within 7 days after the resolution", and the Reopen button is
  replaced by a message.
