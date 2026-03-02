import { z } from "zod";

export interface Customer {
  id: number;
  company_name: string;
  individual_name: string;
  email: string;
  phone: string;
  country: string;
  state_province: string;
  residential_address: string;
  referred_by: string;
  referral_partner_id: number | null;
  referral_code: string;
  referral_username: string;
  auth_user_id: string | null;
  notes: string;
  created_at: string;
}

export const insertCustomerSchema = z.object({
  company_name: z.string().optional().default(""),
  individual_name: z.string().min(1, "Individual name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  country: z.string().optional().default(""),
  state_province: z.string().optional().default(""),
  residential_address: z.string().optional().default(""),
  referred_by: z.string().optional().default(""),
  referral_partner_id: z.number().nullable().optional().default(null),
  notes: z.string().optional().default(""),
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export interface Service {
  id: number;
  name: string;
  category: string;
  type: string;
  state: string;
  state_fee: number;
  agent_fee: number;
  unique_address: number;
  vyke_number: number;
  service_charges: number;
  annual_report_fee: number;
  annual_report_deadline: string;
  state_tax_rate: string;
  federal_tax: string;
  additional_requirements: string;
  warnings: string[];
  includes: string[];
  high_alert: boolean;
  recommended: boolean;
  tax_free: boolean;
  annual_franchise_tax: number;
  federal_tax_reminder: string;
  notes: string;
  timeframe: string;
  is_active: boolean;
  created_at: string;
}

export const insertServiceSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  type: z.string().default("state_specific"),
  state: z.string().default(""),
  state_fee: z.number().default(0),
  agent_fee: z.number().default(0),
  unique_address: z.number().default(0),
  vyke_number: z.number().default(0),
  service_charges: z.number().default(0),
  annual_report_fee: z.number().default(0),
  annual_report_deadline: z.string().default(""),
  state_tax_rate: z.string().default(""),
  federal_tax: z.string().default(""),
  additional_requirements: z.string().default(""),
  warnings: z.array(z.string()).default([]),
  includes: z.array(z.string()).default([]),
  high_alert: z.boolean().default(false),
  recommended: z.boolean().default(false),
  tax_free: z.boolean().default(false),
  annual_franchise_tax: z.number().default(0),
  federal_tax_reminder: z.string().default(""),
  notes: z.string().default(""),
  timeframe: z.string().default(""),
  is_active: z.boolean().default(true),
});

export type InsertService = z.infer<typeof insertServiceSchema>;

export interface BundlePackage {
  id: number;
  name: string;
  description: string;
  discount_type: string;
  discount_percentage: number;
  discount_amount: number;
  total_before_discount: number;
  total_after_discount: number;
  is_active: boolean;
  created_at: string;
}

export interface BundleItem {
  id: number;
  bundle_id: number;
  service_id: number;
  service_name: string;
  service_category: string;
  service_state: string;
  service_price: number;
  item_discount: number;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  order_number: string;
  customer_id: number;
  customer_name: string;
  company_name: string;
  customer_email: string;
  customer_phone: string;
  subtotal: number;
  discount_amount: number;
  discount_percentage: number;
  discount_note: string;
  total: number;
  status: string;
  notes: string;
  created_at: string;
  due_date: string;
  pkr_enabled: boolean;
  pkr_rate: number;
  pkr_tax_rate: number;
  pkr_amount: number;
  pkr_tax_amount: number;
  pkr_total: number;
  amount_paid: number;
  payment_methods_snapshot: PaymentMethod[] | null;
}

export interface InvoicePayment {
  id: number;
  invoice_id: number;
  amount_usd: number;
  amount_pkr: number;
  pkr_rate: number;
  service_description: string;
  note: string;
  payment_date: string;
}

export const insertInvoiceSchema = z.object({
  customer_id: z.number().min(1, "Customer is required"),
  customer_name: z.string().min(1),
  company_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().min(1),
  subtotal: z.number().default(0),
  discount_amount: z.number().default(0),
  discount_percentage: z.number().default(0),
  discount_note: z.string().default(""),
  total: z.number().default(0),
  status: z.string().default("pending"),
  notes: z.string().default(""),
  due_date: z.string().optional().default(""),
  pkr_enabled: z.boolean().default(false),
  pkr_rate: z.number().default(0),
  pkr_tax_rate: z.number().default(0),
  pkr_amount: z.number().default(0),
  pkr_tax_amount: z.number().default(0),
  pkr_total: z.number().default(0),
  amount_paid: z.number().default(0),
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  service_id: number | null;
  description: string;
  state: string;
  quantity: number;
  unit_price: number;
  total: number;
  includes: string[];
  currency_tax: boolean;
  llc_type: string;
}

export interface IncludeMeta {
  status: "pending" | "delivered";
  note: string;
}

export interface FormationDateEntry {
  date: string;
  state: string;
  service_name: string;
  label: string;
}

export interface Order {
  id: number;
  order_number: string;
  invoice_id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  company_name: string;
  service_type: string;
  state: string;
  status: string;
  formation_date: string;
  formation_dates: Record<string, FormationDateEntry>;
  includes: string[];
  includes_meta: Record<string, IncludeMeta>;
  referral_name: string;
  referral_partner_id: number | null;
  created_at: string;
}

export interface OrderNote {
  id: number;
  order_id: number;
  header: string;
  description: string;
  created_at: string;
}

export interface OrderDocument {
  id: number;
  order_id: number;
  file_name: string;
  document_name: string;
  file_path: string;
  dropbox_path: string;
  linked_include: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface CustomerDocument {
  id: number;
  customer_id: number;
  file_name: string;
  document_name: string;
  file_path: string;
  dropbox_path: string;
  uploaded_at: string;
}

export interface OrderActivityLog {
  id: number;
  order_id: number;
  action: string;
  description: string;
  file_name: string;
  file_path: string;
  dropbox_path: string;
  created_at: string;
}

export interface Reminder {
  id: number;
  customer_id: number;
  customer_name: string;
  company_name: string;
  order_id: number | null;
  type: string;
  title: string;
  description: string;
  due_date: string;
  state: string;
  entity_type: string;
  status: string;
  sent_at: string | null;
  created_at: string;
}

export interface SmtpAccount {
  id: number;
  name: string;
  email: string;
  host: string;
  port: number;
  username: string;
  password: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export const insertSmtpSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  host: z.string().min(1),
  port: z.number().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export type InsertSmtp = z.infer<typeof insertSmtpSchema>;

export interface EmailLog {
  id: number;
  smtp_account_id: number;
  from_email: string;
  to_emails: string[];
  subject: string;
  body: string;
  status: string;
  sent_at: string;
}

export interface CompanySettings {
  id: number;
  company_name: string;
  address: string;
  phone: string;
  whatsapp: string;
  support_email: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  iban: string;
  logo_url: string;
  currency_conversion_tax: number;
  dropbox_refresh_token: string | null;
  updated_at: string;
}

export interface PaymentMethod {
  id: number;
  type: string;
  label: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  iban: string;
  currency: string;
  link_url: string;
  details: Record<string, string>;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
}

export interface ComplianceRecord {
  id: number;
  order_id: number;
  customer_id: number;
  customer_name: string;
  company_name: string;
  service_name: string;
  service_category: string;
  state: string;
  llc_type: string;
  formation_date: string;
  annual_report_due: string;
  annual_report_status: string;
  federal_tax_due: string;
  federal_tax_status: string;
  federal_tax_reminder_date: string;
  reminder_count: number;
  last_reminder_sent: string | null;
  created_at: string;
}

export interface ComplianceDocument {
  id: number;
  compliance_id: number;
  order_id: number | null;
  file_name: string;
  document_name: string;
  dropbox_path: string;
  document_type: string;
  created_at: string;
}

export interface ComplianceHistory {
  id: number;
  compliance_id: number;
  order_id: number | null;
  company_name: string;
  year: number;
  type: string;
  status: string;
  due_date: string;
  completed_at: string;
  notes: string;
}

export interface ReferralPartner {
  id: number;
  customer_id: number | null;
  username: string;
  referral_code: string;
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  type: string;
  total_referrals: number;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export const insertReferralPartnerSchema = z.object({
  customer_id: z.number().nullable().optional().default(null),
  username: z.string().min(1, "Username is required"),
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  company_name: z.string().optional().default(""),
  type: z.string().optional().default("individual"),
  notes: z.string().optional().default(""),
  is_active: z.boolean().optional().default(true),
});

export type InsertReferralPartner = z.infer<typeof insertReferralPartnerSchema>;

export interface PartnerServiceRate {
  id: number;
  partner_id: number;
  service_id: number;
  service_name: string;
  discount_type: string;
  discount_value: number;
  notes: string;
  created_at: string;
}

export const insertPartnerServiceRateSchema = z.object({
  partner_id: z.number(),
  service_id: z.number(),
  service_name: z.string().default(""),
  discount_type: z.string().default("fixed"),
  discount_value: z.number().default(0),
  notes: z.string().default(""),
});

export type InsertPartnerServiceRate = z.infer<typeof insertPartnerServiceRateSchema>;

export interface ProfitLossEntry {
  id: number;
  invoice_id: number;
  invoice_number: string;
  order_number: string;
  customer_name: string;
  company_name: string;
  invoice_total: number;
  total_cost: number;
  total_profit: number;
  profit_margin: number;
  cost_breakdown: ProfitLossCostItem[];
  notes: string;
  entry_date: string;
  created_at: string;
}

export interface ProfitLossCostItem {
  description: string;
  service_id: number | null;
  service_name: string;
  category: string;
  revenue: number;
  cost: number;
  profit: number;
}

export const insertProfitLossSchema = z.object({
  invoice_id: z.number(),
  invoice_number: z.string(),
  order_number: z.string().default(""),
  customer_name: z.string(),
  company_name: z.string().default(""),
  invoice_total: z.number(),
  total_cost: z.number(),
  total_profit: z.number(),
  profit_margin: z.number().default(0),
  cost_breakdown: z.array(z.object({
    description: z.string(),
    service_id: z.number().nullable().default(null),
    service_name: z.string().default(""),
    category: z.string().default(""),
    revenue: z.number(),
    cost: z.number(),
    profit: z.number(),
  })),
  notes: z.string().default(""),
  entry_date: z.string().default(""),
});

export type InsertProfitLoss = z.infer<typeof insertProfitLossSchema>;

export interface Admin {
  id: number;
  auth_user_id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  last_login_at: string | null;
  login_count: number;
  created_at: string;
}

export const insertAdminSchema = z.object({
  auth_user_id: z.string(),
  email: z.string().email(),
  name: z.string().default(""),
  role: z.string().default("admin"),
  status: z.string().default("active"),
});

export type InsertAdmin = z.infer<typeof insertAdminSchema>;

export interface CustomerPortalLink {
  id: number;
  token: string;
  customer_id: number;
  customer_name: string;
  company_name: string;
  is_revoked: boolean;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

export const insertPortalLinkSchema = z.object({
  customer_id: z.number().min(1),
  customer_name: z.string().default(""),
  company_name: z.string().default(""),
});

export type InsertPortalLink = z.infer<typeof insertPortalLinkSchema>;

export interface LinkActivityLog {
  id: number;
  link_id: number;
  customer_id: number;
  action: string;
  details: Record<string, any>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export const insertLinkActivitySchema = z.object({
  link_id: z.number(),
  customer_id: z.number(),
  action: z.string(),
  details: z.record(z.any()).default({}),
  ip_address: z.string().default(""),
  user_agent: z.string().default(""),
});

export type InsertLinkActivity = z.infer<typeof insertLinkActivitySchema>;

export interface OrderChat {
  id: number;
  order_id: number;
  customer_id: number;
  sender_type: string;
  sender_name: string;
  message: string;
  file_name: string;
  file_path: string;
  dropbox_path: string;
  created_at: string;
}

export const insertOrderChatSchema = z.object({
  order_id: z.number(),
  customer_id: z.number(),
  sender_type: z.string(),
  sender_name: z.string(),
  message: z.string().default(""),
  file_name: z.string().default(""),
  file_path: z.string().default(""),
  dropbox_path: z.string().default(""),
});

export type InsertOrderChat = z.infer<typeof insertOrderChatSchema>;

export interface DocumentRequest {
  id: number;
  order_id: number;
  customer_id: number;
  document_name: string;
  description: string;
  status: string;
  file_name: string;
  file_path: string;
  dropbox_path: string;
  uploaded_at: string | null;
  created_at: string;
}

export const insertDocumentRequestSchema = z.object({
  order_id: z.number(),
  customer_id: z.number(),
  document_name: z.string().min(1),
  description: z.string().default(""),
  status: z.string().default("pending"),
  file_name: z.string().default(""),
  file_path: z.string().default(""),
  dropbox_path: z.string().default(""),
});

export type InsertDocumentRequest = z.infer<typeof insertDocumentRequestSchema>;

export interface PaymentProof {
  id: number;
  invoice_id: number;
  customer_id: number;
  amount_claimed: number;
  file_name: string;
  dropbox_path: string;
  dropbox_view_link: string;
  status: string;
  admin_note: string;
  created_at: string;
}

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
];
