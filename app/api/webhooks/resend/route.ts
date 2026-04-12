import { NextResponse } from "next/server";
import { EmailLogStatus, ContactStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || "";

/**
 * Resend Webhook handler.
 * Events: email.sent, email.delivered, email.opened, email.bounced, email.complained
 * Docs: https://resend.com/docs/dashboard/webhooks/introduction
 */
export async function POST(request: Request) {
  try {
    // Verify webhook secret via svix headers if configured
    if (RESEND_WEBHOOK_SECRET) {
      const svixId = request.headers.get("svix-id");
      const svixTimestamp = request.headers.get("svix-timestamp");
      const svixSignature = request.headers.get("svix-signature");

      if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json({ error: "Missing svix headers" }, { status: 401 });
      }

      const body = await request.text();
      const isValid = await verifySvixSignature(body, svixId, svixTimestamp, svixSignature);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }

      const event = JSON.parse(body);
      await handleEvent(event);
      return NextResponse.json({ received: true });
    }

    // No secret configured — accept all (development mode)
    const event = await request.json();
    await handleEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Resend Webhook] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

async function handleEvent(event: { type: string; data: any }) {
  const { type, data } = event;
  const emailId = data?.email_id;

  if (!emailId) {
    console.warn(`[Resend Webhook] No email_id in event: ${type}`);
    return;
  }

  // Find the EmailLog by messageId (which stores the Resend email_id)
  const emailLog = await prisma.emailLog.findFirst({
    where: { messageId: emailId },
    include: { contact: true },
  });

  if (!emailLog) {
    console.warn(`[Resend Webhook] No EmailLog found for messageId: ${emailId}`);
    return;
  }

  const timestamp = data.created_at ? new Date(data.created_at) : new Date();

  switch (type) {
    case "email.delivered": {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailLogStatus.DELIVERED,
          metadata: {
            ...(emailLog.metadata as object || {}),
            deliveredAt: timestamp.toISOString(),
          },
        },
      });
      console.log(`[Resend Webhook] DELIVERED: ${emailLog.recipientEmail}`);
      break;
    }

    case "email.opened": {
      // Don't change status, just record the open in metadata
      const existingMeta = (emailLog.metadata as any) || {};
      const opens = existingMeta.opens || [];
      opens.push(timestamp.toISOString());
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          metadata: { ...existingMeta, opens, lastOpenedAt: timestamp.toISOString() },
        },
      });
      console.log(`[Resend Webhook] OPENED: ${emailLog.recipientEmail} (${opens.length}x)`);
      break;
    }

    case "email.clicked": {
      const existingMeta = (emailLog.metadata as any) || {};
      const clicks = existingMeta.clicks || [];
      clicks.push({ url: data.click?.link, at: timestamp.toISOString() });
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          metadata: { ...existingMeta, clicks, lastClickedAt: timestamp.toISOString() },
        },
      });
      console.log(`[Resend Webhook] CLICKED: ${emailLog.recipientEmail}`);
      break;
    }

    case "email.bounced": {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailLogStatus.BOUNCED,
          errorMessage: `Bounce: ${data.bounce?.type || "unknown"}`,
          metadata: {
            ...(emailLog.metadata as object || {}),
            bouncedAt: timestamp.toISOString(),
            bounceType: data.bounce?.type,
          },
        },
      });

      // Mark contact as BOUNCED
      if (emailLog.contactId) {
        await prisma.contact.update({
          where: { id: emailLog.contactId },
          data: { status: ContactStatus.BOUNCED },
        });
      }
      console.log(`[Resend Webhook] BOUNCED: ${emailLog.recipientEmail}`);
      break;
    }

    case "email.complained": {
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailLogStatus.BOUNCED,
          errorMessage: "Spam complaint",
          metadata: {
            ...(emailLog.metadata as object || {}),
            complainedAt: timestamp.toISOString(),
          },
        },
      });

      // Mark contact as UNSUBSCRIBED on spam complaint
      if (emailLog.contactId) {
        await prisma.contact.update({
          where: { id: emailLog.contactId },
          data: { status: ContactStatus.UNSUBSCRIBED },
        });
      }
      console.log(`[Resend Webhook] COMPLAINED: ${emailLog.recipientEmail}`);
      break;
    }

    default:
      console.log(`[Resend Webhook] Unhandled event: ${type}`);
  }
}

/**
 * Verify Resend/Svix webhook signature using Web Crypto API.
 * Signature format: v1,<base64-signature>
 */
async function verifySvixSignature(
  body: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string
): Promise<boolean> {
  try {
    const secret = RESEND_WEBHOOK_SECRET.startsWith("whsec_")
      ? RESEND_WEBHOOK_SECRET.slice(6)
      : RESEND_WEBHOOK_SECRET;

    const secretBytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signedContent = `${svixId}.${svixTimestamp}.${body}`;
    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(signedContent)
    );

    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

    // svix-signature can contain multiple signatures: "v1,sig1 v1,sig2"
    const signatures = svixSignature.split(" ");
    return signatures.some((sig) => {
      const [, sigValue] = sig.split(",");
      return sigValue === expectedSignature;
    });
  } catch (err) {
    console.error("[Resend Webhook] Signature verification failed:", err);
    return false;
  }
}
