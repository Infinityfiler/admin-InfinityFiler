import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authFetch } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Trash2, Edit, Copy, Users, ShoppingCart, Eye, Settings2, FileText } from "lucide-react";
import type { ReferralPartner, Customer, Order, PartnerServiceRate, Service } from "@shared/schema";

type PartnerFormData = {
  username: string;
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  type: string;
  notes: string;
  is_active: boolean;
  hide_invoices: boolean;
};

const emptyForm: PartnerFormData = {
  username: "",
  full_name: "",
  email: "",
  phone: "",
  company_name: "",
  type: "individual",
  notes: "",
  is_active: true,
  hide_invoices: false,
};

function PartnerForm({ form, setForm, onSubmit, submitLabel, isPending, isEditing = false }: {
  form: PartnerFormData;
  setForm: (f: PartnerFormData) => void;
  onSubmit: () => void;
  submitLabel: string;
  isPending: boolean;
  isEditing?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Username {isEditing ? "(locked)" : "*"}</Label>
          <Input
            value={form.username}
            onChange={(e) => !isEditing && setForm({ ...form, username: e.target.value.replace(/\s/g, "").toLowerCase() })}
            placeholder="unique_username"
            data-testid="input-partner-username"
            disabled={isEditing}
            className={isEditing ? "bg-muted cursor-not-allowed" : ""}
          />
          <p className="text-xs text-muted-foreground mt-1">{isEditing ? "Auto-generated, cannot be changed" : "Must be unique, no spaces"}</p>
        </div>
        <div>
          <Label>Full Name *</Label>
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Full name"
            data-testid="input-partner-full_name"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email address"
            data-testid="input-partner-email"
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone number"
            data-testid="input-partner-phone"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Company Name</Label>
          <Input
            value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            placeholder="Company (optional)"
            data-testid="input-partner-company"
          />
        </div>
        <div>
          <Label>Type</Label>
          <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
            <SelectTrigger data-testid="select-partner-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="agency">Agency</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="affiliate">Affiliate</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="rounded"
            data-testid="input-partner-active"
          />
          <span className="text-sm">Active</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.hide_invoices}
            onChange={(e) => setForm({ ...form, hide_invoices: e.target.checked })}
            className="rounded"
            data-testid="input-partner-hide-invoices"
          />
          <span className="text-sm">Hide Payments/Invoices from Customer Portal</span>
        </label>
      </div>
      <div>
        <Label>Notes</Label>
        <textarea
          className="w-full rounded-md border p-2 text-sm bg-background"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          data-testid="input-partner-notes"
        />
      </div>
      <Button onClick={onSubmit} disabled={isPending} className="w-full" data-testid="button-partner-submit">
        {isPending ? "Saving..." : submitLabel}
      </Button>
    </div>
  );
}

const emptyRateForm = {
  service_id: 0,
  service_name: "",
  discount_type: "fixed",
  discount_value: 0,
  notes: "",
};

export default function Partners() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<ReferralPartner | null>(null);
  const [addRateOpen, setAddRateOpen] = useState(false);
  const [rateForm, setRateForm] = useState({ ...emptyRateForm });

  const { data: partners = [], isLoading } = useQuery<ReferralPartner[]>({ queryKey: ["/api/referral-partners"] });

  const { data: partnerCustomers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/referral-partners", selectedPartner?.id, "customers"],
    queryFn: async () => {
      if (!selectedPartner) return [];
      const res = await authFetch(`/api/referral-partners/${selectedPartner.id}/customers`);
      return res.json();
    },
    enabled: !!selectedPartner,
  });

  const { data: partnerOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/referral-partners", selectedPartner?.id, "orders"],
    queryFn: async () => {
      if (!selectedPartner) return [];
      const res = await authFetch(`/api/referral-partners/${selectedPartner.id}/orders`);
      return res.json();
    },
    enabled: !!selectedPartner,
  });

  const { data: serviceRates = [], isLoading: ratesLoading } = useQuery<PartnerServiceRate[]>({
    queryKey: ["/api/referral-partners", selectedPartner?.id, "service-rates"],
    queryFn: async () => {
      if (!selectedPartner) return [];
      const res = await authFetch(`/api/referral-partners/${selectedPartner.id}/service-rates`);
      return res.json();
    },
    enabled: !!selectedPartner,
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    enabled: !!selectedPartner,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/referral-partners", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-partners"] });
      setCreateOpen(false);
      setForm({ ...emptyForm });
      toast({ title: "Referral partner created successfully" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof form }) => {
      const res = await apiRequest("PATCH", `/api/referral-partners/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-partners"] });
      setEditOpen(false);
      setEditId(null);
      setForm({ ...emptyForm });
      toast({ title: "Referral partner updated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/referral-partners/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-partners"] });
      toast({ title: "Referral partner deleted" });
    },
  });

  const addRateMutation = useMutation({
    mutationFn: async (data: typeof rateForm & { partner_id: number }) => {
      const res = await apiRequest("POST", `/api/referral-partners/${data.partner_id}/service-rates`, data);
      return res.json();
    },
    onSuccess: () => {
      if (selectedPartner) {
        queryClient.invalidateQueries({ queryKey: ["/api/referral-partners", selectedPartner.id, "service-rates"] });
      }
      setAddRateOpen(false);
      setRateForm({ ...emptyRateForm });
      toast({ title: "Service rate added successfully" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRateMutation = useMutation({
    mutationFn: async (rateId: number) => {
      await apiRequest("DELETE", `/api/partner-service-rates/${rateId}`);
    },
    onSuccess: () => {
      if (selectedPartner) {
        queryClient.invalidateQueries({ queryKey: ["/api/referral-partners", selectedPartner.id, "service-rates"] });
      }
      toast({ title: "Service rate deleted" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleEdit = (partner: ReferralPartner) => {
    setEditId(partner.id);
    setForm({
      username: partner.username,
      full_name: partner.full_name,
      email: partner.email,
      phone: partner.phone,
      company_name: partner.company_name,
      type: partner.type,
      notes: partner.notes,
      is_active: partner.is_active,
      hide_invoices: partner.hide_invoices ?? false,
    });
    setEditOpen(true);
  };

  const handleViewDetail = (partner: ReferralPartner) => {
    setSelectedPartner(partner);
    setDetailOpen(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Referral code copied!" });
  };

  const handleAddRate = () => {
    if (!selectedPartner || !rateForm.service_id) {
      toast({ title: "Please select a service", variant: "destructive" });
      return;
    }
    const service = services.find(s => s.id === rateForm.service_id);
    addRateMutation.mutate({
      ...rateForm,
      partner_id: selectedPartner.id,
      service_name: service?.name || rateForm.service_name,
    });
  };

  const filtered = partners.filter(p => {
    const s = search.toLowerCase();
    const matchesSearch = !s ||
      p.full_name.toLowerCase().includes(s) ||
      p.username.toLowerCase().includes(s) ||
      p.referral_code.toLowerCase().includes(s) ||
      p.email.toLowerCase().includes(s) ||
      p.company_name.toLowerCase().includes(s);
    const matchesType = typeFilter === "all" || p.type === typeFilter;
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && p.is_active) ||
      (statusFilter === "inactive" && !p.is_active);
    return matchesSearch && matchesType && matchesStatus;
  });

  const partnerTypes = [...new Set(partners.map(p => p.type).filter(Boolean))];

  const totalReferrals = partners.length;
  const activePartners = partners.filter(p => p.is_active).length;

  const formatRateValue = (type: string, value: number) => {
    return type === "percentage" ? `${value}%` : `$${value.toFixed(2)}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Partners</h1>
          <p className="text-sm text-muted-foreground">Manage referral partners and track referrals</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-partner" onClick={() => setForm({ ...emptyForm })}>
              <Plus className="h-4 w-4 mr-2" /> Add Partner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Referral Partner</DialogTitle>
            </DialogHeader>
            <PartnerForm
              form={form}
              setForm={setForm}
              onSubmit={() => createMutation.mutate(form)}
              submitLabel="Create Partner"
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold" data-testid="text-total-partners">{totalReferrals}</div>
            <p className="text-xs text-muted-foreground">Total Partners</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600" data-testid="text-active-partners">{activePartners}</div>
            <p className="text-xs text-muted-foreground">Active Partners</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600" data-testid="text-partner-types">{partnerTypes.length}</div>
            <p className="text-xs text-muted-foreground">Partner Types</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, username, code, or email..."
            className="pl-9"
            data-testid="input-search-partners"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
            <SelectItem value="agency">Agency</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="affiliate">Affiliate</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-24" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {partners.length === 0 ? "No referral partners yet. Add your first partner to get started." : "No partners match your search."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(partner => (
            <Card key={partner.id} className="hover:shadow-md transition-shadow" data-testid={`card-partner-${partner.id}`}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-base truncate" data-testid={`text-partner-name-${partner.id}`}>{partner.full_name}</h3>
                    <p className="text-xs text-muted-foreground" data-testid={`text-partner-username-${partner.id}`}>@{partner.username}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={partner.is_active ? "default" : "secondary"} className="text-[10px]">
                      {partner.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge variant="outline" className="text-xs font-mono cursor-pointer" onClick={() => copyCode(partner.referral_code)} data-testid={`badge-code-${partner.id}`}>
                    {partner.referral_code}
                    <Copy className="h-3 w-3 ml-1" />
                  </Badge>
                  <Badge variant="secondary" className="text-xs capitalize">{partner.type}</Badge>
                  {partner.hide_invoices && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50" data-testid={`badge-hide-invoices-${partner.id}`}>
                      Invoices Hidden
                    </Badge>
                  )}
                </div>

                {partner.email && <p className="text-xs text-muted-foreground truncate mb-1">{partner.email}</p>}
                {partner.company_name && <p className="text-xs text-muted-foreground truncate mb-1">{partner.company_name}</p>}
                <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                  <Button variant="ghost" size="sm" onClick={() => handleViewDetail(partner)} data-testid={`button-view-partner-${partner.id}`}>
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(partner)} data-testid={`button-edit-partner-${partner.id}`}>
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                    if (confirm("Delete this referral partner?")) deleteMutation.mutate(partner.id);
                  }} data-testid={`button-delete-partner-${partner.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Referral Partner</DialogTitle>
          </DialogHeader>
          <PartnerForm
            form={form}
            setForm={setForm}
            onSubmit={() => editId && updateMutation.mutate({ id: editId, data: form })}
            submitLabel="Save Changes"
            isPending={updateMutation.isPending}
            isEditing={true}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Partner Details</DialogTitle>
          </DialogHeader>
          {selectedPartner && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Full Name</p>
                  <p className="font-medium" data-testid="text-detail-name">{selectedPartner.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="font-medium" data-testid="text-detail-username">@{selectedPartner.username}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Referral Code</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono cursor-pointer" onClick={() => copyCode(selectedPartner.referral_code)} data-testid="badge-detail-code">
                      {selectedPartner.referral_code}
                      <Copy className="h-3 w-3 ml-1" />
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge variant="secondary" className="capitalize">{selectedPartner.type}</Badge>
                </div>
                {selectedPartner.email && (
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm">{selectedPartner.email}</p>
                  </div>
                )}
                {selectedPartner.phone && (
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm">{selectedPartner.phone}</p>
                  </div>
                )}
                {selectedPartner.company_name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="text-sm">{selectedPartner.company_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={selectedPartner.is_active ? "default" : "secondary"}>
                    {selectedPartner.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">{new Date(selectedPartner.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedPartner.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm bg-muted p-3 rounded-md">{selectedPartner.notes}</p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Settings2 className="h-4 w-4" /> B2B Service Rates ({serviceRates.length})
                  </h3>
                  <Button size="sm" onClick={() => { setRateForm({ ...emptyRateForm }); setAddRateOpen(true); }} data-testid="button-add-service-rate">
                    <Plus className="h-4 w-4 mr-1" /> Add Rate
                  </Button>
                </div>
                {ratesLoading ? (
                  <Skeleton className="h-20" />
                ) : serviceRates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No service rates configured yet.</p>
                ) : (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Service</TableHead>
                          <TableHead>Discount</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {serviceRates.map(rate => (
                          <TableRow key={rate.id} data-testid={`row-service-rate-${rate.id}`}>
                            <TableCell className="font-medium text-sm" data-testid={`text-rate-service-${rate.id}`}>{rate.service_name}</TableCell>
                            <TableCell className="text-sm" data-testid={`text-rate-discount-${rate.id}`}>
                              <Badge variant="outline" className="text-xs">
                                {formatRateValue(rate.discount_type, rate.discount_value)} {rate.discount_type === "percentage" ? "off" : "off"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm("Delete this service rate?")) deleteRateMutation.mutate(rate.id);
                                }}
                                data-testid={`button-delete-rate-${rate.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <Dialog open={addRateOpen} onOpenChange={setAddRateOpen}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Service Rate</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Service *</Label>
                        <Select
                          value={rateForm.service_id ? String(rateForm.service_id) : ""}
                          onValueChange={(v) => {
                            const svc = services.find(s => s.id === Number(v));
                            setRateForm({ ...rateForm, service_id: Number(v), service_name: svc?.name || "" });
                          }}
                        >
                          <SelectTrigger data-testid="select-rate-service">
                            <SelectValue placeholder="Select a service" />
                          </SelectTrigger>
                          <SelectContent>
                            {services.map(s => (
                              <SelectItem key={s.id} value={String(s.id)}>{s.name} {s.state ? `(${s.state})` : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Discount Type</Label>
                          <Select value={rateForm.discount_type} onValueChange={(v) => setRateForm({ ...rateForm, discount_type: v })}>
                            <SelectTrigger data-testid="select-rate-discount-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixed ($)</SelectItem>
                              <SelectItem value="percentage">Percentage (%)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Discount Value</Label>
                          <Input
                            type="number"
                            value={rateForm.discount_value}
                            onChange={(e) => setRateForm({ ...rateForm, discount_value: Number(e.target.value) })}
                            placeholder="0"
                            data-testid="input-rate-discount-value"
                          />
                        </div>
                      </div>
                      <Button onClick={handleAddRate} disabled={addRateMutation.isPending} className="w-full" data-testid="button-submit-rate">
                        {addRateMutation.isPending ? "Adding..." : "Add Service Rate"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4" /> Referred Customers ({partnerCustomers.length})
                </h3>
                {selectedPartner.hide_invoices && partnerCustomers.length > 0 && (
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Invoices are hidden for this partner. Toggle access per customer below.
                  </p>
                )}
                {partnerCustomers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No customers referred yet.</p>
                ) : (
                  <div className="space-y-2">
                    {partnerCustomers.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm gap-2" data-testid={`row-referred-customer-${c.id}`}>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{c.individual_name}</span>
                          {c.company_name && <span className="text-muted-foreground ml-2">({c.company_name})</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {selectedPartner.hide_invoices && (
                            <div className="flex items-center gap-1.5" data-testid={`toggle-invoice-access-${c.id}`}>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {c.allow_invoice_access ? "Invoices Visible" : "Invoices Hidden"}
                              </span>
                              <Switch
                                checked={c.allow_invoice_access === true}
                                onCheckedChange={async (checked) => {
                                  try {
                                    await apiRequest("PATCH", `/api/customers/${c.id}/invoice-access`, { allow_invoice_access: checked });
                                    queryClient.invalidateQueries({ queryKey: ["/api/referral-partners", selectedPartner.id, "customers"] });
                                    toast({ title: checked ? "Invoice access granted" : "Invoice access revoked" });
                                  } catch (e) {
                                    toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
                                  }
                                }}
                              />
                            </div>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => { setDetailOpen(false); navigate(`/customers/${c.id}`); }}>
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-3">
                  <ShoppingCart className="h-4 w-4" /> Referred Orders ({partnerOrders.length})
                </h3>
                {partnerOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders from referrals yet.</p>
                ) : (
                  <div className="space-y-2">
                    {partnerOrders.map(o => (
                      <div key={o.id} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm" data-testid={`row-referred-order-${o.id}`}>
                        <div>
                          <span className="font-medium">{o.order_number}</span>
                          <span className="text-muted-foreground ml-2">{o.customer_name}</span>
                          <Badge variant="outline" className="ml-2 text-xs">{o.status}</Badge>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { setDetailOpen(false); navigate(`/orders/${o.id}`); }}>
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
