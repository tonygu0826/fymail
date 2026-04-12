import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureDefaultOperator } from "@/lib/mvp-data";
import { ContactStatus } from "@prisma/client";
import { getSearchResult } from "@/lib/search-cache";

// Helper to map company data to contact fields
// Supports both real-time search format and local dataset format
function mapCompanyToContact(company: any): {
  companyName: string;
  contactName?: string;
  email: string;
  countryCode: string;
  marketRegion?: string;
  jobTitle?: string;
  source: string;
  tags: string[];
} {
  // Company name: real-time uses `name`, local uses `company_name`
  const companyName = company.name || company.company_name || 'Unknown Company';

  // Email: real-time uses `contact.email`, local uses `email`
  let email = company.contact?.email || company.email || '';
  const website = company.contact?.website || company.website || '';
  if (!email && website) {
    try {
      const domain = new URL(website).hostname;
      email = `info@${domain}`;
    } catch { /* ignore */ }
  }
  if (!email || !email.includes('@')) {
    email = `contact@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
  }

  // Country: real-time uses `country`, local uses `country_code`
  let countryCode = company.country || company.country_code || '';
  if (countryCode.length > 2) {
    const match = company.country_region?.match(/\(([A-Z]{2})\)|([A-Z]{2})$/);
    if (match) countryCode = match[1] || match[2];
    else countryCode = countryCode.substring(0, 2);
  }
  if (!countryCode || countryCode.length !== 2) countryCode = 'EU';

  const marketRegion = getMarketRegion(countryCode);
  const contactName = company.contact_name || 'Sales Department';
  const services: string[] = company.services || [];
  const serviceTags = services.map((s: string) => s.toLowerCase().replace(/\s+/g, '_'));

  return {
    companyName,
    contactName,
    email,
    countryCode: countryCode.toUpperCase(),
    marketRegion,
    jobTitle: company.job_title || 'Business Development',
    source: 'intelligence_search',
    tags: [...serviceTags, countryCode.toLowerCase()],
  };
}

function getMarketRegion(countryCode: string): string | undefined {
  const regionMap: Record<string, string> = {
    'DE': 'DACH',
    'AT': 'DACH',
    'CH': 'DACH',
    'NL': 'Benelux',
    'BE': 'Benelux',
    'LU': 'Benelux',
    'FR': 'France',
    'ES': 'Iberia',
    'PT': 'Iberia',
    'IT': 'Italy',
    'UK': 'UK',
    'GB': 'UK',
    'IE': 'UK',
    'SE': 'Nordics',
    'NO': 'Nordics',
    'DK': 'Nordics',
    'FI': 'Nordics',
    'PL': 'Eastern Europe',
    'CZ': 'Eastern Europe',
    'HU': 'Eastern Europe',
    'RO': 'Eastern Europe',
  };
  return regionMap[countryCode.toUpperCase()];
}
const COMPANY_TO_CONTACT_MAP = {
  "1": {
    companyName: "Kuehne + Nagel",
    contactName: "Michael Schmidt",
    email: "michael.schmidt@kuehne-nagel.com",
    countryCode: "DE",
    marketRegion: "DACH",
    jobTitle: "Business Development Manager",
    source: "intelligence_search",
    tags: ["germany", "enterprise", "lcl", "fcl", "air"],
  },
  "2": {
    companyName: "DB Schenker",
    contactName: "Anna Müller",
    email: "anna.mueller@dbschenker.com",
    countryCode: "DE",
    marketRegion: "DACH",
    jobTitle: "Sales Director",
    source: "intelligence_search",
    tags: ["germany", "rail", "logistics", "enterprise"],
  },
  "3": {
    companyName: "DHL Global Forwarding",
    contactName: "Thomas Weber",
    email: "thomas.weber@dhl.com",
    countryCode: "DE",
    marketRegion: "DACH",
    jobTitle: "Key Account Manager",
    source: "intelligence_search",
    tags: ["germany", "air_freight", "global", "enterprise"],
  },
  "4": {
    companyName: "DSV",
    contactName: "Lars Jensen",
    email: "lars.jensen@dsv.com",
    countryCode: "DK",
    marketRegion: "Nordics",
    jobTitle: "Regional Manager",
    source: "intelligence_search",
    tags: ["denmark", "air", "sea", "solutions"],
  },
  "5": {
    companyName: "Geodis",
    contactName: "Marie Dubois",
    email: "marie.dubois@geodis.com",
    countryCode: "FR",
    marketRegion: "France",
    jobTitle: "Contract Logistics Manager",
    source: "intelligence_search",
    tags: ["france", "contract_logistics", "europe"],
  },
  "6": {
    companyName: "Agility Logistics",
    contactName: "David van Dijk",
    email: "david.vandijk@agility.com",
    countryCode: "NL",
    marketRegion: "Benelux",
    jobTitle: "Digital Solutions Director",
    source: "intelligence_search",
    tags: ["netherlands", "digital", "sme", "innovation"],
  },
  "7": {
    companyName: "Panalpina (DSV)",
    contactName: "Markus Fischer",
    email: "markus.fischer@panalpina.com",
    countryCode: "CH",
    marketRegion: "Switzerland",
    jobTitle: "Air Freight Specialist",
    source: "intelligence_search",
    tags: ["switzerland", "air_freight", "pharma"],
  },
  "8": {
    companyName: "Dachser",
    contactName: "Julia Schneider",
    email: "julia.schneider@dachser.com",
    countryCode: "DE",
    marketRegion: "DACH",
    jobTitle: "Road Logistics Manager",
    source: "intelligence_search",
    tags: ["germany", "road", "integrated", "family_business"],
  },
  "9": {
    companyName: "Hellmann Worldwide Logistics",
    contactName: "Robert Klein",
    email: "robert.klein@hellmann.net",
    countryCode: "DE",
    marketRegion: "DACH",
    jobTitle: "Sea Freight Manager",
    source: "intelligence_search",
    tags: ["germany", "sea_freight", "midmarket"],
  },
  "10": {
    companyName: "Kintetsu World Express",
    contactName: "Yuki Tanaka",
    email: "yuki.tanaka@kwe.kintetsu.jp",
    countryCode: "JP",
    marketRegion: "Asia",
    jobTitle: "International Business Manager",
    source: "intelligence_search",
    tags: ["japan", "asia", "air_freight", "high_tech"],
  },
  "11": {
    companyName: "Ceva Logistics",
    contactName: "Sophie Martin",
    email: "sophie.martin@cevalogistics.com",
    countryCode: "CH",
    marketRegion: "Switzerland",
    jobTitle: "Automotive Logistics Manager",
    source: "intelligence_search",
    tags: ["switzerland", "automotive", "contract_logistics"],
  },
  "12": {
    companyName: "Bolloré Logistics",
    contactName: "Pierre Lefevre",
    email: "pierre.lefevre@bollore-logistics.com",
    countryCode: "FR",
    marketRegion: "France",
    jobTitle: "Africa Trade Specialist",
    source: "intelligence_search",
    tags: ["france", "africa", "perishables", "healthcare"],
  },
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { searchId, companyIds, listId } = body;
    
    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { error: "No company IDs provided" },
        { status: 400 }
      );
    }
    
    const owner = await ensureDefaultOperator();
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    // Try to get companies from database
    const searchResult = await getSearchResult(searchId);
    const cachedCompanies = searchResult ? (searchResult.companies as any[]) : null;

    // Process each company ID
    for (const companyId of companyIds) {
      let contactData = null;

      // First try to get from DB cache
      if (cachedCompanies) {
        const company = cachedCompanies.find((c: any) =>
          c.dedupe_key === companyId ||
          c.company_name === companyId ||
          c.name === companyId ||
          c.id === companyId
        );
        if (company) {
          contactData = mapCompanyToContact(company);
        }
      }

      // Fallback to hardcoded mapping if DB miss
      if (!contactData) {
        contactData = (COMPANY_TO_CONTACT_MAP as Record<string, any>)[companyId];
        if (!contactData) {
          skipped++;
          errors.push(`Company ID ${companyId} not found in search results or mapping`);
          continue;
        }
      }
      
      try {
        // Check if contact already exists by email
        const existing = await prisma.contact.findUnique({
          where: { email: contactData.email },
        });
        
        if (existing) {
          skipped++;
          continue;
        }
        
        // Create new contact
        await prisma.contact.create({
          data: {
            companyName: contactData.companyName,
            contactName: contactData.contactName || null,
            email: contactData.email,
            countryCode: contactData.countryCode,
            marketRegion: contactData.marketRegion || null,
            jobTitle: contactData.jobTitle || null,
            source: contactData.source,
            status: ContactStatus.NEW,
            priority: 0,
            score: 0,
            tags: contactData.tags,
            ownerId: owner.id,
          },
        });
        
        imported++;
      } catch (error: any) {
        // Handle duplicate email or other errors
        if (error.code === 'P2002') {
          skipped++;
        } else {
          errors.push(`Failed to import ${companyId}: ${error.message}`);
          skipped++;
        }
      }
    }
    
    // Create audit log entry
    try {
      await prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'Contact',
          userId: owner.id,
          userEmail: owner.email,
          details: {
            source: 'intelligence_import',
            searchId,
            imported,
            skipped,
            companyIds,
            listId,
          },
        },
      });
    } catch (auditError) {
      console.warn('Failed to create audit log:', auditError);
    }
    
    return NextResponse.json({
      imported,
      skipped,
      listId,
      errors: errors.length > 0 ? errors : undefined,
    });
    
  } catch (error) {
    console.error("Import API error:", error);
    return NextResponse.json(
      { 
        error: "Import failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}