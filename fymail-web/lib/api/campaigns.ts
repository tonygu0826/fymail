import { apiClient, ApiResponse } from "./client";

export interface Campaign {
  id: string;
  name: string;
  status:
    | "draft"
    | "pending_approval"
    | "approved"
    | "running"
    | "paused"
    | "completed"
    | "rejected";
  templateId: string;
  templateName?: string;
  senderAccountId: string;
  senderEmail?: string;
  contactIds: string[];
  dailyLimit: number;
  sendIntervalMin: number;
  sendIntervalMax: number;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  statTotal: number;
  statSent: number;
  statOpened: number;
  statReplied: number;
  statBounced: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachLog {
  id: string;
  campaignId: string;
  contactId: string;
  contactEmail?: string;
  contactName?: string;
  status: "queued" | "sent" | "opened" | "replied" | "bounced" | "failed";
  subjectRendered?: string;
  sentAt?: string;
  openedAt?: string;
  repliedAt?: string;
  bounceReason?: string;
  errorMessage?: string;
}

export interface SenderAccount {
  id: string;
  name: string;
  email: string;
  dailyLimit: number;
  isActive: boolean;
}

export const campaignsApi = {
  list: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient
      .get<ApiResponse<Campaign[]>>("/campaigns", { params })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<ApiResponse<Campaign>>(`/campaigns/${id}`).then((r) => r.data),

  create: (data: Partial<Campaign>) =>
    apiClient.post<ApiResponse<Campaign>>("/campaigns", data).then((r) => r.data),

  update: (id: string, data: Partial<Campaign>) =>
    apiClient.put<ApiResponse<Campaign>>(`/campaigns/${id}`, data).then((r) => r.data),

  submit: (id: string) =>
    apiClient.post<ApiResponse<Campaign>>(`/campaigns/${id}/submit`).then((r) => r.data),

  start: (id: string) =>
    apiClient.post<ApiResponse<Campaign>>(`/campaigns/${id}/start`).then((r) => r.data),

  pause: (id: string) =>
    apiClient.post<ApiResponse<Campaign>>(`/campaigns/${id}/pause`).then((r) => r.data),

  resume: (id: string) =>
    apiClient.post<ApiResponse<Campaign>>(`/campaigns/${id}/resume`).then((r) => r.data),

  logs: (id: string, params?: { page?: number; limit?: number; status?: string }) =>
    apiClient
      .get<ApiResponse<OutreachLog[]>>(`/campaigns/${id}/logs`, { params })
      .then((r) => r.data),

  stats: (id: string) =>
    apiClient
      .get<ApiResponse<Campaign>>(`/campaigns/${id}/stats`)
      .then((r) => r.data),

  senderAccounts: () =>
    apiClient
      .get<ApiResponse<SenderAccount[]>>("/settings/sender-accounts")
      .then((r) => r.data),
};
