import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authFetch } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowLeft, Package, Search, UserPlus, Save } from "lucide-react";
import type { Customer, Service, BundlePackage, BundleItem, Invoice, InvoiceItem, CompanySettings } from "@shared/schema";
import CustomerFormFields from "@/components/customer-form-fields";

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
}

function isLLCFormation(item: LineItem, services: Service[]): boolean {
  if (item.service_id) {
    const service = services.find(s => s.id === item.service_id);
    if (service) return service.category === "LLC Formation";
  }
  return item.description.toLowerCase().includes("llc formation");
}

export default function EditInvoice() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/invoices/:id/edit");
  const id = Number(params?.id);

  const { data: invoice, isLoading: invoiceLoading } = useQuery<Invoice>({ queryKey: [`/api/invoices/${id}`], enabled: !!id });
  const { data: existingItems = [], isLoading: itemsLoading } = useQuery<InvoiceItem[]>({ queryKey: [`/api/invoices/${id}/items`], enabled: !!id });
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });
  const { data: bundles = [] } = useQuery<BundlePackage[]>({ queryKey: ["/api/bundles"] });
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/settings"] });
  const { data: exchangeRate } = useQuery<{ rate: number; lastUpdated: string }>({ queryKey: ["/api/exchange-rate"] });

  const [initialized, setInitialized] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountNote, setDiscountNote] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceTab, setServiceTab] = useState("services");
  const [pkrEnabled, setPkrEnabled] = useState(false);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    company_name: "", individual_name: "", email: "", phone: "",
    country: "", state_province: "", residential_address: "", referred_by: "", referral_partner_id: null as number | null, notes: "",
  });

  useEffect(() => {
    if (initialized || !invoice || itemsLoading || customers.length === 0) return;

    const customer = customers.find(c => c.id === invoice.customer_id) || null;
    setSelectedCustomer(customer);
    setDiscountPercentage(Number(invoice.discount_percentage) || 0);
    setDiscountAmount(Number(invoice.discount_percentage) > 0 ? 0 : Number(invoice.discount_amount) || 0);
    setDiscountNote(invoice.discount_note || "");
    setNotes(invoice.notes || "");
    setDueDate(invoice.due_date || "");
    setPkrEnabled(invoice.pkr_enabled || false);

    if (existingItems.length > 0) {
      setItems(existingItems.map(item => ({
        description: item.description,
        state: item.state || "",
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        service_id: item.service_id,
        includes: item.includes || [],
        currencyTax: item.currency_tax ?? true,
        llc_type: item.llc_type || "",
      })));
    } else {
      setItems([{ description: "", state: "", quantity: 1, unit_price: 0, service_id: null, includes: [], currencyTax: true, llc_type: "" }]);
    }

    setInitialized(true);
  }, [invoice, existingItems, customers, itemsLoading, initialized]);

  const newCustomerMutation = useMutation({
    mutationFn: async (data: typeof newCustomerForm) => {
      const res = await apiRequest("POST", "/api/customers", data);
      return res.json();
    },
    onSuccess: (data: Customer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setSelectedCustomer(data);
      setNewCustomerOpen(false);
      setNewCustomerForm({ company_name: "", individual_name: "", email: "", phone: "", country: "", state_province: "", residential_address: "", referred_by: "", referral_partner_id: null, notes: "" });
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
      const updated = [...items];
      updated[index] = {
        description: `${service.name} - ${service.category}${service.state ? ` (${service.state})` : ""}`,
        state: service.state,
        quantity: 1,
        unit_price: totalPrice,
        service_id: service.id,
        includes: service.includes || [],
        currencyTax: true,
        llc_type: "",
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
      return {
        description: `${bi.service_name || service?.name || "Service"} - ${bi.service_category || service?.category || ""}${(bi.service_state || service?.state) ? ` (${bi.service_state || service?.state})` : ""}`,
        state: bi.service_state || service?.state || "",
        quantity: 1,
        unit_price: itemPrice,
        service_id: bi.service_id,
        includes: service?.includes || [],
        fromBundle: bundle.name,
        currencyTax: true,
        llc_type: "",
      };
    });

    if (bundle.discount_type === "percentage" && Number(bundle.discount_percentage) > 0) {
      const bundleSubtotal = newItems.reduce((sum, i) => sum + i.unit_price, 0);
      const discAmt = bundleSubtotal * (Number(bundle.discount_percentage) / 100);
      newItems.push({
        description: `${bundle.name} - Bundle Discount (${bundle.discount_percentage}%)`,
        state: "", quantity: 1, unit_price: -discAmt, service_id: null, includes: [], fromBundle: bundle.name, currencyTax: false, llc_type: "",
      });
    } else if (bundle.discount_type === "fixed" && Number(bundle.discount_amount) > 0) {
      newItems.push({
        description: `${bundle.name} - Bundle Discount`,
        state: "", quantity: 1, unit_price: -Number(bundle.discount_amount), service_id: null, includes: [], fromBundle: bundle.name, currencyTax: false, llc_type: "",
      });
    }

    const hasEmptyFirst = items.length === 1 && !items[0].description;
    setItems(hasEmptyFirst ? newItems : [...items, ...newItems]);
    toast({ title: `Bundle "${bundle.name}" added with ${bundleItems.length} services` });
  };

  const [pkrConfirmOpen, setPkrConfirmOpen] = useState(false);

  const handleSaveClick = () => {
    const validItems = items.filter(i => i.description);
    const llcItems = validItems.filter(i => isLLCFormation(i, services));
    const missingLlcType = llcItems.filter(i => !i.llc_type);
    if (missingLlcType.length > 0) {
      toast({
        title: "LLC Type Required",
        description: "Please select Single Member or Multi-Member for all LLC Formation services before saving.",
        variant: "destructive",
      });
      return;
    }
    if (!pkrEnabled) {
      setPkrConfirmOpen(true);
      return;
    }
    saveMutation.mutate();
  };

  const saveMutation = useMutation({
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

      const res = await apiRequest("PATCH", `/api/invoices/${id}`, {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/items`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Invoice updated successfully" });
      navigate(`/invoices/${id}`);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filteredServices = services.filter(s => {
    const q = serviceSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.state.toLowerCase().includes(q);
  });

  const filteredBundles = bundles.filter(b => {
    const q = serviceSearch.toLowerCase();
    return b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q);
  });

  if (invoiceLoading || itemsLoading) return <div className="p-6"><Skeleton className="h-64" /></div>;
  if (!invoice) return <div className="p-6">Invoice not found</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/invoices/${id}`}><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-bold">Edit Invoice</h1>
          <Badge variant="secondary">{invoice.invoice_number}</Badge>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !selectedCustomer || !dueDate}>
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
            <CardContent>
              <Select
                value={selectedCustomer ? String(selectedCustomer.id) : undefined}
                onValueChange={(val) => setSelectedCustomer(customers.find(c => c.id === Number(val)) || null)}
              >
                <SelectTrigger>
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

          <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
              <DialogHeader><DialogTitle>Add New Customer</DialogTitle></DialogHeader>
              <div className="overflow-y-auto flex-1 space-y-4 -mr-2 pr-2">
                <CustomerFormFields form={newCustomerForm} onChange={setNewCustomerForm} testIdPrefix="edit-new-customer" />
                <Button
                  onClick={() => newCustomerMutation.mutate(newCustomerForm)}
                  disabled={newCustomerMutation.isPending || !newCustomerForm.individual_name || !newCustomerForm.email || !newCustomerForm.phone}
                  className="w-full"
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
                <Button size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" />Add Item</Button>
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
                        <SelectTrigger><SelectValue placeholder="Choose a service..." /></SelectTrigger>
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
                    <Input value={item.description} onChange={(e) => updateItem(index, "description", e.target.value)} />
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
                      <Input type="number" min={0} step="0.01" value={item.unit_price} onChange={(e) => updateItem(index, "unit_price", Number(e.target.value))} />
                    </div>
                  </div>
                  {isLLCFormation(item, services) && (
                    <div>
                      <Label className="text-xs">LLC Type <span className="text-red-500">*</span></Label>
                      <Select value={item.llc_type || undefined} onValueChange={(val) => updateItem(index, "llc_type", val)}>
                        <SelectTrigger className={!item.llc_type ? "border-red-500" : ""}>
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
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.currencyTax}
                          onChange={(e) => updateItem(index, "currencyTax", e.target.checked)}
                          className="rounded border-gray-300"
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
                <Input className="pl-10" placeholder="Search..." value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} />
              </div>
              <Tabs value={serviceTab} onValueChange={setServiceTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="services" className="flex-1">Services</TabsTrigger>
                  <TabsTrigger value="bundles" className="flex-1">Bundles ({bundles.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="services" className="mt-2">
                  <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
                    {filteredServices.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground text-center">No services found</p>
                    ) : filteredServices.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/50 cursor-pointer" onClick={() => {
                        const price = getServicePrice(s);
                        const newItem: LineItem = {
                          description: `${s.name} - ${s.category}${s.state ? ` (${s.state})` : ""}`,
                          state: s.state,
                          quantity: 1,
                          unit_price: price,
                          service_id: s.id,
                          includes: s.includes || [],
                          currencyTax: true,
                          llc_type: "",
                        };
                        const hasEmptyFirst = items.length === 1 && !items[0].description;
                        setItems(hasEmptyFirst ? [newItem] : [...items, newItem]);
                      }}>
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
                      <div key={b.id} className="px-3 py-3 hover:bg-accent/50 cursor-pointer" onClick={() => addBundle(b)}>
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
                <Input type="number" min={0} max={100} value={discountPercentage} onChange={(e) => { setDiscountPercentage(Number(e.target.value)); setDiscountAmount(0); }} />
              </div>
              <div>
                <Label className="text-xs">Or Fixed Discount ($)</Label>
                <Input type="number" min={0} value={discountAmount} onChange={(e) => { setDiscountAmount(Number(e.target.value)); setDiscountPercentage(0); }} />
              </div>
              <div>
                <Label className="text-xs">Discount Note</Label>
                <Input value={discountNote} onChange={(e) => setDiscountNote(e.target.value)} placeholder="e.g. Loyal customer discount" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Due Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={!dueDate ? "border-red-500" : ""} required />
                {!dueDate && <p className="text-[10px] text-red-500 mt-1">Due date is required</p>}
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <textarea
                  className="w-full rounded-md border p-2 text-sm bg-background"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
              {discCalc > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-${discCalc.toFixed(2)}</span></div>}
              <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total (USD)</span><span>${total.toFixed(2)}</span></div>

              <div className="border-t pt-3 mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium">Include PKR Conversion</Label>
                    <p className="text-[10px] text-muted-foreground">Convert to PKR with per-item tax option ({settings?.currency_conversion_tax ?? 10}%)</p>
                  </div>
                  <Switch checked={pkrEnabled} onCheckedChange={setPkrEnabled} />
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
                  const fmtPkr = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  return (
                    <div className="p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-1.5">
                      <div className="flex justify-between text-xs"><span>PKR Amount</span><span>PKR {fmtPkr(pkrAmount)}</span></div>
                      <div className="flex justify-between text-xs"><span>Conv. Tax ({taxRate}%)</span><span>PKR {fmtPkr(pkrTaxAmount)}</span></div>
                      <div className="flex justify-between text-sm font-bold border-t border-emerald-300 pt-1.5"><span>Total PKR</span><span>PKR {fmtPkr(pkrTotal)}</span></div>
                      <p className="text-[10px] text-muted-foreground">Rate: 1 USD = {rate.toFixed(2)} PKR</p>
                    </div>
                  );
                })()}
              </div>

              <Button
                className="w-full mt-4"
                onClick={handleSaveClick}
                disabled={saveMutation.isPending || !selectedCustomer || !dueDate}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : "Save Changes"}
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
              You have not enabled PKR currency conversion for this invoice. The invoice will be saved in <span className="font-bold text-foreground">USD only</span> without any currency conversion tax applied.
            </p>
            <p className="text-sm text-muted-foreground">
              If this customer requires a PKR amount with the {settings?.currency_conversion_tax ?? 10}% conversion tax, please cancel and enable "Include PKR Conversion" in the Summary section.
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
                  saveMutation.mutate();
                }}
              >
                Continue Without PKR
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
