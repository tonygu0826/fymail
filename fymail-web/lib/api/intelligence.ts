import { apiClient, ApiResponse } from "./client";

export interface SearchParams {
  keywords: string;
  country?: string;
  serviceType?: string;
  source?: string;
}

export interface SearchResult {
  id: string;
  searchId: string;
  companyName?: string;
  website?: string;
  country?: string;
  serviceTypes?: string[];
  description?: string;
  contactEmail?: string;
  contactName?: string;
  sourceUrl?: string;
  dataSource?: string;
  isImported: boolean;
  importedContactId?: string;
}

export interface SearchHistory {
  id: string;
  queryParams: SearchParams;
  resultCount: number;
  importedCount: number;
  createdAt: string;
}

export const intelligenceApi = {
  search: (params: SearchParams) =>
    apiClient
      .post<ApiResponse<{ searchId: string; results: SearchResult[] }>>(
        "/intelligence/search",
        params
      )
      .then((r) => r.data),

  getSearch: (searchId: string) =>
    apiClient
      .get<ApiResponse<{ results: SearchResult[]; status: string }>>(
        `/intelligence/search/${searchId}`
      )
      .then((r) => r.data),

  importResults: (resultIds: string[]) =>
    apiClient
      .post<ApiResponse<{ imported: number; skipped: number }>>(
        "/intelligence/import",
        { resultIds }
      )
      .then((r) => r.data),

  history: () =>
    apiClient
      .get<ApiResponse<SearchHistory[]>>("/intelligence/history")
      .then((r) => r.data),
};
