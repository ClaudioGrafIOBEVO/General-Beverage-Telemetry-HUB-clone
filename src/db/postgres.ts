import pg from 'pg';
const { Pool } = pg;

let pool: pg.Pool | null = null;
let isInitialized = false;

export function getPgPool(): pg.Pool | null {
  if (pool) return pool;

  const connectionString = (process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING || '').trim();

  let config: pg.PoolConfig;
  if (connectionString) {
    config = {
      connectionString,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    };
  } else {
    // Standard local PostgreSQL connection (e.g. Ubuntu VPS localhost gb_telemetria)
    const host = process.env.PG_HOST || '127.0.0.1';
    const port = parseInt(process.env.PG_PORT || '5432', 10);
    const user = process.env.PG_USER || 'postgres';
    const password = process.env.PG_PASSWORD || '';
    const database = process.env.PG_DATABASE || 'gb_telemetria';

    config = {
      host,
      port,
      user,
      password,
      database,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    };
  }

  try {
    pool = new Pool({
      ...config,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    });

    pool.on('error', (err) => {
      console.error('PostgreSQL unexpected client error on pool:', err);
    });

    return pool;
  } catch (err) {
    console.error('Failed to instantiate PostgreSQL Pool:', err);
    return null;
  }
}

export async function testPgConnection(): Promise<boolean> {
  const p = getPgPool();
  if (!p) return false;
  try {
    const client = await p.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch {
    return false;
  }
}

export async function initPgSchema(): Promise<boolean> {
  const p = getPgPool();
  if (!p) return false;

  try {
    const client = await p.connect();
    try {
      await client.query('BEGIN');

      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          version VARCHAR(64) UNIQUE NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          business_name VARCHAR(255),
          vat_number VARCHAR(64),
          email VARCHAR(255),
          phone VARCHAR(64),
          address VARCHAR(255),
          city VARCHAR(128),
          zip_code VARCHAR(32),
          province VARCHAR(16),
          status VARCHAR(32) DEFAULT 'active',
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'::jsonb
        );
        CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS customer_sites (
          id VARCHAR(64) PRIMARY KEY,
          customer_id VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          address VARCHAR(255),
          city VARCHAR(128),
          zip_code VARCHAR(32),
          province VARCHAR(16),
          floor_room VARCHAR(128),
          contact_person VARCHAR(128),
          phone VARCHAR(64),
          email VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'::jsonb
        );
        CREATE INDEX IF NOT EXISTS idx_sites_customer ON customer_sites(customer_id);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS devices (
          mac_address VARCHAR(32) PRIMARY KEY,
          serial_number VARCHAR(16) UNIQUE,
          device_id VARCHAR(128),
          board_model VARCHAR(128),
          firmware_version VARCHAR(64),
          ip_address VARCHAR(64),
          wifi_ssid VARCHAR(128),
          wifi_rssi INT,
          free_heap INT,
          uptime_sec BIGINT,
          status VARCHAR(32) DEFAULT 'UNASSIGNED',
          assigned_machine_id VARCHAR(64),
          hardware_config JSONB DEFAULT '{}'::jsonb,
          diagnostic_logs JSONB DEFAULT '[]'::jsonb,
          last_heartbeat_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_devices_serial ON devices(serial_number);
        CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS machines (
          id VARCHAR(64) PRIMARY KEY,
          serial_number VARCHAR(16) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          model VARCHAR(128),
          status VARCHAR(32) DEFAULT 'OFFLINE',
          customer_id VARCHAR(64),
          customer_site_id VARCHAR(64),
          device_mac VARCHAR(32),
          location VARCHAR(255),
          location_details JSONB DEFAULT '{}'::jsonb,
          products JSONB DEFAULT '[]'::jsonb,
          calibration JSONB DEFAULT '{}'::jsonb,
          config JSONB DEFAULT '{}'::jsonb,
          total_presses BIGINT DEFAULT 0,
          total_dispensed_liters NUMERIC(12, 3) DEFAULT 0,
          last_telemetry_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_machines_serial ON machines(serial_number);
        CREATE INDEX IF NOT EXISTS idx_machines_customer ON machines(customer_id);
        CREATE INDEX IF NOT EXISTS idx_machines_site ON machines(customer_site_id);
        CREATE INDEX IF NOT EXISTS idx_machines_device ON machines(device_mac);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS keylogs (
          id VARCHAR(128) PRIMARY KEY,
          device_id VARCHAR(128),
          mac_address VARCHAR(32),
          machine_id VARCHAR(64),
          machine_serial_number VARCHAR(16),
          machine_name VARCHAR(255),
          customer_name VARCHAR(255),
          site_name VARCHAR(255),
          key_pressed VARCHAR(16) NOT NULL,
          key_label VARCHAR(128),
          product_name VARCHAR(128),
          dose_type VARCHAR(32) DEFAULT 'MONODOSE',
          dose_multiplier NUMERIC(6, 2) DEFAULT 1.0,
          is_caraffa BOOLEAN DEFAULT FALSE,
          event_type VARCHAR(32) DEFAULT 'pressed',
          dispensed_liters NUMERIC(10, 4) DEFAULT 0,
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          raw_data JSONB DEFAULT '{}'::jsonb
        );
        CREATE INDEX IF NOT EXISTS idx_keylogs_time ON keylogs(recorded_at DESC);
        CREATE INDEX IF NOT EXISTS idx_keylogs_machine ON keylogs(machine_id);
        CREATE INDEX IF NOT EXISTS idx_keylogs_mac ON keylogs(mac_address);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          username VARCHAR(128) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(32) NOT NULL DEFAULT 'viewer',
          name VARCHAR(128),
          email VARCHAR(255),
          phone VARCHAR(64),
          active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          last_login_at TIMESTAMPTZ
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS alerts (
          id VARCHAR(64) PRIMARY KEY,
          machine_id VARCHAR(64),
          machine_serial_number VARCHAR(16),
          machine_name VARCHAR(255),
          severity VARCHAR(32) DEFAULT 'WARNING',
          type VARCHAR(64),
          message TEXT NOT NULL,
          acknowledged BOOLEAN DEFAULT FALSE,
          acknowledged_by VARCHAR(64),
          acknowledged_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_alerts_ack ON alerts(acknowledged, created_at DESC);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id VARCHAR(64) PRIMARY KEY,
          order_number VARCHAR(64),
          customer_id VARCHAR(64),
          customer_name VARCHAR(255),
          customer_code VARCHAR(64),
          site_id VARCHAR(64),
          site_name VARCHAR(255),
          site_address VARCHAR(255),
          recipient_email VARCHAR(255),
          requester_name VARCHAR(128),
          requester_phone VARCHAR(64),
          requested_delivery_date VARCHAR(64),
          notes TEXT,
          items JSONB DEFAULT '[]'::jsonb,
          status VARCHAR(32) DEFAULT 'INVIATO',
          email_sent BOOLEAN DEFAULT FALSE,
          email_sent_to VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS support_requests (
          id VARCHAR(64) PRIMARY KEY,
          ticket_number VARCHAR(64),
          customer_id VARCHAR(64),
          customer_name VARCHAR(255),
          customer_code VARCHAR(64),
          site_id VARCHAR(64),
          site_name VARCHAR(255),
          site_address VARCHAR(255),
          machine_id VARCHAR(64),
          serial_number VARCHAR(32),
          machine_name VARCHAR(255),
          machine_model VARCHAR(128),
          macro_area VARCHAR(64),
          macro_area_label VARCHAR(128),
          specific_issue VARCHAR(128),
          issue_description TEXT,
          priority VARCHAR(32) DEFAULT 'NORMALE',
          requester_name VARCHAR(128),
          requester_phone VARCHAR(64),
          recipient_email VARCHAR(255),
          status VARCHAR(32) DEFAULT 'APERTO',
          notes TEXT,
          email_sent BOOLEAN DEFAULT FALSE,
          email_sent_to VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS app_config (
          key VARCHAR(64) PRIMARY KEY,
          value JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await client.query(`
        INSERT INTO schema_migrations (version)
        VALUES ('002_master_relational_schema')
        ON CONFLICT (version) DO NOTHING;
      `);

      await client.query('COMMIT');
      isInitialized = true;
      console.log('✅ [POSTGRESQL] Schema tabelle relazionali inizializzato con successo!');
      return true;
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('⚠️ [POSTGRESQL] Errore inizializzazione schema (fallback cache locale):', err);
    return false;
  }
}

export async function syncJsonToPostgres(jsonData: any, options: { pruneDeleted?: boolean } = {}): Promise<{ success: boolean; imported: any }> {
  const p = getPgPool();
  const summary = { customers: 0, sites: 0, machines: 0, devices: 0, logs: 0, orders: 0, supportRequests: 0 };
  if (!p || !jsonData) return { success: false, imported: summary };

  const client = await p.connect();
  try {
    await client.query('BEGIN');

    // 1. Customers & Sites
    if (Array.isArray(jsonData.customers)) {
      for (const c of jsonData.customers) {
        await client.query(
          `
          INSERT INTO customers (id, name, business_name, vat_number, email, phone, address, city, zip_code, province, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            business_name = EXCLUDED.business_name,
            vat_number = EXCLUDED.vat_number,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            zip_code = EXCLUDED.zip_code,
            province = EXCLUDED.province,
            notes = EXCLUDED.notes,
            updated_at = NOW();
        `,
          [c.id, c.name, c.businessName || c.name, c.vatNumber || null, c.email || null, c.phone || null, c.address || null, c.city || null, c.zipCode || null, c.province || null, c.notes || null]
        );
        summary.customers++;

        if (Array.isArray(c.sites)) {
          for (const s of c.sites) {
            await client.query(
              `
              INSERT INTO customer_sites (id, customer_id, name, address, city, zip_code, province, floor_room, contact_person, phone, email, notes)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                address = EXCLUDED.address,
                city = EXCLUDED.city,
                zip_code = EXCLUDED.zip_code,
                province = EXCLUDED.province,
                floor_room = EXCLUDED.floor_room,
                contact_person = EXCLUDED.contact_person,
                phone = EXCLUDED.phone,
                email = EXCLUDED.email,
                notes = EXCLUDED.notes,
                updated_at = NOW();
            `,
              [s.id, c.id, s.name, s.address || null, s.city || null, s.zipCode || null, s.province || null, s.floorRoom || null, s.contactPerson || null, s.phone || null, s.email || null, s.notes || null]
            );
            summary.sites++;
          }
        }
      }

      if (options.pruneDeleted) {
        const activeCustIds = jsonData.customers.map((c: any) => c.id).filter(Boolean);
        if (activeCustIds.length > 0) {
          await client.query(`DELETE FROM customers WHERE id != ALL($1::varchar[])`, [activeCustIds]);
        } else {
          await client.query(`DELETE FROM customers`);
        }

        const activeSiteIds: string[] = [];
        jsonData.customers.forEach((c: any) => {
          (c.sites || []).forEach((s: any) => {
            if (s.id) activeSiteIds.push(s.id);
          });
        });
        if (activeSiteIds.length > 0) {
          await client.query(`DELETE FROM customer_sites WHERE id != ALL($1::varchar[])`, [activeSiteIds]);
        } else {
          await client.query(`DELETE FROM customer_sites`);
        }
      }
    }

    // 2. Devices
    if (Array.isArray(jsonData.devices)) {
      const activeMacs = jsonData.devices.map((d: any) => d.macAddress).filter(Boolean);
      for (const d of jsonData.devices) {
        await client.query(
          `
          INSERT INTO devices (mac_address, serial_number, device_id, board_model, firmware_version, ip_address, wifi_ssid, wifi_rssi, free_heap, uptime_sec, status, assigned_machine_id, hardware_config, diagnostic_logs, last_heartbeat_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          ON CONFLICT (mac_address) DO UPDATE SET
            serial_number = EXCLUDED.serial_number,
            device_id = EXCLUDED.device_id,
            board_model = EXCLUDED.board_model,
            firmware_version = EXCLUDED.firmware_version,
            ip_address = EXCLUDED.ip_address,
            wifi_ssid = EXCLUDED.wifi_ssid,
            wifi_rssi = EXCLUDED.wifi_rssi,
            free_heap = EXCLUDED.free_heap,
            uptime_sec = EXCLUDED.uptime_sec,
            status = EXCLUDED.status,
            assigned_machine_id = EXCLUDED.assigned_machine_id,
            hardware_config = EXCLUDED.hardware_config,
            diagnostic_logs = EXCLUDED.diagnostic_logs,
            last_heartbeat_at = EXCLUDED.last_heartbeat_at,
            updated_at = NOW();
        `,
          [
            d.macAddress,
            d.serialNumber || null,
            d.deviceId || `GB-CLOUD MODULE ${d.serialNumber}`,
            d.boardModel || null,
            d.firmwareVersion || null,
            d.ipAddress || null,
            d.wifiSsid || null,
            d.wifiRssi || null,
            d.freeHeap || null,
            d.uptimeSec || null,
            d.status || 'UNASSIGNED',
            d.assignedMachineId || null,
            JSON.stringify(d.hardwareConfig || {}),
            JSON.stringify(d.diagnosticLogs || []),
            d.lastHeartbeatAt ? new Date(d.lastHeartbeatAt) : null,
          ]
        );
        summary.devices++;
      }

      if (options.pruneDeleted) {
        if (activeMacs.length > 0) {
          await client.query(`DELETE FROM devices WHERE mac_address != ALL($1::varchar[])`, [activeMacs]);
        } else {
          await client.query(`DELETE FROM devices`);
        }
      }
    }

    // 3. Machines
    if (Array.isArray(jsonData.machines)) {
      const activeMachineIds = jsonData.machines.map((m: any) => m.id).filter(Boolean);
      for (const m of jsonData.machines) {
        await client.query(
          `
          INSERT INTO machines (id, serial_number, name, model, status, customer_id, customer_site_id, device_mac, location, location_details, products, calibration, config, total_presses, total_dispensed_liters, last_telemetry_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE SET
            serial_number = EXCLUDED.serial_number,
            name = EXCLUDED.name,
            model = EXCLUDED.model,
            status = EXCLUDED.status,
            customer_id = EXCLUDED.customer_id,
            customer_site_id = EXCLUDED.customer_site_id,
            device_mac = EXCLUDED.device_mac,
            location = EXCLUDED.location,
            location_details = EXCLUDED.location_details,
            products = EXCLUDED.products,
            calibration = EXCLUDED.calibration,
            config = EXCLUDED.config,
            total_presses = EXCLUDED.total_presses,
            total_dispensed_liters = EXCLUDED.total_dispensed_liters,
            last_telemetry_at = EXCLUDED.last_telemetry_at,
            updated_at = NOW();
        `,
          [
            m.id,
            m.serialNumber,
            m.name,
            m.model || null,
            m.status || 'OFFLINE',
            m.customerId || null,
            m.customerSiteId || null,
            m.deviceMac || m.assignedDeviceMac || null,
            m.location || null,
            JSON.stringify(m.locationDetails || {}),
            JSON.stringify(m.products || []),
            JSON.stringify(m.calibration || {}),
            JSON.stringify(m.config || {}),
            Number(m.totalPresses) || 0,
            Number(m.totalDispensedLiters) || 0,
            m.lastTelemetryAt ? new Date(m.lastTelemetryAt) : null,
          ]
        );
        summary.machines++;
      }

      if (options.pruneDeleted) {
        if (activeMachineIds.length > 0) {
          await client.query(`DELETE FROM machines WHERE id != ALL($1::varchar[])`, [activeMachineIds]);
        } else {
          await client.query(`DELETE FROM machines`);
        }
      }
    }

    // 4. Keylogs
    if (Array.isArray(jsonData.logs)) {
      for (const l of jsonData.logs) {
        await client.query(
          `
          INSERT INTO keylogs (id, device_id, mac_address, machine_id, machine_serial_number, machine_name, customer_name, site_name, key_pressed, key_label, product_name, dose_type, dose_multiplier, is_caraffa, event_type, dispensed_liters, recorded_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (id) DO NOTHING;
        `,
          [
            l.id,
            l.deviceId || null,
            l.macAddress || null,
            l.machineId || null,
            l.machineSerialNumber || null,
            l.machineName || null,
            l.customerName || null,
            l.siteName || null,
            l.key,
            l.keyLabel || l.key,
            l.productName || null,
            l.doseType || 'MONODOSE',
            l.doseMultiplier || 1,
            Boolean(l.isCaraffa),
            l.eventType || 'pressed',
            l.dispensedLiters || 0,
            l.timestamp ? new Date(l.timestamp) : new Date(),
          ]
        );
        summary.logs++;
      }
    }

    // 5. Orders
    if (Array.isArray(jsonData.orders)) {
      for (const o of jsonData.orders) {
        await client.query(
          `
          INSERT INTO orders (id, order_number, customer_id, customer_name, customer_code, site_id, site_name, site_address, recipient_email, requester_name, requester_phone, requested_delivery_date, notes, items, status, email_sent, email_sent_to, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            notes = EXCLUDED.notes,
            email_sent = EXCLUDED.email_sent,
            updated_at = NOW();
        `,
          [
            o.id,
            o.orderNumber || o.id,
            o.customerId || null,
            o.customerName || null,
            o.customerCode || null,
            o.siteId || null,
            o.siteName || null,
            o.siteAddress || null,
            o.recipientEmail || null,
            o.requesterName || null,
            o.requesterPhone || null,
            o.requestedDeliveryDate || null,
            o.notes || null,
            JSON.stringify(o.items || []),
            o.status || 'INVIATO',
            Boolean(o.emailSent),
            o.emailSentTo || null,
            o.createdAt ? new Date(o.createdAt) : new Date(),
          ]
        );
        summary.orders++;
      }
    }

    // 6. Support Requests
    if (Array.isArray(jsonData.supportRequests)) {
      for (const t of jsonData.supportRequests) {
        await client.query(
          `
          INSERT INTO support_requests (id, ticket_number, customer_id, customer_name, customer_code, site_id, site_name, site_address, machine_id, serial_number, machine_name, machine_model, macro_area, macro_area_label, specific_issue, issue_description, priority, requester_name, requester_phone, recipient_email, status, notes, email_sent, email_sent_to, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW())
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            notes = EXCLUDED.notes,
            priority = EXCLUDED.priority,
            email_sent = EXCLUDED.email_sent,
            updated_at = NOW();
        `,
          [
            t.id,
            t.ticketNumber || t.id,
            t.customerId || null,
            t.customerName || null,
            t.customerCode || null,
            t.siteId || null,
            t.siteName || null,
            t.siteAddress || null,
            t.machineId || null,
            t.serialNumber || null,
            t.machineName || null,
            t.machineModel || null,
            t.macroArea || null,
            t.macroAreaLabel || null,
            t.specificIssue || null,
            t.issueDescription || null,
            t.priority || 'NORMALE',
            t.requesterName || null,
            t.requesterPhone || null,
            t.recipientEmail || null,
            t.status || 'APERTO',
            t.notes || null,
            Boolean(t.emailSent),
            t.emailSentTo || null,
            t.createdAt ? new Date(t.createdAt) : new Date(),
          ]
        );
        summary.supportRequests++;
      }
    }

    // 7. Users
    if (Array.isArray(jsonData.users)) {
      for (const u of jsonData.users) {
        await client.query(
          `
          INSERT INTO users (id, username, password_hash, role, name, email, phone, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            active = EXCLUDED.active;
        `,
          [u.id, u.username, u.password || u.password_hash, u.role, u.name || null, u.email || null, u.phone || null, u.active !== false]
        );
      }
    }

    // 8. Global Config
    if (jsonData.config) {
      await client.query(
        `
        INSERT INTO app_config (key, value, updated_at)
        VALUES ('system_config', $1, NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW();
      `,
        [JSON.stringify(jsonData.config)]
      );
    }

    await client.query('COMMIT');
    return { success: true, imported: summary };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during JSON to Postgres sync:', err);
    return { success: false, imported: summary };
  } finally {
    client.release();
  }
}

/**
 * CLEAN RESTORE TO POSTGRES:
 * Clears existing state tables in PostgreSQL and populates them exactly from the JSON snapshot.
 * Used when restoring from a clean backup (e.g. 3 machines, 3 modules).
 */
export async function cleanRestoreJsonToPostgres(jsonData: any): Promise<{ success: boolean; count: any; error?: string }> {
  const p = getPgPool();
  if (!p || !jsonData) return { success: false, count: {}, error: 'PostgreSQL non disponibile' };

  const client = await p.connect();
  try {
    await client.query('BEGIN');

    // Clean current state tables (cascading foreign keys)
    await client.query('TRUNCATE customer_sites, customers, machines, devices, orders, support_requests CASCADE;');

    await client.query('COMMIT');

    // Now re-insert clean state
    const syncRes = await syncJsonToPostgres(jsonData, { pruneDeleted: true });

    return {
      success: syncRes.success,
      count: {
        machines: Array.isArray(jsonData.machines) ? jsonData.machines.length : 0,
        devices: Array.isArray(jsonData.devices) ? jsonData.devices.length : 0,
        customers: Array.isArray(jsonData.customers) ? jsonData.customers.length : 0,
        logs: Array.isArray(jsonData.logs) ? jsonData.logs.length : 0,
      },
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    return { success: false, count: {}, error: err.message || String(err) };
  } finally {
    client.release();
  }
}

export async function restorePostgresToJson(): Promise<{ success: boolean; data?: any; count?: any; error?: string }> {
  const p = getPgPool();
  if (!p) return { success: false, error: 'PostgreSQL pool not available' };

  const client = await p.connect();
  try {
    const custRes = await client.query('SELECT * FROM customers ORDER BY created_at ASC');
    const sitesRes = await client.query('SELECT * FROM customer_sites ORDER BY created_at ASC');
    const sitesByCust = new Map<string, any[]>();
    for (const s of sitesRes.rows) {
      const list = sitesByCust.get(s.customer_id) || [];
      list.push({
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city,
        zipCode: s.zip_code,
        province: s.province,
        floorRoom: s.floor_room,
        contactPerson: s.contact_person,
        phone: s.phone,
        email: s.email,
        notes: s.notes,
      });
      sitesByCust.set(s.customer_id, list);
    }
    const customers = custRes.rows.map((c) => ({
      id: c.id,
      name: c.name,
      businessName: c.business_name,
      vatNumber: c.vat_number,
      email: c.email,
      phone: c.phone,
      address: c.address,
      city: c.city,
      zipCode: c.zip_code,
      province: c.province,
      notes: c.notes,
      sites: sitesByCust.get(c.id) || [],
      createdAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
    }));

    const machRes = await client.query('SELECT * FROM machines ORDER BY created_at ASC');
    const machines = machRes.rows.map((m) => ({
      id: m.id,
      serialNumber: m.serial_number,
      name: m.name,
      model: m.model,
      status: m.status,
      customerId: m.customer_id,
      customerSiteId: m.customer_site_id,
      deviceMac: m.device_mac,
      assignedDeviceMac: m.device_mac,
      location: m.location,
      locationDetails: m.location_details || {},
      products: m.products || [],
      calibration: m.calibration || {},
      config: m.config || {},
      totalPresses: Number(m.total_presses) || 0,
      totalDispensedLiters: Number(m.total_dispensed_liters) || 0,
      lastTelemetryAt: m.last_telemetry_at ? new Date(m.last_telemetry_at).toISOString() : undefined,
      createdAt: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
    }));

    const devRes = await client.query('SELECT * FROM devices ORDER BY created_at ASC');
    const devices = devRes.rows.map((d) => ({
      macAddress: d.mac_address,
      serialNumber: d.serial_number,
      deviceId: d.device_id,
      boardModel: d.board_model,
      firmwareVersion: d.firmware_version,
      ipAddress: d.ip_address,
      wifiSsid: d.wifi_ssid,
      wifiRssi: d.wifi_rssi,
      freeHeap: d.free_heap,
      uptimeSec: Number(d.uptime_sec) || 0,
      status: d.status,
      assignedMachineId: d.assigned_machine_id,
      hardwareConfig: d.hardware_config || {},
      diagnosticLogs: d.diagnostic_logs || [],
      lastHeartbeatAt: d.last_heartbeat_at ? new Date(d.last_heartbeat_at).toISOString() : undefined,
      createdAt: d.created_at ? new Date(d.created_at).toISOString() : new Date().toISOString(),
    }));

    const logRes = await client.query('SELECT * FROM keylogs ORDER BY recorded_at DESC LIMIT 20000');
    const logs = logRes.rows.map((l) => ({
      id: l.id,
      deviceId: l.device_id,
      macAddress: l.mac_address,
      machineId: l.machine_id,
      machineSerialNumber: l.machine_serial_number,
      machineName: l.machine_name,
      customerName: l.customer_name,
      siteName: l.site_name,
      key: l.key_pressed,
      keyLabel: l.key_label,
      productName: l.product_name,
      doseType: l.dose_type,
      doseMultiplier: Number(l.dose_multiplier) || 1,
      isCaraffa: Boolean(l.is_caraffa),
      eventType: l.event_type,
      dispensedLiters: Number(l.dispensed_liters) || 0,
      timestamp: l.recorded_at ? new Date(l.recorded_at).toISOString() : new Date().toISOString(),
    }));

    let orders: any[] = [];
    try {
      const orderRes = await client.query('SELECT * FROM orders ORDER BY created_at DESC');
      orders = orderRes.rows.map((o) => ({
        id: o.id,
        orderNumber: o.order_number,
        customerId: o.customer_id,
        customerName: o.customer_name,
        customerCode: o.customer_code,
        siteId: o.site_id,
        siteName: o.site_name,
        siteAddress: o.site_address,
        recipientEmail: o.recipient_email,
        requesterName: o.requester_name,
        requesterPhone: o.requester_phone,
        requestedDeliveryDate: o.requested_delivery_date,
        notes: o.notes,
        items: o.items || [],
        status: o.status,
        emailSent: Boolean(o.email_sent),
        emailSentTo: o.email_sent_to,
        createdAt: o.created_at ? new Date(o.created_at).toISOString() : new Date().toISOString(),
      }));
    } catch {}

    let supportRequests: any[] = [];
    try {
      const suppRes = await client.query('SELECT * FROM support_requests ORDER BY created_at DESC');
      supportRequests = suppRes.rows.map((t) => ({
        id: t.id,
        ticketNumber: t.ticket_number,
        customerId: t.customer_id,
        customerName: t.customer_name,
        customerCode: t.customer_code,
        siteId: t.site_id,
        siteName: t.site_name,
        siteAddress: t.site_address,
        machineId: t.machine_id,
        serialNumber: t.serial_number,
        machineName: t.machine_name,
        machineModel: t.machine_model,
        macroArea: t.macro_area,
        macroAreaLabel: t.macro_area_label,
        specificIssue: t.specific_issue,
        issueDescription: t.issue_description,
        priority: t.priority,
        requesterName: t.requester_name,
        requesterPhone: t.requester_phone,
        recipientEmail: t.recipient_email,
        status: t.status,
        notes: t.notes,
        emailSent: Boolean(t.email_sent),
        emailSentTo: t.email_sent_to,
        createdAt: t.created_at ? new Date(t.created_at).toISOString() : new Date().toISOString(),
      }));
    } catch {}

    const userRes = await client.query('SELECT * FROM users ORDER BY created_at ASC');
    const users =
      userRes.rows.length > 0
        ? userRes.rows.map((u) => ({
            id: u.id,
            username: u.username,
            password: u.password_hash,
            role: u.role,
            name: u.name,
            email: u.email,
            phone: u.phone,
            active: u.active,
            createdAt: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
            lastLoginAt: u.last_login_at ? new Date(u.last_login_at).toISOString() : undefined,
          }))
        : undefined;

    let config: any = undefined;
    try {
      const cfgRes = await client.query("SELECT value FROM app_config WHERE key = 'system_config' LIMIT 1");
      if (cfgRes.rows.length > 0) {
        config = cfgRes.rows[0].value;
      }
    } catch {}

    return {
      success: true,
      data: {
        customers,
        machines,
        devices,
        logs,
        orders,
        supportRequests,
        ...(users ? { users } : {}),
        ...(config ? { config } : {}),
      },
      count: {
        customers: customers.length,
        machines: machines.length,
        devices: devices.length,
        logs: logs.length,
        orders: orders.length,
        supportRequests: supportRequests.length,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  } finally {
    client.release();
  }
}

export async function insertKeylogDirect(l: any): Promise<boolean> {
  const p = getPgPool();
  if (!p) return false;
  try {
    const client = await p.connect();
    try {
      await client.query(
        `
        INSERT INTO keylogs (id, device_id, mac_address, machine_id, machine_serial_number, machine_name, customer_name, site_name, key_pressed, key_label, product_name, dose_type, dose_multiplier, is_caraffa, event_type, dispensed_liters, recorded_at, raw_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        ON CONFLICT (id) DO UPDATE SET
          dispensed_liters = EXCLUDED.dispensed_liters,
          event_type = EXCLUDED.event_type;
      `,
        [
          l.id || `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          l.deviceId || null,
          l.macAddress || null,
          l.machineId || null,
          l.machineSerialNumber || null,
          l.machineName || null,
          l.customerName || null,
          l.siteName || null,
          l.key,
          l.keyLabel || l.key,
          l.productName || null,
          l.doseType || 'MONODOSE',
          l.doseMultiplier || 1,
          Boolean(l.isCaraffa),
          l.eventType || 'pressed',
          l.dispensedLiters || 0,
          l.timestamp ? new Date(l.timestamp) : new Date(),
          JSON.stringify(l.metadata || {}),
        ]
      );
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Failed to insert keylog directly to PostgreSQL:', err);
    return false;
  }
}
