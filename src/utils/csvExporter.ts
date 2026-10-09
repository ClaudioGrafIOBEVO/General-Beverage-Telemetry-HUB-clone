/**
 * Utility per esportazione pulita e compatibile di file CSV e SQL.
 * - Utilizza Blob nativo con BOM UTF-8 (\uFEFF) per garantire perfetta apertura in Excel senza caratteri corrotti
 * - Sanitizza i campi e gestisce correttamente virgolette e a capo
 * - Utilizza URL.createObjectURL e revoca immediata per evitare limitazioni di dimensione dei data URI
 */

export function downloadCsvFile(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]): void {
  const sanitizeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    // Escape double quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headerLine = headers.map(sanitizeCell).join(';');
  const dataLines = rows.map((r) => r.map(sanitizeCell).join(';'));
  
  // Utilizziamo il punto e virgola ';' come separatore standard italiano per Excel e UTF-8 BOM
  const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Rilascia l'URL allocato
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function downloadSqlFile(filename: string, sqlContent: string): void {
  const blob = new Blob([sqlContent], { type: 'application/sql;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.sql') ? filename : `${filename}.sql`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
