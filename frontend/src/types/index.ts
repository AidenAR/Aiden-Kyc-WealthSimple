export interface Application {
  id: string;
  created_at: string;
  updated_at: string;
  email: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  address: string;
  country: string;
  document_type: string;
  status: ApplicationStatus;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  confidence_score: number | null;
  ai_explanation: string | null;
  extracted_data: ExtractedData | null;
  flags: Flag[] | null;
  cross_reference_results: CrossReferenceResults | null;
  document_quality: DocumentQuality | null;
  evidence_annotations: EvidenceAnnotation[] | null;
  regulatory_flags: RegulatoryFlag[] | null;
  regulatory_priority: string | null;
  voice_verification: VoiceVerification | null;
  facial_match: FacialMatch | null;
  selfie_url: string | null;
  voice_url: string | null;
  review_decision: string | null;
  review_reason: string | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  retry_count: number;
  processing_error: string | null;
  document_urls: string[];
}

export type ApplicationStatus =
  | 'submitted'
  | 'processing'
  | 'processing_failed'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'needs_info';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ExtractedData {
  full_name: string;
  date_of_birth: string;
  document_number: string;
  expiry_date: string | null;
  issuing_authority: string;
}

export interface Flag {
  description: string;
  severity: 'critical' | 'warning' | 'info';
  field?: string;
}

export interface CrossReferenceResults {
  name_match: boolean;
  dob_match: boolean;
  name_discrepancy: string | null;
  dob_discrepancy: string | null;
  document_expired: boolean;
  other_discrepancies: string[];
}

export interface DocumentQuality {
  overall_quality: 'good' | 'fair' | 'poor';
  is_blurry: boolean;
  is_cropped: boolean;
  resolution_adequate: boolean;
  issues: string[];
}

export interface RegulatoryFlag {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  regulation: string;
  fintrac_obligation: string;
}

export interface EvidenceAnnotation {
  field: string;
  extracted_value: string | null;
  submitted_value: string | null;
  location: string;
  issue_type: 'match' | 'mismatch' | 'blur' | 'tampering' | 'quality' | 'expiry' | 'info';
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export interface ApplicationListResponse {
  applications: Application[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogEntry {
  id: string;
  application_id: string | null;
  action: string;
  actor: string;
  timestamp: string;
  details: Record<string, unknown> | null;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
}

export interface Stats {
  total_applications: number;
  pending_review: number;
  approved: number;
  rejected: number;
  processing: number;
  processing_failed: number;
  needs_info: number;
  high_risk: number;
  medium_risk: number;
  low_risk: number;
  average_risk_score: number | null;
  average_confidence: number | null;
  approval_rate: number | null;
  risk_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  feedback_queue_size: number;
}

export interface ReviewRequest {
  decision: 'approved' | 'rejected' | 'needs_info';
  reason: string;
  notes?: string;
  reviewer?: string;
}

export interface FeedbackRequest {
  feedback_type: string;
  category: string;
  notes?: string;
  reviewer?: string;
}

export interface FeedbackEntry {
  id: string;
  application_id: string;
  feedback_type: string;
  category: string;
  notes: string | null;
  ai_risk_level: string | null;
  ai_risk_score: number | null;
  created_by: string;
  created_at: string;
  status: string;
}

export interface FeedbackQueueResponse {
  entries: FeedbackEntry[];
  total: number;
}

export interface RegulatorySimRequest {
  pep_match: boolean;
  high_risk_country: boolean;
  sanctions_hit: boolean;
  adverse_media: boolean;
}

export interface RegulatorySimResponse {
  original_risk_score: number | null;
  original_risk_level: string | null;
  adjusted_risk_score: number;
  adjusted_risk_level: string;
  adjustments: Array<{
    factor: string;
    boost: number;
    regulation: string;
    note?: string;
    programs_checked?: string[];
  }>;
  fintrac_flags: string[];
  priority: string;
  explanation: string;
}

export interface AdversarialScenario {
  id: string;
  name: string;
  description: string;
  attack_type: string;
  expected_outcome: string;
}

export interface AdversarialTestResponse {
  application_id: string;
  scenario: AdversarialScenario;
  message: string;
}

export interface FacialMatch {
  match_result: 'match' | 'mismatch' | 'inconclusive' | 'error';
  confidence: number;
  similarity_score: number;
  document_photo_quality: string;
  selfie_quality: string;
  face_detected_in_document: boolean;
  face_detected_in_selfie: boolean;
  key_observations: Array<{
    feature: string;
    assessment: string;
    note: string;
  }>;
  anomalies: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    description: string;
  }>;
  explanation: string;
}

export interface VoiceVerification {
  passphrase_match: boolean;
  passphrase_similarity: number;
  transcription: string;
  expected_passphrase: string;
  spoken_name: string | null;
  name_matches_claim: boolean;
  audio_quality: string;
  confidence: number;
  language_detected: string;
  anomalies: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    description: string;
  }>;
  verification_result: string;
  explanation: string;
}

export interface CheckConfig {
  enabled: boolean;
  label: string;
}

export interface ScreeningConfig {
  checks: Record<string, CheckConfig>;
  high_risk_countries: string[];
  elevated_countries: string[];
  sanctioned_countries: string[];
  sanctions_programs: string[];
  thresholds: {
    ai_confidence_min: number;
    risk_high: number;
    risk_medium: number;
  };
  boosts: {
    high_risk_country: number;
    elevated_country: number;
    expired_document: number;
    low_confidence: number;
    sanctions_match: number;
    pep_match: number;
    adverse_media: number;
  };
}
