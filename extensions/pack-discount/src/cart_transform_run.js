// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

/**
 * @type {CartTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  if (!input || !input.cart || !Array.isArray(input.cart.lines)) return NO_CHANGES;

  // Discount mapping for packs (packSize -> percent)
  /** @type {Record<number, number>} */
  const PACK_DISCOUNTS = {
    1: 10, // Pack of 1 -> 10%
    2: 20, // Pack of 2 -> 20%
  };

  /**
   * Parse "Pack of N" from product title. Returns integer N or null.
   * Accepts titles like "Pack of 2", "PACK OF 2", "pack of 2 - special", etc.
   */
  /** @param {any} title */
  function parsePackSizeFromTitle(title) {
    if (!title || typeof title !== 'string') return null;
    const m = title.match(/pack\s*of\s*(\d+)/i);
    if (m) return parseInt(m[1], 10);
    return null;
  }

  const ops = [];

  for (const line of input.cart.lines) {
    try {
      const cartLineId = line.id;
      // use a loose-typed variable to avoid strict TS checks from generated types
      /** @type {any} */
      const l = line;
      // Determine the product title (if available)
      const productTitle = l.merchandise && l.merchandise.__typename === 'ProductVariant' && l.merchandise.product
        ? l.merchandise.product.title
        : null;

      const packSize = parsePackSizeFromTitle(productTitle);
      if (!packSize) continue; // not a pack product

  const discountPercent = PACK_DISCOUNTS[packSize];
      if (!discountPercent) continue; // no configured discount for this pack size

      // Get original price: prefer compareAtAmountPerQuantity when present
  const cost = l.cost || {};
  const compareAt = cost.compareAtAmountPerQuantity && cost.compareAtAmountPerQuantity.amount;
  const currentAmount = cost.amountPerQuantity && cost.amountPerQuantity.amount;
      if (!currentAmount && !compareAt) continue; // can't determine price

      const originalPriceStr = compareAt || currentAmount;
      const originalPrice = Number(originalPriceStr);
      if (Number.isNaN(originalPrice)) continue;

      const discountedUnit = (originalPrice * (1 - discountPercent / 100));
      // Ensure two decimal places as a string
      const discountedUnitStr = discountedUnit.toFixed(2);

      // Build a lineUpdate operation that fixes the unit price per quantity
      ops.push({
        lineUpdate: {
          cartLineId,
          price: {
            adjustment: {
              fixedPricePerUnit: {
                amount: discountedUnitStr,
              },
            },
          },
        },
      });
    } catch (err) {
      // On unexpected errors for a line, skip it (don't fail entire run)
      continue;
    }
  }

  if (ops.length === 0) return NO_CHANGES;

  return { operations: ops };
};