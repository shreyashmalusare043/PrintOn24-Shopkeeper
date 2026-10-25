export type LanguageCode = 'en' | 'mr' | 'hi';
export type ThemeMode = 'light' | 'dark';
export type ColorTheme = 'orange' | 'indigo' | 'emerald' | 'cyan' | 'blue' | 'amber' | 'red';

export interface ShopkeeperUser {
  id: string;
  shop_id: string;
  email: string;
  owner_name: string;
  phone?: string;
  role: 'shopkeeper' | 'admin';
  status?: 'active' | 'disabled' | 'inactive';
  is_active?: boolean;
  disabled_reason?: string;
  created_at?: string;
}

export interface ShopProfile {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  contact_phone?: string;
  email?: string;
  address: string;
  landmark?: string;
  terminal_code: string;
  pc_limit?: number;
  latitude?: number;
  longitude?: number;
  rating?: number;
  total_reviews?: number;
  is_open: boolean;
  opening_hours?: string;
  image_url?: string;
  qr_code_data?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  upi_id?: string;
  membership_enabled?: boolean;
  membership_price?: number;
  membership_validity_days?: number;
  services?: string[];
  equipment?: string[];
  operating_hours?: Record<string, string>;
  closed_days?: string[];
  logo_url?: string;
  banner_url?: string;
  created_at?: string;
}

export interface ShopPC {
  id: string;
  shop_id: string;
  pc_name: string;
  pc_code: string;
  is_default: boolean;
  status: 'online' | 'offline';
  ip_address: string;
  qr_code_data?: string;
  last_heartbeat?: string;
  is_current_pc?: boolean;
  is_enabled?: boolean;
  deleted_at?: string | null;
  os_info?: string;
  agent_version?: string;
  created_at?: string;
}

export interface DetectedPrinter {
  id: string;
  name: string;
  model: string;
  hardware_id?: string;
  connection_type: 'USB' | 'Wi-Fi' | 'LAN' | 'Network' | 'Windows Spooler' | string;
  status: 'Ready' | 'Busy' | 'Offline' | string;
  is_online: boolean;
  is_color: boolean;
  is_duplex: boolean;
  paper_sizes: string[];
  paper_types: string[];
  is_default: boolean;
  capabilities?: {
    color?: boolean;
    bw?: boolean;
    single_side?: boolean;
    double_side?: boolean;
    duplex?: boolean;
  };
}

export interface ShopPrinter {
  id: string;
  shop_id: string;
  pc_id?: string;
  hardware_id?: string;
  name: string;
  model: string;
  driver_name?: string;
  connection_type: 'usb' | 'wifi' | 'lan' | 'network' | 'windows' | string;
  status: 'online' | 'offline';
  is_online?: boolean;
  usage_type?: 'All' | 'Color Only' | 'B&W Only';
  is_color?: boolean;
  is_duplex?: boolean;
  capabilities: {
    color: boolean;
    bw: boolean;
    single_side: boolean;
    double_side: boolean;
  };
  paper_sizes: string[];
  paper_types?: string[];
  is_default: boolean;
  last_seen?: string;
  created_at?: string;
}

export interface PrintJob {
  id: string;
  order_id?: string;
  shop_id: string;
  pc_id: string;
  printer_id: string;
  file_name: string;
  file_url?: string;
  copies: number;
  color_mode: 'B&W' | 'Color';
  duplex: 'Single Side' | 'Back-to-Back';
  paper_size: string;
  paper_type: string;
  page_count: number;
  total_price: number;
  status: 'Queued' | 'Sending' | 'Printing' | 'Completed' | 'Failed';
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface ShopPricing {
  id: string;
  shop_id: string;
  bw_pricing_mode: 'page' | 'print';
  color_pricing_mode: 'page' | 'print';
  eligible_bw_single: boolean;
  eligible_bw_back_to_back: boolean;
  eligible_color_single: boolean;
  eligible_color_back_to_back: boolean;
  short_page_limit: number;
  bw_short_page_rate: number;
  color_short_page_rate: number;
  color_single: number;
  bw_single: number;
  color_double: number;
  bw_double: number;
  color_back_to_back: number;
  bw_back_to_back: number;
  a4_rate: number;
  a3_rate: number;
  bond_rate: number;
  bond_paper_rate: number;
  glossy_rate: number;
  glossy_paper_rate: number;
  urgent_surcharge?: number;
  binding_rate?: number;
  lamination_rate?: number;
  membership_enabled: boolean;
  membership_monthly_fee: number;
  membership_discount_percent: number;
  membership_billing_cycle?: string;
  updated_at?: string;
}

export type OrderStatus = 'Received' | 'In Queue' | 'Printing' | 'Partially Printed' | 'Ready for Pickup' | 'Completed' | 'Cancelled' | 'No Compatible Printer' | 'Dismissed';

export interface PrintOrder {
  id: string;
  order_number: string;
  user_id: string;
  user_name?: string;
  user_phone?: string;
  shop_id: string;
  shop_name: string;
  token_number: string;
  document_name: string;
  file_type: string;
  file_url?: string;
  total_pages: number;
  config_copies: number;
  config_page_size: string;
  config_paper_type: string;
  config_print_type: string; // 'Colour' | 'Black & White'
  config_sides: string; // 'Single Side' | 'Back-to-Back'
  config_layout?: string;
  documents_config?: any[];
  subtotal: number;
  discount: number;
  platform_fee: number;
  grand_total: number;
  payment_method: string;
  payment_status: 'Pending' | 'Completed' | 'Failed';
  order_status: OrderStatus;
  notes?: string;
  target_pc_id?: string;
  target_pc_name?: string;
  customer_name?: string;
  customer_phone?: string;
  is_vip?: boolean;
  user_membership?: string;
  page_range?: string;
  shop_code?: string;
  printed_segments?: PrintedSegment[];
  remaining_pages_info?: any[];
  custom_ranges?: Array<{
    from: number;
    to: number;
    printType?: string;
    sides?: string;
    color_mode?: string;
    config?: any;
  }>;
  customRanges?: Array<{
    from: number;
    to: number;
    printType?: string;
    sides?: string;
    color_mode?: string;
    config?: any;
  }>;
  created_at: string;
  completed_at?: string;
  updated_at?: string;
}

export interface ShopQR {
  id: string;
  shop_id: string;
  pc_id?: string;
  qr_name: string;
  shop_code: string;
  qr_data: string;
  target_url: string;
  is_active: boolean;
  scan_count?: number;
  created_at?: string;
}

export interface UserMembership {
  id: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  user_email?: string;
  shop_name?: string;
  shop_id?: string;
  membership_tier: string;
  discount_percent: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'cancelled' | 'expired';
  fee_paid?: number;
  billing_cycle?: string;
  days_remaining?: number;
  payment_reference?: string;
  total_orders_count?: number;
  total_pages_printed?: number;
}

export interface ShopMember {
  id: string;
  user_id: string;
  shop_id: string;
  user_name: string;
  user_phone: string;
  user_email: string;
  tier: string;
  card_number: string;
  discount_percentage: number;
  is_active: boolean;
  valid_until: string;
  created_at: string;
}

export interface ShopFeedback {
  id: string;
  user_id: string;
  user_name: string;
  user_phone?: string;
  rating: number;
  category: string;
  comment?: string;
  feedback_text: string;
  shop_id: string;
  target_type: string;
  is_accepted: boolean;
  moderation_status: 'approved' | 'pending' | 'rejected' | 'published';
  created_at: string;
}

export interface PageReminder {
  id: string;
  shop_id: string;
  title: string;
  printer_id?: string;
  printer_name?: string;
  purpose?: string;
  page_count_limit?: number;
  warning_threshold?: number;
  threshold_pages: number;
  current_count: number;
  cycle_history?: Array<{
    date: string;
    print_count: number;
    notes?: string;
    action?: string;
  }>;
  status: 'active' | 'dismissed' | 'postponed';
  last_triggered_at: string;
}

export type PrinterPrintMode = 'bw' | 'color' | 'both';

export interface PrinterReminder {
  id: string;
  shop_id: string;
  printer_id?: string;
  printer_name: string;
  print_mode: PrinterPrintMode;
  current_print_count: number;
  page_threshold: number;
  bw_limit: number;
  color_limit: number;
  bw_printed_count: number;
  color_printed_count: number;
  bw_threshold: number; // default 50
  color_threshold: number; // ink reminder threshold, default 1500
  cartridge_notes?: string;
  is_archived?: boolean;
  created_at?: string;
  updated_at?: string;
  connection_type?: string;
  is_color?: boolean;
  is_duplex?: boolean;
}

export interface PrinterRefillLog {
  id: string;
  shop_id: string;
  reminder_id?: string;
  printer_name: string;
  counter_type: 'page' | 'ink' | 'bw' | 'color' | 'both' | 'all';
  prints_done: number;
  action?: string;
  notes?: string;
  reset_at: string;
  created_at?: string;
}

export interface ShopReminder {
  id: string;
  shop_id: string;
  printer_id?: string;
  purpose?: string;
  page_threshold: number;
  page_count_limit?: number;
  warning_threshold?: number;
  current_print_count: number;
  last_reminded_count: number;
  is_active: boolean;
  last_status: 'idle' | 'alerted' | 'postponed';
  cycle_history?: Array<{
    date: string;
    print_count: number;
    notes?: string;
    action?: string;
  }>;
  updated_at?: string;
}

export interface TicketMessage {
  id: string;
  sender: 'owner' | 'admin' | 'shopkeeper';
  sender_name?: string;
  message: string;
  timestamp?: string;
  created_at?: string;
}

export interface SupportTicket {
  id: string;
  shop_id: string;
  shop_name: string;
  category: string;
  priority?: 'Low' | 'Medium' | 'High';
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  admin_response?: string;
  admin_responded_at?: string;
  attachment_url?: string;
  owner_name?: string;
  owner_contact?: string;
  messages?: TicketMessage[];
  created_at: string;
  updated_at?: string;
}

export interface PlatformPolicy {
  id: string;
  title: string;
  content: string;
  version: string;
  published_at: string;
  effective_date: string;
}

export interface SubscriptionTier {
  id: string;
  name: string;
  price_monthly: number;
  allowed_pcs: number;
  features: string[];
  duration_days?: number;
  is_popular?: boolean;
}

export interface ShopSubscription {
  id: string;
  shop_id: string;
  plan_id: string;
  tier_name: string;
  plan_name: string;
  price: number;
  allowed_pcs: number;
  pc_limit: number;
  start_date: string;
  end_date: string;
  expiry_date: string;
  status: 'active' | 'expiring_soon' | 'expired';
  auto_renew: boolean;
}

export type ReportFilterType = 'Today' | 'Yesterday' | 'Last 7 Days' | 'Last 30 Days' | 'Custom Date Range' | 'Monthly' | '3 Months' | 'Yearly';

export interface DynamicPaperType {
  id: string;
  name: string;
  is_active: boolean;
  eligible_bw_single: boolean;
  eligible_bw_back_to_back: boolean;
  eligible_color_single: boolean;
  eligible_color_back_to_back: boolean;
  bw_price: number;
  color_price: number;
  is_special?: boolean;
}

export interface PrintedSegment {
  id: string;
  doc_id?: string;
  doc_name: string;
  page_range?: string;
  pages_count: number;
  copies?: number;
  color_mode: 'B&W' | 'Color';
  duplex: 'Single Side' | 'Back-to-Back';
  page_size?: string;
  status: 'printed' | 'pending';
  printer_name?: string;
  reason?: string;
  timestamp?: string;
  printed_at?: string;
}

export interface PaymentTransactionRecord {
  id: string;
  order_id: string;
  receipt_number?: string;
  customer_name?: string;
  amount: number;
  payment_method: string;
  payment_mode: 'Online' | 'Counter Cash';
  payment_status: string;
  created_at: string;
  bank_ref_num?: string;
}

export interface PaymentReport {
  period: string;
  is_pay_online_enabled: boolean;
  total_revenue: number;
  total_transactions: number;
  counter_cash_total: number;
  counter_transactions: number;
  counter_transactions_count?: number;
  online_total: number;
  online_transactions: number;
  online_transactions_count?: number;
  current_bank_balance: number;
  pending_settlement: number;
  revenue_change_percent?: number;
  comparison_period?: string;
  comparison_revenue?: number;
  comparison_transactions?: number;
  transactions?: any[];
  settlement_logs: Array<{
    id: string;
    period: string;
    amount: number;
    status: 'Settled' | 'Processing' | 'Completed' | 'In Progress' | 'Failed';
    settled_at?: string;
    reference_no?: string;
  }>;
  payment_records: PaymentTransactionRecord[];
  comparison?: {
    prev_period_label: string;
    prev_total_revenue: number;
    prev_online_total: number;
    prev_counter_cash: number;
    prev_transactions: number;
    growth_rate: number;
  };
}

export interface PrintReport {
  period: string;
  total_prints: number;
  bw_prints: number;
  color_prints: number;
  single_side_prints: number;
  back_to_back_prints: number;
  a4_prints: number;
  a3_prints: number;
  a5_prints: number;
  bond_prints: number;
  glossy_prints: number;
  other_prints: number;
  // Detailed 4-way breakdown
  color_single_prints: number;
  color_duplex_prints: number;
  bw_single_prints: number;
  bw_duplex_prints: number;
  prints_change_percent?: number;
  comparison_period?: string;
  fourWayMatrix?: {
    color_single: number;
    color_duplex: number;
    bw_single: number;
    bw_duplex: number;
  };
  comparison?: {
    prev_period_label: string;
    prev_total_prints: number;
    prev_bw_prints: number;
    prev_color_prints: number;
    prev_duplex_prints: number;
    growth_rate: number;
  };
}
