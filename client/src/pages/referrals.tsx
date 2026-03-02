import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users, Link2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ReferralPartner, Customer } from "@shared/schema";

export default function Referrals() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("all");

  const { data: partners = [], isLoading: partnersLoading } = useQuery<ReferralPartner[]>({
    queryKey: ["/api/referral-partners"],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const isLoading = partnersLoading || customersLoading;

  const referredCustomers = customers.filter(c => c.referral_partner_id);

  const getPartnerName = (id: number) => partners.find(p => p.id === id)?.full_name || `Partner #${id}`;
  const getPartnerCode = (id: number) => partners.find(p => p.id === id)?.referral_code || "";

  const filtered = referredCustomers.filter(c => {
    if (partnerFilter !== "all" && c.referral_partner_id !== Number(partnerFilter)) return false;
    if (search) {
      const s = search.toLowerCase();
      const customerName = (c.individual_name || c.company_name || "").toLowerCase();
      const partnerName = getPartnerName(c.referral_partner_id!).toLowerCase();
      if (!customerName.includes(s) && !partnerName.includes(s)) return false;
    }
    return true;
  });

  const activePartners = partners.filter(p => p.is_active);
  const totalReferred = referredCustomers.length;
  const partnersWithReferrals = [...new Set(referredCustomers.map(c => c.referral_partner_id))].length;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Referral code copied!" });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Referrals</h1>
        <p className="text-sm text-muted-foreground">Track which partners referred which customers</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <div className="text-2xl font-bold" data-testid="text-active-partners">{activePartners.length}</div>
                  <p className="text-xs text-muted-foreground">Active Partners</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Link2 className="h-8 w-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold" data-testid="text-total-referred">{totalReferred}</div>
                  <p className="text-xs text-muted-foreground">Total Referred Customers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-purple-500" />
                <div>
                  <div className="text-2xl font-bold" data-testid="text-partners-with-referrals">{partnersWithReferrals}</div>
                  <p className="text-xs text-muted-foreground">Partners with Referrals</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!isLoading && partners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Partners Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Referral Code</TableHead>
                  <TableHead className="text-right">Referred Customers</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map(p => {
                  const count = referredCustomers.filter(c => c.referral_partner_id === p.id).length;
                  return (
                    <TableRow key={p.id} data-testid={`row-partner-overview-${p.id}`}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{p.full_name}</span>
                          <span className="text-xs text-muted-foreground ml-2">@{p.username}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-xs">{p.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-mono text-xs cursor-pointer"
                          onClick={() => copyCode(p.referral_code)}
                          data-testid={`badge-code-${p.id}`}
                        >
                          {p.referral_code}
                          <Copy className="h-3 w-3 ml-1" />
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{count}</TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? "default" : "secondary"} className="text-xs">
                          {p.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by partner or customer name..."
            className="pl-9"
            data-testid="input-search-referrals"
          />
        </div>
        <Select value={partnerFilter} onValueChange={setPartnerFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-partner">
            <SelectValue placeholder="All Partners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Partners</SelectItem>
            {partners.map(p => (
              <SelectItem key={p.id} value={String(p.id)}>{p.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Card><CardContent className="pt-6"><Skeleton className="h-40" /></CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {referredCustomers.length === 0
                ? "No referred customers yet. Customers will appear here when assigned to a referral partner."
                : "No referrals match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Referred Customers ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Referred By</TableHead>
                  <TableHead>Referral Code</TableHead>
                  <TableHead>Partner Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id} data-testid={`row-referral-${c.id}`}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{c.individual_name || c.company_name}</span>
                        {c.company_name && c.individual_name && (
                          <span className="text-xs text-muted-foreground ml-2">({c.company_name})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{getPartnerName(c.referral_partner_id!)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {getPartnerCode(c.referral_partner_id!)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize text-xs">
                        {partners.find(p => p.id === c.referral_partner_id)?.type || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/customers/${c.id}`)}
                        data-testid={`button-view-customer-${c.id}`}
                      >
                        View Customer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
