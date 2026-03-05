import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authFetch } from "@/lib/auth";
import {
  Link as LinkIcon, Plus, Search, Copy, Eye, Ban, ExternalLink,
  FileText, User, Upload, Trash2, Clock, Activity, CheckCircle, ChevronDown, ChevronRight
} from "lucide-react";
import type { CustomerPortalLink, LinkActivityLog, Customer } from "@shared/schema";
import { usePagination } from "@/hooks/use-pagination";
import PaginationControls from "@/components/pagination-controls";

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function getActionIcon(action: string) {
  switch (action) {
    case "page_view": return <Eye className="h-3.5 w-3.5 text-blue-500" />;
    case "profile_update": return <User className="h-3.5 w-3.5 text-amber-500" />;
    case "document_upload": return <Upload className="h-3.5 w-3.5 text-green-500" />;
    case "document_delete": return <Trash2 className="h-3.5 w-3.5 text-red-500" />;
    default: return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getActionLabel(action: string): string {
  switch (action) {
    case "page_view": return "Page View";
    case "profile_update": return "Profile Update";
    case "document_upload": return "Document Upload";
    case "document_delete": return "Document Delete";
    default: return action;
  }
}

function getActionDescription(action: string, details: Record<string, any>): string {
  switch (action) {
    case "page_view":
      return `Viewed ${details.page || "portal"}`;
    case "profile_update":
      if (details.field) return `Changed ${details.field}: "${details.old || ""}" to "${details.new || ""}"`;
      return "Updated profile";
    case "document_upload":
      return `Uploaded ${details.file || details.document_name || "document"}`;
    case "document_delete":
      return `Deleted ${details.file || details.document_name || "document"}`;
    default:
      return JSON.stringify(details);
  }
}

function getPortalUrl(token: string): string {
  return `${window.location.origin}/portal/${token}`;
}

export default function CustomerLinks() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<CustomerPortalLink | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [generatedLink, setGeneratedLink] = useState<CustomerPortalLink | null>(null);

  const { data: links = [], isLoading } = useQuery<CustomerPortalLink[]>({
    queryKey: ["/api/portal-links"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: activityLog = [], isLoading: loadingActivity } = useQuery<LinkActivityLog[]>({
    queryKey: ["/api/portal-links", selectedLink?.id, "activity"],
    enabled: !!selectedLink,
    queryFn: async () => {
      if (!selectedLink) return [];
      const res = await authFetch(`/api/portal-links/${selectedLink.id}/activity`);
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (customerId: number) => {
      const customer = customers.find(c => c.id === customerId);
      const res = await apiRequest("POST", "/api/portal-links", {
        customer_id: customerId,
        customer_name: customer?.individual_name || "",
        company_name: customer?.company_name || "",
      });
      return await res.json();
    },
    onSuccess: (data: CustomerPortalLink) => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-links"] });
      setGeneratedLink(data);
      toast({ title: "Portal link generated" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/portal-links/${id}/revoke`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal-links"] });
      toast({ title: "Link revoked" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const openWhatsApp = (link: CustomerPortalLink) => {
    const customer = customers.find(c => c.id === link.customer_id);
    const phone = customer?.phone?.replace(/[^0-9]/g, "") || "";
    const message = encodeURIComponent(
      `Hello ${link.customer_name || ""},\n\nHere is your Infinity Filer customer portal link:\n${getPortalUrl(link.token)}\n\nYou can view your orders, invoices, and manage your profile through this link.`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  const openEmail = (link: CustomerPortalLink) => {
    const customer = customers.find(c => c.id === link.customer_id);
    const subject = encodeURIComponent("Your Infinity Filer Customer Portal");
    const body = encodeURIComponent(
      `Hello ${link.customer_name || ""},\n\nHere is your Infinity Filer customer portal link:\n${getPortalUrl(link.token)}\n\nYou can view your orders, invoices, and manage your profile through this link.\n\nBest regards,\nInfinity Filer`
    );
    window.open(`mailto:${customer?.email || ""}?subject=${subject}&body=${body}`, "_blank");
  };

  const totalLinks = links.length;
  const activeLinks = links.filter(l => !l.is_revoked).length;
  const totalViews = links.reduce((sum, l) => sum + (l.view_count || 0), 0);

  const filtered = links.filter(l => {
    const matchesSearch = !search ||
      (l.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
      l.token.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && !l.is_revoked) ||
      (statusFilter === "revoked" && l.is_revoked);
    return matchesSearch && matchesStatus;
  });

  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.individual_name.toLowerCase().includes(q) ||
      c.company_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-customer-links-title">Customer Links</h1>
        <Button
          onClick={() => { setGenerateOpen(true); setGeneratedLink(null); setSelectedCustomerId(null); setCustomerSearch(""); }}
          data-testid="button-generate-link"
        >
          <Plus className="h-4 w-4 mr-2" />Generate Link
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <LinkIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Links</p>
              <p className="text-xl font-bold" data-testid="text-total-links">{totalLinks}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Links</p>
              <p className="text-xl font-bold" data-testid="text-active-links">{activeLinks}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-500/10">
              <Eye className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Views</p>
              <p className="text-xl font-bold" data-testid="text-total-views">{totalViews}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10"
            placeholder="Search by customer name or token..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-links"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No links found</CardContent></Card>
      ) : (
        <LinksListWithPagination
          filtered={filtered}
          customers={customers}
          copyToClipboard={copyToClipboard}
          setSelectedLink={setSelectedLink}
          setActivityOpen={setActivityOpen}
          revokeMutation={revokeMutation}
        />
      )}

      <Dialog open={generateOpen} onOpenChange={(v) => { setGenerateOpen(v); if (!v) { setGeneratedLink(null); setSelectedCustomerId(null); setCustomerSearch(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Portal Link</DialogTitle>
          </DialogHeader>

          {!generatedLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Select a customer to generate their portal link:</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Search customers..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    data-testid="input-search-customer-for-link"
                  />
                </div>
              </div>

              <ScrollArea className="h-[300px]">
                <div className="space-y-1">
                  {filteredCustomers.map(c => (
                    <div
                      key={c.id}
                      className={`p-3 rounded-md cursor-pointer toggle-elevate ${selectedCustomerId === c.id ? "toggle-elevated bg-accent" : "hover-elevate"}`}
                      onClick={() => setSelectedCustomerId(c.id)}
                      data-testid={`option-customer-${c.id}`}
                    >
                      <p className="text-sm font-medium">{c.individual_name}</p>
                      <p className="text-xs text-muted-foreground">{c.company_name} {c.email}</p>
                    </div>
                  ))}
                  {filteredCustomers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center p-4">No customers found</p>
                  )}
                </div>
              </ScrollArea>

              <Button
                className="w-full"
                disabled={!selectedCustomerId || createMutation.isPending}
                onClick={() => selectedCustomerId && createMutation.mutate(selectedCustomerId)}
                data-testid="button-confirm-generate"
              >
                {createMutation.isPending ? "Generating..." : "Generate Link"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-md bg-muted">
                <p className="text-xs text-muted-foreground mb-1">Portal Link for {generatedLink.customer_name}</p>
                <p className="text-sm font-mono break-all" data-testid="text-generated-url">
                  {getPortalUrl(generatedLink.token)}
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => copyToClipboard(getPortalUrl(generatedLink.token))}
                  data-testid="button-copy-generated"
                >
                  <Copy className="h-4 w-4 mr-2" />Copy
                </Button>
                <Button
                  className="flex-1 bg-green-600 border-green-700 text-white"
                  onClick={() => openWhatsApp(generatedLink)}
                  data-testid="button-whatsapp-send"
                >
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => openEmail(generatedLink)}
                  data-testid="button-email-send"
                >
                  Email
                </Button>
              </div>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setGenerateOpen(false)}
                data-testid="button-close-generate"
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={activityOpen} onOpenChange={(v) => { setActivityOpen(v); if (!v) setSelectedLink(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Log — {selectedLink?.customer_name || selectedLink?.company_name}
            </DialogTitle>
          </DialogHeader>

          {loadingActivity ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : activityLog.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No activity recorded yet</p>
            </div>
          ) : (
            <ActivityLogCollapsible activityLog={activityLog} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivityLogCollapsible({ activityLog }: { activityLog: LinkActivityLog[] }) {
  const [expanded, setExpanded] = useState(false);
  const previewCount = 3;
  const displayedLogs = expanded ? activityLog : activityLog.slice(0, previewCount);
  const hasMore = activityLog.length > previewCount;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{activityLog.length} activity entries</span>
        {hasMore && (
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} data-testid="button-toggle-activity-logs">
            {expanded ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
            {expanded ? "Collapse" : `Show all ${activityLog.length}`}
          </Button>
        )}
      </div>
      <ScrollArea className={expanded ? "h-[400px]" : "max-h-[200px]"}>
        <div className="space-y-2 pr-2">
          {displayedLogs.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 p-3 rounded-md border" data-testid={`activity-entry-${entry.id}`}>
              <div className="mt-0.5 shrink-0">
                {getActionIcon(entry.action)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    {getActionLabel(entry.action)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(entry.created_at)}
                  </span>
                </div>
                <p className="text-sm mt-1" data-testid={`text-activity-detail-${entry.id}`}>
                  {getActionDescription(entry.action, entry.details || {})}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function LinksListWithPagination({
  filtered,
  customers,
  copyToClipboard,
  setSelectedLink,
  setActivityOpen,
  revokeMutation,
}: {
  filtered: CustomerPortalLink[];
  customers: Customer[];
  copyToClipboard: (text: string) => void;
  setSelectedLink: (link: CustomerPortalLink) => void;
  setActivityOpen: (open: boolean) => void;
  revokeMutation: any;
}) {
  const pagination = usePagination(filtered);

  return (
    <div className="grid gap-3">
      {pagination.paginatedData.map((link) => (
        <Card key={link.id} data-testid={`card-link-${link.id}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm" data-testid={`text-link-customer-${link.id}`}>
                    {link.customer_name || link.company_name || "Unknown"}
                  </h3>
                  {link.company_name && link.customer_name && (
                    <span className="text-xs text-muted-foreground">{link.company_name}</span>
                  )}
                  <Badge
                    variant={link.is_revoked ? "destructive" : "secondary"}
                    data-testid={`badge-link-status-${link.id}`}
                  >
                    {link.is_revoked ? "Revoked" : "Active"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-muted-foreground font-mono" data-testid={`text-link-token-${link.id}`}>
                    {link.token.substring(0, 12)}...
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Eye className="h-3 w-3" />{link.view_count || 0} views
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />Last: {formatRelativeTime(link.last_viewed_at)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Created: {formatDate(link.created_at)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyToClipboard(getPortalUrl(link.token))}
                  data-testid={`button-copy-link-${link.id}`}
                  title="Copy full URL"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => window.open(getPortalUrl(link.token), "_blank")}
                  data-testid={`button-open-link-${link.id}`}
                  title="Open portal"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { setSelectedLink(link); setActivityOpen(true); }}
                  data-testid={`button-activity-${link.id}`}
                  title="View activity"
                >
                  <Activity className="h-4 w-4" />
                </Button>
                {!link.is_revoked && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { if (confirm("Revoke this link? The customer will no longer be able to access their portal.")) revokeMutation.mutate(link.id); }}
                    data-testid={`button-revoke-${link.id}`}
                    title="Revoke link"
                  >
                    <Ban className="h-4 w-4" />
                  </Button>
                )}
              </div>
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
