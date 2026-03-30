import { apiClient, ApiResponse } from "./client";

export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  jobTitle?: string;
  country?: string;
  website?: string;
  serviceTypes: string[];
  tags: string[];
  status: "cold" | "warm" | "active" | "do_not_contact";
  score: number;
  source?: string;
  notes?: string;
  emailValid?: boolean;
  lastActivityAt?: string;
  createdAt: string;
  companyId?: string;
  companyName?: string;
}

export interface ContactStats {
  total: number;
  cold: number;
  warm: number;
  active: number;
  newThisWeek: number;
}

export interface ListContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  country?: string;
  tags?: string;
  scoreMin?: number;
  scoreMax?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const contactsApi = {
  list: (params?: ListContactsParams) =>
    apiClient
      .get<ApiResponse<Contact[]>>("/contacts", { params })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient
      .get<ApiResponse<Contact>>(`/contacts/${id}`)
      .then((r) => r.data),

  create: (data: Partial<Contact>) =>
    apiClient
      .post<ApiResponse<Contact>>("/contacts", data)
      .then((r) => r.data),

  update: (id: string, data: Partial<Contact>) =>
    apiClient
      .put<ApiResponse<Contact>>(`/contacts/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/contacts/${id}`).then((r) => r.data),

  bulkUpdate: (ids: string[], updates: Partial<Contact>) =>
    apiClient
      .post<ApiResponse<{ updated: number }>>("/contacts/bulk-update", {
        ids,
        updates,
      })
      .then((r) => r.data),

  import: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient
      .post<ApiResponse<{ total: number; inserted: number; skipped: number }>>(
        "/contacts/import",
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      )
      .then((r) => r.data);
  },

  stats: () =>
    apiClient
      .get<ApiResponse<ContactStats>>("/contacts/stats")
      .then((r) => r.data),
};
