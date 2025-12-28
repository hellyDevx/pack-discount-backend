// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

/** @type {CartTransformRunResult} */
const NO_CHANGES = { operations: [] };

/**
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  if (!input?.cart?.lines) return NO_CHANGES;

  const UNIT_DISCOUNT_PERCENT = 10;
  const ops = [];

  function parsePackSizeFromTitle(title) {
    if (!title || typeof title !== 'string') return null;
    const m = title.match(/pack\s*of\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }

  for (const line of input.cart.lines) {
    try {
      /** @type {any} */
      const l = line;

      const productTitle =
        l.merchandise?.__typename === 'ProductVariant'
          ? l.merchandise.product?.title
          : null;

      const packSize = parsePackSizeFromTitle(productTitle);
      if (!packSize) continue;

      // Validate quantity matches pack size (optional but recommended)
      if (l.quantity !== packSize) continue;

      const compareAt =
        l.cost?.compareAtAmountPerQuantity?.amount ??
        l.cost?.amountPerQuantity?.amount;

      if (!compareAt) continue;

      const originalPrice = Number(compareAt);
      if (Number.isNaN(originalPrice)) continue;

      const discountedUnitPrice =
        originalPrice * (1 - UNIT_DISCOUNT_PERCENT / 100);

      ops.push({
        lineUpdate: {
          cartLineId: l.id,
          price: {
            adjustment: {
              fixedPricePerUnit: {
                amount: discountedUnitPrice.toFixed(2),
              },
            },
          },
        },
      });
    } catch {
      continue;
    }
  }

  return ops.length ? { operations: ops } : NO_CHANGES;
}
