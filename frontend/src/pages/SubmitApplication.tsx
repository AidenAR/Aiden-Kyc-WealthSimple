import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, CheckCircle, Loader2, X, Mic } from 'lucide-react';
import { submitApplication } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { WebcamCapture } from '@/components/WebcamCapture';

const DOCUMENT_TYPES = [
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
];

export function SubmitApplication() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  function addDocumentFiles(files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files);
    setDocumentFiles((prev) => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, 5);
    });
  }

  function removeDocumentFile(index: number) {
    setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    formData.delete('documents');
    for (const file of documentFiles) {
      formData.append('documents', file);
    }
    if (selfieFile) {
      formData.set('selfie', selfieFile);
    }
    if (voiceBlob) {
      formData.set('voice_sample', new File([voiceBlob], 'voice.webm', { type: voiceBlob.type }));
    }

    try {
      const result = await submitApplication(formData);
      setSubmitted(result);
      addToast('Application submitted successfully', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
      addToast('Submission failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Application Submitted</h2>
          <p className="text-muted-foreground mb-1">Your application has been received and is being processed.</p>
          <p className="text-sm text-muted-foreground mb-6">
            Application ID: <code className="bg-muted px-2 py-0.5 rounded text-xs">{submitted.id}</code>
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(`/application/${submitted.id}`)}
              className="px-4 py-2 bg-accent text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition"
            >
              View Application
            </button>
            <button
              onClick={() => { setSubmitted(null); setDocumentFiles([]); setSelfieFile(null); }}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-muted transition"
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Submit KYC Application</h1>
        <p className="text-muted-foreground mt-1">
          Provide your personal information and upload an identity document for verification.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Email <span className="text-red-500">*</span></label>
          <input
            name="email"
            type="email"
            required
            defaultValue={user?.email || ''}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@example.com"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">First Name <span className="text-red-500">*</span></label>
            <input
              name="first_name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="John"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Last Name <span className="text-red-500">*</span></label>
            <input
              name="last_name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Doe"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Date of Birth <span className="text-red-500">*</span></label>
            <input
              name="date_of_birth"
              type="date"
              required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Country <span className="text-red-500">*</span></label>
            <input
              name="country"
              required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Canada"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Address <span className="text-red-500">*</span></label>
          <textarea
            name="address"
            required
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="123 Main Street, Toronto, ON M5V 1A1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Document Type <span className="text-red-500">*</span></label>
          <select
            name="document_type"
            required
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Select document type...</option>
            {DOCUMENT_TYPES.map((dt) => (
              <option key={dt.value} value={dt.value}>
                {dt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Identity Documents <span className="text-red-500">*</span> <span className="text-muted-foreground font-normal">(up to 5)</span>
          </label>
          <div className="border-2 border-dashed border-input rounded-lg p-6 text-center hover:border-accent transition-colors">
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              Upload front, back, or supporting documents
            </p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              onChange={(e) => addDocumentFiles(e.target.files)}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent file:text-white dark:file:text-black hover:file:opacity-90 file:cursor-pointer"
            />
            <p className="text-xs text-muted-foreground mt-2">JPG, PNG, WebP, or PDF. Max 5 MB each.</p>
          </div>
          {documentFiles.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {documentFiles.map((file, i) => (
                <div key={i} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 text-sm">
                  <span className="text-foreground truncate mr-2">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeDocumentFile(i)}
                    className="text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Live Selfie <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Take a live photo using your camera. This will be compared with the photo on your ID.
          </p>
          <WebcamCapture onCapture={setSelfieFile} />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5 flex items-center gap-2">
            <Mic className="h-4 w-4 text-accent" />
            Voice Verification <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <p className="text-xs text-muted-foreground mb-3">
            Record yourself reading the passphrase below for voice biometric verification.
          </p>
          <VoiceRecorder
            passphrase={
              firstName && lastName
                ? `My name is ${firstName} ${lastName} and I am verifying my identity`
                : 'Enter your name above to see the passphrase'
            }
            onRecorded={setVoiceBlob}
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || documentFiles.length === 0 || !selfieFile}
          className="w-full py-2.5 bg-accent text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Application'
          )}
        </button>
      </form>
    </div>
  );
}
