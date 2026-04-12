export interface CompanyData {
  id?: string;
  company_name?: string;
  name?: string;
  email?: string;
  website?: string;
  country_code?: string;
  country?: string;
  country_region?: string;
  contact_name?: string;
  job_title?: string;
  services?: string[];
  specialties?: string[];
  description?: string;
  phone?: string;
  address?: string;
  confidence?: number;
  source?: string;
  tags?: string[];
  size?: string;
}

export interface SearchCacheData {
  query: string;
  timestamp: number;
  companies: CompanyData[];
}

export interface AutomationRunDetails {
  processedCount?: number;
  successCount?: number;
  failCount?: number;
  errors?: string[];
  [key: string]: unknown;
}
