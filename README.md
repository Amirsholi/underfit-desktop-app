# Under-Fit Desktop

Production desktop application for daily gym operations, built with Electron, Node.js, and SQLite.

Under-Fit was developed for a real gym that needed a fast local system for member access, memberships, product sales, daily cash control, PDF reports, and backups. The main product decision was to keep the workflow simple enough for front-desk use while still covering the operational controls the business needed every day.

## Project Status

- Current version: `2.5.0` (development branch)
- Product name: `Under-Fit`
- Platform: Windows desktop
- Status: deployed in a real operational environment
- Public demo installer: planned for a future restricted demo version

Screenshots and walkthrough videos are available in the related Upwork portfolio item. Production data is private and is not included in this repository.

## What It Solves

Many small gyms run daily operations through a mix of paper notes, spreadsheets, chat messages, and manual checks. Under-Fit centralizes the core workflow in a local desktop app:

- Check whether a member can enter.
- Register member entries.
- Create and update member records.
- Renew memberships.
- Register product sales.
- Track basic product stock.
- Manage daily cash movements.
- Generate daily closing reports.
- Create manual and automatic backups.

The app is intentionally not a complex ERP. It is designed for quick, repeated use at the front desk.

## Core Features

- Member management and administrative editing.
- Membership renewals for monthly, quarterly, and semiannual plans.
- Access validation and entry logging.
- Product management with SQLite persistence.
- Product sales with payment method tracking.
- Daily cash session workflow.
- Daily closing report exported as PDF.
- Weekly automatic backups.
- Manual backups from the settings screen.
- Local database path resolution for installed Windows environments.

## Technical Stack

- Electron
- Node.js
- SQLite
- JavaScript
- HTML/CSS
- electron-builder

## Architecture

- `main.js`: Electron startup, windows, and initialization sequence.
- `config.js`: local database path resolution.
- `migrations.js`: SQLite schema creation and upgrades.
- `ipcHandlers.js`: IPC handler registration.
- `handlers/`: IPC boundary grouped by domain.
- `services/`: business logic.
- `repositories/`: SQLite data access layer.
- `renderer.js` and `admin*.js`: administrative UI behavior.
- `user.html`: front-desk member entry screen.

## Data And Backups

- Default database path: `C:\Users\<user>\GymAppData\gym.db`
- Backup folder: `backups` next to the database file.

The database location is resolved automatically per Windows user, so the gym operator does not need to configure absolute paths manually.

Related operational docs:

- [Deployment checklist](docs/DEPLOY_CHECKLIST.md)
- [Backup and restore guide](docs/BACKUP_RESTORE.md)
- [Release notes 2.1.0](docs/RELEASE_2.1.0.md)
- [Client update message](docs/CLIENT_MESSAGE_2.1.0.md)
- [Case study](docs/CASE_STUDY.md)

## Local Development

```bash
npm install
npm start
```

## Build

```bash
npm run rebuild
npm run build
```

The Windows installer is generated in `dist/` using the artifact name configured in `package.json`.

## Demo And Privacy Notes

This repository is public as a portfolio and code sample. Real business data, private client information, and production database files are not included.

A restricted demo build is planned for later so the application can be shared safely without exposing production workflows or private data.
