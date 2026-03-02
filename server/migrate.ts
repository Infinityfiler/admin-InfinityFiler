import pg from "pg";

const { Pool } = pg;

export async function runMigrations() {
  const pool = new Pool({
    host: process.env.SUPABASE_DB_HOST,
    port: Number(process.env.SUPABASE_DB_PORT) || 6543,
    database: process.env.SUPABASE_DB_NAME || "postgres",
    user: process.env.SUPABASE_DB_USER,
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        company_name TEXT NOT NULL DEFAULT '',
        individual_name TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        country TEXT DEFAULT '',
        state_province TEXT DEFAULT '',
        residential_address TEXT DEFAULT '',
        referred_by TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS services (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        type TEXT DEFAULT 'state_specific',
        state TEXT DEFAULT '',
        state_fee NUMERIC DEFAULT 0,
        agent_fee NUMERIC DEFAULT 0,
        unique_address NUMERIC DEFAULT 0,
        vyke_number NUMERIC DEFAULT 0,
        service_charges NUMERIC DEFAULT 0,
        annual_report_fee NUMERIC DEFAULT 0,
        annual_report_deadline TEXT DEFAULT '',
        state_tax_rate TEXT DEFAULT '',
        federal_tax TEXT DEFAULT '',
        additional_requirements TEXT DEFAULT '',
        warnings JSONB DEFAULT '[]',
        includes JSONB DEFAULT '[]',
        high_alert BOOLEAN DEFAULT false,
        recommended BOOLEAN DEFAULT false,
        tax_free BOOLEAN DEFAULT false,
        annual_franchise_tax NUMERIC DEFAULT 0,
        notes TEXT DEFAULT '',
        timeframe TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE services ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
      ALTER TABLE services ADD COLUMN IF NOT EXISTS timeframe TEXT DEFAULT '';

      CREATE TABLE IF NOT EXISTS bundle_packages (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        discount_type TEXT DEFAULT 'percentage',
        discount_percentage NUMERIC DEFAULT 0,
        discount_amount NUMERIC DEFAULT 0,
        total_before_discount NUMERIC DEFAULT 0,
        total_after_discount NUMERIC DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE bundle_packages ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage';
      ALTER TABLE bundle_packages ADD COLUMN IF NOT EXISTS total_before_discount NUMERIC DEFAULT 0;
      ALTER TABLE bundle_packages ADD COLUMN IF NOT EXISTS total_after_discount NUMERIC DEFAULT 0;

      CREATE TABLE IF NOT EXISTS bundle_items (
        id SERIAL PRIMARY KEY,
        bundle_id INTEGER REFERENCES bundle_packages(id) ON DELETE CASCADE,
        service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
        service_name TEXT DEFAULT '',
        service_category TEXT DEFAULT '',
        service_state TEXT DEFAULT '',
        service_price NUMERIC DEFAULT 0,
        item_discount NUMERIC DEFAULT 0
      );

      ALTER TABLE bundle_items ADD COLUMN IF NOT EXISTS service_category TEXT DEFAULT '';
      ALTER TABLE bundle_items ADD COLUMN IF NOT EXISTS service_state TEXT DEFAULT '';
      ALTER TABLE bundle_items ADD COLUMN IF NOT EXISTS service_price NUMERIC DEFAULT 0;
      ALTER TABLE bundle_items ADD COLUMN IF NOT EXISTS item_discount NUMERIC DEFAULT 0;

      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        invoice_number TEXT NOT NULL UNIQUE,
        order_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER REFERENCES customers(id),
        customer_name TEXT NOT NULL,
        company_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        subtotal NUMERIC DEFAULT 0,
        discount_amount NUMERIC DEFAULT 0,
        discount_percentage NUMERIC DEFAULT 0,
        discount_note TEXT DEFAULT '',
        total NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'pending',
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        due_date TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
        service_id INTEGER,
        description TEXT NOT NULL,
        state TEXT DEFAULT '',
        quantity INTEGER DEFAULT 1,
        unit_price NUMERIC DEFAULT 0,
        total NUMERIC DEFAULT 0,
        includes JSONB DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number TEXT NOT NULL,
        invoice_id INTEGER REFERENCES invoices(id),
        invoice_number TEXT DEFAULT '',
        customer_id INTEGER REFERENCES customers(id),
        customer_name TEXT NOT NULL,
        company_name TEXT NOT NULL,
        service_type TEXT DEFAULT '',
        state TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        formation_date TEXT DEFAULT '',
        includes JSONB DEFAULT '[]',
        referral_name TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_name TEXT DEFAULT '';

      CREATE TABLE IF NOT EXISTS order_notes (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        header TEXT NOT NULL,
        description TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_documents (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_path TEXT DEFAULT '',
        dropbox_path TEXT DEFAULT '',
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS customer_documents (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        document_name TEXT DEFAULT '',
        file_path TEXT DEFAULT '',
        dropbox_path TEXT DEFAULT '',
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_activity_logs (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        description TEXT DEFAULT '',
        file_name TEXT DEFAULT '',
        file_path TEXT DEFAULT '',
        dropbox_path TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        customer_name TEXT DEFAULT '',
        company_name TEXT DEFAULT '',
        order_id INTEGER,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        due_date TEXT NOT NULL,
        state TEXT DEFAULT '',
        entity_type TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS smtp_accounts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER DEFAULT 587,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        smtp_account_id INTEGER REFERENCES smtp_accounts(id),
        from_email TEXT NOT NULL,
        to_emails JSONB DEFAULT '[]',
        subject TEXT NOT NULL,
        body TEXT DEFAULT '',
        status TEXT DEFAULT 'sent',
        sent_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS company_settings (
        id SERIAL PRIMARY KEY,
        company_name TEXT DEFAULT 'Infinity Filer',
        address TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        whatsapp TEXT DEFAULT '',
        support_email TEXT DEFAULT '',
        bank_name TEXT DEFAULT '',
        account_holder TEXT DEFAULT '',
        account_number TEXT DEFAULT '',
        iban TEXT DEFAULT '',
        logo_url TEXT DEFAULT '',
        dropbox_refresh_token TEXT DEFAULT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS dropbox_refresh_token TEXT DEFAULT NULL;
    `);

    await client.query(`
      ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS currency_conversion_tax NUMERIC DEFAULT 10;
    `);

    await client.query(`
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pkr_enabled BOOLEAN DEFAULT false;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pkr_rate NUMERIC DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pkr_tax_rate NUMERIC DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pkr_amount NUMERIC DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pkr_tax_amount NUMERIC DEFAULT 0;
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pkr_total NUMERIC DEFAULT 0;
      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS currency_tax BOOLEAN DEFAULT false;
    `);

    await client.query(`
      ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS document_name TEXT DEFAULT '';
    `);

    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='state') THEN
          ALTER TABLE customers RENAME COLUMN state TO state_province;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='address') THEN
          ALTER TABLE customers RENAME COLUMN address TO residential_address;
        END IF;
      END $$;

      ALTER TABLE orders ADD COLUMN IF NOT EXISTS includes_meta JSONB DEFAULT '{}';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS formation_dates JSONB DEFAULT '{}';
      ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS linked_include TEXT DEFAULT '';
    `);

    await client.query(`
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;

      CREATE TABLE IF NOT EXISTS invoice_payments (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
        amount_usd NUMERIC DEFAULT 0,
        amount_pkr NUMERIC DEFAULT 0,
        pkr_rate NUMERIC DEFAULT 0,
        service_description TEXT DEFAULT '',
        note TEXT DEFAULT '',
        payment_date TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE services ADD COLUMN IF NOT EXISTS federal_tax_reminder TEXT DEFAULT '';
      ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS llc_type TEXT DEFAULT '';

      CREATE TABLE IF NOT EXISTS compliance_records (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        customer_id INTEGER,
        customer_name TEXT DEFAULT '',
        company_name TEXT DEFAULT '',
        service_name TEXT DEFAULT '',
        service_category TEXT DEFAULT '',
        state TEXT DEFAULT '',
        llc_type TEXT DEFAULT '',
        formation_date TEXT DEFAULT '',
        annual_report_due TEXT DEFAULT '',
        annual_report_status TEXT DEFAULT 'pending',
        federal_tax_due TEXT DEFAULT '',
        federal_tax_status TEXT DEFAULT 'pending',
        federal_tax_reminder_date TEXT DEFAULT '',
        reminder_count INTEGER DEFAULT 0,
        last_reminder_sent TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      UPDATE services SET federal_tax_reminder = 'April 15'
      WHERE (category LIKE '%LLC%' OR category LIKE '%C-Corp%')
        AND (federal_tax_reminder IS NULL OR federal_tax_reminder = '');
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_documents (
        id SERIAL PRIMARY KEY,
        compliance_id INTEGER REFERENCES compliance_records(id) ON DELETE CASCADE,
        order_id INTEGER,
        file_name TEXT NOT NULL,
        document_name TEXT DEFAULT '',
        dropbox_path TEXT NOT NULL,
        document_type TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_history (
        id SERIAL PRIMARY KEY,
        compliance_id INTEGER REFERENCES compliance_records(id) ON DELETE CASCADE,
        order_id INTEGER,
        company_name TEXT DEFAULT '',
        year INTEGER NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'completed',
        due_date TEXT DEFAULT '',
        completed_at TIMESTAMPTZ DEFAULT NOW(),
        notes TEXT DEFAULT ''
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'bank_account',
        label TEXT NOT NULL DEFAULT '',
        bank_name TEXT DEFAULT '',
        account_holder TEXT DEFAULT '',
        account_number TEXT DEFAULT '',
        iban TEXT DEFAULT '',
        currency TEXT DEFAULT 'USD',
        link_url TEXT DEFAULT '',
        details JSONB DEFAULT '{}',
        is_enabled BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_methods_snapshot JSONB DEFAULT NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_partners (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
        username TEXT NOT NULL UNIQUE,
        referral_code TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL DEFAULT '',
        email TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        company_name TEXT DEFAULT '',
        type TEXT DEFAULT 'individual',

        total_referrals INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE referral_partners ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
      ALTER TABLE referral_partners ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0;

      ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_partner_id INTEGER REFERENCES referral_partners(id) ON DELETE SET NULL;
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code TEXT DEFAULT '';
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_username TEXT DEFAULT '';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_partner_id INTEGER REFERENCES referral_partners(id) ON DELETE SET NULL;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS partner_service_rates (
        id SERIAL PRIMARY KEY,
        partner_id INTEGER NOT NULL REFERENCES referral_partners(id) ON DELETE CASCADE,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
        service_name TEXT DEFAULT '',
        discount_type TEXT DEFAULT 'fixed',
        discount_value NUMERIC DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(partner_id, service_id)
      );

      DROP TABLE IF EXISTS referral_earnings;
      ALTER TABLE partner_service_rates DROP COLUMN IF EXISTS commission_type;
      ALTER TABLE partner_service_rates DROP COLUMN IF EXISTS commission_value;
      ALTER TABLE referral_partners DROP COLUMN IF EXISTS commission_rate;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS profit_loss_entries (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        invoice_number TEXT DEFAULT '',
        order_number TEXT DEFAULT '',
        customer_name TEXT DEFAULT '',
        company_name TEXT DEFAULT '',
        invoice_total NUMERIC DEFAULT 0,
        total_cost NUMERIC DEFAULT 0,
        total_profit NUMERIC DEFAULT 0,
        profit_margin NUMERIC DEFAULT 0,
        cost_breakdown JSONB DEFAULT '[]',
        notes TEXT DEFAULT '',
        entry_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        auth_user_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        name TEXT DEFAULT '',
        role TEXT DEFAULT 'admin',
        status TEXT DEFAULT 'active',
        last_login_at TIMESTAMPTZ,
        login_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE customers ADD COLUMN IF NOT EXISTS auth_user_id TEXT;
      ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS admin_setup_complete BOOLEAN DEFAULT FALSE;
      ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
      ALTER TABLE profit_loss_entries ENABLE ROW LEVEL SECURITY;

      ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
      ALTER TABLE services ENABLE ROW LEVEL SECURITY;
      ALTER TABLE bundle_packages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE bundle_items ENABLE ROW LEVEL SECURITY;
      ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
      ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
      ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
      ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
      ALTER TABLE order_notes ENABLE ROW LEVEL SECURITY;
      ALTER TABLE order_documents ENABLE ROW LEVEL SECURITY;
      ALTER TABLE customer_documents ENABLE ROW LEVEL SECURITY;
      ALTER TABLE order_activity_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
      ALTER TABLE smtp_accounts ENABLE ROW LEVEL SECURITY;
      ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
      ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
      ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
      ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
      ALTER TABLE compliance_history ENABLE ROW LEVEL SECURITY;
      ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
      ALTER TABLE referral_partners ENABLE ROW LEVEL SECURITY;
      ALTER TABLE partner_service_rates ENABLE ROW LEVEL SECURITY;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_own_data' AND tablename = 'customers') THEN
          CREATE POLICY customers_own_data ON customers FOR SELECT USING (auth.uid()::text = auth_user_id);
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_view_services' AND tablename = 'services') THEN
          CREATE POLICY customers_view_services ON services FOR SELECT USING (true);
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_view_bundles' AND tablename = 'bundle_packages') THEN
          CREATE POLICY customers_view_bundles ON bundle_packages FOR SELECT USING (true);
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_view_bundle_items' AND tablename = 'bundle_items') THEN
          CREATE POLICY customers_view_bundle_items ON bundle_items FOR SELECT USING (true);
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_own_invoices' AND tablename = 'invoices') THEN
          CREATE POLICY customers_own_invoices ON invoices FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()::text));
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_own_orders' AND tablename = 'orders') THEN
          CREATE POLICY customers_own_orders ON orders FOR SELECT USING (customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()::text));
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'customers_view_payment_methods' AND tablename = 'payment_methods') THEN
          CREATE POLICY customers_view_payment_methods ON payment_methods FOR SELECT USING (true);
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_portal_links (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        customer_name TEXT DEFAULT '',
        company_name TEXT DEFAULT '',
        is_revoked BOOLEAN DEFAULT false,
        view_count INTEGER DEFAULT 0,
        last_viewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_customer_portal UNIQUE (customer_id)
      );

      CREATE TABLE IF NOT EXISTS link_activity_log (
        id SERIAL PRIMARY KEY,
        link_id INTEGER REFERENCES customer_portal_links(id) ON DELETE CASCADE,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        details JSONB DEFAULT '{}',
        ip_address TEXT DEFAULT '',
        user_agent TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE customer_portal_links ENABLE ROW LEVEL SECURITY;
      ALTER TABLE link_activity_log ENABLE ROW LEVEL SECURITY;

      ALTER TABLE order_documents ADD COLUMN IF NOT EXISTS uploaded_by TEXT DEFAULT 'admin';

      CREATE TABLE IF NOT EXISTS order_chats (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        sender_type TEXT NOT NULL DEFAULT 'admin',
        sender_name TEXT NOT NULL DEFAULT '',
        message TEXT DEFAULT '',
        file_name TEXT DEFAULT '',
        file_path TEXT DEFAULT '',
        dropbox_path TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE order_chats ENABLE ROW LEVEL SECURITY;

      CREATE TABLE IF NOT EXISTS document_requests (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        document_name TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        file_name TEXT DEFAULT '',
        file_path TEXT DEFAULT '',
        dropbox_path TEXT DEFAULT '',
        uploaded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;
    `);

    console.log("All tables created successfully, RLS enabled");

    const { rows } = await client.query("SELECT COUNT(*) as count FROM company_settings");
    if (Number(rows[0].count) === 0) {
      await client.query(`
        INSERT INTO company_settings (company_name, address, phone, whatsapp, support_email, bank_name, account_holder, account_number, iban)
        VALUES ('Infinity Filer', 'Zyarat Rd, Khanna Pull, Islamabad, Pakistan', '+923203682461', '+923203682461', 'support@infinityfiler.com', 'Meezan Bank Limited', 'ZARAR', '00300108188443', 'PK45MEZN0000300108188443')
      `);
      console.log("Company settings seeded");
    }
  } finally {
    client.release();
    await pool.end();
  }
}
