import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Trash2, Copy, CheckCircle, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { listApiKeys, createApiKey, revokeApiKey } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { cn, formatDate } from '@/lib/utils';

export function ApiKeys() {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys, isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: listApiKeys,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createApiKey(name),
    onSuccess: (data) => {
      setRevealedKey(data.key);
      setNewKeyName('');
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      addToast('API key created', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      addToast('API key revoked', 'success');
    },
    onError: (err: Error) => addToast(err.message, 'error'),
  });

  async function copyKey() {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">API Keys</h1>
        <p className="text-muted-foreground mt-1">
          Manage API keys for the VeriFlow public REST API.
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-accent" />
          Create New Key
        </h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. 'Production', 'Staging')"
            className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => createMutation.mutate(newKeyName)}
            disabled={!newKeyName.trim() || createMutation.isPending}
            className="px-4 py-2 bg-accent text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
            Generate
          </button>
        </div>

        {revealedKey && (
          <div className="mt-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Save this key now — it won't be shown again.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black/5 dark:bg-white/10 px-3 py-2 rounded-lg text-sm font-mono text-foreground break-all">
                {revealedKey}
              </code>
              <button
                onClick={copyKey}
                className="shrink-0 p-2 rounded-lg bg-card border border-border hover:bg-muted transition-colors"
              >
                {copied ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <Key className="h-4 w-4 text-accent" />
          Quick Start
        </h2>
        <p className="text-xs text-muted-foreground mb-3">Use your API key with the VeriFlow REST API:</p>
        <pre className="bg-muted rounded-lg p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
{`curl -X POST /api/v1/verify \\
  -H "X-API-Key: vf_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "date_of_birth": "1990-01-15",
    "address": "123 Main St, Toronto, ON",
    "country": "Canada",
    "document_type": "passport",
    "document_base64": "<base64 image>",
    "selfie_base64": "<base64 image>"
  }'`}
        </pre>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-muted rounded-lg p-2.5">
            <p className="font-medium text-foreground mb-0.5">Submit Verification</p>
            <code className="text-muted-foreground">POST /api/v1/verify</code>
          </div>
          <div className="bg-muted rounded-lg p-2.5">
            <p className="font-medium text-foreground mb-0.5">Check Status</p>
            <code className="text-muted-foreground">GET /api/v1/status/:id</code>
          </div>
          <div className="bg-muted rounded-lg p-2.5">
            <p className="font-medium text-foreground mb-0.5">List Verifications</p>
            <code className="text-muted-foreground">GET /api/v1/verifications</code>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Key className="h-4 w-4 text-accent" />
            Active Keys
          </h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !keys || keys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No API keys yet. Create one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-1.5 rounded-lg bg-muted shrink-0">
                    <Key className="h-4 w-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{k.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <code>{k.key_prefix}...</code>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created {formatDate(k.created_at)}
                      </span>
                      {k.last_used_at && (
                        <span>Last used {formatDate(k.last_used_at)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Revoke key "${k.name}"? This cannot be undone.`)) {
                      revokeMutation.mutate(k.id);
                    }
                  }}
                  className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
