import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, Pencil, Plus, DollarSign, Clock, CheckCircle2, TrendingUp, Share2, Copy, ExternalLink, FileText, XCircle, ShieldCheck } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { Invoice, InvoiceItem, InvoicePayment, CompanySettings, PaymentMethod, Customer, ReferralPartner, PartnerServiceRate, Service, ProfitLossCostItem, ProfitLossEntry, SmtpAccount, CustomerPortalLink, PaymentProof } from "@shared/schema";
import logoPath from "@assets/logo_1772131777440.png";

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getStatusStyle(status: string) {
  switch (status) {
    case "paid": return { bg: "#dcfce7", color: "#166534", label: "PAID" };
    case "pending": return { bg: "#fef3c7", color: "#92400e", label: "PENDING" };
    case "partial-paid": return { bg: "#dbeafe", color: "#1e40af", label: "PARTIAL PAID" };
    case "overdue": return { bg: "#fee2e2", color: "#991b1b", label: "OVERDUE" };
    case "cancelled": return { bg: "#f3f4f6", color: "#6b7280", label: "CANCELLED" };
    case "archived": return { bg: "#e2e8f0", color: "#475569", label: "ARCHIVED" };
    default: return { bg: "#f3f4f6", color: "#6b7280", label: status.toUpperCase() };
  }
}

export default function InvoiceDetail() {
  const [, params] = useRoute("/invoices/:id");
  const id = Number(params?.id);
  const { toast } = useToast();

  const { data: invoice, isLoading } = useQuery<Invoice>({ queryKey: [`/api/invoices/${id}`], enabled: !!id });
  const { data: items = [] } = useQuery<InvoiceItem[]>({ queryKey: [`/api/invoices/${id}/items`], enabled: !!id });
  const { data: payments = [] } = useQuery<InvoicePayment[]>({ queryKey: [`/api/invoices/${id}/payments`], enabled: !!id });
  const { data: settings } = useQuery<CompanySettings>({ queryKey: ["/api/settings"] });
  const { data: exchangeRate } = useQuery<{ rate: number; lastUpdated: string }>({ queryKey: ["/api/exchange-rate"] });
  const { data: customer } = useQuery<Customer>({ queryKey: [`/api/customers/${invoice?.customer_id}`], enabled: !!invoice?.customer_id });
  const { data: referralPartner } = useQuery<ReferralPartner>({ queryKey: [`/api/referral-partners/${customer?.referral_partner_id}`], enabled: !!customer?.referral_partner_id });
  const { data: partnerRates = [] } = useQuery<PartnerServiceRate[]>({ queryKey: [`/api/referral-partners/${customer?.referral_partner_id}/service-rates`], enabled: !!customer?.referral_partner_id });
  const { data: allServices = [] } = useQuery<Service[]>({ queryKey: ["/api/services"], enabled: partnerRates.length > 0 });
  const { data: existingPl } = useQuery<ProfitLossEntry>({ queryKey: [`/api/profit-loss/invoice/${id}`], enabled: !!id });
  const { data: paymentProofs = [] } = useQuery<PaymentProof[]>({ queryKey: [`/api/invoices/${id}/payment-proofs`], enabled: !!id });

  const referralName = referralPartner?.full_name || customer?.referred_by || "";

  const getOriginalPrice = (item: InvoiceItem): { originalPrice: number; discountLabel: string } | null => {
    if (partnerRates.length > 0 && item.service_id) {
      const rate = partnerRates.find(r => r.service_id === item.service_id);
      if (rate && Number(rate.discount_value) > 0) {
        const service = allServices.find(s => s.id === item.service_id);
        if (service) {
          let catalogPrice: number;
          if (service.type === "state_specific") {
            catalogPrice = Number(service.state_fee) + Number(service.agent_fee) + Number(service.unique_address) + Number(service.vyke_number) + Number(service.service_charges);
          } else {
            catalogPrice = Number(service.service_charges);
          }
          if (catalogPrice > Number(item.unit_price)) {
            const discountValue = Number(rate.discount_value);
            const label = rate.discount_type === "percentage" ? `${discountValue}% partner discount` : `$${discountValue.toFixed(2)} partner discount`;
            return { originalPrice: catalogPrice, discountLabel: label };
          }
        }
      }
    }
    if (item.partner_discount_label && item.original_price != null) {
      return { originalPrice: Number(item.original_price), discountLabel: item.partner_discount_label };
    }
    return null;
  };

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payAmountUsd, setPayAmountUsd] = useState("");
  const [payAmountPkr, setPayAmountPkr] = useState("");
  const [payServiceDesc, setPayServiceDesc] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payNextDueDate, setPayNextDueDate] = useState("");
  const [lastEditedCurrency, setLastEditedCurrency] = useState<"usd" | "pkr">("usd");

  const [plOpen, setPlOpen] = useState(false);
  const [plCosts, setPlCosts] = useState<Record<number, string>>({});
  const [plNotes, setPlNotes] = useState("");
  const [plPendingStatusUpdate, setPlPendingStatusUpdate] = useState(false);

  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyProof, setVerifyProof] = useState<PaymentProof | null>(null);
  const [verifyType, setVerifyType] = useState<"full" | "partial">("full");
  const [verifyPartialAmount, setVerifyPartialAmount] = useState("");
  const [declineProofId, setDeclineProofId] = useState<number | null>(null);
  const [declineNote, setDeclineNote] = useState("");

  const [shareOpen, setShareOpen] = useState(false);
  const [portalLink, setPortalLink] = useState<CustomerPortalLink | null>(null);
  const [shareEmailSubject, setShareEmailSubject] = useState("");
  const [shareEmailBody, setShareEmailBody] = useState("");
  const [shareSmtp, setShareSmtp] = useState<number>(0);
  const [shareTarget, setShareTarget] = useState<"customer" | "partner">("customer");

  const { data: smtpAccounts = [] } = useQuery<SmtpAccount[]>({ queryKey: ["/api/smtp-accounts"] });

  const portalLinkMutation = useMutation({
    mutationFn: async () => {
      if (!invoice?.customer_id) throw new Error("No customer");
      const res = await apiRequest("POST", "/api/portal-links", {
        customer_id: invoice.customer_id,
        customer_name: invoice.customer_name,
        company_name: invoice.company_name,
      });
      return res.json();
    },
    onSuccess: (data: CustomerPortalLink) => {
      setPortalLink(data);
      const portalUrl = `${window.location.origin}/portal/${data.token}`;
      const defaultSmtp = smtpAccounts.find(a => a.is_default) || smtpAccounts[0];
      setShareSmtp(defaultSmtp?.id || 0);
      setShareEmailSubject(`Invoice ${invoice?.invoice_number} - ${invoice?.company_name || ""}`);
      setShareEmailBody(
        `Dear ${invoice?.customer_name || ""},\n\n` +
        `Please find your invoice ${invoice?.invoice_number} for $${Number(invoice?.total || 0).toFixed(2)}.\n\n` +
        `You can view your invoices, orders, and manage your profile through your customer portal:\n${portalUrl}\n\n` +
        `Best regards,\nInfinity Filer`
      );
      setShareOpen(true);
    },
    onError: (e) => toast({ title: "Error generating portal link", description: e.message, variant: "destructive" }),
  });

  const shareEmailMutation = useMutation({
    mutationFn: async () => {
      if (!invoice?.customer_email) throw new Error("Customer has no email");
      if (!shareSmtp) throw new Error("Select an SMTP account");
      await apiRequest("POST", "/api/send-email", {
        smtp_account_id: shareSmtp,
        to_emails: [invoice.customer_email],
        subject: shareEmailSubject,
        body: shareEmailBody,
      });
    },
    onSuccess: () => {
      toast({ title: "Email sent successfully" });
      setShareOpen(false);
    },
    onError: (e) => toast({ title: "Failed to send email", description: e.message, variant: "destructive" }),
  });

  const getPortalUrl = () => portalLink ? `${window.location.origin}/portal/${portalLink.token}` : "";

  const handleShareWhatsApp = () => {
    const portalUrl = getPortalUrl();
    let phone = "";
    let msg = "";

    if (shareTarget === "partner" && referralPartner) {
      phone = referralPartner.phone?.replace(/[^0-9]/g, "") || "";
      msg = encodeURIComponent(
        `Hi ${referralPartner.full_name},\n\n` +
        `Invoice ${invoice?.invoice_number} for $${Number(invoice?.total || 0).toFixed(2)} is ready for your referred customer ${invoice?.customer_name || ""} (${invoice?.company_name || ""}).\n\n` +
        `Customer Portal:\n${portalUrl}\n\n` +
        `Thank you!\nInfinity Filer`
      );
    } else {
      phone = invoice?.customer_phone?.replace(/[^0-9]/g, "") || "";
      phone = phone.startsWith("0") ? "92" + phone.slice(1) : phone;
      msg = encodeURIComponent(
        `Hi ${invoice?.customer_name || ""},\n\n` +
        `Here is your invoice ${invoice?.invoice_number} for $${Number(invoice?.total || 0).toFixed(2)}.\n\n` +
        `View your invoices, orders & profile:\n${portalUrl}\n\n` +
        `Thank you!\nInfinity Filer`
      );
    }
    if (phone) window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const openPartnerWhatsApp = () => {
    if (!referralPartner?.phone) return;
    const phone = referralPartner.phone.replace(/[^0-9]/g, "");
    const msg = encodeURIComponent(
      `Hi ${referralPartner.full_name},\n\n` +
      `Regarding invoice ${invoice?.invoice_number || ""} for your referred customer ${invoice?.customer_name || ""} (${invoice?.company_name || ""}).\n\n` +
      `Total: $${Number(invoice?.total || 0).toFixed(2)}\nStatus: ${invoice?.status || ""}`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  const liveRate = exchangeRate?.rate || 0;
  const invoiceRate = invoice?.pkr_enabled ? Number(invoice.pkr_rate) || 0 : 0;
  const invoiceTaxRate = invoice?.pkr_enabled ? Number(invoice.pkr_tax_rate) || 0 : 0;
  const currentRate = invoiceRate > 0 ? invoiceRate : liveRate;

  const selectedItemHasTax = (() => {
    if (!payServiceDesc || payServiceDesc === "general") return false;
    const itemId = Number(payServiceDesc);
    const matchedItem = !isNaN(itemId) ? items.find(i => i.id === itemId) : items.find(i => i.description === payServiceDesc);
    return matchedItem?.currency_tax === true;
  })();

  const getEffectiveRate = (forTaxedService: boolean) => {
    if (!invoiceRate || invoiceRate <= 0) return liveRate;
    if (forTaxedService && invoiceTaxRate > 0) {
      return invoiceRate * (1 + invoiceTaxRate / 100);
    }
    return invoiceRate;
  };

  const paymentEffectiveRate = getEffectiveRate(selectedItemHasTax);

  const handleUsdChange = (val: string) => {
    setPayAmountUsd(val);
    setLastEditedCurrency("usd");
    if (val && paymentEffectiveRate > 0) {
      setPayAmountPkr((Number(val) * paymentEffectiveRate).toFixed(2));
    } else {
      setPayAmountPkr("");
    }
  };

  const handlePkrChange = (val: string) => {
    setPayAmountPkr(val);
    setLastEditedCurrency("pkr");
    if (val && paymentEffectiveRate > 0) {
      setPayAmountUsd((Number(val) / paymentEffectiveRate).toFixed(2));
    } else {
      setPayAmountUsd("");
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/invoices/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Invoice updated" });
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      const usd = Number(payAmountUsd || 0);
      if (usd <= 0) throw new Error("Enter a valid amount");
      let serviceDescription = payServiceDesc;
      if (payServiceDesc && payServiceDesc !== "general") {
        const matchedItem = items.find(i => i.id === Number(payServiceDesc));
        serviceDescription = matchedItem?.description || payServiceDesc;
      }
      const res = await apiRequest("POST", `/api/invoices/${id}/payments`, {
        amount_usd: usd,
        amount_pkr: Number(payAmountPkr || 0),
        pkr_rate: paymentEffectiveRate,
        pkr_base_rate: invoiceRate || 0,
        pkr_tax_rate: selectedItemHasTax ? invoiceTaxRate : 0,
        service_description: serviceDescription,
        note: payNote,
        next_due_date: payNextDueDate,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/payments`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setPaymentOpen(false);
      setPayAmountUsd("");
      setPayAmountPkr("");
      setPayServiceDesc("");
      setPayNote("");
      setPayNextDueDate("");
      toast({ title: "Payment recorded" });
      if (data?.invoice?.status === "paid") {
        setPlPendingStatusUpdate(false);
        queryClient.invalidateQueries({ queryKey: [`/api/profit-loss/invoice/${id}`] }).then(() => {
          openPlDialog();
        });
      }
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openPlDialog = () => {
    if (existingPl?.id) {
      toast({ title: "P&L entry already exists for this invoice" });
      return false;
    }
    if (items.length === 0) {
      toast({ title: "Invoice items not loaded yet", description: "Please try again in a moment", variant: "destructive" });
      return false;
    }
    const costs: Record<number, string> = {};
    items.forEach((item) => { costs[item.id] = ""; });
    setPlCosts(costs);
    setPlNotes("");
    setPlOpen(true);
    return true;
  };

  const plTotalRevenue = items.reduce((sum, item) => sum + Number(item.total), 0);
  const plTotalCost = Object.values(plCosts).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const plTotalProfit = plTotalRevenue - plTotalCost;
  const plProfitMargin = plTotalRevenue > 0 ? (plTotalProfit / plTotalRevenue) * 100 : 0;

  const plMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) throw new Error("No invoice");
      const costBreakdown: ProfitLossCostItem[] = items.map((item) => ({
        description: item.description,
        service_id: item.service_id || null,
        service_name: item.description,
        category: item.state || "",
        revenue: Number(item.total),
        cost: Number(plCosts[item.id] || 0),
        profit: Number(item.total) - Number(plCosts[item.id] || 0),
      }));

      await apiRequest("POST", "/api/profit-loss", {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        order_number: invoice.order_number || "",
        customer_name: invoice.customer_name,
        company_name: invoice.company_name || "",
        invoice_total: Number(invoice.total),
        total_cost: plTotalCost,
        total_profit: plTotalProfit,
        profit_margin: plProfitMargin,
        cost_breakdown: costBreakdown,
        notes: plNotes,
        entry_date: new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profit-loss"] });
      queryClient.invalidateQueries({ queryKey: [`/api/profit-loss/invoice/${id}`] });
      setPlOpen(false);
      toast({ title: "Profit/Loss entry saved" });
      if (plPendingStatusUpdate) {
        updateMutation.mutate("paid");
        setPlPendingStatusUpdate(false);
      }
    },
    onError: (e) => {
      toast({ title: "Error saving P&L", description: e.message, variant: "destructive" });
    },
  });

  const handleSkipPl = () => {
    setPlOpen(false);
    if (plPendingStatusUpdate) {
      updateMutation.mutate("paid");
      setPlPendingStatusUpdate(false);
    }
  };

  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!declineProofId) throw new Error("No proof selected");
      await apiRequest("PATCH", `/api/payment-proofs/${declineProofId}`, {
        status: "declined",
        admin_note: declineNote,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/payment-proofs`] });
      setDeclineProofId(null);
      setDeclineNote("");
      toast({ title: "Payment proof declined" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!verifyProof || !invoice) throw new Error("No proof selected");
      const totalDueNow = Number(invoice.total);
      const paidNow = Number(invoice.amount_paid || 0);
      const remainingNow = totalDueNow - paidNow;

      const paymentAmount = verifyType === "full" ? remainingNow : Number(verifyPartialAmount || 0);
      if (paymentAmount <= 0) throw new Error("Enter a valid amount");

      const payRes = await apiRequest("POST", `/api/invoices/${id}/payments`, {
        amount_usd: paymentAmount,
        amount_pkr: 0,
        pkr_rate: 0,
        service_description: `Payment proof verified (#${verifyProof.id})`,
        note: `Proof: ${verifyProof.file_name}`,
      });
      const payData = await payRes.json();

      await apiRequest("PATCH", `/api/payment-proofs/${verifyProof.id}`, {
        status: "verified",
        admin_note: verifyType === "full" ? "Full payment verified" : `Partial payment of $${paymentAmount.toFixed(2)} verified`,
      });

      return payData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/payments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}/payment-proofs`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setVerifyOpen(false);
      setVerifyProof(null);
      setVerifyPartialAmount("");
      setVerifyType("full");
      toast({ title: "Payment verified and recorded" });
      if (data?.invoice?.status === "paid") {
        setPlPendingStatusUpdate(false);
        queryClient.invalidateQueries({ queryKey: [`/api/profit-loss/invoice/${id}`] }).then(() => {
          openPlDialog();
        });
      }
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const exportPDF = async () => {
    if (!invoice) return;

    const logoImg = document.querySelector("#invoice-logo-src") as HTMLImageElement | null;
    let logoDataUrl = "";
    if (logoImg) {
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          if (logoImg.complete && logoImg.naturalWidth > 0) { resolve(logoImg); return; }
          const fresh = new Image();
          fresh.crossOrigin = "anonymous";
          fresh.onload = () => resolve(fresh);
          fresh.onerror = reject;
          fresh.src = logoImg.src;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          logoDataUrl = canvas.toDataURL("image/png");
        }
      } catch (_) {}
    }

    const ss = getStatusStyle(invoice.status);
    const companyName = esc(settings?.company_name || "Infinity Filer");
    const companyAddr = esc(settings?.address);
    const companyPhone = esc(settings?.phone);
    const companyEmail = esc(settings?.support_email);

    const itemRows = items.map(item => {
      const includesHtml = item.includes && item.includes.length > 0
        ? `<tr><td colspan="5" style="padding:0 12px 10px 12px;border:none;">
             <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 12px;font-size:11px;color:#166534;">
               <strong>What's Included:</strong> ${item.includes.map(i => esc(i)).join(" &bull; ")}
             </div>
           </td></tr>`
        : "";
      const discountInfo = getOriginalPrice(item);
      const priceHtml = discountInfo
        ? `<span style="text-decoration:line-through;color:#9ca3af;font-size:11px;margin-right:4px;">$${discountInfo.originalPrice.toFixed(2)}</span>$${Number(item.unit_price).toFixed(2)}<br/><span style="display:inline-block;font-size:9px;padding:1px 6px;background:#dcfce7;color:#15803d;border:1px solid #bbf7d0;border-radius:3px;margin-top:2px;">${esc(discountInfo.discountLabel)}</span>`
        : `$${Number(item.unit_price).toFixed(2)}`;
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;">${esc(item.description)}${item.llc_type ? ` <span style="display:inline-block;font-size:9px;padding:1px 5px;border:1px solid #c4b5fd;color:#6d28d9;border-radius:3px;margin-left:6px;vertical-align:middle;">${item.llc_type === 'single-member' ? 'Single-Member LLC' : 'Multi-Member LLC'}</span>` : ''}${invoice.pkr_enabled && item.currency_tax ? ' <span style="display:inline-block;font-size:9px;padding:1px 5px;border:1px solid #a7f3d0;color:#047857;border-radius:3px;margin-left:6px;vertical-align:middle;">Tax</span>' : ''}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;text-align:center;">${esc(item.state) || "-"}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;text-align:center;">${item.quantity}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;text-align:right;">${priceHtml}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#1f2937;text-align:right;font-weight:600;">$${Number(item.total).toFixed(2)}</td>
        </tr>
        ${includesHtml}
      `;
    }).join("");

    const hasDiscount = Number(invoice.discount_amount) > 0;
    const discountLabel = Number(invoice.discount_percentage) > 0
      ? `Discount (${invoice.discount_percentage}%)`
      : "Discount";

    const amountPaid = Number(invoice.amount_paid || 0);
    const remaining = Math.max(0, Number(invoice.total) - amountPaid);

    const paymentHistoryHtml = payments.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Payment History</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px;text-align:left;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">Date</th>
            <th style="padding:8px;text-align:right;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">USD</th>
            <th style="padding:8px;text-align:right;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">PKR</th>
            <th style="padding:8px;text-align:right;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">Rate</th>
            <th style="padding:8px;text-align:right;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">Tax</th>
            <th style="padding:8px;text-align:left;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">Service</th>
            <th style="padding:8px;text-align:left;font-weight:600;color:#475569;border-bottom:1px solid #e2e8f0;">Note</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map(p => {
            const hasTax = Number(p.pkr_tax_rate) > 0;
            const baseRate = Number(p.pkr_base_rate) || Number(p.pkr_rate);
            const taxRate = Number(p.pkr_tax_rate);
            const taxAmount = hasTax && Number(p.amount_pkr) > 0
              ? Number(p.amount_usd) * baseRate * (taxRate / 100)
              : 0;
            return `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#374151;">${new Date(p.payment_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#374151;font-weight:600;">$${Number(p.amount_usd).toFixed(2)}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#374151;">${Number(p.amount_pkr) > 0 ? `PKR ${Number(p.amount_pkr).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : '-'}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:#374151;">${Number(p.pkr_rate) > 0 ? Number(p.pkr_rate).toFixed(2) : '-'}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:${hasTax ? '#d97706' : '#6b7280'};">${hasTax ? `${taxRate}% (PKR ${taxAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : '-'}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#6b7280;">${esc(p.service_description) || '-'}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#6b7280;">${esc(p.note) || '-'}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:8px;font-size:13px;">
        <div style="width:250px;">
          <div style="display:flex;justify-content:space-between;padding:4px 0;color:#374151;"><span>Total Paid</span><span style="font-weight:700;color:#166534;">$${amountPaid.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;color:#374151;border-top:1px solid #e2e8f0;"><span>Remaining</span><span style="font-weight:700;color:#991b1b;">$${remaining.toFixed(2)}</span></div>
        </div>
      </div>
    </div>` : "";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${esc(invoice.invoice_number)} - ${companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; background: #fff; }
    .page { max-width: 800px; margin: 0 auto; padding: 48px 40px; }

    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #1e3a5f; }
    .company-block { display: flex; align-items: center; gap: 14px; }
    .company-logo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 2px solid #e5e7eb; }
    .company-name { font-size: 22px; font-weight: 700; color: #1e3a5f; margin-bottom: 2px; }
    .company-detail { font-size: 11px; color: #6b7280; line-height: 1.6; }

    .invoice-title-block { text-align: right; }
    .invoice-title { font-size: 32px; font-weight: 800; color: #1e3a5f; letter-spacing: 2px; margin-bottom: 6px; }
    .invoice-num { font-size: 14px; color: #374151; font-weight: 600; }
    .invoice-order { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    .status-badge { display: inline-block; padding: 5px 16px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-top: 10px; }

    .meta-grid { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .meta-col { flex: 1; }
    .meta-col.right { text-align: right; }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af; font-weight: 600; margin-bottom: 6px; }
    .meta-value { font-size: 14px; color: #1f2937; font-weight: 600; }
    .meta-sub { font-size: 12px; color: #6b7280; line-height: 1.5; }

    .date-row { font-size: 12px; color: #6b7280; margin-bottom: 3px; }
    .date-label { color: #9ca3af; font-weight: 600; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #1e3a5f; }
    thead th { padding: 12px; font-size: 11px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.8px; }
    thead th:first-child { text-align: left; border-radius: 6px 0 0 0; }
    thead th:last-child { border-radius: 0 6px 0 0; }

    .totals-section { display: flex; justify-content: flex-end; margin-bottom: 32px; }
    .totals-box { width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 13px; color: #374151; }
    .total-row.discount { color: #16a34a; }
    .total-row.grand { border-top: 2px solid #1e3a5f; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 800; color: #1e3a5f; }
    .discount-note { font-size: 11px; color: #16a34a; font-style: italic; text-align: right; margin-top: -4px; margin-bottom: 4px; }

    .payment-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
    .payment-title { font-size: 13px; font-weight: 700; color: #1e3a5f; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .payment-row { font-size: 12px; color: #475569; line-height: 1.8; }
    .payment-label { font-weight: 600; color: #64748b; display: inline-block; width: 130px; }

    .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .notes-title { font-size: 12px; font-weight: 700; color: #92400e; margin-bottom: 6px; }
    .notes-text { font-size: 12px; color: #78716c; line-height: 1.5; }

    .terms-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .terms-title { font-size: 12px; font-weight: 700; color: #1e3a5f; margin-bottom: 6px; }
    .terms-text { font-size: 11px; color: #64748b; line-height: 1.6; }

    .footer { text-align: center; padding-top: 24px; border-top: 1px solid #e5e7eb; }
    .footer-thanks { font-size: 16px; font-weight: 700; color: #1e3a5f; margin-bottom: 6px; }
    .footer-info { font-size: 11px; color: #9ca3af; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 24px 32px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="company-block">
        ${logoDataUrl ? `<img src="${logoDataUrl}" class="company-logo" />` : ""}
        <div>
          <div class="company-name">${companyName}</div>
          <div class="company-detail">${companyAddr}</div>
          <div class="company-detail">${companyPhone}${companyEmail ? ` | ${companyEmail}` : ""}</div>
        </div>
      </div>
      <div class="invoice-title-block">
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-num">${esc(invoice.invoice_number)}</div>
        <div class="invoice-order">Order: ${esc(invoice.order_number)}</div>
        <div class="status-badge" style="background:${ss.bg};color:${ss.color};">${ss.label}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <div class="meta-label">Bill To</div>
        <div class="meta-value">${esc(invoice.company_name || invoice.customer_name)}</div>
        ${invoice.company_name ? `<div class="meta-sub">${esc(invoice.customer_name)}</div>` : ""}
        <div class="meta-sub">${esc(invoice.customer_email)}</div>
        <div class="meta-sub">${esc(invoice.customer_phone)}</div>
      </div>
      ${referralPartner || referralName ? `
      <div class="meta-col">
        <div class="meta-label">Referred By</div>
        <div class="meta-value">${esc(referralPartner?.full_name || referralName)}</div>
        ${referralPartner?.company_name ? `<div class="meta-sub" style="font-weight:600;">${esc(referralPartner.company_name)}</div>` : ""}
        ${referralPartner?.phone ? `<div class="meta-sub">${esc(referralPartner.phone)}</div>` : ""}
        ${referralPartner?.email ? `<div class="meta-sub">${esc(referralPartner.email)}</div>` : ""}
        ${referralPartner?.referral_code ? `<div class="meta-sub">Code: ${esc(referralPartner.referral_code)}</div>` : ""}
      </div>` : ""}
      <div class="meta-col right">
        <div class="date-row"><span class="date-label">Invoice Date:</span> ${new Date(invoice.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
        ${invoice.due_date ? `<div class="date-row"><span class="date-label">Due Date:</span> ${invoice.due_date}</div>` : ""}
        <div class="date-row" style="margin-top:8px;"><span class="date-label">Status:</span> <span style="background:${ss.bg};color:${ss.color};padding:2px 10px;border-radius:10px;font-size:11px;font-weight:700;">${ss.label}</span></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="text-align:left;">Description</th>
          <th style="text-align:center;">State</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Unit Price</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="totals-section">
      <div class="totals-box">
        <div class="total-row"><span>Subtotal</span><span>$${Number(invoice.subtotal).toFixed(2)}</span></div>
        ${hasDiscount ? `<div class="total-row discount"><span>${discountLabel}</span><span>-$${Number(invoice.discount_amount).toFixed(2)}</span></div>` : ""}
        ${invoice.discount_note ? `<div class="discount-note">${esc(invoice.discount_note)}</div>` : ""}
        <div class="total-row grand"><span>Total Due</span><span>$${Number(invoice.total).toFixed(2)}</span></div>
        ${amountPaid > 0 ? `
        <div class="total-row" style="color:#166534;"><span>Amount Paid</span><span>-$${amountPaid.toFixed(2)}</span></div>
        <div class="total-row" style="font-weight:700;color:#991b1b;border-top:1px solid #e5e7eb;padding-top:6px;"><span>Remaining Balance</span><span>$${remaining.toFixed(2)}</span></div>
        ` : ""}
      </div>
    </div>

    ${invoice.pkr_enabled && Number(invoice.pkr_rate) > 0 ? (() => {
      const fmtPkr = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const taxedCount = items.filter(i => i.currency_tax && Number(i.unit_price) > 0).length;
      const totalCount = items.filter(i => Number(i.unit_price) > 0).length;
      return `
    <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:20px;margin-bottom:24px;">
      <div style="font-size:13px;font-weight:700;color:#065f46;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Payment in PKR</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#475569;line-height:2;">
        <span>USD $${Number(invoice.total).toFixed(2)} x ${Number(invoice.pkr_rate).toFixed(2)}</span>
        <span style="font-weight:600;">PKR ${fmtPkr(Number(invoice.pkr_amount))}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#475569;line-height:2;">
        <span>Currency Conversion Tax (${Number(invoice.pkr_tax_rate)}%) <span style="font-size:10px;">(${taxedCount}/${totalCount} items)</span></span>
        <span style="font-weight:600;">PKR ${fmtPkr(Number(invoice.pkr_tax_amount))}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:#065f46;border-top:2px solid #a7f3d0;margin-top:8px;padding-top:10px;">
        <span>Total Payable in PKR</span>
        <span>PKR ${fmtPkr(Number(invoice.pkr_total))}</span>
      </div>
      <div style="font-size:10px;color:#6b7280;margin-top:8px;">Exchange rate: 1 USD = ${Number(invoice.pkr_rate).toFixed(2)} PKR (at time of invoice)</div>
    </div>`;
    })() : ""}

    ${paymentHistoryHtml}

    ${(() => {
      const methods: PaymentMethod[] = invoice.payment_methods_snapshot || [];
      if (methods.length > 0) {
        return methods.map(m => `
          <div class="payment-box" style="margin-bottom:8px;">
            <div class="payment-title">${esc(m.label || m.bank_name || "Payment Method")} ${m.currency ? `<span style="font-size:10px;color:#6b7280;">(${esc(m.currency)})</span>` : ""}</div>
            ${m.type === "bank_account" ? `
              ${m.bank_name ? `<div class="payment-row"><span class="payment-label">Bank:</span> ${esc(m.bank_name)}</div>` : ""}
              ${m.account_holder ? `<div class="payment-row"><span class="payment-label">Account Holder:</span> ${esc(m.account_holder)}</div>` : ""}
              ${m.account_number ? `<div class="payment-row"><span class="payment-label">Account #:</span> ${esc(m.account_number)}</div>` : ""}
              ${m.iban ? `<div class="payment-row"><span class="payment-label">IBAN:</span> ${esc(m.iban)}</div>` : ""}
              ${m.details ? Object.entries(m.details).map(([k, v]) => `<div class="payment-row"><span class="payment-label">${esc(k)}:</span> ${esc(v)}</div>`).join("") : ""}
            ` : `
              ${m.link_url ? `<div class="payment-row"><span class="payment-label">Link:</span> <a href="${esc(m.link_url)}" style="color:#2563eb;">${esc(m.link_url)}</a></div>` : ""}
            `}
          </div>
        `).join("");
      }
      if (settings) {
        return `
          <div class="payment-box">
            <div class="payment-title">Payment Information</div>
            <div class="payment-row"><span class="payment-label">Bank Name:</span> ${esc(settings.bank_name)}</div>
            <div class="payment-row"><span class="payment-label">Account Holder:</span> ${esc(settings.account_holder)}</div>
            <div class="payment-row"><span class="payment-label">Account Number:</span> ${esc(settings.account_number)}</div>
            <div class="payment-row"><span class="payment-label">IBAN:</span> ${esc(settings.iban)}</div>
          </div>
        `;
      }
      return "";
    })()}

    ${invoice.notes ? `
    <div class="notes-box">
      <div class="notes-title">Notes</div>
      <div class="notes-text">${esc(invoice.notes)}</div>
    </div>
    ` : ""}

    <div class="payment-box" style="background:#fef9c3;border-color:#facc15;">
      <div class="payment-title" style="color:#854d0e;">Payment Verification</div>
      <div style="font-size:11px;color:#713f12;line-height:1.6;">
        Once payment is done, please take a screenshot of the payment as proof and send it via WhatsApp to <strong>+92 320 3682461</strong> to verify your payment and start your order. Please mention your Invoice ID <strong>${esc(invoice.invoice_number)}</strong> to confirm your payment.
      </div>
    </div>

    <div class="terms-box">
      <div class="terms-title">Terms & Conditions</div>
      <div class="terms-text">
        1. Payment is due by the due date specified on this invoice.<br>
        2. Late payments may result in service suspension or delays in processing.<br>
        3. Partial payments are accepted only if you have chosen multiple services. Single service requires full payment in advance.<br>
        4. All amounts are in USD unless otherwise specified.<br>
        5. PKR amounts are calculated based on the exchange rate at the time of invoice creation.<br>
        6. Services will be delivered upon receipt of full payment unless otherwise agreed.<br>
        7. Refunds are processed according to our refund policy.<br>
        8. For questions regarding this invoice, please contact ${companyEmail || 'support'}.
      </div>
    </div>

    ${portalLink ? `
    <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:16px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:6px;">Customer Portal</div>
      <div style="font-size:11px;color:#1e40af;">View your orders, invoices & manage your profile:</div>
      <a href="${window.location.origin}/portal/${portalLink.token}" style="font-size:12px;color:#2563eb;word-break:break-all;">${window.location.origin}/portal/${portalLink.token}</a>
    </div>
    ` : ""}

    <div class="footer">
      <div class="footer-thanks">Thank you for your business!</div>
      <div class="footer-info">${companyName} | ${companyEmail} | ${companyPhone}</div>
    </div>
  </div>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => w.print();
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-64" /></div>;
  if (!invoice) return <div className="p-6">Invoice not found</div>;

  const ss = getStatusStyle(invoice.status);
  const amountPaid = Number(invoice.amount_paid || 0);
  const totalDue = Number(invoice.total);
  const remaining = totalDue - amountPaid;
  const paidPercentage = totalDue > 0 ? Math.min((amountPaid / totalDue) * 100, 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/invoices"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <h1 className="text-2xl font-bold" data-testid="text-invoice-detail-number">{invoice.invoice_number}</h1>
          <Badge variant={invoice.status === "paid" ? "default" : invoice.status === "partial-paid" ? "default" : "secondary"} className={invoice.status === "partial-paid" ? "bg-blue-100 text-blue-800 border-blue-200" : invoice.status === "archived" ? "bg-slate-200 text-slate-600 border-slate-300" : ""}>{invoice.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={invoice.status} onValueChange={(val) => {
            if (val === "partial-paid") {
              setPaymentOpen(true);
              return;
            }
            if (val === "paid") {
              setPlPendingStatusUpdate(true);
              if (!openPlDialog()) {
                setPlPendingStatusUpdate(false);
                updateMutation.mutate("paid");
              }
              return;
            }
            updateMutation.mutate(val);
          }}>
            <SelectTrigger className="w-[160px]" data-testid="select-update-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial-paid">Partial Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setPaymentOpen(true)}>
            <DollarSign className="h-4 w-4 mr-2" />Record Payment
          </Button>
          <Button variant="outline" onClick={() => portalLinkMutation.mutate()} disabled={portalLinkMutation.isPending} data-testid="button-share-invoice">
            <Share2 className="h-4 w-4 mr-2" />{portalLinkMutation.isPending ? "Loading..." : "Share"}
          </Button>
          {referralPartner && referralPartner.phone && (
            <Button variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={openPartnerWhatsApp} data-testid="button-contact-partner">
              <SiWhatsapp className="h-4 w-4 mr-2" />Contact Partner
            </Button>
          )}
          <Link href={`/invoices/${id}/edit`}><Button variant="outline"><Pencil className="h-4 w-4 mr-2" />Edit</Button></Link>
          <Button variant="secondary" onClick={exportPDF} data-testid="button-export-pdf"><Download className="h-4 w-4 mr-2" />PDF</Button>
        </div>
      </div>

      <img
        id="invoice-logo-src"
        src={logoPath}
        alt=""
        crossOrigin="anonymous"
        className="hidden"
      />

      {(amountPaid > 0 || invoice.status === "partial-paid") && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {paidPercentage >= 100 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock className="h-5 w-5 text-blue-600" />
                )}
                <span className="font-semibold text-sm">Payment Progress</span>
              </div>
              <span className="text-sm font-bold">{paidPercentage.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-3">
              <div
                className={`h-2.5 rounded-full transition-all ${paidPercentage >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${paidPercentage}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-sm font-bold">${totalDue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="text-sm font-bold text-green-600">${amountPaid.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="text-sm font-bold text-red-600">${remaining > 0 ? remaining.toFixed(2) : "0.00"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <img src={logoPath} alt="Infinity Filer" className="h-14 w-14 rounded-full border-2 border-muted" />
              <div>
                <h2 className="text-xl font-bold text-primary">{settings?.company_name || "Infinity Filer"}</h2>
                <p className="text-xs text-muted-foreground">{settings?.address}</p>
                <p className="text-xs text-muted-foreground">{settings?.phone} | {settings?.support_email}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-extrabold tracking-wider text-primary">INVOICE</h2>
              <p className="text-sm font-semibold text-foreground mt-1">{invoice.invoice_number}</p>
              <p className="text-xs text-muted-foreground">Order: {invoice.order_number}</p>
              <span
                className="inline-block mt-2 px-4 py-1 rounded-full text-xs font-bold"
                style={{ backgroundColor: ss.bg, color: ss.color }}
                data-testid="badge-invoice-status"
              >
                {ss.label}
              </span>
            </div>
          </div>

          <div className={`grid gap-6 pt-2 ${referralPartner || referralName ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"}`}>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Bill To</p>
              <p className="font-semibold text-foreground">{invoice.company_name || invoice.customer_name}</p>
              {invoice.company_name && <p className="text-sm text-foreground">{invoice.customer_name}</p>}
              <p className="text-sm text-muted-foreground">{invoice.customer_email}</p>
              <p className="text-sm text-muted-foreground">{invoice.customer_phone}</p>
            </div>
            {(referralPartner || referralName) && (
              <div data-testid="text-invoice-referral">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Referred By</p>
                <p className="font-semibold text-foreground">{referralPartner?.full_name || referralName}</p>
                {referralPartner?.company_name && <p className="text-sm text-foreground">{referralPartner.company_name}</p>}
                {referralPartner?.phone && <p className="text-sm text-muted-foreground">{referralPartner.phone}</p>}
                {referralPartner?.email && <p className="text-sm text-muted-foreground">{referralPartner.email}</p>}
                {referralPartner?.referral_code && <p className="text-sm text-muted-foreground">Code: {referralPartner.referral_code}</p>}
              </div>
            )}
            <div className="text-right space-y-1">
              <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Invoice Date:</span> {new Date(invoice.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
              {invoice.due_date && <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Due Date:</span> {invoice.due_date}</p>}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider rounded-tl-md">Description</th>
                  <th className="text-center p-3 text-xs font-semibold uppercase tracking-wider">State</th>
                  <th className="text-center p-3 text-xs font-semibold uppercase tracking-wider">Qty</th>
                  <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider">Unit Price</th>
                  <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider rounded-tr-md">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span>{item.description}</span>
                        {item.llc_type && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-violet-300 text-violet-700 dark:text-violet-400 shrink-0">
                            {item.llc_type === 'single-member' ? 'Single-Member LLC' : 'Multi-Member LLC'}
                          </Badge>
                        )}
                        {invoice.pkr_enabled && item.currency_tax && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-300 text-emerald-700 dark:text-emerald-400 shrink-0">Tax</Badge>
                        )}
                      </div>
                      {item.includes && item.includes.length > 0 && (
                        <div className="mt-1.5 p-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-xs text-green-800 dark:text-green-300">
                          <span className="font-semibold">Includes:</span> {item.includes.join(" | ")}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center text-muted-foreground">{item.state || "-"}</td>
                    <td className="p-3 text-center">{item.quantity}</td>
                    <td className="p-3 text-right">
                      {(() => {
                        const discountInfo = getOriginalPrice(item);
                        if (discountInfo) {
                          return (
                            <div>
                              <span className="text-xs text-muted-foreground line-through mr-1">${discountInfo.originalPrice.toFixed(2)}</span>
                              <span>${Number(item.unit_price).toFixed(2)}</span>
                              <div>
                                <Badge variant="secondary" className="text-[9px] bg-green-100 text-green-700 border-green-200 mt-0.5" data-testid={`badge-invoice-partner-discount-${item.id}`}>
                                  {discountInfo.discountLabel}
                                </Badge>
                              </div>
                            </div>
                          );
                        }
                        return <span>${Number(item.unit_price).toFixed(2)}</span>;
                      })()}
                    </td>
                    <td className="p-3 text-right font-semibold">${Number(item.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-72 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>${Number(invoice.subtotal).toFixed(2)}</span></div>
              {Number(invoice.discount_amount) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount {Number(invoice.discount_percentage) > 0 ? `(${invoice.discount_percentage}%)` : ""}</span>
                  <span>-${Number(invoice.discount_amount).toFixed(2)}</span>
                </div>
              )}
              {invoice.discount_note && <p className="text-xs text-green-600 italic text-right">{invoice.discount_note}</p>}
              <div className="flex justify-between text-xl font-extrabold border-t-2 border-primary pt-3 mt-2"><span>Total Due</span><span>${Number(invoice.total).toFixed(2)}</span></div>
              {amountPaid > 0 && (
                <>
                  <div className="flex justify-between text-sm text-green-600"><span>Amount Paid</span><span>-${amountPaid.toFixed(2)}</span></div>
                  <div className="flex justify-between text-base font-bold text-red-600 border-t pt-2"><span>Remaining</span><span>${remaining > 0 ? remaining.toFixed(2) : "0.00"}</span></div>
                </>
              )}
            </div>
          </div>

          {invoice.pkr_enabled && Number(invoice.pkr_rate) > 0 && (() => {
            const fmtPkr = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const taxedCount = items.filter(i => i.currency_tax && Number(i.unit_price) > 0).length;
            const totalCount = items.filter(i => Number(i.unit_price) > 0).length;
            return (
              <div className="p-5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-300" data-testid="text-pkr-title">Payment in PKR</h4>
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_auto] gap-2 text-sm">
                    <span className="text-muted-foreground">USD ${Number(invoice.total).toFixed(2)} x {Number(invoice.pkr_rate).toFixed(2)}</span>
                    <span className="font-medium text-right" data-testid="text-pkr-converted">PKR {fmtPkr(Number(invoice.pkr_amount))}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Currency Conversion Tax ({Number(invoice.pkr_tax_rate)}%)
                      <span className="text-[10px] ml-1">({taxedCount}/{totalCount} items)</span>
                    </span>
                    <span className="font-medium text-right" data-testid="text-pkr-tax">PKR {fmtPkr(Number(invoice.pkr_tax_amount))}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2 text-base font-bold border-t border-emerald-300 dark:border-emerald-700 pt-2">
                    <span className="text-emerald-800 dark:text-emerald-300">Total Payable in PKR</span>
                    <span className="text-emerald-800 dark:text-emerald-300 text-right" data-testid="text-pkr-total">PKR {fmtPkr(Number(invoice.pkr_total))}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1" data-testid="text-pkr-rate-info">
                    Exchange rate: 1 USD = {Number(invoice.pkr_rate).toFixed(2)} PKR (at time of invoice)
                  </p>
                </div>
              </div>
            );
          })()}

          {paymentProofs.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wide text-primary flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Payment Proofs
              </h4>
              <div className="space-y-2">
                {paymentProofs.map((proof) => {
                  const proofStatusStyle = proof.status === "verified"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                    : proof.status === "declined"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
                  return (
                    <div key={proof.id} className="flex items-center gap-3 p-3 rounded-lg border bg-accent/30 flex-wrap" data-testid={`card-proof-${proof.id}`}>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" data-testid={`text-proof-date-${proof.id}`}>
                            {new Date(proof.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </span>
                          <Badge variant="secondary" className={`text-[10px] ${proofStatusStyle}`} data-testid={`badge-proof-status-${proof.id}`}>
                            {proof.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                          <span data-testid={`text-proof-amount-${proof.id}`}>Amount claimed: <span className="font-semibold text-foreground">${Number(proof.amount_claimed).toFixed(2)}</span></span>
                          {proof.dropbox_view_link ? (
                            <a
                              href={proof.dropbox_view_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1"
                              data-testid={`link-proof-file-${proof.id}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                              {proof.file_name}
                            </a>
                          ) : (
                            <span>{proof.file_name}</span>
                          )}
                        </div>
                        {proof.admin_note && (
                          <p className="text-xs text-muted-foreground italic" data-testid={`text-proof-note-${proof.id}`}>Note: {proof.admin_note}</p>
                        )}
                      </div>
                      {proof.status === "pending" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white no-default-hover-elevate"
                            onClick={() => {
                              setVerifyProof(proof);
                              setVerifyType("full");
                              setVerifyPartialAmount("");
                              setVerifyOpen(true);
                            }}
                            data-testid={`button-verify-proof-${proof.id}`}
                          >
                            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-300 dark:border-red-700"
                            onClick={() => {
                              setDeclineProofId(proof.id);
                              setDeclineNote("");
                            }}
                            data-testid={`button-decline-proof-${proof.id}`}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Decline
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {payments.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wide text-primary">Payment History</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground">#</th>
                      <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground">Date</th>
                      <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground">USD</th>
                      <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground">PKR</th>
                      <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground">Rate</th>
                      <th className="text-right p-2.5 text-xs font-semibold text-muted-foreground">Tax</th>
                      <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground">Service</th>
                      <th className="text-left p-2.5 text-xs font-semibold text-muted-foreground">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, idx) => {
                      const hasTax = Number(p.pkr_tax_rate) > 0;
                      const baseRate = Number(p.pkr_base_rate) || Number(p.pkr_rate);
                      const taxRate = Number(p.pkr_tax_rate);
                      const taxAmount = hasTax && Number(p.amount_pkr) > 0
                        ? Number(p.amount_usd) * baseRate * (taxRate / 100)
                        : 0;
                      return (
                      <tr key={p.id} className="border-b">
                        <td className="p-2.5 text-xs text-muted-foreground">{payments.length - idx}</td>
                        <td className="p-2.5 text-xs">
                          {new Date(p.payment_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        </td>
                        <td className="p-2.5 text-right font-semibold text-green-600">${Number(p.amount_usd).toFixed(2)}</td>
                        <td className="p-2.5 text-right text-muted-foreground">
                          {Number(p.amount_pkr) > 0 ? `PKR ${Number(p.amount_pkr).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-"}
                        </td>
                        <td className="p-2.5 text-right text-xs text-muted-foreground">
                          {Number(p.pkr_rate) > 0 ? Number(p.pkr_rate).toFixed(2) : "-"}
                        </td>
                        <td className="p-2.5 text-right text-xs">
                          {hasTax ? (
                            <span className="text-amber-600 dark:text-amber-400" title={`Base rate: ${baseRate.toFixed(2)} + ${taxRate}% tax`}>
                              {taxRate}% (PKR {taxAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                            </span>
                          ) : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="p-2.5 text-xs text-muted-foreground">{p.service_description || "-"}</td>
                        <td className="p-2.5 text-xs text-muted-foreground">{p.note || "-"}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(() => {
            const methods: PaymentMethod[] = invoice.payment_methods_snapshot || [];
            if (methods.length > 0) {
              return (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-primary">Payment Information</h4>
                  {methods.map((m, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-accent/40 border space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{m.label || m.bank_name || "Payment Method"}</span>
                        {m.currency && <span className="text-xs text-muted-foreground">({m.currency})</span>}
                      </div>
                      {m.type === "bank_account" && (
                        <div className="grid grid-cols-[130px_1fr] gap-y-1 text-sm mt-1">
                          {m.bank_name && <><span className="text-muted-foreground font-medium">Bank:</span><span>{m.bank_name}</span></>}
                          {m.account_holder && <><span className="text-muted-foreground font-medium">Account Holder:</span><span>{m.account_holder}</span></>}
                          {m.account_number && <><span className="text-muted-foreground font-medium">Account #:</span><span>{m.account_number}</span></>}
                          {m.iban && <><span className="text-muted-foreground font-medium">IBAN:</span><span>{m.iban}</span></>}
                          {m.details && Object.entries(m.details).map(([k, v]) => (
                            <><span key={k} className="text-muted-foreground font-medium">{k}:</span><span>{v}</span></>
                          ))}
                        </div>
                      )}
                      {m.type === "payment_link" && m.link_url && (
                        <a href={m.link_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{m.link_url}</a>
                      )}
                    </div>
                  ))}
                </div>
              );
            }
            if (settings) {
              return (
                <div className="p-5 rounded-lg bg-accent/40 border space-y-1">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-primary">Payment Information</h4>
                  <div className="grid grid-cols-[130px_1fr] gap-y-1 text-sm mt-2">
                    <span className="text-muted-foreground font-medium">Bank Name:</span><span>{settings.bank_name}</span>
                    <span className="text-muted-foreground font-medium">Account Holder:</span><span>{settings.account_holder}</span>
                    <span className="text-muted-foreground font-medium">Account Number:</span><span>{settings.account_number}</span>
                    <span className="text-muted-foreground font-medium">IBAN:</span><span>{settings.iban}</span>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {invoice.notes && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-1">Notes</h4>
              <p className="text-sm text-amber-700 dark:text-amber-400">{invoice.notes}</p>
            </div>
          )}

          <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-700">
            <h4 className="text-xs font-bold text-yellow-800 dark:text-yellow-300 mb-1">Payment Verification</h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 leading-relaxed">
              Once payment is done, please take a screenshot of the payment as proof and send it via WhatsApp to <span className="font-bold">+92 320 3682461</span> to verify your payment and start your order. Please mention your Invoice ID <span className="font-bold">{invoice.invoice_number}</span> to confirm your payment.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-bold text-primary mb-2">Terms & Conditions</h4>
            <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
              <li>Payment is due by the due date specified on this invoice.</li>
              <li>Late payments may result in service suspension or delays in processing.</li>
              <li>Partial payments are accepted only if you have chosen multiple services. Single service requires full payment in advance.</li>
              <li>All amounts are in USD unless otherwise specified.</li>
              <li>PKR amounts are calculated based on the exchange rate at the time of invoice creation.</li>
              <li>Services will be delivered upon receipt of full payment unless otherwise agreed.</li>
              <li>Refunds are processed according to our refund policy.</li>
              <li>For questions regarding this invoice, please contact {settings?.support_email || "support"}.</li>
            </ol>
          </div>

          {portalLink && (
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <h4 className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-2">Customer Portal</h4>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-xs bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded break-all" data-testid="text-portal-link-url">
                  {getPortalUrl()}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(getPortalUrl());
                    toast({ title: "Portal link copied!" });
                  }}
                  data-testid="button-copy-portal-link"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">Customer can view orders, invoices & manage their profile</p>
            </div>
          )}

          <div className="text-center border-t pt-5">
            <p className="text-base font-bold text-primary">Thank you for your business!</p>
            <p className="text-xs text-muted-foreground mt-1">{settings?.company_name || "Infinity Filer"} | {settings?.support_email} | {settings?.phone}</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-accent/50 space-y-1">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Invoice Total</span><span className="font-bold">${totalDue.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Already Paid</span><span className="font-bold text-green-600">${amountPaid.toFixed(2)}</span></div>
              <div className="flex justify-between text-sm border-t pt-1"><span className="text-muted-foreground">Remaining</span><span className="font-bold text-red-600">${remaining > 0 ? remaining.toFixed(2) : "0.00"}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount (USD)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={payAmountUsd}
                  onChange={(e) => handleUsdChange(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Amount (PKR)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={payAmountPkr}
                  onChange={(e) => handlePkrChange(e.target.value)}
                />
              </div>
            </div>
            {paymentEffectiveRate > 0 && (
              <p className="text-[10px] text-muted-foreground -mt-2" data-testid="text-payment-rate-info">
                {invoiceRate > 0 ? (
                  <>
                    Rate: 1 USD = {invoiceRate.toFixed(2)} PKR (invoice rate)
                    {selectedItemHasTax && invoiceTaxRate > 0 ? ` + ${invoiceTaxRate}% tax = ${paymentEffectiveRate.toFixed(2)} PKR` : ""}
                  </>
                ) : (
                  <>Rate: 1 USD = {liveRate.toFixed(2)} PKR (live rate)</>
                )}
                {lastEditedCurrency === "pkr" && payAmountPkr ? " — converted from PKR" : ""}
                {lastEditedCurrency === "usd" && payAmountUsd ? " — converted from USD" : ""}
              </p>
            )}

            <div>
              <Label className="text-xs">For Service</Label>
              <Select value={payServiceDesc} onValueChange={(val) => {
                setPayServiceDesc(val);
                const isNewTaxed = (() => {
                  if (!val || val === "general") return false;
                  const matchedItem = items.find(i => i.id === Number(val));
                  return matchedItem?.currency_tax === true;
                })();
                const newRate = getEffectiveRate(isNewTaxed);
                if (newRate > 0) {
                  if (lastEditedCurrency === "usd" && payAmountUsd) {
                    setPayAmountPkr((Number(payAmountUsd) * newRate).toFixed(2));
                  } else if (lastEditedCurrency === "pkr" && payAmountPkr) {
                    setPayAmountUsd((Number(payAmountPkr) / newRate).toFixed(2));
                  }
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select service (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Payment</SelectItem>
                  {items.filter(i => Number(i.unit_price) > 0).map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.description} (${Number(item.total).toFixed(2)}){invoice?.pkr_enabled && item.currency_tax ? " — Tax" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {invoice?.pkr_enabled && selectedItemHasTax && (
                <p className="text-[10px] text-emerald-600 mt-1 font-medium" data-testid="text-currency-tax-indicator">
                  Currency conversion tax ({invoiceTaxRate}%) applied to this service
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs">Note</Label>
              <Input
                placeholder="Payment note (optional)"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs">Next Due Date (for remaining balance)</Label>
              <Input
                type="date"
                value={payNextDueDate}
                onChange={(e) => setPayNextDueDate(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Updates the invoice due date for remaining payments</p>
            </div>

            <Button
              className="w-full"
              onClick={() => paymentMutation.mutate()}
              disabled={paymentMutation.isPending || !payAmountUsd || Number(payAmountUsd) <= 0}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              {paymentMutation.isPending ? "Recording..." : `Record Payment $${Number(payAmountUsd || 0).toFixed(2)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={plOpen} onOpenChange={(open) => {
        if (!open) {
          handleSkipPl();
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Profit & Loss Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-accent/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-semibold" data-testid="text-pl-invoice-number">{invoice?.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{invoice?.customer_name}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-1 mt-1">
                <span className="text-muted-foreground">Invoice Total</span>
                <span className="font-bold">${Number(invoice?.total || 0).toFixed(2)}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Cost per Line Item</Label>
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-pl-item-${item.id}`}>{item.description}</p>
                    <p className="text-xs text-muted-foreground">Revenue: ${Number(item.total).toFixed(2)}</p>
                  </div>
                  <div className="w-28 shrink-0">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Cost"
                      value={plCosts[item.id] || ""}
                      onChange={(e) => setPlCosts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      data-testid={`input-pl-cost-${item.id}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="p-3 rounded-md bg-accent/50 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Revenue</span>
                <span className="font-semibold" data-testid="text-pl-revenue">${plTotalRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Cost</span>
                <span className="font-semibold text-red-600" data-testid="text-pl-cost">${plTotalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-1">
                <span className="text-muted-foreground">Total Profit</span>
                <span className={`font-bold ${plTotalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-pl-profit">
                  ${plTotalProfit.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Profit Margin</span>
                <span className={`font-semibold ${plProfitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-pl-margin">
                  {plProfitMargin.toFixed(1)}%
                </span>
              </div>
            </div>

            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Input
                placeholder="Any notes about this P&L entry"
                value={plNotes}
                onChange={(e) => setPlNotes(e.target.value)}
                data-testid="input-pl-notes"
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => plMutation.mutate()}
                disabled={plMutation.isPending}
                data-testid="button-pl-save"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                {plMutation.isPending ? "Saving..." : "Save & Mark as Paid"}
              </Button>
              <Button
                variant="outline"
                onClick={handleSkipPl}
                disabled={plMutation.isPending}
                data-testid="button-pl-skip"
              >
                Skip
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share Invoice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-accent/50">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-semibold">{invoice?.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{invoice?.customer_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">${Number(invoice?.total || 0).toFixed(2)}</span>
              </div>
              {referralPartner && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Partner</span>
                  <span className="font-medium">{referralPartner.full_name}</span>
                </div>
              )}
            </div>

            {referralPartner && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Share With</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={shareTarget === "customer" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShareTarget("customer")}
                    data-testid="button-share-target-customer"
                  >
                    Customer
                  </Button>
                  <Button
                    variant={shareTarget === "partner" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShareTarget("partner")}
                    data-testid="button-share-target-partner"
                  >
                    Partner ({referralPartner.full_name})
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Portal Link</Label>
              <div className="flex items-center gap-2">
                <Input value={getPortalUrl()} readOnly className="text-xs font-mono" data-testid="input-share-portal-url" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(getPortalUrl());
                    toast({ title: "Link copied!" });
                  }}
                  data-testid="button-share-copy-link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Tabs defaultValue="whatsapp">
              <TabsList className="w-full">
                <TabsTrigger value="whatsapp" className="flex-1" data-testid="tab-share-whatsapp">
                  <SiWhatsapp className="h-4 w-4 mr-1" />WhatsApp
                </TabsTrigger>
                <TabsTrigger value="email" className="flex-1" data-testid="tab-share-email">
                  Email
                </TabsTrigger>
              </TabsList>
              <TabsContent value="whatsapp" className="space-y-3 mt-3">
                <p className="text-sm text-muted-foreground">
                  Send invoice details and portal link via WhatsApp to {shareTarget === "partner" && referralPartner ? referralPartner.full_name : (invoice?.customer_phone || "customer")}.
                </p>
                <Button className="w-full" onClick={handleShareWhatsApp} data-testid="button-share-whatsapp-send">
                  <SiWhatsapp className="h-4 w-4 mr-2" />Send via WhatsApp {shareTarget === "partner" ? "to Partner" : "to Customer"}
                </Button>
              </TabsContent>
              <TabsContent value="email" className="space-y-3 mt-3">
                <div>
                  <Label className="text-xs">SMTP Account</Label>
                  <Select value={String(shareSmtp)} onValueChange={(v) => setShareSmtp(Number(v))}>
                    <SelectTrigger data-testid="select-share-smtp"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      {smtpAccounts.map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input value={invoice?.customer_email || ""} readOnly className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Subject</Label>
                  <Input value={shareEmailSubject} onChange={(e) => setShareEmailSubject(e.target.value)} data-testid="input-share-email-subject" />
                </div>
                <div>
                  <Label className="text-xs">Body</Label>
                  <Textarea
                    value={shareEmailBody}
                    onChange={(e) => setShareEmailBody(e.target.value)}
                    rows={6}
                    className="text-sm"
                    data-testid="input-share-email-body"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => shareEmailMutation.mutate()}
                  disabled={shareEmailMutation.isPending}
                  data-testid="button-share-email-send"
                >
                  {shareEmailMutation.isPending ? "Sending..." : "Send Email"}
                </Button>
              </TabsContent>
            </Tabs>

            <Button variant="outline" className="w-full" onClick={() => setShareOpen(false)} data-testid="button-share-close">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={verifyOpen} onOpenChange={(open) => { if (!open) { setVerifyOpen(false); setVerifyProof(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Verify Payment Proof
            </DialogTitle>
          </DialogHeader>
          {verifyProof && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-accent/50 space-y-1">
                <div className="flex justify-between gap-1 text-sm"><span className="text-muted-foreground">Amount Claimed</span><span className="font-bold">${Number(verifyProof.amount_claimed).toFixed(2)}</span></div>
                <div className="flex justify-between gap-1 text-sm"><span className="text-muted-foreground">File</span><span className="font-medium truncate ml-2">{verifyProof.file_name}</span></div>
                <div className="flex justify-between gap-1 text-sm border-t pt-1"><span className="text-muted-foreground">Remaining Balance</span><span className="font-bold text-red-600">${remaining > 0 ? remaining.toFixed(2) : "0.00"}</span></div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Payment Type</Label>
                <div className="space-y-2">
                  <div
                    className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer hover-elevate ${verifyType === "full" ? "border-green-500 bg-green-50 dark:bg-green-950/30" : ""}`}
                    onClick={() => setVerifyType("full")}
                    data-testid="radio-verify-full"
                  >
                    <div className={`h-4 w-4 rounded-full border-2 shrink-0 ${verifyType === "full" ? "border-green-600 bg-green-600" : "border-muted-foreground"}`} />
                    <div className="flex-1">
                      <span className="font-medium text-sm">Full Payment</span>
                      <span className="text-xs text-muted-foreground block">Record ${remaining > 0 ? remaining.toFixed(2) : "0.00"} as the full remaining balance</span>
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-2 p-3 rounded-md border cursor-pointer hover-elevate ${verifyType === "partial" ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : ""}`}
                    onClick={() => setVerifyType("partial")}
                    data-testid="radio-verify-partial"
                  >
                    <div className={`h-4 w-4 rounded-full border-2 shrink-0 ${verifyType === "partial" ? "border-blue-600 bg-blue-600" : "border-muted-foreground"}`} />
                    <div className="flex-1">
                      <span className="font-medium text-sm">Partial Payment</span>
                      <span className="text-xs text-muted-foreground block">Record a specific amount</span>
                    </div>
                  </div>
                </div>
              </div>

              {verifyType === "partial" && (
                <div>
                  <Label className="text-xs">Amount (USD)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={verifyPartialAmount}
                    onChange={(e) => setVerifyPartialAmount(e.target.value)}
                    data-testid="input-verify-partial-amount"
                  />
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending || (verifyType === "partial" && (!verifyPartialAmount || Number(verifyPartialAmount) <= 0))}
                data-testid="button-confirm-verify"
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                {verifyMutation.isPending ? "Processing..." : verifyType === "full" ? `Verify & Record $${remaining > 0 ? remaining.toFixed(2) : "0.00"}` : `Verify & Record $${Number(verifyPartialAmount || 0).toFixed(2)}`}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={declineProofId !== null} onOpenChange={(open) => { if (!open) { setDeclineProofId(null); setDeclineNote(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Decline Payment Proof
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Reason (optional)</Label>
              <Textarea
                placeholder="Enter reason for declining..."
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
                rows={3}
                data-testid="input-decline-note"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => declineMutation.mutate()}
                disabled={declineMutation.isPending}
                data-testid="button-confirm-decline"
              >
                {declineMutation.isPending ? "Declining..." : "Decline Proof"}
              </Button>
              <Button variant="outline" onClick={() => { setDeclineProofId(null); setDeclineNote(""); }} data-testid="button-cancel-decline">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
