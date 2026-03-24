const optionalKeys = [
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM_EMAIL",
  "SMTP_FROM_NAME",
] as const;

export function getEnvironmentStatus() {
  return optionalKeys.map((key) => ({
    key,
    configured: Boolean(process.env[key]),
  }));
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST ||
      process.env.SMTP_PORT ||
      process.env.SMTP_USER ||
      process.env.SMTP_PASSWORD ||
      process.env.SMTP_FROM_EMAIL,
  );
}
