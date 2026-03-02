import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthHeaders, authFetch } from "@/lib/auth";
import {
  ArrowLeft, Plus, FileText, StickyNote, Calendar, Download, Trash2,
  Upload, CloudOff, Cloud, Eye, Pencil, CheckCircle2, Clock,
  MessageSquare, Paperclip, ChevronDown, ChevronUp, X, Activity,
  FileUp, RefreshCw, ClipboardList, AlertCircle, ShieldCheck, Mail,
  Send, ExternalLink, Shield, History, Share2, Copy
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Order, OrderNote, OrderDocument, OrderActivityLog, CustomerDocument, Invoice, InvoiceItem, InvoicePayment, Customer, IncludeMeta, FormationDateEntry, ComplianceRecord, ComplianceDocument, ComplianceHistory, SmtpAccount, CustomerPortalLink } from "@shared/schema";
import CustomerFormFields from "@/components/customer-form-fields";

const WHATSAPP_NUMBER = "923203682461";

interface IncludeFile {
  file: File;
  docName: string;
}

interface ServiceGroup {
  key: string;
  name: string;
  includes: string[];
  allDelivered: boolean;
  deliveredCount: number;
  state: string;
  category: string;
}

const US_STATES = [
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
  "Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky",
  "Louisiana","Maine","Maryland","Massachusetts","Michigan","Minnesota","Mississippi",
  "Missouri","Montana","Nebraska","Nevada","New Hampshire","New Jersey","New Mexico",
  "New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon","Pennsylvania",
  "Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming"
];

function getFormationLabel(serviceName: string): string {
  const lower = serviceName.toLowerCase();
  if (lower.includes("llc")) return "LLC Formation Date";
  if (lower.includes("c-corp") || lower.includes("c corp") || lower.includes("ccorp")) return "C-Corp Formation Date";
  if (lower.includes("itin")) return "ITIN Formation Date";
  if (lower.includes("trademark")) return "Trademark Formation Date";
  if (lower.includes("taxation") || lower.includes("tax")) return "Tax Filing Date";
  if (lower.includes("banking") || lower.includes("bank")) return "Banking Setup Date";
  if (lower.includes("uk ltd") || lower.includes("ltd")) return "UK Ltd Formation Date";
  if (lower.includes("uk trademark")) return "UK Trademark Date";
  const shortName = serviceName.split(" - ")[0] || serviceName;
  return `${shortName} Formation Date`;
}

function needsStateSelection(serviceName: string): boolean {
  const lower = serviceName.toLowerCase();
  return lower.includes("llc") || lower.includes("c-corp") || lower.includes("c corp") || lower.includes("ccorp");
}

async function authDownload(url: string, filename: string) {
  try {
    const res = await authFetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {}
}

async function authPreview(url: string) {
  try {
    const res = await authFetch(url);
    if (!res.ok) return;
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch {}
}

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const id = Number(params?.id);
  const { toast } = useToast();

  const [noteHeader, setNoteHeader] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [docName, setDocName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    company_name: "", individual_name: "", email: "", phone: "",
    country: "", state_province: "", residential_address: "",
    referred_by: "", referral_partner_id: null as number | null, notes: ""
  });

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; item: string; newStatus: "pending" | "delivered"; isBulk?: boolean; bulkItems?: string[] }>({ open: false, item: "", newStatus: "delivered" });
  const [completeOrderDialog, setCompleteOrderDialog] = useState(false);
  const [formationDatePrompt, setFormationDatePrompt] = useState<{ open: boolean; serviceKey: string; serviceName: string; date: string; label: string }>({ open: false, serviceKey: "", serviceName: "", date: "", label: "" });
  const [includeDialog, setIncludeDialog] = useState<{ open: boolean; item: string }>({ open: false, item: "" });
  const [includeNote, setIncludeNote] = useState("");
  const [includeFiles, setIncludeFiles] = useState<IncludeFile[]>([]);
  const includeFileRef = useRef<HTMLInputElement>(null);
  const [uploadingInclude, setUploadingInclude] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});
  const [logDescription, setLogDescription] = useState("");
  const [logFile, setLogFile] = useState<File | null>(null);
  const logFileRef = useRef<HTMLInputElement>(null);
  const [markSubmittedDialogOpen, setMarkSubmittedDialogOpen] = useState(false);
  const [markSubmittedRecord, setMarkSubmittedRecord] = useState<ComplianceRecord | null>(null);
  const [markSubmittedType, setMarkSubmittedType] = useState<"annual_report" | "federal_tax">("federal_tax");
  const [markSubmittedFile, setMarkSubmittedFile] = useState<File | null>(null);

  const [contactEmailOpen, setContactEmailOpen] = useState(false);
  const [contactSmtp, setContactSmtp] = useState<number>(0);
  const [contactSubject, setContactSubject] = useState("");
  const [contactBody, setContactBody] = useState("");

  const [shareOpen, setShareOpen] = useState(false);
  const [portalLink, setPortalLink] = useState<CustomerPortalLink | null>(null);
  const [shareEmailSubject, setShareEmailSubject] = useState("");
  const [shareEmailBody, setShareEmailBody] = useState("");
  const [shareSmtp, setShareSmtp] = useState<number>(0);

  const { data: order, isLoading } = useQuery<Order>({ queryKey: [`/api/orders/${id}`], enabled: !!id });
  const { data: notes = [] } = useQuery<OrderNote[]>({ queryKey: [`/api/orders/${id}/notes`], enabled: !!id });
  const { data: documents = [] } = useQuery<OrderDocument[]>({ queryKey: [`/api/orders/${id}/documents`], enabled: !!id });
  const { data: dropboxStatus } = useQuery<{ connected: boolean; account: { name: string; email: string } | null }>({
    queryKey: ["/api/dropbox/status"],
  });
  const { data: invoice } = useQuery<Invoice>({
    queryKey: [`/api/invoices/${order?.invoice_id}`],
    enabled: !!order?.invoice_id,
  });
  const { data: invoiceItems = [] } = useQuery<InvoiceItem[]>({
    queryKey: [`/api/invoices/${order?.invoice_id}/items`],
    enabled: !!order?.invoice_id,
  });
  const { data: invoicePayments = [] } = useQuery<InvoicePayment[]>({
    queryKey: [`/api/invoices/${order?.invoice_id}/payments`],
    enabled: !!order?.invoice_id,
  });
  const { data: customer } = useQuery<Customer>({
    queryKey: [`/api/customers/${order?.customer_id}`],
    enabled: !!order?.customer_id,
  });
  const { data: activityLogs = [] } = useQuery<OrderActivityLog[]>({
    queryKey: [`/api/orders/${id}/activity-logs`],
    enabled: !!id,
  });
  const { data: customerDocs = [] } = useQuery<CustomerDocument[]>({
    queryKey: [`/api/customers/${order?.customer_id}/documents`],
    enabled: !!order?.customer_id,
  });
  const { data: complianceRecords = [] } = useQuery<ComplianceRecord[]>({
    queryKey: [`/api/orders/${id}/compliance`],
    enabled: !!id,
  });
  const { data: smtpAccounts = [] } = useQuery<SmtpAccount[]>({ queryKey: ["/api/smtp-accounts"] });

  const includesMeta: Record<string, IncludeMeta> = order?.includes_meta || {};

  const getIncludeStatus = (item: string): "pending" | "delivered" => {
    return includesMeta[item]?.status || "pending";
  };

  const getIncludeNote = (item: string): string => {
    return includesMeta[item]?.note || "";
  };

  const getIncludeDocs = (item: string): OrderDocument[] => {
    return documents.filter(d => d.linked_include === item);
  };

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Order>) => {
      await apiRequest("PATCH", `/api/orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}/activity-logs`] });
      toast({ title: "Order updated" });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      if (!order?.customer_id) throw new Error("No customer linked");
      const res = await apiRequest("PATCH", `/api/customers/${order.customer_id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${order?.customer_id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setEditCustomerOpen(false);
      toast({ title: "Customer updated successfully" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const contactEmailMutation = useMutation({
    mutationFn: async () => {
      if (!customer?.email) throw new Error("Customer has no email address");
      if (!contactSmtp) throw new Error("Please select an SMTP account");
      await apiRequest("POST", "/api/send-email", {
        smtp_account_id: contactSmtp,
        to_emails: [customer.email],
        subject: contactSubject,
        body: contactBody,
      });
    },
    onSuccess: () => {
      toast({ title: "Email sent successfully" });
      setContactEmailOpen(false);
      setContactSubject("");
      setContactBody("");
    },
    onError: (e) => toast({ title: "Failed to send email", description: e.message, variant: "destructive" }),
  });

  const openContactEmail = () => {
    const defaultAccount = smtpAccounts.find(a => a.is_default) || smtpAccounts[0];
    setContactSmtp(defaultAccount?.id || 0);
    setContactSubject(`Regarding Your Order ${order?.order_number || ""} - ${order?.company_name || ""}`);
    setContactBody(
      `Dear ${order?.customer_name || ""},\n\n` +
      `This is regarding your order ${order?.order_number || ""} for ${order?.company_name || ""}.\n\n` +
      `Services: ${order?.service_type?.replace(/\|/g, ", ") || ""}\n\n` +
      `\n\nBest regards,\nInfinity Filer`
    );
    setContactEmailOpen(true);
  };

  const openContactWhatsApp = () => {
    const phone = customer?.phone?.replace(/[^0-9]/g, "") || "";
    const whatsappPhone = phone.startsWith("0") ? "92" + phone.slice(1) : phone.startsWith("92") ? phone : phone;
    const msg = encodeURIComponent(
      `Hi ${order?.customer_name || ""},\n\n` +
      `This is from Infinity Filer regarding your order ${order?.order_number || ""} for ${order?.company_name || ""}.\n\n` +
      `Services: ${order?.service_type?.replace(/\|/g, ", ") || ""}`
    );
    window.open(`https://wa.me/${whatsappPhone}?text=${msg}`, "_blank");
  };

  const portalLinkMutation = useMutation({
    mutationFn: async () => {
      if (!order?.customer_id) throw new Error("No customer");
      const res = await apiRequest("POST", "/api/portal-links", {
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        company_name: order.company_name,
      });
      return res.json();
    },
    onSuccess: (data: CustomerPortalLink) => {
      setPortalLink(data);
      const portalUrl = `${window.location.origin}/portal/${data.token}`;
      const defaultSmtp = smtpAccounts.find(a => a.is_default) || smtpAccounts[0];
      setShareSmtp(defaultSmtp?.id || 0);
      setShareEmailSubject(`Your Order ${order?.order_number || ""} - ${order?.company_name || ""}`);
      setShareEmailBody(
        `Dear ${order?.customer_name || ""},\n\n` +
        `Here is your customer portal link where you can view your orders, invoices, and manage your profile:\n${portalUrl}\n\n` +
        `Best regards,\nInfinity Filer`
      );
      setShareOpen(true);
    },
    onError: (e) => toast({ title: "Error generating portal link", description: e.message, variant: "destructive" }),
  });

  const shareEmailMutation = useMutation({
    mutationFn: async () => {
      if (!customer?.email) throw new Error("Customer has no email");
      if (!shareSmtp) throw new Error("Select an SMTP account");
      await apiRequest("POST", "/api/send-email", {
        smtp_account_id: shareSmtp,
        to_emails: [customer.email],
        subject: shareEmailSubject,
        body: shareEmailBody,
      });
    },
    onSuccess: () => {
      toast({ title: "Email sent successfully" });
      setShareOpen(false);
    },
    onError: (e) => toast({ title: "Failed to send email", description: e.message, variant: "destructive" }),
  });

  const getPortalUrl = () => portalLink ? `${window.location.origin}/portal/${portalLink.token}` : "";

  const handleShareWhatsApp = () => {
    const phone = customer?.phone?.replace(/[^0-9]/g, "") || "";
    const whatsappPhone = phone.startsWith("0") ? "92" + phone.slice(1) : phone.startsWith("92") ? phone : phone;
    const portalUrl = getPortalUrl();
    const msg = encodeURIComponent(
      `Hi ${order?.customer_name || ""},\n\n` +
      `Here is your customer portal link:\n${portalUrl}\n\n` +
      `You can view your orders, invoices & manage your profile.\n\n` +
      `Thank you!\nInfinity Filer`
    );
    window.open(`https://wa.me/${whatsappPhone}?text=${msg}`, "_blank");
  };

  const noteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/orders/${id}/notes`, { header: noteHeader, description: noteDesc });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}/notes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}/activity-logs`] });
      setNoteHeader("");
      setNoteDesc("");
      toast({ title: "Note added" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("document_name", docName || selectedFile.name);
      const res = await authFetch(`/api/orders/${id}/documents`, { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}/documents`] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}/activity-logs`] });
      setSelectedFile(null);
      setDocName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Document uploaded successfully" });
    },
    onError: (e) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/orders/${id}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}/documents`] });
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}/activity-logs`] });
      toast({ title: "Document deleted" });
    },
    onError: (e) => toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" }),
  });

  const logMutation = useMutation({
    mutationFn: async () => {
      if (!logDescription.trim()) throw new Error("Enter a description");
      const formData = new FormData();
      formData.append("action", "manual_log");
      formData.append("description", logDescription.trim());
      if (logFile) formData.append("file", logFile);
      const res = await authFetch(`/api/orders/${id}/activity-logs`, { method: "POST", body: formData });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}/activity-logs`] });
      setLogDescription("");
      setLogFile(null);
      if (logFileRef.current) logFileRef.current.value = "";
      toast({ title: "Activity logged" });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const complianceMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/orders/${id}/compliance`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}/compliance`] });
    },
  });

  const updateComplianceMutation = useMutation({
    mutationFn: async ({ recordId, data }: { recordId: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/compliance-records/${recordId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}/compliance`] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      toast({ title: "Marked as submitted — due date shifted to next year" });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!order || !id) return;
    const formationDates = order.formation_dates || {};
    const hasFormationDates = Object.values(formationDates).some((e: any) => e.date);
    if (hasFormationDates && complianceRecords.length === 0) {
      complianceMutation.mutate({ auto: true });
    }
  }, [order?.formation_dates, complianceRecords.length]);

  const isFormationService = (name: string): boolean => {
    const lower = name.toLowerCase();
    return lower.includes("llc") || lower.includes("c-corp") || lower.includes("c corp") || lower.includes("ccorp");
  };

  const getLlcTypeForService = (serviceName: string): string => {
    const item = invoiceItems.find(i => i.description === serviceName);
    return item?.llc_type || "";
  };

  const formatPKT = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-PK", { timeZone: "Asia/Karachi", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) + " PKT";
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

  const openEditCustomer = () => {
    if (customer) {
      setEditForm({
        company_name: customer.company_name || "",
        individual_name: customer.individual_name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        country: customer.country || "",
        state_province: customer.state_province || "",
        residential_address: customer.residential_address || "",
        referred_by: customer.referred_by || "",
        referral_partner_id: customer.referral_partner_id || null,
        notes: customer.notes || "",
      });
      setEditCustomerOpen(true);
    }
  };

  const handleToggleStatus = (item: string) => {
    const currentStatus = getIncludeStatus(item);
    const newStatus = currentStatus === "pending" ? "delivered" : "pending";
    setConfirmDialog({ open: true, item, newStatus });
  };

  const confirmStatusChange = () => {
    const { item, newStatus, isBulk, bulkItems } = confirmDialog;
    const updated = { ...includesMeta };

    if (isBulk && bulkItems) {
      bulkItems.forEach(inc => {
        updated[inc] = { status: newStatus, note: updated[inc]?.note || "" };
      });
    } else {
      updated[item] = { status: newStatus, note: updated[item]?.note || "" };
    }

    updateMutation.mutate({ includes_meta: updated } as any, {
      onSuccess: () => {
        if (newStatus === "delivered") {
          if (isBulk && bulkItems) {
            for (const inc of bulkItems) {
              const trigger = findTriggerService(inc);
              if (trigger && !formationDates[trigger.key]?.date) {
                checkFormationDateTrigger(inc);
                break;
              }
            }
          } else {
            checkFormationDateTrigger(item);
          }
        }

        const allIncludes = order?.includes || [];
        const allDeliveredNow = allIncludes.every(inc => (updated[inc]?.status || "pending") === "delivered");
        if (allDeliveredNow && allIncludes.length > 0 && order?.status !== "completed") {
          setCompleteOrderDialog(true);
        }
      },
    });
    setConfirmDialog({ open: false, item: "", newStatus: "delivered" });
  };

  const handleMarkAllDelivered = (sg: ServiceGroup) => {
    const pendingItems = sg.includes.filter(inc => getIncludeStatus(inc) !== "delivered");
    if (pendingItems.length === 0) return;
    setConfirmDialog({
      open: true,
      item: sg.name,
      newStatus: "delivered",
      isBulk: true,
      bulkItems: pendingItems,
    });
  };

  const openIncludeDialog = (item: string) => {
    setIncludeNote(getIncludeNote(item));
    setIncludeFiles([]);
    setIncludeDialog({ open: true, item });
  };

  const saveIncludeNote = () => {
    const { item } = includeDialog;
    const updated = { ...includesMeta };
    updated[item] = {
      status: updated[item]?.status || "pending",
      note: includeNote,
    };
    updateMutation.mutate({ includes_meta: updated } as any);
    setIncludeDialog({ open: false, item: "" });
    setIncludeNote("");
    setIncludeFiles([]);
  };

  const handleIncludeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: IncludeFile[] = Array.from(files).map(f => ({
      file: f,
      docName: f.name.replace(/\.[^/.]+$/, ""),
    }));
    setIncludeFiles(prev => [...prev, ...newFiles]);
    if (includeFileRef.current) includeFileRef.current.value = "";
  };

  const removeIncludeFile = (index: number) => {
    setIncludeFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateIncludeFileName = (index: number, name: string) => {
    setIncludeFiles(prev => prev.map((f, i) => i === index ? { ...f, docName: name } : f));
  };

  const uploadIncludeFiles = async () => {
    if (includeFiles.length === 0) return;
    setUploadingInclude(true);
    try {
      const formData = new FormData();
      includeFiles.forEach(f => formData.append("files", f.file));
      formData.append("document_names", JSON.stringify(includeFiles.map(f => f.docName)));
      formData.append("linked_include", includeDialog.item);

      const res = await authFetch(`/api/orders/${id}/documents/multi`, { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${id}/documents`] });
      setIncludeFiles([]);
      toast({ title: `${includeFiles.length} file(s) uploaded successfully` });
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploadingInclude(false);
    }
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-64" /></div>;
  if (!order) return <div className="p-6">Order not found</div>;

  const allServices = invoiceItems.length > 0
    ? invoiceItems.map(item => item.description).filter(Boolean)
    : order.service_type ? order.service_type.split(" | ") : [];

  const includesArr = order.includes || [];
  const deliveredCount = includesArr.filter(inc => getIncludeStatus(inc) === "delivered").length;
  const linkedDocs = includeDialog.open ? getIncludeDocs(includeDialog.item) : [];

  const serviceGroups: ServiceGroup[] = invoiceItems.length > 0
    ? invoiceItems
        .filter(item => item.includes && item.includes.length > 0)
        .map((item, idx) => {
          const incs = item.includes || [];
          const delivered = incs.filter(inc => getIncludeStatus(inc) === "delivered").length;
          return {
            key: `svc-${item.id || idx}`,
            name: item.description,
            includes: incs,
            allDelivered: incs.length > 0 && delivered === incs.length,
            deliveredCount: delivered,
            state: item.state || "",
            category: item.description.split(" - ")[0] || item.description,
          };
        })
    : includesArr.length > 0
      ? [{
          key: "svc-fallback",
          name: order.service_type || "Services",
          includes: includesArr,
          allDelivered: includesArr.length > 0 && deliveredCount === includesArr.length,
          deliveredCount,
          state: order.state || "",
          category: order.service_type || "Services",
        }]
      : [];

  const formationDates: Record<string, FormationDateEntry> = order.formation_dates || {};

  const formationServiceItems = invoiceItems.length > 0
    ? invoiceItems.map((item, idx) => ({
        key: `svc-${item.id || idx}`,
        name: item.description,
        state: item.state || "",
      }))
    : order.service_type
      ? [{ key: "svc-fallback", name: order.service_type, state: order.state || "" }]
      : [];

  const findTriggerService = (itemName: string): { key: string; name: string; state: string } | null => {
    const lower = itemName.toLowerCase();
    for (const sg of serviceGroups) {
      if (!sg.includes.includes(itemName)) continue;
      const sgLower = sg.name.toLowerCase();
      if (sgLower.includes("llc")) {
        if (lower.includes("article") || lower.includes("company formation") || lower.includes("formation")) return { key: sg.key, name: sg.name, state: sg.state };
      } else if (sgLower.includes("c-corp") || sgLower.includes("c corp") || sgLower.includes("ccorp")) {
        if (lower.includes("article") || lower.includes("incorporation") || lower.includes("company formation") || lower.includes("formation")) return { key: sg.key, name: sg.name, state: sg.state };
      } else if (sgLower.includes("itin")) {
        if (lower.includes("itin") || lower.includes("confirmation") || lower.includes("number")) return { key: sg.key, name: sg.name, state: sg.state };
      } else if (sgLower.includes("trademark")) {
        if (lower.includes("trademark") || lower.includes("registration") || lower.includes("certificate") || lower.includes("confirmation")) return { key: sg.key, name: sg.name, state: sg.state };
      } else if (sgLower.includes("tax")) {
        if (lower.includes("filing") || lower.includes("confirmation") || lower.includes("return") || lower.includes("tax")) return { key: sg.key, name: sg.name, state: sg.state };
      } else {
        if (lower.includes("formation") || lower.includes("confirmation") || lower.includes("certificate") || lower.includes("registration") || lower.includes("approval")) return { key: sg.key, name: sg.name, state: sg.state };
      }
    }
    return null;
  };

  const getServiceState = (sgKey: string): string => {
    const svc = formationServiceItems.find(s => s.key === sgKey);
    return svc?.state || "";
  };

  const checkFormationDateTrigger = (itemName: string) => {
    const trigger = findTriggerService(itemName);
    if (!trigger) return;
    const existing = formationDates[trigger.key];
    if (existing?.date) return;
    const today = new Date().toISOString().split("T")[0];
    const label = getFormationLabel(trigger.name);
    setFormationDatePrompt({ open: true, serviceKey: trigger.key, serviceName: trigger.name, date: today, label });
  };

  const confirmFormationDate = () => {
    const { serviceKey, serviceName, date } = formationDatePrompt;
    if (date) {
      const label = getFormationLabel(serviceName);
      const itemState = getServiceState(serviceKey);
      const current = formationDates[serviceKey] || { date: "", state: itemState, service_name: serviceName, label };
      const updatedEntry = { ...current, date, state: current.state || itemState, service_name: serviceName, label };
      updateMutation.mutate({ formation_dates: { [serviceKey]: updatedEntry } });
      if (isFormationService(serviceName)) {
        const llcType = getLlcTypeForService(serviceName);
        const category = serviceName.split(" - ")[0] || serviceName;
        complianceMutation.mutate({
          service_name: serviceName,
          service_category: category,
          state: updatedEntry.state || itemState,
          llc_type: llcType,
          formation_date: date,
        });
      }
    }
    setFormationDatePrompt({ open: false, serviceKey: "", serviceName: "", date: "", label: "" });
  };

  const updateFormationDate = (sgKey: string, sgName: string, field: "date" | "state", value: string) => {
    const label = getFormationLabel(sgName);
    const itemState = getServiceState(sgKey);
    const current = formationDates[sgKey] || { date: "", state: itemState, service_name: sgName, label };
    const updatedEntry = { ...current, [field]: value, service_name: sgName, label };
    if (!updatedEntry.state && itemState) {
      updatedEntry.state = itemState;
    }
    updateMutation.mutate({ formation_dates: { [sgKey]: updatedEntry } });
    if (field === "date" && value && isFormationService(sgName)) {
      const llcType = getLlcTypeForService(sgName);
      const category = sgName.split(" - ")[0] || sgName;
      complianceMutation.mutate({
        service_name: sgName,
        service_category: category,
        state: updatedEntry.state || itemState,
        llc_type: llcType,
        formation_date: value,
      });
    }
  };

  const totalGroupIncludes = serviceGroups.reduce((sum, sg) => sum + sg.includes.length, 0);
  const totalGroupDelivered = serviceGroups.reduce((sum, sg) => sum + sg.deliveredCount, 0);

  const toggleServiceExpanded = (key: string) => {
    setExpandedServices(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/orders"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-bold" data-testid="text-order-detail-number">{order.order_number}</h1>
          <Badge variant="secondary" className={
            order.status === "completed" ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" :
            order.status === "in-progress" ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" :
            order.status === "pending" ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" :
            order.status === "cancelled" ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" :
            order.status === "archived" ? "bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" : ""
          }>{order.status}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => portalLinkMutation.mutate()} disabled={portalLinkMutation.isPending} data-testid="button-share-portal-link">
            <Share2 className="h-4 w-4 mr-2" />{portalLinkMutation.isPending ? "Loading..." : "Share Portal Link"}
          </Button>
          <Select value={order.status} onValueChange={(val) => updateMutation.mutate({ status: val })}>
            <SelectTrigger className="w-[160px]" data-testid="select-order-status-update"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-lg">Order Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Company</p>
                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={openEditCustomer} disabled={!customer}>
                  <Pencil className="h-3 w-3 mr-1" />Edit Customer
                </Button>
              </div>
              <p className="text-sm font-medium">{order.company_name}</p>
            </div>
            <div><p className="text-xs text-muted-foreground">Customer</p><p className="text-sm">{order.customer_name}</p></div>
            <div className="overflow-hidden">
              <p className="text-xs text-muted-foreground">Services ({allServices.length})</p>
              {serviceGroups.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1 max-w-full">
                  {serviceGroups.map((sg, i) => {
                    const sgItem = invoiceItems.find(it => it.description === sg.name);
                    const sgLlcType = sgItem?.llc_type;
                    return (
                      <div key={i} className="flex items-center gap-1 max-w-full">
                        <Badge
                          variant="outline"
                          className={`text-xs font-normal max-w-full truncate ${
                            sg.allDelivered
                              ? "border-green-300 text-green-700 bg-green-50 dark:border-green-700 dark:text-green-400 dark:bg-green-950/20"
                              : "border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-400 dark:bg-red-950/20"
                          }`}
                        >
                          {sg.allDelivered ? <CheckCircle2 className="h-3 w-3 mr-1 shrink-0" /> : <Clock className="h-3 w-3 mr-1 shrink-0" />}
                          {sg.name}
                        </Badge>
                        {sgLlcType && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 border-purple-300 text-purple-700 bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:bg-purple-950/20">
                            {sgLlcType === "single-member" ? "SM" : "MM"}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : allServices.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1 max-w-full">
                  {allServices.map((svc, i) => (
                    <Badge key={i} variant="outline" className="text-xs font-normal max-w-full truncate">{svc}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm">No services</p>
              )}
            </div>
            {order.state && <div><p className="text-xs text-muted-foreground">State</p><p className="text-sm">{order.state}</p></div>}
            {order.referral_name && (
              <div>
                <p className="text-xs text-muted-foreground">Referred By</p>
                <Badge variant="secondary" data-testid="badge-order-referral">{order.referral_name}</Badge>
              </div>
            )}
            <div><p className="text-xs text-muted-foreground">Invoice</p>
              <Link href={`/invoices/${order.invoice_id}`}>
                <span className="text-sm text-primary cursor-pointer">{order.invoice_number}</span>
              </Link>
            </div>
            <div><p className="text-xs text-muted-foreground">Created</p><p className="text-sm">{new Date(order.created_at).toLocaleDateString()}</p></div>

            {customer && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Customer</p>
                {customer.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" />{customer.email}
                  </p>
                )}
                {customer.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />{customer.phone}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8"
                    onClick={openContactEmail}
                    disabled={!customer.email || smtpAccounts.length === 0}
                  >
                    <Mail className="h-3 w-3 mr-1" />Email
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs h-8 text-green-700 border-green-300 hover:bg-green-50"
                    onClick={openContactWhatsApp}
                    disabled={!customer.phone}
                  >
                    <MessageSquare className="h-3 w-3 mr-1" />WhatsApp
                  </Button>
                </div>
              </div>
            )}

            {formationServiceItems.length > 0 ? (
              <div className="border-t pt-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Formation Dates</p>
                {formationServiceItems.map(svc => {
                  const entry = formationDates[svc.key] || { date: "", state: svc.state || "", service_name: svc.name, label: getFormationLabel(svc.name) };
                  const showState = needsStateSelection(svc.name);
                  return (
                    <div key={`fd-${svc.key}`} className="space-y-1.5 p-2.5 rounded-md bg-accent/30 border">
                      <Label className="text-xs font-medium">{getFormationLabel(svc.name)}</Label>
                      <Input
                        type="date"
                        value={entry.date || ""}
                        onChange={(e) => updateFormationDate(svc.key, svc.name, "date", e.target.value)}
                        className="h-8 text-sm"
                      />
                      {showState && (
                        <div>
                          <Label className="text-[10px] text-muted-foreground">State of Formation <span className="text-red-500">*</span></Label>
                          <Select
                            value={entry.state || svc.state || ""}
                            onValueChange={(val) => updateFormationDate(svc.key, svc.name, "state", val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {US_STATES.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <Label className="text-xs">Formation Date</Label>
                <Input type="date" value={order.formation_date || ""} onChange={(e) => updateMutation.mutate({ formation_date: e.target.value })} data-testid="input-formation-date" />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {customerDocs.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />Customer Verification Documents ({customerDocs.length})
                  </CardTitle>
                  <Link href={`/customers/${order.customer_id}`}>
                    <Button variant="outline" size="sm" className="text-xs h-7">
                      <Pencil className="h-3 w-3 mr-1" />Manage
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {customerDocs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-accent/20">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.document_name || doc.file_name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-muted-foreground">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                            {doc.dropbox_path && (
                              <Badge variant="outline" className="text-[10px] h-4 gap-0.5"><Cloud className="h-2.5 w-2.5" />Dropbox</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {doc.dropbox_path && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview" onClick={() => authPreview(`/api/customers/${order.customer_id}/documents/${doc.id}/preview`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Download" onClick={() => authDownload(`/api/customers/${order.customer_id}/documents/${doc.id}/download`, doc.file_name)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {serviceGroups.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    What's Included
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{totalGroupDelivered}/{totalGroupIncludes}</span>
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${totalGroupIncludes > 0 ? (totalGroupDelivered / totalGroupIncludes) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {serviceGroups.map((sg) => {
                  const isExpanded = expandedServices[sg.key] !== false;
                  return (
                    <div key={sg.key} className={`rounded-lg border overflow-hidden ${sg.allDelivered ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"}`}>
                      <div className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                          sg.allDelivered
                            ? "bg-green-50 dark:bg-green-950/30"
                            : "bg-red-50 dark:bg-red-950/30"
                        }`}>
                        <button
                          onClick={() => toggleServiceExpanded(sg.key)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        >
                          {sg.allDelivered ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                          ) : (
                            <Clock className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                          )}
                          <span className={`text-sm font-medium flex-1 min-w-0 truncate ${
                            sg.allDelivered ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"
                          }`}>
                            {sg.name}
                          </span>
                          {(() => {
                            const item = invoiceItems.find(i => i.description === sg.name);
                            const llcType = item?.llc_type;
                            if (!llcType) return null;
                            return (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-purple-300 text-purple-700 bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:bg-purple-950/20">
                                {llcType === "single-member" ? "Single-Member LLC" : "Multi-Member LLC"}
                              </Badge>
                            );
                          })()}
                          <span className={`text-xs shrink-0 ${sg.allDelivered ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {sg.deliveredCount}/{sg.includes.length}
                          </span>
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        </button>
                        {!sg.allDelivered && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px] shrink-0 border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-400"
                            onClick={(e) => { e.stopPropagation(); handleMarkAllDelivered(sg); }}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-0.5" />Mark All Delivered
                          </Button>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="divide-y border-t">
                          {sg.includes.map((inc, i) => {
                            const status = getIncludeStatus(inc);
                            const note = getIncludeNote(inc);
                            const itemDocs = getIncludeDocs(inc);
                            const isDelivered = status === "delivered";
                            return (
                              <div key={i} className="flex items-center gap-2 py-2 px-3 group">
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDelivered ? "bg-green-500" : "bg-red-500"}`} />
                                <span className={`text-sm flex-1 min-w-0 truncate ${isDelivered ? "text-muted-foreground line-through" : ""}`}>
                                  {inc}
                                </span>
                                {note && (
                                  <span className="text-xs text-muted-foreground italic max-w-[120px] truncate hidden sm:inline" title={note}>
                                    {note}
                                  </span>
                                )}
                                {itemDocs.length > 0 && (
                                  <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5 shrink-0">
                                    <Paperclip className="h-2.5 w-2.5" />{itemDocs.length}
                                  </Badge>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => openIncludeDialog(inc)}
                                >
                                  <Pencil className="h-3 w-3 mr-1" />Details
                                </Button>
                                <Button
                                  variant={isDelivered ? "outline" : "default"}
                                  size="sm"
                                  className={`h-6 px-2 text-[11px] shrink-0 ${
                                    isDelivered
                                      ? "border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
                                      : "bg-red-600 hover:bg-red-700 text-white"
                                  }`}
                                  onClick={() => handleToggleStatus(inc)}
                                >
                                  {isDelivered ? (
                                    <><CheckCircle2 className="h-3 w-3 mr-0.5" />Delivered</>
                                  ) : (
                                    <><Clock className="h-3 w-3 mr-0.5" />Pending</>
                                  )}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {complianceRecords.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {complianceRecords.map((cr) => (
                  <OrderComplianceDetail
                    key={cr.id}
                    record={cr}
                    onMarkSubmitted={(type) => {
                      setMarkSubmittedRecord(cr);
                      setMarkSubmittedType(type);
                      setMarkSubmittedDialogOpen(true);
                    }}
                    isPending={updateComplianceMutation.isPending}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          <Dialog open={markSubmittedDialogOpen} onOpenChange={setMarkSubmittedDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  Mark {markSubmittedType === "annual_report" ? "Annual Report" : "Federal Tax"} as Submitted
                </DialogTitle>
              </DialogHeader>
              {markSubmittedRecord && (
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    <p><span className="font-medium">Company:</span> {markSubmittedRecord.company_name}</p>
                    <p><span className="font-medium">Due Date:</span> {markSubmittedType === "annual_report" ? markSubmittedRecord.annual_report_due : markSubmittedRecord.federal_tax_due}</p>
                    <p className="text-xs text-muted-foreground mt-2">This will mark the {markSubmittedType === "annual_report" ? "annual report" : "federal tax"} as submitted and shift the due date to next year.</p>
                  </div>

                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Upload Compliance Document</Label>
                      <span className="text-xs text-muted-foreground">(Optional)</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Upload proof of submission if available</p>
                    <Input
                      type="file"
                      className="text-xs"
                      onChange={(e) => setMarkSubmittedFile(e.target.files?.[0] || null)}
                    />
                  </div>

                  <DialogFooter className="flex gap-2">
                    <Button variant="outline" onClick={() => setMarkSubmittedDialogOpen(false)}>Cancel</Button>
                    <Button
                      onClick={async () => {
                        if (!markSubmittedRecord) return;
                        if (markSubmittedFile) {
                          const formData = new FormData();
                          formData.append("file", markSubmittedFile);
                          formData.append("document_name", `${markSubmittedType === "annual_report" ? "Annual Report" : "Federal Tax"} - ${markSubmittedRecord.company_name}`);
                          formData.append("document_type", markSubmittedType === "annual_report" ? "Annual Report" : "Federal Tax");
                          try {
                            await authFetch(`/api/compliance-records/${markSubmittedRecord.id}/documents`, { method: "POST", body: formData });
                          } catch {}
                        }
                        const data = markSubmittedType === "annual_report"
                          ? { annual_report_status: "submitted" }
                          : { federal_tax_status: "submitted" };
                        updateComplianceMutation.mutate({ recordId: markSubmittedRecord.id, data });
                        setMarkSubmittedDialogOpen(false);
                        setMarkSubmittedFile(null);
                      }}
                      disabled={updateComplianceMutation.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      {updateComplianceMutation.isPending ? "Submitting..." : "Mark Submitted"}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {invoice && (() => {
            const amountPaid = Number(invoice.amount_paid || 0);
            const totalDue = Number(invoice.total);
            const remaining = Math.max(0, totalDue - amountPaid);
            const paidPct = totalDue > 0 ? Math.min((amountPaid / totalDue) * 100, 100) : 0;

            const paymentsByService: Record<string, number> = {};
            invoicePayments.forEach(p => {
              const key = (p.service_description || "").toLowerCase().trim();
              if (key) paymentsByService[key] = (paymentsByService[key] || 0) + Number(p.amount_usd);
            });

            const isServicePaid = (desc: string, total: number) => {
              const key = desc.toLowerCase().trim();
              const paid = paymentsByService[key] || 0;
              if (paid >= total) return "paid";
              if (paid > 0) return "partial";
              return "unpaid";
            };

            const getServicePaidAmount = (desc: string) => {
              const key = desc.toLowerCase().trim();
              return paymentsByService[key] || 0;
            };

            return (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-4 w-4" />Invoice Details</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={invoice.status === "paid" ? "default" : invoice.status === "partial-paid" ? "default" : invoice.status === "overdue" ? "destructive" : "secondary"}
                      className={invoice.status === "partial-paid" ? "bg-blue-100 text-blue-800 border-blue-200" : ""}
                    >
                      {invoice.status}
                    </Badge>
                    <Link href={`/invoices/${order.invoice_id}`}>
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1"><Eye className="h-3 w-3" />View Invoice</Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {amountPaid > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Payment Progress</span>
                      <span className="font-medium">{paidPct.toFixed(0)}% paid</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${paidPct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-600 font-medium">Paid: ${amountPaid.toFixed(2)}</span>
                      {remaining > 0 && <span className="text-red-600 font-medium">Remaining: ${remaining.toFixed(2)}</span>}
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Description</th>
                        <th className="text-left p-2">State</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-right p-2">Price</th>
                        <th className="text-right p-2">Total</th>
                        <th className="text-center p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map(item => {
                        const itemTotal = Number(item.total);
                        const status = invoice.status === "paid" ? "paid" : isServicePaid(item.description, itemTotal);
                        const paidAmt = invoice.status === "paid" ? itemTotal : getServicePaidAmount(item.description);
                        return (
                          <tr key={item.id} className={`border-b ${status === "paid" ? "bg-emerald-50" : status === "partial" ? "bg-blue-50" : ""}`}>
                            <td className="p-2">
                              <span className={status === "paid" ? "text-emerald-800" : ""}>{item.description}</span>
                              {item.llc_type && (
                                <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0 border-purple-300 text-purple-700 bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:bg-purple-950/20">
                                  {item.llc_type === "single-member" ? "Single-Member" : "Multi-Member"}
                                </Badge>
                              )}
                            </td>
                            <td className="p-2 text-muted-foreground">{item.state || "-"}</td>
                            <td className="p-2 text-right">{item.quantity}</td>
                            <td className="p-2 text-right">${Number(item.unit_price).toFixed(2)}</td>
                            <td className="p-2 text-right font-medium">${itemTotal.toFixed(2)}</td>
                            <td className="p-2 text-center">
                              {status === "paid" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="h-3 w-3" />Paid
                                </span>
                              ) : status === "partial" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                  ${paidAmt.toFixed(2)}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
                                  <Clock className="h-3 w-3" />Unpaid
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <div className="space-y-1 text-right min-w-[180px]">
                    <p className="text-sm text-muted-foreground">Subtotal: ${Number(invoice.subtotal).toFixed(2)}</p>
                    {Number(invoice.discount_amount) > 0 && (
                      <p className="text-sm text-green-600">Discount: -${Number(invoice.discount_amount).toFixed(2)}</p>
                    )}
                    <div className="border-t pt-1 mt-1">
                      <p className="text-lg font-bold">Total: ${totalDue.toFixed(2)}</p>
                    </div>
                    {amountPaid > 0 && (
                      <>
                        <p className="text-sm text-emerald-600">Paid: ${amountPaid.toFixed(2)}</p>
                        {remaining > 0 && <p className="text-sm font-semibold text-red-600">Due: ${remaining.toFixed(2)}</p>}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })()}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><StickyNote className="h-4 w-4" />Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input placeholder="Note Header" value={noteHeader} onChange={(e) => setNoteHeader(e.target.value)} data-testid="input-note-header" />
                <textarea className="w-full rounded-md border p-2 text-sm bg-background" rows={3} placeholder="Note description..." value={noteDesc} onChange={(e) => setNoteDesc(e.target.value)} data-testid="input-note-desc" />
                <Button size="sm" onClick={() => noteMutation.mutate()} disabled={!noteHeader || noteMutation.isPending} data-testid="button-add-note">
                  <Plus className="h-4 w-4 mr-1" />Add Note
                </Button>
              </div>
              {notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map(note => (
                    <div key={note.id} className="p-3 rounded-md bg-accent/50">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">{note.header}</h4>
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(note.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{note.description}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No notes yet</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />Documents
                </CardTitle>
                {dropboxStatus?.connected ? (
                  <Badge variant="default" className="gap-1"><Cloud className="h-3 w-3" />Dropbox Connected</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><CloudOff className="h-3 w-3" />Dropbox Not Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!dropboxStatus?.connected && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-300">
                  Dropbox is not connected. Please connect Dropbox in <a href="/settings" className="underline font-medium">Settings</a> to upload documents.
                </div>
              )}
              <div className={`space-y-3 p-4 rounded-lg border border-dashed ${!dropboxStatus?.connected ? "opacity-50 pointer-events-none" : ""}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">Document Name</Label>
                    <Input placeholder="e.g. Articles of Organization" value={docName} onChange={(e) => setDocName(e.target.value)} data-testid="input-doc-name" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Select File</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={(e) => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]); }}
                      className="text-sm w-full file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:bg-background file:text-sm file:font-medium hover:file:bg-accent"
                      data-testid="input-upload-doc"
                    />
                  </div>
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground flex-1">
                      Ready: <span className="font-medium text-foreground">{docName || selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                    <Button size="sm" onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending} data-testid="button-upload-doc">
                      <Upload className="h-4 w-4 mr-1" />{uploadMutation.isPending ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                )}
              </div>

              {documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-accent/20" data-testid={`doc-row-${doc.id}`}>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.document_name || doc.file_name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {doc.document_name && doc.document_name !== doc.file_name && (
                              <span className="text-xs text-muted-foreground truncate">Original: {doc.file_name}</span>
                            )}
                            <span className="text-xs text-muted-foreground">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                            {doc.dropbox_path ? (
                              <Badge variant="outline" className="text-[10px] h-4 gap-0.5"><Cloud className="h-2.5 w-2.5" />Dropbox</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-4 gap-0.5 text-muted-foreground"><CloudOff className="h-2.5 w-2.5" />Local Only</Badge>
                            )}
                            {doc.linked_include && (
                              <Badge variant="secondary" className="text-[10px] h-4 gap-0.5">
                                <Paperclip className="h-2.5 w-2.5" />{doc.linked_include}
                              </Badge>
                            )}
                            {doc.uploaded_by === "customer" ? (
                              <Badge variant="outline" className="text-[10px] h-4 gap-0.5 border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:bg-blue-950/20" data-testid={`badge-uploaded-by-${doc.id}`}>Customer</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-4 gap-0.5 text-muted-foreground" data-testid={`badge-uploaded-by-${doc.id}`}>Admin</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {doc.dropbox_path && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview" onClick={() => authPreview(`/api/orders/${id}/documents/${doc.id}/preview`)} data-testid={`button-preview-doc-${doc.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Download" onClick={() => authDownload(`/api/orders/${id}/documents/${doc.id}/download`, doc.file_name)} data-testid={`button-download-doc-${doc.id}`}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete" onClick={() => { if (confirm("Delete this document?")) deleteMutation.mutate(doc.id); }} data-testid={`button-delete-doc-${doc.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No documents yet</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Activity className="h-4 w-4" />Activity Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 p-3 rounded-lg border border-dashed">
                <textarea
                  className="w-full rounded-md border p-2 text-sm bg-background resize-none"
                  rows={2}
                  placeholder="Log an activity..."
                  value={logDescription}
                  onChange={(e) => setLogDescription(e.target.value)}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => logFileRef.current?.click()}
                  >
                    <Paperclip className="h-3 w-3 mr-1" />{logFile ? logFile.name : "Attach File"}
                  </Button>
                  <input
                    ref={logFileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) setLogFile(e.target.files[0]); }}
                  />
                  {logFile && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => { setLogFile(null); if (logFileRef.current) logFileRef.current.value = ""; }}>
                      <X className="h-3 w-3 mr-1" />Remove
                    </Button>
                  )}
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    onClick={() => logMutation.mutate()}
                    disabled={!logDescription.trim() || logMutation.isPending}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />{logMutation.isPending ? "Saving..." : "Add Log"}
                  </Button>
                </div>
              </div>

              {activityLogs.length > 0 ? (
                <div className="space-y-1">
                  {activityLogs.map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-md hover:bg-accent/50 transition-colors">
                      <div className="mt-0.5 shrink-0">{getActionIcon(log.action)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] h-4 font-medium">{getActionLabel(log.action)}</Badge>
                          <span className="text-[11px] text-muted-foreground">{formatPKT(log.created_at)}</span>
                        </div>
                        <p className="text-sm mt-0.5">{log.description}</p>
                        {log.file_name && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{log.file_name}</span>
                            {log.dropbox_path && (
                              <Badge variant="outline" className="text-[10px] h-4 gap-0.5"><Cloud className="h-2.5 w-2.5" />Dropbox</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No activity logged yet</p>}
            </CardContent>
          </Card>

        </div>
      </div>

      <Dialog open={editCustomerOpen} onOpenChange={setEditCustomerOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <CustomerFormFields form={editForm} onChange={setEditForm} testIdPrefix="edit-order-customer" />
          <Button
            onClick={() => updateCustomerMutation.mutate(editForm)}
            disabled={updateCustomerMutation.isPending || !editForm.individual_name || !editForm.email || !editForm.phone}
            className="w-full"
          >
            {updateCustomerMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmDialog.isBulk ? "Mark All Delivered" : "Confirm Status Change"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmDialog.isBulk ? (
              <>
                Mark all <span className="font-semibold text-foreground">{confirmDialog.bulkItems?.length} pending items</span> in{" "}
                <span className="font-semibold text-foreground">"{confirmDialog.item}"</span> as{" "}
                <span className="font-semibold text-green-600">delivered</span>?
              </>
            ) : (
              <>
                Are you sure you want to mark <span className="font-semibold text-foreground">"{confirmDialog.item}"</span> as{" "}
                <span className={`font-semibold ${confirmDialog.newStatus === "delivered" ? "text-green-600" : "text-red-600"}`}>
                  {confirmDialog.newStatus}
                </span>?
              </>
            )}
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button
              onClick={confirmStatusChange}
              className={confirmDialog.newStatus === "delivered" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {confirmDialog.isBulk ? "Mark All Delivered" : confirmDialog.newStatus === "delivered" ? "Mark Delivered" : "Mark Pending"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOrderDialog} onOpenChange={setCompleteOrderDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              All Items Delivered!
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            All items in this order have been marked as delivered. Would you like to mark the order as <span className="font-semibold text-green-600">completed</span>?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCompleteOrderDialog(false)}>
              Not Now
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                updateMutation.mutate({ status: "completed" } as any);
                setCompleteOrderDialog(false);
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />Mark Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={formationDatePrompt.open} onOpenChange={(open) => { if (!open) setFormationDatePrompt(prev => ({ ...prev, open: false })); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Set {formationDatePrompt.label}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Would you like to record today's date as the <span className="font-semibold">{formationDatePrompt.label}</span>? You can change it if needed.
          </p>
          <div>
            <Label className="text-xs">Formation Date</Label>
            <Input
              type="date"
              value={formationDatePrompt.date}
              onChange={(e) => setFormationDatePrompt(prev => ({ ...prev, date: e.target.value }))}
              className="mt-1"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormationDatePrompt({ open: false, serviceKey: "", serviceName: "", date: "", label: "" })}>
              Skip
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={confirmFormationDate}
            >
              <Calendar className="h-4 w-4 mr-1" />Confirm Date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={includeDialog.open} onOpenChange={(open) => { setIncludeDialog(prev => ({ ...prev, open })); if (!open) { setIncludeNote(""); setIncludeFiles([]); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${getIncludeStatus(includeDialog.item) === "delivered" ? "bg-green-500" : "bg-red-500"}`} />
              {includeDialog.item}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Note</Label>
              <textarea
                className="w-full rounded-md border p-2 text-sm bg-background"
                rows={2}
                placeholder="Add a note for this service item..."
                value={includeNote}
                onChange={(e) => setIncludeNote(e.target.value)}
              />
              <Button size="sm" onClick={saveIncludeNote} className="mt-2">
                <MessageSquare className="h-3 w-3 mr-1" />Save Note
              </Button>
            </div>

            <div className="border-t pt-4">
              <Label className="text-xs font-medium mb-1.5 block">Attached Files</Label>

              {linkedDocs.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {linkedDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 rounded border bg-accent/20 text-sm">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{doc.document_name || doc.file_name}</span>
                      {doc.dropbox_path && (
                        <>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => authPreview(`/api/orders/${id}/documents/${doc.id}/preview`)} title="Preview">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => authDownload(`/api/orders/${id}/documents/${doc.id}/download`, doc.file_name)} title="Download">
                            <Download className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this document?")) deleteMutation.mutate(doc.id); }} title="Delete">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {dropboxStatus?.connected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => includeFileRef.current?.click()}
                    >
                      <Plus className="h-3 w-3 mr-1" />Add Files
                    </Button>
                    <input ref={includeFileRef} type="file" multiple className="hidden" onChange={handleIncludeFileSelect} />
                    <span className="text-xs text-muted-foreground">Select multiple files to upload</span>
                  </div>

                  {includeFiles.length > 0 && (
                    <div className="space-y-2">
                      {includeFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded border">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <Input
                            value={f.docName}
                            onChange={(e) => updateIncludeFileName(i, e.target.value)}
                            className="h-7 text-xs flex-1"
                            placeholder="Document name"
                          />
                          <span className="text-[10px] text-muted-foreground shrink-0">{(f.file.size / 1024).toFixed(0)} KB</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeIncludeFile(i)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        onClick={uploadIncludeFiles}
                        disabled={uploadingInclude}
                        className="w-full"
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        {uploadingInclude ? "Uploading..." : `Upload ${includeFiles.length} File${includeFiles.length > 1 ? "s" : ""}`}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Connect Dropbox in Settings to upload files.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={contactEmailOpen} onOpenChange={setContactEmailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Contact Customer via Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <p><span className="font-medium">To:</span> {customer?.email}</p>
              <p><span className="font-medium">Customer:</span> {order?.customer_name} ({order?.company_name})</p>
              <p><span className="font-medium">Order:</span> {order?.order_number}</p>
            </div>

            <div>
              <Label>SMTP Account</Label>
              <Select value={String(contactSmtp)} onValueChange={(v) => setContactSmtp(Number(v))}>
                <SelectTrigger><SelectValue placeholder="Select SMTP account" /></SelectTrigger>
                <SelectContent>
                  {smtpAccounts.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Subject</Label>
              <Input value={contactSubject} onChange={(e) => setContactSubject(e.target.value)} />
            </div>

            <div>
              <Label>Message</Label>
              <Textarea rows={10} value={contactBody} onChange={(e) => setContactBody(e.target.value)} />
            </div>

            <Button
              className="w-full"
              onClick={() => contactEmailMutation.mutate()}
              disabled={contactEmailMutation.isPending || !contactSmtp || !contactSubject}
            >
              <Send className="h-4 w-4 mr-2" />
              {contactEmailMutation.isPending ? "Sending..." : "Send Email"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Portal Link
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-accent/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order</span>
                <span className="font-semibold">{order?.order_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{order?.customer_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Company</span>
                <span className="font-medium">{order?.company_name}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Portal Link</Label>
              <div className="flex items-center gap-2">
                <Input value={getPortalUrl()} readOnly className="text-xs font-mono" data-testid="input-order-share-portal-url" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(getPortalUrl());
                    toast({ title: "Link copied!" });
                  }}
                  data-testid="button-order-share-copy-link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Tabs defaultValue="whatsapp">
              <TabsList className="w-full">
                <TabsTrigger value="whatsapp" className="flex-1" data-testid="tab-order-share-whatsapp">
                  <SiWhatsapp className="h-4 w-4 mr-1" />WhatsApp
                </TabsTrigger>
                <TabsTrigger value="email" className="flex-1" data-testid="tab-order-share-email">
                  Email
                </TabsTrigger>
              </TabsList>
              <TabsContent value="whatsapp" className="space-y-3 mt-3">
                <p className="text-sm text-muted-foreground">
                  Send portal link via WhatsApp to {customer?.phone || "customer"}.
                </p>
                <Button className="w-full" onClick={handleShareWhatsApp} data-testid="button-order-share-whatsapp-send">
                  <SiWhatsapp className="h-4 w-4 mr-2" />Send via WhatsApp
                </Button>
              </TabsContent>
              <TabsContent value="email" className="space-y-3 mt-3">
                <div>
                  <Label className="text-xs">SMTP Account</Label>
                  <Select value={String(shareSmtp)} onValueChange={(v) => setShareSmtp(Number(v))}>
                    <SelectTrigger data-testid="select-order-share-smtp"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {smtpAccounts.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input value={customer?.email || ""} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Subject</Label>
                  <Input value={shareEmailSubject} onChange={(e) => setShareEmailSubject(e.target.value)} data-testid="input-order-share-email-subject" />
                </div>
                <div>
                  <Label className="text-xs">Body</Label>
                  <Textarea
                    value={shareEmailBody}
                    onChange={(e) => setShareEmailBody(e.target.value)}
                    rows={6}
                    className="text-sm"
                    data-testid="input-order-share-email-body"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => shareEmailMutation.mutate()}
                  disabled={shareEmailMutation.isPending}
                  data-testid="button-order-share-email-send"
                >
                  {shareEmailMutation.isPending ? "Sending..." : "Send Email"}
                </Button>
              </TabsContent>
            </Tabs>

            <Button variant="outline" className="w-full" onClick={() => setShareOpen(false)} data-testid="button-order-share-close">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getDaysRemaining(dateStr: string): number {
  if (!dateStr) return Infinity;
  const due = new Date(dateStr);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getDueBadge(dateStr: string, status: string) {
  if (status === "submitted") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">Submitted</Badge>;
  const days = getDaysRemaining(dateStr);
  if (days < 0) return <Badge variant="destructive" className="text-[10px]">Overdue ({Math.abs(days)}d)</Badge>;
  if (days <= 30) return <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px] animate-pulse">Due in {days}d</Badge>;
  if (days <= 60) return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">Due in {days}d</Badge>;
  return <Badge variant="outline" className="text-[10px]">{days}d remaining</Badge>;
}

function OrderComplianceDetail({
  record,
  onMarkSubmitted,
  isPending,
}: {
  record: ComplianceRecord;
  onMarkSubmitted: (type: "annual_report" | "federal_tax") => void;
  isPending: boolean;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const llcLabel = record.llc_type === "single-member" ? "Single-Member" : record.llc_type === "multi-member" ? "Multi-Member" : "";
  const arDays = getDaysRemaining(record.annual_report_due);
  const ftDays = getDaysRemaining(record.federal_tax_due);
  const isUrgent = (arDays <= 30 && record.annual_report_status === "pending") || (ftDays <= 30 && record.federal_tax_status === "pending");
  const isOverdue = (arDays < 0 && record.annual_report_status === "pending") || (ftDays < 0 && record.federal_tax_status === "pending");

  const { data: docs = [] } = useQuery<ComplianceDocument[]>({
    queryKey: [`/api/compliance-records/${record.id}/documents`],
    enabled: expanded,
  });

  const { data: history = [] } = useQuery<ComplianceHistory[]>({
    queryKey: [`/api/compliance-records/${record.id}/history`],
    enabled: expanded,
  });

  const { data: reminders = [] } = useQuery<any[]>({
    queryKey: ["/api/reminders"],
    enabled: expanded,
    select: (data: any[]) => data.filter((r: any) => r.order_id === record.order_id),
  });

  const uploadDocMutation = useMutation({
    mutationFn: async ({ file, documentName }: { file: File; documentName: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_name", documentName);
      formData.append("document_type", "");
      const res = await authFetch(`/api/compliance-records/${record.id}/documents`, { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/compliance-records/${record.id}/documents`] });
      toast({ title: "Document uploaded" });
    },
    onError: (e) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/compliance-documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/compliance-records/${record.id}/documents`] });
      toast({ title: "Document deleted" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^/.]+$/, "");
    uploadDocMutation.mutate({ file, documentName: name });
    e.target.value = "";
  };

  return (
    <div className={`rounded-lg border transition-all ${isOverdue ? "border-red-400 bg-red-50/30" : isUrgent ? "border-amber-400 bg-amber-50/30" : ""}`}>
      <div className="p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 font-mono">CR-{record.id}</Badge>
            <span className="text-sm font-medium truncate">{record.service_name}</span>
            {llcLabel && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 border-purple-300 text-purple-700 bg-purple-50">
                {llcLabel}
              </Badge>
            )}
            {isOverdue && <Badge variant="destructive" className="text-[10px]">OVERDUE</Badge>}
            {isUrgent && !isOverdue && <Badge className="text-[10px] bg-red-100 text-red-800 border-red-300">URGENT</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {record.state && <Badge variant="secondary" className="text-[10px] shrink-0">{record.state}</Badge>}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
        {record.formation_date && (
          <p className="text-xs text-muted-foreground mt-1">Formation: {new Date(record.formation_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
        )}
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">AR:</span>
            {record.annual_report_due ? getDueBadge(record.annual_report_due, record.annual_report_status) : <span className="text-[10px] text-muted-foreground">N/A</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">FT:</span>
            {record.federal_tax_due ? getDueBadge(record.federal_tax_due, record.federal_tax_status) : <span className="text-[10px] text-muted-foreground">N/A</span>}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-3 pb-3 space-y-3 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-2.5 rounded-md bg-accent/30 border space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Annual Report</p>
                {record.annual_report_due && getDueBadge(record.annual_report_due, record.annual_report_status)}
              </div>
              <p className="text-xs">Due: {record.annual_report_due || "Not set"}</p>
              {record.annual_report_due && record.annual_report_status === "pending" && (
                <div className="flex gap-1 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => onMarkSubmitted("annual_report")}
                    disabled={isPending}
                  >
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Mark Submitted
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => {
                      const msg = encodeURIComponent(`Annual Report Reminder for ${record.company_name} - Due: ${record.annual_report_due}`);
                      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
                    }}
                  >
                    <MessageSquare className="h-2.5 w-2.5 mr-0.5" />WhatsApp
                  </Button>
                </div>
              )}
            </div>
            <div className="p-2.5 rounded-md bg-accent/30 border space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Federal Tax {record.llc_type === "multi-member" ? "(Mar 15)" : "(Apr 15)"}</p>
                {record.federal_tax_due && getDueBadge(record.federal_tax_due, record.federal_tax_status)}
              </div>
              <p className="text-xs">Due: {record.federal_tax_due || "Not set"}</p>
              {record.federal_tax_due && record.federal_tax_status === "pending" && (
                <div className="flex gap-1 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => onMarkSubmitted("federal_tax")}
                    disabled={isPending}
                  >
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Mark Submitted
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => {
                      const msg = encodeURIComponent(`Federal Tax Reminder for ${record.company_name} - Due: ${record.federal_tax_due}`);
                      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
                    }}
                  >
                    <MessageSquare className="h-2.5 w-2.5 mr-0.5" />WhatsApp
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-2.5 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Reminders Sent</span><span className="font-medium">{record.reminder_count}</span></div>
            {record.last_reminder_sent && <div className="flex justify-between"><span className="text-muted-foreground">Last Sent</span><span>{new Date(record.last_reminder_sent).toLocaleDateString()}</span></div>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold flex items-center gap-1"><FileText className="h-3 w-3" />Documents</h4>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-2.5 w-2.5 mr-0.5" />Upload
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
            </div>
            {docs.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-2">No compliance documents</p>
            ) : (
              <div className="space-y-1">
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between bg-accent/30 rounded p-1.5 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{doc.document_name || doc.file_name}</span>
                      {doc.document_type && <Badge variant="outline" className="text-[9px] px-1 py-0">{doc.document_type}</Badge>}
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => authDownload(`/api/compliance-documents/${doc.id}/download`, doc.file_name)}>
                        <Download className="h-2.5 w-2.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive" onClick={() => { if (confirm("Delete this document?")) deleteDocMutation.mutate(doc.id); }}>
                        <Trash2 className="h-2.5 w-2.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold flex items-center gap-1"><History className="h-3 w-3" />Compliance History</h4>
              <div className="space-y-1">
                {history.map(h => (
                  <div key={h.id} className="flex items-center justify-between bg-emerald-50 rounded p-1.5 text-xs border border-emerald-200">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <span className="font-medium text-emerald-800">{h.year} {h.type}</span>
                    </div>
                    <span className="text-emerald-600 text-[10px]">{h.completed_at ? new Date(h.completed_at).toLocaleDateString() : h.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reminders.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold flex items-center gap-1"><Mail className="h-3 w-3" />Reminders ({reminders.length})</h4>
              <div className="space-y-1">
                {reminders.slice(0, 5).map((r: any) => {
                  const dueDate = new Date(r.due_date);
                  const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  const isUrgent = r.status === "pending" && daysUntil >= 0 && daysUntil <= 30;
                  return (
                    <div key={r.id} className={`flex items-center justify-between rounded p-1.5 text-xs border ${isUrgent ? "bg-red-50 border-red-200" : "bg-accent/30"}`}>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Badge variant={r.status === "completed" ? "default" : r.status === "pending" ? "secondary" : "outline"} className="text-[9px] px-1 py-0">{r.status}</Badge>
                        <span className="truncate">{r.title}</span>
                      </div>
                      <span className={`text-[10px] shrink-0 ${isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                        {dueDate.toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
                {reminders.length > 5 && <p className="text-[10px] text-muted-foreground text-center">+{reminders.length - 5} more</p>}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
