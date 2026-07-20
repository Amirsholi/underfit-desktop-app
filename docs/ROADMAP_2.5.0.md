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

- Instructor sign-in and sign-out.
- Fast member lookup and attendance registration as separate actions.
- Read-only member details.
- Stock table and a minimal member-associated sale flow.
- Pending-operation visibility and clear connection status.

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
