import { useState, useEffect } from 'react';
import { MessageSquareWarning, ChevronDown, ChevronUp, Loader2, CheckCircle } from 'lucide-react';
import { submitFeedback, getFeedbackCategories } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { cn } from '@/lib/utils';

const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  disagree_risk: 'Risk Assessment Incorrect',
  disagree_extraction: 'Data Extraction Error',
  false_positive_flag: 'False Positive Flag',
  missing_flag: 'Missing Flag',
  other: 'Other',
};

export function FeedbackPanel({ applicationId }: { applicationId: string }) {
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [categories, setCategories] = useState<Record<string, string[]>>({});

  useEffect(() => {
    getFeedbackCategories().then(setCategories).catch(() => {});
  }, []);

  const currentCategories = feedbackType ? (categories[feedbackType] || []) : [];

  async function handleSubmit() {
    if (!feedbackType || !category) return;
    setSubmitting(true);
    try {
      await submitFeedback(applicationId, {
        feedback_type: feedbackType,
        category,
        notes: notes || undefined,
      });
      setSubmitted(true);
      addToast('Feedback logged to retraining queue', 'success');
    } catch {
      addToast('Failed to submit feedback', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Feedback logged to retraining queue</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          This creates a closed loop — overrides feed back to improve the model over time, reducing escalation rate.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">Disagree with AI?</span>
          <span className="text-xs text-muted-foreground">Log feedback for model improvement</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Feedback Type</label>
            <select
              value={feedbackType}
              onChange={(e) => { setFeedbackType(e.target.value); setCategory(''); }}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select type...</option>
              {Object.entries(FEEDBACK_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {feedbackType && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select category...</option>
                {currentCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Provide additional context for the ML team..."
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!feedbackType || !category || submitting}
            className={cn(
              'w-full py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2',
              'bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <MessageSquareWarning className="h-4 w-4" />
                Log to Retraining Queue
              </>
            )}
          </button>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Feedback is logged to a retraining queue visible to the ML team. Over time, these overrides
            reduce false positives and improve the AI's accuracy for edge cases like name transliterations,
            regional document styles, and cultural name variations.
          </p>
        </div>
      )}
    </div>
  );
}
