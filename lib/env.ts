const optionalKeys = [
  "DATABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
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
