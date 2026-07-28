// Test environment values keep auth, audit signing, and CORS deterministic.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.AUDIT_SECRET = "test-audit-secret";
process.env.CLIENT_URL = "http://127.0.0.1:5173";
process.env.SMTP_HOST = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";
