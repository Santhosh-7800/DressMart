import { productService, brandService, categoryService } from './productService';
import type { Gender, SellerProductInput } from '@/types';

export interface ProductImportRow {
  name: string;
  sku: string;
  brand: string;
  category: string;
  subcategory: string;
  description: string;
  price: string;
  mrp: string;
  fabric: string;
  color: string;
  size: string;
  stock: string;
  image_url: string;
}

export const IMPORT_CSV_COLUMNS = ['name', 'sku', 'brand', 'category', 'subcategory', 'description', 'price', 'mrp', 'fabric', 'color', 'size', 'stock', 'image_url'];

/** Minimal RFC4180-ish CSV parser — handles quoted fields containing commas/quotes, but not
 *  quoted fields spanning multiple lines (fine for a basic bulk-import tool). Header row's
 *  columns are matched case-insensitively against IMPORT_CSV_COLUMNS; unknown columns are ignored,
 *  missing ones read as ''. */
export function parseProductCsv(text: string): ProductImportRow[] {
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  function splitLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells.map((c) => c.trim());
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row: Record<string, string> = {};
    IMPORT_CSV_COLUMNS.forEach((col) => {
      const idx = headers.indexOf(col);
      row[col] = idx >= 0 ? (cells[idx] ?? '') : '';
    });
    return row as unknown as ProductImportRow;
  });
}

export interface ImportOutcome {
  successCount: number;
  errors: { row: number; name: string; message: string }[];
}

/**
 * Basic bulk import: each CSV row becomes one product with a single color/size variant (no
 * per-color image galleries or multi-size stock splits — that level of detail still requires
 * editing the product afterward via the full Add/Edit Product form). Brand/Category are matched
 * by exact name (case-insensitive) against this store's existing catalog; a row whose brand or
 * category doesn't match anything fails with a clear error rather than silently creating a
 * miscategorized product.
 */
export async function importProducts(
  rows: ProductImportRow[],
  gender: Gender,
  sellerId: string,
  sellerName: string,
  actor: { id: string; name: string } | undefined,
): Promise<ImportOutcome> {
  const [brands, categories] = await Promise.all([brandService.list(), categoryService.list(gender)]);
  const brandByName = new Map(brands.map((b) => [b.name.toLowerCase(), b]));
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

  const errors: ImportOutcome['errors'] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 2; // +1 for 0-index, +1 for the header row
    try {
      if (!row.name.trim()) throw new Error('Product name is required');
      const brand = brandByName.get(row.brand.trim().toLowerCase());
      if (!brand) throw new Error(`Brand "${row.brand}" not found`);
      const category = categoryByName.get(row.category.trim().toLowerCase());
      if (!category) throw new Error(`Category "${row.category}" not found`);
      const price = Number(row.price);
      if (!price || price <= 0) throw new Error('Price must be a positive number');
      const mrp = Number(row.mrp) || price;
      const stock = Math.max(0, Math.round(Number(row.stock)) || 0);

      const input: SellerProductInput = {
        name: row.name.trim(),
        sku: row.sku.trim(),
        brand_id: brand.id,
        category_id: category.id,
        subcategory: row.subcategory.trim(),
        gender,
        description: row.description.trim() || row.name.trim(),
        fabric: row.fabric.trim(),
        sleeve: '',
        fit: '',
        pattern: '',
        collar: '',
        occasion: '',
        price,
        mrp,
        gst_percent: 5,
        cod_available: true,
        low_stock_threshold: 5,
        colors: [
          {
            name: row.color.trim() || 'Default',
            hex: '#6b7280',
            images: row.image_url.trim() ? [row.image_url.trim()] : [],
            sizeStock: { [row.size.trim() || 'M']: stock },
          },
        ],
        is_return_eligible: true,
        is_exchange_eligible: true,
        status: 'draft',
      };

      await productService.create(sellerId, sellerName, input, actor);
      successCount += 1;
    } catch (error) {
      errors.push({ row: rowNumber, name: row.name || '(unnamed)', message: error instanceof Error ? error.message : 'Import failed' });
    }
  }

  return { successCount, errors };
}
