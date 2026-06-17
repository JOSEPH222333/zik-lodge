# Zik Lodge

Modern full-stack student hostel/lodge marketplace for UNIZIK students, verified agents/landlords, and platform admins.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn-style components, Framer Motion, Lucide icons
- Backend: Node.js, Express, TypeScript, JWT auth, Zod validation, rate limiting, image/document validation
- Database: PostgreSQL schema via Prisma in `server/prisma/schema.prisma`
- Storage: Cloudinary-ready uploads for lodge images and agent documents
- Email: SMTP/Nodemailer OTP for signup and password reset

## Run locally

```powershell
npm.cmd install
npm.cmd run prisma:generate --workspace server
npm.cmd run dev
```

Frontend: `http://127.0.0.1:5173`

API: `http://127.0.0.1:4000/api/health`

Seed login accounts. Change the admin credentials in `server/.env` using the variables shown in `server/.env.example`:

- Admin: `admin@ziklodge.test` / `Password123!`
- Agent: `agent@ziklodge.test` / `Password123!`
- Student: `student@ziklodge.test` / `Password123!`

Admin is the programmer/platform owner account. Public registration allows only
students and agents; admin dashboard routes are restricted to admin users.

Registration currently blocks a second account from the same IP address.

For production, copy `server/.env.production.example` to your real environment settings and replace every secret:

- `DATABASE_URL`: managed PostgreSQL with backups enabled
- `JWT_SECRET` and `AUDIT_SECRET`: long random production secrets
- `CLIENT_URL`: your real HTTPS frontend domain only
- `ENFORCE_HTTPS=true`: rejects non-HTTPS proxy traffic
- `SMTP_*`: real email provider/app-password for OTP delivery
- `CLOUDINARY_*`: real image/document storage
- `NIN_VERIFICATION_*`: live NIN verification provider credentials

The support email is `supporttearmziklodge@gmail.com`. Change `SUPPORT_EMAIL` if you intentionally want another address.

## Core API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/request-otp`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/lodges`
- `POST /api/lodges` agent/admin only
- `PATCH /api/lodges/:id/status`
- `POST /api/lodges/:id/report`
- `POST /api/lodges/:id/messages`
- `POST /api/lodges/:id/got-this`
- `PATCH /api/deals/:id/confirm`
- `POST /api/agent/verify`
- `POST /api/agent/upload-documents`
- `GET /api/agent/status`
- `POST /api/transaction/initiate`
- `GET /api/transactions/my`
- `GET /api/transactions/agent`
- `POST /api/transaction/confirm/:id`
- `POST /api/transaction/reject/:id`
- `GET /api/transactions/all`
- `GET /api/admin/overview`
- `GET /api/admin/audit`
- `GET /api/admin/pending-verifications`
- `POST /api/admin/approve-agent/:id`
- `POST /api/admin/reject-agent/:id`
- `POST /api/admin/set-commission`
- `GET /api/admin/analytics`
- `POST /api/admin/approve-payout/:agentId`
- `PATCH /api/admin/commission`

## Commission flow

1. Student clicks "I Got This Lodge".
2. API creates a deal with status `student_marked`.
3. Commission is calculated from the active setting.
4. Agent confirms payment.
5. Deal status becomes `agent_confirmed` and the lodge is marked occupied.
6. Admin can track and settle commissions.

Agent verification/commission payments are shown in-app as:

- Bank: FirstBank
- Account number: `3159371980`

## Policies and security

The frontend includes pages for privacy, terms, refund/commission policy, and report-abuse policy:

- `/privacy`
- `/terms`
- `/refund-commission-policy`
- `/report-abuse-policy`

Security controls currently included:

- Role-protected admin, agent, and student routes
- OTP email verification and password reset
- Agent NIN format validation plus a production hook for a live NIN provider
- Cloudinary-ready document/image uploads with file type and size validation
- Admin account restriction/pending/verification controls
- Reports and lodge claims notify admin/agents
- Hash-chained audit logs for sensitive admin/account actions

Important: true NIN verification requires credentials from an official or licensed NIN verification provider. Without `NIN_VERIFICATION_API_URL` and `NIN_VERIFICATION_API_KEY`, the app can validate the NIN format and keep agents pending for manual admin review, but it cannot legally prove the NIN is real.

## Tests

```powershell
npm.cmd run test --workspace server
```

The current backend tests cover auth, admin restrictions, agent verification validation, reports, chat, transaction duplicate prevention, and verified-agent lodge posting.

## Scaling notes

Universities are first-class records in the schema, so the marketplace can expand from UNIZIK to other Nigerian universities without reshaping listings, users, or commission records.
