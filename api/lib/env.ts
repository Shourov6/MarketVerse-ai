import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`[Config] Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  appId: optional("APP_ID", "local_app_id"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  // Kimi OAuth — optional, only needed if you enable Kimi SSO login
  kimiAuthUrl: optional("KIMI_AUTH_URL", "http://localhost:3000/auth"),
  kimiOpenUrl: optional("KIMI_OPEN_URL", "http://localhost:3000/open"),
  ownerUnionId: optional("OWNER_UNION_ID"),
  // CORS — comma-separated list of allowed origins, e.g. "https://mystore.com"
  corsOrigin: optional("CORS_ORIGIN", "*"),
  port: parseInt(optional("PORT", "3000")),
  // Google OAuth
  googleClientId: optional("GOOGLE_CLIENT_ID"),
  googleClientSecret: optional("GOOGLE_CLIENT_SECRET"),
  // SMTP / Nodemailer
  smtpHost: optional("SMTP_HOST", "smtp.gmail.com"),
  smtpPort: parseInt(optional("SMTP_PORT", "465")),
  smtpSecure: optional("SMTP_SECURE", "true") !== "false",
  smtpUser: optional("SMTP_USER"),
  smtpPass: optional("SMTP_PASS"),
  smtpFrom: optional("SMTP_FROM"),
};

