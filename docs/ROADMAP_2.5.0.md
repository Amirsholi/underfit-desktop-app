# Under-Fit 2.5.0 Roadmap

## Current operation

The main location currently runs one reception PC with two displays: the administrative interface and the member-entry kiosk with a numeric keypad.

## Confirmed expansion

- The second location is a functional-training room operated from a tablet.
- Members, memberships and business data are shared between locations.
- The main location assigns stock to the second location.
- The instructor signs in, sees stock and members, can open a read-only member profile, records attendance and sends product sales to the main location for collection.
- A tablet sale must be associated with a member. It remains pending and does not affect cash until reception records payment.
- The owner decides how to resolve unpaid sales; cancellations and corrections remain auditable.
- Administration at the main location can enroll members in classes.

## Delivery phases

### Implemented foundation in the current cut

- Professor catalog with a four-digit PIN stored as a salted hash.
- One active professor session per tablet/device, with explicit start and end timestamps.
- Classes reference the selected professor while preserving the readable name on historical records.
- Pending Local 2 sales preserve the professor and the exact tablet session that created them.
- Reception can create, edit, deactivate and assign professors from the Classes page.
- Under Running keeps its countdown identity, but access confirmation is immediate and uses neutral gym-entry copy instead of a running-specific transition.

### 1. Cash integrity

- Correct manual income and cash-output movements through an auditable annulment and replacement.
- Support cash or bank-transfer outputs.
- Keep totals and closure PDF coherent after corrections.
- Group closure totals by membership operation and individual product.

### 2. Navigation and roles

- Separate Users, Cash, Access records, Products, Classes and Settings.
- Add staff identity, sign-in, roles and audit records.
- Preserve the dedicated kiosk surface used on the second display.

### 3. Multi-location data model

- Add locations and location-aware attendance, stock and sales.
- Separate the product catalog from stock per location.
- Add stock assignments/transfers initiated by the main location.
- Add pending sales associated with members and their collection lifecycle.

### 4. Central service

- Replace direct multi-device access to SQLite with a central API and database.
- Adapt the Electron administration and kiosk clients to the API.
- Add authentication, authorization, backups, concurrency protection and operational logs.

### 5. Tablet workflow

- Instructor signs in once at the beginning of the class block and signs out when leaving; the session must not interrupt student check-in.
- After sign-in, the tablet stays in attendance mode: students type their CI, receive immediate confirmation and the numeric pad clears itself for the next person.
- The current class is selected automatically from the recurring schedule (for example, Monday/Wednesday/Friday at 20:00), with a small manual override for exceptional changes.
- Product sale is a short instructor-only detour: product, member, quantity and send. After sending, the tablet returns to attendance mode automatically.
- Fast member lookup and attendance registration remain separate from administrative editing.
- Read-only member details.
- Stock is visible as a compact reference; stock assignment remains exclusive to the main location.
- Every tablet sale is member-associated, tagged with location and instructor, and sent as pending collection to the main location.
- Pending-operation visibility and clear connection status, with a local retry queue that prevents duplicate attendance or sales after a temporary network loss.

#### Tablet interaction budget

- Student check-in: CI plus one confirmation, then automatic reset.
- Normal product sale: no more than four decisions (product, member, quantity, send).
- The instructor should not need to reselect the current class, location or own identity during an active session.
- Destructive or corrective actions stay in administration; the tablet only creates attendance and pending sales.

### 6. Classes

- Class types, schedules, capacity and instructor assignment.
- Enrollment from the main location.
- Tablet attendance list for the instructor.
- Cancellation, waitlist and attendance history rules.

### 7. Pilot and future expansion

- Pilot both locations, concurrent activity and closure behavior.
- Test network loss, backup restoration and stock reconciliation.
- Keep location identifiers and permissions general enough for additional branches.

## Architecture direction

Do not open one SQLite file concurrently from multiple devices. Use a central API as the only writer to a shared database. Electron remains suitable for the reception and kiosk experience; the tablet surface should be a touch-first installable web application. This allows the existing desktop operation to evolve without rewriting every interface at once.

The API should require an idempotency key for attendance, stock transfers, pending sales and collection. Every business event must include `locationId`, `staffId`, timestamp and device identifier. Pending sales are commercial commitments but never cash movements: only collection at the main location creates the final sale and cash entry. Stock transfer and collection should run inside database transactions so simultaneous use from both locations cannot create negative stock or duplicate charges.
