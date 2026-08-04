// Test environment values keep auth, audit signing, and CORS deterministic.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.AUDIT_SECRET = "test-audit-secret";
process.env.CLIENT_URL = "http://127.0.0.1:5173";
process.env.ADMIN_EMAIL = "admin@ziklodge.test";
process.env.ADMIN_PASSWORD = "Password123!";
process.env.ADMIN_NAME = "Zik Lodge Admin";
process.env.ADMIN_PHONE = "+2348000000000";
process.env.SMTP_HOST = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";
