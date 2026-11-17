// Cleans what tests\test-api.ps1 created, and re-syncs the technicians' counters.
// Run from the project root:
//   mongosh "mongodb://127.0.0.1:27017/helpdesk" --file tests/reset-test-data.js

// comments of the test tickets first (they point to the tickets)
const testTicketIds = db.tickets.find({ title: /^AUTO-TEST/ }, { _id: 1 }).toArray().map((t) => t._id);
const deletedComments = db.comments.deleteMany({ ticket_id: { $in: testTicketIds } });
print('Deleted test comments: ' + deletedComments.deletedCount);

const deletedTickets = db.tickets.deleteMany({ title: /^AUTO-TEST/ });
print('Deleted test tickets: ' + deletedTickets.deletedCount);

// accounts created by the test script (registrations and technicians)
const deletedUsers = db.users.deleteMany({ email: /^autotest-/ });
print('Deleted test accounts: ' + deletedUsers.deletedCount);

// active_count must always equal the number of tickets En cours of the technician
db.users.find({ role: 'technician' }).forEach((u) => {
  const n = db.tickets.countDocuments({ technician_id: u._id, status: 'En cours' });
  db.users.updateOne({ _id: u._id }, { $set: { active_count: n } });
  print(u.email + ' -> active_count = ' + n);
});

// accounts created before the status field existed are active
const fixed = db.users.updateMany({ status: { $exists: false } }, { $set: { status: 'active' } });
print('Accounts without status set to active: ' + fixed.modifiedCount);
