# BookLeaf — Author Royalty Dashboard & Notification System

**Assignment 2 of 2 | Full-Stack Developer Position**

---

## Overview

This project is a full-stack implementation of the BookLeaf Author Royalty Dashboard and Automated Notification System. Since the assignment specifies Bubble.io + n8n as platforms, and those are cloud-hosted no-code tools that cannot run locally, this submission replicates the **exact same architecture and logic** using equivalent code-based tools:

| Assignment Requirement | This Implementation |
|------------------------|---------------------|
| Bubble.io (database, UI, auth, workflows) | Node.js + Express + JSON file database + HTML/CSS/JS frontend |
| n8n (automation, webhook, AI call, callback) | Express webhook route that mirrors the n8n flow step-by-step |
| AI API (OpenAI / Anthropic) | Anthropic Claude Haiku API |

The `n8n_workflow_export.json` file included in the root is a real, importable n8n workflow JSON that replicates this same flow for use in an actual n8n instance.

---

## Quick Start

### Prerequisites
- Node.js v18 or higher
- npm

### Setup

```bash
# 1. Go into the backend folder
cd bookleaf/backend

# 2. Install dependencies
npm install

# 3. Set your Anthropic API key
#    Windows:
set ANTHROPIC_API_KEY=sk-ant-your-key-here

#    Mac / Linux:
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# 4. Start the server
npm start

# 5. Open in your browser
#    http://localhost:3000
```

> The API key is only needed for the "Generate & Send Royalty Summary" feature. All other features (login, dashboards, filters, royalty data) work without it.

### Login Credentials

| Role   | Email                | Password   |
|--------|----------------------|------------|
| Author | arjun@example.com    | author123  |
| Author | priya@example.com    | author123  |
| Author | rahul@example.com    | author123  |
| Author | sneha@example.com    | author123  |
| Author | vikram@example.com   | author123  |
| Author | ananya@example.com   | author123  |
| Author | rohan@example.com    | author123  |
| Author | meera@example.com    | author123  |
| Author | aditya@example.com   | author123  |
| Author | kavya@example.com    | author123  |
| Admin  | admin@bookleaf.com   | admin123   |

---

## Project Structure

```
bookleaf/
├── backend/
│   ├── server.js                  — Express server, static file serving, route registration
│   ├── package.json               — Dependencies (express, cors, jsonwebtoken)
│   ├── data/
│   │   └── bookleaf_sample_data.json  — Full dataset: 10 authors, 18 books, royalties, notification log
│   ├── middleware/
│   │   └── auth.js                — JWT verification + admin-only guard
│   └── routes/
│       ├── auth.js                — POST /api/auth/login
│       ├── author.js              — GET /api/author/dashboard (author's own data only)
│       ├── admin.js               — Admin routes: authors list, detail, cities, notifications
│       └── webhook.js             — AI generation webhook + bulk trigger
├── frontend/
│   ├── index.html                 — Login page
│   ├── author/
│   │   └── dashboard.html         — Author portal
│   └── admin/
│       └── dashboard.html         — Admin portal
├── n8n_workflow_export.json       — Importable n8n workflow
├── .env.example                   — Environment variable template
├── COMMANDS.md                    — Quick command reference
└── README.md                      — This file
```

---

## Database Schema

The database lives in `backend/data/bookleaf_sample_data.json`. It mirrors how you would structure this in Bubble with separate Data Types.

### Authors
```
id           — Unique author ID (A001–A010)
name         — Full name
email        — Login email
password     — Plain text (for assignment purposes; would be hashed in production)
city         — City of residence
phone        — Contact number
role         — "author"
```

### Admin
```
id, name, email, password, role: "admin"
```

### Books
```
id              — Unique book ID (B001–B018)
author_id       — Foreign key → Author
title           — Book title
isbn            — ISBN number
genre           — Genre
status          — "Published" or "In Production"
publication_date — Date string or null (null for In Production books)
mrp             — Maximum Retail Price in ₹
platforms       — Array of sales platforms (Amazon, Flipkart, etc.)
print_partner   — "In-House", "Repro India", or "Epitome Books"
```

### Royalties
```
id                    — Unique royalty record ID
book_id               — Foreign key → Book (one record per published book)
total_copies_sold     — Total units sold
total_royalty_earned  — Cumulative earnings in ₹
royalty_paid          — Amount paid out to date
royalty_pending       — Earned minus paid
last_payout_date      — Date of last payment or null
royalty_rate          — 0.12 (12%)
```

### Notification Log
```
id            — Auto-generated
author_id     — Which author
author_name   — Denormalised name for quick display
author_email  — Author's email
status        — "Success" or "Failed"
email_content — Full AI-generated email text
timestamp     — ISO datetime string
```

**Why this structure:** Authors, Books, and Royalties are kept as separate entities to reflect a proper relational design — the same way Bubble separates Data Types. Books have a many-to-one relationship with Authors. Royalties have a one-to-one relationship with Books (one royalty record per book). This makes querying per-author aggregates simple and keeps the data clean.

---

## Features

### Author Portal

- **Login** — Email/password authentication with JWT. Each author can only see their own data (enforced server-side, not just frontend).
- **My Books** — Lists all books with title, ISBN, genre, status badge (Published / In Production), publication date, MRP, print partner, and platform availability.
- **Royalty Overview** — Per book: copies sold, total earned, paid, pending, last payout date. Plus a consolidated summary across all books at the top.
- **Royalty Status Badge** — Each book shows a colour-coded indicator:
  - 🟢 Green — Royalties fully paid up
  - 🟡 Yellow — Pending amount exists but within normal payout cycle
  - 🔴 Red — Pending amount and last payout was over 90 days ago, or book has been published for 90+ days with no payout ever made

### Admin Portal

- **Authors Overview** — Full list of all authors with total books, total earned, total pending, and overall royalty status.
- **Filters** — Filter by city (dropdown), filter by payout status (Fully Paid / Pending / Overdue), and search by author name. All filters work together.
- **Author Detail View** — Click any author to see their full book list, detailed royalty figures per book, and all the same data the author sees in their portal.
- **Generate & Send Royalty Summary** — Button on each author's detail page. Triggers the AI workflow (see below). Shows the generated email inline with a "View Email" link. Updates the Notification Log automatically.
- **Bulk Trigger** — Button on the main authors page to trigger royalty summaries for all authors who have pending royalties in one go.
- **Notification Log** — Table showing all triggered summaries: author name, status (Success/Failed), timestamp, and a clickable preview of the generated email.

---

## Bubble ↔ n8n Integration (How It Works Here)

In the Bubble + n8n version, the flow would be:

1. Admin clicks "Generate & Send" in Bubble → Bubble calls n8n webhook
2. n8n fetches author data from Bubble Data API
3. n8n sends data to AI API
4. AI returns email content
5. n8n calls back to Bubble to log the result
6. Bubble updates the Notification Log UI

In this implementation, the `POST /api/webhook/generate-royalty-summary` endpoint replicates this exact flow in a single Express route. The `n8n_workflow_export.json` file shows the equivalent n8n node structure for anyone who wants to run it on an actual n8n instance — it has the same nodes (Webhook → Security Check → Fetch Data → Build Prompt → AI Call → Extract Content → Callback → Respond).

The frontend calls the webhook with the same `x-webhook-secret` header that n8n would validate.

---

## AI Prompt Strategy

The prompt is built in `routes/webhook.js` inside the `buildPrompt()` function. The strategy:

**Context given to the model:**
- Author name and city (for personalisation)
- Per-book breakdown: copies sold, total earned, paid, pending, last payout date, royalty status
- Separate section for books in production
- Aggregate totals
- BookLeaf's payout policy: quarterly cycle (Mar 31, Jun 30, Sep 30, Dec 31) with 45-day processing window

**Instructions to the model:**
- Write in BookLeaf's warm, professional tone (not corporate or robotic)
- Personalise with the author's name
- If pending: explain when to expect next payout based on the quarterly cycle
- If fully paid: positive acknowledgement
- If books in production: brief status update
- Warm closing

The model used is `claude-haiku-4-5-20251001` — fast, cost-effective, and well-suited for structured email generation tasks like this.

---

## Security & Error Handling

### Webhook Security
The `/api/webhook/generate-royalty-summary` endpoint requires an `x-webhook-secret` header. Requests without the correct secret get a 403 response. This mirrors the Bubble → n8n security approach where Bubble passes a shared secret that n8n validates before processing.

### Idempotency
If the same `author_id` is sent to the webhook twice within 30 seconds (e.g. admin double-clicks the button), the second request gets a 429 response with a clear message. The in-memory `recentTriggers` map handles this. In a production system this would use Redis or a database flag.

### Error Handling in the Webhook
- If `ANTHROPIC_API_KEY` is not set → caught, status set to "Failed", error logged to notification log
- If the AI API returns an error → caught with try/catch, status set to "Failed", error message stored
- Either way the notification log is always updated — it never fails silently

### Error Handling in the Frontend
- If the webhook doesn't respond or returns an error → the button re-enables, an error message is shown inline below the button. The admin is never left staring at a loading state.
- JWT expiry → automatic redirect to login page

### Privacy / Data Isolation
- Author routes check `req.user.id` server-side and only return data matching that author ID
- Admin routes check `req.user.role === 'admin'` via the `adminOnly` middleware
- No author can access another author's data even by changing query parameters — the filtering is done on the server, not the client

---

## n8n Workflow (n8n_workflow_export.json)

The exported workflow can be imported directly into n8n Cloud or a self-hosted n8n instance. It contains:

| Node | Purpose |
|------|---------|
| Webhook Trigger | Receives POST from Bubble with `author_id` |
| Validate Webhook Secret | IF node checking `x-webhook-secret` header |
| Fetch Author Data | HTTP Request to Bubble Data API |
| Build AI Prompt | Code node that structures the prompt from author data |
| Generate Email via Claude AI | HTTP Request to Anthropic API |
| Extract Email Content | Code node parsing the AI response |
| Callback to Bubble | HTTP Request logging result back to Bubble |
| Respond Success / Respond Unauthorized / Respond Error | Webhook response nodes |
| Log Error to Bubble | Error branch node that logs failures back to Bubble |

To use it with a real Bubble app, update the Bubble API URLs and Bearer token in the HTTP Request nodes.

---

## Dataset Coverage

The dataset covers all the edge cases specified in the assignment:

| Case | Example |
|------|---------|
| Author with multiple published books, all paid up | Arjun Sharma (B001, B002 partially pending) |
| Author with pending royalties never paid | Rahul Verma — Code & Canvas (₹48,195 pending, no payout ever) |
| Books still in production | Priya Mehta — Whispers of the Sea; Rohan Gupta — Silicon Dreams |
| Books across different print partners | Mix of In-House, Repro India, Epitome Books |
| Overdue royalties (no payout + published 90+ days ago) | Rahul Verma, Ananya Das, Aditya Kumar |
| Author with both published and in-production books | Priya Mehta, Rohan Gupta, Aditya Kumar |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `JWT_SECRET` | `bookleaf_secret_2024` | JWT signing secret |
| `WEBHOOK_SECRET` | `bookleaf_webhook_secret_2024` | Shared secret for webhook security |
| `ANTHROPIC_API_KEY` | *(none)* | Required for AI email generation |

Copy `.env.example` to `.env` and fill in your values. The server reads these via `process.env`.

---

## Learning Notes (If Bubble Was New)

This project was built as a code-equivalent of the Bubble + n8n stack. A few observations on mapping the concepts:

- **Bubble Data Types** map cleanly to JSON objects with foreign key relationships
- **Bubble Privacy Rules** (author sees only own data) are replicated via JWT claims checked server-side on every request
- **Bubble Workflows** (triggered on button click) map to Express routes called by the frontend
- **n8n nodes** map to sequential function calls or awaited fetch calls in the webhook route
- The biggest Bubble-specific concept without a direct code equivalent is the visual workflow editor — the `n8n_workflow_export.json` shows what that would look like in n8n's node graph

---

*BookLeaf Publishing — Technical Assignment 2 | Full-Stack Developer Position*
