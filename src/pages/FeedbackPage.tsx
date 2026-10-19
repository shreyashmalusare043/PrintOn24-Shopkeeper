import React, { useState, useEffect } from 'react';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import type { ShopFeedback } from '@/types/shopkeeper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  Star,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  XCircle,
  ThumbsUp,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export const FeedbackPage: React.FC = () => {
  const { user } = useShopkeeper();

  const [feedbackList, setFeedbackList] = useState<ShopFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'pending'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchFeedback = async () => {
    if (!user?.shop_id) return;
    setLoading(true);
    try {
      const data = await shopkeeperApi.getShopFeedback(user.shop_id);
      setFeedbackList(data);
    } catch {
      toast.error('Failed to load feedback from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, [user?.shop_id]);

  const handleUpdateStatus = async (feedbackId: string, newStatus: 'approved' | 'rejected' | 'pending') => {
    setUpdatingId(feedbackId);
    try {
      const success = await shopkeeperApi.updateFeedbackStatus(feedbackId, newStatus);
      if (success) {
        const statusLabel =
          newStatus === 'approved'
            ? 'Published! Now live on your public shop profile.'
            : newStatus === 'rejected'
            ? 'Review Rejected. Not shown publicly.'
            : 'Review Hidden / Moved to Pending.';

        toast.success(statusLabel);
        setFeedbackList((prev) =>
          prev.map((f) =>
            f.id === feedbackId
              ? {
                  ...f,
                  moderation_status: newStatus,
                  is_accepted: newStatus === 'approved',
                }
              : f
          )
        );
      } else {
        toast.error('Failed to update feedback status');
      }
    } catch {
      toast.error('Error updating review moderation status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!confirm('Are you sure you want to permanently delete this customer review?')) return;
    try {
      const success = await shopkeeperApi.deleteFeedback(feedbackId);
      if (success) {
        toast.success('Customer review deleted successfully');
        setFeedbackList((prev) => prev.filter((f) => f.id !== feedbackId));
      } else {
        toast.error('Failed to delete review');
      }
    } catch {
      toast.error('Error deleting review');
    }
  };

  const totalCount = feedbackList.length;
  const publishedCount = feedbackList.filter((f) => f.moderation_status === 'approved' || f.is_accepted).length;
  const pendingCount = feedbackList.filter(
    (f) => f.moderation_status === 'pending' || (!f.is_accepted && f.moderation_status !== 'rejected')
  ).length;

  const avgRating =
    totalCount > 0
      ? (feedbackList.reduce((acc, f) => acc + (f.rating || 5), 0) / totalCount).toFixed(1)
      : '5.0';

  const filteredFeedback = feedbackList.filter((f) => {
    const isApproved = f.moderation_status === 'approved' || f.is_accepted;
    if (statusFilter === 'published') return isApproved;
    if (statusFilter === 'pending') return !isApproved && f.moderation_status !== 'rejected';
    return true; // 'all'
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase font-semibold text-muted-foreground">
              Reviews &amp; Reputation
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            Customer Feedback
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Review and moderate customer ratings. Reviews marked as &quot;Published&quot; reflect live on your public shop profile in the User Panel.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchFeedback}
          disabled={loading}
          className="self-start sm:self-center text-xs rounded-lg gap-1.5 h-8"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* 2.1 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Average Rating */}
        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-heading font-bold uppercase text-muted-foreground flex items-center justify-between">
              <span>Average Rating</span>
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-heading font-bold font-mono text-foreground">{avgRating}</span>
              <span className="text-xs text-muted-foreground font-sans">/ 5.0</span>
            </div>
            <div className="flex items-center text-amber-500 mt-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${i < Math.round(Number(avgRating)) ? 'fill-current' : 'opacity-25'}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Total Feedback */}
        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-heading font-bold uppercase text-muted-foreground flex items-center justify-between">
              <span>Total Reviews</span>
              <MessageSquare className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-heading font-bold font-mono text-foreground">{totalCount}</div>
            <p className="text-[11px] text-muted-foreground font-sans mt-1">
              Customer submissions recorded
            </p>
          </CardContent>
        </Card>

        {/* Published Count */}
        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-heading font-bold uppercase text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
              <span>Published Reviews</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-heading font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {publishedCount}
            </div>
            <p className="text-[11px] text-muted-foreground font-sans mt-1">
              Live on User Panel shop profile
            </p>
          </CardContent>
        </Card>

        {/* Pending Moderation Count */}
        <Card className="bg-card border-border rounded-xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-heading font-bold uppercase text-amber-600 dark:text-amber-400 flex items-center justify-between">
              <span>Pending Moderation</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-heading font-bold font-mono text-amber-600 dark:text-amber-400">
              {pendingCount}
            </div>
            <p className="text-[11px] text-muted-foreground font-sans mt-1">
              Awaiting your publish/reject review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2.2 Reviews Table & Moderation */}
      <Card className="bg-card border-border rounded-xl shadow-sm">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-heading font-bold uppercase text-foreground">
                Customer Reviews Moderation
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-sans">
                Moderate incoming customer reviews. Published reviews are visible on the customer mobile/web app.
              </CardDescription>
            </div>

            {/* Filter Tabs: All, Published, Pending */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className={`text-xs h-7 px-3 rounded-md font-medium ${
                  statusFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : ''
                }`}
              >
                All ({totalCount})
              </Button>
              <Button
                variant={statusFilter === 'published' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('published')}
                className={`text-xs h-7 px-3 rounded-md font-medium ${
                  statusFilter === 'published' ? 'bg-primary text-primary-foreground shadow-sm' : ''
                }`}
              >
                Published ({publishedCount})
              </Button>
              <Button
                variant={statusFilter === 'pending' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('pending')}
                className={`text-xs h-7 px-3 rounded-md font-medium ${
                  statusFilter === 'pending' ? 'bg-primary text-primary-foreground shadow-sm' : ''
                }`}
              >
                Pending ({pendingCount})
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground font-sans text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-primary" />
              <span>Loading reviews from database...</span>
            </div>
          ) : filteredFeedback.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground font-sans text-xs flex flex-col items-center justify-center gap-2">
              <Inbox className="w-8 h-8 text-muted-foreground/60 stroke-[1.5]" />
              <p className="font-medium text-foreground text-sm">
                No {statusFilter === 'all' ? '' : statusFilter} reviews found
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {statusFilter === 'pending'
                  ? 'Great job! You have cleared all pending feedback submissions.'
                  : statusFilter === 'published'
                  ? 'No reviews are currently published on your public store profile.'
                  : 'No customer feedback has been submitted for your shop yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFeedback.map((f) => {
                const isPublished = f.moderation_status === 'approved' || f.is_accepted;
                const isRejected = f.moderation_status === 'rejected';
                const isPending = !isPublished && !isRejected;

                return (
                  <div
                    key={f.id}
                    className={`p-4 border rounded-xl transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs ${
                      isPublished
                        ? 'bg-card border-border hover:border-border/80'
                        : isRejected
                        ? 'bg-destructive/5 border-destructive/20 opacity-75'
                        : 'bg-amber-500/5 border-amber-500/30'
                    }`}
                  >
                    {/* Review Details */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Rating Stars */}
                        <div className="flex items-center text-amber-500">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3.5 h-3.5 ${i < f.rating ? 'fill-current' : 'opacity-25'}`}
                            />
                          ))}
                        </div>

                        {/* Customer Name */}
                        <span className="font-heading font-bold text-foreground truncate">
                          {f.user_name || 'Customer'}
                        </span>

                        {/* Contact */}
                        {f.user_phone && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {f.user_phone}
                          </span>
                        )}

                        {/* Submission Date */}
                        <span className="text-[11px] text-muted-foreground">
                          • {f.created_at ? new Date(f.created_at).toLocaleDateString() : 'Recent'}
                        </span>

                        {/* Status Badge */}
                        {isPublished && (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-bold rounded-md gap-1">
                            <Eye className="w-3 h-3" />
                            Published
                          </Badge>
                        )}
                        {isPending && (
                          <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold rounded-md gap-1">
                            <Clock className="w-3 h-3" />
                            Pending Moderation
                          </Badge>
                        )}
                        {isRejected && (
                          <Badge variant="destructive" className="text-[10px] font-bold rounded-md gap-1">
                            <XCircle className="w-3 h-3" />
                            Rejected
                          </Badge>
                        )}
                      </div>

                      {/* Comment text */}
                      <p className="text-sm text-foreground font-sans leading-relaxed pt-1">
                        &quot;{f.comment || f.feedback_text}&quot;
                      </p>
                    </div>

                    {/* Moderation Controls: Publish, Reject, Hide, Delete */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
                      {!isPublished ? (
                        <Button
                          size="sm"
                          disabled={updatingId === f.id}
                          onClick={() => handleUpdateStatus(f.id, 'approved')}
                          className="h-8 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1 shadow-sm"
                          title="Publish on User Panel public profile"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Publish</span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingId === f.id}
                          onClick={() => handleUpdateStatus(f.id, 'pending')}
                          className="h-8 text-xs rounded-lg text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 gap-1"
                          title="Hide from public profile and move to pending"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Hide</span>
                        </Button>
                      )}

                      {!isRejected && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingId === f.id}
                          onClick={() => handleUpdateStatus(f.id, 'rejected')}
                          className="h-8 text-xs rounded-lg text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                          title="Reject this review"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFeedback(f.id)}
                        className="h-8 px-2 text-xs rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedbackPage;
