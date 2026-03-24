import nodemailer from "nodemailer";

import { isSmtpConfigured } from "@/lib/env";

function getTrimmedEnvironmentValue(key: string) {
  const value = process.env[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBooleanValue(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function parsePortValue(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function getProviderLabel(host: string | undefined) {
  if (!host) {
    return "SMTP";
  }

  if (host.includes("gmail")) {
    return "Gmail SMTP";
  }

  return "SMTP";
}

type SmtpReadiness = {
  configured: boolean;
  ready: boolean;
  provider: string;
  host: string | null;
  port: number | null;
  secure: boolean;
  authUserConfigured: boolean;
  authPasswordConfigured: boolean;
  fromEmail: string | null;
  fromName: string | null;
  detail: string;
};

type SmtpRuntimeConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName?: string;
  provider: string;
};

export function getSmtpReadiness(): SmtpReadiness {
  const host = getTrimmedEnvironmentValue("SMTP_HOST");
  const port = parsePortValue(getTrimmedEnvironmentValue("SMTP_PORT"));
  const explicitSecure = parseBooleanValue(getTrimmedEnvironmentValue("SMTP_SECURE"));
  const user = getTrimmedEnvironmentValue("SMTP_USER");
  const password = getTrimmedEnvironmentValue("SMTP_PASSWORD");
  const fromEmail = getTrimmedEnvironmentValue("SMTP_FROM_EMAIL") ?? user;
  const fromName = getTrimmedEnvironmentValue("SMTP_FROM_NAME");
  const secure = explicitSecure ?? port === 465;
  const provider = getProviderLabel(host);

  if (!isSmtpConfigured()) {
    return {
      configured: false,
      ready: false,
      provider,
      host: null,
      port: null,
      secure,
      authUserConfigured: false,
      authPasswordConfigured: false,
      fromEmail: null,
      fromName: null,
      detail: "SMTP environment variables are not configured",
    };
  }

  const issues: string[] = [];

  if (!host) {
    issues.push("SMTP_HOST");
  }

  if (!port) {
    issues.push("SMTP_PORT");
  }

  if (!user) {
    issues.push("SMTP_USER");
  }

  if (!password) {
    issues.push("SMTP_PASSWORD");
  }

  if (!fromEmail) {
    issues.push("SMTP_FROM_EMAIL or SMTP_USER");
  }

  return {
    configured: true,
    ready: issues.length === 0,
    provider,
    host: host ?? null,
    port: port ?? null,
    secure,
    authUserConfigured: Boolean(user),
    authPasswordConfigured: Boolean(password),
    fromEmail: fromEmail ?? null,
    fromName: fromName ?? null,
    detail:
      issues.length === 0
        ? "SMTP configuration is ready for manual single sends"
        : `SMTP is not send-ready. Missing or invalid: ${issues.join(", ")}`,
  };
}

export function getSmtpRuntimeConfig(): SmtpRuntimeConfig {
  const readiness = getSmtpReadiness();

  if (!readiness.ready || !readiness.host || !readiness.port || !readiness.fromEmail) {
    throw new Error(readiness.detail);
  }

  const user = getTrimmedEnvironmentValue("SMTP_USER");
  const password = getTrimmedEnvironmentValue("SMTP_PASSWORD");

  if (!user || !password) {
    throw new Error(readiness.detail);
  }

  return {
    host: readiness.host,
    port: readiness.port,
    secure: readiness.secure,
    user,
    password,
    fromEmail: readiness.fromEmail,
    fromName: readiness.fromName ?? undefined,
    provider: readiness.provider,
  };
}

let cachedTransporter:
  | ReturnType<typeof nodemailer.createTransport>
  | undefined;
let cachedTransporterKey: string | undefined;

export function getSmtpTransporter() {
  const config = getSmtpRuntimeConfig();
  const cacheKey = [
    config.host,
    config.port,
    config.secure,
    config.user,
    config.password,
    config.fromEmail,
    config.fromName ?? "",
  ].join(":");

  if (!cachedTransporter || cachedTransporterKey !== cacheKey) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
    cachedTransporterKey = cacheKey;
  }

  return cachedTransporter;
}
