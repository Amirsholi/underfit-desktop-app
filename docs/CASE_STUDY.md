# Under-Fit Desktop - Case Study

## Summary

Under-Fit is a desktop management system built for a real gym that needed a practical way to manage daily front-desk operations without depending on cloud software or complex administrative workflows.

The application was built with Electron, Node.js, and SQLite, then packaged as a Windows desktop app for local use.

## Business Context

The gym needed a system that could support daily operations such as member entry, membership renewals, product sales, cash control, and backups. The most important requirement was speed and simplicity: the front desk needed to register common actions quickly without navigating a complicated ERP-style interface.

Because the app is used in a real operational environment, reliability and data safety were more important than adding unnecessary features.

## Main Goals

- Keep member lookup and access validation fast.
- Support membership renewals with clear plan rules.
- Register product sales without slowing down the front desk.
- Track daily cash movements and payment methods.
- Generate daily closing reports.
- Store data locally in SQLite.
- Provide manual and automatic backups.
- Make installation and updates manageable on Windows.

## Solution

Under-Fit centralizes the gym's core workflow in a local Electron application. The system uses SQLite for persistence and separates business logic, data access, and UI behavior into distinct modules.

The interface was designed around the real workflow of the gym:

- A front-desk screen for access checks.
- An admin area for members, memberships, products, sales, and cash.
- Backup and operational tools for safer updates.
- PDF closing reports for end-of-day review.

## Key Product Decisions

### Simple Stock Handling

The product module intentionally keeps stock simple. The gym does not need a full inventory system; it needs quick product creation, sale registration, and basic stock visibility. Adding a more complex stock workflow would slow down the operator and create unnecessary friction.

### Local-First Desktop App

Electron and SQLite were chosen because the gym needed a local Windows application with predictable behavior and no dependency on a browser session or external hosting.

### Operational Documentation

The project includes deployment, backup, restore, and release notes because the handoff process matters as much as the code for this kind of business software.

## Implemented Features

- Member creation and editing.
- Membership renewal rules.
- Access validation.
- Entry logging.
- Product creation and editing.
- Product sales.
- Payment method tracking.
- Daily cash session management.
- Daily closing PDF export.
- Manual backup.
- Weekly automatic backup.
- SQLite migrations.
- Windows installer build configuration.

## Technical Stack

- Electron
- Node.js
- SQLite
- JavaScript
- HTML/CSS
- electron-builder

## Results

Under-Fit is currently used as a real operational tool. The project demonstrates how a small business workflow can be translated into a focused desktop app that prioritizes speed, reliability, local data ownership, and simple handoff.

## Privacy

Screenshots and videos use prepared or non-sensitive data for portfolio presentation. Real gym data and production database files are private and are not included in this repository.

## Future Demo Version

A restricted demo build is planned for future portfolio sharing. The goal is to let prospects inspect the product safely while limiting sensitive or production-specific functionality.
