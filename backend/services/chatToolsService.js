/**
 * Server-side tools for chat (ground truth). No client input trusted for IDs beyond auth.
 */

const productsService = require('./productsService');
const ordersService = require('./ordersService');
const { formatOrderContext } = require('../config/businessContext');

const MAX_PRODUCTS_IN_CONTEXT = 8;

/**
 * Search active products by simple keyword match (name, category).
 */
async function searchProductsTool(query) {
  const q = String(query || '')
    .trim()
    .toLowerCase()
    .slice(0, 200);
  if (!q) {
    return { summary: 'No search query.', products: [] };
  }

  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  const all = await productsService.getProducts({ status: 'active' }, 200);

  const scored = all
    .map((p) => {
      const hay = `${p.name || ''} ${p.category || ''} ${p.description || ''}`.toLowerCase();
      let s = 0;
      for (const t of tokens) {
        if (hay.includes(t)) s += 2;
      }
      if (hay.includes(q)) s += 5;
      return { p, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_PRODUCTS_IN_CONTEXT);

  const products = scored.map(({ p }) => ({
    id: p.id,
    name: p.name,
    category: p.category || '',
    status: p.status,
    inStock: p.stock != null ? p.stock > 0 : undefined,
  }));

  const summary =
    products.length === 0
      ? 'No matching products found in catalog.'
      : `Found ${products.length} product(s) (keyword match). Names and categories only — direct customers to the website for exact prices.`;

  return { summary, products };
}

/**
 * Order digest for authenticated user only.
 */
async function orderDigestTool(userId) {
  if (!userId) {
    return { summary: 'User is not logged in. Suggest logging in to see orders.', orders: [] };
  }
  try {
    const { orders } = await ordersService.getOrdersByUser(userId, 5);
    const list = orders || [];
    const text = formatOrderContext(list);
    return {
      summary: text,
      orderCount: list.length,
    };
  } catch (e) {
    return { summary: 'Could not load orders. Suggest checking the user dashboard.', orders: [] };
  }
}

function shouldRunProductSearch(userMessage) {
  const m = String(userMessage || '').toLowerCase();
  const hints =
    /buy|shop|product|perfume|fragrance|scent|cologne|clothes|shirt|dress|size|recommend|looking for|have you|do you sell|collection|price|cost|naira|₦/.test(
      m
    );
  return hints;
}

module.exports = {
  searchProductsTool,
  orderDigestTool,
  shouldRunProductSearch,
};
