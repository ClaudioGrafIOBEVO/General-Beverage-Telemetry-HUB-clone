/**
 * SCRIPT DI RIPRISTINO ISTANTANEO DA DATABASE POSTGRESQL A JSON
 * Estrae macchine, clienti, sedi, moduli hardware e tutte le erogazioni da PostgreSQL
 * e le ripristina direttamente nel file data/keypad_db.json attivo della piattaforma.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

async function runRestore() {
  console.log('========================================================================');
  console.log('🔄 RIPRISTINO DATI DA POSTGRESQL');
  console.log('========================================================================');

  const connectionString = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
  const config = connectionString
    ? { connectionString, ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined }
    : {
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432', 10),
        user: process.env.PG_USER || 'postgres',
        password: process.env.PG_PASSWORD || '',
        database: process.env.PG_DATABASE || 'gb_telemetria',
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      };

  const client = new Client(config);

  try {
    await client.connect();
    console.log('✅ Connesso al database PostgreSQL:', config.database || connectionString);

    // 1. Clienti e Sedi
    console.log('📦 Lettura Clienti e Sedi...');
    const custRes = await client.query('SELECT * FROM customers ORDER BY created_at ASC');
    let sitesRes = { rows: [] };
    try {
      sitesRes = await client.query('SELECT * FROM customer_sites ORDER BY created_at ASC');
    } catch {}

    const sitesByCust = {};
    for (const s of sitesRes.rows) {
      if (!sitesByCust[s.customer_id]) sitesByCust[s.customer_id] = [];
      sitesByCust[s.customer_id].push({
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
    }

    const customers = custRes.rows.map((c) => ({
      id: c.id,
      name: c.name,
      businessName: c.business_name || c.name,
      vatNumber: c.vat_number || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      city: c.city || '',
      zipCode: c.zip_code || '',
      province: c.province || '',
      notes: c.notes || '',
      sites: sitesByCust[c.id] || [],
      createdAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
    }));

    // 2. Macchine
    console.log('☕ Lettura Macchine e Distributori...');
    const machRes = await client.query('SELECT * FROM machines ORDER BY created_at ASC');
    const machines = machRes.rows.map((m) => ({
      id: m.id,
      serialNumber: m.serial_number,
      name: m.name,
      model: m.model,
      status: m.status || 'OFFLINE',
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

    // 3. Moduli Hardware
    console.log('📡 Lettura Moduli Hardware ESP32...');
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
      status: d.status || 'UNASSIGNED',
      assignedMachineId: d.assigned_machine_id,
      hardwareConfig: d.hardware_config || {},
      diagnosticLogs: d.diagnostic_logs || [],
      lastHeartbeatAt: d.last_heartbeat_at ? new Date(d.last_heartbeat_at).toISOString() : undefined,
      createdAt: d.created_at ? new Date(d.created_at).toISOString() : new Date().toISOString(),
    }));

    // 4. Erogazioni & Keylogs
    console.log('📊 Lettura Storico Erogazioni (Keylogs)...');
    const logRes = await client.query('SELECT * FROM keylogs ORDER BY recorded_at ASC');
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
      doseType: l.dose_type || 'MONODOSE',
      doseMultiplier: Number(l.dose_multiplier) || 1,
      isCaraffa: Boolean(l.is_caraffa),
      eventType: l.event_type || 'pressed',
      dispensedLiters: Number(l.dispensed_liters) || 0,
      timestamp: l.recorded_at ? new Date(l.recorded_at).toISOString() : new Date().toISOString(),
    }));

    // 5. Utenti
    let users = undefined;
    try {
      const userRes = await client.query('SELECT * FROM users ORDER BY created_at ASC');
      if (userRes.rows.length > 0) {
        users = userRes.rows.map((u) => ({
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
        }));
      }
    } catch {}

    // Salvataggio nel file data/keypad_db.json
    const dbPath = path.join(process.cwd(), 'data', 'keypad_db.json');
    const currentDb = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : {};

    if (customers.length > 0) currentDb.customers = customers;
    if (machines.length > 0) currentDb.machines = machines;
    if (devices.length > 0) currentDb.devices = devices;
    if (logs.length > 0) currentDb.logs = logs;
    if (users && users.length > 0) currentDb.users = users;

    fs.writeFileSync(dbPath, JSON.stringify(currentDb, null, 2), 'utf8');

    console.log('========================================================================');
    console.log('🎉 RIPRISTINO DA POSTGRESQL COMPLETATO CON SUCCESSO!');
    console.log(`✅ Macchine ripristinate:   ${machines.length}`);
    console.log(`✅ Clienti ripristinati:    ${customers.length}`);
    console.log(`✅ Moduli ripristinati:     ${devices.length}`);
    console.log(`✅ Erogazioni ripristinate: ${logs.length}`);
    console.log('========================================================================');
    console.log('Ora riavvia PM2 con: pm2 restart all');
  } catch (err) {
    console.error('❌ Errore durante il ripristino da PostgreSQL:', err.message);
  } finally {
    try { await client.end(); } catch {}
  }
}

runRestore();
