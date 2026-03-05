import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authFetch } from "@/lib/auth";
import { Plus, Trash2, Search, Upload, Download, Package, Pencil, X, CheckSquare } from "lucide-react";
import { US_STATES } from "@shared/schema";
import type { Service, BundlePackage } from "@shared/schema";

const DEFAULT_CATEGORIES = ["LLC Formation", "C-Corp Formation", "ITIN", "Taxation", "Trademark", "US Banking", "UK Ltd", "UK Trademark"];
const LEGACY_STATE_SPECIFIC_CATEGORIES = ["LLC Formation", "C-Corp Formation"];

type ServiceForm = {
  name: string; category: string; type: string; state: string;
  state_fee: number; agent_fee: number; unique_address: number; vyke_number: number;
  service_charges: number; annual_report_fee: number; annual_report_deadline: string;
  state_tax_rate: string; federal_tax: string; additional_requirements: string;
  annual_franchise_tax: number; federal_tax_reminder: string; notes: string; timeframe: string; includes: string[];
};

const emptyForm: ServiceForm = {
  name: "", category: "LLC Formation", type: "state_specific", state: "",
  state_fee: 0, agent_fee: 0, unique_address: 0, vyke_number: 0,
  service_charges: 0, annual_report_fee: 0, annual_report_deadline: "",
  state_tax_rate: "", federal_tax: "", additional_requirements: "",
  annual_franchise_tax: 0, federal_tax_reminder: "", notes: "", timeframe: "", includes: [],
};

function ServiceFormFields({
  form, setForm, newInclude, setNewInclude, isEdit, onSave, isPending, allCategories,
}: {
  form: ServiceForm;
  setForm: (f: ServiceForm) => void;
  newInclude: string;
  setNewInclude: (v: string) => void;
  isEdit?: boolean;
  onSave: () => void;
  isPending: boolean;
  allCategories: string[];
}) {
  const [catOpen, setCatOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const isStateSpecific = form.type === "state_specific";

  const categorySuggestions = allCategories.filter(c =>
    c.toLowerCase().includes(catSearch.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div>
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-service-name" />
      </div>
      <div className="relative">
        <Label>Category</Label>
        <Input
          value={catOpen ? catSearch : form.category}
          onChange={(e) => {
            setCatSearch(e.target.value);
            setForm({ ...form, category: e.target.value });
            if (!catOpen) setCatOpen(true);
          }}
          onFocus={() => {
            setCatOpen(true);
            setCatSearch(form.category);
          }}
          onBlur={() => {
            setTimeout(() => setCatOpen(false), 200);
          }}
          placeholder="Type or select a category..."
          data-testid="input-service-category"
        />
        {catOpen && categorySuggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto">
            {categorySuggestions.map(c => (
              <div
                key={c}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-accent ${c === form.category ? "bg-accent font-medium" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setForm({ ...form, category: c });
                  setCatSearch(c);
                  setCatOpen(false);
                }}
                data-testid={`category-option-${c}`}
              >
                {c}
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <Label>Service Type</Label>
        <Select value={form.type} onValueChange={(val) => setForm({ ...form, type: val })}>
          <SelectTrigger data-testid="select-service-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="state_specific">State Specific</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isStateSpecific ? (
        <>
          <div>
            <Label>State</Label>
            <Select value={form.state} onValueChange={(val) => setForm({ ...form, state: val })}>
              <SelectTrigger data-testid="select-service-state"><SelectValue placeholder="Select state" /></SelectTrigger>
              <SelectContent>{US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">State Fee</Label><Input type="number" value={form.state_fee} onChange={(e) => setForm({ ...form, state_fee: Number(e.target.value) })} data-testid="input-state-fee" /></div>
            <div><Label className="text-xs">Agent Fee</Label><Input type="number" value={form.agent_fee} onChange={(e) => setForm({ ...form, agent_fee: Number(e.target.value) })} data-testid="input-agent-fee" /></div>
            <div><Label className="text-xs">Unique Address</Label><Input type="number" value={form.unique_address} onChange={(e) => setForm({ ...form, unique_address: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Vyke Number</Label><Input type="number" value={form.vyke_number} onChange={(e) => setForm({ ...form, vyke_number: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Service Charges</Label><Input type="number" value={form.service_charges} onChange={(e) => setForm({ ...form, service_charges: Number(e.target.value) })} data-testid="input-service-charges" /></div>
            <div><Label className="text-xs">Annual Report Fee</Label><Input type="number" value={form.annual_report_fee} onChange={(e) => setForm({ ...form, annual_report_fee: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Annual Franchise Tax</Label><Input type="number" value={form.annual_franchise_tax} onChange={(e) => setForm({ ...form, annual_franchise_tax: Number(e.target.value) })} /></div>
            <div><Label className="text-xs">Annual Report Deadline</Label><Input value={form.annual_report_deadline} onChange={(e) => setForm({ ...form, annual_report_deadline: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">State Tax Rate</Label><Input value={form.state_tax_rate} onChange={(e) => setForm({ ...form, state_tax_rate: e.target.value })} /></div>
            <div><Label className="text-xs">Federal Tax</Label><Input value={form.federal_tax} onChange={(e) => setForm({ ...form, federal_tax: e.target.value })} /></div>
          </div>
          <div>
            <Label className="text-xs">Federal Tax Reminder</Label>
            <Input value={form.federal_tax_reminder} onChange={(e) => setForm({ ...form, federal_tax_reminder: e.target.value })} placeholder="e.g. April 15" />
          </div>
          <div><Label className="text-xs">Additional Requirements</Label><Input value={form.additional_requirements} onChange={(e) => setForm({ ...form, additional_requirements: e.target.value })} /></div>
        </>
      ) : (
        <>
          <div>
            <Label className="text-xs">Service Charges</Label>
            <Input type="number" value={form.service_charges} onChange={(e) => setForm({ ...form, service_charges: Number(e.target.value) })} data-testid="input-service-charges" />
          </div>
          <div>
            <Label className="text-xs">Timeframe</Label>
            <Input value={form.timeframe} onChange={(e) => setForm({ ...form, timeframe: e.target.value })} placeholder="e.g. 3-5 business days" data-testid="input-timeframe" />
          </div>
          <div>
            <Label className="text-xs">Requirements</Label>
            <Textarea value={form.additional_requirements} onChange={(e) => setForm({ ...form, additional_requirements: e.target.value })} placeholder="What the customer needs to provide..." rows={3} data-testid="input-requirements" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes about this service..." rows={3} data-testid="input-notes" />
          </div>
        </>
      )}

      <div>
        <Label className="text-xs">What's Included in Package</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            value={newInclude}
            onChange={(e) => setNewInclude(e.target.value)}
            placeholder="e.g. EIN Number, Operating Agreement..."
            onKeyDown={(e) => {
              if (e.key === "Enter" && newInclude.trim()) {
                e.preventDefault();
                setForm({ ...form, includes: [...form.includes, newInclude.trim()] });
                setNewInclude("");
              }
            }}
            data-testid="input-include-item"
          />
          <Button type="button" size="sm" variant="secondary" onClick={() => {
            if (newInclude.trim()) {
              setForm({ ...form, includes: [...form.includes, newInclude.trim()] });
              setNewInclude("");
            }
          }} data-testid="button-add-include">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {form.includes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {form.includes.map((inc, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-accent">
                {inc}
                <button onClick={() => setForm({ ...form, includes: form.includes.filter((_, idx) => idx !== i) })} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      <Button className="w-full" onClick={onSave} disabled={!form.name || isPending} data-testid={isEdit ? "button-save-edit" : "button-save-service"}>
        {isPending ? "Saving..." : isEdit ? "Update Service" : "Save Service"}
      </Button>
    </div>
  );
}

export default function Services() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [bundleOpen, setBundleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState<ServiceForm>({ ...emptyForm });
  const [newInclude, setNewInclude] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [bundleSearch, setBundleSearch] = useState("");
  const [editBundleOpen, setEditBundleOpen] = useState(false);
  const [editingBundleId, setEditingBundleId] = useState<number | null>(null);
  const [bundleForm, setBundleForm] = useState<{
    name: string; description: string; discount_type: string;
    discount_percentage: number; discount_amount: number;
    selectedServices: { id: number; name: string; category: string; state: string; price: number; item_discount: number }[];
  }>({ name: "", description: "", discount_type: "percentage", discount_percentage: 0, discount_amount: 0, selectedServices: [] });

  const { data: services = [], isLoading } = useQuery<Service[]>({ queryKey: ["/api/services"] });
  const { data: bundles = [] } = useQuery<BundlePackage[]>({ queryKey: ["/api/bundles"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/services", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setAddOpen(false);
      setForm({ ...emptyForm });
      toast({ title: "Service created" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      await apiRequest("PATCH", `/api/services/${editingId}`, form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setEditOpen(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      toast({ title: "Service updated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/services/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Service deleted" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await apiRequest("POST", "/api/services/bulk-delete", { ids });
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} services deleted` });
    },
    onError: (e) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const getServicePrice = (s: Service) => {
    if (s.type === "state_specific") {
      return Number(s.state_fee) + Number(s.agent_fee) + Number(s.unique_address) + Number(s.vyke_number) + Number(s.service_charges);
    }
    return Number(s.service_charges);
  };

  const bundleTotalBeforeDiscount = bundleForm.selectedServices.reduce((sum, s) => sum + s.price, 0);
  const bundleTotalDiscount = bundleForm.discount_type === "percentage"
    ? bundleTotalBeforeDiscount * (bundleForm.discount_percentage / 100)
    : bundleForm.discount_type === "fixed"
      ? bundleForm.discount_amount
      : bundleForm.selectedServices.reduce((sum, s) => sum + s.item_discount, 0);
  const bundleTotalAfterDiscount = bundleTotalBeforeDiscount - bundleTotalDiscount;

  const bundleMutation = useMutation({
    mutationFn: async () => {
      const items = bundleForm.selectedServices.map(s => ({
        service_id: s.id,
        service_name: s.name,
        service_category: s.category,
        service_state: s.state,
        service_price: s.price,
        item_discount: bundleForm.discount_type === "per_service" ? s.item_discount : 0,
      }));
      await apiRequest("POST", "/api/bundles", {
        name: bundleForm.name,
        description: bundleForm.description,
        discount_type: bundleForm.discount_type,
        discount_percentage: bundleForm.discount_type === "percentage" ? bundleForm.discount_percentage : 0,
        discount_amount: bundleForm.discount_type === "fixed" ? bundleForm.discount_amount : 0,
        total_before_discount: bundleTotalBeforeDiscount,
        total_after_discount: bundleTotalAfterDiscount,
        items,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bundles"] });
      setBundleOpen(false);
      setBundleForm({ name: "", description: "", discount_type: "percentage", discount_percentage: 0, discount_amount: 0, selectedServices: [] });
      setBundleSearch("");
      toast({ title: "Bundle created" });
    },
  });

  const updateBundleMutation = useMutation({
    mutationFn: async () => {
      if (!editingBundleId) return;
      const items = bundleForm.selectedServices.map(s => ({
        service_id: s.id,
        service_name: s.name,
        service_category: s.category,
        service_state: s.state,
        service_price: s.price,
        item_discount: bundleForm.discount_type === "per_service" ? s.item_discount : 0,
      }));
      await apiRequest("PATCH", `/api/bundles/${editingBundleId}`, {
        name: bundleForm.name,
        description: bundleForm.description,
        discount_type: bundleForm.discount_type,
        discount_percentage: bundleForm.discount_type === "percentage" ? bundleForm.discount_percentage : 0,
        discount_amount: bundleForm.discount_type === "fixed" ? bundleForm.discount_amount : 0,
        total_before_discount: bundleTotalBeforeDiscount,
        total_after_discount: bundleTotalAfterDiscount,
        items,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bundles"] });
      setEditBundleOpen(false);
      setEditingBundleId(null);
      resetBundleForm();
      toast({ title: "Bundle updated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteBundleMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/bundles/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bundles"] });
      toast({ title: "Bundle deleted" });
    },
  });

  const resetBundleForm = () => {
    setBundleForm({ name: "", description: "", discount_type: "percentage", discount_percentage: 0, discount_amount: 0, selectedServices: [] });
    setBundleSearch("");
  };

  const openEditBundle = async (bundle: BundlePackage) => {
    try {
      const res = await authFetch(`/api/bundles/${bundle.id}/items`);
      const bundleItems: BundleItem[] = await res.json();
      const selectedServices = bundleItems.map(bi => {
        const service = services.find(s => s.id === bi.service_id);
        const price = service ? getServicePrice(service) : Number(bi.service_price);
        return {
          id: bi.service_id,
          name: bi.service_name || service?.name || "Unknown",
          category: bi.service_category || service?.category || "",
          state: bi.service_state || service?.state || "",
          price,
          item_discount: Number(bi.item_discount) || 0,
        };
      });
      setBundleForm({
        name: bundle.name,
        description: bundle.description || "",
        discount_type: bundle.discount_type || "percentage",
        discount_percentage: Number(bundle.discount_percentage) || 0,
        discount_amount: Number(bundle.discount_amount) || 0,
        selectedServices,
      });
      setEditingBundleId(bundle.id);
      setEditBundleOpen(true);
    } catch (e) {
      toast({ title: "Error loading bundle", variant: "destructive" });
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws) as any[];

      const requiredCols = ["State", "State Fee", "Agent Fee", "Service Charges"];
      const firstRow = json[0];
      const hasRequired = requiredCols.every(col => col in firstRow);
      if (!hasRequired) {
        toast({ title: "Invalid template", description: "Please use the correct template with required columns.", variant: "destructive" });
        return;
      }

      const servicesData = json.map(row => {
        const includesRaw = row["What's Included"] || row["Whats Included"] || "";
        const includesArr = typeof includesRaw === "string" && includesRaw.trim()
          ? includesRaw.split("|").map((s: string) => s.trim()).filter(Boolean)
          : [];
        const rowCategory = row["Category"] || "LLC Formation";
        const rowType = row["Type"] || row["Service Type"] || (LEGACY_STATE_SPECIFIC_CATEGORIES.includes(rowCategory) ? "state_specific" : "general");
        return {
          name: row["Service Name"] || "LLC Formation",
          category: rowCategory,
          type: rowType,
          state: row["State"] || "",
          state_fee: Number(row["State Fee"]) || 0,
          agent_fee: Number(row["Agent Fee"]) || 0,
          unique_address: Number(row["Unique Address"]) || 0,
          vyke_number: Number(row["Vyke Number"]) || 0,
          service_charges: Number(row["Service Charges"]) || 0,
          annual_report_fee: Number(row["Annual Report Fee"]) || 0,
          annual_report_deadline: row["Annual Report Deadline"] || "",
          state_tax_rate: row["State Tax Rate"] || "",
          federal_tax: row["Federal Tax"] || "",
          additional_requirements: row["Additional Requirements"] || "",
          warnings: [],
          includes: includesArr,
          high_alert: false,
          recommended: false,
          tax_free: false,
          annual_franchise_tax: Number(row["Annual Franchise Tax"]) || 0,
          notes: row["Notes"] || "",
          timeframe: row["Timeframe"] || "",
          is_active: true,
        };
      });

      await apiRequest("POST", "/api/services/bulk", { services: servicesData });
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: `${servicesData.length} services uploaded successfully` });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const templateData = [
      { "Service Name": "LLC Formation", "Category": "LLC Formation", "Type": "state_specific", "State": "Wyoming", "State Fee": 104, "Agent Fee": 25, "Unique Address": 49, "Vyke Number": 20, "Service Charges": 50, "Annual Report Fee": 60, "Annual Report Deadline": "Anniversary month", "State Tax Rate": "0%", "Federal Tax": "Pass-through", "Additional Requirements": "", "Annual Franchise Tax": 0, "What's Included": "EIN Number | Operating Agreement | Registered Agent (1 Year) | Company Formation | Unique Address | Vyke Phone Number" }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Services");
    XLSX.writeFile(wb, "services_template.xlsx");
  };

  const exportServices = async () => {
    const XLSX = await import("xlsx");
    const exportData = services.map(s => ({
      "Service Name": s.name,
      "Category": s.category,
      "Type": s.type || "state_specific",
      "State": s.state,
      "State Fee": Number(s.state_fee),
      "Agent Fee": Number(s.agent_fee),
      "Unique Address": Number(s.unique_address),
      "Vyke Number": Number(s.vyke_number),
      "Service Charges": Number(s.service_charges),
      "Annual Report Fee": Number(s.annual_report_fee),
      "Annual Report Deadline": s.annual_report_deadline,
      "State Tax Rate": s.state_tax_rate,
      "Federal Tax": s.federal_tax,
      "Additional Requirements": s.additional_requirements,
      "Annual Franchise Tax": Number(s.annual_franchise_tax),
      "Notes": s.notes || "",
      "Timeframe": s.timeframe || "",
      "What's Included": (s.includes || []).join(" | "),
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Services");
    XLSX.writeFile(wb, "infinity_filer_services.xlsx");
    toast({ title: `${exportData.length} services exported` });
  };

  const filtered = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.state.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || s.category === categoryFilter;
    const matchesState = stateFilter === "all" || s.state === stateFilter;
    return matchesSearch && matchesCategory && matchesState;
  });

  const filteredIds = filtered.map(s => s.id);
  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selectedIds.has(s.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedIds);
      filteredIds.forEach(id => next.delete(id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filteredIds.forEach(id => next.add(id));
      setSelectedIds(next);
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const openEdit = (service: Service) => {
    setEditingId(service.id);
    setForm({
      name: service.name,
      category: service.category,
      type: service.type || "state_specific",
      state: service.state,
      state_fee: Number(service.state_fee),
      agent_fee: Number(service.agent_fee),
      unique_address: Number(service.unique_address),
      vyke_number: Number(service.vyke_number),
      service_charges: Number(service.service_charges),
      annual_report_fee: Number(service.annual_report_fee),
      annual_report_deadline: service.annual_report_deadline,
      state_tax_rate: service.state_tax_rate,
      federal_tax: service.federal_tax,
      additional_requirements: service.additional_requirements,
      annual_franchise_tax: Number(service.annual_franchise_tax),
      federal_tax_reminder: service.federal_tax_reminder || "",
      notes: service.notes || "",
      timeframe: service.timeframe || "",
      includes: service.includes || [],
    });
    setEditOpen(true);
  };

  const categories = [...new Set([...DEFAULT_CATEGORIES, ...services.map(s => s.category)])].filter(Boolean);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-services-title">Services</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" onClick={exportServices} data-testid="button-export-services">
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
          <Button variant="secondary" onClick={downloadTemplate} data-testid="button-download-template">
            <Download className="h-4 w-4 mr-2" />Template
          </Button>
          <label>
            <Button variant="secondary" asChild>
              <span><Upload className="h-4 w-4 mr-2" />Bulk Upload</span>
            </Button>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkUpload} data-testid="input-bulk-upload" />
          </label>
          <Dialog open={bundleOpen} onOpenChange={(open) => { setBundleOpen(open); if (!open) resetBundleForm(); }}>
            <DialogTrigger asChild><Button variant="secondary" data-testid="button-create-bundle"><Package className="h-4 w-4 mr-2" />Bundle</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Bundle Package</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Bundle Name</Label><Input value={bundleForm.name} onChange={(e) => setBundleForm({ ...bundleForm, name: e.target.value })} data-testid="input-bundle-name" /></div>
                  <div><Label>Description</Label><Input value={bundleForm.description} onChange={(e) => setBundleForm({ ...bundleForm, description: e.target.value })} data-testid="input-bundle-desc" /></div>
                </div>

                <div>
                  <Label>Search & Add Services</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10" placeholder="Search by name, category, or state..." value={bundleSearch} onChange={(e) => setBundleSearch(e.target.value)} data-testid="input-bundle-search" />
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-md mt-2 divide-y">
                    {services
                      .filter(s => {
                        const q = bundleSearch.toLowerCase();
                        return (s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.state.toLowerCase().includes(q)) &&
                          !bundleForm.selectedServices.some(sel => sel.id === s.id);
                      })
                      .map(s => {
                        const price = getServicePrice(s);
                        return (
                          <div key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/50 cursor-pointer" onClick={() => {
                            setBundleForm({ ...bundleForm, selectedServices: [...bundleForm.selectedServices, { id: s.id, name: s.name, category: s.category, state: s.state, price, item_discount: 0 }] });
                          }} data-testid={`bundle-add-service-${s.id}`}>
                            <div>
                              <span className="text-sm font-medium">{s.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{s.category}{s.state ? ` - ${s.state}` : ""}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">${price.toFixed(2)}</span>
                              <Plus className="h-4 w-4 text-primary" />
                            </div>
                          </div>
                        );
                      })}
                    {services.filter(s => {
                      const q = bundleSearch.toLowerCase();
                      return (s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.state.toLowerCase().includes(q)) &&
                        !bundleForm.selectedServices.some(sel => sel.id === s.id);
                    }).length === 0 && <p className="p-3 text-xs text-muted-foreground text-center">No matching services</p>}
                  </div>
                </div>

                {bundleForm.selectedServices.length > 0 && (
                  <div>
                    <Label>Selected Services ({bundleForm.selectedServices.length})</Label>
                    <div className="border rounded-md mt-1 divide-y">
                      {bundleForm.selectedServices.map((sel, idx) => (
                        <div key={sel.id} className="flex items-center justify-between px-3 py-2 gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{sel.name}</p>
                            <p className="text-xs text-muted-foreground">{sel.category}{sel.state ? ` - ${sel.state}` : ""}</p>
                          </div>
                          <span className="text-sm font-semibold shrink-0">${sel.price.toFixed(2)}</span>
                          {bundleForm.discount_type === "per_service" && (
                            <div className="w-24 shrink-0">
                              <Input type="number" min={0} placeholder="Disc $" value={sel.item_discount || ""} onChange={(e) => {
                                const updated = [...bundleForm.selectedServices];
                                updated[idx] = { ...updated[idx], item_discount: Number(e.target.value) };
                                setBundleForm({ ...bundleForm, selectedServices: updated });
                              }} className="h-8 text-xs" />
                            </div>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => {
                            setBundleForm({ ...bundleForm, selectedServices: bundleForm.selectedServices.filter(s => s.id !== sel.id) });
                          }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label>Discount Type</Label>
                  <Select value={bundleForm.discount_type} onValueChange={(val) => setBundleForm({ ...bundleForm, discount_type: val, discount_percentage: 0, discount_amount: 0, selectedServices: bundleForm.selectedServices.map(s => ({ ...s, item_discount: 0 })) })}>
                    <SelectTrigger data-testid="select-discount-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage on Total Package</SelectItem>
                      <SelectItem value="fixed">Fixed Amount on Total Package</SelectItem>
                      <SelectItem value="per_service">Discount per Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {bundleForm.discount_type === "percentage" && (
                  <div>
                    <Label className="text-xs">Discount Percentage (%)</Label>
                    <Input type="number" min={0} max={100} value={bundleForm.discount_percentage} onChange={(e) => setBundleForm({ ...bundleForm, discount_percentage: Number(e.target.value) })} data-testid="input-bundle-discount-pct" />
                  </div>
                )}

                {bundleForm.discount_type === "fixed" && (
                  <div>
                    <Label className="text-xs">Discount Amount ($)</Label>
                    <Input type="number" min={0} value={bundleForm.discount_amount} onChange={(e) => setBundleForm({ ...bundleForm, discount_amount: Number(e.target.value) })} data-testid="input-bundle-discount-amt" />
                  </div>
                )}

                {bundleForm.discount_type === "per_service" && (
                  <p className="text-xs text-muted-foreground">Enter discount amount for each service in the list above.</p>
                )}

                {bundleForm.selectedServices.length > 0 && (
                  <div className="p-3 rounded-md bg-accent/50 space-y-1">
                    <div className="flex justify-between text-sm"><span>Subtotal</span><span>${bundleTotalBeforeDiscount.toFixed(2)}</span></div>
                    {bundleTotalDiscount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-${bundleTotalDiscount.toFixed(2)}</span></div>}
                    <div className="flex justify-between text-base font-bold border-t pt-1"><span>Bundle Price</span><span data-testid="text-bundle-total">${bundleTotalAfterDiscount.toFixed(2)}</span></div>
                  </div>
                )}

                <Button className="w-full" onClick={() => bundleMutation.mutate()} disabled={!bundleForm.name || bundleForm.selectedServices.length === 0 || bundleMutation.isPending} data-testid="button-save-bundle">
                  {bundleMutation.isPending ? "Creating..." : "Create Bundle"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={editBundleOpen} onOpenChange={(open) => { setEditBundleOpen(open); if (!open) { setEditingBundleId(null); resetBundleForm(); } }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Edit Bundle Package</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Bundle Name</Label><Input value={bundleForm.name} onChange={(e) => setBundleForm({ ...bundleForm, name: e.target.value })} data-testid="input-edit-bundle-name" /></div>
                  <div><Label>Description</Label><Input value={bundleForm.description} onChange={(e) => setBundleForm({ ...bundleForm, description: e.target.value })} data-testid="input-edit-bundle-desc" /></div>
                </div>

                <div>
                  <Label>Search & Add Services</Label>
                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-10" placeholder="Search by name, category, or state..." value={bundleSearch} onChange={(e) => setBundleSearch(e.target.value)} data-testid="input-edit-bundle-search" />
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-md mt-2 divide-y">
                    {services
                      .filter(s => {
                        const q = bundleSearch.toLowerCase();
                        return (s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.state.toLowerCase().includes(q)) &&
                          !bundleForm.selectedServices.some(sel => sel.id === s.id);
                      })
                      .map(s => {
                        const price = getServicePrice(s);
                        return (
                          <div key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/50 cursor-pointer" onClick={() => {
                            setBundleForm({ ...bundleForm, selectedServices: [...bundleForm.selectedServices, { id: s.id, name: s.name, category: s.category, state: s.state, price, item_discount: 0 }] });
                          }}>
                            <div>
                              <span className="text-sm font-medium">{s.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">{s.category}{s.state ? ` - ${s.state}` : ""}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">${price.toFixed(2)}</span>
                              <Plus className="h-4 w-4 text-primary" />
                            </div>
                          </div>
                        );
                      })}
                    {services.filter(s => {
                      const q = bundleSearch.toLowerCase();
                      return (s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || s.state.toLowerCase().includes(q)) &&
                        !bundleForm.selectedServices.some(sel => sel.id === s.id);
                    }).length === 0 && <p className="p-3 text-xs text-muted-foreground text-center">No matching services</p>}
                  </div>
                </div>

                {bundleForm.selectedServices.length > 0 && (
                  <div>
                    <Label>Selected Services ({bundleForm.selectedServices.length})</Label>
                    <div className="border rounded-md mt-1 divide-y">
                      {bundleForm.selectedServices.map((sel, idx) => (
                        <div key={sel.id} className="flex items-center justify-between px-3 py-2 gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{sel.name}</p>
                            <p className="text-xs text-muted-foreground">{sel.category}{sel.state ? ` - ${sel.state}` : ""}</p>
                          </div>
                          <span className="text-sm font-semibold shrink-0">${sel.price.toFixed(2)}</span>
                          {bundleForm.discount_type === "per_service" && (
                            <div className="w-24 shrink-0">
                              <Input type="number" min={0} placeholder="Disc $" value={sel.item_discount || ""} onChange={(e) => {
                                const updated = [...bundleForm.selectedServices];
                                updated[idx] = { ...updated[idx], item_discount: Number(e.target.value) };
                                setBundleForm({ ...bundleForm, selectedServices: updated });
                              }} className="h-8 text-xs" />
                            </div>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => {
                            setBundleForm({ ...bundleForm, selectedServices: bundleForm.selectedServices.filter(s => s.id !== sel.id) });
                          }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label>Discount Type</Label>
                  <Select value={bundleForm.discount_type} onValueChange={(val) => setBundleForm({ ...bundleForm, discount_type: val, discount_percentage: 0, discount_amount: 0, selectedServices: bundleForm.selectedServices.map(s => ({ ...s, item_discount: 0 })) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage on Total Package</SelectItem>
                      <SelectItem value="fixed">Fixed Amount on Total Package</SelectItem>
                      <SelectItem value="per_service">Discount per Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {bundleForm.discount_type === "percentage" && (
                  <div>
                    <Label className="text-xs">Discount Percentage (%)</Label>
                    <Input type="number" min={0} max={100} value={bundleForm.discount_percentage} onChange={(e) => setBundleForm({ ...bundleForm, discount_percentage: Number(e.target.value) })} />
                  </div>
                )}
                {bundleForm.discount_type === "fixed" && (
                  <div>
                    <Label className="text-xs">Discount Amount ($)</Label>
                    <Input type="number" min={0} value={bundleForm.discount_amount} onChange={(e) => setBundleForm({ ...bundleForm, discount_amount: Number(e.target.value) })} />
                  </div>
                )}
                {bundleForm.discount_type === "per_service" && (
                  <p className="text-xs text-muted-foreground">Enter discount amount for each service in the list above.</p>
                )}

                {bundleForm.selectedServices.length > 0 && (
                  <div className="p-3 rounded-md bg-accent/50 space-y-1">
                    <div className="flex justify-between text-sm"><span>Subtotal</span><span>${bundleTotalBeforeDiscount.toFixed(2)}</span></div>
                    {bundleTotalDiscount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Discount</span><span>-${bundleTotalDiscount.toFixed(2)}</span></div>}
                    <div className="flex justify-between text-base font-bold border-t pt-1"><span>Bundle Price</span><span>${bundleTotalAfterDiscount.toFixed(2)}</span></div>
                  </div>
                )}

                <Button className="w-full" onClick={() => updateBundleMutation.mutate()} disabled={!bundleForm.name || bundleForm.selectedServices.length === 0 || updateBundleMutation.isPending} data-testid="button-update-bundle">
                  {updateBundleMutation.isPending ? "Saving..." : "Update Bundle"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { setForm({ ...emptyForm }); setNewInclude(""); } }}>
            <DialogTrigger asChild><Button data-testid="button-add-service"><Plus className="h-4 w-4 mr-2" />Add Service</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
              <ServiceFormFields
                form={form}
                setForm={setForm}
                newInclude={newInclude}
                setNewInclude={setNewInclude}
                onSave={() => createMutation.mutate()}
                isPending={createMutation.isPending}
                allCategories={categories}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) { setEditingId(null); setForm({ ...emptyForm }); setNewInclude(""); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Service</DialogTitle></DialogHeader>
          <ServiceFormFields
            form={form}
            setForm={setForm}
            newInclude={newInclude}
            setNewInclude={setNewInclude}
            isEdit
            onSave={() => updateMutation.mutate()}
            isPending={updateMutation.isPending}
            allCategories={categories}
          />
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services" data-testid="tab-services">Services ({services.length})</TabsTrigger>
          <TabsTrigger value="bundles" data-testid="tab-bundles">Bundles ({bundles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-10" placeholder="Search services..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-services" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {someSelected && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50 border" data-testid="bulk-action-bar">
              <CheckSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())} data-testid="button-clear-selection">
                  <X className="h-3 w-3 mr-1" />Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => { if (confirm(`Delete ${selectedIds.size} selected services?`)) bulkDeleteMutation.mutate(Array.from(selectedIds)); }}
                  disabled={bulkDeleteMutation.isPending}
                  data-testid="button-delete-selected"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedIds.size}`}
                </Button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No services found</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              <div className="flex items-center gap-3 px-4 py-2">
                <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} data-testid="checkbox-select-all" />
                <span className="text-xs text-muted-foreground">
                  {allFilteredSelected ? `All ${filtered.length} shown selected` : `Select all ${filtered.length} shown`}
                </span>
              </div>
              {filtered.map((service) => {
                const isStateSpecific = service.type === "state_specific";
                const totalPkg = isStateSpecific
                  ? Number(service.state_fee) + Number(service.agent_fee) + Number(service.unique_address) + Number(service.vyke_number) + Number(service.service_charges)
                  : Number(service.service_charges);
                const isSelected = selectedIds.has(service.id);
                return (
                  <Card key={service.id} className={`hover-elevate transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(service.id)} className="mt-1" data-testid={`checkbox-service-${service.id}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm">{service.name}</h3>
                            <Badge variant="secondary">{service.category}</Badge>
                            <Badge variant="outline" data-testid={`badge-type-${service.id}`}>{isStateSpecific ? "State Specific" : "General"}</Badge>
                            {service.state && <Badge variant="secondary">{service.state}</Badge>}
                            {service.high_alert && <Badge variant="destructive">High Alert</Badge>}
                            {service.recommended && <Badge>Recommended</Badge>}
                            {service.tax_free && <Badge variant="secondary">Tax Free</Badge>}
                          </div>
                          {isStateSpecific ? (
                            <div className="flex items-center gap-4 mt-1 flex-wrap">
                              <span className="text-xs text-muted-foreground">State: ${Number(service.state_fee).toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">Agent: ${Number(service.agent_fee).toFixed(2)}</span>
                              <span className="text-xs text-muted-foreground">Service: ${Number(service.service_charges).toFixed(2)}</span>
                              <span className="text-sm font-semibold">Total: ${totalPkg.toFixed(2)}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-4 mt-1 flex-wrap">
                              <span className="text-sm font-semibold">Price: ${totalPkg.toFixed(2)}</span>
                              {service.timeframe && <span className="text-xs text-muted-foreground">Timeframe: {service.timeframe}</span>}
                            </div>
                          )}
                          {isStateSpecific && service.annual_report_deadline && (
                            <p className="text-xs text-muted-foreground mt-1">Annual Report: {service.annual_report_deadline} | Fee: ${Number(service.annual_report_fee).toFixed(2)}</p>
                          )}
                          {service.includes && service.includes.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="text-xs font-medium text-muted-foreground">Includes:</span>
                              {service.includes.map((inc, i) => (
                                <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-accent">{inc}</span>
                              ))}
                            </div>
                          )}
                          {!isStateSpecific && service.additional_requirements && (
                            <p className="text-xs text-muted-foreground mt-1">Requirements: {service.additional_requirements}</p>
                          )}
                          {!isStateSpecific && service.notes && (
                            <p className="text-xs text-muted-foreground mt-0.5">Notes: {service.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(service)} data-testid={`button-edit-service-${service.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this service?")) deleteMutation.mutate(service.id); }} data-testid={`button-delete-service-${service.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bundles" className="space-y-4">
          {bundles.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No bundles created yet</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {bundles.map(bundle => (
                <Card key={bundle.id} className="hover-elevate" data-testid={`card-bundle-${bundle.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{bundle.name}</h3>
                          {bundle.discount_type === "percentage" && Number(bundle.discount_percentage) > 0 && <Badge variant="secondary">{bundle.discount_percentage}% off</Badge>}
                          {bundle.discount_type === "fixed" && Number(bundle.discount_amount) > 0 && <Badge variant="secondary">${Number(bundle.discount_amount).toFixed(2)} off</Badge>}
                          {bundle.discount_type === "per_service" && <Badge variant="secondary">Per-service discount</Badge>}
                        </div>
                        {bundle.description && <p className="text-xs text-muted-foreground mt-1">{bundle.description}</p>}
                        <div className="flex items-center gap-4 mt-1">
                          {Number(bundle.total_before_discount) > 0 && Number(bundle.total_before_discount) !== Number(bundle.total_after_discount) && (
                            <span className="text-xs text-muted-foreground line-through">${Number(bundle.total_before_discount).toFixed(2)}</span>
                          )}
                          <span className="text-sm font-semibold">${Number(bundle.total_after_discount).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => openEditBundle(bundle)} data-testid={`button-edit-bundle-${bundle.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this bundle?")) deleteBundleMutation.mutate(bundle.id); }} data-testid={`button-delete-bundle-${bundle.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
