import type {
  Application,
  ApplicationListResponse,
  AuditLogResponse,
  Stats,
  ReviewRequest,
  FeedbackRequest,
  FeedbackEntry,
  FeedbackQueueResponse,
  RegulatorySimRequest,
  RegulatorySimResponse,
  AdversarialScenario,
  AdversarialTestResponse,
  ScreeningConfig,
} from '@/types';

const BASE_URL = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getAuthHeader(),
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

export async function submitApplication(formData: FormData) {
  const res = await fetch(`${BASE_URL}/applications`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Submission failed: ${res.status}`);
  }
  return res.json();
}

export async function getApplications(params?: {
  status?: string;
  risk_level?: string;
  search?: string;
  email?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  limit?: number;
}): Promise<ApplicationListResponse> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
  }
  const query = searchParams.toString();
  return request<ApplicationListResponse>(`/applications${query ? `?${query}` : ''}`);
}

export async function getApplication(id: string): Promise<Application> {
  return request<Application>(`/applications/${id}`);
}

export async function getReviewQueue(params?: {
  risk_level?: string;
  page?: number;
  limit?: number;
}): Promise<ApplicationListResponse> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
  }
  const query = searchParams.toString();
  return request<ApplicationListResponse>(`/applications/queue${query ? `?${query}` : ''}`);
}

export async function reprocessApplication(id: string) {
  return request(`/applications/${id}/reprocess`, { method: 'POST' });
}

export async function reviewApplication(id: string, review: ReviewRequest) {
  return request(`/applications/${id}/review`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review),
  });
}

export async function getAuditLog(params?: {
  application_id?: string;
  action?: string;
  actor?: string;
  page?: number;
  limit?: number;
}): Promise<AuditLogResponse> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
  }
  const query = searchParams.toString();
  return request<AuditLogResponse>(`/audit-log${query ? `?${query}` : ''}`);
}

export async function getStats(): Promise<Stats> {
  return request<Stats>('/stats');
}

export function getAuditExportUrl(params?: {
  application_id?: string;
  action?: string;
  actor?: string;
}): string {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
  }
  const query = searchParams.toString();
  return `/api/audit-log/export${query ? `?${query}` : ''}`;
}

// --- Feedback Loop ---

export async function submitFeedback(applicationId: string, feedback: FeedbackRequest): Promise<FeedbackEntry> {
  return request<FeedbackEntry>(`/applications/${applicationId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(feedback),
  });
}

export async function getFeedbackCategories(): Promise<Record<string, string[]>> {
  return request<Record<string, string[]>>('/feedback/categories');
}

export async function getFeedbackQueue(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<FeedbackQueueResponse> {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
  }
  const query = searchParams.toString();
  return request<FeedbackQueueResponse>(`/feedback-queue${query ? `?${query}` : ''}`);
}

// --- Regulatory Simulator ---

export async function simulateRegulatory(
  applicationId: string,
  sim: RegulatorySimRequest,
): Promise<RegulatorySimResponse> {
  return request<RegulatorySimResponse>(`/applications/${applicationId}/simulate-regulatory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sim),
  });
}

// --- Adversarial Testing ---

export async function getAdversarialScenarios(): Promise<AdversarialScenario[]> {
  return request<AdversarialScenario[]>('/demo/scenarios');
}

export async function runAdversarialScenario(scenarioId: string): Promise<AdversarialTestResponse> {
  return request<AdversarialTestResponse>(`/demo/run-scenario/${scenarioId}`, {
    method: 'POST',
  });
}

// --- Screening Config ---

export async function getScreeningConfig(): Promise<ScreeningConfig> {
  return request<ScreeningConfig>('/config/screening');
}

export async function updateScreeningConfig(config: Partial<ScreeningConfig>): Promise<ScreeningConfig> {
  return request<ScreeningConfig>('/config/screening', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

// --- Voice Re-verification ---

export interface VoiceEnrollmentStatus {
  enrolled: boolean;
  application_id?: string;
  enrolled_name?: string;
  enrolled_at?: string;
}

export interface VoiceReverifyResult {
  match_result: string;
  same_speaker_likelihood: number;
  confidence: number;
  passphrase_consistency: number;
  name_spoken_in_new: string | null;
  speech_pattern_notes: string;
  anomalies: Array<{ type: string; severity: string; description: string }>;
  explanation: string;
  enrollment_application_id: string;
  enrollment_name: string;
}

export async function getVoiceEnrollment(email: string): Promise<VoiceEnrollmentStatus> {
  return request<VoiceEnrollmentStatus>(`/voice/enrolled/${encodeURIComponent(email)}`);
}

export async function voiceReverify(email: string, audioBlob: Blob): Promise<VoiceReverifyResult> {
  const formData = new FormData();
  formData.append('email', email);
  formData.append('voice_sample', audioBlob, 'reverify.webm');

  const res = await fetch(`${BASE_URL}/voice/reverify`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Voice verification failed' }));
    throw new Error(err.detail || 'Voice verification failed');
  }

  return res.json();
}

// --- Webhooks ---

export interface WebhookConfig {
  enabled: boolean;
  callback_url: string;
  secret: string;
  retry_count: number;
  timeout_seconds: number;
  events: Record<string, boolean>;
}

export interface WebhookLogEntry {
  id: string;
  created_at: string;
  direction: 'incoming' | 'outgoing';
  event_type: string;
  application_id: string | null;
  status: string;
  status_code: number | null;
  payload: Record<string, unknown> | null;
  response_body: string | null;
  error: string | null;
}

export interface WebhookScenario {
  index: number;
  client_id: string;
  name: string;
  country: string;
  document_type: string;
  failure_reason: string;
  failure_details: string;
  priority: string;
}

export async function getWebhookConfig(): Promise<WebhookConfig> {
  return request<WebhookConfig>('/webhooks/config');
}

export async function updateWebhookConfig(config: Partial<WebhookConfig>): Promise<WebhookConfig> {
  return request<WebhookConfig>('/webhooks/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

export async function getWebhookLogs(direction?: string): Promise<{ logs: WebhookLogEntry[]; total: number }> {
  const params = direction ? `?direction=${direction}` : '';
  return request(`/webhooks/logs${params}`);
}

export async function getWebhookScenarios(): Promise<{ scenarios: WebhookScenario[] }> {
  return request('/webhooks/scenarios');
}

export async function simulateIncomingWebhook(scenarioIndex: number): Promise<Record<string, unknown>> {
  return request(`/webhooks/simulate-incoming?scenario_index=${scenarioIndex}`, {
    method: 'POST',
  });
}

export async function simulateOutgoingWebhook(applicationId: string): Promise<Record<string, unknown>> {
  return request(`/webhooks/simulate-outgoing/${applicationId}`, {
    method: 'POST',
  });
}
