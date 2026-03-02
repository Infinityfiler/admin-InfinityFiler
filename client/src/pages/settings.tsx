import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Save, Building2, CreditCard, Cloud, CloudOff, Link2, Unlink, Percent,
  Plus, Pencil, Trash2, ExternalLink, Landmark, GripVertical
} from "lucide-react";
import type { CompanySettings, PaymentMethod } from "@shared/schema";

const EMPTY_METHOD: Partial<PaymentMethod> = {
  type: "bank_account",
  label: "",
  bank_name: "",
  account_holder: "",
  account_number: "",
  iban: "",
  currency: "USD",
  link_url: "",
  details: {},
  is_enabled: true,
};

export default function GeneralSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<CompanySettings>({ queryKey: ["/api/settings"] });
  const { data: dropboxStatus, refetch: refetchDropbox } = useQuery<{
    connected: boolean;
    account: { name: string; email: string } | null;
  }>({ queryKey: ["/api/dropbox/status"] });
  const { data: paymentMethods = [], refetch: refetchMethods } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
  });

  const [form, setForm] = useState({
    company_name: "Infinity Filer",
    address: "",
    phone: "",
    whatsapp: "",
    support_email: "",
    bank_name: "Meezan Bank",
    account_holder: "Infinity Filer",
    account_number: "",
    iban: "PK45MEZN0000300108188443",
    logo_url: "",
    currency_conversion_tax: 10,
  });

  const [methodDialogOpen, setMethodDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<Partial<PaymentMethod> | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [customFields, setCustomFields] = useState<{ key: string; value: string }[]>([]);

  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name || "Infinity Filer",
        address: settings.address || "",
        phone: settings.phone || "",
        whatsapp: settings.whatsapp || "",
        support_email: settings.support_email || "",
        bank_name: settings.bank_name || "Meezan Bank",
        account_holder: settings.account_holder || "Infinity Filer",
        account_number: settings.account_number || "",
        iban: settings.iban || "PK45MEZN0000300108188443",
        logo_url: settings.logo_url || "",
        currency_conversion_tax: settings.currency_conversion_tax ?? 10,
      });
    }
  }, [settings]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data === "dropbox-connected") {
        refetchDropbox();
        toast({ title: "Dropbox connected successfully!" });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refetchDropbox, toast]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/settings", form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved successfully" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createMethodMutation = useMutation({
    mutationFn: async (data: Partial<PaymentMethod>) => {
      await apiRequest("POST", "/api/payment-methods", data);
    },
    onSuccess: () => {
      refetchMethods();
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      setMethodDialogOpen(false);
      toast({ title: "Payment method added" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMethodMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PaymentMethod> }) => {
      await apiRequest("PATCH", `/api/payment-methods/${id}`, data);
    },
    onSuccess: () => {
      refetchMethods();
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      setMethodDialogOpen(false);
      toast({ title: "Payment method updated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMethodMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/payment-methods/${id}`);
    },
    onSuccess: () => {
      refetchMethods();
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
      toast({ title: "Payment method deleted" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleMethodMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: number; is_enabled: boolean }) => {
      await apiRequest("PATCH", `/api/payment-methods/${id}`, { is_enabled });
    },
    onSuccess: () => {
      refetchMethods();
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods"] });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const connectDropbox = async () => {
    try {
      const res = await fetch("/api/dropbox/auth-url");
      const { url } = await res.json();
      window.open(url, "dropbox-auth", "width=600,height=700");
    } catch {
      toast({ title: "Failed to start Dropbox authorization", variant: "destructive" });
    }
  };

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/dropbox/disconnect");
    },
    onSuccess: () => {
      refetchDropbox();
      toast({ title: "Dropbox disconnected" });
    },
    onError: (e) => toast({ title: "Error", description: (e as Error).message, variant: "destructive" }),
  });

  const openAddMethod = () => {
    setEditingMethod({ ...EMPTY_METHOD });
    setEditingId(null);
    setCustomFields([]);
    setMethodDialogOpen(true);
  };

  const openEditMethod = (method: PaymentMethod) => {
    setEditingMethod({ ...method });
    setEditingId(method.id);
    const details = method.details || {};
    setCustomFields(Object.entries(details).map(([key, value]) => ({ key, value })));
    setMethodDialogOpen(true);
  };

  const saveMethod = () => {
    if (!editingMethod) return;
    const details: Record<string, string> = {};
    customFields.forEach(f => { if (f.key.trim()) details[f.key.trim()] = f.value; });
    const payload = { ...editingMethod, details };
    if (editingId) {
      updateMethodMutation.mutate({ id: editingId, data: payload });
    } else {
      createMethodMutation.mutate(payload);
    }
  };

  if (isLoading) return <div className="p-6 space-y-6"><h1 className="text-2xl font-bold">Settings</h1><Skeleton className="h-64" /></div>;

  const enabledMethods = paymentMethods.filter(m => m.is_enabled);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-settings-title">General Settings</h1>
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-settings">
          <Save className="h-4 w-4 mr-2" />
          {updateMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5" />Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Company Name</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} data-testid="input-company-name" /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} data-testid="input-company-address" /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-company-phone" /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} data-testid="input-company-whatsapp" /></div>
            <div><Label>Support Email</Label><Input type="email" value={form.support_email} onChange={(e) => setForm({ ...form, support_email: e.target.value })} data-testid="input-company-email" /></div>
            <div><Label>Logo URL</Label><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." data-testid="input-company-logo" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Percent className="h-5 w-5" />Currency & Tax</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Currency Conversion Tax (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.currency_conversion_tax}
                onChange={(e) => setForm({ ...form, currency_conversion_tax: Number(e.target.value) })}
                data-testid="input-currency-tax"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pakistani bank conversion fee charged when converting USD to PKR. This rate is applied on top of the converted PKR amount on invoices.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            Legacy Bank Details (for older invoices)
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            These details are shown on invoices created before multi-payment methods were added. Click "Save Settings" to update.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label className="text-xs">Bank Name</Label><Input className="h-8 text-sm" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
            <div><Label className="text-xs">Account Holder</Label><Input className="h-8 text-sm" value={form.account_holder} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} /></div>
            <div><Label className="text-xs">Account Number</Label><Input className="h-8 text-sm" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
            <div><Label className="text-xs">IBAN</Label><Input className="h-8 text-sm" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Methods
            </CardTitle>
            <Button size="sm" onClick={openAddMethod}>
              <Plus className="h-4 w-4 mr-2" />
              Add Method
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Add multiple payment methods (bank accounts or payment links). Only enabled methods will appear on new invoices. Once an invoice is generated, its payment methods are frozen.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {paymentMethods.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Landmark className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No payment methods configured yet.</p>
              <p className="text-xs">Click "Add Method" to add a bank account or payment link.</p>
            </div>
          )}
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                method.is_enabled
                  ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 opacity-60"
              }`}
            >
              <div className="pt-1">
                <GripVertical className="h-4 w-4 text-muted-foreground/40" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {method.type === "payment_link" ? (
                    <ExternalLink className="h-4 w-4 text-blue-500" />
                  ) : (
                    <Landmark className="h-4 w-4 text-emerald-600" />
                  )}
                  <span className="font-medium text-sm">{method.label || method.bank_name || "Untitled"}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {method.type === "payment_link" ? "Payment Link" : "Bank Account"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {method.currency || "USD"}
                  </Badge>
                  {!method.is_enabled && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700">
                      Disabled
                    </Badge>
                  )}
                </div>
                {method.type === "bank_account" && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {method.bank_name && <p>Bank: {method.bank_name}</p>}
                    {method.account_holder && <p>Holder: {method.account_holder}</p>}
                    {method.account_number && <p>Account #: {method.account_number}</p>}
                    {method.iban && <p>IBAN: {method.iban}</p>}
                    {method.details && Object.entries(method.details).map(([k, v]) => (
                      <p key={k}>{k}: {v}</p>
                    ))}
                  </div>
                )}
                {method.type === "payment_link" && method.link_url && (
                  <p className="text-xs text-blue-500 truncate">{method.link_url}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={method.is_enabled}
                  onCheckedChange={(checked) => toggleMethodMutation.mutate({ id: method.id, is_enabled: checked })}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditMethod(method)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-700"
                  onClick={() => { if (confirm("Delete this payment method?")) deleteMethodMutation.mutate(method.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              {dropboxStatus?.connected ? <Cloud className="h-5 w-5 text-blue-500" /> : <CloudOff className="h-5 w-5" />}
              Dropbox Storage
            </CardTitle>
            {dropboxStatus?.connected ? (
              <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Connected</Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {dropboxStatus?.connected ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <Cloud className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{dropboxStatus.account?.name || "Dropbox Account"}</p>
                    <p className="text-xs text-muted-foreground">{dropboxStatus.account?.email || ""}</p>
                    <p className="text-xs text-muted-foreground mt-1">Files stored in: /InfinityFiler/Orders/</p>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { if (confirm("Disconnect Dropbox? Existing uploaded files will remain in Dropbox.")) disconnectMutation.mutate(); }}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect-dropbox"
              >
                <Unlink className="h-4 w-4 mr-2" />
                {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect Dropbox"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Dropbox account to automatically store order documents in the cloud.
                Files will be organized by company name and order number.
              </p>
              <div className="p-4 rounded-lg bg-accent/30 border text-sm text-muted-foreground space-y-1">
                <p>Documents will be stored as:</p>
                <p className="font-mono text-xs text-foreground">/InfinityFiler/Orders/[Company Name - Order#]/[Document Name]</p>
              </div>
              <Button onClick={connectDropbox} data-testid="button-connect-dropbox">
                <Link2 className="h-4 w-4 mr-2" />
                Connect Dropbox
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Preview — Invoice Payment Section</CardTitle></CardHeader>
        <CardContent>
          <div className="p-4 rounded-md bg-accent/30 space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wide text-primary">Payment Information</h4>
            {enabledMethods.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No enabled payment methods. Add and enable methods above to see them on invoices.</p>
            ) : (
              enabledMethods.map((method) => (
                <div key={method.id} className="p-3 rounded border bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-2 mb-1">
                    {method.type === "payment_link" ? (
                      <ExternalLink className="h-3.5 w-3.5 text-blue-500" />
                    ) : (
                      <Landmark className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                    <span className="text-sm font-medium">{method.label || method.bank_name}</span>
                    {method.currency && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{method.currency}</Badge>
                    )}
                  </div>
                  {method.type === "bank_account" && (
                    <div className="text-xs text-muted-foreground space-y-0.5 ml-5">
                      {method.bank_name && <p>Bank: {method.bank_name}</p>}
                      {method.account_holder && <p>Account Holder: {method.account_holder}</p>}
                      {method.account_number && <p>Account #: {method.account_number}</p>}
                      {method.iban && <p>IBAN: {method.iban}</p>}
                      {method.details && Object.entries(method.details).map(([k, v]) => (
                        <p key={k}>{k}: {v}</p>
                      ))}
                    </div>
                  )}
                  {method.type === "payment_link" && method.link_url && (
                    <p className="text-xs text-blue-500 ml-5 truncate">{method.link_url}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={methodDialogOpen} onOpenChange={setMethodDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Payment Method" : "Add Payment Method"}</DialogTitle>
          </DialogHeader>
          {editingMethod && (
            <div className="space-y-4">
              <div>
                <Label>Type</Label>
                <Select
                  value={editingMethod.type || "bank_account"}
                  onValueChange={(v) => setEditingMethod({ ...editingMethod, type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_account">Bank Account</SelectItem>
                    <SelectItem value="payment_link">Payment Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Label / Display Name</Label>
                <Input
                  value={editingMethod.label || ""}
                  onChange={(e) => setEditingMethod({ ...editingMethod, label: e.target.value })}
                  placeholder="e.g. Meezan Bank (PKR), Wise (USD), etc."
                />
              </div>

              <div>
                <Label>Currency</Label>
                <Select
                  value={editingMethod.currency || "USD"}
                  onValueChange={(v) => setEditingMethod({ ...editingMethod, currency: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                    <SelectItem value="SAR">SAR - Saudi Riyal</SelectItem>
                    <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                    <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingMethod.type === "bank_account" && (
                <>
                  <div>
                    <Label>Bank Name</Label>
                    <Input
                      value={editingMethod.bank_name || ""}
                      onChange={(e) => setEditingMethod({ ...editingMethod, bank_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Account Holder</Label>
                    <Input
                      value={editingMethod.account_holder || ""}
                      onChange={(e) => setEditingMethod({ ...editingMethod, account_holder: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Account Number</Label>
                    <Input
                      value={editingMethod.account_number || ""}
                      onChange={(e) => setEditingMethod({ ...editingMethod, account_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>IBAN</Label>
                    <Input
                      value={editingMethod.iban || ""}
                      onChange={(e) => setEditingMethod({ ...editingMethod, iban: e.target.value })}
                    />
                  </div>
                </>
              )}

              {editingMethod.type === "payment_link" && (
                <div>
                  <Label>Payment Link URL</Label>
                  <Input
                    value={editingMethod.link_url || ""}
                    onChange={(e) => setEditingMethod({ ...editingMethod, link_url: e.target.value })}
                    placeholder="https://wise.com/pay/..."
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Additional Fields</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomFields([...customFields, { key: "", value: "" }])}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Field
                  </Button>
                </div>
                {customFields.map((field, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <Input
                      className="w-1/3"
                      placeholder="Field name"
                      value={field.key}
                      onChange={(e) => {
                        const updated = [...customFields];
                        updated[idx].key = e.target.value;
                        setCustomFields(updated);
                      }}
                    />
                    <Input
                      className="flex-1"
                      placeholder="Value"
                      value={field.value}
                      onChange={(e) => {
                        const updated = [...customFields];
                        updated[idx].value = e.target.value;
                        setCustomFields(updated);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-red-500"
                      onClick={() => setCustomFields(customFields.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground mt-1">
                  Add custom fields like Swift Code, Branch, Routing Number, etc.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editingMethod.is_enabled !== false}
                  onCheckedChange={(checked) => setEditingMethod({ ...editingMethod, is_enabled: checked })}
                />
                <Label className="cursor-pointer">Enabled (visible on invoices)</Label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button className="flex-1" onClick={saveMethod} disabled={createMethodMutation.isPending || updateMethodMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingId ? "Update" : "Add"} Payment Method
                </Button>
                <Button variant="outline" onClick={() => setMethodDialogOpen(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
