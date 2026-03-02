import { useState, useEffect, useRef, useMemo } from "react";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { countries } from "@/lib/countries";
import {
  Package, FileText, User, Upload, Trash2, Download, Eye,
  Loader2, AlertTriangle, ShieldOff, CheckCircle2, Clock,
  Phone, Mail, MapPin, Building2, Globe, FileUp, X, ArrowLeft,
  Activity, RefreshCw, StickyNote, Calendar, MessageSquare, ClipboardList
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import FloatingChat from "@/components/floating-chat";
import logoPath from "@assets/logo_1772131777440.png";
import type {
  Customer, Order, Invoice, InvoiceItem, InvoicePayment,
  PaymentMethod, CompanySettings, FormationDateEntry, OrderDocument, OrderActivityLog, IncludeMeta
} from "@shared/schema";

interface PortalData {
  link: { id: number; token: string; customer_id: number };
  customer: Partial<Customer> | null;
  company: Partial<CompanySettings> | null;
  paymentMethods: PaymentMethod[];
  hideInvoices?: boolean;
}

interface PortalInvoice extends Invoice {
  items?: InvoiceItem[];
}

type TabId = "orders" | "invoices" | "profile";

async function portalFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  return res;
}

function parsePhoneParts(phone: string): { dialCode: string; localNumber: string } {
  if (!phone) return { dialCode: "", localNumber: "" };
  const match = phone.match(/^(\+[\d-]+)\s+(.*)/);
  if (match) return { dialCode: match[1], localNumber: match[2] };
  const codeOnly = phone.match(/^(\+[\d-]+)$/);
  if (codeOnly) return { dialCode: codeOnly[1], localNumber: "" };
  return { dialCode: "", localNumber: phone };
}

function getLocalPlaceholder(format: string, dialCode: string): string {
  if (!format || !dialCode) return "Phone number";
  const cleanDial = dialCode.replace(/-/g, " ");
  let afterCode = format;
  if (afterCode.startsWith(cleanDial)) {
    afterCode = afterCode.slice(cleanDial.length).trim();
  } else {
    const parts = afterCode.split(" ");
    const dialParts = cleanDial.split(" ");
    afterCode = parts.slice(dialParts.length).join(" ");
  }
  return afterCode || "Phone number";
}

function getExpectedDigitCount(format: string, dialCode: string): number {
  const placeholder = getLocalPlaceholder(format, dialCode);
  return (placeholder.match(/X/g) || []).length;
}

function getStatusBadge(status: string) {
  const colors: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
    pending: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    "in-progress": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    processing: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    "partial-paid": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
    overdue: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    cancelled: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
    archived: "bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  };
  const labels: Record<string, string> = {
    "partial-paid": "Partial Paid",
    "in-progress": "In Progress",
  };
  const label = labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge variant="secondary" className={colors[status] || ""} data-testid={`badge-status-${status}`}>{label}</Badge>;
}

export default function CustomerPortal() {
  const [, params] = useRoute("/portal/:token");
  const token = params?.token || "";
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("orders");

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<number | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const [profileForm, setProfileForm] = useState({
    company_name: "", individual_name: "", email: "", phone: "",
    country: "", state_province: "", residential_address: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    portalFetch(`/api/portal/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({ code: "ERROR", message: "Something went wrong" }));
          setError({ code: data.code || "ERROR", message: data.message || "Something went wrong" });
          setLoading(false);
          return;
        }
        const data: PortalData = await res.json();
        setPortalData(data);
        if (data.customer) {
          setProfileForm({
            company_name: data.customer.company_name || "",
            individual_name: data.customer.individual_name || "",
            email: data.customer.email || "",
            phone: data.customer.phone || "",
            country: data.customer.country || "",
            state_province: data.customer.state_province || "",
            residential_address: data.customer.residential_address || "",
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setError({ code: "ERROR", message: "Failed to connect to server" });
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    if (!portalData) return;
    if (activeTab === "orders" && orders.length === 0 && !ordersLoading) {
      setOrdersLoading(true);
      portalFetch(`/api/portal/${token}/orders`)
        .then(r => r.ok ? r.json() : [])
        .then(data => { setOrders(data); setOrdersLoading(false); })
        .catch(() => setOrdersLoading(false));
    }
    if (activeTab === "invoices" && invoices.length === 0 && !invoicesLoading && !portalData?.hideInvoices) {
      setInvoicesLoading(true);
      portalFetch(`/api/portal/${token}/invoices`)
        .then(r => r.ok ? r.json() : [])
        .then(data => { setInvoices(data); setInvoicesLoading(false); })
        .catch(() => setInvoicesLoading(false));
    }
  }, [activeTab, portalData]);

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      const res = await portalFetch(`/api/portal/${token}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to save" }));
        throw new Error(err.message);
      }
      toast({ title: "Profile updated successfully" });
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <Toaster />
      </div>
    );
  }

  if (error) {
    const isRevoked = error.code === "REVOKED";
    return (
      <div className="min-h-screen bg-background">
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
          <div className="flex items-center gap-3 mb-8">
            <img src={logoPath} alt="Infinity Filer" className="h-10 w-10 rounded-full object-cover" />
            <span className="text-xl font-bold text-foreground">Infinity Filer</span>
          </div>
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              {isRevoked ? (
                <ShieldOff className="h-16 w-16 mx-auto mb-4 text-destructive" />
              ) : (
                <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-amber-500" />
              )}
              <h2 className="text-xl font-bold mb-2 text-foreground" data-testid="text-error-title">
                {isRevoked ? "Link Revoked" : "Link Not Found"}
              </h2>
              <p className="text-muted-foreground" data-testid="text-error-message">
                {isRevoked
                  ? "This portal link has been revoked by the administrator. Please contact support for assistance."
                  : "The portal link you are trying to access does not exist. Please check the URL and try again."}
              </p>
            </CardContent>
          </Card>
          <p className="mt-8 text-sm text-muted-foreground">
            Powered by Infinity Filer
          </p>
        </div>
        <Toaster />
      </div>
    );
  }

  if (!portalData) return null;

  const companyName = portalData.company?.company_name || "Infinity Filer";
  const customerName = portalData.customer?.individual_name || "Customer";

  const hideInvoices = portalData.hideInvoices === true;

  const tabs: { id: TabId; label: string; icon: typeof Package }[] = [
    { id: "orders", label: "Orders", icon: Package },
    ...(!hideInvoices ? [{ id: "invoices" as TabId, label: "Invoices", icon: FileText }] : []),
    { id: "profile", label: "My Profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src={logoPath} alt={companyName} className="h-9 w-9 rounded-full object-cover" />
          <div className="min-w-0">
            <h1 className="text-base font-bold text-foreground truncate" data-testid="text-company-name">{companyName}</h1>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-customer-greeting">Welcome, {customerName}</p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px overflow-x-auto" data-testid="nav-portal-tabs">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground"
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {activeTab === "orders" && (
          <OrdersTab
            orders={orders}
            loading={ordersLoading}
            token={token}
            pendingOrderId={pendingOrderId}
            clearPendingOrderId={() => setPendingOrderId(null)}
            hideInvoices={hideInvoices}
            onNavigateToInvoice={hideInvoices ? undefined : (invoiceId) => {
              setActiveTab("invoices");
              setPendingInvoiceId(invoiceId);
            }}
          />
        )}
        {!hideInvoices && activeTab === "invoices" && (
          <InvoicesTab
            invoices={invoices}
            loading={invoicesLoading}
            paymentMethods={portalData.paymentMethods}
            token={token}
            portalData={portalData}
            orders={orders}
            pendingInvoiceId={pendingInvoiceId}
            clearPendingInvoiceId={() => setPendingInvoiceId(null)}
            onNavigateToOrder={(orderId) => {
              setActiveTab("orders");
              setPendingOrderId(orderId);
            }}
          />
        )}
        {activeTab === "profile" && (
          <ProfileTab
            form={profileForm}
            onChange={setProfileForm}
            onSave={handleProfileSave}
            saving={profileSaving}
          />
        )}
      </main>

      <footer className="border-t py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground" data-testid="text-footer">
            Powered by {companyName}
          </p>
          {portalData.company?.support_email && (
            <p className="text-xs text-muted-foreground mt-1">
              <Mail className="h-3 w-3 inline mr-1" />
              {portalData.company.support_email}
              {portalData.company.phone && (
                <>
                  <span className="mx-2">|</span>
                  <Phone className="h-3 w-3 inline mr-1" />
                  {portalData.company.phone}
                </>
              )}
            </p>
          )}
        </div>
      </footer>
      <Toaster />
    </div>
  );
}

interface OrderDetailData {
  order: Order;
  invoice: Invoice | null;
  invoiceItems: InvoiceItem[];
  documents: OrderDocument[];
  activityLogs: OrderActivityLog[];
}

function OrdersTab({ orders, loading, token, onNavigateToInvoice, pendingOrderId, clearPendingOrderId, hideInvoices = false }: { orders: Order[]; loading: boolean; token: string; onNavigateToInvoice?: (invoiceId: number) => void; pendingOrderId?: number | null; clearPendingOrderId?: () => void; hideInvoices?: boolean }) {
  const { toast } = useToast();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<OrderDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await portalFetch(`/api/portal/${token}/chats/unread-counts`);
        if (res.ok) setUnreadCounts(await res.json());
      } catch (_) {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchOrderDetail = async (orderId: number) => {
    setSelectedOrderId(orderId);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await portalFetch(`/api/portal/${token}/orders/${orderId}`);
      if (res.ok) {
        const data: OrderDetailData = await res.json();
        setDetailData(data);
      } else {
        toast({ title: "Error", description: "Failed to load order details. Please try again.", variant: "destructive" });
      }
    } catch (_) {
      toast({ title: "Error", description: "Could not connect. Please try again.", variant: "destructive" });
    }
    setDetailLoading(false);
  };

  useEffect(() => {
    if (pendingOrderId && pendingOrderId !== selectedOrderId) {
      fetchOrderDetail(pendingOrderId);
      if (clearPendingOrderId) clearPendingOrderId();
    }
  }, [pendingOrderId]);

  const handleBack = () => {
    setSelectedOrderId(null);
    setDetailData(null);
  };

  if (selectedOrderId !== null) {
    if (detailLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      );
    }

    if (detailData) {
      return (
        <OrderDetailView
          data={detailData}
          token={token}
          onBack={handleBack}
          onRefetch={() => fetchOrderDetail(selectedOrderId)}
          onNavigateToInvoice={onNavigateToInvoice}
          hideInvoices={hideInvoices}
        />
      );
    }

    return (
      <div>
        <Button variant="ghost" onClick={handleBack} data-testid="button-back-orders">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Orders
        </Button>
        <Card className="mt-4">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Failed to load order details.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-orders">No orders found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground" data-testid="text-orders-title">Your Orders</h2>
      {orders.map(order => {
        const includesMeta: Record<string, IncludeMeta> = order.includes_meta || {};
        const allIncludes = order.includes || [];
        const deliveredCount = allIncludes.filter(i => includesMeta[i]?.status === "delivered").length;
        const progressPct = allIncludes.length > 0 ? Math.round((deliveredCount / allIncludes.length) * 100) : 0;
        return (
          <Card
            key={order.id}
            className="cursor-pointer hover-elevate"
            onClick={() => fetchOrderDetail(order.id)}
            data-testid={`card-order-${order.id}`}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                <div>
                  <p className="font-semibold text-foreground" data-testid={`text-order-number-${order.id}`}>
                    {order.order_number}
                  </p>
                  <p className="text-sm text-muted-foreground">{order.company_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(unreadCounts[String(order.id)] || 0) > 0 && (
                    <div className="flex items-center gap-1 bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse" data-testid={`badge-unread-chat-${order.id}`}>
                      <MessageSquare className="h-3 w-3" />
                      <span className="text-[10px] font-bold">{unreadCounts[String(order.id)]}</span>
                    </div>
                  )}
                  {getStatusBadge(order.status)}
                </div>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Services: </span>
                  <span className="text-foreground">{order.service_type?.replace(/\|/g, ", ") || "-"}</span>
                </div>
                {!hideInvoices && order.invoice_number && (
                  <div>
                    <span className="text-muted-foreground">Invoice: </span>
                    <span className="text-foreground">{order.invoice_number}</span>
                  </div>
                )}
              </div>
              {allIncludes.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                    <span>Progress: {deliveredCount}/{allIncludes.length} items</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Created: {new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function OrderDetailView({
  data,
  token,
  onBack,
  onRefetch,
  onNavigateToInvoice,
  hideInvoices = false,
}: {
  data: OrderDetailData;
  token: string;
  onBack: () => void;
  onRefetch: () => void;
  onNavigateToInvoice?: (invoiceId: number) => void;
  hideInvoices?: boolean;
}) {
  const { toast } = useToast();
  const { order, invoice, invoiceItems, documents, activityLogs } = data;
  const includesMeta: Record<string, IncludeMeta> = order.includes_meta || {};
  const formationDates = order.formation_dates || {};
  const formationEntries = Object.entries(formationDates).filter(([, e]) => e.date);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const serviceGroups = useMemo(() => {
    const groups: { name: string; includes: string[] }[] = [];
    const allIncludes = order.includes || [];

    if (invoiceItems.length > 0) {
      const assignedIncludes = new Set<string>();
      for (const item of invoiceItems) {
        const itemIncludes = (item.includes || []).filter(inc => allIncludes.includes(inc));
        if (itemIncludes.length > 0) {
          groups.push({ name: item.description, includes: itemIncludes });
          itemIncludes.forEach(inc => assignedIncludes.add(inc));
        }
      }
      const remaining = allIncludes.filter(inc => !assignedIncludes.has(inc));
      if (remaining.length > 0) {
        groups.push({ name: "Other Items", includes: remaining });
      }
    } else if (allIncludes.length > 0) {
      groups.push({ name: order.service_type?.replace(/\|/g, ", ") || "Services", includes: allIncludes });
    }

    return groups;
  }, [order, invoiceItems]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("document_name", uploadName || uploadFile.name);
      const res = await portalFetch(`/api/portal/${token}/orders/${order.id}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      toast({ title: "Document uploaded successfully" });
      setUploadFile(null);
      setUploadName("");
      if (fileRef.current) fileRef.current.value = "";
      onRefetch();
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "status_change": return <RefreshCw className="h-3.5 w-3.5 text-blue-500" />;
      case "document_uploaded": return <FileUp className="h-3.5 w-3.5 text-green-500" />;
      case "document_deleted": return <Trash2 className="h-3.5 w-3.5 text-red-500" />;
      case "note_added": return <StickyNote className="h-3.5 w-3.5 text-amber-500" />;
      case "include_status": return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case "include_note": return <MessageSquare className="h-3.5 w-3.5 text-purple-500" />;
      case "formation_date": return <Calendar className="h-3.5 w-3.5 text-indigo-500" />;
      case "manual_log": return <ClipboardList className="h-3.5 w-3.5 text-slate-500" />;
      default: return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "status_change": return "Status Change";
      case "document_uploaded": return "Document Upload";
      case "document_deleted": return "Document Deleted";
      case "note_added": return "Note Added";
      case "include_status": return "Item Status";
      case "include_note": return "Item Note";
      case "formation_date": return "Formation Date";
      case "manual_log": return "Manual Log";
      default: return action;
    }
  };

  const allIncludes = order.includes || [];
  const deliveredCount = allIncludes.filter(i => includesMeta[i]?.status === "delivered").length;
  const progressPct = allIncludes.length > 0 ? Math.round((deliveredCount / allIncludes.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} data-testid="button-back-orders">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Orders
      </Button>

      <Card data-testid="card-order-header">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
            <div>
              <h2 className="text-xl font-bold text-foreground" data-testid="text-order-detail-number">
                {order.order_number}
              </h2>
              <p className="text-sm text-muted-foreground">{order.company_name}</p>
            </div>
            {getStatusBadge(order.status)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mt-3">
            <div>
              <span className="text-muted-foreground">Services: </span>
              <span className="text-foreground">{order.service_type?.replace(/\|/g, ", ") || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span className="text-foreground">
                {new Date(order.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </span>
            </div>
            {!hideInvoices && order.invoice_number && invoice && (
              <div>
                <span className="text-muted-foreground">Invoice: </span>
                {onNavigateToInvoice && invoice.id ? (
                  <button
                    className="text-primary hover:underline font-medium"
                    onClick={() => onNavigateToInvoice(invoice.id)}
                    data-testid="link-order-to-invoice"
                  >
                    {order.invoice_number}
                  </button>
                ) : (
                  <span className="text-foreground">{order.invoice_number}</span>
                )}
              </div>
            )}
            {order.referral_name && (
              <div>
                <span className="text-muted-foreground">Referred By: </span>
                <span className="text-foreground">{order.referral_name}</span>
              </div>
            )}
          </div>
          {allIncludes.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground mb-2">
                <span>Overall Progress</span>
                <span className="font-medium text-foreground">{deliveredCount}/{allIncludes.length} ({progressPct}%)</span>
              </div>
              <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {serviceGroups.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-foreground" data-testid="text-service-progress-title">Service Progress</h3>
          {serviceGroups.map((group, gIdx) => {
            const groupDelivered = group.includes.filter(i => includesMeta[i]?.status === "delivered").length;
            return (
              <Card key={gIdx} data-testid={`card-service-group-${gIdx}`}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                    <h4 className="font-medium text-foreground">{group.name}</h4>
                    <span className="text-xs text-muted-foreground">{groupDelivered}/{group.includes.length} delivered</span>
                  </div>
                  <div className="space-y-2">
                    {group.includes.map((item, idx) => {
                      const status = includesMeta[item]?.status || "pending";
                      const isDelivered = status === "delivered";
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-muted/50"
                          data-testid={`item-include-${gIdx}-${idx}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isDelivered ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span className={`text-sm truncate ${isDelivered ? "text-foreground" : "text-muted-foreground"}`}>
                              {item}
                            </span>
                          </div>
                          {isDelivered ? (
                            <Badge variant="default" className="bg-emerald-600 text-white shrink-0">Delivered</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 shrink-0">Pending</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {formationEntries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground" data-testid="text-formation-dates-title">Formation Dates</h3>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {formationEntries.map(([key, entry]) => (
                  <div key={key} className="flex items-center gap-3 flex-wrap">
                    <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{entry.label || entry.service_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                        {entry.state && <span> - {entry.state}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground" data-testid="text-documents-section-title">Documents</h3>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="text-sm font-medium text-foreground mb-3">Upload Document</p>
            <div className="space-y-3">
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      setUploadName(f.name.replace(/\.[^/.]+$/, ""));
                    }
                  }}
                  data-testid="input-order-upload-file"
                />
                {uploadFile ? (
                  <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                    <FileUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate flex-1">{uploadFile.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setUploadFile(null); setUploadName(""); if (fileRef.current) fileRef.current.value = ""; }}
                      data-testid="button-clear-order-file"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    className="w-full"
                    data-testid="button-select-order-file"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Select File
                  </Button>
                )}
              </div>
              {uploadFile && (
                <>
                  <div>
                    <Label>Document Name</Label>
                    <Input
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="Enter document name"
                      data-testid="input-order-document-name"
                    />
                  </div>
                  <Button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full"
                    data-testid="button-upload-order-document"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Upload
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {documents.length > 0 && (
          <div className="space-y-2">
            {documents.map(doc => (
              <Card key={doc.id} data-testid={`card-order-document-${doc.id}`}>
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" data-testid={`text-order-doc-name-${doc.id}`}>
                      {doc.document_name || doc.file_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.uploaded_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                  {doc.uploaded_by === "customer" ? (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 shrink-0">Customer</Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">Admin</Badge>
                  )}
                  {doc.dropbox_path && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="View"
                        data-testid={`link-view-doc-${doc.id}`}
                        onClick={async () => {
                          const newTab = window.open("about:blank", "_blank");
                          try {
                            const res = await portalFetch(`/api/portal/${token}/orders/${order.id}/documents/${doc.id}/download`);
                            if (!res.ok) throw new Error("Failed to load document");
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            if (newTab) {
                              newTab.location.href = url;
                            } else {
                              window.open(url, "_blank");
                            }
                            setTimeout(() => URL.revokeObjectURL(url), 60000);
                          } catch {
                            if (newTab) newTab.close();
                            toast({ title: "Failed to view document", variant: "destructive" });
                          }
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Download"
                        data-testid={`link-download-doc-${doc.id}`}
                        onClick={async () => {
                          try {
                            const res = await portalFetch(`/api/portal/${token}/orders/${order.id}/documents/${doc.id}/download`);
                            if (!res.ok) throw new Error("Failed to download document");
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = doc.document_name || doc.file_name;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            setTimeout(() => URL.revokeObjectURL(url), 60000);
                          } catch {
                            toast({ title: "Failed to download document", variant: "destructive" });
                          }
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {documents.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No documents yet</p>
            </CardContent>
          </Card>
        )}
      </div>

      {activityLogs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground" data-testid="text-activity-log-title">Activity Log</h3>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {[...activityLogs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((log) => (
                  <div key={log.id} className="flex items-start gap-3" data-testid={`activity-log-${log.id}`}>
                    <div className="mt-0.5 shrink-0">{getActionIcon(log.action)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-foreground">{getActionLabel(log.action)}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(log.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{log.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <FloatingChat
        orderId={order.id}
        senderType="customer"
        senderName={data.order.customer_name || "Customer"}
        fetchUrl={`/api/portal/${token}/orders/${order.id}/chats`}
        postUrl={`/api/portal/${token}/orders/${order.id}/chats`}
        downloadUrlPrefix={`/api/portal/${token}/chats`}
        markAsReadUrl={`/api/portal/${token}/orders/${order.id}/chats/read`}
      />
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}


function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getStatusStyle(status: string) {
  switch (status) {
    case "paid": return { bg: "#dcfce7", color: "#166534", label: "PAID" };
    case "pending": return { bg: "#fef3c7", color: "#92400e", label: "PENDING" };
    case "partial-paid": return { bg: "#dbeafe", color: "#1e40af", label: "PARTIAL PAID" };
    case "overdue": return { bg: "#fee2e2", color: "#991b1b", label: "OVERDUE" };
    case "cancelled": return { bg: "#f3f4f6", color: "#6b7280", label: "CANCELLED" };
    default: return { bg: "#f3f4f6", color: "#6b7280", label: status.toUpperCase() };
  }
}

interface InvoiceDetailData {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  settings: CompanySettings | null;
  referralName?: string;
  referralPartnerInfo?: { full_name: string; phone: string; email: string; referral_code: string } | null;
}

function InvoicesTab({
  invoices,
  loading,
  paymentMethods,
  token,
  portalData,
  orders,
  pendingInvoiceId,
  clearPendingInvoiceId,
  onNavigateToOrder,
}: {
  invoices: PortalInvoice[];
  loading: boolean;
  paymentMethods: PaymentMethod[];
  token: string;
  portalData: PortalData;
  orders: Order[];
  pendingInvoiceId?: number | null;
  clearPendingInvoiceId?: () => void;
  onNavigateToOrder?: (orderId: number) => void;
}) {
  const { toast } = useToast();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<InvoiceDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchInvoiceDetail = async (invoiceId: number) => {
    setSelectedInvoiceId(invoiceId);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await portalFetch(`/api/portal/${token}/invoices/${invoiceId}`);
      if (res.ok) {
        const data: InvoiceDetailData = await res.json();
        setDetailData(data);
      } else {
        toast({ title: "Error", description: "Failed to load invoice details. Please try again.", variant: "destructive" });
      }
    } catch (_) {
      toast({ title: "Error", description: "Could not connect. Please try again.", variant: "destructive" });
    }
    setDetailLoading(false);
  };

  useEffect(() => {
    if (pendingInvoiceId && pendingInvoiceId !== selectedInvoiceId) {
      fetchInvoiceDetail(pendingInvoiceId);
      if (clearPendingInvoiceId) clearPendingInvoiceId();
    }
  }, [pendingInvoiceId]);

  const handleBack = () => {
    setSelectedInvoiceId(null);
    setDetailData(null);
  };

  if (selectedInvoiceId !== null) {
    if (detailLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      );
    }

    if (detailData) {
      return (
        <InvoiceDetailView
          data={detailData}
          paymentMethods={paymentMethods}
          portalData={portalData}
          token={token}
          orders={orders}
          onBack={handleBack}
          onNavigateToOrder={onNavigateToOrder}
        />
      );
    }

    return (
      <div>
        <Button variant="ghost" onClick={handleBack} data-testid="button-back-invoices">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
        <Card className="mt-4">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Failed to load invoice details.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground" data-testid="text-no-invoices">No invoices found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground" data-testid="text-invoices-title">Your Invoices</h2>
      {invoices.map(invoice => {
        const amountPaid = Number(invoice.amount_paid || 0);
        const total = Number(invoice.total);
        const paidPct = total > 0 ? Math.min((amountPaid / total) * 100, 100) : 0;
        return (
          <Card
            key={invoice.id}
            className="cursor-pointer hover-elevate"
            onClick={() => fetchInvoiceDetail(invoice.id)}
            data-testid={`card-invoice-${invoice.id}`}
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
                <div>
                  <p className="font-semibold text-foreground" data-testid={`text-invoice-number-${invoice.id}`}>
                    {invoice.invoice_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(invoice.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    {invoice.due_date && <span> | Due: {invoice.due_date}</span>}
                  </p>
                </div>
                {getStatusBadge(invoice.status)}
              </div>
              <div className="flex items-center justify-between gap-4 flex-wrap mt-3">
                <span className="text-lg font-bold text-foreground">${total.toFixed(2)}</span>
                {amountPaid > 0 && amountPaid < total && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${paidPct}%` }} />
                    </div>
                    <span>{paidPct.toFixed(0)}% paid</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function InvoiceDetailView({
  data,
  paymentMethods,
  portalData,
  token,
  orders,
  onBack,
  onNavigateToOrder,
}: {
  data: InvoiceDetailData;
  paymentMethods: PaymentMethod[];
  portalData: PortalData;
  token: string;
  orders: Order[];
  onBack: () => void;
  onNavigateToOrder?: (orderId: number) => void;
}) {
  const { toast } = useToast();
  const { invoice, items, payments, settings, referralName, referralPartnerInfo } = data;
  const matchedOrder = orders.find(o => o.order_number === invoice.order_number);
  const amountPaid = Number(invoice.amount_paid || 0);
  const totalDue = Number(invoice.total);
  const remaining = Math.max(0, totalDue - amountPaid);
  const paidPct = totalDue > 0 ? Math.min((amountPaid / totalDue) * 100, 100) : 0;
  const enabledMethods = paymentMethods.filter(m => m.is_enabled);
  const displayMethods = invoice.payment_methods_snapshot && invoice.payment_methods_snapshot.length > 0
    ? invoice.payment_methods_snapshot
    : enabledMethods;

  const companyName = settings?.company_name || portalData.company?.company_name || "Infinity Filer";
  const companyAddr = settings?.address || "";
  const companyPhone = settings?.phone || portalData.company?.phone || "";
  const companyEmail = settings?.support_email || portalData.company?.support_email || "";

  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofAmount, setProofAmount] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const proofFileRef = useRef<HTMLInputElement>(null);

  const whatsappNumber = settings?.whatsapp || portalData.company?.whatsapp || "";

  const handleProofSubmit = async () => {
    if (!proofFile || !proofAmount) return;
    setProofUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", proofFile);
      formData.append("amount", proofAmount);
      const res = await portalFetch(`/api/portal/${token}/invoices/${invoice.id}/payment-proof`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      const result = await res.json();
      toast({ title: "Proof of payment uploaded successfully" });
      setProofDialogOpen(false);
      setProofFile(null);
      setProofAmount("");
      if (proofFileRef.current) proofFileRef.current.value = "";

      const cleanNumber = whatsappNumber.replace(/[^0-9]/g, "");
      if (cleanNumber) {
        const message = `Hi, I've made a payment of $${proofAmount} for Invoice ${invoice.invoice_number}. Proof of payment: ${result.dropboxViewLink || "attached"}.  Please verify.`;
        const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
        window.open(waUrl, "_blank");
      } else {
        toast({ title: "Proof uploaded", description: "WhatsApp number not available. Please contact support directly." });
      }
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setProofUploading(false);
    }
  };

  const fmtPkr = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const exportPDF = async () => {
    const logoImg = document.querySelector("#portal-invoice-logo") as HTMLImageElement | null;
    let logoDataUrl = "";
    if (logoImg) {
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          if (logoImg.complete && logoImg.naturalWidth > 0) { resolve(logoImg); return; }
          const fresh = new Image();
          fresh.crossOrigin = "anonymous";
          fresh.onload = () => resolve(fresh);
          fresh.onerror = reject;
          fresh.src = logoImg.src;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          logoDataUrl = canvas.toDataURL("image/png");
        }
      } catch (_) {}
    }

    const ss = getStatusStyle(invoice.status);

    const itemRows = items.map(item => {
      const includesHtml = item.includes && item.includes.length > 0
        ? `<tr><td colspan="5" style="padding:0 12px 10px 12px;border:none;">
             <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 12px;font-size:11px;color:#166534;">
               <strong>Includes:</strong> ${item.includes.map(i => esc(i)).join(" &bull; ")}
             </div>
           </td></tr>`
        : "";
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;">${esc(item.description)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center;">${esc(item.state) || "-"}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;text-align:center;">${item.quantity}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;text-align:right;">$${Number(item.unit_price).toFixed(2)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;text-align:right;font-weight:600;">$${Number(item.total).toFixed(2)}</td>
        </tr>
        ${includesHtml}
      `;
    }).join("");

    const hasDiscount = Number(invoice.discount_amount) > 0;
    const discountLabel = Number(invoice.discount_percentage) > 0
      ? `Discount (${invoice.discount_percentage}%)`
      : "Discount";

    const paymentHistoryHtml = payments.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Payment History</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px;text-align:left;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">Date</th>
            <th style="padding:8px;text-align:right;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">USD</th>
            <th style="padding:8px;text-align:right;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">PKR</th>
            <th style="padding:8px;text-align:left;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">Note</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map(p => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#374151;">${new Date(p.payment_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#374151;font-weight:600;">$${Number(p.amount_usd).toFixed(2)}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#374151;">${Number(p.amount_pkr) > 0 ? `PKR ${Number(p.amount_pkr).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : '-'}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#6b7280;">${esc(p.note) || '-'}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>` : "";

    const methodsHtml = displayMethods.length > 0 ? displayMethods.map(m => `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:8px;">
        <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:8px;">${esc(m.label || m.bank_name || "Payment Method")} ${m.currency ? `<span style="font-size:10px;color:#6b7280;">(${esc(m.currency)})</span>` : ""}</div>
        ${m.bank_name ? `<div style="font-size:12px;color:#475569;line-height:1.8;"><span style="font-weight:600;color:#64748b;display:inline-block;width:130px;">Bank:</span> ${esc(m.bank_name)}</div>` : ""}
        ${m.account_holder ? `<div style="font-size:12px;color:#475569;line-height:1.8;"><span style="font-weight:600;color:#64748b;display:inline-block;width:130px;">Account Holder:</span> ${esc(m.account_holder)}</div>` : ""}
        ${m.account_number ? `<div style="font-size:12px;color:#475569;line-height:1.8;"><span style="font-weight:600;color:#64748b;display:inline-block;width:130px;">Account #:</span> ${esc(m.account_number)}</div>` : ""}
        ${m.iban ? `<div style="font-size:12px;color:#475569;line-height:1.8;"><span style="font-weight:600;color:#64748b;display:inline-block;width:130px;">IBAN:</span> ${esc(m.iban)}</div>` : ""}
        ${m.link_url ? `<div style="font-size:12px;color:#475569;line-height:1.8;"><span style="font-weight:600;color:#64748b;display:inline-block;width:130px;">Link:</span> <a href="${esc(m.link_url)}" style="color:#2563eb;">${esc(m.link_url)}</a></div>` : ""}
        ${m.details ? Object.entries(m.details).map(([k, v]) => `<div style="font-size:12px;color:#475569;line-height:1.8;"><span style="font-weight:600;color:#64748b;display:inline-block;width:130px;">${esc(k)}:</span> ${esc(v)}</div>`).join("") : ""}
      </div>
    `).join("") : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${esc(invoice.invoice_number)} - ${esc(companyName)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; background: #fff; }
    .page { max-width: 800px; margin: 0 auto; padding: 48px 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #1e3a5f; }
    .company-block { display: flex; align-items: center; gap: 14px; }
    .company-logo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid #e5e7eb; }
    .company-name { font-size: 22px; font-weight: 700; color: #1e3a5f; margin-bottom: 2px; }
    .company-detail { font-size: 11px; color: #6b7280; line-height: 1.6; }
    .invoice-title-block { text-align: right; }
    .invoice-title { font-size: 32px; font-weight: 800; color: #1e3a5f; letter-spacing: 2px; margin-bottom: 6px; }
    .invoice-num { font-size: 14px; color: #374151; font-weight: 600; }
    .status-badge { display: inline-block; padding: 5px 16px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-top: 10px; }
    .meta-grid { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .meta-col { flex: 1; }
    .meta-col.right { text-align: right; }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af; font-weight: 600; margin-bottom: 6px; }
    .meta-value { font-size: 14px; color: #1f2937; font-weight: 600; }
    .meta-sub { font-size: 12px; color: #6b7280; line-height: 1.5; }
    .date-row { font-size: 12px; color: #6b7280; margin-bottom: 3px; }
    .date-label { color: #9ca3af; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #1e3a5f; }
    thead th { padding: 12px; font-size: 11px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.8px; }
    thead th:first-child { text-align: left; border-radius: 6px 0 0 0; }
    thead th:last-child { border-radius: 0 6px 0 0; }
    .totals-section { display: flex; justify-content: flex-end; margin-bottom: 32px; }
    .totals-box { width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #374151; }
    .total-row.discount { color: #16a34a; }
    .total-row.grand { border-top: 2px solid #1e3a5f; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 800; color: #1e3a5f; }
    .payment-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .payment-title { font-size: 13px; font-weight: 700; color: #1e3a5f; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .payment-row { font-size: 12px; color: #475569; line-height: 1.8; }
    .payment-label { font-weight: 600; color: #64748b; display: inline-block; width: 130px; }
    .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .notes-title { font-size: 12px; font-weight: 700; color: #92400e; margin-bottom: 6px; }
    .notes-text { font-size: 12px; color: #78716c; line-height: 1.5; }
    .terms-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .terms-title { font-size: 12px; font-weight: 700; color: #1e3a5f; margin-bottom: 6px; }
    .terms-text { font-size: 11px; color: #64748b; line-height: 1.6; }
    .footer { text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb; }
    .footer-thanks { font-size: 16px; font-weight: 700; color: #1e3a5f; margin-bottom: 6px; }
    .footer-info { font-size: 11px; color: #9ca3af; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 24px 32px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="company-block">
        ${logoDataUrl ? `<img src="${logoDataUrl}" class="company-logo" />` : ""}
        <div>
          <div class="company-name">${esc(companyName)}</div>
          <div class="company-detail">${esc(companyAddr)}</div>
          <div class="company-detail">${esc(companyPhone)}${companyEmail ? ` | ${esc(companyEmail)}` : ""}</div>
        </div>
      </div>
      <div class="invoice-title-block">
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-num">${esc(invoice.invoice_number)}</div>
        <div class="status-badge" style="background:${ss.bg};color:${ss.color};">${ss.label}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <div class="meta-label">Bill To</div>
        <div class="meta-value">${esc(invoice.company_name)}</div>
        <div class="meta-sub">${esc(invoice.customer_name)}</div>
        <div class="meta-sub">${esc(invoice.customer_email)}</div>
        <div class="meta-sub">${esc(invoice.customer_phone)}</div>
      </div>
      ${referralPartnerInfo || referralName ? `
      <div class="meta-col">
        <div class="meta-label">Referred By</div>
        <div class="meta-value">${esc(referralPartnerInfo?.full_name || referralName || "")}</div>
        ${referralPartnerInfo?.phone ? `<div class="meta-sub">${esc(referralPartnerInfo.phone)}</div>` : ""}
        ${referralPartnerInfo?.email ? `<div class="meta-sub">${esc(referralPartnerInfo.email)}</div>` : ""}
        ${referralPartnerInfo?.referral_code ? `<div class="meta-sub">Code: ${esc(referralPartnerInfo.referral_code)}</div>` : ""}
      </div>` : ""}
      <div class="meta-col right">
        ${invoice.order_number ? `<div class="date-row"><span class="date-label">Order:</span> ${esc(invoice.order_number)}</div>` : ""}
        <div class="date-row"><span class="date-label">Invoice Date:</span> ${new Date(invoice.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
        ${invoice.due_date ? `<div class="date-row"><span class="date-label">Due Date:</span> ${invoice.due_date}</div>` : ""}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align:left;">Description</th>
          <th style="text-align:center;">State</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Unit Price</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="totals-section">
      <div class="totals-box">
        <div class="total-row"><span>Subtotal</span><span>$${Number(invoice.subtotal).toFixed(2)}</span></div>
        ${hasDiscount ? `<div class="total-row discount"><span>${discountLabel}</span><span>-$${Number(invoice.discount_amount).toFixed(2)}</span></div>` : ""}
        <div class="total-row grand"><span>Total Due</span><span>$${totalDue.toFixed(2)}</span></div>
        ${amountPaid > 0 ? `
        <div class="total-row" style="color:#166534;"><span>Amount Paid</span><span>-$${amountPaid.toFixed(2)}</span></div>
        <div class="total-row" style="font-weight:700;color:#991b1b;border-top:1px solid #e5e7eb;padding-top:6px;"><span>Remaining Balance</span><span>$${remaining.toFixed(2)}</span></div>
        ` : ""}
      </div>
    </div>

    ${invoice.pkr_enabled && Number(invoice.pkr_rate) > 0 ? `
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:20px;margin-bottom:24px;">
      <div style="font-size:13px;font-weight:700;color:#065f46;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Payment in PKR</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#475569;line-height:2;">
        <span>USD $${totalDue.toFixed(2)} x ${Number(invoice.pkr_rate).toFixed(2)}</span>
        <span style="font-weight:600;">PKR ${fmtPkr(Number(invoice.pkr_amount))}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#475569;line-height:2;">
        <span>Currency Conversion Tax (${Number(invoice.pkr_tax_rate)}%)</span>
        <span style="font-weight:600;">PKR ${fmtPkr(Number(invoice.pkr_tax_amount))}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:#065f46;border-top:2px solid #a7f3d0;margin-top:8px;padding-top:10px;">
        <span>Total Payable in PKR</span>
        <span>PKR ${fmtPkr(Number(invoice.pkr_total))}</span>
      </div>
      <div style="font-size:10px;color:#6b7280;margin-top:8px;">Exchange rate: 1 USD = ${Number(invoice.pkr_rate).toFixed(2)} PKR</div>
    </div>` : ""}

    ${paymentHistoryHtml}
    ${methodsHtml}

    ${invoice.notes ? `
    <div class="notes-box">
      <div class="notes-title">Notes</div>
      <div class="notes-text">${esc(invoice.notes)}</div>
    </div>
    ` : ""}

    <div class="payment-box" style="background:#fef9c3;border-color:#facc15;">
      <div class="payment-title" style="color:#854d0e;">Payment Verification</div>
      <div style="font-size:11px;color:#713f12;line-height:1.6;">
        Once payment is done, please take a screenshot of the payment as proof and send it via WhatsApp to <strong>+92 320 3682461</strong> to verify your payment and start your order. Please mention your Invoice ID <strong>${esc(invoice.invoice_number)}</strong> to confirm your payment.
      </div>
    </div>

    <div class="terms-box">
      <div class="terms-title">Terms & Conditions</div>
      <div class="terms-text">
        1. Payment is due by the due date specified on this invoice.<br>
        2. Late payments may result in service suspension or delays in processing.<br>
        3. Partial payments are accepted only if you have chosen multiple services. Single service requires full payment in advance.<br>
        4. All amounts are in USD unless otherwise specified.<br>
        5. PKR amounts are calculated based on the exchange rate at the time of invoice creation.<br>
        6. Services will be delivered upon receipt of full payment unless otherwise agreed.<br>
        7. Refunds are processed according to our refund policy.<br>
        8. For questions regarding this invoice, please contact ${esc(companyEmail) || 'support'}.
      </div>
    </div>

    <div class="footer">
      <div class="footer-thanks">Thank you for your business!</div>
      <div class="footer-info">${esc(companyName)} | ${esc(companyEmail)} | ${esc(companyPhone)}</div>
    </div>
  </div>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Button variant="ghost" onClick={onBack} data-testid="button-back-invoices">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          {invoice.status !== "paid" && (
            <Button
              onClick={() => setProofDialogOpen(true)}
              className="bg-emerald-600 text-white border-emerald-700 dark:bg-emerald-700 dark:border-emerald-800"
              data-testid="button-send-proof"
            >
              <SiWhatsapp className="h-4 w-4 mr-2" />
              Send Proof of Payment
            </Button>
          )}
          <Button onClick={exportPDF} data-testid="button-download-pdf">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-4 mb-4">
            <img
              id="portal-invoice-logo"
              src={logoPath}
              alt={companyName}
              className="h-12 w-12 rounded-full object-cover border"
              crossOrigin="anonymous"
            />
            <div className="min-w-0">
              <p className="font-bold text-foreground text-lg" data-testid="text-detail-company">{companyName}</p>
              {companyAddr && <p className="text-xs text-muted-foreground">{companyAddr}</p>}
              <p className="text-xs text-muted-foreground">
                {companyPhone}{companyEmail ? ` | ${companyEmail}` : ""}
              </p>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xl font-bold text-foreground" data-testid="text-detail-invoice-number">
                {invoice.invoice_number}
              </p>
              {invoice.order_number && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <span>Order:</span>
                  {onNavigateToOrder && matchedOrder ? (
                    <button
                      className="text-primary hover:underline font-medium"
                      onClick={() => onNavigateToOrder(matchedOrder.id)}
                      data-testid="link-invoice-to-order"
                    >
                      {invoice.order_number}
                    </button>
                  ) : (
                    <span className="text-foreground font-medium">{invoice.order_number}</span>
                  )}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-1">
                {new Date(invoice.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
              {invoice.due_date && (
                <p className="text-sm text-muted-foreground">
                  Due: {invoice.due_date}
                </p>
              )}
            </div>
            {getStatusBadge(invoice.status)}
          </div>
        </CardContent>
      </Card>

      <div className={`grid gap-4 ${referralPartnerInfo || referralName ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">Bill To</p>
            <p className="font-semibold text-foreground" data-testid="text-detail-customer">{invoice.customer_name}</p>
            {invoice.company_name && <p className="text-sm text-muted-foreground">{invoice.company_name}</p>}
            {invoice.customer_email && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Mail className="h-3 w-3" /> {invoice.customer_email}
              </p>
            )}
            {invoice.customer_phone && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> {invoice.customer_phone}
              </p>
            )}
          </CardContent>
        </Card>
        {(referralPartnerInfo || referralName) && (
          <Card>
            <CardContent className="p-4 sm:p-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">Referred By</p>
              <p className="font-semibold text-foreground">{referralPartnerInfo?.full_name || referralName}</p>
              {referralPartnerInfo?.phone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Phone className="h-3 w-3" /> {referralPartnerInfo.phone}
                </p>
              )}
              {referralPartnerInfo?.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {referralPartnerInfo.email}
                </p>
              )}
              {referralPartnerInfo?.referral_code && (
                <p className="text-sm text-muted-foreground mt-1">Code: {referralPartnerInfo.referral_code}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <p className="text-sm font-semibold text-foreground mb-3">Line Items</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-muted-foreground font-medium">Description</th>
                  <th className="text-center py-2 text-muted-foreground font-medium">State</th>
                  <th className="text-center py-2 text-muted-foreground font-medium">Qty</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Price</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <>
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 text-foreground">{item.description}</td>
                      <td className="py-2 text-center text-muted-foreground">{item.state || "-"}</td>
                      <td className="py-2 text-center text-foreground">{item.quantity}</td>
                      <td className="py-2 text-right text-foreground">${Number(item.unit_price).toFixed(2)}</td>
                      <td className="py-2 text-right font-medium text-foreground">${Number(item.total).toFixed(2)}</td>
                    </tr>
                    {item.includes && item.includes.length > 0 && (
                      <tr key={`inc-${item.id}`}>
                        <td colSpan={5} className="pb-2 pt-0">
                          <div className="flex flex-wrap gap-1">
                            {item.includes.map((inc, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[10px]">
                                {inc}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <Separator className="my-4" />

          <div className="flex justify-end">
            <div className="w-full sm:w-72 space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">${Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-emerald-600">
                    Discount{Number(invoice.discount_percentage) > 0 ? ` (${invoice.discount_percentage}%)` : ""}
                  </span>
                  <span className="text-emerald-600">-${Number(invoice.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between gap-4 font-bold text-base pt-1 border-t">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">${totalDue.toFixed(2)}</span>
              </div>
              {amountPaid > 0 && (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-emerald-600">Paid</span>
                    <span className="text-emerald-600">-${amountPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-4 font-semibold">
                    <span className="text-foreground">Remaining</span>
                    <span className="text-foreground">${remaining.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {invoice.pkr_enabled && Number(invoice.pkr_rate) > 0 && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4 sm:p-6">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-3">Payment in PKR</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  USD ${totalDue.toFixed(2)} x {Number(invoice.pkr_rate).toFixed(2)}
                </span>
                <span className="text-foreground font-medium">PKR {fmtPkr(Number(invoice.pkr_amount))}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Currency Tax ({Number(invoice.pkr_tax_rate)}%)
                </span>
                <span className="text-foreground font-medium">PKR {fmtPkr(Number(invoice.pkr_tax_amount))}</span>
              </div>
              <Separator />
              <div className="flex justify-between gap-4 font-bold text-base">
                <span className="text-emerald-700 dark:text-emerald-400">Total in PKR</span>
                <span className="text-emerald-700 dark:text-emerald-400">PKR {fmtPkr(Number(invoice.pkr_total))}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Exchange rate: 1 USD = {Number(invoice.pkr_rate).toFixed(2)} PKR
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 sm:p-6">
          <p className="text-sm font-semibold text-foreground mb-3">Payment Progress</p>
          <div className="flex items-center justify-between gap-4 text-sm mb-2">
            <span className="text-muted-foreground">
              ${amountPaid.toFixed(2)} of ${totalDue.toFixed(2)} paid
            </span>
            <span className="font-medium text-foreground">{paidPct.toFixed(0)}%</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${paidPct}%`,
                backgroundColor: paidPct >= 100 ? "#16a34a" : paidPct > 0 ? "#3b82f6" : "#e5e7eb",
              }}
            />
          </div>
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Remaining balance: ${remaining.toFixed(2)}
            </p>
          )}
        </CardContent>
      </Card>

      {displayMethods.length > 0 && invoice.status !== "paid" && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="text-sm font-semibold text-foreground mb-3">Payment Methods</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {displayMethods.map(method => (
                <div key={method.id} className="border rounded-md p-3 text-xs space-y-1">
                  <p className="font-medium text-foreground">{method.label || method.type}</p>
                  {method.bank_name && <p className="text-muted-foreground">Bank: {method.bank_name}</p>}
                  {method.account_holder && <p className="text-muted-foreground">Account Holder: {method.account_holder}</p>}
                  {method.account_number && <p className="text-muted-foreground">Account: {method.account_number}</p>}
                  {method.iban && <p className="text-muted-foreground">IBAN: {method.iban}</p>}
                  {method.currency && <p className="text-muted-foreground">Currency: {method.currency}</p>}
                  {method.link_url && (
                    <a
                      href={method.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      data-testid={`link-payment-detail-${method.id}`}
                    >
                      Payment Link
                    </a>
                  )}
                  {method.details && Object.entries(method.details).length > 0 && (
                    <div>
                      {Object.entries(method.details).map(([key, val]) => (
                        <p key={key} className="text-muted-foreground">{key}: {val}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {payments.length > 0 && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="text-sm font-semibold text-foreground mb-3">Payment History</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">USD</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">PKR</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 text-foreground">
                        {new Date(p.payment_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="py-2 text-right font-medium text-foreground">${Number(p.amount_usd).toFixed(2)}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {Number(p.amount_pkr) > 0 ? `PKR ${Number(p.amount_pkr).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}
                      </td>
                      <td className="py-2 text-muted-foreground">{p.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={proofDialogOpen} onOpenChange={setProofDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Proof of Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Upload Proof (Image or PDF)</Label>
              <Input
                ref={proofFileRef}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                data-testid="input-proof-file"
              />
              {proofFile && (
                <p className="text-xs text-muted-foreground mt-1">{proofFile.name}</p>
              )}
            </div>
            <div>
              <Label>Amount Paid (USD)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={proofAmount}
                onChange={(e) => setProofAmount(e.target.value)}
                data-testid="input-proof-amount"
              />
            </div>
            <Button
              onClick={handleProofSubmit}
              disabled={proofUploading || !proofFile || !proofAmount}
              className="w-full bg-emerald-600 text-white border-emerald-700 dark:bg-emerald-700 dark:border-emerald-800"
              data-testid="button-upload-proof"
            >
              {proofUploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <SiWhatsapp className="h-4 w-4 mr-2" />
              )}
              {proofUploading ? "Uploading..." : "Upload & Send via WhatsApp"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileTab({
  form,
  onChange,
  onSave,
  saving,
}: {
  form: { company_name: string; individual_name: string; email: string; phone: string; country: string; state_province: string; residential_address: string };
  onChange: (f: typeof form) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [countrySearch, setCountrySearch] = useState("");
  const [phoneCodeSearch, setPhoneCodeSearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState(() => {
    if (form.country) {
      const c = countries.find(c => c.name === form.country);
      if (c) return c.code;
    }
    return "";
  });

  const { dialCode: selectedDialCode, localNumber } = parsePhoneParts(form.phone);

  useEffect(() => {
    if (form.country) {
      const c = countries.find(c => c.name === form.country);
      if (c) setSelectedCountryCode(c.code);
    }
  }, [form.country]);

  const selectedCountryInfo = useMemo(() => {
    if (selectedCountryCode) {
      const byCode = countries.find(c => c.code === selectedCountryCode);
      if (byCode) return byCode;
    }
    if (!selectedDialCode) return null;
    return countries.find(c => c.dialCode === selectedDialCode) || null;
  }, [selectedDialCode, selectedCountryCode]);

  const filteredCountries = useMemo(() => {
    const s = countrySearch.toLowerCase();
    if (!s) return countries;
    return countries.filter(c => c.name.toLowerCase().includes(s));
  }, [countrySearch]);

  const filteredPhoneCodes = useMemo(() => {
    const s = phoneCodeSearch.toLowerCase();
    if (!s) return countries;
    return countries.filter(c =>
      c.name.toLowerCase().includes(s) || c.dialCode.includes(s)
    );
  }, [phoneCodeSearch]);

  const handleCountrySelect = (name: string) => {
    const country = countries.find(c => c.name === name);
    if (country) {
      setSelectedCountryCode(country.code);
      const newPhone = localNumber ? `${country.dialCode} ${localNumber}` : country.dialCode;
      onChange({ ...form, country: name, phone: newPhone });
    } else {
      onChange({ ...form, country: name });
    }
    setCountrySearch("");
    setShowCountryDropdown(false);
  };

  const handlePhoneCodeSelect = (country: { code: string; dialCode: string }) => {
    setSelectedCountryCode(country.code);
    const newPhone = localNumber ? `${country.dialCode} ${localNumber}` : country.dialCode;
    onChange({ ...form, phone: newPhone });
    setPhoneCodeSearch("");
    setShowPhoneDropdown(false);
  };

  const handleLocalNumberChange = (value: string) => {
    const digitsOnly = value.replace(/[^\d]/g, "");
    if (selectedCountryInfo) {
      const maxDigits = getExpectedDigitCount(selectedCountryInfo.format, selectedDialCode);
      const trimmed = maxDigits > 0 ? digitsOnly.slice(0, maxDigits) : digitsOnly;
      onChange({ ...form, phone: `${selectedDialCode} ${trimmed}` });
    } else {
      onChange({ ...form, phone: digitsOnly });
    }
  };

  const localPlaceholder = selectedCountryInfo
    ? getLocalPlaceholder(selectedCountryInfo.format, selectedDialCode)
    : "Phone number";

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-lg font-semibold text-foreground mb-4" data-testid="text-profile-title">My Profile</h2>
      <Card>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div>
            <Label>Company Name</Label>
            <Input
              value={form.company_name}
              onChange={(e) => onChange({ ...form, company_name: e.target.value })}
              data-testid="input-portal-company_name"
            />
          </div>

          <div>
            <Label>Individual Name</Label>
            <Input
              value={form.individual_name}
              onChange={(e) => onChange({ ...form, individual_name: e.target.value })}
              data-testid="input-portal-individual_name"
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => onChange({ ...form, email: e.target.value })}
              data-testid="input-portal-email"
            />
          </div>

          <div className="relative">
            <Label>Country</Label>
            <Input
              value={showCountryDropdown ? countrySearch : form.country}
              onChange={(e) => {
                setCountrySearch(e.target.value);
                if (!showCountryDropdown) setShowCountryDropdown(true);
              }}
              onFocus={() => {
                setShowCountryDropdown(true);
                setCountrySearch("");
              }}
              placeholder="Search country..."
              data-testid="input-portal-country"
            />
            {showCountryDropdown && (
              <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg">
                {filteredCountries.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No countries found</div>
                ) : (
                  filteredCountries.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover-elevate cursor-pointer"
                      onClick={() => handleCountrySelect(c.name)}
                    >
                      {c.name}
                    </button>
                  ))
                )}
              </div>
            )}
            {showCountryDropdown && (
              <div className="fixed inset-0 z-40" onClick={() => { setShowCountryDropdown(false); setCountrySearch(""); }} />
            )}
          </div>

          <div className="relative">
            <Label>Phone</Label>
            <div className="flex gap-2">
              <div className="relative w-[200px] shrink-0">
                <Input
                  value={showPhoneDropdown ? phoneCodeSearch : (selectedCountryInfo ? `${selectedDialCode} ${selectedCountryInfo.name}` : selectedDialCode || "")}
                  onChange={(e) => {
                    setPhoneCodeSearch(e.target.value);
                    if (!showPhoneDropdown) setShowPhoneDropdown(true);
                  }}
                  onFocus={() => {
                    setShowPhoneDropdown(true);
                    setPhoneCodeSearch("");
                  }}
                  placeholder="Country code"
                  className="text-sm"
                />
                {showPhoneDropdown && (
                  <div className="absolute z-50 w-[280px] mt-1 max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg">
                    {filteredPhoneCodes.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No codes found</div>
                    ) : (
                      filteredPhoneCodes.map(c => (
                        <button
                          key={c.code + c.dialCode}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover-elevate cursor-pointer"
                          onClick={() => handlePhoneCodeSelect({ code: c.code, dialCode: c.dialCode })}
                        >
                          <span className="font-medium">{c.dialCode}</span>
                          <span className="ml-2 text-muted-foreground">{c.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {showPhoneDropdown && (
                  <div className="fixed inset-0 z-40" onClick={() => { setShowPhoneDropdown(false); setPhoneCodeSearch(""); }} />
                )}
              </div>
              <div className="flex-1 flex items-center">
                {selectedDialCode ? (
                  <div className="flex h-9 w-full rounded-md border bg-background text-sm overflow-hidden">
                    <span className="flex items-center px-3 bg-muted border-r font-medium text-muted-foreground select-none shrink-0">
                      {selectedDialCode}
                    </span>
                    <input
                      className="flex-1 px-3 py-2 bg-transparent outline-none"
                      value={localNumber}
                      onChange={(e) => handleLocalNumberChange(e.target.value)}
                      placeholder={localPlaceholder.replace(/X/g, "0")}
                      data-testid="input-portal-phone"
                    />
                  </div>
                ) : (
                  <Input
                    value={form.phone}
                    onChange={(e) => onChange({ ...form, phone: e.target.value })}
                    placeholder="Phone number"
                    data-testid="input-portal-phone"
                  />
                )}
              </div>
            </div>
            {selectedCountryInfo && (
              <p className="text-xs text-muted-foreground mt-1">
                Format: {selectedCountryInfo.format}
              </p>
            )}
          </div>

          <div>
            <Label>State/Province</Label>
            <Input
              value={form.state_province}
              onChange={(e) => onChange({ ...form, state_province: e.target.value })}
              data-testid="input-portal-state_province"
            />
          </div>

          <div>
            <Label>Residential Address</Label>
            <Input
              value={form.residential_address}
              onChange={(e) => onChange({ ...form, residential_address: e.target.value })}
              data-testid="input-portal-residential_address"
            />
          </div>

          <Button
            onClick={onSave}
            disabled={saving}
            className="w-full"
            data-testid="button-save-profile"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

