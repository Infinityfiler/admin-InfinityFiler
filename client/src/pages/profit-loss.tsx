import { useState, useMemo, Fragment, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, TrendingDown, DollarSign, Percent, FileText, Download,
  ChevronDown, ChevronRight, ArrowUpDown, ExternalLink, Calculator,
  Search, X, Filter
} from "lucide-react";
import type { ProfitLossEntry, CompanySettings } from "@shared/schema";

interface PLSummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  avgMargin: number;
  totalEntries: number;
  profitable: number;
  losses: number;
  byMonth: { month: string; revenue: number; cost: number; profit: number; count: number }[];
  byCategory: { category: string; revenue: number; cost: number; profit: number }[];
  entries: ProfitLossEntry[];
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

function getQuarter(month: string) {
  const m = parseInt(month.split("-")[1], 10);
  if (m <= 3) return "Q1";
  if (m <= 6) return "Q2";
  if (m <= 9) return "Q3";
  return "Q4";
}

function getPresetDates(preset: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "this-month":
      return { from: `${y}-${String(m + 1).padStart(2, "0")}-01`, to: now.toISOString().split("T")[0] };
    case "last-month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const lastDay = new Date(ly, lm + 1, 0).getDate();
      return { from: `${ly}-${String(lm + 1).padStart(2, "0")}-01`, to: `${ly}-${String(lm + 1).padStart(2, "0")}-${lastDay}` };
    }
    case "this-quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return { from: `${y}-${String(qStart + 1).padStart(2, "0")}-01`, to: now.toISOString().split("T")[0] };
    }
    case "this-year":
      return { from: `${y}-01-01`, to: now.toISOString().split("T")[0] };
    case "last-year":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "all":
    default:
      return { from: "", to: "" };
  }
}

type SortKey = "entry_date" | "invoice_total" | "total_cost" | "total_profit" | "profit_margin";
type SortDir = "asc" | "desc";

export default function ProfitLoss() {
  const [dateFromInput, setDateFromInput] = useState("");
  const [dateToInput, setDateToInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [preset, setPreset] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("entry_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [profitFilter, setProfitFilter] = useState<"all" | "profitable" | "loss">("all");
  const [marginMin, setMarginMin] = useState("");
  const [marginMax, setMarginMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dateFromRef = useRef(dateFromInput);
  const dateToRef = useRef(dateToInput);

  const scheduleApply = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDateFrom(dateFromRef.current);
      setDateTo(dateToRef.current);
    }, 800);
  }, []);

  const handleDateFromChange = (val: string) => {
    setDateFromInput(val);
    dateFromRef.current = val;
    setPreset("custom");
    scheduleApply();
  };

  const handleDateToChange = (val: string) => {
    setDateToInput(val);
    dateToRef.current = val;
    setPreset("custom");
    scheduleApply();
  };

  const queryUrl = `/api/profit-loss${dateFrom || dateTo ? `?${dateFrom ? `startDate=${dateFrom}` : ""}${dateFrom && dateTo ? "&" : ""}${dateTo ? `endDate=${dateTo}` : ""}` : ""}`;

  const { data: summary, isLoading } = useQuery<PLSummary>({ queryKey: [queryUrl] });
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/settings"] });

  const handlePreset = (val: string) => {
    setPreset(val);
    const d = getPresetDates(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDateFromInput(d.from);
    setDateToInput(d.to);
    dateFromRef.current = d.from;
    dateToRef.current = d.to;
    setDateFrom(d.from);
    setDateTo(d.to);
  };

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setProfitFilter("all");
    setCategoryFilter("all");
    setMarginMin("");
    setMarginMax("");
  };

  const availableCategories = useMemo(() => {
    if (!summary?.entries) return [];
    const cats = new Set<string>();
    for (const e of summary.entries) {
      const breakdown = Array.isArray(e.cost_breakdown) ? e.cost_breakdown : [];
      for (const item of breakdown) {
        cats.add(item.category || item.service_name || "Uncategorized");
      }
    }
    return Array.from(cats).sort();
  }, [summary?.entries]);

  const hasActiveFilters = searchQuery || profitFilter !== "all" || categoryFilter !== "all" || marginMin || marginMax;

  const filteredEntries = useMemo(() => {
    if (!summary?.entries) return [];
    let entries = [...summary.entries];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      entries = entries.filter(e =>
        (e.invoice_number || "").toLowerCase().includes(q) ||
        (e.order_number || "").toLowerCase().includes(q) ||
        (e.company_name || "").toLowerCase().includes(q) ||
        (e.customer_name || "").toLowerCase().includes(q)
      );
    }

    if (profitFilter === "profitable") {
      entries = entries.filter(e => Number(e.total_profit) > 0);
    } else if (profitFilter === "loss") {
      entries = entries.filter(e => Number(e.total_profit) <= 0);
    }

    if (categoryFilter !== "all") {
      entries = entries.filter(e => {
        const breakdown = Array.isArray(e.cost_breakdown) ? e.cost_breakdown : [];
        return breakdown.some((item: any) => (item.category || item.service_name || "Uncategorized") === categoryFilter);
      });
    }

    if (marginMin) {
      const min = parseFloat(marginMin);
      if (!isNaN(min)) entries = entries.filter(e => Number(e.profit_margin) >= min);
    }
    if (marginMax) {
      const max = parseFloat(marginMax);
      if (!isNaN(max)) entries = entries.filter(e => Number(e.profit_margin) <= max);
    }

    return entries;
  }, [summary?.entries, searchQuery, profitFilter, categoryFilter, marginMin, marginMax]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      let va: number, vb: number;
      if (sortKey === "entry_date") {
        va = new Date(a.entry_date).getTime();
        vb = new Date(b.entry_date).getTime();
      } else {
        va = Number((a as any)[sortKey]);
        vb = Number((b as any)[sortKey]);
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
  }, [filteredEntries, sortKey, sortDir]);

  const quarterlyData = useMemo(() => {
    if (!summary?.byMonth) return [];
    const quarters: Record<string, { quarter: string; revenue: number; cost: number; profit: number; count: number }> = {};
    for (const m of summary.byMonth) {
      const q = `${m.month.split("-")[0]} ${getQuarter(m.month)}`;
      if (!quarters[q]) quarters[q] = { quarter: q, revenue: 0, cost: 0, profit: 0, count: 0 };
      quarters[q].revenue += m.revenue;
      quarters[q].cost += m.cost;
      quarters[q].profit += m.profit;
      quarters[q].count += m.count;
    }
    return Object.values(quarters);
  }, [summary?.byMonth]);

  const exportExcel = async () => {
    if (!summary) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      const summarySheet = XLSX.utils.json_to_sheet([{
        "Period": dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : dateFrom ? `From ${dateFrom}` : dateTo ? `Until ${dateTo}` : "All Time",
        "Total Revenue ($)": Number(summary.totalRevenue.toFixed(2)),
        "Total Cost ($)": Number(summary.totalCost.toFixed(2)),
        "Net Profit ($)": Number(summary.totalProfit.toFixed(2)),
        "Avg Margin (%)": Number(summary.avgMargin.toFixed(2)),
        "Total Entries": summary.totalEntries,
        "Profitable": summary.profitable,
        "Loss-Making": summary.losses,
      }]);
      XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

      if (summary.byMonth.length > 0) {
        const monthData = summary.byMonth.map(m => ({
          "Month": monthLabel(m.month),
          "Revenue ($)": Number(m.revenue.toFixed(2)),
          "Cost ($)": Number(m.cost.toFixed(2)),
          "Profit ($)": Number(m.profit.toFixed(2)),
          "Margin (%)": m.revenue > 0 ? Number(((m.profit / m.revenue) * 100).toFixed(2)) : 0,
          "Entries": m.count,
        }));
        monthData.push({
          "Month": "TOTAL",
          "Revenue ($)": Number(summary.totalRevenue.toFixed(2)),
          "Cost ($)": Number(summary.totalCost.toFixed(2)),
          "Profit ($)": Number(summary.totalProfit.toFixed(2)),
          "Margin (%)": Number(summary.avgMargin.toFixed(2)),
          "Entries": summary.totalEntries,
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthData), "Monthly Breakdown");
      }

      if (quarterlyData.length > 0) {
        const qData = quarterlyData.map(q => ({
          "Quarter": q.quarter,
          "Revenue ($)": Number(q.revenue.toFixed(2)),
          "Cost ($)": Number(q.cost.toFixed(2)),
          "Profit ($)": Number(q.profit.toFixed(2)),
          "Margin (%)": q.revenue > 0 ? Number(((q.profit / q.revenue) * 100).toFixed(2)) : 0,
          "Entries": q.count,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qData), "Quarterly Breakdown");
      }

      if (summary.byCategory.length > 0) {
        const catData = summary.byCategory.map(c => ({
          "Category": c.category || "Uncategorized",
          "Revenue ($)": Number(c.revenue.toFixed(2)),
          "Cost ($)": Number(c.cost.toFixed(2)),
          "Profit ($)": Number(c.profit.toFixed(2)),
          "Margin (%)": c.revenue > 0 ? Number(((c.profit / c.revenue) * 100).toFixed(2)) : 0,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catData), "By Category");
      }

      const entryData = sortedEntries.map(e => ({
        "Date": e.entry_date,
        "Invoice #": e.invoice_number,
        "Order #": e.order_number,
        "Customer": e.customer_name,
        "Company": e.company_name,
        "Revenue ($)": Number(Number(e.invoice_total).toFixed(2)),
        "Cost ($)": Number(Number(e.total_cost).toFixed(2)),
        "Profit ($)": Number(Number(e.total_profit).toFixed(2)),
        "Margin (%)": Number(Number(e.profit_margin).toFixed(2)),
        "Notes": e.notes || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(entryData), "Detailed Entries");

      const lineItems: any[] = [];
      for (const e of sortedEntries) {
        const breakdown = Array.isArray(e.cost_breakdown) ? e.cost_breakdown : [];
        for (const item of breakdown) {
          lineItems.push({
            "Invoice #": e.invoice_number,
            "Customer": e.customer_name,
            "Item Description": item.description,
            "Category": item.category || "N/A",
            "Revenue ($)": Number(Number(item.revenue).toFixed(2)),
            "Cost ($)": Number(Number(item.cost).toFixed(2)),
            "Profit ($)": Number(Number(item.profit).toFixed(2)),
          });
        }
      }
      if (lineItems.length > 0) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lineItems), "Line Item Details");
      }

      const dateStr = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : "all_time";
      XLSX.writeFile(wb, `ProfitLoss_${dateStr}.xlsx`);
    } catch (err) {
      console.error("Excel export failed:", err);
    }
  };

  const exportPDF = () => {
    if (!summary) return;
    const companyName = settings?.company_name || "Infinity Filer";
    const companyEmail = settings?.support_email || "";
    const companyPhone = settings?.phone || "";
    const periodLabel = dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : dateFrom ? `From ${dateFrom}` : dateTo ? `Until ${dateTo}` : "All Time";

    const monthRows = summary.byMonth.map(m => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${monthLabel(m.month)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${fmt(m.revenue)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${fmt(m.cost)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;color:${m.profit >= 0 ? '#166534' : '#991b1b'};font-weight:600;">$${fmt(m.profit)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(1) : '0.0'}%</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${m.count}</td>
      </tr>
    `).join("");

    const catRows = summary.byCategory.map(c => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${c.category || 'Uncategorized'}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${fmt(c.revenue)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${fmt(c.cost)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;color:${c.profit >= 0 ? '#166534' : '#991b1b'};font-weight:600;">$${fmt(c.profit)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${c.revenue > 0 ? ((c.profit / c.revenue) * 100).toFixed(1) : '0.0'}%</td>
      </tr>
    `).join("");

    const entryRows = sortedEntries.map(e => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;">${e.entry_date}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;">${e.invoice_number}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;">${e.order_number || '-'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;">${e.customer_name}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:right;">$${fmt(Number(e.invoice_total))}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:right;">$${fmt(Number(e.total_cost))}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:right;color:${Number(e.total_profit) >= 0 ? '#166534' : '#991b1b'};font-weight:600;">$${fmt(Number(e.total_profit))}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:right;">${Number(e.profit_margin).toFixed(1)}%</td>
      </tr>
    `).join("");

    const quarterRows = quarterlyData.map(q => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;">${q.quarter}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${fmt(q.revenue)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${fmt(q.cost)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;color:${q.profit >= 0 ? '#166534' : '#991b1b'};font-weight:600;">$${fmt(q.profit)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${q.revenue > 0 ? ((q.profit / q.revenue) * 100).toFixed(1) : '0.0'}%</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Profit & Loss Report - ${companyName}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; color:#1f2937; background:#fff; font-size:12px; }
      .page { max-width:900px; margin:0 auto; padding:32px; }
      h1 { font-size:24px; color:#1e3a5f; margin-bottom:4px; }
      h2 { font-size:16px; color:#1e3a5f; margin:24px 0 12px; border-bottom:2px solid #1e3a5f; padding-bottom:6px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:16px; border-bottom:3px solid #1e3a5f; }
      .meta { font-size:11px; color:#6b7280; }
      table { width:100%; border-collapse:collapse; margin-bottom:16px; }
      th { padding:8px; background:#1e3a5f; color:#fff; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; }
      th:first-child { text-align:left; }
      .summary-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:12px; margin-bottom:24px; }
      .summary-box { border:1px solid #e5e7eb; border-radius:8px; padding:16px; text-align:center; }
      .summary-box .label { font-size:10px; text-transform:uppercase; color:#6b7280; margin-bottom:4px; letter-spacing:1px; }
      .summary-box .value { font-size:20px; font-weight:700; }
      .footer { text-align:center; margin-top:32px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:10px; color:#9ca3af; }
      @media print { .page { padding:16px; } }
    </style></head><body><div class="page">
      <div class="header">
        <div><h1>${companyName}</h1><div class="meta">Profit & Loss Statement</div></div>
        <div style="text-align:right;"><div class="meta">Period: ${periodLabel}</div><div class="meta">Generated: ${new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" })}</div><div class="meta">${companyEmail}${companyPhone ? ` | ${companyPhone}` : ''}</div></div>
      </div>

      <div class="summary-grid">
        <div class="summary-box"><div class="label">Gross Revenue</div><div class="value">$${fmt(summary.totalRevenue)}</div></div>
        <div class="summary-box"><div class="label">Total Expenses</div><div class="value" style="color:#991b1b;">$${fmt(summary.totalCost)}</div></div>
        <div class="summary-box"><div class="label">Net Income</div><div class="value" style="color:${summary.totalProfit >= 0 ? '#166534' : '#991b1b'};">$${fmt(summary.totalProfit)}</div></div>
        <div class="summary-box"><div class="label">Profit Margin</div><div class="value">${summary.avgMargin.toFixed(1)}%</div></div>
      </div>

      ${quarterlyData.length > 0 ? `<h2>Quarterly Summary</h2>
      <table><thead><tr><th>Quarter</th><th style="text-align:right;">Revenue</th><th style="text-align:right;">Expenses</th><th style="text-align:right;">Net Income</th><th style="text-align:right;">Margin</th></tr></thead><tbody>${quarterRows}
      <tr style="background:#f1f5f9;font-weight:700;"><td style="padding:8px;">TOTAL</td><td style="padding:8px;text-align:right;">$${fmt(summary.totalRevenue)}</td><td style="padding:8px;text-align:right;">$${fmt(summary.totalCost)}</td><td style="padding:8px;text-align:right;color:${summary.totalProfit >= 0 ? '#166534' : '#991b1b'};">$${fmt(summary.totalProfit)}</td><td style="padding:8px;text-align:right;">${summary.avgMargin.toFixed(1)}%</td></tr></tbody></table>` : ''}

      ${summary.byMonth.length > 0 ? `<h2>Monthly Breakdown</h2>
      <table><thead><tr><th>Month</th><th style="text-align:right;">Revenue</th><th style="text-align:right;">Expenses</th><th style="text-align:right;">Net Income</th><th style="text-align:right;">Margin</th><th style="text-align:center;">Entries</th></tr></thead><tbody>${monthRows}
      <tr style="background:#f1f5f9;font-weight:700;"><td style="padding:8px;">TOTAL</td><td style="padding:8px;text-align:right;">$${fmt(summary.totalRevenue)}</td><td style="padding:8px;text-align:right;">$${fmt(summary.totalCost)}</td><td style="padding:8px;text-align:right;color:${summary.totalProfit >= 0 ? '#166534' : '#991b1b'};">$${fmt(summary.totalProfit)}</td><td style="padding:8px;text-align:right;">${summary.avgMargin.toFixed(1)}%</td><td style="padding:8px;text-align:center;">${summary.totalEntries}</td></tr></tbody></table>` : ''}

      ${summary.byCategory.length > 0 ? `<h2>By Service Category</h2>
      <table><thead><tr><th>Category</th><th style="text-align:right;">Revenue</th><th style="text-align:right;">Expenses</th><th style="text-align:right;">Net Income</th><th style="text-align:right;">Margin</th></tr></thead><tbody>${catRows}</tbody></table>` : ''}

      <h2>Detailed Entries</h2>
      <table><thead><tr><th>Date</th><th>Invoice</th><th>Order</th><th>Customer</th><th style="text-align:right;">Revenue</th><th style="text-align:right;">Expenses</th><th style="text-align:right;">Net Income</th><th style="text-align:right;">Margin</th></tr></thead><tbody>${entryRows}
      <tr style="background:#f1f5f9;font-weight:700;"><td style="padding:8px;" colspan="4">TOTALS</td><td style="padding:8px;text-align:right;">$${fmt(summary.totalRevenue)}</td><td style="padding:8px;text-align:right;">$${fmt(summary.totalCost)}</td><td style="padding:8px;text-align:right;color:${summary.totalProfit >= 0 ? '#166534' : '#991b1b'};">$${fmt(summary.totalProfit)}</td><td style="padding:8px;text-align:right;">${summary.avgMargin.toFixed(1)}%</td></tr></tbody></table>

      <div class="footer"><p>This is a computer-generated report. ${companyName}${companyEmail ? ` | ${companyEmail}` : ''}${companyPhone ? ` | ${companyPhone}` : ''}</p></div>
    </div></body></html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
  };

  const SortHeader = ({ label, field, align = "right" }: { label: string; field: SortKey; align?: string }) => (
    <th
      className={`p-3 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-primary/80 select-none ${align === "left" ? "text-left" : "text-right"}`}
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field && <ArrowUpDown className="h-3 w-3" />}
      </span>
    </th>
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Profit & Loss</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const s = summary || { totalRevenue: 0, totalCost: 0, totalProfit: 0, avgMargin: 0, totalEntries: 0, profitable: 0, losses: 0, byMonth: [], byCategory: [], entries: [] };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-pl-title">Profit & Loss</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel} data-testid="button-export-excel">
            <Download className="h-4 w-4 mr-1" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} data-testid="button-export-pdf">
            <FileText className="h-4 w-4 mr-1" />PDF
          </Button>
        </div>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <Label className="text-xs">Period</Label>
          <Select value={preset} onValueChange={handlePreset}>
            <SelectTrigger className="w-[150px]" data-testid="select-preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="this-quarter">This Quarter</SelectItem>
              <SelectItem value="this-year">This Year</SelectItem>
              <SelectItem value="last-year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFromInput} onChange={(e) => handleDateFromChange(e.target.value)} className="w-[160px]" data-testid="input-date-from" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateToInput} onChange={(e) => handleDateToChange(e.target.value)} className="w-[160px]" data-testid="input-date-to" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Gross Revenue</p>
            </div>
            <p className="text-xl font-bold" data-testid="text-total-revenue">${fmt(s.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Total Expenses</p>
            </div>
            <p className="text-xl font-bold text-red-600" data-testid="text-total-cost">${fmt(s.totalCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              {s.totalProfit >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
              <p className="text-xs text-muted-foreground">Net Income</p>
            </div>
            <p className={`text-xl font-bold ${s.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-net-profit">${fmt(s.totalProfit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="h-4 w-4 text-purple-500" />
              <p className="text-xs text-muted-foreground">Avg Margin</p>
            </div>
            <p className={`text-xl font-bold ${s.avgMargin >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-avg-margin">{s.avgMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Profitable</p>
            </div>
            <p className="text-xl font-bold text-green-600" data-testid="text-profitable">{s.profitable}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Loss-Making</p>
            </div>
            <p className="text-xl font-bold text-red-600" data-testid="text-losses">{s.losses}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Tax Summary — Income Statement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm py-1">
                <span className="text-muted-foreground">Gross Revenue (Sales)</span>
                <span className="font-semibold" data-testid="text-tax-revenue">${fmt(s.totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-muted-foreground">Less: Cost of Services (Expenses)</span>
                <span className="font-semibold text-red-600" data-testid="text-tax-cost">($${fmt(s.totalCost)})</span>
              </div>
              <div className="flex justify-between text-sm py-2 border-t-2 border-primary">
                <span className="font-bold">Net Income (Taxable Income)</span>
                <span className={`font-bold text-lg ${s.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-tax-net-income">${fmt(s.totalProfit)}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-muted-foreground">Total Transactions</span>
                <span className="font-medium">{s.totalEntries}</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-muted-foreground">Effective Margin</span>
                <span className="font-medium">{s.avgMargin.toFixed(2)}%</span>
              </div>
            </div>
            {quarterlyData.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Quarterly Breakdown</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 text-xs text-muted-foreground">Quarter</th>
                        <th className="text-right p-2 text-xs text-muted-foreground">Revenue</th>
                        <th className="text-right p-2 text-xs text-muted-foreground">Expenses</th>
                        <th className="text-right p-2 text-xs text-muted-foreground">Net Income</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quarterlyData.map((q) => (
                        <tr key={q.quarter} className="border-b">
                          <td className="p-2 font-medium">{q.quarter}</td>
                          <td className="p-2 text-right">${fmt(q.revenue)}</td>
                          <td className="p-2 text-right">${fmt(q.cost)}</td>
                          <td className={`p-2 text-right font-semibold ${q.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${fmt(q.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {s.byMonth.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Monthly Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider rounded-tl-md">Month</th>
                    <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Revenue</th>
                    <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Expenses</th>
                    <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Net Income</th>
                    <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Margin</th>
                    <th className="text-center p-3 text-xs font-semibold uppercase tracking-wider rounded-tr-md">Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {s.byMonth.map((m) => {
                    const margin = m.revenue > 0 ? (m.profit / m.revenue) * 100 : 0;
                    return (
                      <tr key={m.month} className="border-b hover:bg-muted/30" data-testid={`row-month-${m.month}`}>
                        <td className="p-3 font-medium">{monthLabel(m.month)}</td>
                        <td className="p-3 text-right">${fmt(m.revenue)}</td>
                        <td className="p-3 text-right">${fmt(m.cost)}</td>
                        <td className={`p-3 text-right font-semibold ${m.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${fmt(m.profit)}</td>
                        <td className={`p-3 text-right ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margin.toFixed(1)}%</td>
                        <td className="p-3 text-center">{m.count}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/50 font-bold">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right">${fmt(s.totalRevenue)}</td>
                    <td className="p-3 text-right">${fmt(s.totalCost)}</td>
                    <td className={`p-3 text-right ${s.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${fmt(s.totalProfit)}</td>
                    <td className={`p-3 text-right ${s.avgMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{s.avgMargin.toFixed(1)}%</td>
                    <td className="p-3 text-center">{s.totalEntries}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {s.byCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Profit by Service Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider rounded-tl-md">Category</th>
                    <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Revenue</th>
                    <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Expenses</th>
                    <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Net Income</th>
                    <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider rounded-tr-md">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {s.byCategory.map((c) => {
                    const margin = c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0;
                    return (
                      <tr key={c.category} className="border-b hover:bg-muted/30" data-testid={`row-category-${c.category || 'uncategorized'}`}>
                        <td className="p-3 font-medium">{c.category || "Uncategorized"}</td>
                        <td className="p-3 text-right">${fmt(c.revenue)}</td>
                        <td className="p-3 text-right">${fmt(c.cost)}</td>
                        <td className={`p-3 text-right font-semibold ${c.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${fmt(c.profit)}</td>
                        <td className={`p-3 text-right ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margin.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Detailed Entries ({sortedEntries.length})</CardTitle>
            {sortedEntries.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setExpandedRows(expandedRows.size === sortedEntries.length ? new Set() : new Set(sortedEntries.map(e => e.id)))} data-testid="button-expand-all">
                {expandedRows.size === sortedEntries.length ? "Collapse All" : "Expand All"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Invoice #, Order #, Company, or Customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
                data-testid="input-search"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="button-clear-search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} data-testid="button-toggle-filters" className={hasActiveFilters ? "border-primary text-primary" : ""}>
              <Filter className="h-4 w-4 mr-1" />
              Filters
              {hasActiveFilters && <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">!</Badge>}
            </Button>
          </div>
          {showFilters && (
            <div className="flex items-end gap-3 flex-wrap pt-2 border-t">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={profitFilter} onValueChange={(v) => setProfitFilter(v as "all" | "profitable" | "loss")}>
                  <SelectTrigger className="w-[140px]" data-testid="select-profit-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entries</SelectItem>
                    <SelectItem value="profitable">Profitable</SelectItem>
                    <SelectItem value="loss">Loss-Making</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="select-category-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {availableCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Min Margin (%)</Label>
                <Input type="number" placeholder="e.g. 10" value={marginMin} onChange={(e) => setMarginMin(e.target.value)} className="w-[110px]" data-testid="input-margin-min" />
              </div>
              <div>
                <Label className="text-xs">Max Margin (%)</Label>
                <Input type="number" placeholder="e.g. 50" value={marginMax} onChange={(e) => setMarginMax(e.target.value)} className="w-[110px]" data-testid="input-margin-max" />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} data-testid="button-clear-filters" className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4 mr-1" />Clear Filters
                </Button>
              )}
            </div>
          )}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>Showing {filteredEntries.length} of {summary?.entries?.length || 0} entries</span>
              {searchQuery && <Badge variant="secondary" className="text-xs">Search: "{searchQuery}"</Badge>}
              {profitFilter !== "all" && <Badge variant="secondary" className="text-xs">{profitFilter === "profitable" ? "Profitable only" : "Loss-making only"}</Badge>}
              {categoryFilter !== "all" && <Badge variant="secondary" className="text-xs">Category: {categoryFilter}</Badge>}
              {marginMin && <Badge variant="secondary" className="text-xs">Margin &ge; {marginMin}%</Badge>}
              {marginMax && <Badge variant="secondary" className="text-xs">Margin &le; {marginMax}%</Badge>}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {sortedEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No profit/loss entries found for this period. Mark invoices as "Paid" to create entries.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="p-3 w-8 rounded-tl-md"></th>
                    <SortHeader label="Date" field="entry_date" align="left" />
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Invoice</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Order</th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider">Customer</th>
                    <SortHeader label="Revenue" field="invoice_total" />
                    <SortHeader label="Cost" field="total_cost" />
                    <SortHeader label="Profit" field="total_profit" />
                    <SortHeader label="Margin" field="profit_margin" />
                    <th className="p-3 text-xs font-semibold uppercase tracking-wider rounded-tr-md text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry) => {
                    const isExpanded = expandedRows.has(entry.id);
                    const breakdown = Array.isArray(entry.cost_breakdown) ? entry.cost_breakdown : [];
                    return (
                      <Fragment key={entry.id}>
                        <tr className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => toggleRow(entry.id)} data-testid={`row-entry-${entry.id}`}>
                          <td className="p-3">
                            {breakdown.length > 0 && (isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
                          </td>
                          <td className="p-3 whitespace-nowrap">{new Date(entry.entry_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</td>
                          <td className="p-3">
                            <Link href={`/invoices/${entry.invoice_id}`} onClick={(e) => e.stopPropagation()}>
                              <span className="text-blue-600 hover:underline font-medium" data-testid={`link-invoice-${entry.id}`}>{entry.invoice_number}</span>
                            </Link>
                          </td>
                          <td className="p-3">
                            {entry.order_number ? (
                              <span className="text-muted-foreground text-xs">{entry.order_number}</span>
                            ) : "-"}
                          </td>
                          <td className="p-3">
                            <div>
                              <p className="font-medium text-xs">{entry.customer_name}</p>
                              {entry.company_name && <p className="text-xs text-muted-foreground">{entry.company_name}</p>}
                            </div>
                          </td>
                          <td className="p-3 text-right">${fmt(Number(entry.invoice_total))}</td>
                          <td className="p-3 text-right text-red-600">${fmt(Number(entry.total_cost))}</td>
                          <td className={`p-3 text-right font-semibold ${Number(entry.total_profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>${fmt(Number(entry.total_profit))}</td>
                          <td className="p-3 text-right">
                            <Badge variant={Number(entry.profit_margin) >= 0 ? "default" : "destructive"} className={`text-xs ${Number(entry.profit_margin) >= 0 ? 'bg-green-100 text-green-800 border-green-200' : ''}`}>
                              {Number(entry.profit_margin).toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Link href={`/invoices/${entry.invoice_id}`} onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" data-testid={`button-view-invoice-${entry.id}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                        {isExpanded && breakdown.length > 0 && (
                          <tr className="bg-muted/20">
                            <td colSpan={10} className="p-0">
                              <div className="px-12 py-3">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b">
                                      <th className="text-left p-2 text-muted-foreground font-medium">Item</th>
                                      <th className="text-left p-2 text-muted-foreground font-medium">Category</th>
                                      <th className="text-right p-2 text-muted-foreground font-medium">Revenue</th>
                                      <th className="text-right p-2 text-muted-foreground font-medium">Cost</th>
                                      <th className="text-right p-2 text-muted-foreground font-medium">Profit</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {breakdown.map((item, idx) => (
                                      <tr key={idx} className="border-b border-dashed">
                                        <td className="p-2">{item.description}</td>
                                        <td className="p-2 text-muted-foreground">{item.category || "-"}</td>
                                        <td className="p-2 text-right">${fmt(Number(item.revenue))}</td>
                                        <td className="p-2 text-right text-red-600">${fmt(Number(item.cost))}</td>
                                        <td className={`p-2 text-right font-medium ${Number(item.profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>${fmt(Number(item.profit))}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {entry.notes && (
                                  <p className="text-xs text-muted-foreground mt-2 italic">Notes: {entry.notes}</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  <tr className="bg-muted/50 font-bold">
                    <td className="p-3" colSpan={5}>Totals</td>
                    <td className="p-3 text-right">${fmt(s.totalRevenue)}</td>
                    <td className="p-3 text-right text-red-600">${fmt(s.totalCost)}</td>
                    <td className={`p-3 text-right ${s.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${fmt(s.totalProfit)}</td>
                    <td className="p-3 text-right">{s.avgMargin.toFixed(1)}%</td>
                    <td className="p-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
