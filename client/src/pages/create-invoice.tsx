import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authFetch } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowLeft, Package, Search, UserPlus, Copy, Send, MessageSquare, Mail, ExternalLink, ShieldCheck, FileText, X } from "lucide-react";
import type { Customer, Service, BundlePackage, BundleItem, CompanySettings, PartnerServiceRate, CustomerPortalLink, SmtpAccount, ReferralPartner } from "@shared/schema";
import { SiWhatsapp } from "react-icons/si";
import { Link } from "wouter";
import CustomerFormFields from "@/components/customer-form-fields";

interface DocFile {
  file: File;
  docName: string;
}

const STATE_SPECIFIC_CATEGORIES = ["LLC Formation", "C-Corp Formation"];

function getServicePrice(s: Service) {
  if (STATE_SPECIFIC_CATEGORIES.includes(s.category)) {
    return Number(s.state_fee) + Number(s.agent_fee) + Number(s.unique_address) + Number(s.vyke_number) + Number(s.service_charges);
  }
  return Number(s.service_charges);
}

interface LineItem {
  description: string;
  state: string;
  quantity: number;
  unit_price: number;
  service_id: number | null;
  includes: string[];
  fromBundle?: string;
  currencyTax: boolean;
  llc_type: string;
  original_price?: number;
  partner_discount_label?: string;
}

function isLLCFormation(item: LineItem, services: Service[]): boolean {
  if (item.service_id) {
    const service = services.find(s => s.id === item.service_id);
    if (service) return service.category === "LLC Formation";
  }
  return item.description.toLowerCase().includes("llc formation");
}

export default function CreateInvoice() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });
  const { data: bundles = [] } = useQuery<BundlePackage[]>({ queryKey: ["/api/bundles"] });
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/settings"] });
  const { data: exchangeRate } = useQuery<{ rate: number; lastUpdated: string }>({ queryKey: ["/api/exchange-rate"] });

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<LineItem[]>([{ description: "", state: "", quantity: 1, unit_price: 0, service_id: null, includes: [], currencyTax: true, llc_type: "" }]);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountNote, setDiscountNote] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceTab, setServiceTab] = useState("services");
  const [pkrEnabled, setPkrEnabled] = useState(false);
  const [pkrConfirmOpen, setPkrConfirmOpen] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    company_name: "", individual_name: "", email: "", phone: "",
    country: "", state_province: "", residential_address: "", referred_by: "", referral_partner_id: null as number | null, notes: "",
  });
  const [docFiles, setDocFiles] = useState<DocFile[]>([]);
  const docFileRef = useRef<HTMLInputElement>(null);
  const [partnerRates, setPartnerRates] = useState<PartnerServiceRate[]>([]);
  const [referralPartner, setReferralPartner] = useState<ReferralPartner | null>(null);
  const [sendInvoiceOpen, setSendInvoiceOpen] = useState(false);
  const [sendInvoiceTab, setSendInvoiceTab] = useState("whatsapp");
  const [sendTarget, setSendTarget] = useState<"customer" | "partner">("customer");
  const [createdInvoiceId, setCreatedInvoiceId] = useState<number | null>(null);
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState("");
  const [portalLink, setPortalLink] = useState<CustomerPortalLink | null>(null);
  const [portalLinkLoading, setPortalLinkLoading] = useState(false);
  const [emailSmtp, setEmailSmtp] = useState<number>(0);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const { data: smtpAccounts = [] } = useQuery<SmtpAccount[]>({ queryKey: ["/api/smtp-accounts"] });

  function getPortalUrl(token: string): string {
    return `${window.location.origin}/portal/${token}`;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const generatePortalLink = async (customerId: number, customerName: string, companyName: string) => {
    setPortalLinkLoading(true);
    try {
      const res = await apiRequest("POST", "/api/portal-links", {
        customer_id: customerId,
        customer_name: customerName,
        company_name: companyName,
      });
      const link = await res.json();
      setPortalLink(link);
      return link;
    } catch {
      setPortalLink(null);
      return null;
    } finally {
      setPortalLinkLoading(false);
    }
  };

  const fetchPartnerRates = async (partnerId: number) => {
    try {
      const res = await authFetch(`/api/referral-partners/${partnerId}/service-rates`);
      if (res.ok) {
        const rates = await res.json();
        setPartnerRates(rates);
      }
    } catch { setPartnerRates([]); }
    try {
      const pRes = await authFetch(`/api/referral-partners/${partnerId}`);
      if (pRes.ok) setReferralPartner(await pRes.json());
      else setReferralPartner(null);
    } catch { setReferralPartner(null); }
  };

  const applyPartnerDiscount = (price: number, serviceId: number | null): { price: number; original: number; label: string } => {
    if (!serviceId || partnerRates.length === 0) return { price, original: price, label: "" };
    const rate = partnerRates.find(r => r.service_id === serviceId);
    if (!rate || Number(rate.discount_value) === 0) return { price, original: price, label: "" };
    const discountValue = Number(rate.discount_value);
    if (rate.discount_type === "percentage") {
      const discounted = price - (price * discountValue / 100);
      return { price: Math.max(0, discounted), original: price, label: `${discountValue}% partner discount` };
    }
    return { price: Math.max(0, price - discountValue), original: price, label: `$${discountValue.toFixed(2)} partner discount` };
  };

  const handleDocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: DocFile[] = Array.from(files).map(f => ({
      file: f,
      docName: f.name.replace(/\.[^/.]+$/, ""),
    }));
    setDocFiles(prev => [...prev, ...newFiles]);
    if (docFileRef.current) docFileRef.current.value = "";
  };

  const newCustomerMutation = useMutation({
    mutationFn: async (data: typeof newCustomerForm) => {
      const res = await apiRequest("POST", "/api/customers", data);
      const customer = await res.json();

      if (docFiles.length > 0) {
        for (const df of docFiles) {
          const formData = new FormData();
          formData.append("file", df.file);
          formData.append("document_name", df.docName || df.file.name);
          const uploadRes = await authFetch(`/api/customers/${customer.id}/documents`, { method: "POST", body: formData });
          if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({ message: "Upload failed" }));
            console.error("Doc upload error:", err.message);
          }
        }
      }

      return customer;
    },
    onSuccess: (data: Customer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setSelectedCustomer(data);
      setNewCustomerOpen(false);
      setNewCustomerForm({ company_name: "", individual_name: "", email: "", phone: "", country: "", state_province: "", residential_address: "", referred_by: "", referral_partner_id: null, notes: "" });
      setDocFiles([]);
      if (data.referral_partner_id) {
        fetchPartnerRates(data.referral_partner_id);
      } else {
        setPartnerRates([]);
      }
      toast({ title: "Customer created and selected" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discCalc = discountPercentage > 0 ? subtotal * (discountPercentage / 100) : discountAmount;
  const total = subtotal - discCalc;

  const addItem = () => setItems([...items, { description: "", state: "", quantity: 1, unit_price: 0, service_id: null, includes: [], currencyTax: true, llc_type: "" }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  const selectService = (index: number, serviceId: string) => {
    const service = services.find(s => s.id === Number(serviceId));
    if (service) {
      const totalPrice = getServicePrice(service);
      const { price, original, label } = applyPartnerDiscount(totalPrice, service.id);
      const updated = [...items];
      updated[index] = {
        description: `${service.name} - ${service.category}${service.state ? ` (${service.state})` : ""}`,
        state: service.state,
        quantity: 1,
        unit_price: price,
        service_id: service.id,
        includes: service.includes || [],
        currencyTax: true,
        llc_type: "",
        original_price: label ? original : undefined,
        partner_discount_label: label || undefined,
      };
      setItems(updated);
    }
  };

  const [bundleItemsCache, setBundleItemsCache] = useState<Record<number, BundleItem[]>>({});

  const addBundle = async (bundle: BundlePackage) => {
    let bundleItems = bundleItemsCache[bundle.id];
    if (!bundleItems) {
      const res = await authFetch(`/api/bundles/${bundle.id}/items`);
      bundleItems = await res.json();
      setBundleItemsCache(prev => ({ ...prev, [bundle.id]: bundleItems }));
    }

    const newItems: LineItem[] = bundleItems.map(bi => {
      const service = services.find(s => s.id === bi.service_id);
      const price = service ? getServicePrice(service) : Number(bi.service_price);
      const discount = Number(bi.item_discount) || 0;

      let itemPrice = price;
      if (bundle.discount_type === "per_service") {
        itemPrice = price - discount;
      }

      const { price: finalPrice, original, label } = applyPartnerDiscount(itemPrice, bi.service_id);

      return {
        description: `${bi.service_name || service?.name || "Service"} - ${bi.service_category || service?.category || ""}${(bi.service_state || service?.state) ? ` (${bi.service_state || service?.state})` : ""}`,
        state: bi.service_state || service?.state || "",
        quantity: 1,
        unit_price: finalPrice,
        service_id: bi.service_id,
        includes: service?.includes || [],
        fromBundle: bundle.name,
        currencyTax: true,
        llc_type: "",
        original_price: label ? original : undefined,
        partner_discount_label: label || undefined,
      };
    });

    if (bundle.discount_type === "percentage" && Number(bundle.discount_percentage) > 0) {
      const bundleSubtotal = newItems.reduce((sum, i) => sum + i.unit_price, 0);
      const discAmt = bundleSubtotal * (Number(bundle.discount_percentage) / 100);
      newItems.push({
        description: `${bundle.name} - Bundle Discount (${bundle.discount_percentage}%)`,
        state: "",
        quantity: 1,
        unit_price: -discAmt,
        service_id: null,
        includes: [],
        fromBundle: bundle.name,
        currencyTax: false,
        llc_type: "",
      });
    } else if (bundle.discount_type === "fixed" && Number(bundle.discount_amount) > 0) {
      newItems.push({
        description: `${bundle.name} - Bundle Discount`,
        state: "",
        quantity: 1,
        unit_price: -Number(bundle.discount_amount),
        service_id: null,
        includes: [],
        fromBundle: bundle.name,
        currencyTax: false,
        llc_type: "",
      });
    }

    const hasEmptyFirst = items.length === 1 && !items[0].description;
    setItems(hasEmptyFirst ? newItems : [...items, ...newItems]);
    toast({ title: `Bundle "${bundle.name}" added with ${bundleItems.length} services` });
  };

  const handleCreateClick = () => {
    const validItems = items.filter(i => i.description);
    const llcItems = validItems.filter(i => isLLCFormation(i, services));
    const missingLlcType = llcItems.filter(i => !i.llc_type);
    if (missingLlcType.length > 0) {
      toast({
        title: "LLC Type Required",
        description: `Please select Single Member or Multi-Member for all LLC Formation services before creating the invoice.`,
        variant: "destructive",
      });
      return;
    }
    if (!pkrEnabled) {
      setPkrConfirmOpen(true);
      return;
    }
    createMutation.mutate();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCustomer) throw new Error("Select a customer");
      const validItems = items.filter(i => i.description);
      const invoiceItems = validItems.map(item => ({
        description: item.description,
        state: item.state,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
        service_id: item.service_id,
        includes: item.includes || [],
        currency_tax: item.currencyTax,
        llc_type: item.llc_type,
      }));

      let pkrData: any = { pkr_enabled: false, pkr_rate: 0, pkr_tax_rate: 0, pkr_amount: 0, pkr_tax_amount: 0, pkr_total: 0 };
      if (pkrEnabled && exchangeRate) {
        const rate = exchangeRate.rate;
        const taxRate = settings?.currency_conversion_tax ?? 10;
        const pkrAmount = total * rate;
        const taxableTotal = validItems.filter(i => i.currencyTax).reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
        const discountRatio = subtotal > 0 ? total / subtotal : 1;
        const taxableAfterDiscount = taxableTotal * discountRatio;
        const pkrTaxAmount = taxableAfterDiscount * rate * (taxRate / 100);
        const pkrTotal = pkrAmount + pkrTaxAmount;
        pkrData = { pkr_enabled: true, pkr_rate: rate, pkr_tax_rate: taxRate, pkr_amount: pkrAmount, pkr_tax_amount: pkrTaxAmount, pkr_total: pkrTotal };
      }

      const res = await apiRequest("POST", "/api/invoices", {
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.individual_name,
        company_name: selectedCustomer.company_name,
        customer_email: selectedCustomer.email,
        customer_phone: selectedCustomer.phone,
        subtotal,
        discount_amount: discCalc,
        discount_percentage: discountPercentage,
        discount_note: discountNote,
        total,
        notes,
        due_date: dueDate,
        items: invoiceItems,
        ...pkrData,
      });
      return res.json();
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Invoice created successfully" });

      setCreatedInvoiceId(data.id);
      setCreatedInvoiceNumber(data.invoice_number || `INV-${data.id}`);
      setSendInvoiceTab("whatsapp");
      setPortalLink(null);
      setSendInvoiceOpen(true);

      if (selectedCustomer) {
        const link = await generatePortalLink(
          selectedCustomer.id,
          selectedCustomer.individual_name,
          selectedCustomer.company_name,
        );
        const portalUrl = link ? getPortalUrl(link.token) : "";
        const defaultAccount = smtpAccounts.find(a => a.is_default) || smtpAccounts[0];
        setEmailSmtp(defaultAccount?.id || 0);
        setEmailSubject(`Invoice ${data.invoice_number || `INV-${data.id}`} - Infinity Filer`);
        setEmailBody(
          `Dear ${selectedCustomer.individual_name},\n\n` +
          `Please find your invoice ${data.invoice_number || `INV-${data.id}`} for $${total.toFixed(2)}.\n\n` +
          `You can view your invoice and all your orders through your customer portal:\n${portalUrl}\n\n` +
          `Best regards,\nInfinity Filer`
        );
      }
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSendWhatsApp = () => {
    if (!portalLink) return;
    const portalUrl = getPortalUrl(portalLink.token);
    let phone = "";
    let message = "";

    if (sendTarget === "partner" && referralPartner) {
      phone = referralPartner.phone?.replace(/[^0-9]/g, "") || "";
      message = encodeURIComponent(
        `Hi ${referralPartner.full_name},\n\n` +
        `A new invoice ${createdInvoiceNumber} for $${total.toFixed(2)} has been generated for your referred customer ${selectedCustomer?.individual_name || ""} (${selectedCustomer?.company_name || ""}).\n\n` +
        `Customer Portal:\n${portalUrl}\n\n` +
        `Thank you,\nInfinity Filer`
      );
    } else if (selectedCustomer) {
      phone = selectedCustomer.phone?.replace(/[^0-9]/g, "") || "";
      message = encodeURIComponent(
        `Hello ${selectedCustomer.individual_name},\n\n` +
        `Your invoice ${createdInvoiceNumber} for $${total.toFixed(2)} has been generated.\n\n` +
        `View your invoice and orders through your portal:\n${portalUrl}\n\n` +
        `Thank you,\nInfinity Filer`
      );
    }
    if (phone) window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
    navigate(`/invoices/${createdInvoiceId}`);
  };

  const handleSendEmail = async () => {
    if (!selectedCustomer || !emailSmtp) return;
    setSendingEmail(true);
    try {
      await apiRequest("POST", "/api/send-email", {
        smtp_account_id: emailSmtp,
        to_emails: [selectedCustomer.email],
        subject: emailSubject,
        body: emailBody,
      });
      toast({ title: "Email sent successfully" });
      navigate(`/invoices/${createdInvoiceId}`);
    } catch (e) {
      toast({ title: "Failed to send email", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSkipSend = () => {
    setSendInvoiceOpen(false);
    navigate(`/invoices/${createdInvoiceId}`);
  };

  const filteredServices = services.filter(s => {
    const q = serviceSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.state.toLowerCase().includes(q);
  });

  const filteredBundles = bundles.filter(b => {
    const q = serviceSearch.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/invoices"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold" data-testid="text-create-invoice">Create Invoice</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
            <CardContent>
              <Select
                value={selectedCustomer ? String(selectedCustomer.id) : undefined}
                onValueChange={(val) => {
                  const cust = customers.find(c => c.id === Number(val)) || null;
                  setSelectedCustomer(cust);
                  if (cust?.referral_partner_id) {
                    fetchPartnerRates(cust.referral_partner_id);
                  } else {
                    setPartnerRates([]);
                    setReferralPartner(null);
                  }
                }}
              >
                <SelectTrigger data-testid="select-customer">
                  <SelectValue placeholder="Select a customer" />
                </SelectTrigger>
                <SelectContent>
                  <div
                    className="flex items-center gap-2 px-2 py-2 text-sm font-medium text-primary cursor-pointer hover:bg-accent rounded-sm border-b mb-1"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setNewCustomerOpen(true);
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                    Add New Customer
                  </div>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.company_name} - {c.individual_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCustomer && (
                <div className="mt-4 p-3 rounded-md bg-accent/50 space-y-1">
                  <p className="text-sm font-medium">{selectedCustomer.company_name}</p>
                  <p className="text-sm">{selectedCustomer.individual_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedCustomer.email} | {selectedCustomer.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={newCustomerOpen} onOpenChange={(v) => { setNewCustomerOpen(v); if (!v) { setNewCustomerForm({ company_name: "", individual_name: "", email: "", phone: "", country: "", state_province: "", residential_address: "", referred_by: "", referral_partner_id: null, notes: "" }); setDocFiles([]); } }}>
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden" onInteractOutside={(e) => e.preventDefault()}>
              <DialogHeader><DialogTitle>Add New Customer</DialogTitle></DialogHeader>
              <div className="overflow-y-auto flex-1 space-y-4 -mr-2 pr-2">
                <CustomerFormFields form={newCustomerForm} onChange={setNewCustomerForm} testIdPrefix="new-customer" />

                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" />Verification Documents
                      <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                    </Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => docFileRef.current?.click()}
                      data-testid="button-add-doc-files"
                    >
                      <Plus className="h-3 w-3 mr-1" />Add Files
                    </Button>
                    <input ref={docFileRef} type="file" multiple className="hidden" onChange={handleDocFileSelect} />
                  </div>

                  {docFiles.length > 0 && (
                    <div className="space-y-2">
                      {docFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded border">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <Input
                            value={f.docName}
                            onChange={(e) => setDocFiles(prev => prev.map((df, idx) => idx === i ? { ...df, docName: e.target.value } : df))}
                            className="h-7 text-xs flex-1"
                            placeholder="Document name (e.g. Passport)"
                            data-testid={`input-doc-name-${i}`}
                          />
                          <span className="text-[10px] text-muted-foreground shrink-0">{(f.file.size / 1024).toFixed(0)} KB</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setDocFiles(prev => prev.filter((_, idx) => idx !== i))} data-testid={`button-remove-doc-${i}`}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">{docFiles.length} file(s) will be uploaded after customer is created</p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => newCustomerMutation.mutate(newCustomerForm)}
                  disabled={newCustomerMutation.isPending || !newCustomerForm.individual_name || !newCustomerForm.email || !newCustomerForm.phone}
                  className="w-full"
                  data-testid="button-save-new-customer"
                >
                  {newCustomerMutation.isPending ? "Saving..." : "Save & Select Customer"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Line Items</CardTitle>
                <Button size="sm" onClick={addItem} data-testid="button-add-item"><Plus className="h-4 w-4 mr-1" />Add Item</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="p-4 border rounded-md space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium text-muted-foreground">Item #{index + 1}</Label>
                      {item.fromBundle && <Badge variant="secondary" className="text-[10px]"><Package className="h-3 w-3 mr-1" />{item.fromBundle}</Badge>}
                    </div>
                    {items.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {!item.fromBundle && (
                    <div>
                      <Label className="text-xs">Select Service</Label>
                      <Select onValueChange={(val) => selectService(index, val)}>
                        <SelectTrigger data-testid={`select-service-${index}`}><SelectValue placeholder="Choose a service..." /></SelectTrigger>
                        <SelectContent>
                          {services.map(s => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name} - {s.category} {s.state ? `(${s.state})` : ""} - ${getServicePrice(s).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Description</Label>
                    <Input value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} data-testid={`input-item-desc-${index}`} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">State</Label>
                      <Input value={item.state} onChange={(e) => updateItem(index, "state", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Qty</Label>
                      <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(index, "quantity", Number(e.target.value))} />
                    </div>
                    <div>
                      <Label className="text-xs">Unit Price ($)</Label>
                      <Input type="number" min={0} step="0.01" value={item.unit_price} onChange={(e) => updateItem(index, "unit_price", Number(e.target.value))} data-testid={`input-item-price-${index}`} />
                      {item.partner_discount_label && item.original_price !== undefined && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-muted-foreground line-through">${item.original_price.toFixed(2)}</span>
                          <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 border-green-200" data-testid={`badge-partner-discount-${index}`}>
                            {item.partner_discount_label}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  {isLLCFormation(item, services) && (
                    <div>
                      <Label className="text-xs">LLC Type <span className="text-red-500">*</span></Label>
                      <Select value={item.llc_type || undefined} onValueChange={(val) => updateItem(index, "llc_type", val)}>
                        <SelectTrigger data-testid={`select-llc-type-${index}`} className={!item.llc_type ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select LLC type..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single-member">Single Member LLC</SelectItem>
                          <SelectItem value="multi-member">Multi-Member LLC</SelectItem>
                        </SelectContent>
                      </Select>
                      {!item.llc_type && <p className="text-[10px] text-red-500 mt-1">LLC type is required</p>}
                    </div>
                  )}
                  {item.llc_type && (
                    <Badge variant="outline" className="text-[10px] w-fit">
                      {item.llc_type === "single-member" ? "Single Member LLC" : "Multi-Member LLC"}
                    </Badge>
                  )}
                  {item.includes && item.includes.length > 0 && (
                    <div className="p-2 rounded bg-accent/50">
                      <Label className="text-xs text-muted-foreground">What's Included</Label>
                      <ul className="list-disc list-inside mt-1">
                        {item.includes.map((inc, i) => (
                          <li key={i} className="text-xs text-muted-foreground">{inc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    {pkrEnabled && item.unit_price > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer" data-testid={`label-currency-tax-${index}`}>
                        <input
                          type="checkbox"
                          checked={item.currencyTax}
                          onChange={(e) => updateItem(index, "currencyTax", e.target.checked)}
                          className="rounded border-gray-300"
                          data-testid={`checkbox-currency-tax-${index}`}
                        />
                        <span className="text-xs text-muted-foreground">Conv. Tax</span>
                      </label>
                    )}
                    <p className="text-sm font-medium text-right ml-auto">Line Total: ${(item.quantity * item.unit_price).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Add Services & Bundles</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-10" placeholder="Search..." value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} data-testid="input-service-search" />
              </div>
              <Tabs value={serviceTab} onValueChange={setServiceTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="services" className="flex-1" data-testid="tab-invoice-services">Services</TabsTrigger>
                  <TabsTrigger value="bundles" className="flex-1" data-testid="tab-invoice-bundles">Bundles ({bundles.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="services" className="mt-2">
                  <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
                    {filteredServices.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground text-center">No services found</p>
                    ) : filteredServices.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/50 cursor-pointer" onClick={() => {
                        const basePrice = getServicePrice(s);
                        const { price, original, label } = applyPartnerDiscount(basePrice, s.id);
                        const newItem: LineItem = {
                          description: `${s.name} - ${s.category}${s.state ? ` (${s.state})` : ""}`,
                          state: s.state,
                          quantity: 1,
                          unit_price: price,
                          service_id: s.id,
                          includes: s.includes || [],
                          currencyTax: true,
                          llc_type: "",
                          original_price: label ? original : undefined,
                          partner_discount_label: label || undefined,
                        };
                        const hasEmptyFirst = items.length === 1 && !items[0].description;
                        setItems(hasEmptyFirst ? [newItem] : [...items, newItem]);
                      }} data-testid={`quick-add-service-${s.id}`}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{s.name}</p>
                          <p className="text-[10px] text-muted-foreground">{s.category}{s.state ? ` - ${s.state}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs font-semibold">${getServicePrice(s).toFixed(2)}</span>
                          <Plus className="h-3 w-3 text-primary" />
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="bundles" className="mt-2">
                  <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
                    {filteredBundles.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground text-center">No bundles found</p>
                    ) : filteredBundles.map(b => (
                      <div key={b.id} className="px-3 py-3 hover:bg-accent/50 cursor-pointer" onClick={() => addBundle(b)} data-testid={`quick-add-bundle-${b.id}`}>
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-primary shrink-0" />
                              <p className="text-sm font-medium truncate">{b.name}</p>
                            </div>
                            {b.description && <p className="text-[10px] text-muted-foreground mt-0.5 ml-6">{b.description}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {Number(b.total_before_discount) > 0 && Number(b.total_before_discount) !== Number(b.total_after_discount) && (
                              <span className="text-[10px] text-muted-foreground line-through">${Number(b.total_before_discount).toFixed(2)}</span>
                            )}
                            <span className="text-xs font-semibold">${Number(b.total_after_discount).toFixed(2)}</span>
                            <Plus className="h-3 w-3 text-primary" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-6">
                          {b.discount_type === "percentage" && Number(b.discount_percentage) > 0 && <Badge variant="secondary" className="text-[10px]">{b.discount_percentage}% off</Badge>}
                          {b.discount_type === "fixed" && Number(b.discount_amount) > 0 && <Badge variant="secondary" className="text-[10px]">${Number(b.discount_amount).toFixed(2)} off</Badge>}
                          {b.discount_type === "per_service" && <Badge variant="secondary" className="text-[10px]">Per-service discounts</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Discount</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Discount %</Label>
                <Input type="number" min={0} max={100} value={discountPercentage} onChange={(e) => { setDiscountPercentage(Number(e.target.value)); setDiscountAmount(0); }} data-testid="input-discount-pct" />
              </div>
              <div>
                <Label className="text-xs">Or Fixed Discount ($)</Label>
                <Input type="number" min={0} value={discountAmount} onChange={(e) => { setDiscountAmount(Number(e.target.value)); setDiscountPercentage(0); }} data-testid="input-discount-amount" />
              </div>
              <div>
                <Label className="text-xs">Discount Note</Label>
                <Input value={discountNote} onChange={(e) => setDiscountNote(e.target.value)} placeholder="e.g. Loyal customer discount" data-testid="input-discount-note" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              {discCalc > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-${discCalc.toFixed(2)}</span></div>}
              <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total (USD)</span><span data-testid="text-invoice-total">${total.toFixed(2)}</span></div>

              <div className="border-t pt-3 mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium">Include PKR Conversion</Label>
                    <p className="text-[10px] text-muted-foreground">Convert to PKR with per-item tax option ({settings?.currency_conversion_tax ?? 10}%)</p>
                  </div>
                  <Switch checked={pkrEnabled} onCheckedChange={setPkrEnabled} data-testid="switch-pkr-enabled" />
                </div>
                {pkrEnabled && exchangeRate && total > 0 && (() => {
                  const rate = exchangeRate.rate;
                  const taxRate = settings?.currency_conversion_tax ?? 10;
                  const validItems = items.filter(i => i.description);
                  const pkrAmount = total * rate;
                  const taxableTotal = validItems.filter(i => i.currencyTax).reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
                  const discountRatio = subtotal > 0 ? total / subtotal : 1;
                  const taxableAfterDiscount = taxableTotal * discountRatio;
                  const pkrTaxAmount = taxableAfterDiscount * rate * (taxRate / 100);
                  const pkrTotal = pkrAmount + pkrTaxAmount;
                  const taxedCount = validItems.filter(i => i.currencyTax && i.unit_price > 0).length;
                  const totalCount = validItems.filter(i => i.unit_price > 0).length;
                  const fmtPkr = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  return (
                    <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">PKR Amount</span><span data-testid="text-create-pkr-amount">PKR {fmtPkr(pkrAmount)}</span></div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Conv. Tax ({taxRate}%) <span className="text-[10px]">({taxedCount}/{totalCount} items)</span></span>
                        <span data-testid="text-create-pkr-tax">PKR {fmtPkr(pkrTaxAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t border-emerald-300 dark:border-emerald-700 pt-1.5"><span className="text-emerald-800 dark:text-emerald-300">Total PKR</span><span className="text-emerald-800 dark:text-emerald-300" data-testid="text-create-pkr-total">PKR {fmtPkr(pkrTotal)}</span></div>
                      <p className="text-[10px] text-muted-foreground">Rate: 1 USD = {rate.toFixed(2)} PKR</p>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Additional</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Due Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="input-due-date" className={!dueDate ? "border-red-500" : ""} required />
                {!dueDate && <p className="text-[10px] text-red-500 mt-1">Due date is required</p>}
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <textarea className="w-full rounded-md border p-2 text-sm bg-background" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-invoice-notes" />
              </div>
              <Button
                className="w-full"
                onClick={handleCreateClick}
                disabled={createMutation.isPending || !selectedCustomer || items.every(i => !i.description) || !dueDate}
                data-testid="button-generate-invoice"
              >
                {createMutation.isPending ? "Creating..." : "Generate Invoice"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={pkrConfirmOpen} onOpenChange={setPkrConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Currency Conversion Not Enabled</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You have not enabled PKR currency conversion for this invoice. The invoice will be created in <span className="font-bold text-foreground">USD only</span> without any currency conversion tax applied.
            </p>
            <p className="text-sm text-muted-foreground">
              If this customer requires a PKR amount with the {settings?.currency_conversion_tax ?? 10}% conversion tax, please cancel and enable "Include PKR Conversion" in the Summary section before creating the invoice.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  setPkrConfirmOpen(false);
                  setPkrEnabled(true);
                }}
              >
                Enable PKR & Go Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  setPkrConfirmOpen(false);
                  createMutation.mutate();
                }}
              >
                Continue Without PKR
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sendInvoiceOpen} onOpenChange={(open) => { if (!open) handleSkipSend(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Invoice {createdInvoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-accent/50 space-y-1">
              <p className="text-sm font-medium" data-testid="text-send-invoice-customer">{selectedCustomer?.individual_name} - {selectedCustomer?.company_name}</p>
              <p className="text-xs text-muted-foreground">{selectedCustomer?.email} | {selectedCustomer?.phone}</p>
              <p className="text-sm font-semibold" data-testid="text-send-invoice-total">Total: ${total.toFixed(2)}</p>
              {referralPartner && (
                <p className="text-xs text-muted-foreground">Referred by: {referralPartner.full_name} ({referralPartner.phone})</p>
              )}
            </div>

            {referralPartner && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Send To</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={sendTarget === "customer" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSendTarget("customer")}
                    data-testid="button-send-target-customer"
                  >
                    Customer
                  </Button>
                  <Button
                    variant={sendTarget === "partner" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSendTarget("partner")}
                    data-testid="button-send-target-partner"
                  >
                    Partner ({referralPartner.full_name})
                  </Button>
                </div>
              </div>
            )}

            {portalLinkLoading ? (
              <div className="flex items-center gap-2 p-3 rounded-md border">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Generating portal link...</span>
              </div>
            ) : portalLink ? (
              <div className="p-3 rounded-md border space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Customer Portal Link</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={getPortalUrl(portalLink.token)}
                    className="text-xs flex-1"
                    data-testid="input-portal-link"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(getPortalUrl(portalLink.token))}
                    data-testid="button-copy-portal-link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => window.open(getPortalUrl(portalLink.token), "_blank")}
                    data-testid="button-open-portal-link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}

            <Tabs value={sendInvoiceTab} onValueChange={setSendInvoiceTab}>
              <TabsList className="w-full">
                <TabsTrigger value="whatsapp" className="flex-1 gap-1" data-testid="tab-send-whatsapp">
                  <MessageSquare className="h-4 w-4" />WhatsApp
                </TabsTrigger>
                <TabsTrigger value="email" className="flex-1 gap-1" data-testid="tab-send-email">
                  <Mail className="h-4 w-4" />Email
                </TabsTrigger>
              </TabsList>
              <TabsContent value="whatsapp" className="mt-3 space-y-3">
                <div className="p-3 rounded-md border space-y-2">
                  <Label className="text-xs text-muted-foreground">Message Preview {sendTarget === "partner" && referralPartner ? `(to ${referralPartner.full_name})` : `(to ${selectedCustomer?.individual_name || "customer"})`}</Label>
                  <p className="text-xs whitespace-pre-line" data-testid="text-whatsapp-preview">
                    {sendTarget === "partner" && referralPartner
                      ? `Hi ${referralPartner.full_name},\n\nA new invoice ${createdInvoiceNumber} for $${total.toFixed(2)} has been generated for your referred customer ${selectedCustomer?.individual_name || ""} (${selectedCustomer?.company_name || ""}).\n\nCustomer Portal:\n${portalLink ? getPortalUrl(portalLink.token) : "Loading..."}\n\nThank you,\nInfinity Filer`
                      : `Hello ${selectedCustomer?.individual_name || ""},\n\nYour invoice ${createdInvoiceNumber} for $${total.toFixed(2)} has been generated.\n\nView your invoice and orders through your portal:\n${portalLink ? getPortalUrl(portalLink.token) : "Loading..."}\n\nThank you,\nInfinity Filer`
                    }
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={handleSendWhatsApp}
                  disabled={!portalLink || portalLinkLoading}
                  data-testid="button-send-whatsapp"
                >
                  <SiWhatsapp className="h-4 w-4 mr-2" />Send via WhatsApp {sendTarget === "partner" ? "to Partner" : "to Customer"}
                </Button>
              </TabsContent>
              <TabsContent value="email" className="mt-3 space-y-3">
                <div>
                  <Label className="text-xs">SMTP Account</Label>
                  <Select value={emailSmtp ? String(emailSmtp) : undefined} onValueChange={(val) => setEmailSmtp(Number(val))}>
                    <SelectTrigger data-testid="select-smtp-account">
                      <SelectValue placeholder="Select SMTP account" />
                    </SelectTrigger>
                    <SelectContent>
                      {smtpAccounts.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Subject</Label>
                  <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} data-testid="input-email-subject" />
                </div>
                <div>
                  <Label className="text-xs">Body</Label>
                  <Textarea rows={6} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} data-testid="input-email-body" />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !emailSmtp || !emailSubject}
                  data-testid="button-send-email"
                >
                  <Send className="h-4 w-4 mr-2" />{sendingEmail ? "Sending..." : "Send Email"}
                </Button>
              </TabsContent>
            </Tabs>

            <Button
              variant="ghost"
              className="w-full"
              onClick={handleSkipSend}
              data-testid="button-skip-send"
            >
              Skip & View Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
