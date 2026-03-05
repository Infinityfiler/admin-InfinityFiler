import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authFetch } from "@/lib/auth";
import { Plus, Search, Trash2, ShieldCheck, FileText, X, UserCheck, UserPlus } from "lucide-react";
import type { Customer } from "@shared/schema";
import CustomerFormFields from "@/components/customer-form-fields";

interface DocFile {
  file: File;
  docName: string;
}

const emptyForm = { company_name: "", individual_name: "", email: "", phone: "", country: "", state_province: "", residential_address: "", referred_by: "", referral_partner_id: null as number | null, notes: "" };

export default function Customers() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [docFiles, setDocFiles] = useState<DocFile[]>([]);
  const docFileRef = useRef<HTMLInputElement>(null);

  const { data: customers = [], isLoading } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: orders = [] } = useQuery<any[]>({ queryKey: ["/api/orders"] });
  const { data: invoices = [] } = useQuery<any[]>({ queryKey: ["/api/invoices"] });

  const customerIdsWithActivity = useMemo(() => {
    const ids = new Set<number>();
    orders.forEach((o: any) => { if (o.customer_id) ids.add(o.customer_id); });
    invoices.forEach((i: any) => { if (i.customer_id) ids.add(i.customer_id); });
    return ids;
  }, [orders, invoices]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setOpen(false);
      setForm({ ...emptyForm });
      setDocFiles([]);
      toast({ title: "Customer created successfully" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/customers/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Customer deleted" });
    },
  });

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

  const filtered = customers.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    c.individual_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.referred_by.toLowerCase().includes(search.toLowerCase())
  );

  const activeCustomers = filtered.filter(c => customerIdsWithActivity.has(c.id));
  const leads = filtered.filter(c => !customerIdsWithActivity.has(c.id));

  const renderCustomerCard = (customer: Customer, isLead: boolean) => (
    <Card
      key={customer.id}
      className="hover-elevate cursor-pointer"
      onClick={() => navigate(`/customers/${customer.id}`)}
      data-testid={`card-customer-${customer.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm" data-testid={`text-customer-company-${customer.id}`}>{customer.company_name || customer.individual_name}</h3>
              {customer.referred_by && <Badge variant="secondary" className="text-xs">Ref: {customer.referred_by}</Badge>}
              {isLead && <Badge variant="destructive" className="text-xs">Lead</Badge>}
              {isLead && customer.source === "onboarding" && <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">Onboarding</Badge>}
            </div>
            {customer.company_name && <p className="text-sm text-muted-foreground">{customer.individual_name}</p>}
            <p className="text-xs text-muted-foreground">{customer.email} | {customer.phone}</p>
            {isLead && customer.interested_services && customer.interested_services.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {customer.interested_services.map((s, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{s}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => { e.stopPropagation(); if (confirm("Delete this customer?")) deleteMutation.mutate(customer.id); }}
              data-testid={`button-delete-customer-${customer.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-customers-title">Customers</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm({ ...emptyForm }); setDocFiles([]); } }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-customer"><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader><DialogTitle>Add New Customer</DialogTitle></DialogHeader>
            <div className="overflow-y-auto flex-1 space-y-4 -mr-2 pr-2">
              <CustomerFormFields form={form} onChange={setForm} testIdPrefix="customer" />

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
                        />
                        <span className="text-[10px] text-muted-foreground shrink-0">{(f.file.size / 1024).toFixed(0)} KB</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setDocFiles(prev => prev.filter((_, idx) => idx !== i))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">{docFiles.length} file(s) will be uploaded after customer is created</p>
                  </div>
                )}
              </div>

              <Button
                onClick={() => createMutation.mutate(form)}
                disabled={createMutation.isPending || !form.individual_name || !form.email || !form.phone}
                className="w-full"
                data-testid="button-save-customer"
              >
                {createMutation.isPending ? "Saving..." : "Save Customer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-10"
          placeholder="Search customers by name, email, phone, or referral..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-search-customers"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No customers found</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {leads.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-destructive" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide" data-testid="text-leads-section">
                  Leads
                </h2>
                <Badge variant="destructive" className="text-xs">{leads.length}</Badge>
              </div>
              <div className="grid gap-3">
                {leads.map(c => renderCustomerCard(c, true))}
              </div>
            </div>
          )}

          {activeCustomers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide" data-testid="text-active-customers-section">
                  Active Customers
                </h2>
                <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">{activeCustomers.length}</Badge>
              </div>
              <div className="grid gap-3">
                {activeCustomers.map(c => renderCustomerCard(c, false))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
