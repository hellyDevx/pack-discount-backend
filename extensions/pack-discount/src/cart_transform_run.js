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
  console.log('[CartTransform] START');

  if (!input?.cart?.lines) {
    console.log('[CartTransform] No cart lines');
    return NO_CHANGES;
  }

  console.log('[CartTransform] Total lines:', input.cart.lines.length);

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

      console.log('-----------------------------');
      console.log('[Line] ID:', l.id);
      console.log('[Line] Quantity:', l.quantity);

      const productTitle =
        l.merchandise?.__typename === 'ProductVariant'
          ? l.merchandise.product?.title
          : null;

      console.log('[Line] Product title:', productTitle);

      const packSize = parsePackSizeFromTitle(productTitle);
      console.log('[Line] Parsed pack size:', packSize);

      if (!packSize) {
        console.log('[SKIP] Not a pack product');
        continue;
      }

      if (l.quantity !== packSize) {
        console.log(
          '[SKIP] Quantity does not match pack size',
          'Qty:',
          l.quantity,
          'Pack:',
          packSize
        );
        continue;
      }

      const compareAt = l.cost?.compareAtAmountPerQuantity?.amount;
      const current = l.cost?.amountPerQuantity?.amount;

      console.log('[Line] Compare-at price:', compareAt);
      console.log('[Line] Current price:', current);

      const basePrice = compareAt ?? current;
      if (!basePrice) {
        console.log('[SKIP] No base price available');
        continue;
      }

      const originalPrice = Number(basePrice);
      if (Number.isNaN(originalPrice)) {
        console.log('[SKIP] Price is NaN:', basePrice);
        continue;
      }

      const discountedUnitPrice =
        originalPrice * (1 - UNIT_DISCOUNT_PERCENT / 100);

      console.log(
        '[APPLY]',
        'Original:',
        originalPrice,
        'Discounted:',
        discountedUnitPrice.toFixed(2)
      );

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
    } catch (e) {
      console.log('[ERROR] Line failed:', e);
      continue;
    }
  }

  console.log('[CartTransform] Operations count:', ops.length);

  if (!ops.length) {
    console.log('[CartTransform] NO CHANGES');
    return NO_CHANGES;
  }

  console.log('[CartTransform] APPLYING CHANGES');
  return { operations: ops };
}
