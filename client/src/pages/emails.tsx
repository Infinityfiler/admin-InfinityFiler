import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Send, Trash2, Mail, Server, History } from "lucide-react";
import type { SmtpAccount, EmailLog, Customer } from "@shared/schema";

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

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery<SmtpAccount[]>({ queryKey: ["/api/smtp-accounts"] });
  const { data: logs = [], isLoading: loadingLogs } = useQuery<EmailLog[]>({ queryKey: ["/api/email-logs"] });
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });

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
      toast({ title: "Email sent successfully" });
    },
    onError: (e) => toast({ title: "Send failed", description: e.message, variant: "destructive" }),
  });

  const insertAllCustomerEmails = () => {
    const emails = customers.map(c => c.email).filter(Boolean).join(", ");
    setEmailForm({ ...emailForm, to_emails: emails });
  };

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
                <Button className="w-full" onClick={() => createSmtpMutation.mutate()} disabled={!smtpForm.name || !smtpForm.email || !smtpForm.host || createSmtpMutation.isPending}>
                  {createSmtpMutation.isPending ? "Adding..." : "Add Account"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-compose-email"><Mail className="h-4 w-4 mr-2" />Compose</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <div className="flex items-center justify-between mb-1">
                    <Label>To (comma-separated)</Label>
                    <Button size="sm" variant="ghost" onClick={insertAllCustomerEmails} data-testid="button-add-all-customers">
                      Add All Customers
                    </Button>
                  </div>
                  <textarea
                    className="w-full rounded-md border p-2 text-sm bg-background"
                    rows={3}
                    placeholder="email1@test.com, email2@test.com"
                    value={emailForm.to_emails}
                    onChange={(e) => setEmailForm({ ...emailForm, to_emails: e.target.value })}
                    data-testid="input-email-to"
                  />
                </div>
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
                  {sendMutation.isPending ? "Sending..." : "Send Email"}
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
              {accounts.map(account => (
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
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this SMTP account?")) deleteSmtpMutation.mutate(account.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="space-y-4 mt-4">
          {loadingLogs ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : logs.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No emails sent yet</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {logs.map(log => (
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
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
