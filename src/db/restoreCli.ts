import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { initPgSchema, cleanRestoreJsonToPostgres, testPgConnection } from './postgres';

async function main() {
  console.log('========================================================================');
  console.log('🔄 RIPRISTINO DIRETTO DATABASE SQL (POSTGRESQL)');
  console.log('========================================================================');

  const targetArg = process.argv[2];
  let targetFile = targetArg ? path.resolve(process.cwd(), targetArg) : path.resolve(process.cwd(), 'data/keypad_db.json');

  if (!fs.existsSync(targetFile)) {
    // If not found, check in data/backups
    const backupCandidate = path.resolve(process.cwd(), 'data/backups', targetArg || '');
    if (fs.existsSync(backupCandidate)) {
      targetFile = backupCandidate;
    } else {
      console.error(`❌ File di backup non trovato: ${targetFile}`);
      process.exit(1);
    }
  }

  console.log(`📂 File sorgente: ${targetFile}`);

  const raw = fs.readFileSync(targetFile, 'utf-8');
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch (err: any) {
    console.error(`❌ Errore di parsing JSON nel file: ${err.message}`);
    process.exit(1);
  }

  console.log(`📊 Contenuto da importare:`);
  console.log(`   - Macchine: ${data.machines?.length || 0}`);
  console.log(`   - Moduli (Devices): ${data.devices?.length || 0}`);
  console.log(`   - Clienti: ${data.customers?.length || 0}`);
  console.log(`   - Erogazioni (Logs): ${data.logs?.length || 0}`);

  console.log('\n🔌 Connessione a PostgreSQL...');
  const isConnected = await testPgConnection();
  if (!isConnected) {
    console.error('❌ Impossibile connettersi al database PostgreSQL.');
    console.error('   Verifica che PostgreSQL sia in esecuzione (es: sudo systemctl status postgresql)');
    console.error('   o controlla DATABASE_URL nel file .env');
    process.exit(1);
  }

  console.log('⚙️  Inizializzazione / Verifica schema tabelle relazionali...');
  await initPgSchema();

  console.log('🧹 Pulizia tabelle e applicazione stato esatto su PostgreSQL...');
  const res = await cleanRestoreJsonToPostgres(data);

  if (!res.success) {
    console.error(`❌ Errore durante il ripristino su PostgreSQL: ${res.error}`);
    process.exit(1);
  }

  // Also sync data/keypad_db.json so local mirror is completely aligned
  try {
    const dbFile = path.resolve(process.cwd(), 'data/keypad_db.json');
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`💾 Cache locale data/keypad_db.json aggiornata ed allineata al 100%.`);
  } catch {}

  console.log('\n========================================================================');
  console.log('🎉 RIPRISTINO SQL COMPLETATO CON SUCCESSO!');
  console.log(`   PostgreSQL è ora il riferimento assoluto con:`);
  console.log(`   - ${res.count.machines} Macchine`);
  console.log(`   - ${res.count.devices} Moduli`);
  console.log(`   - ${res.count.customers} Clienti`);
  console.log(`   - ${res.count.logs} Erogazioni`);
  console.log('========================================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('Errore non gestito:', err);
  process.exit(1);
});
