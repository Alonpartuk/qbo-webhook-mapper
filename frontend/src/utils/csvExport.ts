/**
 * CSV Export Utility
 *
 * Provides functions to export data to CSV format and trigger downloads.
 * Supports custom column headers and value formatting.
 */

export interface CsvColumn<T> {
  key: keyof T | string;
  header: string;
  format?: (value: unknown, row: T) => string;
}

/**
 * Escape a value for CSV format
 * - Wraps values containing commas, quotes, or newlines in double quotes
 * - Escapes double quotes by doubling them
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // If the value contains special characters, wrap in quotes and escape existing quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Get a nested value from an object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return (current as Record<string, unknown>)[key];
  }, obj as unknown);
}

/**
 * Convert an array of objects to CSV string
 */
export function arrayToCsv<T extends Record<string, unknown>>(
  data: T[],
  columns: CsvColumn<T>[]
): string {
  if (data.length === 0) {
    // Return just headers if no data
    return columns.map((col) => escapeCsvValue(col.header)).join(',');
  }

  // Create header row
  const headerRow = columns.map((col) => escapeCsvValue(col.header)).join(',');

  // Create data rows
  const dataRows = data.map((row) => {
    return columns
      .map((col) => {
        const value = getNestedValue(row as Record<string, unknown>, col.key as string);
        const formattedValue = col.format ? col.format(value, row) : value;
        return escapeCsvValue(formattedValue);
      })
      .join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Trigger a CSV file download in the browser
 */
export function downloadCsv(csvContent: string, filename: string): void {
  // Add BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Export data to CSV and download
 */
export function exportToCsv<T extends Record<string, unknown>>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string
): void {
  const csvContent = arrayToCsv(data, columns);
  downloadCsv(csvContent, filename);
}

// Pre-defined column configurations for common entity types

export const customerCsvColumns: CsvColumn<Record<string, unknown>>[] = [
  { key: 'Id', header: 'QBO ID' },
  { key: 'DisplayName', header: 'Display Name' },
  {
    key: 'PrimaryEmailAddr.Address',
    header: 'Email',
    format: (value) => (value as string) || '',
  },
  {
    key: 'PrimaryPhone.FreeFormNumber',
    header: 'Phone',
    format: (value) => (value as string) || '',
  },
  {
    key: 'Balance',
    header: 'Balance',
    format: (value) => (value != null ? `$${Number(value).toFixed(2)}` : '$0.00'),
  },
  {
    key: 'Active',
    header: 'Status',
    format: (value) => (value ? 'Active' : 'Inactive'),
  },
  {
    key: 'BillAddr',
    header: 'Billing Address',
    format: (_, row) => {
      const addr = row.BillAddr as Record<string, string> | undefined;
      if (!addr) return '';
      return [addr.Line1, addr.City, addr.CountrySubDivisionCode, addr.PostalCode]
        .filter(Boolean)
        .join(', ');
    },
  },
];

export const itemCsvColumns: CsvColumn<Record<string, unknown>>[] = [
  { key: 'Id', header: 'QBO ID' },
  { key: 'Name', header: 'Name' },
  { key: 'Type', header: 'Type' },
  { key: 'Sku', header: 'SKU', format: (value) => (value as string) || '' },
  {
    key: 'UnitPrice',
    header: 'Unit Price',
    format: (value) => (value != null ? `$${Number(value).toFixed(2)}` : ''),
  },
  {
    key: 'QtyOnHand',
    header: 'Qty On Hand',
    format: (value) => (value != null ? String(value) : ''),
  },
  {
    key: 'Active',
    header: 'Status',
    format: (value) => (value ? 'Active' : 'Inactive'),
  },
  { key: 'Description', header: 'Description', format: (value) => (value as string) || '' },
];
