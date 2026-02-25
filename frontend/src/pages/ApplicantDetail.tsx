import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  FileText,
  User,
  Shield,
} from 'lucide-react';
import { useApplication } from '@/hooks/useApplications';
import { StatusBadge } from '@/components/StatusBadge';
import { cn, formatDate, documentTypeLabel } from '@/lib/utils';
import { useViewMode } from '@/hooks/useViewMode';

const STATUS_STEPS = [
  { key: 'submitted', label: 'Submitted', icon: FileText },
  { key: 'processing', label: 'Verifying', icon: Loader2 },
  { key: 'pending_review', label: 'Under Review', icon: Clock },
  { key: 'decision', label: 'Decision', icon: Shield },
];

function getStepIndex(status: string): number {
  if (status === 'submitted') return 0;
  if (status === 'processing') return 1;
  if (status === 'pending_review' || status === 'processing_failed') return 2;
  return 3;
}

function getDecisionInfo(status: string) {
  if (status === 'approved')
    return { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800', label: 'Approved', message: 'Your identity has been successfully verified. You can now proceed with your account.' };
  if (status === 'rejected')
    return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800', label: 'Not Verified', message: 'We were unable to verify your identity. Please review the reason below and contact support if needed.' };
  if (status === 'needs_info')
    return { icon: AlertCircle, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800', label: 'More Info Needed', message: 'We need additional information to complete your verification. Please see the details below.' };
  return null;
}

export function ApplicantDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useViewMode();
  const { data: app, isLoading } = useApplication(id!);

  const backPath = isAdmin ? '/dashboard' : '/my-applications';

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
        <Link to={backPath} className="text-sm text-accent hover:underline mt-2 inline-block">
          Back
        </Link>
      </div>
    );
  }

  const stepIdx = getStepIndex(app.status);
  const decision = getDecisionInfo(app.status);

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to={backPath}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Applications
      </Link>

      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {app.first_name} {app.last_name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {documentTypeLabel(app.document_type)} &middot; Submitted {formatDate(app.created_at)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Application ID: <code className="bg-muted px-1.5 py-0.5 rounded">{app.id.slice(0, 8)}</code>
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        {/* Progress steps */}
        <div className="flex items-center gap-0 mb-2">
          {STATUS_STEPS.map((step, i) => {
            const isComplete = i < stepIdx;
            const isCurrent = i === stepIdx;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all',
                      isComplete
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : isCurrent
                          ? 'bg-accent border-accent text-white dark:text-black'
                          : 'bg-muted border-border text-muted-foreground',
                    )}
                  >
                    {isComplete ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Icon className={cn('h-5 w-5', isCurrent && step.key === 'processing' && 'animate-spin')} />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs mt-1.5 font-medium',
                      isComplete || isCurrent ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1 -mt-5',
                      i < stepIdx ? 'bg-emerald-500' : 'bg-border',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Decision card */}
      {decision && (
        <div className={cn('rounded-xl border p-5 mb-6', decision.bg)}>
          <div className="flex items-start gap-3">
            <decision.icon className={cn('h-6 w-6 shrink-0 mt-0.5', decision.color)} />
            <div>
              <h2 className={cn('text-lg font-semibold', decision.color)}>{decision.label}</h2>
              <p className="text-sm text-foreground/80 mt-1">{decision.message}</p>
              {app.review_reason && (
                <p className="text-sm text-foreground/70 mt-2">
                  <span className="font-medium">Reason:</span> {app.review_reason}
                </p>
              )}
              {app.review_notes && (
                <p className="text-sm text-foreground/70 mt-1">
                  <span className="font-medium">Notes:</span> {app.review_notes}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status message for in-progress */}
      {!decision && (
        <div className="bg-card rounded-xl border border-border p-5 mb-6">
          <div className="flex items-start gap-3">
            {app.status === 'processing' ? (
              <>
                <Loader2 className="h-5 w-5 text-indigo-600 animate-spin shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Verifying Your Documents</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Our system is analyzing your identity documents. This usually takes 1–3 minutes.
                    You can leave this page and come back — we'll update the status automatically.
                  </p>
                </div>
              </>
            ) : app.status === 'pending_review' ? (
              <>
                <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Under Review</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Document verification is complete. A compliance officer will review your
                    application shortly. Most reviews are completed within 24 hours.
                  </p>
                </div>
              </>
            ) : app.status === 'processing_failed' ? (
              <>
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Processing Issue</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    There was an issue processing your documents. Our team has been notified
                    and is looking into it. You may be asked to resubmit your documents.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Application Received</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your application has been received and is in the queue. We'll begin
                    verifying your documents shortly.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Submitted info */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-accent" />
          Your Submitted Information
        </h2>
        <div className="divide-y divide-border">
          {[
            ['Name', `${app.first_name} ${app.last_name}`],
            ...(app.email ? [['Email', app.email]] : []),
            ['Date of Birth', app.date_of_birth],
            ['Address', app.address],
            ['Country', app.country],
            ['Document Type', documentTypeLabel(app.document_type)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-2.5 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="text-foreground font-medium text-right max-w-[60%]">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
