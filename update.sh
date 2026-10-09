#!/bin/bash
set -e

# ==============================================================================
# SCRIPT DI AGGIORNAMENTO AUTOMATICO - GENERAL BEVERAGE TELEMETRIA HUB
# ==============================================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "========================================================================"
echo "🚀 AGGIORNAMENTO GENERAL BEVERAGE TELEMETRY HUB"
echo "Cartella: $DIR"
echo "Data:     $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================================================"

# 1. Ferma temporaneamente PM2 (impedisce al server attivo di riscrivere il database durante il pull)
if command -v pm2 >/dev/null 2>&1; then
  echo "⏸️  [1/6] Sospensione temporanea processo Node.js / PM2..."
  pm2 stop all || true
fi

# 2. Backup rapido del database JSON locale e snapshot SQL se presente
mkdir -p data/backups
if [ -f "data/keypad_db.json" ]; then
  TEMP_BACKUP="data/backups/keypad_db_pre_update_$(date +%Y%m%d_%H%M%S).json"
  KEEP_BACKUP="data/backups/keypad_db_keep.json"
  cp data/keypad_db.json "$TEMP_BACKUP"
  cp data/keypad_db.json "$KEEP_BACKUP"
  echo "📦 [2/6] Backup di sicurezza database JSON creato: $TEMP_BACKUP"
fi

if command -v pg_dump >/dev/null 2>&1; then
  sudo -u postgres pg_dump gb_telemetria > "data/backups/pg_dump_$(date +%Y%m%d_%H%M%S).sql" 2>/dev/null || true
  echo "🗄️  [2/6] Backup dump SQL (gb_telemetria) salvato con successo."
fi

# 3. Scaricamento codice da GitHub (senza blocchi o conflitti git)
echo "📥 [3/6] Scaricamento ultimi aggiornamenti da GitHub..."
git fetch origin main || true
# Reset pulito dei file di codice per evitare qualsiasi conflitto merge
git reset --hard origin/main

# Ripristina e garantisce la persistenza del database locale
if [ -f "data/backups/keypad_db_keep.json" ]; then
  cp "data/backups/keypad_db_keep.json" data/keypad_db.json
  rm -f "data/backups/keypad_db_keep.json"
  echo "🛡️  Database locale preservato e garantito!"
fi

# 4. Installazione dipendenze
echo "📦 [4/6] Aggiornamento dipendenze npm..."
npm install --no-audit --no-fund

# 5. Build di produzione
echo "⚙️  [5/6] Compilazione frontend Vite e bundle server Node.js..."
npm run build

# 6. Riavvio PM2
echo "🔄 [6/6] Riavvio servizio server PM2..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart all || pm2 restart iobevo-telemetria || pm2 start dist/server.cjs --name "iobevo-telemetria"
  echo "✅ Servizio PM2 riavviato e attivo."
else
  echo "⚠️  PM2 non rilevato globalmente nel PATH. Se usi systemd o node diretto, riavvia con il tuo gestore servizi."
fi

echo "========================================================================"
echo "🎉 AGGIORNAMENTO COMPLETATO CON SUCCESSO!"
echo "========================================================================"
