import React, { useState, useEffect } from 'react';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import type { PlatformPolicy } from '@/types/shopkeeper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Scale, Lock, FileText, CheckCircle2, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';

export const TermsPage: React.FC = () => {
  const { user } = useShopkeeper();
  const [terms, setTerms] = useState<PlatformPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Digital Acceptance State
  const [hasAcceptedCheckbox, setHasAcceptedCheckbox] = useState(false);
  const [consentStatus, setConsentStatus] = useState<{
    accepted: boolean;
    version?: string;
    accepted_at?: string;
  }>({ accepted: false });

  const activeVersion = terms[0]?.version || 'v2.6';

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await shopkeeperApi.getTerms();
      setTerms(data);

      const termsVer = data[0]?.version || 'v2.6';
      if (user?.shop_id) {
        const consent = await shopkeeperApi.getConsentStatus(user.shop_id, 'terms', termsVer);
        setConsentStatus(consent);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.shop_id]);

  // Digital Acceptance Submission
  const handleAcceptTerms = async () => {
    if (!hasAcceptedCheckbox) {
      toast.error('Please check the acknowledgment box before accepting Terms & Conditions.');
      return;
    }
    if (!user?.shop_id) return;

    setSubmitting(true);
    try {
      const success = await shopkeeperApi.recordConsent(
        user.shop_id,
        user.id || user.shop_id,
        'terms',
        activeVersion
      );

      if (success) {
        toast.success(`Platform Terms & Conditions (Version ${activeVersion}) accepted successfully!`);
        setConsentStatus({
          accepted: true,
          version: activeVersion,
          accepted_at: new Date().toISOString(),
        });
      } else {
        toast.error('Failed to record acceptance. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase font-semibold text-muted-foreground">
              Merchant Agreement &amp; SLA
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            Terms &amp; Conditions
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Platform Service Level Agreement (SLA), commission schedules, pricing integrity, and merchant covenants.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {consentStatus.accepted ? (
            <Badge className="bg-emerald-600 text-white text-xs font-heading font-bold rounded-lg px-3 py-1 gap-1.5 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Accepted on {new Date(consentStatus.accepted_at || Date.now()).toLocaleDateString()} (Version {consentStatus.version})</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10 text-xs font-heading font-bold rounded-lg px-3 py-1 gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Acceptance Required for {activeVersion}</span>
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs rounded-lg gap-1.5 h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Terms Documents from Database */}
      <div className="space-y-4">
        {terms.map((item) => (
          <Card key={item.id} className="bg-card border-border rounded-xl shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary shrink-0" />
                  <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                    {item.title}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px] font-mono rounded-md">
                    Version: {item.version || 'v2.6'}
                  </Badge>
                  {item.published_at && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      Published: {new Date(item.published_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="font-sans text-xs md:text-sm text-foreground/90 whitespace-pre-line leading-relaxed bg-muted/20 p-4 rounded-lg border border-border">
                {item.content}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Digital Acceptance Section */}
      <Card className="bg-card border-border rounded-xl shadow-sm">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
            <Check className="w-4 h-4 text-primary" />
            <span>Merchant Digital Acceptance</span>
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground font-sans">
            Legal acknowledgment of platform Service Level Agreement and terms by registered shopkeepers.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 md:p-6 space-y-4">
          {consentStatus.accepted ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-400">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-heading font-bold text-sm">
                    Terms &amp; Conditions Accepted for Shop: {user?.shop_id}
                  </div>
                  <div className="text-xs text-muted-foreground font-sans">
                    Accepted Version <strong>{consentStatus.version}</strong> on{' '}
                    {new Date(consentStatus.accepted_at || Date.now()).toLocaleString()}. Your merchant account is fully licensed.
                  </div>
                </div>
              </div>

              <Badge className="bg-emerald-600 text-white font-mono text-xs rounded-md shrink-0">
                Active &amp; Compliant
              </Badge>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-foreground/90 space-y-1">
                  <p className="font-heading font-bold text-sm text-foreground">
                    Action Required: Please Review &amp; Accept Platform Terms ({activeVersion})
                  </p>
                  <p className="text-muted-foreground font-sans">
                    printOn24 requires all certified shopkeepers to digitally accept platform merchant terms and service level agreements. When terms are updated, re-acceptance is required to maintain active counter spooling.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-muted/40 rounded-lg border border-border">
                <input
                  type="checkbox"
                  id="terms-consent-check"
                  checked={hasAcceptedCheckbox}
                  onChange={(e) => setHasAcceptedCheckbox(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary border-border cursor-pointer"
                />
                <label
                  htmlFor="terms-consent-check"
                  className="text-xs font-medium text-foreground cursor-pointer select-none"
                >
                  I have read and accept the Platform Terms and Conditions (Version {activeVersion}) on behalf of my print shop.
                </label>
              </div>

              <Button
                onClick={handleAcceptTerms}
                disabled={!hasAcceptedCheckbox || submitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold text-xs h-9 px-5 rounded-lg shadow-sm gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Recording Consent...' : 'Accept Terms & Conditions'}</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TermsPage;
