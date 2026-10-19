import React, { useState, useEffect } from 'react';
import { useShopkeeper } from '@/contexts/ShopkeeperContext';
import { shopkeeperApi } from '@/services/shopkeeperApi';
import type { SupportTicket, TicketMessage } from '@/types/shopkeeper';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  HelpCircle,
  LifeBuoy,
  Send,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Headphones,
  RefreshCw,
  Plus,
  ShieldCheck,
  User,
  ArrowRight,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export const SupportPage: React.FC = () => {
  const { user, shop } = useShopkeeper();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');

  // New ticket state
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [category, setCategory] = useState<'Technical' | 'Payment' | 'Hardware' | 'General'>('Technical');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // Conversation follow-up reply
  const [replyMessage, setReplyMessage] = useState('');

  const fetchTickets = async () => {
    if (!user?.shop_id) return;
    setLoading(true);
    try {
      const data = await shopkeeperApi.getSupportTickets(user.shop_id);
      setTickets(data);
      if (data.length > 0) {
        if (!selectedTicket) {
          setSelectedTicket(data[0]);
        } else {
          const fresh = data.find((t) => t.id === selectedTicket.id);
          if (fresh) setSelectedTicket(fresh);
        }
      }
    } catch {
      toast.error('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [user?.shop_id]);

  // 5.1 Ticket Submission (Auto-linking shop name, ID, contact)
  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.shop_id || !subject.trim() || !message.trim()) {
      toast.error('Please enter both subject and message description');
      return;
    }

    setSubmitting(true);
    try {
      const created = await shopkeeperApi.createSupportTicket(user.shop_id, {
        category,
        priority,
        subject: subject.trim(),
        message: message.trim(),
        shop_name: shop?.name || user?.owner_name || 'Print Shop',
        contact_phone: shop?.contact_phone || (user as any).phone || '',
        contact_email: shop?.email || user.email || '',
      });

      if (created) {
        toast.success(`Support Ticket #${created.id} submitted directly to Super Admin!`);
        setSubject('');
        setMessage('');
        setShowNewTicketForm(false);
        await fetchTickets();
        setSelectedTicket(created);
      } else {
        toast.error('Failed to submit ticket');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 5.2 Follow-up Reply Submission
  const handleSendFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    if (selectedTicket.status === 'closed') {
      toast.error('This ticket is marked as Closed. Please raise a new ticket.');
      return;
    }

    setSendingReply(true);
    try {
      const senderName = shop?.name || user?.owner_name || 'Shopkeeper';
      const success = await shopkeeperApi.addTicketFollowUp(
        selectedTicket.id,
        replyMessage.trim(),
        senderName
      );

      if (success) {
        toast.success('Follow-up message sent to Super Admin Desk');
        setReplyMessage('');
        await fetchTickets();
      } else {
        toast.error('Failed to send reply');
      }
    } finally {
      setSendingReply(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <Badge className="bg-sky-500 text-white text-[10px] font-bold rounded-md uppercase">
            Open
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-amber-500 text-white text-[10px] font-bold rounded-md uppercase">
            In Progress
          </Badge>
        );
      case 'resolved':
        return (
          <Badge className="bg-emerald-600 text-white text-[10px] font-bold rounded-md uppercase">
            Resolved
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px] font-bold rounded-md uppercase">
            Closed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-bold rounded-md uppercase">
            {status}
          </Badge>
        );
    }
  };

  const getPriorityBadge = (p?: string) => {
    switch (p) {
      case 'High':
        return (
          <Badge variant="destructive" className="text-[10px] font-bold rounded-md">
            High Priority
          </Badge>
        );
      case 'Medium':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded-md">
            Medium Priority
          </Badge>
        );
      case 'Low':
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[10px] rounded-md">
            Low Priority
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 md:p-6 bg-card border border-border rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase font-semibold text-muted-foreground">
              Super Admin Resolution Desk
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-heading font-bold tracking-tight text-foreground uppercase">
            Help &amp; Support
          </h1>
          <p className="text-xs text-muted-foreground font-sans">
            Direct communication channel with printOn24 Super Admin support. Submit tickets and track live conversation threads.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            onClick={() => setShowNewTicketForm(!showNewTicketForm)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-heading font-bold rounded-lg h-8 px-3 gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showNewTicketForm ? 'Close Form' : 'Raise New Ticket'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchTickets}
            disabled={loading}
            className="text-xs rounded-lg gap-1.5 h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* 5.1 Ticket Submission Form */}
      {showNewTicketForm && (
        <Card className="bg-card border-border rounded-xl shadow-sm animate-in fade-in">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-heading font-bold uppercase text-foreground flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-primary" />
              <span>Raise Support Ticket to Super Admin</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-sans">
              Ticket automatically binds your Shop ID <code className="font-mono font-bold text-foreground">{user?.shop_id}</code>, shop name &amp; registered contact info.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 md:p-6">
            <form onSubmit={handleSubmitTicket} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Issue Category *</Label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Technical">Technical (Cloud Sync, QR Code, Spooling)</option>
                    <option value="Payment">Payment (UPI Settlements, Payouts, Wallet)</option>
                    <option value="Hardware">Hardware (Printer Mapping, Counter PC)</option>
                    <option value="General">General (Subscription, Account, Policies)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Urgency Priority *</Label>
                  <select
                    value={priority}
                    onChange={(e: any) => setPriority(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Low">Low (Standard response)</option>
                    <option value="Medium">Medium (Regular operational issue)</option>
                    <option value="High">High (Shop printing blocked / Urgent)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Ticket Subject *</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. UPI Settlement batch not credited for Monday"
                  required
                  className="text-xs h-9 rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Detailed Description *</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide complete context, transaction IDs, or printer model numbers for fast resolution..."
                  rows={4}
                  required
                  className="text-xs rounded-lg resize-none"
                />
              </div>

              {/* Auto-linked shop metadata info */}
              <div className="p-3 bg-muted/40 rounded-lg border border-border text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>Auto-linked Shop: <strong className="text-foreground">{shop?.name || user?.owner_name || 'Print Shop'}</strong></span>
                <span>Shop ID: <strong className="text-foreground font-mono">{user?.shop_id}</strong></span>
                <span>Contact Phone: <strong className="text-foreground font-mono">{shop?.contact_phone || (user as any)?.phone || 'Registered Phone'}</strong></span>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewTicketForm(false)}
                  className="h-8 text-xs rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold text-xs h-8 px-4 rounded-lg gap-1.5 shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Submitting...' : 'Submit to Super Admin'}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 5.2 Conversation Thread & 5.3 Ticket Status Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List Column */}
        <Card className="bg-card border-border rounded-xl shadow-sm lg:col-span-1 flex flex-col">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-heading font-bold uppercase text-foreground">
                Your Tickets ({tickets.length})
              </CardTitle>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 pt-2 overflow-x-auto">
              {(['all', 'open', 'in_progress', 'resolved'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap transition-colors ${
                    statusFilter === filter
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter === 'in_progress' ? 'In Progress' : filter}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="p-2 space-y-1.5 flex-1 overflow-y-auto max-h-[550px]">
            {loading ? (
              <div className="text-center py-8 text-xs text-muted-foreground font-sans">
                Loading tickets...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground font-sans">
                No tickets in this status.
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-foreground'
                        : 'bg-card border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono font-bold text-[11px] text-muted-foreground">
                        {t.id}
                      </span>
                      {getStatusBadge(t.status)}
                    </div>

                    <div className="font-heading font-bold text-foreground text-xs line-clamp-1 mb-1">
                      {t.subject}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{t.category}</span>
                      <span>{t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Selected Ticket Conversation Thread */}
        <Card className="bg-card border-border rounded-xl shadow-sm lg:col-span-2 flex flex-col justify-between">
          {selectedTicket ? (
            <>
              {/* Thread Header */}
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-muted-foreground">{selectedTicket.id}</span>
                      {getStatusBadge(selectedTicket.status)}
                      {getPriorityBadge(selectedTicket.priority)}
                    </div>
                    <CardTitle className="text-sm md:text-base font-heading font-bold text-foreground">
                      {selectedTicket.subject}
                    </CardTitle>
                  </div>

                  <div className="text-[11px] text-muted-foreground font-mono">
                    Category: <strong className="text-foreground">{selectedTicket.category}</strong>
                  </div>
                </div>
              </CardHeader>

              {/* Message History Thread */}
              <CardContent className="p-4 md:p-6 space-y-4 flex-1 overflow-y-auto max-h-[420px]">
                {/* Messages array or fallback */}
                {(selectedTicket.messages && selectedTicket.messages.length > 0 ? selectedTicket.messages : [
                  {
                    id: 'init_msg',
                    sender: 'shopkeeper',
                    sender_name: selectedTicket.owner_name || 'Shopkeeper',
                    message: selectedTicket.message,
                    created_at: selectedTicket.created_at,
                  },
                  ...(selectedTicket.admin_response ? [{
                    id: 'admin_resp',
                    sender: 'admin',
                    sender_name: 'Super Admin Support Desk',
                    message: selectedTicket.admin_response,
                    created_at: selectedTicket.updated_at || selectedTicket.created_at,
                  }] : [])
                ]).map((msg: TicketMessage | any, idx: number) => {
                  const isAdmin = msg.sender === 'admin';
                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex gap-3 text-xs ${isAdmin ? 'justify-start' : 'justify-end'}`}
                    >
                      {isAdmin && (
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-xl border ${
                          isAdmin
                            ? 'bg-muted/70 border-border text-foreground'
                            : 'bg-primary text-primary-foreground border-primary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-80 font-mono">
                          <span className="font-bold">
                            {isAdmin ? 'Super Admin Support' : msg.sender_name || 'You'}
                          </span>
                          <span>
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        <p className="font-sans leading-relaxed text-xs whitespace-pre-wrap">
                          {msg.message}
                        </p>
                      </div>

                      {!isAdmin && (
                        <div className="w-8 h-8 rounded-full bg-muted border border-border text-foreground flex items-center justify-center shrink-0 font-bold text-xs">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>

              {/* 5.2 Follow-up Reply Input */}
              <div className="p-4 border-t border-border bg-card">
                {selectedTicket.status === 'closed' ? (
                  <div className="text-center py-2 text-xs text-muted-foreground font-sans bg-muted/40 rounded-lg">
                    This ticket has been marked as <strong>Closed</strong>. Please raise a new ticket for further assistance.
                  </div>
                ) : (
                  <form onSubmit={handleSendFollowUp} className="space-y-2">
                    <Textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your follow-up reply to Super Admin..."
                      rows={2}
                      className="text-xs rounded-lg resize-none"
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted-foreground">
                        Status: <strong className="text-foreground uppercase">{selectedTicket.status}</strong>
                      </span>

                      <Button
                        type="submit"
                        disabled={sendingReply || !replyMessage.trim()}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-heading font-bold text-xs h-8 px-4 rounded-lg gap-1.5 shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{sendingReply ? 'Sending...' : 'Send Follow-up'}</span>
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-muted-foreground font-sans text-xs flex flex-col items-center justify-center gap-2">
              <MessageSquare className="w-8 h-8 text-muted-foreground/60" />
              <p className="font-medium text-foreground text-sm">No Ticket Selected</p>
              <p className="text-xs text-muted-foreground">
                Select an existing ticket from the left panel or click &quot;Raise New Ticket&quot;.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SupportPage;
