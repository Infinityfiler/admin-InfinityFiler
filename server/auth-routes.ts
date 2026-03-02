import { Router } from "express";
import { supabase, supabaseAuth } from "./supabase";
import { createAdminUser, requireAuth, authRateLimit } from "./auth";
import { storage } from "./storage";

const router = Router();

router.post("/api/auth/admin-login", authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (data.user?.user_metadata?.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    try {
      await storage.upsertAdminOnLogin(data.user.id, data.user.email!);
    } catch (e) {
      console.error("Failed to track admin login:", e);
    }

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: "admin",
      },
    });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

router.post("/api/auth/customer-signup", authRateLimit, async (req, res) => {
  try {
    const { email, password, individual_name, phone, company_name, country, state_province, referred_by } = req.body;
    if (!email || !password || !individual_name || !phone) {
      return res.status(400).json({ message: "Email, password, name, and phone are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const { data, error } = await supabaseAuth.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: "customer",
          individual_name,
          phone,
          company_name: company_name || "",
          country: country || "",
          state_province: state_province || "",
          referred_by: referred_by || "",
        },
        emailRedirectTo: `${req.protocol}://${req.get("host")}/verify-email`,
      },
    });

    if (error) {
      if (error.message?.includes("already been registered")) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }
      return res.status(400).json({ message: error.message });
    }

    res.json({
      message: "Account created. Please check your email to verify your account.",
    });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

router.post("/api/auth/customer-login", authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!data.user.email_confirmed_at) {
      return res.status(403).json({ message: "Please verify your email before logging in" });
    }

    const existingCustomer = await findCustomerByAuthId(data.user.id);
    if (!existingCustomer && data.user.user_metadata?.role === "customer") {
      await createCustomerFromAuth(data.user);
    }

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.role || "customer",
      },
    });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

router.post("/api/auth/verify-callback", async (req, res) => {
  try {
    const { access_token, refresh_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ message: "Access token is required" });
    }

    const { data: { user }, error } = await supabase.auth.getUser(access_token);
    if (error || !user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    if (user.user_metadata?.role === "customer") {
      const existing = await findCustomerByAuthId(user.id);
      if (!existing) {
        await createCustomerFromAuth(user);
      }
    }

    res.json({
      message: "Email verified successfully",
      token: access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role || "customer",
      },
    });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

router.post("/api/auth/forgot-password", authRateLimit, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo: `${req.protocol}://${req.get("host")}/reset-password`,
    });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json({ message: "If an account exists with this email, a password reset link has been sent." });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

router.post("/api/auth/reset-password", authRateLimit, async (req, res) => {
  try {
    const { access_token, new_password } = req.body;
    if (!access_token || !new_password) {
      return res.status(400).json({ message: "Access token and new password are required" });
    }

    const { data: { user }, error: verifyError } = await supabase.auth.getUser(access_token);
    if (verifyError || !user) {
      return res.status(401).json({ message: "Invalid or expired reset token" });
    }

    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: new_password,
    });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    res.json({ message: "Password updated successfully" });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

router.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = req.user!;

    if (user.role === "customer") {
      const customer = await findCustomerByAuthId(user.id);
      return res.json({ ...user, customer });
    }

    res.json(user);
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

router.post("/api/auth/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ message: "Refresh token is required" });
    }

    const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token });
    if (error || !data.session) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    res.json({
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user!.id,
        email: data.user!.email,
        role: data.user!.user_metadata?.role || "customer",
      },
    });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

router.post("/api/auth/setup-admin", authRateLimit, async (req, res) => {
  try {
    const settings = await storage.getCompanySettings();
    if (settings && (settings as any).admin_setup_complete) {
      return res.status(403).json({ message: "Admin setup has already been completed" });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const user = await createAdminUser(email, password);

    await storage.updateCompanySettings({ admin_setup_complete: true } as any);

    try {
      await storage.upsertAdminOnLogin(user.id, email);
    } catch (e) {
      console.error("Failed to create admin record:", e);
    }

    res.json({
      message: "Admin account created successfully",
      user: {
        id: user.id,
        email: user.email,
        role: "admin",
      },
    });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
});

async function findCustomerByAuthId(authUserId: string) {
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("auth_user_id", authUserId)
    .single();
  return data;
}

async function createCustomerFromAuth(user: any) {
  const meta = user.user_metadata || {};
  const customerData = {
    individual_name: meta.individual_name || user.email?.split("@")[0] || "Customer",
    email: user.email || "",
    phone: meta.phone || "",
    company_name: meta.company_name || "",
    country: meta.country || "",
    state_province: meta.state_province || "",
    referred_by: meta.referred_by || "",
  };

  const customer = await storage.createCustomer(customerData);

  await supabase
    .from("customers")
    .update({ auth_user_id: user.id })
    .eq("id", customer.id);

  return customer;
}

export default router;
