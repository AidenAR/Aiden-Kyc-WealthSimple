import { Link } from 'react-router-dom';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getApplications } from '@/lib/api';
import { useViewMode } from '@/hooks/useViewMode';
import { StatusBadge } from '@/components/StatusBadge';
import { cn, formatDate, documentTypeLabel } from '@/lib/utils';

const STATUS_INFO: Record<string, { icon: typeof Clock; color: string; message: string }> = {
  submitted: {
    icon: Clock,
    color: 'text-blue-600',
    message: 'Your application has been received and is in the queue for review.',
  },
  processing: {
    icon: Loader2,
    color: 'text-indigo-600',
    message: 'Your documents are being verified. This usually takes a few minutes.',
  },
  pending_review: {
    icon: Clock,
    color: 'text-amber-600',
    message: 'Document verification is complete. A compliance officer will review shortly.',
  },
  approved: {
    icon: CheckCircle,
    color: 'text-emerald-600',
    message: 'Your identity has been verified. You\'re all set!',
  },
  rejected: {
    icon: XCircle,
    color: 'text-red-600',
    message: 'Your application could not be verified. Please check details for next steps.',
  },
  needs_info: {
    icon: AlertCircle,
    color: 'text-purple-600',
    message: 'We need additional information to complete your verification.',
  },
  processing_failed: {
    icon: AlertCircle,
    color: 'text-red-600',
    message: 'There was an issue processing your documents. Our team has been notified.',
  },
};

export function ApplicantDashboard() {
  const { profile } = useViewMode();

  const { data, isLoading } = useQuery({
    queryKey: ['myApplications', profile?.email],
    queryFn: () => getApplications({ email: profile!.email }),
    refetchInterval: 3000,
    enabled: !!profile?.email,
  });

  const applications = data?.applications;

  if (!profile) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p className="text-lg font-medium">No profile set</p>
        <p className="text-sm mt-1">Switch to the applicant view and set up your profile to see your applications.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">My Applications</h1>
        <p className="text-muted-foreground mt-1">
          Showing applications for <span className="font-medium text-foreground">{profile.email}</span>
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !applications || applications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No applications yet</p>
          <p className="text-sm mt-1 mb-4">Submit your identity documents to get started.</p>
          <Link
            to="/"
            className="inline-flex px-4 py-2 bg-accent text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            Submit Application
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const info = STATUS_INFO[app.status] || STATUS_INFO.submitted;
            const Icon = info.icon;

            return (
              <Link
                key={app.id}
                to={`/application/${app.id}`}
                className="block bg-card rounded-xl border border-border p-5 hover:border-accent/40 transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-muted shrink-0 mt-0.5">
                      <Icon className={cn('h-5 w-5', info.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground">
                          {app.first_name} {app.last_name}
                        </span>
                        <StatusBadge status={app.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mb-1.5">{info.message}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{documentTypeLabel(app.document_type)}</span>
                        <span>&middot;</span>
                        <span>Submitted {formatDate(app.created_at)}</span>
                        <span>&middot;</span>
                        <code className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
                          {app.id.slice(0, 8)}
                        </code>
                      </div>
                    </div>
                  </div>
                  <svg className="h-5 w-5 text-muted-foreground shrink-0 mt-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {app.status === 'approved' && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                      <CheckCircle className="h-4 w-4" />
                      Identity verified successfully
                    </div>
                  </div>
                )}

                {app.status === 'needs_info' && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-2 text-purple-600 text-sm font-medium">
                      <AlertCircle className="h-4 w-4" />
                      Action required — please check details
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
