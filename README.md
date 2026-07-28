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

Seed login accounts. To change the admin login, create or edit `server/.env` and set the admin variables shown in `server/.env.example`, then restart the backend:

```env
ADMIN_NAME=Your Admin Name
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PHONE=08012345678
ADMIN_PASSWORD=YourStrongPassword123!
```

- Admin: `admin@ziklodge.test` / `Password123!`
- Agent: `agent@ziklodge.test` / `Password123!`
- Student: `student@ziklodge.test` / `Password123!`

Admin is the programmer/platform owner account. Public registration allows only
students and agents; admin dashboard routes are restricted to admin users.

Signup and password-reset OTPs are tied to the same normalized account email. Users must reset with the email they used when creating the account.

For production, copy `server/.env.production.example` to your real environment settings and replace every secret:

- `DATABASE_URL`: managed PostgreSQL with backups enabled
- `JWT_SECRET` and `AUDIT_SECRET`: long random production secrets
- `CLIENT_URL`: your real HTTPS frontend domain only
- `ENFORCE_HTTPS=true`: rejects non-HTTPS proxy traffic
- `SMTP_*`: real email provider/app-password for OTP delivery
- `CLOUDINARY_*`: real image/document storage
- NIN verification is disabled for now; keep `NIN_VERIFICATION_*` unset until you add a licensed provider.

The support/OTP sender email is `myappziklodg@gmail.com`. Change `SUPPORT_EMAIL` and `SMTP_FROM` if you intentionally want another address.

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
- `GET /api/admin/analytics`
- `POST /api/admin/approve-payout/:agentId`

## Commission status

Commission tracking is disabled for now. Student lodge claims and agent confirmations still work, but commission amounts are stored as `0` and admin commission update endpoints return `410`.

Agent verification payments are shown in-app as:

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
- Agent NIN verification is disabled for now
- Cloudinary-ready document/image uploads with file type and size validation
- Admin account restriction/pending/verification controls
- Reports and lodge claims notify admin/agents
- Hash-chained audit logs for sensitive admin/account actions

Important: true NIN verification requires credentials from an official or licensed NIN verification provider. NIN checks are currently disabled until that provider is added.

## Tests

```powershell
npm.cmd run test --workspace server
```

The current backend tests cover auth, admin restrictions, agent verification validation, reports, chat, transaction duplicate prevention, and verified-agent lodge posting.

## Scaling notes

Universities are first-class records in the schema, so the marketplace can expand from UNIZIK to other Nigerian universities without reshaping listings, users, or commission records.
