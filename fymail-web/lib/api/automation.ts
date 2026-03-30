import { apiClient, ApiResponse } from "./client";

export type TriggerType =
  | "contact_created"
  | "contact_imported"
  | "campaign_replied"
  | "status_changed"
  | "score_changed";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "is_empty"
  | "is_not_empty";

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value?: string;
}

export type ActionType =
  | "add_tag"
  | "remove_tag"
  | "set_status"
  | "set_score"
  | "assign_to"
  | "send_notification";

export interface RuleAction {
  type: ActionType;
  params: Record<string, string | number>;
}

export interface AutomationRule {
  id: string;
  name: string;
  isEnabled: boolean;
  priority: number;
  triggerType: TriggerType;
  conditions: RuleCondition[];
  actions: RuleAction[];
  runCount: number;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const automationApi = {
  list: () =>
    apiClient
      .get<ApiResponse<AutomationRule[]>>("/automation/rules")
      .then((r) => r.data),

  get: (id: string) =>
    apiClient
      .get<ApiResponse<AutomationRule>>(`/automation/rules/${id}`)
      .then((r) => r.data),

  create: (data: Partial<AutomationRule>) =>
    apiClient
      .post<ApiResponse<AutomationRule>>("/automation/rules", data)
      .then((r) => r.data),

  update: (id: string, data: Partial<AutomationRule>) =>
    apiClient
      .put<ApiResponse<AutomationRule>>(`/automation/rules/${id}`, data)
      .then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/automation/rules/${id}`).then((r) => r.data),

  toggle: (id: string) =>
    apiClient
      .patch<ApiResponse<AutomationRule>>(`/automation/rules/${id}/toggle`)
      .then((r) => r.data),

  reorder: (ids: string[]) =>
    apiClient
      .put<ApiResponse<void>>("/automation/rules/reorder", { ids })
      .then((r) => r.data),
};

// ── Static config ─────────────────────────────────────────────────────────────
export const TRIGGER_OPTIONS: { value: TriggerType; label: string; description: string }[] = [
  { value: "contact_created", label: "Contact created", description: "Fires when a contact is manually added" },
  { value: "contact_imported", label: "Contact imported", description: "Fires when contacts are imported via CSV or Intelligence" },
  { value: "campaign_replied", label: "Campaign replied", description: "Fires when a contact replies to a campaign email" },
  { value: "status_changed", label: "Status changed", description: "Fires when a contact's status is updated" },
  { value: "score_changed", label: "Score changed", description: "Fires when a contact's score is updated" },
];

export const CONDITION_FIELDS = [
  { value: "country", label: "Country" },
  { value: "status", label: "Status" },
  { value: "score", label: "Score" },
  { value: "tags", label: "Tags" },
  { value: "service_types", label: "Service types" },
  { value: "source", label: "Source" },
  { value: "email_valid", label: "Email valid" },
];

export const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "greater_than", label: "greater than" },
  { value: "less_than", label: "less than" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

export const ACTION_OPTIONS: { value: ActionType; label: string; hasParams: boolean }[] = [
  { value: "add_tag", label: "Add tag", hasParams: true },
  { value: "remove_tag", label: "Remove tag", hasParams: true },
  { value: "set_status", label: "Set status", hasParams: true },
  { value: "set_score", label: "Set score", hasParams: true },
  { value: "assign_to", label: "Assign to user", hasParams: true },
  { value: "send_notification", label: "Send notification", hasParams: true },
];
