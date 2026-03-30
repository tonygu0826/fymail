import { db } from "../config/database";
import { searchHistory, searchResults, contacts } from "../db/schema";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

export const searchSchema = z.object({
  keywords: z.string().min(1).max(200),
  country: z.string().max(10).optional(),
  serviceType: z.string().max(100).optional(),
  source: z.enum(["google", "bing", "manual"]).default("google"),
});

export type SearchInput = z.infer<typeof searchSchema>;

// ── Google Custom Search ───────────────────────────────────────────────────────
async function googleSearch(query: string): Promise<GoogleResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) {
    console.warn("[intelligence] GOOGLE_API_KEY or GOOGLE_SEARCH_CX not set — returning mock results");
    return mockResults(query);
  }

  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: query,
    num: "10",
    gl: "de", // geolocation — Germany default
  });

  const res = await fetch(
    `https://www.googleapis.com/customsearch/v1?${params}`,
    { headers: { Accept: "application/json" } }
  );

  if (!res.ok) {
    console.error("[intelligence] Google Search API error:", res.status);
    return mockResults(query);
  }

  const data = await res.json();
  return (data.items ?? []).map((item: any) => ({
    title: item.title,
    link: item.link,
    snippet: item.snippet,
    displayLink: item.displayLink,
  }));
}

interface GoogleResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

// ── Parse company info from search result ──────────────────────────────────────
function parseCompanyFromResult(result: GoogleResult, country?: string) {
  const emailMatch = result.snippet.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
  const nameMatch = result.title.replace(/ [-|–] .*$/, "").trim();

  return {
    companyName: nameMatch.slice(0, 200),
    website: result.link.startsWith("http") ? result.link : `https://${result.link}`,
    country: country ?? extractCountryFromDomain(result.displayLink),
    description: result.snippet.slice(0, 500),
    contactEmail: emailMatch?.[0] ?? null,
    contactName: null,
    sourceUrl: result.link,
    dataSource: "google" as const,
  };
}

function extractCountryFromDomain(domain: string): string {
  const tld = domain.split(".").pop()?.toLowerCase();
  const tldMap: Record<string, string> = {
    de: "DE", nl: "NL", co: "GB", uk: "GB",
    fr: "FR", be: "BE", at: "AT", ch: "CH", pl: "PL",
  };
  return tld ? (tldMap[tld] ?? "EU") : "EU";
}

// ── Mock results for dev/no-API ────────────────────────────────────────────────
function mockResults(query: string): GoogleResult[] {
  return [
    {
      title: "Kühne+Nagel - Freight Forwarding & Logistics",
      link: "https://kuehne-nagel.com",
      snippet: "Global logistics: airfreight, seafreight, customs, LCL. Contact: info@kuehne-nagel.com",
      displayLink: "kuehne-nagel.com",
    },
    {
      title: "DB Schenker Deutschland - Freight Solutions",
      link: "https://dbschenker.com/de",
      snippet: "Rail, road and air freight, LCL consolidation Germany. import@dbschenker.de",
      displayLink: "dbschenker.com",
    },
    {
      title: "Rhenus Logistics - European Freight Forwarding",
      link: "https://rhenus.com",
      snippet: "Warehousing and LCL shipping specialist for European markets. contact@rhenus.com",
      displayLink: "rhenus.com",
    },
    {
      title: "DACHSER - Intelligent Logistics",
      link: "https://dachser.com",
      snippet: "Full groupage and LCL services Germany and Europe. info@dachser.com",
      displayLink: "dachser.com",
    },
    {
      title: "Panalpina - Freight Forwarding",
      link: "https://dsworldwide.com",
      snippet: `Freight forwarding specialising in ${query} operations. contact@dsv.com`,
      displayLink: "dsv.com",
    },
  ];
}

// ── Main service ───────────────────────────────────────────────────────────────
export class IntelligenceService {
  async search(input: SearchInput, userId: string) {
    const queryParts = [input.keywords];
    if (input.serviceType) queryParts.push(input.serviceType);
    if (input.country) queryParts.push(`"${input.country}"`);
    queryParts.push("freight forwarder logistics");
    const query = queryParts.join(" ");

    // Store search history
    const [history] = await db
      .insert(searchHistory)
      .values({ queryParams: input as any, createdBy: userId })
      .returning();

    // Fetch results from Google
    const raw = await googleSearch(query);

    // Parse and store results
    const parsed = raw.map((r) => ({
      searchId: history.id,
      ...parseCompanyFromResult(r, input.country),
    }));

    const stored = parsed.length > 0
      ? await db.insert(searchResults).values(parsed).returning()
      : [];

    // Update result count
    await db
      .update(searchHistory)
      .set({ resultCount: stored.length })
      .where(eq(searchHistory.id, history.id));

    return { searchId: history.id, results: stored };
  }

  async getSearch(searchId: string) {
    const results = await db
      .select()
      .from(searchResults)
      .where(eq(searchResults.searchId, searchId));
    return { results, status: "complete" };
  }

  async importResults(resultIds: string[], userId: string) {
    const rows = await db
      .select()
      .from(searchResults)
      .where(inArray(searchResults.id, resultIds));

    const toImport = rows.filter((r) => !r.isImported && r.contactEmail);

    let inserted = 0;
    let skipped = 0;

    for (const row of toImport) {
      if (!row.contactEmail) { skipped++; continue; }

      const [existing] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.email, row.contactEmail))
        .limit(1);

      if (existing) { skipped++; continue; }

      const [contact] = await db
        .insert(contacts)
        .values({
          email: row.contactEmail,
          firstName: row.contactName?.split(" ")?.[0] ?? null,
          lastName: row.contactName?.split(" ")?.slice(1).join(" ") ?? null,
          country: row.country ?? null,
          website: row.website ?? null,
          serviceTypes: row.serviceTypes ?? [],
          source: "intelligence",
          createdBy: userId,
        })
        .returning({ id: contacts.id });

      // Mark result as imported
      await db
        .update(searchResults)
        .set({ isImported: true, importedContactId: contact.id })
        .where(eq(searchResults.id, row.id));

      inserted++;
    }

    return { imported: inserted, skipped };
  }

  async getHistory(userId: string) {
    return db
      .select()
      .from(searchHistory)
      .where(eq(searchHistory.createdBy, userId))
      .orderBy(searchHistory.createdAt)
      .limit(20);
  }
}

export const intelligenceService = new IntelligenceService();
