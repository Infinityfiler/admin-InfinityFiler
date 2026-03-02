import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  Plus, Search, Bell, CheckCircle, Clock, AlertTriangle, CalendarClock, Calendar,
  Mail, MessageSquare, Send, ExternalLink, Shield
} from "lucide-react";
import type { Reminder, Customer, ComplianceRecord, SmtpAccount } from "@shared/schema";

const WHATSAPP_NUMBER = "923203682461";

interface ScheduledReminder {
  complianceId: number;
  orderId: number;
  customerName: string;
  companyName: string;
  serviceName: string;
  state: string;
  llcType: string;
  type: "annual_report" | "federal_tax";
  dueDate: string;
  reminderDate: Date;
  label: string;
  alreadyCreated: boolean;
}

function buildScheduledReminders(records: ComplianceRecord[], existingReminders: Reminder[]): ScheduledReminder[] {
  const schedules = [
    { label: "2 months before", daysBeforeDue: 60 },
    { label: "1 month before", daysBeforeDue: 30 },
    { label: "2 weeks before", daysBeforeDue: 14 },
  ];

  const existingKeys = new Set<string>();
  for (const r of existingReminders) {
    existingKeys.add(`${r.type}-${r.order_id}-${r.due_date}-${r.title}`);
  }

  const result: ScheduledReminder[] = [];

  for (const record of records) {
    const types: Array<{ type: "annual_report" | "federal_tax"; dueDate: string; status: string }> = [];
    if (record.annual_report_due && record.annual_report_status === "pending") {
      types.push({ type: "annual_report", dueDate: record.annual_report_due, status: record.annual_report_status });
    }
    if (record.federal_tax_due && record.federal_tax_status === "pending") {
      types.push({ type: "federal_tax", dueDate: record.federal_tax_due, status: record.federal_tax_status });
    }

    for (const t of types) {
      const dueDate = new Date(t.dueDate);
      if (isNaN(dueDate.getTime())) continue;

      for (const schedule of schedules) {
        const reminderDate = new Date(dueDate.getTime() - schedule.daysBeforeDue * 24 * 60 * 60 * 1000);
        const typeLabel = t.type === "annual_report" ? "Annual Report" : "Federal Tax";
        const title = `${typeLabel} Due ${schedule.label} - ${record.company_name}`;
        const uniqueKey = `${t.type}-${record.order_id}-${t.dueDate}-${title}`;
        const alreadyCreated = existingKeys.has(uniqueKey);

        result.push({
          complianceId: record.id,
          orderId: record.order_id,
          customerName: record.customer_name,
          companyName: record.company_name,
          serviceName: record.service_name,
          state: record.state,
          llcType: record.llc_type,
          type: t.type,
          dueDate: t.dueDate,
          reminderDate,
          label: schedule.label,
          alreadyCreated,
        });
      }
    }
  }

  result.sort((a, b) => a.reminderDate.getTime() - b.reminderDate.getTime());
  return result;
}

export default function Reminders() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"active" | "scheduled">("active");
  const [detailReminder, setDetailReminder] = useState<Reminder | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<Reminder | null>(null);
  const [sendChannels, setSendChannels] = useState<string[]>(["email"]);
  const [selectedSmtp, setSelectedSmtp] = useState<number>(0);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");

  const [form, setForm] = useState({
    customer_id: 0, customer_name: "", company_name: "", type: "annual_report",
    title: "", description: "", due_date: "", state: "", entity_type: "LLC",
  });

  const { data: reminders = [], isLoading } = useQuery<Reminder[]>({ queryKey: ["/api/reminders"] });
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: complianceRecords = [] } = useQuery<ComplianceRecord[]>({ queryKey: ["/api/compliance-records"] });
  const { data: smtpAccounts = [] } = useQuery<SmtpAccount[]>({ queryKey: ["/api/smtp-accounts"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/reminders", { ...form, status: "pending" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setOpen(false);
      toast({ title: "Reminder created" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/reminders/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Reminder updated" });
      setDetailReminder(null);
    },
  });

  const selectCustomer = (val: string) => {
    const c = customers.find(c => c.id === Number(val));
    if (c) setForm({ ...form, customer_id: c.id, customer_name: c.individual_name, company_name: c.company_name });
  };

  const filtered = reminders.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      r.company_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const now = new Date();
  const overdue = filtered.filter(r => r.status === "pending" && new Date(r.due_date) < now);
  const upcoming = filtered.filter(r => r.status === "pending" && new Date(r.due_date) >= now);
  const completed = filtered.filter(r => r.status === "completed");
  const dismissed = filtered.filter(r => r.status === "dismissed");

  const scheduledReminders = buildScheduledReminders(complianceRecords, reminders);
  const futureScheduled = scheduledReminders.filter(s => !s.alreadyCreated);
  const pastScheduled = scheduledReminders.filter(s => s.alreadyCreated);
  const filteredScheduled = scheduledReminders.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.companyName.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q) || s.serviceName.toLowerCase().includes(q);
  });

  const openSendDialog = (reminder: Reminder) => {
    setSendingReminder(reminder);
    setSendChannels(["email"]);
    const defaultAccount = smtpAccounts.find(a => a.is_default) || smtpAccounts[0];
    setSelectedSmtp(defaultAccount?.id || 0);

    const typeLabel = reminder.type === "annual_report" ? "Annual Report" : reminder.type === "federal_tax" ? "Federal Tax" : "Compliance";
    setEmailSubject(`${typeLabel} Reminder - ${reminder.company_name}`);
    setEmailMessage(
      `Dear ${reminder.customer_name},\n\n` +
      `${reminder.description || reminder.title}\n\n` +
      `Due Date: ${reminder.due_date}\n\n` +
      `Please ensure all required documents are filed before the deadline.\n\n` +
      `Best regards,\nInfinity Filer`
    );
    setSendDialogOpen(true);
  };

  const sendReminderMutation = useMutation({
    mutationFn: async () => {
      if (!sendingReminder) throw new Error("No reminder selected");

      const complianceRecord = complianceRecords.find(r => r.order_id === sendingReminder.order_id);
      if (!complianceRecord) throw new Error("No linked compliance record found");

      const res = await apiRequest("POST", `/api/compliance-records/${complianceRecord.id}/send-reminder`, {
        channels: sendChannels,
        smtp_account_id: selectedSmtp,
        subject: emailSubject,
        message: emailMessage,
        reminder_type: sendingReminder.type,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });

      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, "_blank");
      }

      if (sendingReminder) {
        updateMutation.mutate({ id: sendingReminder.id, status: "completed" });
      }

      toast({ title: `Reminder sent via ${sendChannels.join(" & ")}` });
      setSendDialogOpen(false);
      setDetailReminder(null);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleChannel = (channel: string) => {
    setSendChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    );
  };

  const renderReminder = (reminder: Reminder) => {
    const dueDate = new Date(reminder.due_date);
    const isOverdue = reminder.status === "pending" && dueDate < now;
    const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isUrgent = reminder.status === "pending" && daysUntil >= 0 && daysUntil <= 30;

    return (
      <Card
        key={reminder.id}
        className={`hover-elevate cursor-pointer transition-all ${isUrgent ? "border-red-300 bg-red-50/30" : ""} ${isOverdue ? "border-red-400 bg-red-50/50" : ""}`}
        onClick={() => setDetailReminder(reminder)}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{reminder.title}</h3>
                <Badge variant={reminder.type === "annual_report" ? "default" : "secondary"}>{reminder.type.replace(/_/g, " ")}</Badge>
                {reminder.entity_type && <Badge variant="secondary">{reminder.entity_type}</Badge>}
                {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                {isUrgent && <Badge className="bg-red-100 text-red-800 border-red-300 animate-pulse">Urgent</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{reminder.company_name} - {reminder.customer_name}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs flex items-center gap-1 ${isUrgent || isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                  <Clock className="h-3 w-3" />Due: {dueDate.toLocaleDateString()}
                  {reminder.status === "pending" && !isOverdue && ` (${daysUntil} days)`}
                </span>
                {reminder.state && <span className="text-xs text-muted-foreground">{reminder.state}</span>}
              </div>
              {reminder.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{reminder.description}</p>}
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {reminder.status === "pending" && (
                <>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openSendDialog(reminder)}>
                    <Send className="h-3 w-3 mr-1" />Send
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => updateMutation.mutate({ id: reminder.id, status: "completed" })}>
                    <CheckCircle className="h-4 w-4 mr-1" />Done
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => updateMutation.mutate({ id: reminder.id, status: "dismissed" })}>
                    Dismiss
                  </Button>
                </>
              )}
              <Badge variant={reminder.status === "completed" ? "default" : "secondary"}>
                {reminder.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderScheduledReminder = (sr: ScheduledReminder, index: number) => {
    const reminderDate = sr.reminderDate;
    const dueDate = new Date(sr.dueDate);
    const daysUntilReminder = Math.ceil((reminderDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isPast = reminderDate <= now;
    const isUrgentDue = daysUntilDue >= 0 && daysUntilDue <= 30;
    const llcLabel = sr.llcType === "single-member" ? "Single-Member LLC" : sr.llcType === "multi-member" ? "Multi-Member LLC" : "";
    const typeLabel = sr.type === "annual_report" ? "Annual Report" : "Federal Tax";
    const taxDeadline = sr.type === "federal_tax" ? (sr.llcType === "multi-member" ? "Mar 15" : "Apr 15") : "";

    return (
      <Card key={`${sr.complianceId}-${sr.type}-${sr.label}-${index}`} className={`${sr.alreadyCreated ? "opacity-50" : ""} ${isUrgentDue && !sr.alreadyCreated ? "border-red-300 bg-red-50/30" : ""}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{typeLabel} - {sr.companyName}</h3>
                <Badge variant={sr.type === "annual_report" ? "default" : "secondary"} className="text-[10px]">{typeLabel}</Badge>
                {llcLabel && <Badge variant="secondary" className="text-[10px] bg-violet-100 text-violet-800 border-violet-200">{llcLabel}</Badge>}
                {taxDeadline && <Badge variant="outline" className="text-[10px]">{taxDeadline}</Badge>}
                <Badge variant="outline" className="text-[10px]">{sr.label}</Badge>
                {sr.alreadyCreated && <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200">Created</Badge>}
                {isUrgentDue && !sr.alreadyCreated && <Badge className="text-[10px] bg-red-100 text-red-800 border-red-300">Urgent</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{sr.serviceName} - {sr.customerName}</p>
              <div className="flex items-center gap-4 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  Generates: {reminderDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {!isPast && !sr.alreadyCreated && ` (in ${daysUntilReminder} days)`}
                </span>
                <span className={`text-xs flex items-center gap-1 ${isUrgentDue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                  <Clock className="h-3 w-3" />
                  Due: {dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {daysUntilDue > 0 && ` (${daysUntilDue} days)`}
                </span>
                {sr.state && <span className="text-xs text-muted-foreground">{sr.state}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sr.alreadyCreated ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Sent</Badge>
              ) : isPast ? (
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">Pending Generation</Badge>
              ) : (
                <Badge variant="outline">Scheduled</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Compliance Reminders</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            <Button
              variant={viewMode === "active" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("active")}
            >
              <Bell className="h-4 w-4 mr-1" />Active ({reminders.length})
            </Button>
            <Button
              variant={viewMode === "scheduled" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("scheduled")}
            >
              <CalendarClock className="h-4 w-4 mr-1" />Scheduled ({futureScheduled.length})
            </Button>
          </div>
          <Link href="/compliance">
            <Button variant="outline" size="sm"><Shield className="h-4 w-4 mr-1" />Compliance</Button>
          </Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Reminder</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Reminder</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Customer</Label>
                  <Select onValueChange={selectCustomer}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>{customers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.company_name} - {c.individual_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(val) => setForm({ ...form, type: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual_report">Annual Report</SelectItem>
                      <SelectItem value="federal_tax">Federal Tax</SelectItem>
                      <SelectItem value="franchise_tax">Franchise Tax</SelectItem>
                      <SelectItem value="boi_report">BOI Report</SelectItem>
                      <SelectItem value="renewal">Renewal</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Entity Type</Label>
                  <Select value={form.entity_type} onValueChange={(val) => setForm({ ...form, entity_type: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LLC">LLC</SelectItem>
                      <SelectItem value="C-Corp">C-Corp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Description</Label><textarea className="w-full rounded-md border p-2 text-sm bg-background" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
                <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!form.title || !form.due_date || !form.customer_id || createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Reminder"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="Search reminders..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {viewMode === "active" && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {viewMode === "active" ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardContent className="p-4 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-red-500" /><div><p className="text-sm text-muted-foreground">Overdue</p><p className="text-xl font-bold">{overdue.length}</p></div></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3"><Bell className="h-5 w-5 text-orange-500" /><div><p className="text-sm text-muted-foreground">Upcoming</p><p className="text-xl font-bold">{upcoming.length}</p></div></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3"><CheckCircle className="h-5 w-5 text-green-500" /><div><p className="text-sm text-muted-foreground">Completed</p><p className="text-xl font-bold">{completed.length}</p></div></CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3"><CalendarClock className="h-5 w-5 text-blue-500" /><div><p className="text-sm text-muted-foreground">Scheduled</p><p className="text-xl font-bold">{futureScheduled.length}</p></div></CardContent></Card>
          </div>

          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : (
            <div className="space-y-6">
              {overdue.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-red-500 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Overdue</h2>
                  {overdue.map(renderReminder)}
                </div>
              )}
              {upcoming.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-orange-500 flex items-center gap-2"><Bell className="h-4 w-4" />Upcoming</h2>
                  {upcoming.map(renderReminder)}
                </div>
              )}
              {completed.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-green-500 flex items-center gap-2"><CheckCircle className="h-4 w-4" />Completed</h2>
                  {completed.map(renderReminder)}
                </div>
              )}
              {dismissed.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-muted-foreground">Dismissed</h2>
                  {dismissed.map(renderReminder)}
                </div>
              )}
              {filtered.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">No reminders found</CardContent></Card>}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Scheduled</p>
                  <p className="text-xl font-bold">{scheduledReminders.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <CalendarClock className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Yet to Generate</p>
                  <p className="text-xl font-bold">{futureScheduled.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Already Created</p>
                  <p className="text-xl font-bold">{pastScheduled.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {complianceRecords.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No compliance records found. Reminders are auto-scheduled when formation dates are set on LLC/C-Corp orders.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {complianceRecords.map(record => {
                const recordReminders = filteredScheduled.filter(s => s.complianceId === record.id);
                if (recordReminders.length === 0) return null;

                const llcLabel = record.llc_type === "single-member" ? "Single-Member LLC" : record.llc_type === "multi-member" ? "Multi-Member LLC" : record.service_category;

                return (
                  <div key={record.id} className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold">{record.company_name}</h2>
                      <Badge variant="secondary" className="text-[10px]">{llcLabel}</Badge>
                      {record.state && <Badge variant="outline" className="text-[10px]">{record.state}</Badge>}
                      <span className="text-xs text-muted-foreground">
                        Formed: {new Date(record.formation_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="text-xs text-muted-foreground">|</span>
                      {record.annual_report_due && (
                        <span className="text-xs text-muted-foreground">
                          Annual Report: {new Date(record.annual_report_due).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                      {record.federal_tax_due && (
                        <>
                          <span className="text-xs text-muted-foreground">|</span>
                          <span className="text-xs text-muted-foreground">
                            Federal Tax: {new Date(record.federal_tax_due).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="space-y-2">
                      {recordReminders.map((sr, idx) => renderScheduledReminder(sr, idx))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Dialog open={!!detailReminder} onOpenChange={(open) => { if (!open) setDetailReminder(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reminder Details</DialogTitle>
          </DialogHeader>
          {detailReminder && (() => {
            const dueDate = new Date(detailReminder.due_date);
            const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const isOverdue = detailReminder.status === "pending" && dueDate < now;
            const isUrgent = detailReminder.status === "pending" && daysUntil >= 0 && daysUntil <= 30;
            const linkedCompliance = complianceRecords.find(r => r.order_id === detailReminder.order_id);

            return (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={detailReminder.type === "annual_report" ? "default" : "secondary"}>{detailReminder.type.replace(/_/g, " ")}</Badge>
                  {detailReminder.entity_type && <Badge variant="secondary">{detailReminder.entity_type}</Badge>}
                  {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                  {isUrgent && <Badge className="bg-red-100 text-red-800 border-red-300 animate-pulse">Due within 30 days</Badge>}
                  <Badge variant={detailReminder.status === "completed" ? "default" : "secondary"}>{detailReminder.status}</Badge>
                </div>

                <h3 className="font-semibold text-lg">{detailReminder.title}</h3>

                <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Company</span><span className="font-medium">{detailReminder.company_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{detailReminder.customer_name}</span></div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date</span>
                    <span className={`font-medium ${isUrgent || isOverdue ? "text-red-600" : ""}`}>
                      {dueDate.toLocaleDateString()} {isOverdue ? `(${Math.abs(daysUntil)}d overdue)` : daysUntil >= 0 ? `(${daysUntil}d remaining)` : ""}
                    </span>
                  </div>
                  {detailReminder.state && <div className="flex justify-between"><span className="text-muted-foreground">State</span><span>{detailReminder.state}</span></div>}
                  {detailReminder.sent_at && <div className="flex justify-between"><span className="text-muted-foreground">Sent At</span><span>{new Date(detailReminder.sent_at).toLocaleString()}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{new Date(detailReminder.created_at).toLocaleString()}</span></div>
                </div>

                {detailReminder.description && (
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{detailReminder.description}</p>
                  </div>
                )}

                {linkedCompliance && (
                  <div className="bg-blue-50 rounded-lg p-3 space-y-2 text-sm">
                    <h4 className="font-semibold text-sm flex items-center gap-1"><Shield className="h-3 w-3" />Linked Compliance Record</h4>
                    <div className="flex justify-between"><span className="text-muted-foreground">ID</span><span className="font-mono">CR-{linkedCompliance.id}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Formation Date</span><span>{linkedCompliance.formation_date}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Annual Report</span><span>{linkedCompliance.annual_report_due || "N/A"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Federal Tax</span><span>{linkedCompliance.federal_tax_due || "N/A"}</span></div>
                    <Link href="/compliance">
                      <Button variant="link" size="sm" className="p-0 h-auto text-xs"><ExternalLink className="h-3 w-3 mr-1" />View Compliance Page</Button>
                    </Link>
                  </div>
                )}

                {detailReminder.order_id && (
                  <Link href={`/orders/${detailReminder.order_id}`}>
                    <Button variant="outline" size="sm" className="w-full"><ExternalLink className="h-4 w-4 mr-1" />View Linked Order</Button>
                  </Link>
                )}

                {detailReminder.status === "pending" && (
                  <div className="space-y-2 pt-2 border-t">
                    <h4 className="font-semibold text-sm">Send Reminder</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => openSendDialog(detailReminder)}
                      >
                        <Mail className="h-4 w-4 mr-1" />Send via Email
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => {
                          const msg = encodeURIComponent(detailReminder.description || detailReminder.title);
                          window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSendChannels(["email", "whatsapp"]);
                          openSendDialog(detailReminder);
                        }}
                      >
                        <Send className="h-4 w-4 mr-1" />Both
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => updateMutation.mutate({ id: detailReminder.id, status: "completed" })}>
                        <CheckCircle className="h-4 w-4 mr-1" />Mark Done
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1" onClick={() => updateMutation.mutate({ id: detailReminder.id, status: "dismissed" })}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Reminder</DialogTitle>
          </DialogHeader>
          {sendingReminder && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="font-medium">To:</span> {sendingReminder.customer_name} ({sendingReminder.company_name})</p>
                <p><span className="font-medium">Type:</span> {sendingReminder.type.replace(/_/g, " ")}</p>
                <p><span className="font-medium">Due:</span> {sendingReminder.due_date}</p>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Send Via</Label>
                <div className="flex gap-2">
                  <Button
                    variant={sendChannels.includes("email") ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleChannel("email")}
                  >
                    <Mail className="h-4 w-4 mr-1" />Email
                  </Button>
                  <Button
                    variant={sendChannels.includes("whatsapp") ? "default" : "outline"}
                    size="sm"
                    className={sendChannels.includes("whatsapp") ? "bg-green-600 hover:bg-green-700" : ""}
                    onClick={() => toggleChannel("whatsapp")}
                  >
                    <MessageSquare className="h-4 w-4 mr-1" />WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSendChannels(["email", "whatsapp"])}
                    className={sendChannels.length === 2 ? "ring-2 ring-primary" : ""}
                  >
                    <Send className="h-4 w-4 mr-1" />Both
                  </Button>
                </div>
              </div>

              {sendChannels.includes("email") && (
                <div className="space-y-3">
                  <div>
                    <Label>SMTP Account</Label>
                    <Select value={String(selectedSmtp)} onValueChange={(v) => setSelectedSmtp(Number(v))}>
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
                    <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                  </div>
                </div>
              )}

              <div>
                <Label>Message</Label>
                <Textarea rows={8} value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} />
              </div>

              <Button
                className="w-full"
                onClick={() => sendReminderMutation.mutate()}
                disabled={sendReminderMutation.isPending || (sendChannels.includes("email") && !selectedSmtp) || sendChannels.length === 0}
              >
                {sendReminderMutation.isPending ? "Sending..." : `Send via ${sendChannels.join(" & ")}`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
