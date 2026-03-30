import { apiClient, ApiResponse } from "./client";

export interface Approval {
  id: string;
  campaignId: string;
  campaignName?: string;
  status: "pending" | "approved" | "rejected" | "revision_requested";
  requestedBy: string;
  requestedByName?: string;
  reviewerId?: string;
  reviewedAt?: string;
  comment?: string;
  createdAt: string;
  // Campaign snapshot
  contactCount?: number;
  templateName?: string;
  senderEmail?: string;
  dailyLimit?: number;
}

export const approvalsApi = {
  list: (params?: { status?: string }) =>
    apiClient
      .get<ApiResponse<Approval[]>>("/approvals", { params })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<ApiResponse<Approval>>(`/approvals/${id}`).then((r) => r.data),

  approve: (id: string, comment?: string) =>
    apiClient
      .post<ApiResponse<Approval>>(`/approvals/${id}/approve`, { comment })
      .then((r) => r.data),

  reject: (id: string, comment: string) =>
    apiClient
      .post<ApiResponse<Approval>>(`/approvals/${id}/reject`, { comment })
      .then((r) => r.data),

  requestRevision: (id: string, comment: string) =>
    apiClient
      .post<ApiResponse<Approval>>(`/approvals/${id}/request-revision`, { comment })
      .then((r) => r.data),
};
