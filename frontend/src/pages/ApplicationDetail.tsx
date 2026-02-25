import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Shield,
  FileText,
  Loader2,
  User,
  History,
  Zap,
} from 'lucide-react';
import { useApplication, useReviewApplication } from '@/hooks/useApplications';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useToast } from '@/components/Toast';
import { reprocessApplication } from '@/lib/api';
import { RiskBadge } from '@/components/RiskBadge';
import { RiskGauge } from '@/components/RiskGauge';
import { Timeline } from '@/components/Timeline';
import { EvidencePanel } from '@/components/EvidencePanel';
import { FeedbackPanel } from '@/components/FeedbackPanel';
import { RegulatoryFlags } from '@/components/RegulatoryFlags';
import { VoiceVerificationPanel } from '@/components/VoiceVerificationPanel';
import { FacialMatchPanel } from '@/components/FacialMatchPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { cn, formatDate, documentTypeLabel } from '@/lib/utils';
import type { Flag } from '@/types';

const REVIEW_REASONS = [
  'AI Assessment Correct',
  'AI Incorrect',
  'Suspicious Behavior',
  'Additional Context Needed',
  'Confirmed Risk',
  'Document Verified Manually',
  'Other',
];

export function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: app, isLoading } = useApplication(id!);
  const reviewMutation = useReviewApplication();
  const { addToast } = useToast();
  const { data: auditData } = useAuditLog({ application_id: id });
  const [decision, setDecision] = useState<string>('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const prevStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!app) return;
    const prev = prevStatusRef.current;
    if (prev !== undefined && prev !== app.status) {
      if (prev === 'submitted' && app.status === 'processing') {
        addToast('AI analysis started...', 'info');
      } else if (prev === 'processing' && app.status === 'pending_review') {
        addToast('AI analysis complete — ready for review', 'success');
      } else if (app.status === 'processing_failed') {
        addToast('Processing failed — check error details', 'error');
      }
    }
    prevStatusRef.current = app.status;
  }, [app?.status, addToast]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="text-center py-20">
        <p className="text-lg text-muted-foreground">Application not found</p>
        <Link to="/dashboard" className="text-sm text-accent hover:underline mt-2 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const canReview = app.status === 'pending_review' || app.status === 'processing_failed';

  async function handleReview() {
    if (!decision || !reason) {
      setReviewError('Decision and reason are required');
      return;
    }
    setReviewError(null);
    try {
      await reviewMutation.mutateAsync({
        id: app!.id,
        review: {
          decision: decision as 'approved' | 'rejected' | 'needs_info',
          reason,
          notes: notes || undefined,
        },
      });
      setDecision('');
      setReason('');
      setNotes('');
      const labels = { approved: 'approved', rejected: 'rejected', needs_info: 'flagged for more info' };
      addToast(`Application ${labels[decision as keyof typeof labels] || decision}`, 'success');
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Review failed');
      addToast('Review submission failed', 'error');
    }
  }

  return (
    <div>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {app.first_name} {app.last_name}
          </h1>
          {app.email && (
            <p className="text-sm text-muted-foreground mt-0.5">{app.email}</p>
          )}
          <p className="text-muted-foreground text-sm mt-0.5">
            {documentTypeLabel(app.document_type)} &middot; Submitted {formatDate(app.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={app.status} />
          <RiskBadge level={app.risk_level} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Document + Submitted data */}
        <div className="space-y-6">
          {app.document_urls && app.document_urls.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                Identity Document{app.document_urls.length > 1 ? 's' : ''}
                {app.document_urls.length > 1 && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({app.document_urls.length})
                  </span>
                )}
              </h2>
              <div className="space-y-3">
                {app.document_urls.map((url, i) => (
                  <div key={i}>
                    {app.document_urls.length > 1 && (
                      <p className="text-xs text-muted-foreground mb-1.5">Document {i + 1}</p>
                    )}
                    <DocumentPreview url={url} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-accent" />
              Submitted Information
            </h2>
            <DataTable
              rows={[
                ['First Name', app.first_name],
                ['Last Name', app.last_name],
                ['Date of Birth', app.date_of_birth],
                ['Address', app.address],
                ['Country', app.country],
                ['Document Type', documentTypeLabel(app.document_type)],
              ]}
            />
          </div>
        </div>

        {/* Right column: AI Analysis + Review */}
        <div className="space-y-6">
          {app.extracted_data && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" />
                Extracted vs. Submitted
              </h2>
              <ComparisonTable app={app} />
            </div>
          )}

          {app.risk_score !== null && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">AI Risk Assessment</h2>
              <div className="flex items-center justify-center gap-8 mb-4">
                <RiskGauge value={app.risk_score!} label="Risk Score" colorScheme="risk" />
                {app.confidence_score !== null && (
                  <RiskGauge value={app.confidence_score} label="Confidence" colorScheme="confidence" />
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <RiskBadge level={app.risk_level} />
                  <span className="text-xs text-muted-foreground">Risk Level</span>
                </div>
              </div>
              {app.ai_explanation && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm text-foreground leading-relaxed">{app.ai_explanation}</p>
                </div>
              )}
            </div>
          )}

          {app.regulatory_flags && app.regulatory_flags.length > 0 && (
            <div className="bg-card rounded-xl border-2 border-red-200 dark:border-red-800 p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-red-500" />
                Regulatory Screening
                <span className="text-xs text-muted-foreground font-normal">auto-detected</span>
              </h2>
              <RegulatoryFlags flags={app.regulatory_flags} priority={app.regulatory_priority} />
            </div>
          )}

          {app.flags && app.flags.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">AI Flags</h2>
              <div className="space-y-2">
                {app.flags.map((flag: Flag, i: number) => (
                  <FlagItem key={i} flag={flag} />
                ))}
              </div>
            </div>
          )}

          {app.evidence_annotations && app.evidence_annotations.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-500" />
                Evidence Annotations
                <span className="text-xs text-muted-foreground font-normal">AI forensic analysis</span>
              </h2>
              <EvidencePanel annotations={app.evidence_annotations} />
            </div>
          )}

          {app.facial_match && (
            <FacialMatchPanel data={app.facial_match} selfieUrl={app.selfie_url} />
          )}

          {app.voice_verification && (
            <VoiceVerificationPanel data={app.voice_verification} voiceUrl={app.voice_url} />
          )}

          {app.document_quality && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">Document Quality</h2>
              <DataTable
                rows={[
                  ['Overall Quality', app.document_quality.overall_quality],
                  ['Blurry', app.document_quality.is_blurry ? 'Yes' : 'No'],
                  ['Cropped', app.document_quality.is_cropped ? 'Yes' : 'No'],
                  ['Resolution', app.document_quality.resolution_adequate ? 'Adequate' : 'Inadequate'],
                ]}
              />
              {app.document_quality.issues.length > 0 && (
                <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
                  {app.document_quality.issues.map((issue: string, i: number) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {app.reviewed_at && (
            <div className={cn(
              "rounded-xl border p-5",
              app.reviewed_by === 'ai_auto_approve'
                ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                : "bg-card border-border"
            )}>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                Review Decision
                {app.reviewed_by === 'ai_auto_approve' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700">
                    <Zap className="h-2.5 w-2.5" />
                    AI Auto-Approved
                  </span>
                )}
              </h2>
              <DataTable
                rows={[
                  ['Decision', app.review_decision ?? ''],
                  ['Reason', app.review_reason ?? ''],
                  ['Reviewed By', app.reviewed_by === 'ai_auto_approve' ? 'AI System (Auto-Approve)' : (app.reviewed_by ?? '')],
                  ['Reviewed At', app.reviewed_at ? formatDate(app.reviewed_at) : ''],
                  ...(app.review_notes ? [['Notes', app.review_notes] as [string, string]] : []),
                ]}
              />
            </div>
          )}

          {app.processing_error && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Processing Error</h2>
              <p className="text-sm text-red-700 dark:text-red-400">{app.processing_error}</p>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">Retries: {app.retry_count}/3</p>
              <button
                onClick={async () => {
                  setReprocessing(true);
                  try {
                    await reprocessApplication(app.id);
                    addToast('Application sent for reprocessing', 'success');
                  } catch {
                    addToast('Failed to reprocess', 'error');
                  } finally {
                    setReprocessing(false);
                  }
                }}
                disabled={reprocessing}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition disabled:opacity-50"
              >
                {reprocessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                Reprocess Application
              </button>
            </div>
          )}

          {auditData && auditData.entries.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <History className="h-4 w-4 text-accent" />
                Application Timeline
              </h2>
              <Timeline entries={auditData.entries} />
            </div>
          )}

          {canReview && (
            <div className="bg-card rounded-xl border-2 border-accent/30 p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Submit Review</h2>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {(['approved', 'rejected', 'needs_info'] as const).map((d) => {
                  const icons = { approved: CheckCircle, rejected: XCircle, needs_info: Info };
                  const labels = { approved: 'Approve', rejected: 'Reject', needs_info: 'Need Info' };
                  const colors = {
                    approved: 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400',
                    rejected: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
                    needs_info: 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400',
                  };
                  const Icon = icons[d];
                  return (
                    <button
                      key={d}
                      onClick={() => setDecision(d)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 text-sm font-medium transition-all',
                        decision === d
                          ? colors[d]
                          : 'border-border hover:border-accent/30'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {labels[d]}
                    </button>
                  );
                })}
              </div>

              <div className="mb-3">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select reason...</option>
                  {REVIEW_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Additional observations..."
                />
              </div>

              {reviewError && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-2 text-sm text-red-700 dark:text-red-400 mb-3">
                  {reviewError}
                </div>
              )}

              <button
                onClick={handleReview}
                disabled={!decision || !reason || reviewMutation.isPending}
                className="w-full py-2.5 bg-accent text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {reviewMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Review'
                )}
              </button>
            </div>
          )}

          {app.risk_score !== null && (
            <FeedbackPanel applicationId={app.id} />
          )}

          {app.status !== 'submitted' && app.status !== 'processing' && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Reprocess
              </h2>
              <p className="text-xs text-muted-foreground mb-3">
                Send this application back through AI analysis. All previous results will be cleared.
              </p>
              <button
                onClick={async () => {
                  setReprocessing(true);
                  try {
                    await reprocessApplication(app.id);
                    addToast('Application sent for reprocessing', 'success');
                  } catch {
                    addToast('Failed to reprocess', 'error');
                  } finally {
                    setReprocessing(false);
                  }
                }}
                disabled={reprocessing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white dark:text-black rounded-lg text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                {reprocessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                Reprocess Application
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DataTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="divide-y divide-border">
      {rows.map(([label, value], i) => (
        <div key={i} className="flex justify-between py-2 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-foreground font-medium text-right max-w-[60%]">{value}</span>
        </div>
      ))}
    </div>
  );
}

function ComparisonTable({ app }: { app: ReturnType<typeof useApplication>['data'] }) {
  if (!app?.extracted_data) return null;

  const rows: { label: string; submitted: string; extracted: string }[] = [
    {
      label: 'Name',
      submitted: `${app.first_name} ${app.last_name}`,
      extracted: app.extracted_data.full_name ?? '—',
    },
    {
      label: 'Date of Birth',
      submitted: app.date_of_birth,
      extracted: app.extracted_data.date_of_birth ?? '—',
    },
    {
      label: 'Document #',
      submitted: '—',
      extracted: app.extracted_data.document_number ?? '—',
    },
    {
      label: 'Expiry',
      submitted: '—',
      extracted: app.extracted_data.expiry_date ?? '—',
    },
    {
      label: 'Issuing Authority',
      submitted: '—',
      extracted: app.extracted_data.issuing_authority ?? '—',
    },
  ];

  const nameMatch = app.cross_reference_results?.name_match;
  const dobMatch = app.cross_reference_results?.dob_match;

  return (
    <div className="divide-y divide-border">
      <div className="grid grid-cols-3 gap-2 py-2 text-xs font-semibold text-muted-foreground uppercase">
        <span>Field</span>
        <span>Submitted</span>
        <span>Extracted</span>
      </div>
      {rows.map((row, i) => {
        let isMatch = true;
        if (row.label === 'Name' && nameMatch === false) isMatch = false;
        if (row.label === 'Date of Birth' && dobMatch === false) isMatch = false;

        return (
          <div
            key={i}
            className={cn(
              'grid grid-cols-3 gap-2 py-2 text-sm',
              !isMatch && 'bg-red-50 dark:bg-red-950/30 -mx-2 px-2 rounded'
            )}
          >
            <span className="text-muted-foreground">{row.label}</span>
            <span className="text-foreground">{row.submitted}</span>
            <span className={cn('font-medium', !isMatch ? 'text-red-700 dark:text-red-400' : 'text-foreground')}>
              {row.extracted}
              {!isMatch && <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-red-500" />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FlagItem({ flag }: { flag: Flag }) {
  const styles = {
    critical: { bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', icon: 'text-red-600 dark:text-red-400', text: 'text-red-800 dark:text-red-300' },
    warning: { bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800', icon: 'text-amber-600 dark:text-amber-400', text: 'text-amber-800 dark:text-amber-300' },
    info: { bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800', icon: 'text-blue-600 dark:text-blue-400', text: 'text-blue-800 dark:text-blue-300' },
  };
  const s = styles[flag.severity] || styles.info;
  const icons = { critical: XCircle, warning: AlertTriangle, info: Info };
  const Icon = icons[flag.severity] || Info;

  return (
    <div className={cn('flex items-start gap-2 p-2.5 rounded-lg border', s.bg)}>
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', s.icon)} />
      <div>
        <p className={cn('text-sm font-medium', s.text)}>{flag.description}</p>
        {flag.field && (
          <p className="text-xs text-muted-foreground mt-0.5">Field: {flag.field}</p>
        )}
      </div>
    </div>
  );
}

function DocumentPreview({ url }: { url: string }) {
  const [usePdf, setUsePdf] = useState(false);

  if (usePdf) {
    return (
      <object
        data={url}
        type="application/pdf"
        className="w-full h-[500px] rounded-lg border border-border"
      >
        <p className="text-sm text-muted-foreground p-4">
          PDF preview not supported.{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            Download document
          </a>
        </p>
      </object>
    );
  }

  return (
    <img
      src={url}
      alt="Identity document"
      className="w-full rounded-lg border border-border"
      onError={() => setUsePdf(true)}
    />
  );
}
