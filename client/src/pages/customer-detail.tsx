import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthHeaders, authFetch } from "@/lib/auth";
import { usePagination } from "@/hooks/use-pagination";
import PaginationControls from "@/components/pagination-controls";
import {
  ArrowLeft, Mail, Phone, MapPin, Pencil, FileText, Upload,
  Download, Trash2, Eye, Cloud, CloudOff, ShieldCheck, Copy, Users, Gift, ExternalLink, Share2, Link2,
  ChevronDown, ChevronUp
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { Customer, Order, Invoice, CustomerDocument, SmtpAccount, CustomerPortalLink } from "@shared/schema";
import CustomerFormFields from "@/components/customer-form-fields";

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

export default function CustomerDetail() {
  const [, params] = useRoute("/customers/:id");
  const id = Number(params?.id);
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    company_name: "", individual_name: "", email: "", phone: "",
    country: "", state_province: "", residential_address: "",
    referred_by: "", referral_partner_id: null as number | null, notes: ""
  });
  const [docName, setDocName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [portalLink, setPortalLink] = useState<CustomerPortalLink | null>(null);
  const [shareEmailSubject, setShareEmailSubject] = useState("");
  const [shareEmailBody, setShareEmailBody] = useState("");
  const [shareSmtp, setShareSmtp] = useState<number>(0);

  const { data: customer, isLoading } = useQuery<Customer>({ queryKey: [`/api/customers/${id}`], enabled: !!id });
  const { data: orders = [] } = useQuery<Order[]>({ queryKey: ["/api/orders"] });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: documents = [] } = useQuery<CustomerDocument[]>({
    queryKey: [`/api/customers/${id}/documents`],
    enabled: !!id,
  });
  const { data: dropboxStatus } = useQuery<{ connected: boolean; account: { name: string; email: string } | null }>({
    queryKey: ["/api/dropbox/status"],
  });
  const { data: referralInfo } = useQuery<{
    referral_code: string;
    referral_username: string;
    is_partner: boolean;
    partner_id: number | null;
    total_referrals: number;
    referred_customers: { id: number; individual_name: string; company_name: string; email: string; created_at: string }[];
  }>({
    queryKey: ["/api/customers", id, "referral-info"],
    queryFn: async () => {
      const res = await authFetch(`/api/customers/${id}/referral-info`);
      if (!res.ok) throw new Error("Failed to fetch referral info");
      return res.json();
    },
    enabled: !!id,
  });

  const { data: smtpAccounts = [] } = useQuery<SmtpAccount[]>({ queryKey: ["/api/smtp-accounts"] });

  const customerOrders = orders.filter(o => o.customer_id === id);
  const customerInvoices = invoices.filter(i => i.customer_id === id);

  const [ordersExpanded, setOrdersExpanded] = useState(true);
  const [invoicesExpanded, setInvoicesExpanded] = useState(true);

  const ordersPagination = usePagination(customerOrders, { defaultPageSize: 20 });
  const invoicesPagination = usePagination(customerInvoices, { defaultPageSize: 20 });

  const portalLinkMutation = useMutation({
    mutationFn: async () => {
      if (!customer) throw new Error("No customer");
      const res = await apiRequest("POST", "/api/portal-links", {
        customer_id: customer.id,
        customer_name: customer.individual_name,
        company_name: customer.company_name,
      });
      return res.json();
    },
    onSuccess: (data: CustomerPortalLink) => {
      setPortalLink(data);
      const portalUrl = `${window.location.origin}/portal/${data.token}`;
      const defaultSmtp = smtpAccounts.find(a => a.is_default) || smtpAccounts[0];
      setShareSmtp(defaultSmtp?.id || 0);
      setShareEmailSubject(`Your Customer Portal - ${customer?.company_name || customer?.individual_name || ""}`);
      setShareEmailBody(
        `Dear ${customer?.individual_name || ""},\n\n` +
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
      `Hi ${customer?.individual_name || ""},\n\n` +
      `Here is your customer portal link:\n${portalUrl}\n\n` +
      `You can view your orders, invoices & manage your profile.\n\n` +
      `Thank you!\nInfinity Filer`
    );
    window.open(`https://wa.me/${whatsappPhone}?text=${msg}`, "_blank");
  };

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const res = await apiRequest("PATCH", `/api/customers/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setEditOpen(false);
      toast({ title: "Customer updated successfully" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("document_name", docName || selectedFile.name);
      const res = await authFetch(`/api/customers/${id}/documents`, { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${id}/documents`] });
      setSelectedFile(null);
      setDocName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Document uploaded successfully" });
    },
    onError: (e) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/customers/${id}/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${id}/documents`] });
      toast({ title: "Document deleted" });
    },
    onError: (e) => toast({ title: "Delete failed", description: (e as Error).message, variant: "destructive" }),
  });

  const openEditDialog = () => {
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
      setEditOpen(true);
    }
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-64" /></div>;
  if (!customer) return <div className="p-6">Customer not found</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/customers"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-bold" data-testid="text-customer-name">{customer.company_name || customer.individual_name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/create-invoice?customerId=${id}`}>
            <Button variant="default" data-testid="button-generate-invoice">
              <FileText className="h-4 w-4 mr-2" />Generate Invoice
            </Button>
          </Link>
          <Button variant="outline" onClick={() => portalLinkMutation.mutate()} disabled={portalLinkMutation.isPending} data-testid="button-customer-portal-link">
            <Link2 className="h-4 w-4 mr-2" />{portalLinkMutation.isPending ? "Loading..." : "Portal Link"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Customer Info</CardTitle>
              <Button variant="ghost" size="sm" onClick={openEditDialog}>
                <Pencil className="h-4 w-4 mr-1" />Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {customer.company_name && <div><p className="text-xs text-muted-foreground">Company Name</p><p className="text-sm font-medium">{customer.company_name}</p></div>}
            <div><p className="text-xs text-muted-foreground">Individual Name</p><p className="text-sm font-medium">{customer.individual_name}</p></div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><p className="text-sm">{customer.email}</p></div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><p className="text-sm">{customer.phone}</p></div>
            {customer.residential_address && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><p className="text-sm">{customer.residential_address}</p></div>}
            {customer.state_province && <div><p className="text-xs text-muted-foreground">State/Province</p><p className="text-sm">{customer.state_province}</p></div>}
            {customer.country && <div><p className="text-xs text-muted-foreground">Country</p><p className="text-sm">{customer.country}</p></div>}
            {customer.referred_by && <div><p className="text-xs text-muted-foreground">Referred By</p><Badge variant="secondary">{customer.referred_by}</Badge></div>}
            {customer.notes && <div><p className="text-xs text-muted-foreground">Notes</p><p className="text-sm">{customer.notes}</p></div>}
            <div><p className="text-xs text-muted-foreground">Customer Since</p><p className="text-sm">{new Date(customer.created_at).toLocaleDateString()}</p></div>

            <div className="pt-3 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</p>
              <div className="flex gap-2">
                {customer.phone && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 text-green-600 border-green-200 dark:border-green-800"
                    data-testid="button-contact-whatsapp"
                    onClick={() => {
                      const phone = customer.phone?.replace(/[^0-9]/g, "") || "";
                      const whatsappPhone = phone.startsWith("0") ? "92" + phone.slice(1) : phone.startsWith("92") ? phone : phone;
                      window.open(`https://wa.me/${whatsappPhone}`, "_blank");
                    }}
                  >
                    <SiWhatsapp className="h-4 w-4" />WhatsApp
                  </Button>
                )}
                {customer.email && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    data-testid="button-contact-email"
                    onClick={() => {
                      window.open(`mailto:${customer.email}`, "_blank");
                    }}
                  >
                    <Mail className="h-4 w-4" />Email
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />Verification Documents ({documents.length})
                </CardTitle>
                {dropboxStatus?.connected ? (
                  <Badge variant="default" className="gap-1"><Cloud className="h-3 w-3" />Dropbox</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><CloudOff className="h-3 w-3" />Not Connected</Badge>
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
                    <Input placeholder="e.g. Passport, CNIC, SSN" value={docName} onChange={(e) => setDocName(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Select File</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={(e) => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]); }}
                      className="text-sm w-full file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-input file:bg-background file:text-sm file:font-medium hover:file:bg-accent"
                    />
                  </div>
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground flex-1">
                      Ready: <span className="font-medium text-foreground">{docName || selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                    <Button size="sm" onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending}>
                      <Upload className="h-4 w-4 mr-1" />{uploadMutation.isPending ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                )}
              </div>

              {documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-accent/20">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.document_name || doc.file_name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {doc.document_name && doc.document_name !== doc.file_name && (
                              <span className="text-xs text-muted-foreground truncate">Original: {doc.file_name}</span>
                            )}
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
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview" onClick={() => authPreview(`/api/customers/${id}/documents/${doc.id}/preview`)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Download" onClick={() => authDownload(`/api/customers/${id}/documents/${doc.id}/download`, doc.file_name)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete" onClick={() => { if (confirm("Delete this document?")) deleteMutation.mutate(doc.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No verification documents uploaded yet</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-lg">Orders ({customerOrders.length})</CardTitle>
                {customerOrders.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOrdersExpanded(!ordersExpanded)}
                    data-testid="button-toggle-customer-orders"
                  >
                    {ordersExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                    {ordersExpanded ? "Collapse" : "Expand"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {ordersExpanded && (
                <>
                  {customerOrders.length > 0 ? (
                    <div className="space-y-2">
                      {ordersPagination.paginatedData.map(order => (
                        <Link key={order.id} href={`/orders/${order.id}`}>
                          <div className="flex items-center justify-between gap-2 p-3 rounded-md bg-accent/50 hover-elevate cursor-pointer">
                            <div>
                              <p className="text-sm font-medium">{order.order_number}</p>
                              <p className="text-xs text-muted-foreground">{order.service_type} - {order.state}</p>
                            </div>
                            <Badge variant={order.status === "completed" ? "default" : "secondary"}>{order.status}</Badge>
                          </div>
                        </Link>
                      ))}
                      <PaginationControls
                        page={ordersPagination.page}
                        pageSize={ordersPagination.pageSize}
                        totalPages={ordersPagination.totalPages}
                        totalItems={ordersPagination.totalItems}
                        startIndex={ordersPagination.startIndex}
                        endIndex={ordersPagination.endIndex}
                        pageSizeOptions={ordersPagination.pageSizeOptions}
                        onPageChange={ordersPagination.setPage}
                        onPageSizeChange={ordersPagination.setPageSize}
                      />
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No orders yet</p>}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-lg">Invoices ({customerInvoices.length})</CardTitle>
                {customerInvoices.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setInvoicesExpanded(!invoicesExpanded)}
                    data-testid="button-toggle-customer-invoices"
                  >
                    {invoicesExpanded ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                    {invoicesExpanded ? "Collapse" : "Expand"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {invoicesExpanded && (
                <>
                  {customerInvoices.length > 0 ? (
                    <div className="space-y-2">
                      {invoicesPagination.paginatedData.map(inv => (
                        <Link key={inv.id} href={`/invoices/${inv.id}`}>
                          <div className="flex items-center justify-between gap-2 p-3 rounded-md bg-accent/50 hover-elevate cursor-pointer">
                            <div>
                              <p className="text-sm font-medium">{inv.invoice_number}</p>
                              <p className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">${Number(inv.total).toLocaleString()}</p>
                              <Badge variant={inv.status === "paid" ? "default" : "secondary"}>{inv.status}</Badge>
                            </div>
                          </div>
                        </Link>
                      ))}
                      <PaginationControls
                        page={invoicesPagination.page}
                        pageSize={invoicesPagination.pageSize}
                        totalPages={invoicesPagination.totalPages}
                        totalItems={invoicesPagination.totalItems}
                        startIndex={invoicesPagination.startIndex}
                        endIndex={invoicesPagination.endIndex}
                        pageSizeOptions={invoicesPagination.pageSizeOptions}
                        onPageChange={invoicesPagination.setPage}
                        onPageSizeChange={invoicesPagination.setPageSize}
                      />
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No invoices yet</p>}
                </>
              )}
            </CardContent>
          </Card>

          {referralInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gift className="h-4 w-4" />My Referral
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Referral Code</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-accent px-2 py-1 rounded" data-testid="text-referral-code">
                        {referralInfo.referral_code || "Not assigned"}
                      </code>
                      {referralInfo.referral_code && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          data-testid="button-copy-referral-code"
                          onClick={() => {
                            navigator.clipboard.writeText(referralInfo.referral_code);
                            toast({ title: "Referral code copied!" });
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Referral Username</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-accent px-2 py-1 rounded" data-testid="text-referral-username">
                        {referralInfo.referral_username || "Not assigned"}
                      </code>
                      {referralInfo.referral_username && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          data-testid="button-copy-referral-username"
                          onClick={() => {
                            navigator.clipboard.writeText(referralInfo.referral_username);
                            toast({ title: "Username copied!" });
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid="text-total-referrals">
                      {referralInfo.total_referrals} referral{referralInfo.total_referrals !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {referralInfo.is_partner && referralInfo.partner_id && (
                    <Link href={`/partners`}>
                      <Badge variant="default" className="gap-1 cursor-pointer" data-testid="badge-partner-status">
                        <ExternalLink className="h-3 w-3" />Active Partner
                      </Badge>
                    </Link>
                  )}
                  {!referralInfo.is_partner && (
                    <Badge variant="secondary" data-testid="badge-not-partner">No referrals yet</Badge>
                  )}
                </div>

                {referralInfo.referred_customers.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-muted-foreground font-medium">Referred Customers</p>
                    {referralInfo.referred_customers.map(rc => (
                      <Link key={rc.id} href={`/customers/${rc.id}`}>
                        <div className="flex items-center justify-between p-2.5 rounded-md bg-accent/50 hover:bg-accent cursor-pointer transition-colors" data-testid={`referred-customer-${rc.id}`}>
                          <div>
                            <p className="text-sm font-medium">{rc.individual_name}</p>
                            {rc.company_name && <p className="text-xs text-muted-foreground">{rc.company_name}</p>}
                          </div>
                          <span className="text-xs text-muted-foreground">{new Date(rc.created_at).toLocaleDateString()}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Customer</DialogTitle></DialogHeader>
          <CustomerFormFields form={editForm} onChange={setEditForm} testIdPrefix="edit-customer" />
          <Button
            onClick={() => updateMutation.mutate(editForm)}
            disabled={updateMutation.isPending || !editForm.individual_name || !editForm.email || !editForm.phone}
            className="w-full"
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Customer Portal Link
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-accent/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-semibold">{customer?.individual_name}</span>
              </div>
              {customer?.company_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Company</span>
                  <span className="font-medium">{customer.company_name}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Portal Link</Label>
              <div className="flex items-center gap-2">
                <Input value={getPortalUrl()} readOnly className="text-xs font-mono" data-testid="input-customer-share-portal-url" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(getPortalUrl());
                    toast({ title: "Link copied!" });
                  }}
                  data-testid="button-customer-share-copy-link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Tabs defaultValue="whatsapp">
              <TabsList className="w-full">
                <TabsTrigger value="whatsapp" className="flex-1" data-testid="tab-customer-share-whatsapp">
                  <SiWhatsapp className="h-4 w-4 mr-1" />WhatsApp
                </TabsTrigger>
                <TabsTrigger value="email" className="flex-1" data-testid="tab-customer-share-email">
                  Email
                </TabsTrigger>
              </TabsList>
              <TabsContent value="whatsapp" className="space-y-3 mt-3">
                <p className="text-sm text-muted-foreground">
                  Send portal link via WhatsApp to {customer?.phone || "customer"}.
                </p>
                <Button className="w-full" onClick={handleShareWhatsApp} data-testid="button-customer-share-whatsapp-send">
                  <SiWhatsapp className="h-4 w-4 mr-2" />Send via WhatsApp
                </Button>
              </TabsContent>
              <TabsContent value="email" className="space-y-3 mt-3">
                <div>
                  <Label className="text-xs">SMTP Account</Label>
                  <Select value={String(shareSmtp)} onValueChange={(v) => setShareSmtp(Number(v))}>
                    <SelectTrigger data-testid="select-customer-share-smtp"><SelectValue placeholder="Select account" /></SelectTrigger>
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
                  <Input value={shareEmailSubject} onChange={(e) => setShareEmailSubject(e.target.value)} data-testid="input-customer-share-email-subject" />
                </div>
                <div>
                  <Label className="text-xs">Body</Label>
                  <Textarea
                    value={shareEmailBody}
                    onChange={(e) => setShareEmailBody(e.target.value)}
                    rows={6}
                    className="text-sm"
                    data-testid="input-customer-share-email-body"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => shareEmailMutation.mutate()}
                  disabled={shareEmailMutation.isPending}
                  data-testid="button-customer-share-email-send"
                >
                  {shareEmailMutation.isPending ? "Sending..." : "Send Email"}
                </Button>
              </TabsContent>
            </Tabs>

            <Button variant="outline" className="w-full" onClick={() => setShareOpen(false)} data-testid="button-customer-share-close">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
