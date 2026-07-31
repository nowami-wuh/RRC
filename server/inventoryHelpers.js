import { execute, query } from './db.js';

/**
 * Safely parses equipment array or JSON string into normalized items:
 * [{ itemCode, qty, name }]
 */
export function parseEquipmentList(equipmentJsonOrArray) {
  let list = [];
  if (typeof equipmentJsonOrArray === 'string') {
    try {
      list = JSON.parse(equipmentJsonOrArray);
    } catch (_) {
      list = [];
    }
  } else if (Array.isArray(equipmentJsonOrArray)) {
    list = equipmentJsonOrArray;
  }
  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const code = item.id || item.item_code || item.itemCode || item.code;
      const qty = parseInt(item.qty || item.quantity || 1, 10);
      return {
        itemCode: code ? String(code) : null,
        qty: isNaN(qty) || qty < 1 ? 1 : qty,
        name: item.name || code || 'Item',
      };
    })
    .filter((item) => item !== null && item.itemCode !== null);
}

/**
 * Validates that each item in requested equipment exists and has sufficient stock.
 * Throws an Error if any item has insufficient stock or is not found.
 */
export async function validateEquipmentStock(equipmentItems) {
  for (const item of equipmentItems) {
    const rows = await query(
      'SELECT * FROM inventory_items WHERE item_code = ? OR id = ? LIMIT 1',
      [item.itemCode, item.itemCode],
    );
    if (rows.length === 0) {
      throw new Error(`Equipment item "${item.name}" (${item.itemCode}) was not found in inventory.`);
    }
    const inv = rows[0];
    if (inv.stock < item.qty) {
      throw new Error(`Insufficient stock for "${inv.name}". Requested: ${item.qty}, Available: ${inv.stock}.`);
    }
  }
}

/**
 * Decrements stock in inventory_items for each requested item (reserving inventory).
 */
export async function reserveEquipmentStock(equipmentItems) {
  for (const item of equipmentItems) {
    await execute(
      'UPDATE inventory_items SET stock = GREATEST(0, stock - ?) WHERE item_code = ? OR id = ?',
      [item.qty, item.itemCode, item.itemCode],
    );
  }
}

/**
 * Increments stock in inventory_items for each item (releasing reserved inventory).
 */
export async function releaseEquipmentStock(equipmentItems) {
  for (const item of equipmentItems) {
    await execute(
      'UPDATE inventory_items SET stock = stock + ? WHERE item_code = ? OR id = ?',
      [item.qty, item.itemCode, item.itemCode],
    );
  }
}
