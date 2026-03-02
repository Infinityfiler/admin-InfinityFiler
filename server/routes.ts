import type { Express } from "express";
import { type Server } from "http";
import { storage, calculateAnnualReportDue, calculateFederalTaxDue } from "./storage";
import { insertCustomerSchema, insertServiceSchema, insertInvoiceSchema, insertSmtpSchema, insertReferralPartnerSchema, insertPortalLinkSchema } from "@shared/schema";
import type { ComplianceRecord } from "@shared/schema";
import { initializeDatabase, supabase } from "./supabase";
import multer from "multer";
import nodemailer from "nodemailer";
import {
  getDropboxAuthUrl, exchangeCodeForToken, isDropboxConnected,
  getDropboxAccountInfo, uploadToDropbox, downloadFromDropbox,
  deleteFromDropbox, disconnectDropbox, createDropboxSharedLink
} from "./dropbox";
import path from "path";
import mime from "mime-types";
import { requireAdmin } from "./auth";
import authRoutes from "./auth-routes";

const upload = multer({ storage: multer.memoryStorage() });
const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) { cb(null, true); } else { cb(new Error("Only images and PDFs are allowed")); }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  try {
    await initializeDatabase();
    console.log("Database initialized");
  } catch (e) {
    console.log("Database init note:", (e as Error).message);
  }

  app.use(authRoutes);

  app.get("/api/dashboard", requireAdmin, async (req, res) => {
    try {
      await storage.markOverdueInvoices();
      await storage.generateComplianceReminders();
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const stats = await storage.getDashboardStats(startDate, endDate);
      res.json(stats);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/refresh-database", requireAdmin, async (req, res) => {
    try {
      const overdueCount = await storage.markOverdueInvoices();
      const complianceSync = await storage.syncAllComplianceRecords();
      const remindersCreated = await storage.generateComplianceReminders();
      const referralSync = await storage.syncReferralPartners();
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const stats = await storage.getDashboardStats(startDate, endDate);
      res.json({ overdueCount, complianceSync, remindersCreated, referralSync, stats });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/customers", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getCustomers();
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/customers/:id", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getCustomer(Number(req.params.id));
      if (!data) return res.status(404).json({ message: "Not found" });
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/customers/:id/referral-info", requireAdmin, async (req, res) => {
    try {
      const customer = await storage.getCustomer(Number(req.params.id));
      if (!customer) return res.status(404).json({ message: "Not found" });

      const partner = await storage.getPartnerByCustomerId(customer.id);
      const allCustomers = await storage.getCustomers();
      const referredCustomers = partner
        ? allCustomers.filter(c => c.referral_partner_id === partner.id)
        : [];

      res.json({
        referral_code: customer.referral_code,
        referral_username: customer.referral_username,
        is_partner: !!partner,
        partner_id: partner?.id || null,
        total_referrals: referredCustomers.length,
        referred_customers: referredCustomers.map(c => ({
          id: c.id,
          individual_name: c.individual_name,
          company_name: c.company_name,
          email: c.email,
          created_at: c.created_at,
        })),
      });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/customers", requireAdmin, async (req, res) => {
    try {
      const parsed = insertCustomerSchema.parse(req.body);
      const data = await storage.createCustomer(parsed);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.patch("/api/customers/:id", requireAdmin, async (req, res) => {
    try {
      const { referral_code, referral_username, ...safeBody } = req.body;
      const data = await storage.updateCustomer(Number(req.params.id), safeBody);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/customers/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteCustomer(Number(req.params.id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/services", requireAdmin, async (req, res) => {
    try {
      const { category, state } = req.query;
      const data = await storage.getServices(category as string, state as string);
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/services/:id", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getService(Number(req.params.id));
      if (!data) return res.status(404).json({ message: "Not found" });
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/services", requireAdmin, async (req, res) => {
    try {
      const parsed = insertServiceSchema.parse(req.body);
      const data = await storage.createService(parsed);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.patch("/api/services/:id", requireAdmin, async (req, res) => {
    try {
      const data = await storage.updateService(Number(req.params.id), req.body);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/services/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteService(Number(req.params.id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/services/bulk", requireAdmin, async (req, res) => {
    try {
      const { services } = req.body;
      const data = await storage.bulkCreateServices(services);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/services/bulk-delete", requireAdmin, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "No IDs provided" });
      await storage.bulkDeleteServices(ids);
      res.json({ success: true, deleted: ids.length });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/bundles", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getBundles();
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/bundles/:id/items", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getBundleItems(Number(req.params.id));
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/bundles", requireAdmin, async (req, res) => {
    try {
      const { name, description, discount_type, discount_percentage, discount_amount, total_before_discount, total_after_discount, items } = req.body;
      const data = await storage.createBundle(
        { name, description, discount_type: discount_type || "percentage", discount_percentage, discount_amount, total_before_discount: total_before_discount || 0, total_after_discount: total_after_discount || 0 },
        items || []
      );
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.patch("/api/bundles/:id", requireAdmin, async (req, res) => {
    try {
      const { name, description, discount_type, discount_percentage, discount_amount, total_before_discount, total_after_discount, items } = req.body;
      const data = await storage.updateBundle(
        Number(req.params.id),
        { name, description, discount_type: discount_type || "percentage", discount_percentage, discount_amount, total_before_discount: total_before_discount || 0, total_after_discount: total_after_discount || 0 },
        items || []
      );
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/bundles/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBundle(Number(req.params.id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/invoices", requireAdmin, async (_req, res) => {
    try {
      await storage.markOverdueInvoices();
      const data = await storage.getInvoices();
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/invoices/:id", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getInvoice(Number(req.params.id));
      if (!data) return res.status(404).json({ message: "Not found" });
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/invoices/:id/items", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getInvoiceItems(Number(req.params.id));
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/invoices", requireAdmin, async (req, res) => {
    try {
      const { items, ...invoiceData } = req.body;
      if (!invoiceData.due_date || String(invoiceData.due_date).trim() === "") {
        return res.status(400).json({ message: "Due date is required" });
      }
      const parsed = insertInvoiceSchema.parse(invoiceData);
      const data = await storage.createInvoice(parsed, items || []);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.patch("/api/invoices/:id", requireAdmin, async (req, res) => {
    try {
      const { items, ...invoiceData } = req.body;
      const data = await storage.updateInvoice(Number(req.params.id), invoiceData);
      if (items && Array.isArray(items)) {
        await storage.replaceInvoiceItems(Number(req.params.id), items);
      }
      const updated = await storage.getInvoice(Number(req.params.id));
      res.json(updated || data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/invoices/:id/payments", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getInvoicePayments(Number(req.params.id));
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/invoices/:id/payments", requireAdmin, async (req, res) => {
    try {
      const invoiceId = Number(req.params.id);
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) return res.status(404).json({ message: "Invoice not found" });

      const { amount_usd, amount_pkr, pkr_rate, service_description, note, next_due_date } = req.body;
      const usdAmount = Number(amount_usd || 0);

      if (usdAmount <= 0) {
        return res.status(400).json({ message: "Payment amount must be greater than zero" });
      }

      const currentPaid = Number(invoice.amount_paid || 0);
      const total = Number(invoice.total || 0);
      const remaining = total - currentPaid;

      if (usdAmount > remaining && remaining > 0) {
        return res.status(400).json({ message: `Payment amount ($${usdAmount.toFixed(2)}) exceeds remaining balance ($${remaining.toFixed(2)})` });
      }

      const payment = await storage.createInvoicePayment({
        invoice_id: invoiceId,
        amount_usd: usdAmount,
        amount_pkr: Number(amount_pkr || 0),
        pkr_rate: Number(pkr_rate || 0),
        service_description: service_description || "",
        note: note || "",
      });

      const newAmountPaid = currentPaid + usdAmount;

      const updateData: any = { amount_paid: newAmountPaid };
      if (newAmountPaid >= total) {
        updateData.status = "paid";
      } else if (newAmountPaid > 0) {
        updateData.status = "partial-paid";
      }
      if (next_due_date) {
        updateData.due_date = next_due_date;
      }

      await storage.updateInvoice(invoiceId, updateData);

      const updatedInvoice = await storage.getInvoice(invoiceId);
      res.json({ payment, invoice: updatedInvoice });
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/customers/:id/documents", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getCustomerDocuments(Number(req.params.id));
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/customers/:id/documents", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file provided" });

      const connected = await isDropboxConnected();
      if (!connected) {
        return res.status(400).json({ message: "Dropbox is not connected. Please connect Dropbox in Settings before uploading documents." });
      }

      const customerId = Number(req.params.id);
      const documentName = req.body.document_name || req.file.originalname;
      const originalName = req.file.originalname;
      const ext = path.extname(originalName);
      const sanitizedName = documentName.replace(/[^a-zA-Z0-9_\-\s.]/g, "").trim();
      const dropboxFileName = sanitizedName.endsWith(ext) ? sanitizedName : `${sanitizedName}${ext}`;

      const customer = await storage.getCustomer(customerId);
      const folderName = customer
        ? `${customer.company_name || customer.individual_name || "Unknown"}`.replace(/[^a-zA-Z0-9_\-\s]/g, "")
        : `Customer-${customerId}`;
      const dropboxPath = `/InfinityFiler/Customers/${folderName}/Verification/${dropboxFileName}`;

      const result = await uploadToDropbox(req.file.buffer, dropboxPath);

      const doc = await storage.createCustomerDocument({
        customer_id: customerId,
        file_name: originalName,
        document_name: sanitizedName,
        file_path: result.path,
        dropbox_path: result.path,
      });
      res.json(doc);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/customers/:customerId/documents/:docId/download", requireAdmin, async (req, res) => {
    try {
      const docs = await storage.getCustomerDocuments(Number(req.params.customerId));
      const doc = docs.find(d => d.id === Number(req.params.docId));
      if (!doc) return res.status(404).json({ message: "Document not found" });
      if (!doc.dropbox_path) return res.status(404).json({ message: "File not available" });

      const { buffer, name } = await downloadFromDropbox(doc.dropbox_path);
      const ext = path.extname(doc.file_name || name);
      const downloadName = doc.document_name
        ? (doc.document_name.includes(".") ? doc.document_name : `${doc.document_name}${ext}`)
        : name;
      const contentType = mime.lookup(ext) || "application/octet-stream";

      res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/customers/:customerId/documents/:docId/preview", requireAdmin, async (req, res) => {
    try {
      const docs = await storage.getCustomerDocuments(Number(req.params.customerId));
      const doc = docs.find(d => d.id === Number(req.params.docId));
      if (!doc) return res.status(404).json({ message: "Document not found" });
      if (!doc.dropbox_path) return res.status(404).json({ message: "File not available" });

      const { buffer, name } = await downloadFromDropbox(doc.dropbox_path);
      const ext = path.extname(doc.file_name || name).toLowerCase();
      const contentType = mime.lookup(ext) || "application/octet-stream";
      const fileName = doc.document_name
        ? (doc.document_name.includes(".") ? doc.document_name : `${doc.document_name}${ext}`)
        : name;

      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.delete("/api/customers/:customerId/documents/:docId", requireAdmin, async (req, res) => {
    try {
      const docs = await storage.getCustomerDocuments(Number(req.params.customerId));
      const doc = docs.find(d => d.id === Number(req.params.docId));
      if (!doc) return res.status(404).json({ message: "Document not found" });

      if (doc.dropbox_path) {
        try { await deleteFromDropbox(doc.dropbox_path); } catch {}
      }

      await storage.deleteCustomerDocument(doc.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/orders", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getOrders();
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/orders/:id", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getOrder(Number(req.params.id));
      if (!data) return res.status(404).json({ message: "Not found" });
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.patch("/api/orders/:id", requireAdmin, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const oldOrder = await storage.getOrder(orderId);
      const data = await storage.updateOrder(orderId, req.body);

      if (oldOrder && data) {
        if (req.body.status && req.body.status !== oldOrder.status) {
          await storage.createOrderActivityLog({
            order_id: orderId,
            action: "status_change",
            description: `Status changed from "${oldOrder.status}" to "${req.body.status}"`,
          });
        }
        if (req.body.formation_date !== undefined && req.body.formation_date !== oldOrder.formation_date) {
          await storage.createOrderActivityLog({
            order_id: orderId,
            action: "formation_date",
            description: `Formation date ${req.body.formation_date ? `set to ${req.body.formation_date}` : "cleared"}`,
          });
        }
        if (req.body.formation_dates) {
          const oldDates = oldOrder.formation_dates || {};
          const newDates = req.body.formation_dates || {};
          let formationDateChanged = false;
          for (const key of Object.keys(newDates)) {
            const oldEntry = oldDates[key];
            const newEntry = newDates[key];
            if (!oldEntry || oldEntry.date !== newEntry.date || oldEntry.state !== newEntry.state) {
              formationDateChanged = true;
              const parts = [];
              if (!oldEntry || oldEntry.date !== newEntry.date) {
                parts.push(newEntry.date ? `date set to ${newEntry.date}` : "date cleared");
              }
              if (!oldEntry || oldEntry.state !== newEntry.state) {
                parts.push(newEntry.state ? `state set to ${newEntry.state}` : "state cleared");
              }
              await storage.createOrderActivityLog({
                order_id: orderId,
                action: "formation_date",
                description: `${newEntry.label || key}: ${parts.join(", ")}`,
              });
            }
          }
          if (formationDateChanged) {
            try {
              await storage.autoCreateComplianceRecords(orderId);
            } catch (e) {
              console.log("Auto-create compliance records note:", (e as Error).message);
            }
          }
        }
        if (req.body.includes_meta) {
          const oldMeta = oldOrder.includes_meta || {};
          const newMeta = req.body.includes_meta || {};
          for (const key of Object.keys(newMeta)) {
            const oldStatus = oldMeta[key]?.status || "pending";
            const newStatus = newMeta[key]?.status || "pending";
            if (oldStatus !== newStatus) {
              await storage.createOrderActivityLog({
                order_id: orderId,
                action: "include_status",
                description: `"${key}" marked as ${newStatus}`,
              });
            }
            const oldNote = oldMeta[key]?.note || "";
            const newNote = newMeta[key]?.note || "";
            if (oldNote !== newNote && newNote) {
              await storage.createOrderActivityLog({
                order_id: orderId,
                action: "include_note",
                description: `Note updated for "${key}": ${newNote}`,
              });
            }
          }
        }
      }

      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/orders/:id/notes", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getOrderNotes(Number(req.params.id));
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/orders/:id/notes", requireAdmin, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const data = await storage.createOrderNote({ ...req.body, order_id: orderId });
      await storage.createOrderActivityLog({
        order_id: orderId,
        action: "note_added",
        description: `Note added: "${req.body.header || "Untitled"}"`,
      });
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/orders/:id/documents", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getOrderDocuments(Number(req.params.id));
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/orders/:id/documents", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file provided" });

      const connected = await isDropboxConnected();
      if (!connected) {
        return res.status(400).json({ message: "Dropbox is not connected. Please connect Dropbox in Settings before uploading documents." });
      }

      const orderId = Number(req.params.id);
      const documentName = req.body.document_name || req.file.originalname;
      const linkedInclude = req.body.linked_include || "";
      const originalName = req.file.originalname;
      const ext = path.extname(originalName);
      const sanitizedName = documentName.replace(/[^a-zA-Z0-9_\-\s.]/g, "").trim();
      const dropboxFileName = sanitizedName.endsWith(ext) ? sanitizedName : `${sanitizedName}${ext}`;

      const order = await storage.getOrder(orderId);
      const folderName = order
        ? `${order.company_name || "Unknown"} - ${order.order_number}`.replace(/[^a-zA-Z0-9_\-\s]/g, "")
        : `Order-${orderId}`;
      const dropboxPath = `/InfinityFiler/Orders/${folderName}/${dropboxFileName}`;

      const result = await uploadToDropbox(req.file.buffer, dropboxPath);

      const doc = await storage.createOrderDocument({
        order_id: orderId,
        file_name: originalName,
        document_name: sanitizedName,
        file_path: result.path,
        dropbox_path: result.path,
        linked_include: linkedInclude,
        uploaded_by: "admin",
      });
      await storage.createOrderActivityLog({
        order_id: orderId,
        action: "document_uploaded",
        description: `Document uploaded: "${sanitizedName}"${linkedInclude ? ` (linked to ${linkedInclude})` : ""}`,
        file_name: originalName,
        file_path: result.path,
        dropbox_path: result.path,
      });
      res.json(doc);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/orders/:id/documents/multi", requireAdmin, upload.array("files", 20), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ message: "No files provided" });

      const connected = await isDropboxConnected();
      if (!connected) {
        return res.status(400).json({ message: "Dropbox is not connected. Please connect Dropbox in Settings before uploading documents." });
      }

      const orderId = Number(req.params.id);
      const linkedInclude = req.body.linked_include || "";
      const documentNames: string[] = typeof req.body.document_names === "string"
        ? JSON.parse(req.body.document_names)
        : (req.body.document_names || []);

      const order = await storage.getOrder(orderId);
      const folderName = order
        ? `${order.company_name || "Unknown"} - ${order.order_number}`.replace(/[^a-zA-Z0-9_\-\s]/g, "")
        : `Order-${orderId}`;

      const results = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const docName = (documentNames[i] || "").trim() || file.originalname;
        const ext = path.extname(file.originalname);
        const sanitizedName = docName.replace(/[^a-zA-Z0-9_\-\s.]/g, "").trim();
        const dropboxFileName = sanitizedName.endsWith(ext) ? sanitizedName : `${sanitizedName}${ext}`;
        const dropboxPath = `/InfinityFiler/Orders/${folderName}/${dropboxFileName}`;

        const uploadResult = await uploadToDropbox(file.buffer, dropboxPath);
        const doc = await storage.createOrderDocument({
          order_id: orderId,
          file_name: file.originalname,
          document_name: sanitizedName,
          file_path: uploadResult.path,
          dropbox_path: uploadResult.path,
          linked_include: linkedInclude,
          uploaded_by: "admin",
        });
        results.push(doc);
        await storage.createOrderActivityLog({
          order_id: orderId,
          action: "document_uploaded",
          description: `Document uploaded: "${sanitizedName}"${linkedInclude ? ` (linked to ${linkedInclude})` : ""}`,
          file_name: file.originalname,
          file_path: uploadResult.path,
          dropbox_path: uploadResult.path,
        });
      }
      res.json(results);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/orders/:orderId/documents/:docId/download", requireAdmin, async (req, res) => {
    try {
      const docs = await storage.getOrderDocuments(Number(req.params.orderId));
      const doc = docs.find(d => d.id === Number(req.params.docId));
      if (!doc) return res.status(404).json({ message: "Document not found" });
      if (!doc.dropbox_path) return res.status(404).json({ message: "File not stored in Dropbox" });

      const { buffer, name } = await downloadFromDropbox(doc.dropbox_path);
      const ext = path.extname(doc.file_name || name);
      const downloadName = doc.document_name
        ? (doc.document_name.includes(".") ? doc.document_name : `${doc.document_name}${ext}`)
        : name;
      const contentType = mime.lookup(ext) || "application/octet-stream";

      res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/orders/:orderId/documents/:docId/preview", requireAdmin, async (req, res) => {
    try {
      const docs = await storage.getOrderDocuments(Number(req.params.orderId));
      const doc = docs.find(d => d.id === Number(req.params.docId));
      if (!doc) return res.status(404).json({ message: "Document not found" });
      if (!doc.dropbox_path) return res.status(404).json({ message: "File not stored in Dropbox" });

      const { buffer, name } = await downloadFromDropbox(doc.dropbox_path);
      const ext = path.extname(doc.file_name || name).toLowerCase();
      const contentType = mime.lookup(ext) || "application/octet-stream";
      const fileName = doc.document_name
        ? (doc.document_name.includes(".") ? doc.document_name : `${doc.document_name}${ext}`)
        : name;

      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.delete("/api/orders/:orderId/documents/:docId", requireAdmin, async (req, res) => {
    try {
      const docs = await storage.getOrderDocuments(Number(req.params.orderId));
      const doc = docs.find(d => d.id === Number(req.params.docId));
      if (!doc) return res.status(404).json({ message: "Document not found" });

      if (doc.dropbox_path) {
        try { await deleteFromDropbox(doc.dropbox_path); } catch {}
      }

      await storage.deleteOrderDocument(doc.id);
      await storage.createOrderActivityLog({
        order_id: Number(req.params.orderId),
        action: "document_deleted",
        description: `Document deleted: "${doc.document_name || doc.file_name}"`,
      });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/orders/:id/activity-logs", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getOrderActivityLogs(Number(req.params.id));
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/orders/:id/activity-logs", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      let fileMeta = { file_name: "", file_path: "", dropbox_path: "" };

      if (req.file) {
        const connected = await isDropboxConnected();
        if (!connected) {
          return res.status(400).json({ message: "Dropbox is not connected." });
        }
        const order = await storage.getOrder(orderId);
        const folderName = order
          ? `${order.company_name || "Unknown"} - ${order.order_number}`.replace(/[^a-zA-Z0-9_\-\s]/g, "")
          : `Order-${orderId}`;
        const ext = path.extname(req.file.originalname);
        const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9_\-\s.]/g, "").trim();
        const dropboxPath = `/InfinityFiler/Orders/${folderName}/Logs/${sanitizedName}`;
        const result = await uploadToDropbox(req.file.buffer, dropboxPath);
        fileMeta = { file_name: req.file.originalname, file_path: result.path, dropbox_path: result.path };
      }

      const data = await storage.createOrderActivityLog({
        order_id: orderId,
        action: req.body.action || "manual_log",
        description: req.body.description || "",
        ...fileMeta,
      });
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/orders/:id/chats", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getOrderChats(Number(req.params.id));
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/orders/:id/chats", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      let fileMeta = { file_name: "", file_path: "", dropbox_path: "" };

      if (req.file) {
        const connected = await isDropboxConnected();
        if (connected) {
          const order = await storage.getOrder(orderId);
          const folderName = order
            ? `${order.company_name || "Unknown"} - ${order.order_number}`.replace(/[^a-zA-Z0-9_\-\s]/g, "")
            : `Order-${orderId}`;
          const ext = path.extname(req.file.originalname);
          const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9_\-\s.]/g, "").trim();
          const dropboxPath = `/InfinityFiler/Orders/${folderName}/Chat/${sanitizedName}`;
          const result = await uploadToDropbox(req.file.buffer, dropboxPath);
          fileMeta = { file_name: req.file.originalname, file_path: result.path, dropbox_path: result.path };
        }
      }

      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });

      const chat = await storage.createOrderChat({
        order_id: orderId,
        customer_id: order.customer_id,
        sender_type: "admin",
        sender_name: "Admin",
        message: req.body.message || "",
        ...fileMeta,
      });

      if (fileMeta.file_name && fileMeta.dropbox_path) {
        await storage.createOrderDocument({
          order_id: orderId,
          document_name: `[Chat] ${fileMeta.file_name}`,
          file_name: fileMeta.file_name,
          file_path: fileMeta.file_path,
          dropbox_path: fileMeta.dropbox_path,
          linked_include: "",
          uploaded_by: "admin",
        });
      }

      res.json(chat);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/orders/:id/document-requests", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getDocumentRequests(Number(req.params.id));
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/orders/:id/document-requests", requireAdmin, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });
      const { document_name, description } = req.body;
      if (!document_name) return res.status(400).json({ message: "Document name is required" });
      const docReq = await storage.createDocumentRequest({
        order_id: orderId,
        customer_id: order.customer_id,
        document_name,
        description: description || "",
      });
      res.json(docReq);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/orders/:id/document-requests/:reqId", requireAdmin, async (req, res) => {
    try {
      await storage.deleteDocumentRequest(Number(req.params.reqId));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/reminders", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getReminders();
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/reminders", requireAdmin, async (req, res) => {
    try {
      const data = await storage.createReminder(req.body);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.patch("/api/reminders/:id", requireAdmin, async (req, res) => {
    try {
      const data = await storage.updateReminder(Number(req.params.id), req.body);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/compliance-records", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getComplianceRecords();
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/orders/:id/compliance", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getComplianceRecordsByOrder(Number(req.params.id));
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/orders/:id/compliance", requireAdmin, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Order not found" });

      if (req.body.auto || (!req.body.service_name && !req.body.records)) {
        await storage.autoCreateComplianceRecords(orderId);
        const records = await storage.getComplianceRecordsByOrder(orderId);
        return res.json(records);
      }

      const records = req.body.records || [req.body];

      const results = [];
      for (const record of records) {
        const annualReportDue = record.annual_report_due ||
          calculateAnnualReportDue(record.state || "", record.formation_date || "", record.annual_report_deadline || "");
        const federalTaxDue = record.federal_tax_due ||
          calculateFederalTaxDue(record.formation_date || "", record.service_category || "", record.llc_type || "");

        const existing = await storage.getComplianceRecordsByOrder(orderId);
        const match = existing.find(r => r.service_name === record.service_name && r.state === record.state);

        if (match) {
          const updated = await storage.updateComplianceRecord(match.id, {
            ...record,
            order_id: orderId,
            customer_id: order.customer_id,
            customer_name: order.customer_name,
            company_name: order.company_name,
            annual_report_due: annualReportDue,
            federal_tax_due: federalTaxDue,
          });
          results.push(updated);
        } else {
          const created = await storage.createComplianceRecord({
            order_id: orderId,
            customer_id: order.customer_id,
            customer_name: order.customer_name,
            company_name: order.company_name,
            service_name: record.service_name || "",
            service_category: record.service_category || "",
            state: record.state || "",
            llc_type: record.llc_type || "",
            formation_date: record.formation_date || "",
            annual_report_due: annualReportDue,
            annual_report_status: "pending",
            federal_tax_due: federalTaxDue,
            federal_tax_status: "pending",
            federal_tax_reminder_date: "",
            reminder_count: 0,
          });
          results.push(created);
        }
      }

      res.json(results);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.patch("/api/compliance-records/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getComplianceRecords();
      const record = existing.find(r => r.id === id);

      if (req.body.federal_tax_status === "submitted" && record && record.formation_date) {
        const currentDue = record.federal_tax_due || "";
        const currentDueYear = currentDue ? new Date(currentDue).getFullYear() : new Date().getFullYear();

        await storage.createComplianceHistory({
          compliance_id: id,
          order_id: record.order_id,
          company_name: record.company_name,
          year: currentDueYear,
          type: "federal_tax",
          status: "completed",
          due_date: currentDue,
          notes: `Federal tax for ${currentDueYear} marked as submitted`,
        });

        const nextYear = currentDueYear + 1;
        const isPartnership = record.llc_type === "multi-member";
        const month = isPartnership ? "03" : "04";
        req.body.federal_tax_due = `${nextYear}-${month}-15`;
        req.body.federal_tax_status = "pending";
        req.body.reminder_count = 0;
      }

      if (req.body.annual_report_status === "submitted" && record && record.annual_report_due) {
        const currentDue = new Date(record.annual_report_due);
        const currentDueYear = currentDue.getFullYear();

        await storage.createComplianceHistory({
          compliance_id: id,
          order_id: record.order_id,
          company_name: record.company_name,
          year: currentDueYear,
          type: "annual_report",
          status: "completed",
          due_date: record.annual_report_due,
          notes: `Annual report for ${currentDueYear} marked as submitted`,
        });

        const nextYear = currentDueYear + 1;
        const newDue = new Date(nextYear, currentDue.getMonth(), 1);
        const targetDay = Math.min(currentDue.getDate(), new Date(nextYear, currentDue.getMonth() + 1, 0).getDate());
        newDue.setDate(targetDay);
        req.body.annual_report_due = newDue.toISOString().split("T")[0];
        req.body.annual_report_status = "pending";
        req.body.reminder_count = 0;
      }

      const data = await storage.updateComplianceRecord(id, req.body);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/compliance-records/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteComplianceRecord(id);
      res.json({ success: true });
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/compliance-records/:id/documents", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getComplianceDocuments(Number(req.params.id));
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/compliance-records/:id/documents", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file provided" });

      const connected = await isDropboxConnected();
      if (!connected) {
        return res.status(400).json({ message: "Dropbox is not connected. Please connect Dropbox in Settings before uploading documents." });
      }

      const complianceId = Number(req.params.id);
      const record = await storage.getComplianceRecord(complianceId);
      if (!record) return res.status(404).json({ message: "Compliance record not found" });

      const documentName = req.body.document_name || req.file.originalname;
      const documentType = req.body.document_type || "";
      const originalName = req.file.originalname;
      const ext = path.extname(originalName);
      let sanitizedName = documentName.replace(/[^a-zA-Z0-9_\-\s.]/g, "").trim();
      if (!sanitizedName || sanitizedName === ext) sanitizedName = `document_${Date.now()}`;
      const dropboxFileName = sanitizedName.endsWith(ext) ? sanitizedName : `${sanitizedName}${ext}`;

      let folderName = (record.company_name || "Unknown").replace(/[^a-zA-Z0-9_\-\s]/g, "").trim();
      if (!folderName) folderName = "Unknown";
      const dropboxPath = `/InfinityFiler/Compliance/${folderName}/CR-${complianceId}/${dropboxFileName}`;

      const result = await uploadToDropbox(req.file.buffer, dropboxPath);

      const doc = await storage.createComplianceDocument({
        compliance_id: complianceId,
        order_id: record.order_id,
        file_name: originalName,
        document_name: sanitizedName,
        dropbox_path: result.path,
        document_type: documentType,
      });
      res.json(doc);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/compliance-documents/:id", requireAdmin, async (req, res) => {
    try {
      const doc = await storage.getComplianceDocumentById(Number(req.params.id));
      if (!doc) return res.status(404).json({ message: "Document not found" });

      if (doc.dropbox_path) {
        try { await deleteFromDropbox(doc.dropbox_path); } catch {}
      }

      await storage.deleteComplianceDocument(doc.id);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/compliance-documents/:id/download", requireAdmin, async (req, res) => {
    try {
      const doc = await storage.getComplianceDocumentById(Number(req.params.id));
      if (!doc) return res.status(404).json({ message: "Document not found" });
      if (!doc.dropbox_path) return res.status(404).json({ message: "File not stored in Dropbox" });

      const { buffer, name } = await downloadFromDropbox(doc.dropbox_path);
      const ext = path.extname(doc.file_name || name);
      const downloadName = doc.document_name
        ? (doc.document_name.includes(".") ? doc.document_name : `${doc.document_name}${ext}`)
        : name;
      const contentType = mime.lookup(ext) || "application/octet-stream";

      res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/compliance-records/:id/send-reminder", requireAdmin, async (req, res) => {
    try {
      const complianceId = Number(req.params.id);
      const record = await storage.getComplianceRecord(complianceId);
      if (!record) return res.status(404).json({ message: "Compliance record not found" });

      const { channels, smtp_account_id, subject, message, reminder_type } = req.body;
      if (!Array.isArray(channels) || channels.length === 0) {
        return res.status(400).json({ message: "channels must be a non-empty array" });
      }
      let emailSent = false;
      let whatsappUrl = "";

      if (channels.includes("email") && smtp_account_id) {
        const accounts = await storage.getSmtpAccounts();
        const account = accounts.find(a => a.id === smtp_account_id);
        if (!account) return res.status(404).json({ message: "SMTP account not found" });

        const customer = await storage.getCustomer(record.customer_id);
        const toEmail = customer?.email;
        if (!toEmail) return res.status(400).json({ message: "Customer email not found" });

        const transporter = nodemailer.createTransport({
          host: account.host,
          port: account.port,
          secure: account.port === 465,
          auth: { user: account.username, pass: account.password },
        });

        await transporter.sendMail({
          from: `"Infinity Filer" <${account.email}>`,
          to: toEmail,
          subject: subject || "Compliance Reminder - Infinity Filer",
          text: message || "",
          html: message || "",
        });

        await storage.createEmailLog({
          smtp_account_id,
          from_email: account.email,
          to_emails: [toEmail],
          subject: subject || "Compliance Reminder",
          body: message || "",
          status: "sent",
        });

        emailSent = true;
      }

      if (channels.includes("whatsapp")) {
        const customer = await storage.getCustomer(record.customer_id);
        const phone = customer?.phone || "";
        const cleanPhone = phone.replace(/[^\d+]/g, "");
        const whatsappMessage = encodeURIComponent(message || `Compliance Reminder for ${record.company_name}`);
        whatsappUrl = `https://wa.me/${cleanPhone}?text=${whatsappMessage}`;
      }

      const typeLabel = reminder_type === "annual_report" ? "Annual Report" : "Federal Tax";
      await storage.createReminder({
        customer_id: record.customer_id,
        customer_name: record.customer_name,
        company_name: record.company_name,
        order_id: record.order_id,
        type: reminder_type || "compliance",
        title: `${typeLabel} Reminder Sent - ${record.company_name}`,
        description: message || "",
        due_date: reminder_type === "annual_report" ? record.annual_report_due : record.federal_tax_due,
        state: record.state,
        entity_type: record.service_category,
        status: "completed",
        sent_at: new Date().toISOString(),
      });

      await storage.updateComplianceRecord(complianceId, {
        reminder_count: (record.reminder_count || 0) + 1,
        last_reminder_sent: new Date().toISOString(),
      } as any);

      res.json({ success: true, emailSent, whatsappUrl });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/compliance-records/:id/advance-year", requireAdmin, async (req, res) => {
    try {
      const complianceId = Number(req.params.id);
      const record = await storage.getComplianceRecord(complianceId);
      if (!record) return res.status(404).json({ message: "Compliance record not found" });

      const previousState = {
        annual_report_due: record.annual_report_due,
        annual_report_status: record.annual_report_status,
        federal_tax_due: record.federal_tax_due,
        federal_tax_status: record.federal_tax_status,
        reminder_count: record.reminder_count,
      };

      if (record.annual_report_due) {
        const arYear = new Date(record.annual_report_due).getFullYear();
        await storage.createComplianceHistory({
          compliance_id: complianceId,
          order_id: record.order_id,
          company_name: record.company_name,
          year: arYear,
          type: "annual_report",
          status: "completed",
          due_date: record.annual_report_due,
          notes: `Annual report for ${arYear} — advanced to next year`,
        });
      }
      if (record.federal_tax_due) {
        const ftYear = new Date(record.federal_tax_due).getFullYear();
        await storage.createComplianceHistory({
          compliance_id: complianceId,
          order_id: record.order_id,
          company_name: record.company_name,
          year: ftYear,
          type: "federal_tax",
          status: "completed",
          due_date: record.federal_tax_due,
          notes: `Federal tax for ${ftYear} — advanced to next year`,
        });
      }

      const updates: Partial<ComplianceRecord> = {};

      if (record.annual_report_due) {
        const currentDue = new Date(record.annual_report_due);
        const nextYear = currentDue.getFullYear() + 1;
        const newDue = new Date(nextYear, currentDue.getMonth(), 1);
        const targetDay = Math.min(currentDue.getDate(), new Date(nextYear, currentDue.getMonth() + 1, 0).getDate());
        newDue.setDate(targetDay);
        updates.annual_report_due = newDue.toISOString().split("T")[0];
        updates.annual_report_status = "pending";
      }

      if (record.federal_tax_due) {
        const currentDue = new Date(record.federal_tax_due);
        const nextYear = currentDue.getFullYear() + 1;
        const isPartnership = record.llc_type === "multi-member";
        const month = isPartnership ? "03" : "04";
        updates.federal_tax_due = `${nextYear}-${month}-15`;
        updates.federal_tax_status = "pending";
      }

      updates.reminder_count = 0;

      const updated = await storage.updateComplianceRecord(complianceId, updates);
      res.json({ ...updated, previousState });
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/compliance-records/:id/undo-advance", requireAdmin, async (req, res) => {
    try {
      const complianceId = Number(req.params.id);
      const record = await storage.getComplianceRecord(complianceId);
      if (!record) return res.status(404).json({ message: "Compliance record not found" });

      const { previousState } = req.body;
      if (!previousState) return res.status(400).json({ message: "Previous state required" });

      const updates: Partial<ComplianceRecord> = {
        annual_report_due: previousState.annual_report_due,
        annual_report_status: previousState.annual_report_status,
        federal_tax_due: previousState.federal_tax_due,
        federal_tax_status: previousState.federal_tax_status,
        reminder_count: previousState.reminder_count,
      };

      const updated = await storage.updateComplianceRecord(complianceId, updates);
      res.json(updated);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/compliance-records/:id/history", requireAdmin, async (req, res) => {
    try {
      const complianceId = Number(req.params.id);
      const history = await storage.getComplianceHistory(complianceId);
      res.json(history);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/smtp-accounts", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getSmtpAccounts();
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/smtp-accounts", requireAdmin, async (req, res) => {
    try {
      const parsed = insertSmtpSchema.parse(req.body);
      const data = await storage.createSmtpAccount(parsed);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.patch("/api/smtp-accounts/:id", requireAdmin, async (req, res) => {
    try {
      const data = await storage.updateSmtpAccount(Number(req.params.id), req.body);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/smtp-accounts/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteSmtpAccount(Number(req.params.id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/send-email", requireAdmin, async (req, res) => {
    try {
      const { smtp_account_id, to_emails, subject, body, html } = req.body;
      const accounts = await storage.getSmtpAccounts();
      const account = accounts.find(a => a.id === smtp_account_id);
      if (!account) return res.status(404).json({ message: "SMTP account not found" });

      const transporter = nodemailer.createTransport({
        host: account.host,
        port: account.port,
        secure: account.port === 465,
        auth: { user: account.username, pass: account.password },
      });

      await transporter.sendMail({
        from: `"Infinity Filer" <${account.email}>`,
        to: to_emails.join(", "),
        subject,
        text: body || "",
        html: html || body || "",
      });

      await storage.createEmailLog({
        smtp_account_id,
        from_email: account.email,
        to_emails,
        subject,
        body: html || body || "",
        status: "sent",
      });

      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/email-logs", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getEmailLogs();
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  let exchangeRateCache: { rate: number; lastUpdated: string; fetchedAt: number } | null = null;
  const CACHE_DURATION = 60 * 60 * 1000;

  app.get("/api/exchange-rate", requireAdmin, async (_req, res) => {
    try {
      if (exchangeRateCache && Date.now() - exchangeRateCache.fetchedAt < CACHE_DURATION) {
        return res.json({ rate: exchangeRateCache.rate, lastUpdated: exchangeRateCache.lastUpdated });
      }
      const response = await fetch("https://open.er-api.com/v6/latest/USD");
      const data = await response.json() as any;
      if (data.result !== "success" || !data.rates?.PKR) {
        return res.status(502).json({ message: "Failed to fetch exchange rate" });
      }
      exchangeRateCache = {
        rate: data.rates.PKR,
        lastUpdated: data.time_last_update_utc || new Date().toISOString(),
        fetchedAt: Date.now(),
      };
      res.json({ rate: exchangeRateCache.rate, lastUpdated: exchangeRateCache.lastUpdated });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/settings", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getCompanySettings();
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.patch("/api/settings", requireAdmin, async (req, res) => {
    try {
      const data = await storage.updateCompanySettings(req.body);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/payment-methods", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getPaymentMethods();
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/payment-methods", requireAdmin, async (req, res) => {
    try {
      const { type, label, bank_name, account_holder, account_number, iban, currency, link_url, details, is_enabled, sort_order } = req.body;
      if (!type || !["bank_account", "payment_link"].includes(type)) {
        return res.status(400).json({ message: "Type must be 'bank_account' or 'payment_link'" });
      }
      const sanitizedDetails: Record<string, string> = {};
      if (details && typeof details === "object") {
        for (const [k, v] of Object.entries(details)) {
          sanitizedDetails[String(k)] = String(v);
        }
      }
      const data = await storage.createPaymentMethod({
        type, label: label || "", bank_name: bank_name || "", account_holder: account_holder || "",
        account_number: account_number || "", iban: iban || "", currency: currency || "USD",
        link_url: link_url || "", details: sanitizedDetails,
        is_enabled: is_enabled !== false, sort_order: sort_order ?? undefined,
      } as any);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.patch("/api/payment-methods/:id", requireAdmin, async (req, res) => {
    try {
      const data = await storage.updatePaymentMethod(Number(req.params.id), req.body);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/payment-methods/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePaymentMethod(Number(req.params.id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/reports", requireAdmin, async (_req, res) => {
    try {
      const [customers, orders, invoices, services] = await Promise.all([
        storage.getCustomers(),
        storage.getOrders(),
        storage.getInvoices(),
        storage.getServices(),
      ]);
      res.json({ customers, orders, invoices, services });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/referral-partners", requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getReferralPartners();
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/referral-partners/search", requireAdmin, async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      if (!query) return res.json([]);
      const partners = await storage.searchReferralPartners(query);
      const partnerCustomerIds = new Set(partners.map(p => p.customer_id).filter(Boolean));

      const allCustomers = await storage.getCustomers();
      const q = query.toLowerCase();
      const matchingCustomers = allCustomers.filter(c =>
        !partnerCustomerIds.has(c.id) && (
          c.individual_name.toLowerCase().includes(q) ||
          (c.referral_code && c.referral_code.toLowerCase().includes(q)) ||
          (c.referral_username && c.referral_username.toLowerCase().includes(q)) ||
          (c.company_name && c.company_name.toLowerCase().includes(q))
        )
      );

      const customerAsPartners = matchingCustomers.map(c => ({
        id: -c.id,
        customer_id: c.id,
        username: c.referral_username || "",
        referral_code: c.referral_code || "",
        full_name: c.individual_name,
        email: c.email,
        phone: c.phone,
        company_name: c.company_name,
        type: "customer",
        total_referrals: 0,
        notes: "",
        is_active: true,
        created_at: c.created_at,
        _is_customer: true,
      }));

      res.json([...partners, ...customerAsPartners]);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/referral-partners/:id", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getReferralPartner(Number(req.params.id));
      if (!data) return res.status(404).json({ message: "Not found" });
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/referral-partners/by-code/:code", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getReferralPartnerByCode(req.params.code);
      if (!data) return res.status(404).json({ message: "Not found" });
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/referral-partners", requireAdmin, async (req, res) => {
    try {
      const parsed = insertReferralPartnerSchema.parse(req.body);
      const existing = await storage.getReferralPartnerByUsername(parsed.username);
      if (existing) return res.status(400).json({ message: "Username already taken" });
      const data = await storage.createReferralPartner(parsed);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.patch("/api/referral-partners/:id", requireAdmin, async (req, res) => {
    try {
      const { username, referral_code, ...safeBody } = req.body;
      const data = await storage.updateReferralPartner(Number(req.params.id), safeBody);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/referral-partners/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteReferralPartner(Number(req.params.id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/referral-partners/:id/customers", requireAdmin, async (req, res) => {
    try {
      const partnerId = Number(req.params.id);
      const customers = await storage.getCustomers();
      const referred = customers.filter(c => c.referral_partner_id === partnerId);
      res.json(referred);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/referral-partners/:id/orders", requireAdmin, async (req, res) => {
    try {
      const partnerId = Number(req.params.id);
      const orders = await storage.getOrders();
      const referred = orders.filter(o => o.referral_partner_id === partnerId);
      res.json(referred);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/referral-partners/:id/service-rates", requireAdmin, async (req, res) => {
    try {
      const data = await storage.getPartnerServiceRates(Number(req.params.id));
      res.json(data);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/referral-partners/:id/service-rates", requireAdmin, async (req, res) => {
    try {
      const partnerId = Number(req.params.id);
      const { insertPartnerServiceRateSchema } = await import("@shared/schema");
      const parsed = insertPartnerServiceRateSchema.parse({ ...req.body, partner_id: partnerId });
      const data = await storage.upsertPartnerServiceRate(parsed);
      res.json(data);
    } catch (e) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/partner-service-rates/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deletePartnerServiceRate(Number(req.params.id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/dropbox/status", requireAdmin, async (_req, res) => {
    try {
      const connected = await isDropboxConnected();
      let account = null;
      if (connected) {
        account = await getDropboxAccountInfo();
      }
      res.json({ connected, account });
    } catch (e) { res.json({ connected: false, account: null }); }
  });

  let dropboxOAuthState = "";

  app.get("/api/dropbox/auth-url", requireAdmin, async (req, res) => {
    try {
      const host = req.headers.host || "localhost:5000";
      const protocol = req.headers["x-forwarded-proto"] || "http";
      const redirectUri = `${protocol}://${host}/api/dropbox/callback`;
      dropboxOAuthState = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const url = getDropboxAuthUrl(redirectUri, dropboxOAuthState);
      res.json({ url, redirectUri });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/dropbox/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      if (!code) return res.status(400).send("Missing authorization code");
      if (!state || state !== dropboxOAuthState) return res.status(400).send("Invalid OAuth state. Please try again.");
      dropboxOAuthState = "";

      const host = req.headers.host || "localhost:5000";
      const protocol = req.headers["x-forwarded-proto"] || "http";
      const redirectUri = `${protocol}://${host}/api/dropbox/callback`;
      const origin = `${protocol}://${host}`;

      await exchangeCodeForToken(code, redirectUri);

      res.send(`<html><body><script>window.opener ? window.opener.postMessage("dropbox-connected","${origin}") : null; window.close(); setTimeout(function(){ window.location.href = "/settings"; }, 500);</script><p>Dropbox connected successfully! You can close this window.</p></body></html>`);
    } catch (e) {
      res.status(500).send(`<html><body><p>Error connecting Dropbox: ${(e as Error).message}</p><a href="/settings">Back to Settings</a></body></html>`);
    }
  });

  app.post("/api/dropbox/disconnect", requireAdmin, async (_req, res) => {
    try {
      await disconnectDropbox();
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/profit-loss", requireAdmin, async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const summary = await storage.getProfitLossSummary(startDate, endDate);
      res.json(summary);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/profit-loss/entries", requireAdmin, async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const entries = await storage.getProfitLossEntries(startDate, endDate);
      res.json(entries);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/profit-loss/invoice/:invoiceId", requireAdmin, async (req, res) => {
    try {
      const entry = await storage.getProfitLossForInvoice(Number(req.params.invoiceId));
      res.json(entry || null);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/profit-loss/:id", requireAdmin, async (req, res) => {
    try {
      const entry = await storage.getProfitLossEntry(Number(req.params.id));
      if (!entry) return res.status(404).json({ message: "Entry not found" });
      res.json(entry);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/profit-loss", requireAdmin, async (req, res) => {
    try {
      const entry = await storage.createProfitLossEntry(req.body);
      res.json(entry);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.patch("/api/profit-loss/:id", requireAdmin, async (req, res) => {
    try {
      const updated = await storage.updateProfitLossEntry(Number(req.params.id), req.body);
      if (!updated) return res.status(404).json({ message: "Entry not found" });
      res.json(updated);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.delete("/api/profit-loss/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteProfitLossEntry(Number(req.params.id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/admins", requireAdmin, async (_req, res) => {
    try {
      const admins = await storage.getAdmins();
      res.json(admins);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/admins/:id", requireAdmin, async (req, res) => {
    try {
      const admin = await storage.getAdmin(Number(req.params.id));
      if (!admin) return res.status(404).json({ message: "Admin not found" });
      res.json(admin);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.patch("/api/admins/:id", requireAdmin, async (req, res) => {
    try {
      const { name, status } = req.body;
      const safeUpdate: Record<string, string> = {};
      if (name !== undefined) safeUpdate.name = String(name);
      if (status !== undefined && (status === "active" || status === "inactive")) safeUpdate.status = status;
      if (Object.keys(safeUpdate).length === 0) return res.status(400).json({ message: "No valid fields to update" });
      const updated = await storage.updateAdmin(Number(req.params.id), safeUpdate);
      if (!updated) return res.status(404).json({ message: "Admin not found" });
      res.json(updated);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.delete("/api/admins/:id", requireAdmin, async (req, res) => {
    try {
      const admins = await storage.getAdmins();
      if (admins.length <= 1) return res.status(400).json({ message: "Cannot delete the last admin" });
      await storage.deleteAdmin(Number(req.params.id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  // Portal Links - Admin routes
  app.get("/api/portal-links", requireAdmin, async (_req, res) => {
    try {
      const links = await storage.getPortalLinks();
      res.json(links);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/portal-links", requireAdmin, async (req, res) => {
    try {
      const parsed = insertPortalLinkSchema.parse(req.body);
      const link = await storage.createPortalLink(parsed);
      res.json(link);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.patch("/api/portal-links/:id/revoke", requireAdmin, async (req, res) => {
    try {
      await storage.revokePortalLink(Number(req.params.id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.patch("/api/portal-links/:id/reactivate", requireAdmin, async (req, res) => {
    try {
      await storage.reactivatePortalLink(Number(req.params.id));
      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/portal-links/:id/activity", requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getLinkActivityLog(Number(req.params.id));
      res.json(logs);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  // Portal - Public routes (no auth)
  app.get("/api/portal/:token", async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      await storage.incrementPortalView(link.id);
      await storage.logLinkActivity({
        link_id: link.id,
        customer_id: link.customer_id,
        action: "page_view",
        details: { page: "portal" },
        ip_address: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim(),
        user_agent: req.headers["user-agent"] || "",
      });

      const customer = await storage.getCustomer(link.customer_id);
      const settings = await storage.getCompanySettings();
      const paymentMethods = await storage.getEnabledPaymentMethods();

      res.json({
        link: { id: link.id, token: link.token, customer_id: link.customer_id },
        customer: customer ? {
          id: customer.id, company_name: customer.company_name, individual_name: customer.individual_name,
          email: customer.email, phone: customer.phone, country: customer.country,
          state_province: customer.state_province, residential_address: customer.residential_address,
        } : null,
        company: settings ? {
          company_name: settings.company_name, address: settings.address, phone: settings.phone,
          whatsapp: settings.whatsapp, support_email: settings.support_email, logo_url: settings.logo_url,
        } : null,
        paymentMethods,
      });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/portal/:token/orders", async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      await storage.logLinkActivity({
        link_id: link.id, customer_id: link.customer_id, action: "page_view",
        details: { page: "orders" },
        ip_address: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim(),
        user_agent: req.headers["user-agent"] || "",
      });

      const allOrders = await storage.getOrders();
      const orders = allOrders.filter(o => o.customer_id === link.customer_id);
      res.json(orders);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/portal/:token/invoices", async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      await storage.logLinkActivity({
        link_id: link.id, customer_id: link.customer_id, action: "page_view",
        details: { page: "invoices" },
        ip_address: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim(),
        user_agent: req.headers["user-agent"] || "",
      });

      const allInvoices = await storage.getInvoices();
      const invoices = allInvoices.filter((i: any) => i.customer_id === link.customer_id);
      for (const inv of invoices) {
        const items = await storage.getInvoiceItems(inv.id);
        (inv as any).items = items;
      }
      res.json(invoices);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/portal/:token/orders/:orderId", async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      const order = await storage.getOrder(Number(req.params.orderId));
      if (!order || order.customer_id !== link.customer_id) {
        return res.status(404).json({ message: "Order not found" });
      }

      await storage.logLinkActivity({
        link_id: link.id, customer_id: link.customer_id, action: "page_view",
        details: { page: "order_detail", order_id: order.id, order_number: order.order_number },
        ip_address: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim(),
        user_agent: req.headers["user-agent"] || "",
      });

      const invoice = order.invoice_id ? await storage.getInvoice(order.invoice_id) : null;
      const invoiceItems = invoice ? await storage.getInvoiceItems(invoice.id) : [];
      const documents = await storage.getOrderDocuments(order.id);
      const activityLogs = await storage.getOrderActivityLogs(order.id);

      res.json({ order, invoice, invoiceItems, documents, activityLogs });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/portal/:token/invoices/:invoiceId", async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      const invoice = await storage.getInvoice(Number(req.params.invoiceId));
      if (!invoice || invoice.customer_id !== link.customer_id) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      await storage.logLinkActivity({
        link_id: link.id, customer_id: link.customer_id, action: "page_view",
        details: { page: "invoice_detail", invoice_id: invoice.id, invoice_number: invoice.invoice_number },
        ip_address: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim(),
        user_agent: req.headers["user-agent"] || "",
      });

      const items = await storage.getInvoiceItems(invoice.id);
      const payments = await storage.getInvoicePayments(invoice.id);
      const settings = await storage.getCompanySettings();

      res.json({ invoice, items, payments, settings });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/portal/:token/orders/:orderId/chats", async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      const order = await storage.getOrder(Number(req.params.orderId));
      if (!order || order.customer_id !== link.customer_id) {
        return res.status(404).json({ message: "Order not found" });
      }

      const chats = await storage.getOrderChats(order.id);
      res.json(chats);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/portal/:token/orders/:orderId/chats", upload.single("file"), async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      const order = await storage.getOrder(Number(req.params.orderId));
      if (!order || order.customer_id !== link.customer_id) {
        return res.status(404).json({ message: "Order not found" });
      }

      const customer = await storage.getCustomer(link.customer_id);
      let fileMeta = { file_name: "", file_path: "", dropbox_path: "" };

      if (req.file) {
        try {
          if (await isDropboxConnected()) {
            const folderName = order
              ? `${order.company_name || "Unknown"} - ${order.order_number}`.replace(/[^a-zA-Z0-9_\-\s]/g, "")
              : `Order-${order.id}`;
            const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9_\-\s.]/g, "").trim();
            const dropboxPath = `/InfinityFiler/Orders/${folderName}/Chat/${sanitizedName}`;
            const result = await uploadToDropbox(req.file.buffer, dropboxPath);
            fileMeta = { file_name: req.file.originalname, file_path: result.path, dropbox_path: result.path };
          }
        } catch (e) {
          console.log("Dropbox upload skipped for portal chat:", (e as Error).message);
        }
      }

      const chat = await storage.createOrderChat({
        order_id: order.id,
        customer_id: link.customer_id,
        sender_type: "customer",
        sender_name: customer?.individual_name || customer?.company_name || "Customer",
        message: req.body.message || "",
        ...fileMeta,
      });

      if (fileMeta.file_name && fileMeta.dropbox_path) {
        await storage.createOrderDocument({
          order_id: order.id,
          document_name: `[Chat] ${fileMeta.file_name}`,
          file_name: fileMeta.file_name,
          file_path: fileMeta.file_path,
          dropbox_path: fileMeta.dropbox_path,
          linked_include: "",
          uploaded_by: "customer",
        });
      }

      await storage.logLinkActivity({
        link_id: link.id, customer_id: link.customer_id, action: "chat_message",
        details: { order_id: order.id, has_file: !!req.file },
        ip_address: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim(),
        user_agent: req.headers["user-agent"] || "",
      });

      res.json(chat);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/portal/:token/orders/:orderId/document-requests", async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      const order = await storage.getOrder(Number(req.params.orderId));
      if (!order || order.customer_id !== link.customer_id) {
        return res.status(404).json({ message: "Order not found" });
      }

      const requests = await storage.getDocumentRequests(order.id);
      res.json(requests);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/portal/:token/orders/:orderId/document-requests/:reqId/upload", upload.single("file"), async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      const order = await storage.getOrder(Number(req.params.orderId));
      if (!order || order.customer_id !== link.customer_id) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      let fileMeta = { file_name: req.file.originalname, file_path: "", dropbox_path: "" };

      try {
        if (await isDropboxConnected()) {
          const folderName = `${order.company_name || "Unknown"} - ${order.order_number}`.replace(/[^a-zA-Z0-9_\-\s]/g, "");
          const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9_\-\s.]/g, "").trim();
          const dropboxPath = `/InfinityFiler/Orders/${folderName}/Requested Documents/${sanitizedName}`;
          const result = await uploadToDropbox(req.file.buffer, dropboxPath);
          fileMeta.file_path = result.path;
          fileMeta.dropbox_path = result.path;
        }
      } catch (e) {
        console.log("Dropbox upload skipped for document request:", (e as Error).message);
      }

      const updated = await storage.updateDocumentRequest(Number(req.params.reqId), {
        status: "submitted",
        file_name: fileMeta.file_name,
        file_path: fileMeta.file_path,
        dropbox_path: fileMeta.dropbox_path,
        uploaded_at: new Date().toISOString(),
      });

      await storage.logLinkActivity({
        link_id: link.id, customer_id: link.customer_id, action: "document_request_upload",
        details: { order_id: order.id, request_id: Number(req.params.reqId), file_name: fileMeta.file_name },
        ip_address: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim(),
        user_agent: req.headers["user-agent"] || "",
      });

      res.json(updated);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/portal/:token/orders/:orderId/documents", upload.single("file"), async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      const order = await storage.getOrder(Number(req.params.orderId));
      if (!order || order.customer_id !== link.customer_id) {
        return res.status(404).json({ message: "Order not found" });
      }

      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file provided" });

      const documentName = req.body.document_name || file.originalname;
      const ext = path.extname(file.originalname);
      const sanitizedName = documentName.replace(/[^a-zA-Z0-9_\-\s.]/g, "").trim();
      const dropboxFileName = sanitizedName.endsWith(ext) ? sanitizedName : `${sanitizedName}${ext}`;

      const folderName = `${order.company_name || "Unknown"} - ${order.order_number}`.replace(/[^a-zA-Z0-9_\-\s]/g, "");
      const dropboxPath = `/InfinityFiler/Orders/${folderName}/${dropboxFileName}`;

      let finalDropboxPath = "";
      try {
        if (await isDropboxConnected()) {
          const result = await uploadToDropbox(file.buffer, dropboxPath);
          finalDropboxPath = result.path;
        }
      } catch (e) {
        console.log("Dropbox upload skipped:", (e as Error).message);
      }

      const doc = await storage.createOrderDocument({
        order_id: order.id,
        file_name: file.originalname,
        document_name: sanitizedName,
        file_path: finalDropboxPath,
        dropbox_path: finalDropboxPath,
        uploaded_by: "customer",
      });

      await storage.createOrderActivityLog({
        order_id: order.id,
        action: "document_uploaded",
        description: `Customer uploaded document: "${sanitizedName}"`,
        file_name: file.originalname,
        file_path: finalDropboxPath,
        dropbox_path: finalDropboxPath,
      });

      await storage.logLinkActivity({
        link_id: link.id, customer_id: link.customer_id, action: "document_upload",
        details: { file_name: file.originalname, document_name: sanitizedName, order_id: order.id },
        ip_address: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim(),
        user_agent: req.headers["user-agent"] || "",
      });

      res.json(doc);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/portal/:token/orders/:orderId/documents/:docId/download", async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked" });

      const order = await storage.getOrder(Number(req.params.orderId));
      if (!order || order.customer_id !== link.customer_id) {
        return res.status(404).json({ message: "Order not found" });
      }

      const docs = await storage.getOrderDocuments(order.id);
      const doc = docs.find(d => d.id === Number(req.params.docId));
      if (!doc) return res.status(404).json({ message: "Document not found" });
      if (!doc.dropbox_path) return res.status(404).json({ message: "File not available for download" });

      const { buffer, name } = await downloadFromDropbox(doc.dropbox_path);
      const ext = path.extname(doc.file_name || name);
      const downloadName = doc.document_name
        ? (doc.document_name.includes(".") ? doc.document_name : `${doc.document_name}${ext}`)
        : name;
      const contentType = mime.lookup(ext) || "application/octet-stream";

      res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/portal/:token/chats/:chatId/download", async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked" });

      const chatId = Number(req.params.chatId);
      const chat = await storage.getOrderChatById(chatId);
      if (!chat) return res.status(404).json({ message: "Chat message not found" });

      const order = await storage.getOrder(chat.order_id);
      if (!order || order.customer_id !== link.customer_id) {
        return res.status(404).json({ message: "Not authorized" });
      }

      if (!chat.file_path) return res.status(404).json({ message: "No file attached" });

      const { buffer, name } = await downloadFromDropbox(chat.file_path);
      const ext = path.extname(chat.file_name || name);
      const contentType = mime.lookup(ext) || "application/octet-stream";

      res.setHeader("Content-Disposition", `attachment; filename="${chat.file_name || name}"`);
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/orders/:orderId/chats/:chatId/download", requireAdmin, async (req, res) => {
    try {
      const chatId = Number(req.params.chatId);
      const chat = await storage.getOrderChatById(chatId);
      if (!chat || chat.order_id !== Number(req.params.orderId)) {
        return res.status(404).json({ message: "Chat message not found" });
      }
      if (!chat.file_path) return res.status(404).json({ message: "No file attached" });

      const { buffer, name } = await downloadFromDropbox(chat.file_path);
      const ext = path.extname(chat.file_name || name);
      const contentType = mime.lookup(ext) || "application/octet-stream";

      res.setHeader("Content-Disposition", `attachment; filename="${chat.file_name || name}"`);
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.patch("/api/portal/:token/profile", async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      const allowed = ["company_name", "individual_name", "email", "phone", "country", "state_province", "residential_address"];
      const updates: Record<string, any> = {};
      const changes: Record<string, { old: any; new: any }> = {};
      const customer = await storage.getCustomer(link.customer_id);

      for (const key of allowed) {
        if (req.body[key] !== undefined && req.body[key] !== (customer as any)?.[key]) {
          changes[key] = { old: (customer as any)?.[key] || "", new: req.body[key] };
          updates[key] = req.body[key];
        }
      }

      if (Object.keys(updates).length === 0) return res.json({ message: "No changes" });

      const updated = await storage.updateCustomer(link.customer_id, updates);

      await storage.logLinkActivity({
        link_id: link.id, customer_id: link.customer_id, action: "profile_update",
        details: { changes },
        ip_address: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim(),
        user_agent: req.headers["user-agent"] || "",
      });

      res.json(updated);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/portal/:token/documents", async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      const docs = await storage.getCustomerDocuments(link.customer_id);
      res.json(docs);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/portal/:token/documents", upload.single("file"), async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file provided" });

      const customer = await storage.getCustomer(link.customer_id);
      const customerName = customer?.individual_name || customer?.company_name || "customer";
      const dropboxPath = `/customers/${customerName}/documents/${file.originalname}`;

      let finalDropboxPath = "";
      try {
        if (await isDropboxConnected()) {
          finalDropboxPath = (await uploadToDropbox(file.buffer, dropboxPath)).path;
        }
      } catch (e) {
        console.log("Dropbox upload skipped:", (e as Error).message);
      }

      const doc = await storage.createCustomerDocument({
        customer_id: link.customer_id,
        file_name: file.originalname,
        document_name: req.body.document_name || file.originalname,
        dropbox_path: finalDropboxPath,
      });

      await storage.logLinkActivity({
        link_id: link.id, customer_id: link.customer_id, action: "document_upload",
        details: { file_name: file.originalname, document_name: req.body.document_name || file.originalname },
        ip_address: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim(),
        user_agent: req.headers["user-agent"] || "",
      });

      res.json(doc);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.delete("/api/portal/:token/documents/:docId", async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      const docs = await storage.getCustomerDocuments(link.customer_id);
      const doc = docs.find(d => d.id === Number(req.params.docId));
      if (!doc) return res.status(404).json({ message: "Document not found" });

      await storage.deleteCustomerDocument(doc.id);

      await storage.logLinkActivity({
        link_id: link.id, customer_id: link.customer_id, action: "document_delete",
        details: { file_name: doc.file_name, document_name: doc.document_name },
        ip_address: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim(),
        user_agent: req.headers["user-agent"] || "",
      });

      res.json({ success: true });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/invoices/:id/payment-proofs", requireAdmin, async (req, res) => {
    try {
      const proofs = await storage.getPaymentProofs(Number(req.params.id));
      res.json(proofs);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.patch("/api/payment-proofs/:proofId", requireAdmin, async (req, res) => {
    try {
      const proofId = Number(req.params.proofId);
      const { status, admin_note } = req.body;

      if (status && !["pending", "verified", "declined"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const { data: existingProof } = await supabase
        .from("payment_proofs").select("*").eq("id", proofId).single();

      if (!existingProof) {
        return res.status(404).json({ message: "Proof not found" });
      }

      if (existingProof.status !== "pending" && status) {
        return res.status(400).json({ message: `Proof already ${existingProof.status}` });
      }

      const updateData: any = {};
      if (status) updateData.status = status;
      if (admin_note !== undefined) updateData.admin_note = admin_note;

      const proof = await storage.updatePaymentProof(proofId, updateData);
      res.json(proof);
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/portal/:token/invoices/:invoiceId/payment-proof", proofUpload.single("file"), async (req, res) => {
    try {
      const link = await storage.getPortalLinkByToken(req.params.token);
      if (!link) return res.status(404).json({ message: "Link not found", code: "NOT_FOUND" });
      if (link.is_revoked) return res.status(410).json({ message: "This link has been revoked", code: "REVOKED" });

      const invoice = await storage.getInvoice(Number(req.params.invoiceId));
      if (!invoice || invoice.customer_id !== link.customer_id) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const amount = Number(req.body.amount || 0);
      if (amount <= 0) return res.status(400).json({ message: "Invalid amount" });

      const safeCompany = (invoice.company_name || "Customer").replace(/[^a-zA-Z0-9 _-]/g, "");
      const safeInvoice = (invoice.invoice_number || "INV").replace(/[^a-zA-Z0-9 _-]/g, "");
      const ext = path.extname(req.file.originalname);
      const baseName = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9 _-]/g, "");
      const dropboxPath = `/InfinityFiler/PaymentProofs/${safeCompany} - ${safeInvoice}/${baseName}_${Date.now()}${ext}`;

      const uploadResult = await uploadToDropbox(req.file.buffer, dropboxPath);

      let viewLink = "";
      try {
        viewLink = await createDropboxSharedLink(uploadResult.path);
      } catch (linkErr) {
        console.error("Failed to create shared link:", linkErr);
      }

      const proof = await storage.createPaymentProof({
        invoice_id: invoice.id,
        customer_id: link.customer_id,
        amount_claimed: amount,
        file_name: req.file.originalname,
        dropbox_path: uploadResult.path,
        dropbox_view_link: viewLink,
        status: "pending",
        admin_note: "",
      });

      await storage.logLinkActivity({
        link_id: link.id, customer_id: link.customer_id, action: "payment_proof_uploaded",
        details: { invoice_id: invoice.id, invoice_number: invoice.invoice_number, amount, file_name: req.file.originalname },
        ip_address: (req.headers["x-forwarded-for"] as string || req.ip || "").split(",")[0].trim(),
        user_agent: req.headers["user-agent"] || "",
      });

      res.json({ success: true, dropboxViewLink: viewLink, proof });
    } catch (e) { res.status(500).json({ message: (e as Error).message }); }
  });

  return httpServer;
}
