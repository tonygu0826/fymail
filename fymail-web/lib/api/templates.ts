import { apiClient, ApiResponse } from "./client";

export interface Template {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables: string[];
  category?: string;
  targetMarket?: string;
  businessType?: string;
  sequenceOrder: number;
  language: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const templatesApi = {
  list: (params?: { category?: string; targetMarket?: string; businessType?: string }) =>
    apiClient
      .get<ApiResponse<Template[]>>("/templates", { params })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<ApiResponse<Template>>(`/templates/${id}`).then((r) => r.data),

  create: (data: Partial<Template>) =>
    apiClient.post<ApiResponse<Template>>("/templates", data).then((r) => r.data),

  update: (id: string, data: Partial<Template>) =>
    apiClient.put<ApiResponse<Template>>(`/templates/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/templates/${id}`).then((r) => r.data),

  preview: (id: string, contactId: string) =>
    apiClient
      .post<ApiResponse<{ subject: string; body: string }>>(
        `/templates/${id}/preview`,
        { contactId }
      )
      .then((r) => r.data),
};
