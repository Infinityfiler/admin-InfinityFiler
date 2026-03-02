import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAuthHeaders, authFetch } from "@/lib/auth";
import { Link } from "wouter";
import {
  Search, Shield, FileText, Download, Trash2, Upload, Mail, MessageSquare, Send,
  ChevronDown, ChevronUp, Calendar, AlertTriangle, Clock, ExternalLink, RefreshCw,
  CheckCircle2, Undo2
} from "lucide-react";
import type { ComplianceRecord, SmtpAccount, ComplianceDocument, Reminder, ComplianceHistory } from "@shared/schema";

const WHATSAPP_NUMBER = "923203682461";

function getDaysRemaining(dateStr: string): number {
  if (!dateStr) return Infinity;
  const due = new Date(dateStr);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getDueBadge(dateStr: string, status: string) {
  if (status === "submitted") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Submitted</Badge>;
  const days = getDaysRemaining(dateStr);
  if (days < 0) return <Badge variant="destructive">Overdue ({Math.abs(days)}d)</Badge>;
  if (days <= 30) return <Badge className="bg-red-100 text-red-800 border-red-300 animate-pulse">Due in {days}d</Badge>;
  if (days <= 60) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Due in {days}d</Badge>;
  return <Badge variant="outline">{days}d remaining</Badge>;
}

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

export default function Compliance() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingRecord, setSendingRecord] = useState<ComplianceRecord | null>(null);
  const [sendType, setSendType] = useState<"annual_report" | "federal_tax" | "both">("annual_report");
  const [sendChannels, setSendChannels] = useState<string[]>(["email"]);
  const [selectedSmtp, setSelectedSmtp] = useState<number>(0);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);

  const [confirmAdvanceOpen, setConfirmAdvanceOpen] = useState(false);
  const [advancingRecord, setAdvancingRecord] = useState<ComplianceRecord | null>(null);
  const [advanceDocFile, setAdvanceDocFile] = useState<File | null>(null);
  const [undoState, setUndoState] = useState<{ id: number; previousState: any; timer: NodeJS.Timeout } | null>(null);

  const [markSubmittedOpen, setMarkSubmittedOpen] = useState(false);
  const [markSubmittedRecord, setMarkSubmittedRecord] = useState<ComplianceRecord | null>(null);
  const [markSubmittedType, setMarkSubmittedType] = useState<"annual_report" | "federal_tax">("annual_report");
  const [markSubmittedFile, setMarkSubmittedFile] = useState<File | null>(null);

  const { data: records = [], isLoading } = useQuery<ComplianceRecord[]>({ queryKey: ["/api/compliance-records"] });
  const { data: smtpAccounts = [] } = useQuery<SmtpAccount[]>({ queryKey: ["/api/smtp-accounts"] });
  const { data: reminders = [] } = useQuery<Reminder[]>({ queryKey: ["/api/reminders"] });

  const filtered = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.company_name.toLowerCase().includes(q) ||
      r.customer_name.toLowerCase().includes(q) ||
      r.state.toLowerCase().includes(q) ||
      r.service_name.toLowerCase().includes(q) ||
      `CR-${r.id}`.toLowerCase().includes(q);
  });

  const urgentCount = records.filter(r => {
    const arDays = getDaysRemaining(r.annual_report_due);
    const ftDays = getDaysRemaining(r.federal_tax_due);
    return (arDays <= 30 && r.annual_report_status === "pending") || (ftDays <= 30 && r.federal_tax_status === "pending");
  }).length;

  const overdueCount = records.filter(r => {
    const arDays = getDaysRemaining(r.annual_report_due);
    const ftDays = getDaysRemaining(r.federal_tax_due);
    return (arDays < 0 && r.annual_report_status === "pending") || (ftDays < 0 && r.federal_tax_status === "pending");
  }).length;

  const openSendDialog = (record: ComplianceRecord, type: "annual_report" | "federal_tax" | "both") => {
    setSendingRecord(record);
    setSendType(type);
    setSendChannels(["email"]);
    const defaultAccount = smtpAccounts.find(a => a.is_default) || smtpAccounts[0];
    setSelectedSmtp(defaultAccount?.id || 0);

    const typeLabel = type === "both" ? "Annual Report & Federal Tax" : type === "annual_report" ? "Annual Report" : "Federal Tax";
    const dueDate = type === "federal_tax" ? record.federal_tax_due : record.annual_report_due;
    const llcLabel = record.llc_type === "single-member" ? "Single-Member LLC" : record.llc_type === "multi-member" ? "Multi-Member LLC" : "LLC";

    setEmailSubject(`${typeLabel} Compliance Reminder - ${record.company_name}`);
    let body = `Dear ${record.customer_name},\n\nThis is a reminder regarding the ${typeLabel} filing for your company "${record.company_name}" (${llcLabel}, ${record.state}).\n\n`;
    if (type === "both") {
      body += `Annual Report Due: ${record.annual_report_due}\nFederal Tax Due: ${record.federal_tax_due}\n`;
    } else {
      body += `Due Date: ${dueDate}\n`;
    }
    body += `Formation Date: ${record.formation_date}\nService: ${record.service_name}\n\nPlease ensure all required documents are filed before the deadline to avoid any penalties.\n\nIf you have any questions, please don't hesitate to contact us.\n\nBest regards,\nInfinity Filer`;
    setEmailMessage(body);
    setSendDialogOpen(true);
  };

  const sendReminderMutation = useMutation({
    mutationFn: async () => {
      if (!sendingRecord) throw new Error("No record selected");
      const reminderType = sendType === "both" ? "annual_report" : sendType;
      const res = await apiRequest("POST", `/api/compliance-records/${sendingRecord.id}/send-reminder`, {
        channels: sendChannels,
        smtp_account_id: selectedSmtp,
        subject: emailSubject,
        message: emailMessage,
        reminder_type: reminderType,
      });
      const data = await res.json();
      if (sendType === "both") {
        await apiRequest("POST", `/api/compliance-records/${sendingRecord.id}/send-reminder`, {
          channels: sendChannels,
          smtp_account_id: selectedSmtp,
          subject: emailSubject.replace("Annual Report & Federal Tax", "Federal Tax"),
          message: emailMessage,
          reminder_type: "federal_tax",
        });
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      if (data.whatsappUrl) window.open(data.whatsappUrl, "_blank");
      const sentVia = sendChannels.join(" & ");
      toast({ title: `Reminder sent via ${sentVia}` });
      setSendDialogOpen(false);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const advanceYearMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/compliance-records/${id}/advance-year`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.includes("/history") });

      if (undoState?.timer) clearTimeout(undoState.timer);
      const timer = setTimeout(() => {
        setUndoState(null);
      }, 5000);
      setUndoState({ id: data.id, previousState: data.previousState, timer });

      toast({
        title: "Advanced to next year",
        description: "You can undo this action within 5 seconds",
      });
      setConfirmAdvanceOpen(false);
      setAdvanceDocFile(null);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const undoAdvanceMutation = useMutation({
    mutationFn: async ({ id, previousState }: { id: number; previousState: any }) => {
      const res = await apiRequest("POST", `/api/compliance-records/${id}/undo-advance`, { previousState });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      if (undoState?.timer) clearTimeout(undoState.timer);
      setUndoState(null);
      toast({ title: "Advance undone successfully" });
    },
    onError: (e) => toast({ title: "Undo failed", description: e.message, variant: "destructive" }),
  });

  const markSubmittedMutation = useMutation({
    mutationFn: async ({ recordId, type }: { recordId: number; type: "annual_report" | "federal_tax" }) => {
      const data = type === "annual_report" ? { annual_report_status: "submitted" } : { federal_tax_status: "submitted" };
      const res = await apiRequest("PATCH", `/api/compliance-records/${recordId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reminders"] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.includes("/history") });
      toast({ title: "Marked as submitted and shifted to next year" });
      setMarkSubmittedOpen(false);
      setMarkSubmittedFile(null);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadDocMutation = useMutation({
    mutationFn: async ({ complianceId, file, documentName, documentType }: { complianceId: number; file: File; documentName: string; documentType: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_name", documentName);
      formData.append("document_type", documentType);
      const res = await authFetch(`/api/compliance-records/${complianceId}/documents`, { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [`/api/compliance-records/${vars.complianceId}/documents`] });
      toast({ title: "Document uploaded" });
    },
    onError: (e) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async ({ docId, complianceId }: { docId: number; complianceId: number }) => {
      await apiRequest("DELETE", `/api/compliance-documents/${docId}`);
      return complianceId;
    },
    onSuccess: (complianceId) => {
      queryClient.invalidateQueries({ queryKey: [`/api/compliance-records/${complianceId}/documents`] });
      toast({ title: "Document deleted" });
    },
  });

  const toggleChannel = (channel: string) => {
    setSendChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    );
  };

  const handleFileUpload = (complianceId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.replace(/\.[^/.]+$/, "");
    uploadDocMutation.mutate({ complianceId, file, documentName: name, documentType: "" });
    e.target.value = "";
  };

  const handleAdvanceConfirm = async () => {
    if (!advancingRecord) return;
    if (advanceDocFile) {
      const formData = new FormData();
      formData.append("file", advanceDocFile);
      formData.append("document_name", `Year Advance - ${advancingRecord.company_name}`);
      formData.append("document_type", "Year Advance");
      try {
        const res = await authFetch(`/api/compliance-records/${advancingRecord.id}/documents`, { method: "POST", body: formData });
        if (res.ok) queryClient.invalidateQueries({ queryKey: [`/api/compliance-records/${advancingRecord.id}/documents`] });
      } catch {}
    }
    advanceYearMutation.mutate(advancingRecord.id);
  };

  const handleMarkSubmitted = async () => {
    if (!markSubmittedRecord) return;
    if (markSubmittedFile) {
      const formData = new FormData();
      formData.append("file", markSubmittedFile);
      formData.append("document_name", `${markSubmittedType === "annual_report" ? "Annual Report" : "Federal Tax"} - ${markSubmittedRecord.company_name}`);
      formData.append("document_type", markSubmittedType === "annual_report" ? "Annual Report" : "Federal Tax");
      try {
        const res = await authFetch(`/api/compliance-records/${markSubmittedRecord.id}/documents`, { method: "POST", body: formData });
        if (res.ok) queryClient.invalidateQueries({ queryKey: [`/api/compliance-records/${markSubmittedRecord.id}/documents`] });
      } catch {}
    }
    markSubmittedMutation.mutate({ recordId: markSubmittedRecord.id, type: markSubmittedType });
  };

  useEffect(() => {
    return () => {
      if (undoState?.timer) clearTimeout(undoState.timer);
    };
  }, [undoState]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Compliance Records</h1>
        </div>
      </div>

      {undoState && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-center justify-between animate-in slide-in-from-top">
          <p className="text-sm text-amber-800">Due dates advanced to next year. You can undo this action.</p>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-400 text-amber-800 hover:bg-amber-100"
            onClick={() => undoAdvanceMutation.mutate({ id: undoState.id, previousState: undoState.previousState })}
            disabled={undoAdvanceMutation.isPending}
          >
            <Undo2 className="h-3 w-3 mr-1" />{undoAdvanceMutation.isPending ? "Undoing..." : "Undo"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-blue-500" />
            <div><p className="text-sm text-muted-foreground">Total Records</p><p className="text-xl font-bold">{records.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div><p className="text-sm text-muted-foreground">Urgent (&lt;30d)</p><p className="text-xl font-bold text-red-600">{urgentCount}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-orange-500" />
            <div><p className="text-sm text-muted-foreground">Overdue</p><p className="text-xl font-bold text-orange-600">{overdueCount}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-green-500" />
            <div><p className="text-sm text-muted-foreground">Up to Date</p><p className="text-xl font-bold text-green-600">{records.length - urgentCount - overdueCount}</p></div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Search by company, customer, state, or CR-ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No compliance records found. Records are automatically created when formation dates are set on LLC/C-Corp orders.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(record => (
            <ComplianceCard
              key={record.id}
              record={record}
              expanded={expandedId === record.id}
              onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
              onSendReminder={openSendDialog}
              onAdvanceYear={(rec) => { setAdvancingRecord(rec); setAdvanceDocFile(null); setConfirmAdvanceOpen(true); }}
              onMarkSubmitted={(rec, type) => { setMarkSubmittedRecord(rec); setMarkSubmittedType(type); setMarkSubmittedFile(null); setMarkSubmittedOpen(true); }}
              onUploadDoc={(id) => { setUploadingFor(id); fileInputRef.current?.click(); }}
              onDeleteDoc={(docId, complianceId) => deleteDocMutation.mutate({ docId, complianceId })}
              reminders={reminders.filter(r => r.order_id === record.order_id)}
            />
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => { if (uploadingFor) handleFileUpload(uploadingFor, e); }}
      />

      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send {sendType === "both" ? "Annual Report & Federal Tax" : sendType === "annual_report" ? "Annual Report" : "Federal Tax"} Reminder</DialogTitle>
          </DialogHeader>
          {sendingRecord && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="font-medium">Company:</span> {sendingRecord.company_name}</p>
                <p><span className="font-medium">Customer:</span> {sendingRecord.customer_name}</p>
                <p><span className="font-medium">State:</span> {sendingRecord.state}</p>
                {sendType === "both" ? (
                  <>
                    <p><span className="font-medium">Annual Report Due:</span> {sendingRecord.annual_report_due}</p>
                    <p><span className="font-medium">Federal Tax Due:</span> {sendingRecord.federal_tax_due}</p>
                  </>
                ) : (
                  <p><span className="font-medium">Due Date:</span> {sendType === "annual_report" ? sendingRecord.annual_report_due : sendingRecord.federal_tax_due}</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Send Via</Label>
                <div className="flex gap-2">
                  <Button variant={sendChannels.includes("email") ? "default" : "outline"} size="sm" onClick={() => toggleChannel("email")}>
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
                  <Button variant="outline" size="sm" onClick={() => setSendChannels(["email", "whatsapp"])} className={sendChannels.length === 2 ? "ring-2 ring-primary" : ""}>
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

      <Dialog open={confirmAdvanceOpen} onOpenChange={setConfirmAdvanceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Advance to Next Year</DialogTitle>
          </DialogHeader>
          {advancingRecord && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm space-y-1">
                <p className="font-medium text-amber-800">Are you sure you want to advance all due dates to next year?</p>
                <p className="text-amber-700">Company: {advancingRecord.company_name}</p>
                <p className="text-amber-700">Annual Report: {advancingRecord.annual_report_due} → next year</p>
                <p className="text-amber-700">Federal Tax: {advancingRecord.federal_tax_due} → next year</p>
                <p className="text-xs text-amber-600 mt-2">This will reset reminder count to 0. You can undo within 5 seconds after confirming.</p>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Upload Compliance Document</Label>
                  <span className="text-xs text-muted-foreground">(Optional)</span>
                </div>
                <p className="text-xs text-muted-foreground">Attach any compliance proof before advancing</p>
                <Input type="file" className="text-xs" onChange={(e) => setAdvanceDocFile(e.target.files?.[0] || null)} />
              </div>

              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setConfirmAdvanceOpen(false)}>Cancel</Button>
                <Button onClick={handleAdvanceConfirm} disabled={advanceYearMutation.isPending}>
                  <RefreshCw className="h-4 w-4 mr-1" />{advanceYearMutation.isPending ? "Advancing..." : "Confirm Advance"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={markSubmittedOpen} onOpenChange={setMarkSubmittedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark {markSubmittedType === "annual_report" ? "Annual Report" : "Federal Tax"} as Submitted</DialogTitle>
          </DialogHeader>
          {markSubmittedRecord && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="font-medium">Company:</span> {markSubmittedRecord.company_name}</p>
                <p><span className="font-medium">Due Date:</span> {markSubmittedType === "annual_report" ? markSubmittedRecord.annual_report_due : markSubmittedRecord.federal_tax_due}</p>
                <p className="text-xs text-muted-foreground mt-2">This will mark as submitted and automatically shift the due date to next year.</p>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Upload Compliance Document</Label>
                  <span className="text-xs text-muted-foreground">(Optional)</span>
                </div>
                <p className="text-xs text-muted-foreground">Upload proof of submission if available</p>
                <Input type="file" className="text-xs" onChange={(e) => setMarkSubmittedFile(e.target.files?.[0] || null)} />
              </div>

              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setMarkSubmittedOpen(false)}>Cancel</Button>
                <Button onClick={handleMarkSubmitted} disabled={markSubmittedMutation.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1" />{markSubmittedMutation.isPending ? "Submitting..." : "Mark Submitted"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ComplianceCard({
  record,
  expanded,
  onToggle,
  onSendReminder,
  onAdvanceYear,
  onMarkSubmitted,
  onUploadDoc,
  onDeleteDoc,
  reminders,
}: {
  record: ComplianceRecord;
  expanded: boolean;
  onToggle: () => void;
  onSendReminder: (record: ComplianceRecord, type: "annual_report" | "federal_tax" | "both") => void;
  onAdvanceYear: (record: ComplianceRecord) => void;
  onMarkSubmitted: (record: ComplianceRecord, type: "annual_report" | "federal_tax") => void;
  onUploadDoc: (id: number) => void;
  onDeleteDoc: (docId: number, complianceId: number) => void;
  reminders: Reminder[];
}) {
  const arDays = getDaysRemaining(record.annual_report_due);
  const ftDays = getDaysRemaining(record.federal_tax_due);
  const isUrgent = (arDays <= 30 && record.annual_report_status === "pending") || (ftDays <= 30 && record.federal_tax_status === "pending");
  const isOverdue = (arDays < 0 && record.annual_report_status === "pending") || (ftDays < 0 && record.federal_tax_status === "pending");
  const llcLabel = record.llc_type === "single-member" ? "Single-Member" : record.llc_type === "multi-member" ? "Multi-Member" : "";

  const { data: docs = [] } = useQuery<ComplianceDocument[]>({
    queryKey: [`/api/compliance-records/${record.id}/documents`],
    enabled: expanded,
  });

  const { data: history = [] } = useQuery<ComplianceHistory[]>({
    queryKey: [`/api/compliance-records/${record.id}/history`],
    enabled: expanded,
  });

  return (
    <Card className={`transition-all ${isOverdue ? "border-red-400 bg-red-50/30" : isUrgent ? "border-amber-400 bg-amber-50/30" : ""}`}>
      <CardContent className="p-0">
        <div className="p-4 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className="text-[10px] font-mono">CR-{record.id}</Badge>
                <h3 className="font-semibold">{record.company_name}</h3>
                {llcLabel && <Badge className="text-[10px] bg-violet-100 text-violet-800 border-violet-200">{llcLabel}</Badge>}
                <Badge variant="secondary" className="text-[10px]">{record.state}</Badge>
                {isOverdue && <Badge variant="destructive" className="text-[10px]">OVERDUE</Badge>}
                {isUrgent && !isOverdue && <Badge className="text-[10px] bg-red-100 text-red-800 border-red-300">URGENT</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{record.customer_name} | {record.service_name}</p>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Annual Report:</span>
                  {record.annual_report_due ? getDueBadge(record.annual_report_due, record.annual_report_status) : <span className="text-xs text-muted-foreground">N/A</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Federal Tax:</span>
                  {record.federal_tax_due ? getDueBadge(record.federal_tax_due, record.federal_tax_status) : <span className="text-xs text-muted-foreground">N/A</span>}
                </div>
                <span className="text-xs text-muted-foreground">Formed: {new Date(record.formation_date).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
            </div>
          </div>
        </div>

        {expanded && (
          <div className="border-t px-4 pb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Shield className="h-4 w-4" />Compliance Details</h4>
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
                  <div className="flex justify-between"><span className="text-muted-foreground">Compliance ID</span><span className="font-mono font-medium">CR-{record.id}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Company</span><span className="font-medium">{record.company_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{record.customer_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">State</span><span>{record.state}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">LLC Type</span><span>{llcLabel || "Not specified"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Formation Date</span><span>{record.formation_date}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span className="text-right max-w-[200px] truncate">{record.service_name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Reminders Sent</span><span>{record.reminder_count}</span></div>
                  {record.last_reminder_sent && <div className="flex justify-between"><span className="text-muted-foreground">Last Sent</span><span>{new Date(record.last_reminder_sent).toLocaleDateString()}</span></div>}
                </div>

                <div className="flex gap-2">
                  <Link href={`/orders/${record.order_id}`}>
                    <Button variant="outline" size="sm"><ExternalLink className="h-3 w-3 mr-1" />View Order</Button>
                  </Link>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Calendar className="h-4 w-4" />Due Dates & Actions</h4>

                <div className="bg-muted/50 rounded-lg p-3 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Annual Report</span>
                      {record.annual_report_due && getDueBadge(record.annual_report_due, record.annual_report_status)}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Due: {record.annual_report_due || "N/A"}</p>
                    {record.annual_report_due && record.annual_report_status === "pending" && (
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onSendReminder(record, "annual_report")}>
                          <Mail className="h-3 w-3 mr-1" />Email
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="text-xs h-7 text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => {
                            const msg = encodeURIComponent(`Annual Report Reminder for ${record.company_name} - Due: ${record.annual_report_due}`);
                            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
                          }}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />WhatsApp
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => onMarkSubmitted(record, "annual_report")}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />Mark Submitted
                        </Button>
                      </div>
                    )}
                  </div>

                  <hr />

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">Federal Tax</span>
                      {record.federal_tax_due && getDueBadge(record.federal_tax_due, record.federal_tax_status)}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Due: {record.federal_tax_due || "N/A"} ({record.llc_type === "multi-member" ? "March 15" : "April 15"} deadline)</p>
                    {record.federal_tax_due && record.federal_tax_status === "pending" && (
                      <div className="flex gap-1 flex-wrap">
                        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onSendReminder(record, "federal_tax")}>
                          <Mail className="h-3 w-3 mr-1" />Email
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="text-xs h-7 text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => {
                            const msg = encodeURIComponent(`Federal Tax Reminder for ${record.company_name} - Due: ${record.federal_tax_due}`);
                            window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
                          }}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />WhatsApp
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => onMarkSubmitted(record, "federal_tax")}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />Mark Submitted
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => onSendReminder(record, "both")}
                  >
                    <Send className="h-3 w-3 mr-1" />Send Both Reminders
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => onAdvanceYear(record)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />Advance to Next Year
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Compliance Documents</h4>
                <Button size="sm" variant="outline" onClick={() => onUploadDoc(record.id)}>
                  <Upload className="h-3 w-3 mr-1" />Upload
                </Button>
              </div>
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No documents uploaded yet</p>
              ) : (
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{doc.document_name || doc.file_name}</span>
                        {doc.document_type && <Badge variant="outline" className="text-[10px]">{doc.document_type}</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => authDownload(`/api/compliance-documents/${doc.id}/download`, doc.file_name)}>
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDeleteDoc(doc.id, record.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Compliance History</h4>
                <div className="space-y-2">
                  {history.map(h => (
                    <div key={h.id} className="flex items-center justify-between bg-emerald-50/50 border border-emerald-200 rounded-lg p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200">{h.year}</Badge>
                        <span className="font-medium">{h.type === "annual_report" ? "Annual Report" : "Federal Tax"}</span>
                        <span className="text-xs text-muted-foreground">Due: {h.due_date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200">
                          {h.status === "completed" ? "Completed" : h.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(h.completed_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reminders.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Clock className="h-4 w-4" />Reminder History</h4>
                <div className="space-y-2">
                  {reminders.slice(0, 10).map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-2 text-sm">
                      <div>
                        <span className="font-medium">{r.title}</span>
                        <span className="text-xs text-muted-foreground ml-2">Due: {r.due_date}</span>
                      </div>
                      <Badge variant={r.status === "completed" ? "default" : r.status === "pending" ? "secondary" : "outline"} className="text-[10px]">
                        {r.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
