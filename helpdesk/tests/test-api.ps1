# Helpdesk API test script (stories 6.1 to 6.11)
#
# Needs: MongoDB running, backend running on port 5000, `npm run seed` already done.
# Run from the project root:
#   powershell -ExecutionPolicy Bypass -File tests\test-api.ps1
#
# It creates tickets whose title starts with "AUTO-TEST".
# Clean them afterwards with tests\reset-test-data.js (see README.md).

$Base = "http://localhost:5000/api"
$script:Pass = 0
$script:Fail = 0

function Call {
  param([string]$Method, [string]$Path, $Headers = @{}, $Body = $null)
  $params = @{ Method = $Method; Uri = "$Base$Path"; Headers = $Headers; UseBasicParsing = $true }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json)
    $params.ContentType = "application/json; charset=utf-8"
  }
  try {
    $r = Invoke-WebRequest @params
    $status = [int]$r.StatusCode
    $text = $r.Content
  } catch {
    if ($null -eq $_.Exception.Response) {
      Write-Host "Cannot reach the server on $Base. Is the backend running?" -ForegroundColor Red
      exit 1
    }
    $status = [int]$_.Exception.Response.StatusCode
    $text = $_.ErrorDetails.Message
  }
  $json = $null
  if ($text) { try { $json = $text | ConvertFrom-Json } catch { } }
  return [pscustomobject]@{ Status = $status; Body = $json }
}

function Check {
  param([string]$Name, [bool]$Ok, [string]$Detail = "")
  if ($Ok) { Write-Host "[PASS] $Name" -ForegroundColor Green; $script:Pass++ }
  else { Write-Host "[FAIL] $Name $Detail" -ForegroundColor Red; $script:Fail++ }
}

function Auth($token) { return @{ Authorization = "Bearer $token" } }

function NewTicket($headers, $title) {
  return Call "POST" "/tickets" $headers @{ title = $title; description = "created by test-api.ps1"; category = "hardware"; priority = "low" }
}

# ---------------------------------------------------------------- 6.1
Write-Host ""
Write-Host "== 6.1 Authentication ==" -ForegroundColor Cyan

$u = Call "POST" "/login" @{} @{ email = "user@school.tn"; password = "user123" }
Check "user logs in, role = user" ($u.Status -eq 200 -and $u.Body.role -eq "user") "(status $($u.Status))"
$t = Call "POST" "/login" @{} @{ email = "tech@school.tn"; password = "tech123" }
Check "technician logs in, role = technician" ($t.Status -eq 200 -and $t.Body.role -eq "technician") "(status $($t.Status))"
$a = Call "POST" "/login" @{} @{ email = "admin@school.tn"; password = "admin123" }
Check "admin logs in, role = admin" ($a.Status -eq 200 -and $a.Body.role -eq "admin") "(status $($a.Status))"

if ($u.Status -ne 200 -or $t.Status -ne 200 -or $a.Status -ne 200) {
  Write-Host "Login failed: did you run 'npm run seed' in the server folder?" -ForegroundColor Red
  exit 1
}
$HU = Auth $u.Body.token
$HT = Auth $t.Body.token
$HA = Auth $a.Body.token

$r = Call "POST" "/login" @{} @{ email = "user@school.tn"; password = "wrong-password" }
Check "wrong password -> 401" ($r.Status -eq 401) "(status $($r.Status))"
$r = Call "POST" "/login" @{} @{ email = "nobody@school.tn"; password = "user123" }
Check "unknown email -> 401" ($r.Status -eq 401) "(status $($r.Status))"
$r = Call "POST" "/login" @{} @{}
Check "empty login body -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "POST" "/login" @{} @{ email = @{ '$ne' = "" }; password = "x" }
Check "NoSQL injection attempt -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "GET" "/me"
Check "T11: call without token -> 401" ($r.Status -eq 401) "(status $($r.Status))"
$r = Call "GET" "/me" @{ Authorization = "Bearer not.a.token" }
Check "invalid token -> 401" ($r.Status -eq 401) "(status $($r.Status))"

# ---------------------------------------------------------------- 6.2
Write-Host ""
Write-Host "== 6.2 Open a ticket ==" -ForegroundColor Cyan

$new = Call "POST" "/tickets" $HU @{ title = "AUTO-TEST forged"; description = "x"; category = "hardware"; priority = "low"; status = "Closed"; created_at = "2000-01-01T00:00:00Z" }
Check "valid ticket -> 201" ($new.Status -eq 201) "(status $($new.Status))"
Check "status forced to Ouvert (client value ignored)" ($new.Body.status -eq "Ouvert")
Check "BR5: created_at set by the server (client value ignored)" (([datetime]$new.Body.created_at).Year -ne 2000)

$r = Call "POST" "/tickets" $HU @{ title = ""; description = "x"; category = "hardware"; priority = "low" }
Check "empty title -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "POST" "/tickets" $HU @{ title = "AUTO-TEST"; description = ""; category = "hardware"; priority = "low" }
Check "empty description -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "POST" "/tickets" $HU @{ title = "AUTO-TEST"; description = "x"; category = "urgent"; priority = "low" }
Check "invalid category -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "POST" "/tickets" $HU @{ title = "AUTO-TEST"; description = "x"; category = "hardware"; priority = "critical" }
Check "invalid priority -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "POST" "/tickets" $HT @{ title = "AUTO-TEST"; description = "x"; category = "hardware"; priority = "low" }
Check "technician cannot open a ticket -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "POST" "/tickets" @{} @{ title = "AUTO-TEST"; description = "x"; category = "hardware"; priority = "low" }
Check "open a ticket without token -> 401" ($r.Status -eq 401) "(status $($r.Status))"

# ---------------------------------------------------------------- 6.3
Write-Host ""
Write-Host "== 6.3 Follow my tickets ==" -ForegroundColor Cyan

$mine = Call "GET" "/tickets/mine" $HU
Check "GET /tickets/mine -> 200" ($mine.Status -eq 200) "(status $($mine.Status))"
$mineIds = @($mine.Body | ForEach-Object { $_._id })
Check "my new ticket is in my list" ($mineIds -contains $new.Body._id)
$r = Call "GET" "/tickets/mine" $HT
Check "technician cannot use /tickets/mine -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "GET" "/tickets/mine"
Check "/tickets/mine without token -> 401" ($r.Status -eq 401) "(status $($r.Status))"

# ---------------------------------------------------------------- 6.4
Write-Host ""
Write-Host "== 6.4 Take a ticket in charge (BR1 + BR2) ==" -ForegroundColor Cyan

$r = Call "GET" "/tickets" $HT
Check "technician lists all tickets -> 200" ($r.Status -eq 200) "(status $($r.Status))"
$r = Call "GET" "/tickets" $HU
Check "user cannot list all tickets -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "GET" "/tickets" $HA
Check "admin cannot list all tickets -> 403" ($r.Status -eq 403) "(status $($r.Status))"

$me = Call "GET" "/me" $HT
$before = [int]$me.Body.active_count
Write-Host "Technician starts with $before/5 tickets En cours"

$r = Call "PATCH" "/tickets/abc/take" $HT
Check "invalid ticket id -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "PATCH" "/tickets/$($new.Body._id)/take" $HU
Check "user cannot take a ticket -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "PATCH" "/tickets/$($new.Body._id)/take"
Check "take without token -> 401" ($r.Status -eq 401) "(status $($r.Status))"

if ($before -lt 5) {
  $r = Call "PATCH" "/tickets/000000000000000000000000/take" $HT
  Check "unknown ticket -> 404" ($r.Status -eq 404) "(status $($r.Status))"
  $me = Call "GET" "/me" $HT
  Check "the reserved slot was given back (counter unchanged)" ([int]$me.Body.active_count -eq $before)
} else {
  Write-Host "[SKIP] unknown ticket -> 404 (technician already at 5/5)" -ForegroundColor Yellow
}

$room = 5 - $before
if ($room -lt 0) { $room = 0 }
$ids = @()
for ($i = 1; $i -le ($room + 1); $i++) {
  $c = NewTicket $HU "AUTO-TEST take $i"
  $ids += $c.Body._id
}

$allOk = $true
for ($i = 0; $i -lt $room; $i++) {
  $r = Call "PATCH" "/tickets/$($ids[$i])/take" $HT
  if ($r.Status -ne 200 -or $r.Body.ticket.status -ne "En cours") { $allOk = $false }
  if ($i -eq 0 -and $room -gt 1) {
    # BR1 alone: the technician still has free slots, so a refusal can only come from the ticket
    $again = Call "PATCH" "/tickets/$($ids[0])/take" $HT
    Check "T1: ticket already taken refused -> 409 (already taken)" ($again.Status -eq 409 -and $again.Body.error -like "*already taken*") "(status $($again.Status))"
  }
}
Check "technician takes $room ticket(s) up to the limit -> 200" $allOk
if ($room -le 1) {
  Write-Host "[SKIP] T1 alone (no free slot left to isolate BR1)" -ForegroundColor Yellow
}

$sixth = Call "PATCH" "/tickets/$($ids[$room])/take" $HT
Check "T2: 6th ticket refused -> 409 (limit reached)" ($sixth.Status -eq 409 -and $sixth.Body.error -like "Limit reached*") "(status $($sixth.Status))"
$stillOpen = Call "GET" "/tickets/mine" $HU
$notTaken = @($stillOpen.Body | Where-Object { $_._id -eq $ids[$room] })[0]
Check "the refused ticket is still Ouvert" ($notTaken.status -eq "Ouvert")
$me = Call "GET" "/me" $HT
Check "counter is 5/5" ([int]$me.Body.active_count -eq 5) "(counter = $($me.Body.active_count))"

# ---------------------------------------------------------------- 6.10 / 6.11 / 6.9
$stamp = Get-Date -Format "yyyyMMddHHmmss"
$emailA = "autotest-a-$stamp@school.tn"
$emailB = "autotest-b-$stamp@school.tn"
$emailT = "autotest-t-$stamp@school.tn"
$pw = "password123"

Write-Host ""
Write-Host "== 6.10 Create an account (visitor) ==" -ForegroundColor Cyan

$reg = Call "POST" "/register" @{} @{ name = "AUTO-TEST A"; email = $emailA; password = $pw; role = "admin"; status = "active" }
Check "register -> 201" ($reg.Status -eq 201) "(status $($reg.Status))"
Check "T16: role forced to user (role sent by the client ignored)" ($reg.Body.account.role -eq "user")
Check "T16: status is pending (status sent by the client ignored)" ($reg.Body.account.status -eq "pending")
Check "the response does not contain the password hash" ($null -eq $reg.Body.account.password_hash)
$idA = $reg.Body.account.id

$r = Call "POST" "/register" @{} @{ name = "AUTO-TEST A"; email = $emailA; password = $pw }
Check "T17: email already used -> 409" ($r.Status -eq 409) "(status $($r.Status))"
$r = Call "POST" "/register" @{} @{ email = "autotest-x-$stamp@school.tn"; password = $pw }
Check "T18: missing name -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "POST" "/register" @{} @{ name = "AUTO-TEST"; email = "not-an-email"; password = $pw }
Check "T18: invalid email -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "POST" "/register" @{} @{ name = "AUTO-TEST"; email = "autotest-y-$stamp@school.tn"; password = "abc" }
Check "T18: password shorter than 8 characters -> 400" ($r.Status -eq 400) "(status $($r.Status))"

$r = Call "POST" "/login" @{} @{ email = $emailA; password = $pw }
Check "T19: pending account cannot log in -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "POST" "/login" @{} @{ email = $emailA; password = "wrong-password" }
Check "pending account + wrong password -> 401 (status not revealed)" ($r.Status -eq 401) "(status $($r.Status))"

Write-Host ""
Write-Host "== 6.11 Approve or reject accounts (admin) ==" -ForegroundColor Cyan

$r = Call "GET" "/accounts/pending" $HU
Check "T22: user cannot list pending requests -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "GET" "/accounts/pending" $HT
Check "T22: technician cannot list pending requests -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "PATCH" "/accounts/$idA/approve" $HU
Check "T22: user cannot approve -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "PATCH" "/accounts/$idA/reject" $HT
Check "T22: technician cannot reject -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "GET" "/accounts/pending"
Check "pending list without token -> 401" ($r.Status -eq 401) "(status $($r.Status))"

$pending = Call "GET" "/accounts/pending" $HA
Check "admin lists pending requests -> 200" ($pending.Status -eq 200) "(status $($pending.Status))"
$pendingIds = @($pending.Body | ForEach-Object { $_._id })
Check "the new request is in the pending list" ($pendingIds -contains $idA)
$pendingText = $pending.Body | ConvertTo-Json -Depth 4
Check "the pending list does not contain password hashes" ($pendingText -notlike "*password_hash*")

$ap = Call "PATCH" "/accounts/$idA/approve" $HA
Check "T21: admin approves -> 200, status active" ($ap.Status -eq 200 -and $ap.Body.account.status -eq "active") "(status $($ap.Status))"
$r = Call "POST" "/login" @{} @{ email = $emailA; password = $pw }
Check "T21: the approved person can log in (role user)" ($r.Status -eq 200 -and $r.Body.role -eq "user") "(status $($r.Status))"
$pending = Call "GET" "/accounts/pending" $HA
$pendingIds = @($pending.Body | ForEach-Object { $_._id })
Check "T21: the approved account is no longer in the pending list" (-not ($pendingIds -contains $idA))

$r = Call "PATCH" "/accounts/$idA/approve" $HA
Check "T23: approve an account that is not pending -> 409" ($r.Status -eq 409) "(status $($r.Status))"
$r = Call "PATCH" "/accounts/$idA/reject" $HA
Check "T23: reject an account that is not pending -> 409" ($r.Status -eq 409) "(status $($r.Status))"
$r = Call "PATCH" "/accounts/000000000000000000000000/approve" $HA
Check "unknown account id -> 404" ($r.Status -eq 404) "(status $($r.Status))"
$r = Call "PATCH" "/accounts/abc/approve" $HA
Check "invalid account id -> 400" ($r.Status -eq 400) "(status $($r.Status))"

$regB = Call "POST" "/register" @{} @{ name = "AUTO-TEST B"; email = $emailB; password = $pw }
$idB = $regB.Body.account.id
$rj = Call "PATCH" "/accounts/$idB/reject" $HA
Check "admin rejects a request -> 200, status rejected" ($rj.Status -eq 200 -and $rj.Body.account.status -eq "rejected") "(status $($rj.Status))"
$r = Call "POST" "/login" @{} @{ email = $emailB; password = $pw }
Check "T20: rejected account cannot log in -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "POST" "/register" @{} @{ name = "AUTO-TEST B"; email = $emailB; password = $pw }
Check "Q8: a rejected email cannot apply again -> 409" ($r.Status -eq 409) "(status $($r.Status))"

Write-Host ""
Write-Host "== 6.9 Add a technician (admin) ==" -ForegroundColor Cyan

$r = Call "POST" "/technicians" $HU @{ name = "AUTO-TEST Tech"; email = $emailT; password = $pw }
Check "T13: user cannot create a technician -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "POST" "/technicians" $HT @{ name = "AUTO-TEST Tech"; email = $emailT; password = $pw }
Check "T13: technician cannot create a technician -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "POST" "/technicians" @{} @{ name = "AUTO-TEST Tech"; email = $emailT; password = $pw }
Check "create a technician without token -> 401" ($r.Status -eq 401) "(status $($r.Status))"

$tech = Call "POST" "/technicians" $HA @{ name = "AUTO-TEST Tech"; email = $emailT; password = $pw; role = "admin" }
Check "admin creates a technician -> 201" ($tech.Status -eq 201) "(status $($tech.Status))"
Check "BR9: role forced to technician (role sent by the client ignored)" ($tech.Body.account.role -eq "technician")
Check "the technician account is active at once" ($tech.Body.account.status -eq "active")
Check "the response does not contain the password hash" ($null -eq $tech.Body.account.password_hash)
$r = Call "POST" "/login" @{} @{ email = $emailT; password = $pw }
Check "the new technician can log in (role technician)" ($r.Status -eq 200 -and $r.Body.role -eq "technician") "(status $($r.Status))"
$meT = Call "GET" "/me" (Auth $r.Body.token)
Check "the new technician starts with active_count = 0" ([int]$meT.Body.active_count -eq 0)

$r = Call "POST" "/technicians" $HA @{ name = "AUTO-TEST Tech"; email = $emailT; password = $pw }
Check "T14: email already used -> 409" ($r.Status -eq 409) "(status $($r.Status))"
$r = Call "POST" "/technicians" $HA @{ email = "autotest-z-$stamp@school.tn"; password = $pw }
Check "T15: missing name -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "POST" "/technicians" $HA @{ name = "AUTO-TEST"; email = "not-an-email"; password = $pw }
Check "T15: invalid email -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "POST" "/technicians" $HA @{ name = "AUTO-TEST"; email = "autotest-w-$stamp@school.tn"; password = "abc" }
Check "T15: password shorter than 8 characters -> 400" ($r.Status -eq 400) "(status $($r.Status))"

# ---------------------------------------------------------------- 6.5
Write-Host ""
Write-Host "== 6.5 Comment and resolve ==" -ForegroundColor Cyan

# A second technician (created in the 6.9 tests) is used, so the first one keeps its 5/5
$t2 = Call "POST" "/login" @{} @{ email = $emailT; password = $pw }
$HT2 = Auth $t2.Body.token
$tk1 = NewTicket $HU "AUTO-TEST resolve 1"
$tk2 = NewTicket $HU "AUTO-TEST resolve 2"
$id1 = $tk1.Body._id
$id2 = $tk2.Body._id

$r = Call "PATCH" "/tickets/$id1/take" $HT2
Check "technician 2 takes a ticket -> 200" ($r.Status -eq 200) "(status $($r.Status))"

$r = Call "POST" "/tickets/$id1/resolve" $HT2 @{}
Check "T3: resolve without a comment -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "POST" "/tickets/$id1/resolve" $HT2 @{ comment = "   " }
Check "T3: resolve with a blank comment -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "POST" "/tickets/$id1/resolve" $HT2 @{ comment = 123 }
Check "resolve with a comment that is not text -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$list = Call "GET" "/tickets" $HT2
$row = @($list.Body | Where-Object { $_._id -eq $id1 })[0]
Check "the ticket is still En cours after the refused resolves" ($row.status -eq "En cours")

$r = Call "POST" "/tickets/$id1/resolve" $HT @{ comment = "I am not the assigned technician" }
Check "T4: resolve a ticket assigned to another technician -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "POST" "/tickets/$id2/resolve" $HT2 @{ comment = "x" }
Check "resolve a ticket nobody took (Ouvert) -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "POST" "/tickets/$id1/resolve" $HU @{ comment = "x" }
Check "user cannot resolve -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "POST" "/tickets/$id1/resolve" $HA @{ comment = "x" }
Check "admin cannot resolve -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "POST" "/tickets/$id1/resolve" @{} @{ comment = "x" }
Check "resolve without token -> 401" ($r.Status -eq 401) "(status $($r.Status))"
$r = Call "POST" "/tickets/abc/resolve" $HT2 @{ comment = "x" }
Check "invalid ticket id -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "POST" "/tickets/000000000000000000000000/resolve" $HT2 @{ comment = "x" }
Check "unknown ticket -> 404" ($r.Status -eq 404) "(status $($r.Status))"

$ok = Call "POST" "/tickets/$id1/resolve" $HT2 @{ comment = "Replaced the cable, tested OK" }
Check "resolve with a comment -> 200" ($ok.Status -eq 200) "(status $($ok.Status))"
Check "status is now Resolu" ($ok.Body.ticket.status -like "R*solu")
Check "BR3: resolved_at is saved" ($null -ne $ok.Body.ticket.resolved_at)
Check "the comment is returned" ($ok.Body.comment.content -eq "Replaced the cable, tested OK")
Check "technician 2 counter went from 1 to 0" ([int]$ok.Body.active_count -eq 0) "(counter = $($ok.Body.active_count))"
$meT2 = Call "GET" "/me" $HT2
Check "GET /me confirms the counter is 0" ([int]$meT2.Body.active_count -eq 0)

$r = Call "POST" "/tickets/$id1/resolve" $HT2 @{ comment = "second time" }
Check "resolve a ticket that is already resolved -> 409" ($r.Status -eq 409) "(status $($r.Status))"

$mine = Call "GET" "/tickets/mine" $HU
$row = @($mine.Body | Where-Object { $_._id -eq $id1 })[0]
Check "the user sees the ticket as resolved" ($row.status -like "R*solu")
Check "the user sees the comment on the ticket" (@($row.comments).Count -eq 1 -and $row.comments[0].content -eq "Replaced the cable, tested OK")
$list = Call "GET" "/tickets" $HT2
$row = @($list.Body | Where-Object { $_._id -eq $id1 })[0]
Check "the technician list also shows the comment" (@($row.comments).Count -eq 1)

# Second half of T2: a technician at 5/5 can take a ticket again once one is resolved
if ($room -gt 0) {
  $res = Call "POST" "/tickets/$($ids[0])/resolve" $HT @{ comment = "Resolved by test-api.ps1" }
  Check "technician 1 resolves one of its 5 tickets -> 200" ($res.Status -eq 200) "(status $($res.Status))"
  Check "technician 1 counter went from 5 to 4" ([int]$res.Body.active_count -eq 4) "(counter = $($res.Body.active_count))"
  $again = Call "PATCH" "/tickets/$($ids[$room])/take" $HT
  Check "T2: allowed again after one is resolved -> 200" ($again.Status -eq 200) "(status $($again.Status))"
  $me = Call "GET" "/me" $HT
  Check "technician 1 is back to 5/5" ([int]$me.Body.active_count -eq 5) "(counter = $($me.Body.active_count))"
} else {
  Write-Host "[SKIP] T2 second half (technician 1 had no ticket taken during this run)" -ForegroundColor Yellow
}

# ---------------------------------------------------------------- 6.6
Write-Host ""
Write-Host "== 6.6 Close and reopen ==" -ForegroundColor Cyan

# A second user (registered and approved in the 6.10 / 6.11 tests) is used for the "other owner" tests
$u2 = Call "POST" "/login" @{} @{ email = $emailA; password = $pw }
$HU2 = Auth $u2.Body.token

$c0 = NewTicket $HU "AUTO-TEST close 0 (not resolved)"
$c1 = NewTicket $HU "AUTO-TEST close 1"
$c2 = NewTicket $HU "AUTO-TEST close 2 (old)"
$c0id = $c0.Body._id
$c1id = $c1.Body._id
$c2id = $c2.Body._id

$r = Call "PATCH" "/tickets/$c0id/close" $HU
Check "T7: close a ticket that is not resolved -> 409" ($r.Status -eq 409) "(status $($r.Status))"
$r = Call "PATCH" "/tickets/$c0id/reopen" $HU
Check "reopen a ticket that is not resolved -> 409" ($r.Status -eq 409) "(status $($r.Status))"

# c1: taken and resolved by technician 2
$null = Call "PATCH" "/tickets/$c1id/take" $HT2
$res = Call "POST" "/tickets/$c1id/resolve" $HT2 @{ comment = "Fixed for the close test" }
Check "technician 2 resolves the ticket to close -> 200" ($res.Status -eq 200) "(status $($res.Status))"

$r = Call "PATCH" "/tickets/$c1id/close" $HU2
Check "T6: another user cannot close the ticket -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "PATCH" "/tickets/$c1id/reopen" $HU2
Check "T6: another user cannot reopen the ticket -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "PATCH" "/tickets/$c1id/close" $HT2
Check "a technician cannot close -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "PATCH" "/tickets/$c1id/reopen" $HA
Check "an admin cannot reopen -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "PATCH" "/tickets/$c1id/close" @{}
Check "close without token -> 401" ($r.Status -eq 401) "(status $($r.Status))"
$r = Call "PATCH" "/tickets/abc/close" $HU
Check "invalid ticket id -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "PATCH" "/tickets/000000000000000000000000/reopen" $HU
Check "unknown ticket -> 404" ($r.Status -eq 404) "(status $($r.Status))"

$re = Call "PATCH" "/tickets/$c1id/reopen" $HU
Check "owner reopens a ticket resolved less than 7 days ago -> 200" ($re.Status -eq 200) "(status $($re.Status))"
Check "reopened: status Ouvert" ($re.Body.ticket.status -eq "Ouvert")
Check "reopened: technician removed (Q1)" ($null -eq $re.Body.ticket.technician_id)
Check "reopened: resolved_at cleared" ($null -eq $re.Body.ticket.resolved_at)
$meT2 = Call "GET" "/me" $HT2
Check "reopening does not change the technician counter" ([int]$meT2.Body.active_count -eq 0) "(counter = $($meT2.Body.active_count))"
$r = Call "PATCH" "/tickets/$c1id/close" $HU
Check "a reopened ticket (Ouvert) cannot be closed -> 409" ($r.Status -eq 409) "(status $($r.Status))"

# resolve it again, then close it
$null = Call "PATCH" "/tickets/$c1id/take" $HT2
$null = Call "POST" "/tickets/$c1id/resolve" $HT2 @{ comment = "Fixed again" }
$cl = Call "PATCH" "/tickets/$c1id/close" $HU
Check "owner closes a resolved ticket -> 200" ($cl.Status -eq 200) "(status $($cl.Status))"
Check "closed: status Fermé" ($cl.Body.ticket.status -like "Ferm*")
Check "closed: closed_at is saved" ($null -ne $cl.Body.ticket.closed_at)
$r = Call "PATCH" "/tickets/$c1id/reopen" $HU
Check "Q4: a closed ticket cannot be reopened -> 409" ($r.Status -eq 409) "(status $($r.Status))"
$r = Call "PATCH" "/tickets/$c1id/close" $HU
Check "close a ticket that is already closed -> 409" ($r.Status -eq 409) "(status $($r.Status))"

# T5: age the resolution date by 8 days. It needs mongosh in the PATH (installed with MongoDB).
$null = Call "PATCH" "/tickets/$c2id/take" $HT2
$null = Call "POST" "/tickets/$c2id/resolve" $HT2 @{ comment = "Fixed, will be too old" }
if (Get-Command mongosh -ErrorAction SilentlyContinue) {
  $js = "db.tickets.updateOne({ _id: ObjectId('$c2id') }, { `$set: { resolved_at: new Date(Date.now() - 8*24*3600*1000) } })"
  & mongosh "mongodb://127.0.0.1:27017/helpdesk" --quiet --eval $js | Out-Null
  $r = Call "PATCH" "/tickets/$c2id/reopen" $HU
  Check "T5: reopen a ticket resolved more than 7 days ago -> 409" ($r.Status -eq 409 -and $r.Body.error -like "*7 days*") "(status $($r.Status))"
} else {
  Write-Host "[SKIP] T5 needs mongosh in the PATH to make a ticket 8 days old (see README, manual test)" -ForegroundColor Yellow
}

# ---------------------------------------------------------------- 6.7
Write-Host ""
Write-Host "== 6.7 Kanban filters (combined) ==" -ForegroundColor Cyan

$techId = $meT2.Body.id
$kb = Call "POST" "/tickets" $HU @{ title = "AUTO-TEST kanban high"; description = "x"; category = "network"; priority = "high" }
$kbId = $kb.Body._id
$kbOpen = Call "POST" "/tickets" $HU @{ title = "AUTO-TEST kanban high open"; description = "x"; category = "network"; priority = "high" }
$kbOpenId = $kbOpen.Body._id
$null = Call "PATCH" "/tickets/$kbId/take" $HT2
$enCours = [uri]::EscapeDataString("En cours")

$all = Call "GET" "/tickets" $HT
Check "no filter -> 200 and a list" ($all.Status -eq 200 -and @($all.Body).Count -gt 0) "(status $($all.Status))"
$empty = Call "GET" "/tickets?status=&priority=&technician=" $HT
Check "empty filter values are ignored (same list)" ($empty.Status -eq 200 -and @($empty.Body).Count -eq @($all.Body).Count)

$f = Call "GET" "/tickets?status=Ouvert" $HT
Check "filter by status -> only Ouvert tickets" ($f.Status -eq 200 -and @($f.Body | Where-Object { $_.status -ne "Ouvert" }).Count -eq 0)
$f = Call "GET" "/tickets?priority=high" $HT
Check "filter by priority -> only high tickets" ($f.Status -eq 200 -and @($f.Body | Where-Object { $_.priority -ne "high" }).Count -eq 0)
$f = Call "GET" "/tickets?technician=$techId" $HT
Check "filter by technician -> only tickets of this technician" ($f.Status -eq 200 -and @($f.Body).Count -gt 0 -and @($f.Body | Where-Object { $_.technician_id._id -ne $techId }).Count -eq 0)

$f = Call "GET" "/tickets?status=Ouvert&priority=high" $HT
$ids2 = @($f.Body | ForEach-Object { $_._id })
Check "status + priority combined: the open high ticket is there" ($ids2 -contains $kbOpenId)
Check "status + priority combined: the taken high ticket is not there" (-not ($ids2 -contains $kbId))
Check "status + priority combined: every ticket matches both" (@($f.Body | Where-Object { $_.status -ne "Ouvert" -or $_.priority -ne "high" }).Count -eq 0)

$f = Call "GET" "/tickets?status=$enCours&priority=high&technician=$techId" $HT
$ids3 = @($f.Body | ForEach-Object { $_._id })
Check "status + priority + technician combined: the ticket is there" ($f.Status -eq 200 -and ($ids3 -contains $kbId))
Check "status + priority + technician combined: every ticket matches all three" (@($f.Body | Where-Object { $_.status -ne "En cours" -or $_.priority -ne "high" -or $_.technician_id._id -ne $techId }).Count -eq 0)

$f = Call "GET" "/tickets?status=Ouvert&priority=high&technician=$techId" $HT
Check "T9: filters with no match -> 200 and an empty list" ($f.Status -eq 200 -and @($f.Body).Count -eq 0) "(status $($f.Status))"

$r = Call "GET" "/tickets?technician=abc" $HT
Check "invalid technician id -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "GET" "/tickets?status=Nope" $HT
Check "invalid status value -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "GET" "/tickets?priority=critical" $HT
Check "invalid priority value -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "GET" "/tickets?status%5B%24ne%5D=Ouvert" $HT
Check "NoSQL injection in a filter -> 400" ($r.Status -eq 400) "(status $($r.Status))"
$r = Call "GET" "/tickets?status=Ouvert" $HU
Check "a user cannot use the filters -> 403" ($r.Status -eq 403) "(status $($r.Status))"

$tl = Call "GET" "/technicians" $HT
$tlIds = @($tl.Body | ForEach-Object { $_._id })
Check "technician list for the filter -> 200 and contains technician 2" ($tl.Status -eq 200 -and ($tlIds -contains $techId))
$r = Call "GET" "/technicians" $HU
Check "T8: a user cannot get the technician list -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "GET" "/technicians"
Check "technician list without token -> 401" ($r.Status -eq 401) "(status $($r.Status))"

# ---------------------------------------------------------------- 6.8
Write-Host ""
Write-Host "== 6.8 Statistics ==" -ForegroundColor Cyan

$r = Call "GET" "/stats" $HU
Check "T8: a user cannot get the statistics -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "GET" "/stats" $HT
Check "T8: a technician cannot get the statistics -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "GET" "/stats/technicians" $HU
Check "T8: a user cannot get the technician activity -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "GET" "/stats/technicians" $HT
Check "T8: a technician cannot get the technician activity -> 403" ($r.Status -eq 403) "(status $($r.Status))"
$r = Call "GET" "/stats"
Check "statistics without token -> 401" ($r.Status -eq 401) "(status $($r.Status))"

$st1 = Call "GET" "/stats" $HA
Check "admin gets the statistics -> 200" ($st1.Status -eq 200) "(status $($st1.Status))"
Check "the 4 statuses are always present" (@($st1.Body.by_status.PSObject.Properties).Count -eq 4)
Check "the 3 categories are always present" (@($st1.Body.by_category.PSObject.Properties).Count -eq 3)
$sumStatus = ($st1.Body.by_status.PSObject.Properties | Measure-Object -Property Value -Sum).Sum
$sumCategory = ($st1.Body.by_category.PSObject.Properties | Measure-Object -Property Value -Sum).Sum
Check "tickets per status add up to the total" ($sumStatus -eq $st1.Body.total) "($sumStatus / $($st1.Body.total))"
Check "tickets per category add up to the total" ($sumCategory -eq $st1.Body.total) "($sumCategory / $($st1.Body.total))"
Check "BR7: resolved tickets exist and the average is a number >= 0" ([int]$st1.Body.resolved_count -ge 1 -and [double]$st1.Body.average_resolution_hours -ge 0)

$null = NewTicket $HU "AUTO-TEST stats"
$st2 = Call "GET" "/stats" $HA
Check "a new ticket adds 1 to the total" ([int]$st2.Body.total -eq ([int]$st1.Body.total + 1))
Check "a new ticket adds 1 to Ouvert" ([int]$st2.Body.by_status.Ouvert -eq ([int]$st1.Body.by_status.Ouvert + 1))

$emailT2 = "autotest-t2-$stamp@school.tn"
$null = Call "POST" "/technicians" $HA @{ name = "AUTO-TEST Idle Tech"; email = $emailT2; password = $pw }
$act = Call "GET" "/stats/technicians" $HA
Check "admin gets the technician activity -> 200" ($act.Status -eq 200) "(status $($act.Status))"
Check "the technician activity has no password hash" (($act.Body | ConvertTo-Json -Depth 4) -notlike "*password*")
$rowIdle = @($act.Body | Where-Object { $_.email -eq $emailT2 })[0]
Check "T12: a technician with no ticket is listed with zeros" ($null -ne $rowIdle -and [int]$rowIdle.active_count -eq 0 -and [int]$rowIdle.resolved_last_7_days -eq 0)
Check "T12: the last action of a technician with no ticket is empty" ($null -eq $rowIdle.last_action)
$rowWork = @($act.Body | Where-Object { $_.email -eq $emailT })[0]
Check "an active technician shows resolved tickets (7 days) and a last action" ($null -ne $rowWork -and [int]$rowWork.resolved_last_7_days -ge 1 -and $null -ne $rowWork.last_action)
$rowTech1 = @($act.Body | Where-Object { $_.email -eq "tech@school.tn" })[0]
Check "technician 1 shows its counter as n/5" ($null -ne $rowTech1 -and [int]$rowTech1.max_active -eq 5)

Write-Host "[NOTE] T10 (no resolved ticket, average shown as 0) needs an empty database: see README, manual test." -ForegroundColor Yellow

# ---------------------------------------------------------------- summary
Write-Host ""
$color = "Green"
if ($script:Fail -gt 0) { $color = "Red" }
Write-Host "Result: $($script:Pass) passed, $($script:Fail) failed" -ForegroundColor $color
Write-Host "Clean the test data with: mongosh ""mongodb://127.0.0.1:27017/helpdesk"" --file tests/reset-test-data.js"
if ($script:Fail -gt 0) { exit 1 }
