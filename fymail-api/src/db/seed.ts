import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "dotenv";
import { contacts, templates, senderAccounts } from "./schema";
import { encryptPassword } from "../services/mailer.service";

config();

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  const db = drizzle(pool);

  console.log("Seeding database...");

  // ── Sample contacts ────────────────────────────────────────────────────────
  await db.insert(contacts).values([
    {
      firstName: "Hans",
      lastName: "Müller",
      email: "h.mueller@dhl-freight.de",
      jobTitle: "Import Manager",
      country: "DE",
      website: "https://dhl-freight.de",
      serviceTypes: ["LCL", "FCL", "Customs"],
      tags: ["germany", "tier-1"],
      status: "cold",
      score: 4,
      source: "manual",
    },
    {
      firstName: "Sophie",
      lastName: "van den Berg",
      email: "s.vandenberg@rhenus.nl",
      jobTitle: "Operations Director",
      country: "NL",
      website: "https://rhenus.com",
      serviceTypes: ["LCL", "Warehousing"],
      tags: ["netherlands", "tier-1"],
      status: "warm",
      score: 5,
      source: "intelligence",
    },
    {
      firstName: "James",
      lastName: "Fletcher",
      email: "j.fletcher@kuehne-nagel.co.uk",
      jobTitle: "Freight Coordinator",
      country: "GB",
      serviceTypes: ["FCL", "Air Freight"],
      tags: ["uk", "tier-2"],
      status: "cold",
      score: 3,
      source: "csv_import",
    },
  ]).onConflictDoNothing();

  // ── Sample template ────────────────────────────────────────────────────────
  await db.insert(templates).values([
    {
      name: "DE-LCL-First-Contact-EN",
      subject: "Canada LCL Import Partnership — FYWarehouse {{first_name}}",
      bodyHtml: `<p>Dear {{first_name}},</p>

<p>I hope this message finds you well. My name is Tony from FYWarehouse, a bonded warehouse and logistics provider based in Canada specializing in LCL consolidation for Europe-Canada trade lanes.</p>

<p>We work with several European freight forwarders to handle their Canadian import shipments, providing:</p>
<ul>
  <li>Bonded warehousing in Toronto and Vancouver</li>
  <li>LCL deconsolidation and last-mile delivery</li>
  <li>Customs clearance support</li>
  <li>Competitive rates on Europe-Canada lanes</li>
</ul>

<p>I'd love to explore whether there's an opportunity to support {{company}}'s Canadian import operations. Would you have 15 minutes for a quick call this week?</p>

<p>Best regards,<br>Tony<br>FYWarehouse Operations</p>`,
      bodyText: `Dear {{first_name}},\n\nI hope this message finds you well...`,
      variables: ["first_name", "company", "service_type"],
      category: "lcl",
      targetMarket: "de",
      businessType: "canada_import",
      sequenceOrder: 1,
      language: "en",
      isActive: true,
    },
    {
      name: "DE-LCL-Followup1-EN",
      subject: "Re: Canada LCL Partnership — Quick follow-up",
      bodyHtml: `<p>Dear {{first_name}},</p>

<p>I wanted to follow up on my previous email regarding our Canadian warehousing services. I understand your inbox is busy, so I'll be brief.</p>

<p>We recently helped a German freight forwarder reduce their Canada import handling costs by 18% through our LCL consolidation program. I'd be happy to share more details.</p>

<p>Would a 10-minute call work for you this week?</p>

<p>Best regards,<br>Tony<br>FYWarehouse</p>`,
      bodyText: "Dear {{first_name}}, I wanted to follow up...",
      variables: ["first_name"],
      category: "lcl",
      targetMarket: "de",
      businessType: "canada_import",
      sequenceOrder: 2,
      language: "en",
      isActive: true,
    },
  ]).onConflictDoNothing();

  console.log("Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
