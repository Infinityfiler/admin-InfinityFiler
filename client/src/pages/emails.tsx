import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Trash2, Mail, Server, History, Users, Filter, X, Plus, UserPlus } from "lucide-react";
import type { SmtpAccount, EmailLog, Customer, Order, Invoice } from "@shared/schema";
import { usePagination } from "@/hooks/use-pagination";
import PaginationControls from "@/components/pagination-controls";

type OrderWithMeta = Order & { invoice_status: string; all_services: string[]; all_categories: string[]; };

export default function Emails() {
  const { toast } = useToast();
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const [smtpForm, setSmtpForm] = useState({
    name: "", email: "", host: "", port: 587, username: "", password: "",
    is_default: false, is_active: true,
  });

  const [emailForm, setEmailForm] = useState({
    smtp_account_id: 0, to_emails: "", subject: "", body: "", html: "",
  });

  const [recipientMode, setRecipientMode] = useState<"manual" | "filter">("manual");
  const [filterOrderStatus, setFilterOrderStatus] = useState("all");
  const [filterInvoiceStatus, setFilterInvoiceStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterReferral, setFilterReferral] = useState("all");
  const [manualEmail, setManualEmail] = useState("");

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<SmtpAccount[]>({ queryKey: ["/api/smtp-accounts"] });
  const { data: logs = [], isLoading: loadingLogs } = useQuery<EmailLog[]>({ queryKey: ["/api/email-logs"] });
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: orders = [] } = useQuery<OrderWithMeta[]>({ queryKey: ["/api/orders"] });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });

  const categories = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => o.all_categories?.forEach(c => set.add(c)));
    return Array.from(set).sort();
  }, [orders]);

  const referrals = useMemo(() => {
    const set = new Set(orders.map(o => (o as any).referral_name).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [orders]);

  const filteredCustomerIds = useMemo(() => {
    const ids = new Set<number>();

    if (filterOrderStatus === "all" && filterInvoiceStatus === "all" && filterCategory === "all" && filterReferral === "all") {
      customers.forEach(c => ids.add(c.id));
      return ids;
    }

    orders.forEach(o => {
      let match = true;

      if (filterOrderStatus !== "all" && o.status !== filterOrderStatus) match = false;
      if (filterInvoiceStatus !== "all" && o.invoice_status !== filterInvoiceStatus) match = false;
      if (filterCategory !== "all" && !(o.all_categories || []).includes(filterCategory)) match = false;
      if (filterReferral !== "all" && (o as any).referral_name !== filterReferral) match = false;

      if (match) ids.add(o.customer_id);
    });

    if (filterInvoiceStatus !== "all" && filterOrderStatus === "all" && filterCategory === "all" && filterReferral === "all") {
      invoices.forEach(inv => {
        if ((inv as any).status === filterInvoiceStatus) ids.add(inv.customer_id);
      });
    }

    return ids;
  }, [orders, invoices, customers, filterOrderStatus, filterInvoiceStatus, filterCategory, filterReferral]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => filteredCustomerIds.has(c.id) && c.email);
  }, [customers, filteredCustomerIds]);

  const currentEmails = useMemo(() => {
    return emailForm.to_emails.split(",").map(e => e.trim()).filter(Boolean);
  }, [emailForm.to_emails]);

  const addEmails = (emails: string[]) => {
    const existing = new Set(currentEmails);
    const newOnes = emails.filter(e => !existing.has(e));
    if (newOnes.length === 0) {
      toast({ title: "No new emails to add", description: "All selected emails are already in the list." });
      return;
    }
    const combined = [...currentEmails, ...newOnes].join(", ");
    setEmailForm({ ...emailForm, to_emails: combined });
    toast({ title: `${newOnes.length} email(s) added` });
  };

  const removeEmail = (email: string) => {
    const updated = currentEmails.filter(e => e !== email).join(", ");
    setEmailForm({ ...emailForm, to_emails: updated });
  };

  const addManualEmail = () => {
    const trimmed = manualEmail.trim();
    if (!trimmed) return;
    const emails = trimmed.split(",").map(e => e.trim()).filter(Boolean);
    addEmails(emails);
    setManualEmail("");
  };

  const resetFilters = () => {
    setFilterOrderStatus("all");
    setFilterInvoiceStatus("all");
    setFilterCategory("all");
    setFilterReferral("all");
  };

  const createSmtpMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/smtp-accounts", smtpForm);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smtp-accounts"] });
      setSmtpOpen(false);
      setSmtpForm({ name: "", email: "", host: "", port: 587, username: "", password: "", is_default: false, is_active: true });
      toast({ title: "SMTP account added" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteSmtpMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/smtp-accounts/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smtp-accounts"] });
      toast({ title: "SMTP account deleted" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const toList = emailForm.to_emails.split(",").map(e => e.trim()).filter(Boolean);
      if (toList.length === 0) throw new Error("No recipients");
      if (!emailForm.smtp_account_id) throw new Error("Select an SMTP account");
      await apiRequest("POST", "/api/send-email", {
        smtp_account_id: emailForm.smtp_account_id,
        to_emails: toList,
        subject: emailForm.subject,
        body: emailForm.body,
        html: emailForm.html || emailForm.body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-logs"] });
      setComposeOpen(false);
      setEmailForm({ smtp_account_id: 0, to_emails: "", subject: "", body: "", html: "" });
      setRecipientMode("manual");
      resetFilters();
      toast({ title: "Email sent successfully" });
    },
    onError: (e) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const hasActiveFilters = filterOrderStatus !== "all" || filterInvoiceStatus !== "all" || filterCategory !== "all" || filterReferral !== "all";

  const smtpPagination = usePagination(accounts);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-emails-title">Email Management</h1>
        <div className="flex items-center gap-2">
          <Dialog open={smtpOpen} onOpenChange={setSmtpOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" data-testid="button-add-smtp"><Server className="h-4 w-4 mr-2" />Add SMTP</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add SMTP Account</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Account Name</Label><Input value={smtpForm.name} onChange={(e) => setSmtpForm({ ...smtpForm, name: e.target.value })} data-testid="input-smtp-name" /></div>
                <div><Label>Email</Label><Input type="email" value={smtpForm.email} onChange={(e) => setSmtpForm({ ...smtpForm, email: e.target.value })} data-testid="input-smtp-email" /></div>
                <div><Label>SMTP Host</Label><Input value={smtpForm.host} onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })} placeholder="smtp.gmail.com" data-testid="input-smtp-host" /></div>
                <div><Label>Port</Label><Input type="number" value={smtpForm.port} onChange={(e) => setSmtpForm({ ...smtpForm, port: Number(e.target.value) })} data-testid="input-smtp-port" /></div>
                <div><Label>Username</Label><Input value={smtpForm.username} onChange={(e) => setSmtpForm({ ...smtpForm, username: e.target.value })} data-testid="input-smtp-username" /></div>
                <div><Label>Password</Label><Input type="password" value={smtpForm.password} onChange={(e) => setSmtpForm({ ...smtpForm, password: e.target.value })} data-testid="input-smtp-password" /></div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={smtpForm.is_default} onChange={(e) => setSmtpForm({ ...smtpForm, is_default: e.target.checked })} />
                  <Label>Set as default</Label>
                </div>
                <Button className="w-full" onClick={() => createSmtpMutation.mutate()} disabled={!smtpForm.name || !smtpForm.email || !smtpForm.host || createSmtpMutation.isPending} data-testid="button-save-smtp">
                  {createSmtpMutation.isPending ? "Adding..." : "Add Account"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={composeOpen} onOpenChange={(open) => {
            setComposeOpen(open);
            if (!open) { setRecipientMode("manual"); resetFilters(); }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-compose-email"><Mail className="h-4 w-4 mr-2" />Compose</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Compose Email</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>SMTP Account</Label>
                  <Select onValueChange={(val) => setEmailForm({ ...emailForm, smtp_account_id: Number(val) })}>
                    <SelectTrigger data-testid="select-smtp-account"><SelectValue placeholder="Select SMTP account" /></SelectTrigger>
                    <SelectContent>
                      {accounts.filter(a => a.is_active).map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Recipients</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant={recipientMode === "manual" ? "default" : "outline"}
                        onClick={() => setRecipientMode("manual")}
                        data-testid="button-manual-mode"
                        className="h-7 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />Manual
                      </Button>
                      <Button
                        size="sm"
                        variant={recipientMode === "filter" ? "default" : "outline"}
                        onClick={() => setRecipientMode("filter")}
                        data-testid="button-filter-mode"
                        className="h-7 text-xs"
                      >
                        <Filter className="h-3 w-3 mr-1" />Filter Customers
                      </Button>
                    </div>
                  </div>

                  {recipientMode === "manual" && (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Enter email address(es), comma-separated"
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManualEmail(); } }}
                        data-testid="input-manual-email"
                        className="flex-1"
                      />
                      <Button size="sm" onClick={addManualEmail} disabled={!manualEmail.trim()} data-testid="button-add-manual-email">
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {recipientMode === "filter" && (
                    <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Order Status</Label>
                          <Select value={filterOrderStatus} onValueChange={setFilterOrderStatus}>
                            <SelectTrigger className="h-8 text-xs" data-testid="select-filter-order-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Invoice Status</Label>
                          <Select value={filterInvoiceStatus} onValueChange={setFilterInvoiceStatus}>
                            <SelectTrigger className="h-8 text-xs" data-testid="select-filter-invoice-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="partial-paid">Partial Paid</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
                          <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="h-8 text-xs" data-testid="select-filter-category">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              {categories.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Referral</Label>
                          <Select value={filterReferral} onValueChange={setFilterReferral}>
                            <SelectTrigger className="h-8 text-xs" data-testid="select-filter-referral">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              {referrals.map(r => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""} matched
                          {hasActiveFilters && (
                            <Button size="sm" variant="ghost" onClick={resetFilters} className="h-5 text-xs ml-2 px-1">
                              <X className="h-3 w-3 mr-0.5" />Clear filters
                            </Button>
                          )}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => addEmails(filteredCustomers.map(c => c.email))}
                          disabled={filteredCustomers.length === 0}
                          data-testid="button-add-filtered"
                          className="h-7 text-xs"
                        >
                          <Users className="h-3 w-3 mr-1" />
                          Add {filteredCustomers.length} to Recipients
                        </Button>
                      </div>

                      {filteredCustomers.length > 0 && filteredCustomers.length <= 20 && (
                        <div className="max-h-32 overflow-y-auto border rounded bg-background">
                          {filteredCustomers.map(c => (
                            <div key={c.id} className="flex items-center justify-between px-2 py-1 text-xs border-b last:border-0 hover:bg-muted/50">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium">{c.individual_name || c.company_name}</span>
                                <span className="text-muted-foreground ml-2">{c.email}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 shrink-0"
                                onClick={() => addEmails([c.email])}
                                data-testid={`button-add-customer-${c.id}`}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {filteredCustomers.length > 20 && (
                        <p className="text-xs text-muted-foreground text-center">
                          {filteredCustomers.length} customers matched. Use "Add to Recipients" to add all, or refine filters.
                        </p>
                      )}
                    </div>
                  )}

                  {currentEmails.length > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground font-medium">{currentEmails.length} recipient{currentEmails.length !== 1 ? "s" : ""}</span>
                        <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => setEmailForm({ ...emailForm, to_emails: "" })} data-testid="button-clear-all-recipients">
                          Clear all
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto border rounded-md p-2 bg-muted/20">
                        {currentEmails.map((email, i) => (
                          <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1" data-testid={`badge-recipient-${i}`}>
                            {email}
                            <button onClick={() => removeEmail(email)} className="ml-0.5 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <Label>Subject</Label>
                  <Input value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} data-testid="input-email-subject" />
                </div>
                <div>
                  <Label>Body (Plain Text)</Label>
                  <textarea
                    className="w-full rounded-md border p-2 text-sm bg-background"
                    rows={6}
                    value={emailForm.body}
                    onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })}
                    data-testid="input-email-body"
                  />
                </div>
                <div>
                  <Label>HTML Body (optional)</Label>
                  <textarea
                    className="w-full rounded-md border p-2 text-sm bg-background font-mono text-xs"
                    rows={6}
                    value={emailForm.html}
                    onChange={(e) => setEmailForm({ ...emailForm, html: e.target.value })}
                    placeholder="<html><body>...</body></html>"
                    data-testid="input-email-html"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => sendMutation.mutate()}
                  disabled={!emailForm.subject || !emailForm.to_emails || !emailForm.smtp_account_id || sendMutation.isPending}
                  data-testid="button-send-email"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendMutation.isPending ? "Sending..." : `Send Email${currentEmails.length > 0 ? ` to ${currentEmails.length} recipient${currentEmails.length !== 1 ? "s" : ""}` : ""}`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts" data-testid="tab-smtp-accounts"><Server className="h-4 w-4 mr-1" />SMTP Accounts ({accounts.length})</TabsTrigger>
          <TabsTrigger value="logs" data-testid="tab-email-logs"><History className="h-4 w-4 mr-1" />Email Logs ({logs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4 mt-4">
          {loadingAccounts ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : accounts.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No SMTP accounts configured</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {smtpPagination.paginatedData.map(account => (
                <Card key={account.id} className="hover-elevate">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{account.name}</h3>
                          {account.is_default && <Badge>Default</Badge>}
                          <Badge variant={account.is_active ? "default" : "secondary"}>{account.is_active ? "Active" : "Inactive"}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{account.email}</p>
                        <p className="text-xs text-muted-foreground">{account.host}:{account.port}</p>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this SMTP account?")) deleteSmtpMutation.mutate(account.id); }} data-testid={`button-delete-smtp-${account.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <PaginationControls
                page={smtpPagination.page}
                pageSize={smtpPagination.pageSize}
                totalPages={smtpPagination.totalPages}
                totalItems={smtpPagination.totalItems}
                startIndex={smtpPagination.startIndex}
                endIndex={smtpPagination.endIndex}
                pageSizeOptions={smtpPagination.pageSizeOptions}
                onPageChange={smtpPagination.setPage}
                onPageSizeChange={smtpPagination.setPageSize}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4 mt-4">
          {loadingLogs ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : logs.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No emails sent yet</CardContent></Card>
          ) : (
            <EmailLogsWithPagination logs={logs} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmailLogsWithPagination({ logs }: { logs: EmailLog[] }) {
  const pagination = usePagination(logs);
  return (
    <div className="grid gap-3">
      {pagination.paginatedData.map(log => (
        <Card key={log.id} className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">{log.subject}</h3>
                <p className="text-sm text-muted-foreground">From: {log.from_email}</p>
                <p className="text-xs text-muted-foreground">To: {(log.to_emails || []).join(", ")}</p>
                <p className="text-xs text-muted-foreground">{new Date(log.sent_at).toLocaleString()}</p>
              </div>
              <Badge variant={log.status === "sent" ? "default" : "destructive"}>{log.status}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
      <PaginationControls
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        pageSizeOptions={pagination.pageSizeOptions}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </div>
  );
}
