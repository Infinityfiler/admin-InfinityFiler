import { supabase } from "./supabase";
import type {
  Customer, InsertCustomer, Service, InsertService,
  Invoice, InsertInvoice, InvoiceItem, Order, OrderNote,
  OrderDocument, OrderActivityLog, CustomerDocument, Reminder, SmtpAccount, InsertSmtp,
  EmailLog, CompanySettings, BundlePackage, BundleItem,
  InvoicePayment, ComplianceRecord, ComplianceDocument, PaymentMethod,
  ReferralPartner, InsertReferralPartner,
  PartnerServiceRate, InsertPartnerServiceRate,
  Admin, InsertAdmin,
  ProfitLossEntry, InsertProfitLoss,
  CustomerPortalLink, InsertPortalLink,
  LinkActivityLog, InsertLinkActivity,
  OrderChat, InsertOrderChat,
  DocumentRequest, InsertDocumentRequest,
  PaymentProof,
} from "@shared/schema";
import crypto from "crypto";

export interface IStorage {
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | null>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, data: Partial<InsertCustomer>): Promise<Customer | null>;
  deleteCustomer(id: number): Promise<void>;

  getServices(category?: string, state?: string): Promise<Service[]>;
  getService(id: number): Promise<Service | null>;
  createService(data: InsertService): Promise<Service>;
  updateService(id: number, data: Partial<InsertService>): Promise<Service | null>;
  deleteService(id: number): Promise<void>;
  bulkDeleteServices(ids: number[]): Promise<void>;
  bulkCreateServices(data: InsertService[]): Promise<Service[]>;

  getBundles(): Promise<BundlePackage[]>;
  getBundleItems(bundleId: number): Promise<BundleItem[]>;
  createBundle(data: Partial<BundlePackage>, items: Partial<BundleItem>[]): Promise<BundlePackage>;
  updateBundle(id: number, data: Partial<BundlePackage>, items: Partial<BundleItem>[]): Promise<BundlePackage>;
  deleteBundle(id: number): Promise<void>;

  getInvoices(): Promise<any[]>;
  getInvoice(id: number): Promise<Invoice | null>;
  createInvoice(data: InsertInvoice, items: Partial<InvoiceItem>[]): Promise<Invoice>;
  updateInvoice(id: number, data: Partial<Invoice>): Promise<Invoice | null>;
  getInvoiceItems(invoiceId: number): Promise<InvoiceItem[]>;
  replaceInvoiceItems(invoiceId: number, items: Partial<InvoiceItem>[]): Promise<void>;

  getOrders(): Promise<Order[]>;
  getOrder(id: number): Promise<Order | null>;
  updateOrder(id: number, data: Partial<Order>): Promise<Order | null>;
  getOrderNotes(orderId: number): Promise<OrderNote[]>;
  createOrderNote(data: Partial<OrderNote>): Promise<OrderNote>;
  getOrderDocuments(orderId: number): Promise<OrderDocument[]>;
  createOrderDocument(data: Partial<OrderDocument>): Promise<OrderDocument>;
  deleteOrderDocument(id: number): Promise<void>;

  getOrderChats(orderId: number): Promise<OrderChat[]>;
  getOrderChatById(chatId: number): Promise<OrderChat | null>;
  createOrderChat(data: InsertOrderChat): Promise<OrderChat>;

  getDocumentRequests(orderId: number): Promise<DocumentRequest[]>;
  createDocumentRequest(data: InsertDocumentRequest): Promise<DocumentRequest>;
  updateDocumentRequest(id: number, data: Partial<DocumentRequest>): Promise<DocumentRequest>;
  deleteDocumentRequest(id: number): Promise<void>;

  getCustomerDocuments(customerId: number): Promise<CustomerDocument[]>;
  createCustomerDocument(data: Partial<CustomerDocument>): Promise<CustomerDocument>;
  deleteCustomerDocument(id: number): Promise<void>;

  getOrderActivityLogs(orderId: number): Promise<OrderActivityLog[]>;
  createOrderActivityLog(data: Partial<OrderActivityLog>): Promise<OrderActivityLog>;

  getReminders(): Promise<Reminder[]>;
  createReminder(data: Partial<Reminder>): Promise<Reminder>;
  updateReminder(id: number, data: Partial<Reminder>): Promise<Reminder | null>;

  getSmtpAccounts(): Promise<SmtpAccount[]>;
  createSmtpAccount(data: InsertSmtp): Promise<SmtpAccount>;
  updateSmtpAccount(id: number, data: Partial<InsertSmtp>): Promise<SmtpAccount | null>;
  deleteSmtpAccount(id: number): Promise<void>;

  getEmailLogs(): Promise<EmailLog[]>;
  createEmailLog(data: Partial<EmailLog>): Promise<EmailLog>;

  getCompanySettings(): Promise<CompanySettings | null>;
  updateCompanySettings(data: Partial<CompanySettings>): Promise<CompanySettings | null>;

  getInvoicePayments(invoiceId: number): Promise<InvoicePayment[]>;
  createInvoicePayment(data: Partial<InvoicePayment>): Promise<InvoicePayment>;

  getComplianceRecords(): Promise<ComplianceRecord[]>;
  getComplianceRecord(id: number): Promise<ComplianceRecord | null>;
  createComplianceRecord(data: Partial<ComplianceRecord>): Promise<ComplianceRecord>;
  updateComplianceRecord(id: number, data: Partial<ComplianceRecord>): Promise<ComplianceRecord>;
  getComplianceRecordsByOrder(orderId: number): Promise<ComplianceRecord[]>;
  deleteComplianceRecord(id: number): Promise<void>;

  getComplianceDocuments(complianceId: number): Promise<ComplianceDocument[]>;
  createComplianceDocument(data: Partial<ComplianceDocument>): Promise<ComplianceDocument>;
  deleteComplianceDocument(id: number): Promise<void>;
  getComplianceDocumentById(id: number): Promise<ComplianceDocument | null>;

  getComplianceHistory(complianceId: number): Promise<any[]>;
  createComplianceHistory(entry: { compliance_id: number; order_id?: number; company_name: string; year: number; type: string; status?: string; due_date: string; notes?: string }): Promise<any>;
  syncAllComplianceRecords(): Promise<{ synced: number; created: number }>;

  getPaymentMethods(): Promise<PaymentMethod[]>;
  getPaymentMethod(id: number): Promise<PaymentMethod | null>;
  createPaymentMethod(data: Partial<PaymentMethod>): Promise<PaymentMethod>;
  updatePaymentMethod(id: number, data: Partial<PaymentMethod>): Promise<PaymentMethod | null>;
  deletePaymentMethod(id: number): Promise<void>;
  getEnabledPaymentMethods(): Promise<PaymentMethod[]>;

  getReferralPartners(): Promise<ReferralPartner[]>;
  getReferralPartner(id: number): Promise<ReferralPartner | null>;
  getReferralPartnerByCode(code: string): Promise<ReferralPartner | null>;
  getReferralPartnerByUsername(username: string): Promise<ReferralPartner | null>;
  getPartnerByCustomerId(customerId: number): Promise<ReferralPartner | null>;
  createReferralPartner(data: InsertReferralPartner): Promise<ReferralPartner>;
  updateReferralPartner(id: number, data: Partial<InsertReferralPartner>): Promise<ReferralPartner | null>;
  deleteReferralPartner(id: number): Promise<void>;
  searchReferralPartners(query: string): Promise<ReferralPartner[]>;
  syncReferralPartners(): Promise<{ synced: number; created: number; codesAssigned: number }>;

  getPartnerServiceRates(partnerId: number): Promise<PartnerServiceRate[]>;
  upsertPartnerServiceRate(input: InsertPartnerServiceRate): Promise<PartnerServiceRate>;
  deletePartnerServiceRate(id: number): Promise<void>;

  getProfitLossEntries(startDate?: string, endDate?: string): Promise<ProfitLossEntry[]>;
  getProfitLossEntry(id: number): Promise<ProfitLossEntry | null>;
  getProfitLossForInvoice(invoiceId: number): Promise<ProfitLossEntry | null>;
  createProfitLossEntry(data: InsertProfitLoss): Promise<ProfitLossEntry>;
  updateProfitLossEntry(id: number, data: Partial<InsertProfitLoss>): Promise<ProfitLossEntry | null>;
  deleteProfitLossEntry(id: number): Promise<void>;
  getProfitLossSummary(startDate?: string, endDate?: string): Promise<any>;

  getAdmins(): Promise<Admin[]>;
  getAdmin(id: number): Promise<Admin | null>;
  getAdminByAuthId(authUserId: string): Promise<Admin | null>;
  upsertAdminOnLogin(authUserId: string, email: string): Promise<Admin>;
  updateAdmin(id: number, data: Partial<InsertAdmin>): Promise<Admin | null>;
  deleteAdmin(id: number): Promise<void>;

  getPortalLinks(): Promise<CustomerPortalLink[]>;
  getPortalLink(id: number): Promise<CustomerPortalLink | null>;
  getPortalLinkByToken(token: string): Promise<CustomerPortalLink | null>;
  getPortalLinkByCustomerId(customerId: number): Promise<CustomerPortalLink | null>;
  createPortalLink(data: InsertPortalLink): Promise<CustomerPortalLink>;
  revokePortalLink(id: number): Promise<void>;
  reactivatePortalLink(id: number): Promise<void>;
  incrementPortalView(id: number): Promise<void>;
  logLinkActivity(data: InsertLinkActivity): Promise<LinkActivityLog>;
  getLinkActivityLog(linkId: number): Promise<LinkActivityLog[]>;

  getPaymentProofs(invoiceId: number): Promise<PaymentProof[]>;
  createPaymentProof(data: Partial<PaymentProof>): Promise<PaymentProof>;
  updatePaymentProof(id: number, data: Partial<PaymentProof>): Promise<PaymentProof>;

  getDashboardStats(): Promise<any>;
  markOverdueInvoices(): Promise<number>;
  generateComplianceReminders(): Promise<number>;
  autoCreateComplianceRecords(orderId: number): Promise<void>;
}

function generateInvoiceNumber(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `INV-${y}${m}-${rand}`;
}

function generateOrderNumber(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `ORD-${y}${m}-${rand}`;
}

export class SupabaseStorage implements IStorage {
  async getCustomers(): Promise<Customer[]> {
    const { data, error } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getCustomer(id: number): Promise<Customer | null> {
    const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
    if (error) return null;
    return data;
  }

  async createCustomer(input: InsertCustomer): Promise<Customer> {
    const username = await this.generateUniqueCustomerUsername(input.individual_name);
    const referralCode = await this.generateUniqueReferralCode();
    const { data, error } = await supabase.from("customers").insert({
      ...input,
      referral_code: referralCode,
      referral_username: username,
    }).select().single();
    if (error) throw error;

    if (input.referral_partner_id) {
      await this.incrementPartnerReferralCount(input.referral_partner_id);
    } else if (input.referred_by) {
      await this.autoCreatePartnerFromReferral(input.referred_by, data.id);
    }

    return data;
  }

  private generateCustomerUsernameBase(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  }

  private async generateUniqueCustomerUsername(name: string): Promise<string> {
    const base = this.generateCustomerUsernameBase(name);
    for (let attempt = 0; attempt < 10; attempt++) {
      const suffix = Math.floor(Math.random() * 900 + 100);
      const username = `${base}_${suffix}`;
      const { data } = await supabase.from("customers").select("id").eq("referral_username", username).limit(1);
      if (!data || data.length === 0) return username;
    }
    return `${base}_${Date.now().toString(36)}`;
  }

  private async generateUniqueReferralCode(): Promise<string> {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 10; attempt++) {
      let code = "CRF-";
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const { data } = await supabase.from("customers").select("id").eq("referral_code", code).limit(1);
      if (!data || data.length === 0) return code;
    }
    return `CRF-${Date.now().toString(36).toUpperCase()}`;
  }

  private async incrementPartnerReferralCount(partnerId: number): Promise<void> {
    const partner = await this.getReferralPartner(partnerId);
    if (partner) {
      await supabase.from("referral_partners").update({
        total_referrals: (partner.total_referrals || 0) + 1,
      }).eq("id", partnerId);
    }
  }

  private async autoCreatePartnerFromReferral(referredBy: string, newCustomerId: number): Promise<void> {
    const allCustomers = await this.getCustomers();
    const referrer = allCustomers.find(c =>
      c.individual_name.toLowerCase() === referredBy.toLowerCase() ||
      c.referral_code === referredBy ||
      c.referral_username === referredBy
    );
    if (!referrer) return;

    const existing = await this.getPartnerByCustomerId(referrer.id);
    if (existing) {
      await supabase.from("referral_partners").update({
        total_referrals: (existing.total_referrals || 0) + 1,
      }).eq("id", existing.id);
      await supabase.from("customers").update({ referral_partner_id: existing.id }).eq("id", newCustomerId);
    } else {
      const partnerUsername = referrer.referral_username || await this.generateUniqueCustomerUsername(referrer.individual_name);
      const partner = await this.createReferralPartner({
        customer_id: referrer.id,
        username: partnerUsername,
        full_name: referrer.individual_name,
        email: referrer.email,
        phone: referrer.phone,
        company_name: referrer.company_name,
        type: "customer",
        notes: "Auto-created from customer referral",
        is_active: true,
      });
      await supabase.from("referral_partners").update({ total_referrals: 1 }).eq("id", partner.id);
      await supabase.from("customers").update({ referral_partner_id: partner.id }).eq("id", newCustomerId);
    }
  }

  async getPartnerByCustomerId(customerId: number): Promise<ReferralPartner | null> {
    const { data, error } = await supabase.from("referral_partners").select("*").eq("customer_id", customerId).single();
    if (error) return null;
    return data;
  }

  async updateCustomer(id: number, input: Partial<InsertCustomer>): Promise<Customer | null> {
    const { data, error } = await supabase.from("customers").update(input).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async deleteCustomer(id: number): Promise<void> {
    await supabase.from("customers").delete().eq("id", id);
  }

  async getServices(category?: string, state?: string): Promise<Service[]> {
    let query = supabase.from("services").select("*").order("state", { ascending: true });
    if (category) query = query.eq("category", category);
    if (state) query = query.eq("state", state);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getService(id: number): Promise<Service | null> {
    const { data, error } = await supabase.from("services").select("*").eq("id", id).single();
    if (error) return null;
    return data;
  }

  async createService(input: InsertService): Promise<Service> {
    const { data, error } = await supabase.from("services").insert(input).select().single();
    if (error) throw error;
    return data;
  }

  async updateService(id: number, input: Partial<InsertService>): Promise<Service | null> {
    const { data, error } = await supabase.from("services").update(input).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async deleteService(id: number): Promise<void> {
    await supabase.from("services").delete().eq("id", id);
  }

  async bulkDeleteServices(ids: number[]): Promise<void> {
    const { error } = await supabase.from("services").delete().in("id", ids);
    if (error) throw error;
  }

  async bulkCreateServices(inputs: InsertService[]): Promise<Service[]> {
    const { data, error } = await supabase.from("services").insert(inputs).select();
    if (error) throw error;
    return data || [];
  }

  async getBundles(): Promise<BundlePackage[]> {
    const { data, error } = await supabase.from("bundle_packages").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getBundleItems(bundleId: number): Promise<BundleItem[]> {
    const { data, error } = await supabase.from("bundle_items").select("*").eq("bundle_id", bundleId);
    if (error) throw error;
    return data || [];
  }

  async createBundle(input: Partial<BundlePackage>, bundleItems: Partial<BundleItem>[]): Promise<BundlePackage> {
    const { data: bundle, error } = await supabase.from("bundle_packages").insert(input).select().single();
    if (error) throw error;
    if (bundleItems.length > 0) {
      const items = bundleItems.map(item => ({ ...item, bundle_id: bundle.id }));
      await supabase.from("bundle_items").insert(items);
    }
    return bundle;
  }

  async updateBundle(id: number, input: Partial<BundlePackage>, bundleItems: Partial<BundleItem>[]): Promise<BundlePackage> {
    const { data: bundle, error } = await supabase.from("bundle_packages").update(input).eq("id", id).select().single();
    if (error) throw error;
    await supabase.from("bundle_items").delete().eq("bundle_id", id);
    if (bundleItems.length > 0) {
      const items = bundleItems.map(item => ({ ...item, bundle_id: id }));
      await supabase.from("bundle_items").insert(items);
    }
    return bundle;
  }

  async deleteBundle(id: number): Promise<void> {
    await supabase.from("bundle_packages").delete().eq("id", id);
  }

  async getInvoices(): Promise<any[]> {
    const { data, error } = await supabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const invoiceIds = data.map(inv => inv.id);
    let invoiceCategoriesMap: Record<number, string[]> = {};
    const { data: items } = await supabase
      .from("invoice_items")
      .select("invoice_id, service_id")
      .in("invoice_id", invoiceIds);
    if (items) {
      const serviceIds = [...new Set(items.map((i: any) => i.service_id).filter(Boolean))];
      let serviceCategories: Record<number, string> = {};
      if (serviceIds.length > 0) {
        const { data: services } = await supabase
          .from("services")
          .select("id, category")
          .in("id", serviceIds);
        if (services) {
          serviceCategories = Object.fromEntries(services.map((s: any) => [s.id, s.category]));
        }
      }
      for (const item of items) {
        if (item.service_id && serviceCategories[item.service_id]) {
          if (!invoiceCategoriesMap[item.invoice_id]) invoiceCategoriesMap[item.invoice_id] = [];
          const cat = serviceCategories[item.service_id];
          if (!invoiceCategoriesMap[item.invoice_id].includes(cat)) {
            invoiceCategoriesMap[item.invoice_id].push(cat);
          }
        }
      }
    }

    return data.map(inv => ({
      ...inv,
      all_categories: invoiceCategoriesMap[inv.id] || [],
    }));
  }

  async getInvoice(id: number): Promise<Invoice | null> {
    const { data, error } = await supabase.from("invoices").select("*").eq("id", id).single();
    if (error) return null;
    return data;
  }

  async createInvoice(input: InsertInvoice, items: Partial<InvoiceItem>[]): Promise<Invoice> {
    const invoiceNumber = generateInvoiceNumber();
    const orderNumber = generateOrderNumber();
    const enabledMethods = await this.getEnabledPaymentMethods();
    const { data: invoice, error } = await supabase.from("invoices").insert({
      ...input,
      invoice_number: invoiceNumber,
      order_number: orderNumber,
      payment_methods_snapshot: enabledMethods.length > 0 ? enabledMethods : null,
    }).select().single();
    if (error) throw error;

    if (items.length > 0) {
      const invoiceItems = items.map(item => ({ ...item, invoice_id: invoice.id }));
      await supabase.from("invoice_items").insert(invoiceItems);
    }

    const allIncludes = items.flatMap((item: any) => item.includes || []);
    let referralName = "";
    let referralPartnerId: number | null = null;
    if (input.customer_id) {
      const customer = await this.getCustomer(input.customer_id);
      if (customer?.referred_by) referralName = customer.referred_by;
      if (customer?.referral_partner_id) referralPartnerId = customer.referral_partner_id;
    }
    const { data: orderData } = await supabase.from("orders").insert({
      order_number: orderNumber,
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      customer_id: input.customer_id,
      customer_name: input.customer_name,
      company_name: input.company_name,
      service_type: items.map(item => item.description).filter(Boolean).join(" | ") || "",
      state: items[0]?.state || "",
      status: "pending",
      includes: allIncludes,
      referral_name: referralName,
      referral_partner_id: referralPartnerId,
    }).select().single();

    return invoice;
  }

  async updateInvoice(id: number, input: Partial<Invoice>): Promise<Invoice | null> {
    const { payment_methods_snapshot, ...rest } = input as any;
    const { data, error } = await supabase.from("invoices").update(rest).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async getInvoiceItems(invoiceId: number): Promise<InvoiceItem[]> {
    const { data, error } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoiceId);
    if (error) throw error;
    return data || [];
  }

  async replaceInvoiceItems(invoiceId: number, items: Partial<InvoiceItem>[]): Promise<void> {
    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
    if (items.length > 0) {
      const rows = items.map(item => ({ ...item, invoice_id: invoiceId }));
      const { error } = await supabase.from("invoice_items").insert(rows);
      if (error) throw error;
    }
  }

  async getOrders(): Promise<any[]> {
    const { data: orders, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    if (!orders || orders.length === 0) return [];

    const invoiceIds = [...new Set(orders.map(o => o.invoice_id).filter(Boolean))];
    let invoiceMap: Record<number, string> = {};
    let invoiceItemsMap: Record<number, string[]> = {};
    let invoiceCategoriesMap: Record<number, string[]> = {};
    let invoiceLlcTypesMap: Record<number, Record<string, string>> = {};
    if (invoiceIds.length > 0) {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, status")
        .in("id", invoiceIds);
      if (invoices) {
        invoiceMap = Object.fromEntries(invoices.map((inv: any) => [inv.id, inv.status]));
      }
      const { data: items } = await supabase
        .from("invoice_items")
        .select("invoice_id, description, service_id, llc_type")
        .in("invoice_id", invoiceIds);
      if (items) {
        const serviceIds = [...new Set(items.map((i: any) => i.service_id).filter(Boolean))];
        let serviceCategories: Record<number, string> = {};
        if (serviceIds.length > 0) {
          const { data: services } = await supabase
            .from("services")
            .select("id, category")
            .in("id", serviceIds);
          if (services) {
            serviceCategories = Object.fromEntries(services.map((s: any) => [s.id, s.category]));
          }
        }
        for (const item of items) {
          if (!invoiceItemsMap[item.invoice_id]) invoiceItemsMap[item.invoice_id] = [];
          if (item.description) invoiceItemsMap[item.invoice_id].push(item.description);
          if (item.llc_type && item.description) {
            if (!invoiceLlcTypesMap[item.invoice_id]) invoiceLlcTypesMap[item.invoice_id] = {};
            invoiceLlcTypesMap[item.invoice_id][item.description] = item.llc_type;
          }
          if (item.service_id && serviceCategories[item.service_id]) {
            if (!invoiceCategoriesMap[item.invoice_id]) invoiceCategoriesMap[item.invoice_id] = [];
            const cat = serviceCategories[item.service_id];
            if (!invoiceCategoriesMap[item.invoice_id].includes(cat)) {
              invoiceCategoriesMap[item.invoice_id].push(cat);
            }
          }
        }
      }
    }

    return orders.map(order => ({
      ...order,
      invoice_status: invoiceMap[order.invoice_id] || "unknown",
      all_services: invoiceItemsMap[order.invoice_id] || (order.service_type ? [order.service_type] : []),
      all_categories: invoiceCategoriesMap[order.invoice_id] || [],
      llc_types: invoiceLlcTypesMap[order.invoice_id] || {},
    }));
  }

  async getOrder(id: number): Promise<Order | null> {
    const { data, error } = await supabase.from("orders").select("*").eq("id", id).single();
    if (error) return null;
    return data;
  }

  async updateOrder(id: number, input: Partial<Order>): Promise<Order | null> {
    if (input.formation_dates) {
      const existing = await this.getOrder(id);
      if (existing) {
        const merged: Record<string, any> = { ...(existing.formation_dates || {}) };
        const incoming = input.formation_dates as Record<string, any>;
        for (const key of Object.keys(incoming)) {
          merged[key] = { ...(merged[key] || {}), ...incoming[key] };
        }
        input = { ...input, formation_dates: merged as any };
      }
    }
    const { data, error } = await supabase.from("orders").update(input).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async getOrderNotes(orderId: number): Promise<OrderNote[]> {
    const { data, error } = await supabase.from("order_notes").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createOrderNote(input: Partial<OrderNote>): Promise<OrderNote> {
    const { data, error } = await supabase.from("order_notes").insert(input).select().single();
    if (error) throw error;
    return data;
  }

  async getOrderDocuments(orderId: number): Promise<OrderDocument[]> {
    const { data, error } = await supabase.from("order_documents").select("*").eq("order_id", orderId).order("uploaded_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createOrderDocument(input: Partial<OrderDocument>): Promise<OrderDocument> {
    const { data, error } = await supabase.from("order_documents").insert(input).select().single();
    if (error) throw error;
    return data;
  }

  async deleteOrderDocument(id: number): Promise<void> {
    const { error } = await supabase.from("order_documents").delete().eq("id", id);
    if (error) throw error;
  }

  async getOrderChats(orderId: number): Promise<OrderChat[]> {
    const { data, error } = await supabase.from("order_chats").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getOrderChatById(chatId: number): Promise<OrderChat | null> {
    const { data, error } = await supabase.from("order_chats").select("*").eq("id", chatId).single();
    if (error && error.code !== "PGRST116") throw error;
    return data || null;
  }

  async createOrderChat(input: InsertOrderChat): Promise<OrderChat> {
    const { data, error } = await supabase.from("order_chats").insert(input).select().single();
    if (error) throw error;
    return data;
  }

  async markChatsAsRead(orderId: number, readerType: "admin" | "customer"): Promise<void> {
    const otherType = readerType === "admin" ? "customer" : "admin";
    const { error } = await supabase
      .from("order_chats")
      .update({ read_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .eq("sender_type", otherType)
      .is("read_at", null);
    if (error) throw error;
  }

  async getUnreadChatCounts(readerType: "admin" | "customer"): Promise<Record<number, number>> {
    const otherType = readerType === "admin" ? "customer" : "admin";
    const { data, error } = await supabase
      .from("order_chats")
      .select("order_id")
      .eq("sender_type", otherType)
      .is("read_at", null);
    if (error) throw error;
    const counts: Record<number, number> = {};
    if (data) {
      for (const row of data) {
        counts[row.order_id] = (counts[row.order_id] || 0) + 1;
      }
    }
    return counts;
  }

  async getDocumentRequests(orderId: number): Promise<DocumentRequest[]> {
    const { data, error } = await supabase.from("document_requests").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createDocumentRequest(input: InsertDocumentRequest): Promise<DocumentRequest> {
    const { data, error } = await supabase.from("document_requests").insert(input).select().single();
    if (error) throw error;
    return data;
  }

  async updateDocumentRequest(id: number, updates: Partial<DocumentRequest>): Promise<DocumentRequest> {
    const { data, error } = await supabase.from("document_requests").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async deleteDocumentRequest(id: number): Promise<void> {
    const { error } = await supabase.from("document_requests").delete().eq("id", id);
    if (error) throw error;
  }

  async getCustomerDocuments(customerId: number): Promise<CustomerDocument[]> {
    const { data, error } = await supabase
      .from("customer_documents")
      .select("*")
      .eq("customer_id", customerId)
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createCustomerDocument(input: Partial<CustomerDocument>): Promise<CustomerDocument> {
    const { data, error } = await supabase
      .from("customer_documents")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteCustomerDocument(id: number): Promise<void> {
    const { error } = await supabase.from("customer_documents").delete().eq("id", id);
    if (error) throw error;
  }

  async getOrderActivityLogs(orderId: number): Promise<OrderActivityLog[]> {
    const { data, error } = await supabase
      .from("order_activity_logs")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createOrderActivityLog(input: Partial<OrderActivityLog>): Promise<OrderActivityLog> {
    const { data, error } = await supabase
      .from("order_activity_logs")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getReminders(): Promise<Reminder[]> {
    const { data, error } = await supabase.from("reminders").select("*").order("due_date", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createReminder(input: Partial<Reminder>): Promise<Reminder> {
    const { data, error } = await supabase.from("reminders").insert(input).select().single();
    if (error) throw error;
    return data;
  }

  async updateReminder(id: number, input: Partial<Reminder>): Promise<Reminder | null> {
    const { data, error } = await supabase.from("reminders").update(input).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async getSmtpAccounts(): Promise<SmtpAccount[]> {
    const { data, error } = await supabase.from("smtp_accounts").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createSmtpAccount(input: InsertSmtp): Promise<SmtpAccount> {
    const { data, error } = await supabase.from("smtp_accounts").insert(input).select().single();
    if (error) throw error;
    return data;
  }

  async updateSmtpAccount(id: number, input: Partial<InsertSmtp>): Promise<SmtpAccount | null> {
    const { data, error } = await supabase.from("smtp_accounts").update(input).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async deleteSmtpAccount(id: number): Promise<void> {
    await supabase.from("smtp_accounts").delete().eq("id", id);
  }

  async getEmailLogs(): Promise<EmailLog[]> {
    const { data, error } = await supabase.from("email_logs").select("*").order("sent_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createEmailLog(input: Partial<EmailLog>): Promise<EmailLog> {
    const { data, error } = await supabase.from("email_logs").insert(input).select().single();
    if (error) throw error;
    return data;
  }

  async getCompanySettings(): Promise<CompanySettings | null> {
    const { data, error } = await supabase.from("company_settings").select("*").limit(1).single();
    if (error) return null;
    return data;
  }

  async updateCompanySettings(input: Partial<CompanySettings>): Promise<CompanySettings | null> {
    const { data: existing } = await supabase.from("company_settings").select("id").limit(1).single();
    if (existing) {
      const { data, error } = await supabase.from("company_settings").update({ ...input, updated_at: new Date().toISOString() }).eq("id", existing.id).select().single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase.from("company_settings").insert(input).select().single();
    if (error) throw error;
    return data;
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const { data, error } = await supabase.from("payment_methods").select("*").order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getPaymentMethod(id: number): Promise<PaymentMethod | null> {
    const { data, error } = await supabase.from("payment_methods").select("*").eq("id", id).single();
    if (error) return null;
    return data;
  }

  async createPaymentMethod(input: Partial<PaymentMethod>): Promise<PaymentMethod> {
    const { data: maxOrder } = await supabase.from("payment_methods").select("sort_order").order("sort_order", { ascending: false }).limit(1).single();
    const sortOrder = maxOrder ? maxOrder.sort_order + 1 : 0;
    const { data, error } = await supabase.from("payment_methods").insert({ ...input, sort_order: input.sort_order ?? sortOrder }).select().single();
    if (error) throw error;
    return data;
  }

  async updatePaymentMethod(id: number, input: Partial<PaymentMethod>): Promise<PaymentMethod | null> {
    const { data, error } = await supabase.from("payment_methods").update(input).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async deletePaymentMethod(id: number): Promise<void> {
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) throw error;
  }

  async getEnabledPaymentMethods(): Promise<PaymentMethod[]> {
    const { data, error } = await supabase.from("payment_methods").select("*").eq("is_enabled", true).order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getReferralPartners(): Promise<ReferralPartner[]> {
    const { data, error } = await supabase.from("referral_partners").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getReferralPartner(id: number): Promise<ReferralPartner | null> {
    const { data, error } = await supabase.from("referral_partners").select("*").eq("id", id).single();
    if (error) return null;
    return data;
  }

  async getReferralPartnerByCode(code: string): Promise<ReferralPartner | null> {
    const { data, error } = await supabase.from("referral_partners").select("*").eq("referral_code", code).single();
    if (error) return null;
    return data;
  }

  async getReferralPartnerByUsername(username: string): Promise<ReferralPartner | null> {
    const { data, error } = await supabase.from("referral_partners").select("*").eq("username", username).single();
    if (error) return null;
    return data;
  }

  async createReferralPartner(input: InsertReferralPartner): Promise<ReferralPartner> {
    const code = "REF-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    const { data, error } = await supabase.from("referral_partners").insert({
      ...input,
      referral_code: code,
    }).select().single();
    if (error) throw error;
    return data;
  }

  async updateReferralPartner(id: number, input: Partial<InsertReferralPartner>): Promise<ReferralPartner | null> {
    const { data, error } = await supabase.from("referral_partners").update(input).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }

  async deleteReferralPartner(id: number): Promise<void> {
    await supabase.from("customers").update({ referral_partner_id: null }).eq("referral_partner_id", id);
    await supabase.from("orders").update({ referral_partner_id: null }).eq("referral_partner_id", id);
    const { error } = await supabase.from("referral_partners").delete().eq("id", id);
    if (error) throw error;
  }

  async searchReferralPartners(query: string): Promise<ReferralPartner[]> {
    const q = query.toLowerCase();
    const { data, error } = await supabase.from("referral_partners").select("*").eq("is_active", true);
    if (error) throw error;
    if (!data) return [];
    return data.filter(p =>
      p.full_name.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      p.referral_code.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q)
    );
  }

  async syncReferralPartners(): Promise<{ synced: number; created: number; codesAssigned: number }> {
    let synced = 0;
    let created = 0;
    let codesAssigned = 0;

    const allCustomers = await this.getCustomers();

    for (const customer of allCustomers) {
      if (!customer.referral_code || !customer.referral_username) {
        const username = customer.referral_username || await this.generateUniqueCustomerUsername(customer.individual_name);
        const code = customer.referral_code || await this.generateUniqueReferralCode();
        await supabase.from("customers").update({
          referral_code: code,
          referral_username: username,
        }).eq("id", customer.id);
        customer.referral_code = code;
        customer.referral_username = username;
        codesAssigned++;
      }
    }

    const referredCustomers = allCustomers.filter(c => c.referred_by);
    for (const customer of referredCustomers) {
      const referrer = allCustomers.find(c =>
        c.individual_name.toLowerCase() === customer.referred_by.toLowerCase() ||
        c.referral_code === customer.referred_by ||
        c.referral_username === customer.referred_by
      );
      if (!referrer) continue;

      const existingPartner = await this.getPartnerByCustomerId(referrer.id);
      if (existingPartner) {
        if (!customer.referral_partner_id || customer.referral_partner_id !== existingPartner.id) {
          await supabase.from("customers").update({ referral_partner_id: existingPartner.id }).eq("id", customer.id);
          synced++;
        }
      } else {
        const syncUsername = referrer.referral_username || await this.generateUniqueCustomerUsername(referrer.individual_name);
        const partner = await this.createReferralPartner({
          customer_id: referrer.id,
          username: syncUsername,
          full_name: referrer.individual_name,
          email: referrer.email,
          phone: referrer.phone,
          company_name: referrer.company_name,
          type: "customer",
          notes: "Auto-created from customer referral sync",
          is_active: true,
        });
        await supabase.from("customers").update({ referral_partner_id: partner.id }).eq("id", customer.id);
        created++;
      }
    }

    const partners = await this.getReferralPartners();
    for (const partner of partners) {
      const referredCount = allCustomers.filter(c => c.referral_partner_id === partner.id).length;
      if (referredCount !== (partner.total_referrals || 0)) {
        await supabase.from("referral_partners").update({ total_referrals: referredCount }).eq("id", partner.id);
      }
    }

    return { synced, created, codesAssigned };
  }

  async getPartnerServiceRates(partnerId: number): Promise<PartnerServiceRate[]> {
    const { data, error } = await supabase.from("partner_service_rates").select("*").eq("partner_id", partnerId).order("service_name");
    if (error) throw error;
    return data || [];
  }

  async upsertPartnerServiceRate(input: InsertPartnerServiceRate): Promise<PartnerServiceRate> {
    const { data: existing } = await supabase.from("partner_service_rates")
      .select("*").eq("partner_id", input.partner_id).eq("service_id", input.service_id).maybeSingle();
    if (existing) {
      const { data, error } = await supabase.from("partner_service_rates")
        .update(input).eq("id", existing.id).select().single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase.from("partner_service_rates").insert(input).select().single();
    if (error) throw error;
    return data;
  }

  async deletePartnerServiceRate(id: number): Promise<void> {
    const { error } = await supabase.from("partner_service_rates").delete().eq("id", id);
    if (error) throw error;
  }

  async getInvoicePayments(invoiceId: number): Promise<InvoicePayment[]> {
    const { data, error } = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("payment_date", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createInvoicePayment(input: Partial<InvoicePayment>): Promise<InvoicePayment> {
    const { data, error } = await supabase
      .from("invoice_payments")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getPaymentProofs(invoiceId: number): Promise<PaymentProof[]> {
    const { data, error } = await supabase
      .from("payment_proofs")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createPaymentProof(input: Partial<PaymentProof>): Promise<PaymentProof> {
    const { data, error } = await supabase
      .from("payment_proofs")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updatePaymentProof(id: number, input: Partial<PaymentProof>): Promise<PaymentProof> {
    const { data, error } = await supabase
      .from("payment_proofs")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getProfitLossEntries(startDate?: string, endDate?: string): Promise<ProfitLossEntry[]> {
    let query = supabase.from("profit_loss_entries").select("*").order("entry_date", { ascending: false });
    if (startDate) query = query.gte("entry_date", startDate);
    if (endDate) query = query.lte("entry_date", endDate);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getProfitLossEntry(id: number): Promise<ProfitLossEntry | null> {
    const { data, error } = await supabase.from("profit_loss_entries").select("*").eq("id", id).single();
    if (error) return null;
    return data;
  }

  async getProfitLossForInvoice(invoiceId: number): Promise<ProfitLossEntry | null> {
    const { data, error } = await supabase.from("profit_loss_entries").select("*").eq("invoice_id", invoiceId).single();
    if (error) return null;
    return data;
  }

  async createProfitLossEntry(input: InsertProfitLoss): Promise<ProfitLossEntry> {
    const margin = input.invoice_total > 0 ? (input.total_profit / input.invoice_total) * 100 : 0;
    const { data, error } = await supabase.from("profit_loss_entries").insert({
      ...input,
      profit_margin: Math.round(margin * 100) / 100,
      entry_date: input.entry_date || new Date().toISOString().split("T")[0],
    }).select().single();
    if (error) throw error;
    return data;
  }

  async updateProfitLossEntry(id: number, input: Partial<InsertProfitLoss>): Promise<ProfitLossEntry | null> {
    const updateData: any = { ...input };
    if (input.invoice_total !== undefined && input.total_profit !== undefined) {
      updateData.profit_margin = input.invoice_total > 0 ? Math.round((input.total_profit / input.invoice_total) * 100 * 100) / 100 : 0;
    }
    const { data, error } = await supabase.from("profit_loss_entries").update(updateData).eq("id", id).select().single();
    if (error) return null;
    return data;
  }

  async deleteProfitLossEntry(id: number): Promise<void> {
    await supabase.from("profit_loss_entries").delete().eq("id", id);
  }

  async getProfitLossSummary(startDate?: string, endDate?: string): Promise<any> {
    let query = supabase.from("profit_loss_entries").select("*").order("entry_date", { ascending: false });
    if (startDate) query = query.gte("entry_date", startDate);
    if (endDate) query = query.lte("entry_date", endDate);
    const { data, error } = await query;
    if (error) throw error;
    const entries = data || [];
    const totalRevenue = entries.reduce((s, e) => s + Number(e.invoice_total), 0);
    const totalCost = entries.reduce((s, e) => s + Number(e.total_cost), 0);
    const totalProfit = entries.reduce((s, e) => s + Number(e.total_profit), 0);
    const avgMargin = entries.length > 0 ? totalProfit / totalRevenue * 100 : 0;
    const profitable = entries.filter(e => Number(e.total_profit) > 0).length;
    const losses = entries.filter(e => Number(e.total_profit) < 0).length;

    const byMonth: Record<string, { revenue: number; cost: number; profit: number; count: number }> = {};
    for (const e of entries) {
      const m = e.entry_date?.substring(0, 7) || "unknown";
      if (!byMonth[m]) byMonth[m] = { revenue: 0, cost: 0, profit: 0, count: 0 };
      byMonth[m].revenue += Number(e.invoice_total);
      byMonth[m].cost += Number(e.total_cost);
      byMonth[m].profit += Number(e.total_profit);
      byMonth[m].count++;
    }

    const byCategory: Record<string, { revenue: number; cost: number; profit: number }> = {};
    for (const e of entries) {
      const breakdown = Array.isArray(e.cost_breakdown) ? e.cost_breakdown : [];
      for (const item of breakdown) {
        const cat = item.category || "Other";
        if (!byCategory[cat]) byCategory[cat] = { revenue: 0, cost: 0, profit: 0 };
        byCategory[cat].revenue += Number(item.revenue || 0);
        byCategory[cat].cost += Number(item.cost || 0);
        byCategory[cat].profit += Number(item.profit || 0);
      }
    }

    return {
      totalRevenue, totalCost, totalProfit,
      avgMargin: Math.round(avgMargin * 100) / 100,
      totalEntries: entries.length,
      profitable, losses,
      byMonth: Object.entries(byMonth).map(([month, d]) => ({ month, ...d })).sort((a, b) => a.month.localeCompare(b.month)),
      byCategory: Object.entries(byCategory).map(([category, d]) => ({ category, ...d })),
      entries,
    };
  }

  async getAdmins(): Promise<Admin[]> {
    const { data, error } = await supabase.from("admins").select("*").order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async getAdmin(id: number): Promise<Admin | null> {
    const { data, error } = await supabase.from("admins").select("*").eq("id", id).single();
    if (error) return null;
    return data;
  }

  async getAdminByAuthId(authUserId: string): Promise<Admin | null> {
    const { data, error } = await supabase.from("admins").select("*").eq("auth_user_id", authUserId).single();
    if (error) return null;
    return data;
  }

  async upsertAdminOnLogin(authUserId: string, email: string): Promise<Admin> {
    const existing = await this.getAdminByAuthId(authUserId);
    if (existing) {
      const { data, error } = await supabase.from("admins")
        .update({
          email,
          last_login_at: new Date().toISOString(),
          login_count: (existing.login_count || 0) + 1,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase.from("admins")
      .insert({
        auth_user_id: authUserId,
        email,
        name: email.split("@")[0],
        role: "admin",
        status: "active",
        last_login_at: new Date().toISOString(),
        login_count: 1,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateAdmin(id: number, data: Partial<InsertAdmin>): Promise<Admin | null> {
    const { data: updated, error } = await supabase.from("admins").update(data).eq("id", id).select().single();
    if (error) return null;
    return updated;
  }

  async deleteAdmin(id: number): Promise<void> {
    await supabase.from("admins").delete().eq("id", id);
  }

  async getPortalLinks(): Promise<CustomerPortalLink[]> {
    const { data, error } = await supabase.from("customer_portal_links").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getPortalLink(id: number): Promise<CustomerPortalLink | null> {
    const { data, error } = await supabase.from("customer_portal_links").select("*").eq("id", id).single();
    if (error) return null;
    return data;
  }

  async getPortalLinkByToken(token: string): Promise<CustomerPortalLink | null> {
    const { data, error } = await supabase.from("customer_portal_links").select("*").eq("token", token).single();
    if (error) return null;
    return data;
  }

  async getPortalLinkByCustomerId(customerId: number): Promise<CustomerPortalLink | null> {
    const { data, error } = await supabase.from("customer_portal_links").select("*").eq("customer_id", customerId).single();
    if (error) return null;
    return data;
  }

  async createPortalLink(data: InsertPortalLink): Promise<CustomerPortalLink> {
    const existing = await this.getPortalLinkByCustomerId(data.customer_id);
    if (existing) {
      if (existing.is_revoked) {
        const newToken = crypto.randomBytes(16).toString("hex");
        const { data: reactivated, error } = await supabase.from("customer_portal_links")
          .update({ is_revoked: false, token: newToken, view_count: 0, last_viewed_at: null })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return reactivated;
      }
      return existing;
    }

    const token = crypto.randomBytes(16).toString("hex");
    const { data: created, error } = await supabase.from("customer_portal_links")
      .insert({ ...data, token })
      .select()
      .single();
    if (error) throw error;
    return created;
  }

  async revokePortalLink(id: number): Promise<void> {
    const { error } = await supabase.from("customer_portal_links").update({ is_revoked: true }).eq("id", id);
    if (error) throw error;
  }

  async reactivatePortalLink(id: number): Promise<void> {
    const { error } = await supabase.from("customer_portal_links").update({ is_revoked: false }).eq("id", id);
    if (error) throw error;
  }

  async incrementPortalView(id: number): Promise<void> {
    const link = await this.getPortalLink(id);
    if (!link) return;
    const { error } = await supabase.from("customer_portal_links")
      .update({ view_count: (link.view_count || 0) + 1, last_viewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  async logLinkActivity(data: InsertLinkActivity): Promise<LinkActivityLog> {
    const { data: created, error } = await supabase.from("link_activity_log")
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return created;
  }

  async getLinkActivityLog(linkId: number): Promise<LinkActivityLog[]> {
    const { data, error } = await supabase.from("link_activity_log")
      .select("*")
      .eq("link_id", linkId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getDashboardStats(startDate?: string, endDate?: string): Promise<any> {
    let customersQuery = supabase.from("customers").select("id", { count: "exact" });
    let ordersQuery = supabase.from("orders").select("id, order_number, company_name, customer_name, service_type, state, status, referral_name, created_at").order("created_at", { ascending: false });
    let invoicesQuery = supabase.from("invoices").select("id, invoice_number, company_name, customer_name, total, status, created_at, amount_paid").order("created_at", { ascending: false });
    let remindersQuery = supabase.from("reminders").select("id, status, due_date", { count: "exact" });

    if (startDate) {
      customersQuery = customersQuery.gte("created_at", startDate);
      ordersQuery = ordersQuery.gte("created_at", startDate);
      invoicesQuery = invoicesQuery.gte("created_at", startDate);
    }
    if (endDate) {
      const endDatePlusOne = new Date(endDate);
      endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
      const endStr = endDatePlusOne.toISOString().split("T")[0];
      customersQuery = customersQuery.lt("created_at", endStr);
      ordersQuery = ordersQuery.lt("created_at", endStr);
      invoicesQuery = invoicesQuery.lt("created_at", endStr);
    }

    const [customers, orders, invoices, reminders] = await Promise.all([
      customersQuery,
      ordersQuery,
      invoicesQuery,
      remindersQuery,
    ]);

    const allOrders = orders.data || [];
    const allInvoices = invoices.data || [];

    const totalRevenue = allInvoices
      .filter((inv: any) => inv.status === "paid")
      .reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0);

    const pendingOrders = allOrders.filter((o: any) => o.status === "pending").length;
    const completedOrders = allOrders.filter((o: any) => o.status === "completed").length;
    const inProgressOrders = allOrders.filter((o: any) => o.status === "in-progress").length;

    const now = new Date();
    const twoMonthsLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const upcomingReminders = (reminders.data || []).filter((r: any) => {
      const due = new Date(r.due_date);
      return r.status === "pending" && due <= twoMonthsLater && due >= now;
    }).length;

    const pendingInvoices = allInvoices.filter((inv: any) => inv.status === "pending" || inv.status === "partial-paid").length;
    const paidInvoices = allInvoices.filter((inv: any) => inv.status === "paid").length;
    const overdueInvoices = allInvoices.filter((inv: any) => inv.status === "overdue").length;
    const totalCollected = allInvoices.reduce((sum: number, inv: any) => sum + Number(inv.amount_paid || 0), 0);

    return {
      totalCustomers: customers.count || 0,
      totalOrders: allOrders.length,
      pendingOrders,
      completedOrders,
      inProgressOrders,
      totalRevenue,
      totalCollected,
      pendingInvoices,
      paidInvoices,
      overdueInvoices,
      upcomingReminders,
      recentOrders: allOrders.slice(0, 5),
      recentInvoices: allInvoices.slice(0, 5),
    };
  }

  async markOverdueInvoices(): Promise<number> {
    const utcNow = Date.now();
    const pkOffsetMs = 5 * 60 * 60 * 1000;
    const pkNow = new Date(utcNow + pkOffsetMs);
    const todayStr = pkNow.getUTCFullYear() + "-" +
      String(pkNow.getUTCMonth() + 1).padStart(2, "0") + "-" +
      String(pkNow.getUTCDate()).padStart(2, "0");

    let totalUpdated = 0;

    const { data: pendingInvoices } = await supabase
      .from("invoices")
      .select("id, due_date")
      .in("status", ["pending", "partial-paid"])
      .neq("due_date", "")
      .not("due_date", "is", null);

    if (pendingInvoices && pendingInvoices.length > 0) {
      const overdueIds = pendingInvoices
        .filter((inv: any) => {
          if (!inv.due_date) return false;
          const dueDateStr = String(inv.due_date).slice(0, 10);
          return dueDateStr < todayStr;
        })
        .map((inv: any) => inv.id);

      if (overdueIds.length > 0) {
        const { error } = await supabase
          .from("invoices")
          .update({ status: "overdue" })
          .in("id", overdueIds);
        if (error) throw error;
        totalUpdated += overdueIds.length;
      }
    }

    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("id, due_date, amount_paid, total")
      .eq("status", "overdue");

    if (overdueInvoices && overdueInvoices.length > 0) {
      const noLongerOverdueIds = overdueInvoices
        .filter((inv: any) => {
          if (!inv.due_date || inv.due_date === "") return true;
          const dueDateStr = String(inv.due_date).slice(0, 10);
          return dueDateStr >= todayStr;
        });

      for (const inv of noLongerOverdueIds) {
        const amountPaid = Number(inv.amount_paid || 0);
        const total = Number(inv.total || 0);
        const newStatus = amountPaid > 0 && amountPaid < total ? "partial-paid" : "pending";
        const { error } = await supabase
          .from("invoices")
          .update({ status: newStatus })
          .eq("id", inv.id);
        if (error) throw error;
        totalUpdated++;
      }
    }

    return totalUpdated;
  }

  async getComplianceRecords(): Promise<ComplianceRecord[]> {
    const { data, error } = await supabase
      .from("compliance_records")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createComplianceRecord(input: Partial<ComplianceRecord>): Promise<ComplianceRecord> {
    const { data, error } = await supabase
      .from("compliance_records")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateComplianceRecord(id: number, input: Partial<ComplianceRecord>): Promise<ComplianceRecord> {
    const { data, error } = await supabase
      .from("compliance_records")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getComplianceRecordsByOrder(orderId: number): Promise<ComplianceRecord[]> {
    const { data, error } = await supabase
      .from("compliance_records")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async deleteComplianceRecord(id: number): Promise<void> {
    const { error } = await supabase.from("compliance_records").delete().eq("id", id);
    if (error) throw error;
  }

  async getComplianceRecord(id: number): Promise<ComplianceRecord | null> {
    const { data, error } = await supabase.from("compliance_records").select("*").eq("id", id).single();
    if (error) return null;
    return data;
  }

  async getComplianceDocuments(complianceId: number): Promise<ComplianceDocument[]> {
    const { data, error } = await supabase
      .from("compliance_documents")
      .select("*")
      .eq("compliance_id", complianceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createComplianceDocument(input: Partial<ComplianceDocument>): Promise<ComplianceDocument> {
    const { data, error } = await supabase
      .from("compliance_documents")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteComplianceDocument(id: number): Promise<void> {
    const { error } = await supabase.from("compliance_documents").delete().eq("id", id);
    if (error) throw error;
  }

  async getComplianceDocumentById(id: number): Promise<ComplianceDocument | null> {
    const { data, error } = await supabase
      .from("compliance_documents")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return data;
  }

  async getComplianceHistory(complianceId: number): Promise<any[]> {
    const { data, error } = await supabase
      .from("compliance_history")
      .select("*")
      .eq("compliance_id", complianceId)
      .order("completed_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async createComplianceHistory(entry: {
    compliance_id: number;
    order_id?: number;
    company_name: string;
    year: number;
    type: string;
    status?: string;
    due_date: string;
    notes?: string;
  }): Promise<any> {
    const { data, error } = await supabase
      .from("compliance_history")
      .insert({
        compliance_id: entry.compliance_id,
        order_id: entry.order_id || null,
        company_name: entry.company_name,
        year: entry.year,
        type: entry.type,
        status: entry.status || "completed",
        due_date: entry.due_date,
        notes: entry.notes || "",
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async syncAllComplianceRecords(): Promise<{ synced: number; created: number }> {
    let synced = 0;
    let created = 0;

    const { data: orders } = await supabase.from("orders").select("*");
    if (!orders) return { synced, created };

    for (const order of orders) {
      const formationDates = order.formation_dates || {};
      if (Object.keys(formationDates).length === 0) continue;

      const invoiceItems = order.invoice_id
        ? await this.getInvoiceItems(order.invoice_id)
        : [];

      const serviceIds = Array.from(new Set(invoiceItems.map((item: any) => item.service_id).filter(Boolean)));
      let servicesMap: Record<number, any> = {};
      if (serviceIds.length > 0) {
        const { data: services } = await supabase
          .from("services")
          .select("*")
          .in("id", serviceIds as number[]);
        if (services) {
          servicesMap = Object.fromEntries(services.map((s: any) => [s.id, s]));
        }
      }

      for (const [key, entry] of Object.entries(formationDates) as [string, any][]) {
        if (!entry.date) continue;

        const matchingItem = invoiceItems.find((item: any) => {
          if (item.description === entry.service_name || item.description === entry.label) return true;
          if (item.service_id && servicesMap[item.service_id]) {
            const svc = servicesMap[item.service_id];
            if (svc.name === entry.service_name) return true;
          }
          if (item.description && entry.service_name && item.description.includes(entry.service_name.split(" (")[0])) return true;
          return false;
        });

        let service: any = null;
        if (matchingItem?.service_id && servicesMap[matchingItem.service_id]) {
          service = servicesMap[matchingItem.service_id];
        }
        if (!service) {
          for (const item of invoiceItems) {
            if (item.service_id && servicesMap[item.service_id]) {
              const svc = servicesMap[item.service_id];
              const cat = svc.category?.toLowerCase() || "";
              if ((cat.includes("llc") || cat.includes("corp")) && cat.includes("formation")) {
                if (svc.state === entry.state || !entry.state) {
                  service = svc;
                  break;
                }
              }
            }
          }
        }

        const serviceCategory = service?.category || "";
        const isFormation = serviceCategory.toLowerCase().includes("formation") ||
          serviceCategory.toLowerCase().includes("llc") ||
          serviceCategory.toLowerCase().includes("corp");
        if (!isFormation && serviceCategory) continue;

        const llcType = matchingItem?.llc_type || "";
        const annualReportDeadline = service?.annual_report_deadline || "";
        const annualReportDue = calculateAnnualReportDue(entry.state || "", entry.date, annualReportDeadline);
        const federalTaxDue = calculateFederalTaxDue(entry.date, serviceCategory, llcType);

        const existing = await this.getComplianceRecordsByOrder(order.id);
        const match = existing.find((r: any) => r.service_name === (entry.service_name || entry.label) && r.state === (entry.state || ""));

        if (match) {
          const needsUpdate = match.annual_report_due !== annualReportDue || match.federal_tax_due !== federalTaxDue ||
            match.formation_date !== entry.date || match.llc_type !== (llcType || match.llc_type);
          if (needsUpdate) {
            await this.updateComplianceRecord(match.id, {
              formation_date: entry.date,
              state: entry.state || match.state,
              annual_report_due: annualReportDue,
              federal_tax_due: federalTaxDue,
              llc_type: llcType || match.llc_type,
            });
            synced++;
          }
        } else {
          await this.createComplianceRecord({
            order_id: order.id,
            customer_id: order.customer_id,
            customer_name: order.customer_name,
            company_name: order.company_name,
            service_name: entry.service_name || entry.label || "",
            service_category: serviceCategory,
            state: entry.state || "",
            llc_type: llcType,
            formation_date: entry.date,
            annual_report_due: annualReportDue,
            annual_report_status: "pending",
            federal_tax_due: federalTaxDue,
            federal_tax_status: "pending",
            federal_tax_reminder_date: "",
            reminder_count: 0,
          });
          created++;
        }
      }
    }

    return { synced, created };
  }

  async generateComplianceReminders(): Promise<number> {
    const { data: records, error } = await supabase
      .from("compliance_records")
      .select("*");
    if (error) throw error;
    if (!records || records.length === 0) return 0;

    const now = new Date();
    let remindersCreated = 0;

    const { data: existingReminders } = await supabase
      .from("reminders")
      .select("*")
      .in("type", ["annual_report", "federal_tax"]);

    const existingKeys = new Set<string>();
    if (existingReminders) {
      for (const r of existingReminders) {
        existingKeys.add(`${r.type}-${r.order_id}-${r.due_date}-${r.title}`);
      }
    }

    for (const record of records) {
      const reminderSchedules = [
        { label: "2 months before", daysBeforeDue: 60 },
        { label: "1 month before", daysBeforeDue: 30 },
        { label: "2 weeks before", daysBeforeDue: 14 },
      ];

      if (record.annual_report_status === "pending" && record.annual_report_due) {
        const dueDate = new Date(record.annual_report_due);
        if (isNaN(dueDate.getTime())) continue;

        for (const schedule of reminderSchedules) {
          const reminderDate = new Date(dueDate.getTime() - schedule.daysBeforeDue * 24 * 60 * 60 * 1000);
          if (reminderDate > now) continue;

          const title = `Annual Report Due ${schedule.label} - ${record.company_name}`;
          const uniqueKey = `annual_report-${record.order_id}-${record.annual_report_due}-${title}`;
          if (existingKeys.has(uniqueKey)) continue;

          const llcLabel = record.llc_type === "single-member" ? "Single-Member LLC" : record.llc_type === "multi-member" ? "Multi-Member LLC" : record.service_category;
          await this.createReminder({
            customer_id: record.customer_id,
            customer_name: record.customer_name,
            company_name: record.company_name,
            order_id: record.order_id,
            type: "annual_report",
            title,
            description: `Annual report for ${record.company_name} (${record.state}, ${llcLabel}) is due on ${record.annual_report_due}. Formation: ${record.formation_date}. Service: ${record.service_name}`,
            due_date: record.annual_report_due,
            state: record.state,
            entity_type: record.service_category,
            status: "pending",
          });
          existingKeys.add(uniqueKey);
          remindersCreated++;

          await supabase
            .from("compliance_records")
            .update({
              reminder_count: (record.reminder_count || 0) + 1,
              last_reminder_sent: new Date().toISOString(),
            })
            .eq("id", record.id);
          record.reminder_count = (record.reminder_count || 0) + 1;
        }
      }

      if (record.federal_tax_status === "pending" && record.federal_tax_due) {
        const dueDate = new Date(record.federal_tax_due);
        if (isNaN(dueDate.getTime())) continue;

        for (const schedule of reminderSchedules) {
          const reminderDate = new Date(dueDate.getTime() - schedule.daysBeforeDue * 24 * 60 * 60 * 1000);
          if (reminderDate > now) continue;

          const llcLabel = record.llc_type === "single-member" ? "Single-Member LLC" : record.llc_type === "multi-member" ? "Multi-Member LLC (Partnership)" : record.service_category;
          const taxDeadline = record.llc_type === "multi-member" ? "March 15" : "April 15";
          const title = `Federal Tax Due ${schedule.label} - ${record.company_name}`;
          const uniqueKey = `federal_tax-${record.order_id}-${record.federal_tax_due}-${title}`;
          if (existingKeys.has(uniqueKey)) continue;

          await this.createReminder({
            customer_id: record.customer_id,
            customer_name: record.customer_name,
            company_name: record.company_name,
            order_id: record.order_id,
            type: "federal_tax",
            title,
            description: `Federal tax filing for ${record.company_name} (${record.state}, ${llcLabel}) is due on ${taxDeadline}. Due date: ${record.federal_tax_due}. Formation: ${record.formation_date}. Service: ${record.service_name}`,
            due_date: record.federal_tax_due,
            state: record.state,
            entity_type: record.service_category,
            status: "pending",
          });
          existingKeys.add(uniqueKey);
          remindersCreated++;

          await supabase
            .from("compliance_records")
            .update({
              reminder_count: (record.reminder_count || 0) + 1,
              last_reminder_sent: new Date().toISOString(),
            })
            .eq("id", record.id);
          record.reminder_count = (record.reminder_count || 0) + 1;
        }
      }
    }

    return remindersCreated;
  }

  async autoCreateComplianceRecords(orderId: number): Promise<void> {
    const order = await this.getOrder(orderId);
    if (!order) return;

    const formationDates = order.formation_dates || {};
    if (Object.keys(formationDates).length === 0) return;

    const invoiceItems = order.invoice_id
      ? await this.getInvoiceItems(order.invoice_id)
      : [];

    const serviceIds = Array.from(new Set(invoiceItems.map(item => item.service_id).filter(Boolean)));
    let servicesMap: Record<number, any> = {};
    if (serviceIds.length > 0) {
      const { data: services } = await supabase
        .from("services")
        .select("*")
        .in("id", serviceIds as number[]);
      if (services) {
        servicesMap = Object.fromEntries(services.map((s: any) => [s.id, s]));
      }
    }

    for (const [key, entry] of Object.entries(formationDates)) {
      if (!entry.date) continue;

      const matchingItem = invoiceItems.find(item => {
        if (item.description === entry.service_name || item.description === entry.label) return true;
        if (item.service_id && servicesMap[item.service_id]) {
          const svc = servicesMap[item.service_id];
          if (svc.name === entry.service_name) return true;
          if (entry.label && svc.name.includes(entry.label.split(" (")[0])) return true;
        }
        if (item.description && entry.service_name && item.description.includes(entry.service_name.split(" (")[0])) return true;
        return false;
      });

      let service: any = null;
      if (matchingItem?.service_id && servicesMap[matchingItem.service_id]) {
        service = servicesMap[matchingItem.service_id];
      }

      if (!service) {
        for (const item of invoiceItems) {
          if (item.service_id && servicesMap[item.service_id]) {
            const svc = servicesMap[item.service_id];
            const cat = svc.category?.toLowerCase() || "";
            if ((cat.includes("llc") || cat.includes("corp")) && cat.includes("formation")) {
              if (svc.state === entry.state || !entry.state) {
                service = svc;
                break;
              }
            }
          }
        }
      }

      const serviceCategory = service?.category || "";
      const isFormation = serviceCategory.toLowerCase().includes("formation") ||
        serviceCategory.toLowerCase().includes("llc") ||
        serviceCategory.toLowerCase().includes("corp");

      if (!isFormation && serviceCategory) continue;

      const llcType = matchingItem?.llc_type || "";
      const annualReportDeadline = service?.annual_report_deadline || "";
      const annualReportDue = calculateAnnualReportDue(entry.state || "", entry.date, annualReportDeadline);
      const federalTaxDue = calculateFederalTaxDue(entry.date, serviceCategory, llcType);

      const existing = await this.getComplianceRecordsByOrder(orderId);
      const match = existing.find(r => r.service_name === (entry.service_name || entry.label) && r.state === (entry.state || ""));

      if (match) {
        await this.updateComplianceRecord(match.id, {
          formation_date: entry.date,
          state: entry.state || match.state,
          annual_report_due: annualReportDue,
          federal_tax_due: federalTaxDue,
          llc_type: llcType || match.llc_type,
        });
      } else {
        await this.createComplianceRecord({
          order_id: orderId,
          customer_id: order.customer_id,
          customer_name: order.customer_name,
          company_name: order.company_name,
          service_name: entry.service_name || entry.label || "",
          service_category: serviceCategory,
          state: entry.state || "",
          llc_type: llcType,
          formation_date: entry.date,
          annual_report_due: annualReportDue,
          annual_report_status: "pending",
          federal_tax_due: federalTaxDue,
          federal_tax_status: "pending",
          federal_tax_reminder_date: "",
          reminder_count: 0,
        });
      }
    }

    try {
      await this.generateComplianceReminders();
    } catch (e) {
      console.log("Auto-generate reminders note:", (e as Error).message);
    }
  }
}

export function calculateAnnualReportDue(state: string, formationDate: string, annualReportDeadline: string): string {
  if (!formationDate || !annualReportDeadline) return "";
  if (annualReportDeadline.toLowerCase().trim() === "n/a") return "";

  const fd = new Date(formationDate);
  if (isNaN(fd.getTime())) return "";

  const now = new Date();
  const currentYear = now.getFullYear();
  const formationYear = fd.getFullYear();
  const formationMonth = fd.getMonth();
  const formationDay = fd.getDate();

  const deadlineLower = annualReportDeadline.toLowerCase().trim();

  const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  function nextUpcoming(month: number, day: number): string {
    if (formationYear >= currentYear) {
      return new Date(formationYear + 1, month, day).toISOString().split("T")[0];
    }
    let year = currentYear;
    if (new Date(year, month, day) <= now) year++;
    return new Date(year, month, day).toISOString().split("T")[0];
  }

  if (deadlineLower === "anniversary month" || deadlineLower === "1st day of anniversary month") {
    return nextUpcoming(formationMonth, 1);
  }

  if (deadlineLower === "anniversary date") {
    return nextUpcoming(formationMonth, formationDay);
  }

  if (deadlineLower === "end of anniversary month" || deadlineLower === "last day of anniversary month") {
    if (formationYear >= currentYear) {
      return new Date(formationYear + 1, formationMonth + 1, 0).toISOString().split("T")[0];
    }
    let year = currentYear;
    if (new Date(year, formationMonth + 1, 0) <= now) year++;
    return new Date(year, formationMonth + 1, 0).toISOString().split("T")[0];
  }

  if (deadlineLower === "anniversary quarter" || deadlineLower === "end of anniversary quarter") {
    const quarterEndMonth = Math.floor(formationMonth / 3) * 3 + 2;
    if (formationYear >= currentYear) {
      return new Date(formationYear + 1, quarterEndMonth + 1, 0).toISOString().split("T")[0];
    }
    let year = currentYear;
    if (new Date(year, quarterEndMonth + 1, 0) <= now) year++;
    return new Date(year, quarterEndMonth + 1, 0).toISOString().split("T")[0];
  }

  if (deadlineLower.includes("within 2.5 months of anniversary")) {
    const targetMonth = formationMonth + 2;
    const targetDay = 15;
    return nextUpcoming(targetMonth, targetDay);
  }

  if (deadlineLower.includes("within 4 months of fiscal year end")) {
    return nextUpcoming(3, 15);
  }

  const nthDayMatch = deadlineLower.match(/(\d+)(?:st|nd|rd|th)\s+day\s+of\s+(\d+)(?:st|nd|rd|th)\s+month/);
  if (nthDayMatch) {
    const day = parseInt(nthDayMatch[1]);
    const monthOffset = parseInt(nthDayMatch[2]) - 1;
    const targetMonth = formationMonth + monthOffset;
    return nextUpcoming(targetMonth, day);
  }

  const betweenMatch = deadlineLower.match(/between\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d+)\s*[-–]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d+)/);
  if (betweenMatch) {
    const month = MONTHS[betweenMatch[1]];
    const day = parseInt(betweenMatch[2]);
    return nextUpcoming(month, day);
  }

  const biennialMatch = deadlineLower.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d+)|^(\d+)[-\s]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (deadlineLower.includes("biennial") || deadlineLower.includes("bi-annual")) {
    let month = 0, day = 1;
    if (biennialMatch) {
      if (biennialMatch[1]) { month = MONTHS[biennialMatch[1]]; day = parseInt(biennialMatch[2]); }
      else { day = parseInt(biennialMatch[3]); month = MONTHS[biennialMatch[4]]; }
    }
    if (formationYear >= currentYear) {
      return new Date(formationYear + 2, month, day).toISOString().split("T")[0];
    }
    let year = currentYear;
    if (new Date(year, month, day) <= now) year++;
    const yearsSinceFormation = year - formationYear;
    if (yearsSinceFormation % 2 !== 0) year++;
    return new Date(year, month, day).toISOString().split("T")[0];
  }

  if (deadlineLower.includes("franchise tax")) {
    const ftMatch = deadlineLower.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d+)|(\d+)[-\s]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
    if (ftMatch) {
      let month: number, day: number;
      if (ftMatch[1]) { month = MONTHS[ftMatch[1]]; day = parseInt(ftMatch[2]); }
      else { day = parseInt(ftMatch[3]); month = MONTHS[ftMatch[4]]; }
      return nextUpcoming(month, day);
    }
  }

  const byMatch = deadlineLower.match(/^by\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d+)|^by\s+(\d+)[-\s]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (byMatch) {
    let month: number, day: number;
    if (byMatch[1]) { month = MONTHS[byMatch[1]]; day = parseInt(byMatch[2]); }
    else { day = parseInt(byMatch[3]); month = MONTHS[byMatch[4]]; }
    return nextUpcoming(month, day);
  }

  const fixedDateMatch = deadlineLower.match(/^(\d{1,2})[-\s]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (fixedDateMatch) {
    const day = parseInt(fixedDateMatch[1]);
    const month = MONTHS[fixedDateMatch[2]];
    return nextUpcoming(month, day);
  }

  const reverseDateMatch = deadlineLower.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[-\s]?(\d{1,2})?/);
  if (reverseDateMatch) {
    const month = MONTHS[reverseDateMatch[1]];
    const day = reverseDateMatch[2] ? parseInt(reverseDateMatch[2]) : 1;
    return nextUpcoming(month, day);
  }

  return "";
}

export function calculateFederalTaxDue(formationDate: string, category: string, llcType: string): string {
  if (!formationDate) return "";

  const fd = new Date(formationDate);
  if (isNaN(fd.getTime())) return "";

  const now = new Date();
  const currentYear = now.getFullYear();
  const formationYear = fd.getFullYear();

  const isPartnership = llcType === "multi-member";
  const deadlineMonth = isPartnership ? 2 : 3;
  const deadlineDay = 15;

  const fmt = (y: number) => `${y}-${String(deadlineMonth + 1).padStart(2, "0")}-${String(deadlineDay).padStart(2, "0")}`;

  if (formationYear > currentYear) {
    return fmt(formationYear + 1);
  }
  if (formationYear === currentYear) {
    return fmt(currentYear + 1);
  }
  const deadline = new Date(currentYear, deadlineMonth, deadlineDay);
  if (now <= deadline) {
    return fmt(currentYear);
  }
  return fmt(currentYear + 1);
}

export const storage = new SupabaseStorage();
