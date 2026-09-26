# Service Request & Ticket Management System

A lightweight support ticket management prototype for handling, prioritizing, assigning, and analyzing service requests. 

DEMO URL: https://service-request-ticket-system-aspir.vercel.app/workload

## Features

- Operations dashboard with ticket metrics
- Ticket creation, search, filtering, assignment, and status management
- Automatic priority scoring based on severity, customer tier, SLA urgency, sentiment, repeat tickets, and escalation
- SLA calculation and tracking
- Rule-based agent recommendations using skills, experience, workload, and urgency
- Customer and agent information
- Agent workload monitoring
- Analytics for ticket trends, categories, resolution time, and SLA performance
- Configurable priority weights and agent settings
- Browser-based data persistence using `localStorage`
- No authentication required

## Data

Initial data is provided through `src/data/seed.json`:

- 626 customers
- 99 agents
- 680 tickets
- 1,351 activity records

## Priority Model

Default weights:

| Factor | Weight |
|---|---:|
| Severity | 35% |
| SLA Urgency | 30% |
| Customer Tier | 15% |
| Sentiment | 10% |
| Repeat Tickets | 5% |
| Escalation | 5% |

Priority levels: **High (70–100), Medium (40–69), Low (<40)**.

## SLA

| Severity | Base SLA |
|---|---:|
| Critical | 8 hours |
| High | 24 hours |
| Medium | 48 hours |
| Low | 72 hours |

SLA status includes On Track, At Risk, Breached, Met, and Missed.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- TanStack Router
- Recharts
- Lucide React
- localStorage
- JSON seed data
- Build tool: Lovable

## Project Structure

```text
src/
├── components/
├── data/
│   └── seed.json
├── hooks/
├── lib/
│   ├── db.ts
│   ├── store.tsx
│   └── utils.ts
├── routes/
│   ├── dashboard.tsx
│   ├── tickets.new.tsx
│   ├── tickets.$id.tsx
│   ├── analytics.tsx
│   ├── workload.tsx
│   └── settings.tsx
├── router.tsx
└── styles.css
