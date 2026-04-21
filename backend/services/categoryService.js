/**
 * Category Service - Dynamic Product Category Fetching
 * 
 * Fetches unique product categories from the database
 * to enable dynamic system prompts for the AI chatbot.
 */

const admin = require('firebase-admin');

/**
 * Get Firestore database instance
 */
function getDb() {
  return admin.firestore();
}

// Cache for categories (refreshes every 5 minutes)
let categoryCache = {
  categories: [],
  summary: {},
  lastFetch: 0,
  TTL: 5 * 60 * 1000 // 5 minutes
};

/**
 * Check if cache is still valid
 */
function isCacheValid() {
  return Date.now() - categoryCache.lastFetch < categoryCache.TTL;
}

/**
 * Get unique product categories from database
 * @returns {Promise<string[]>} Array of category names
 */
async function getProductCategories() {
  if (isCacheValid() && categoryCache.categories.length > 0) {
    return categoryCache.categories;
  }

  try {
    const db = getDb();
    const productsRef = db.collection('products');
    
    const snapshot = await productsRef
      .where('status', '==', 'active')
      .get();
    
    const categoriesSet = new Set();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.category) {
        categoriesSet.add(data.category);
      }
    });
    
    const categories = Array.from(categoriesSet).sort();
    
    // Update cache
    categoryCache.categories = categories;
    categoryCache.lastFetch = Date.now();
    
    return categories;
  } catch (error) {
    console.error('Error fetching product categories:', error);
    return categoryCache.categories.length > 0 ? categoryCache.categories : ['Products'];
  }
}

/**
 * Get category summary with product counts
 * @returns {Promise<Object>} Object with category names as keys and counts as values
 */
async function getCategorySummary() {
  if (isCacheValid() && Object.keys(categoryCache.summary).length > 0) {
    return categoryCache.summary;
  }

  try {
    const db = getDb();
    const productsRef = db.collection('products');
    
    const snapshot = await productsRef
      .where('status', '==', 'active')
      .get();
    
    const summary = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const category = data.category || 'Uncategorized';
      
      if (!summary[category]) {
        summary[category] = {
          count: 0,
          inStock: 0,
          lowStock: 0,
          outOfStock: 0
        };
      }
      
      summary[category].count++;
      
      const stock = parseInt(data.stock) || 0;
      if (stock <= 0) {
        summary[category].outOfStock++;
      } else if (stock <= 5) {
        summary[category].lowStock++;
      } else {
        summary[category].inStock++;
      }
    });
    
    // Update cache
    categoryCache.summary = summary;
    categoryCache.lastFetch = Date.now();
    
    return summary;
  } catch (error) {
    console.error('Error fetching category summary:', error);
    return categoryCache.summary;
  }
}

/**
 * Get a formatted string of categories for the AI prompt
 * @returns {Promise<string>} Formatted category string
 */
async function formatCategoriesForPrompt() {
  try {
    const summary = await getCategorySummary();
    const categories = Object.keys(summary);
    
    if (categories.length === 0) {
      return 'We sell a variety of products.';
    }
    
    const totalProducts = Object.values(summary).reduce((sum, cat) => sum + cat.count, 0);
    
    const categoryList = categories.map(cat => {
      const info = summary[cat];
      return `${cat} (${info.count} items)`;
    }).join(', ');
    
    return `We currently have ${totalProducts} products across these categories: ${categoryList}.`;
  } catch (error) {
    console.error('Error formatting categories:', error);
    return 'We sell a variety of products including perfumes and clothing.';
  }
}

/**
 * Get trending/popular categories based on stock movement
 * @returns {Promise<string[]>} Array of trending category names
 */
async function getTrendingCategories() {
  try {
    const summary = await getCategorySummary();
    
    // Categories with low stock might be trending (selling fast)
    const trending = Object.entries(summary)
      .filter(([_, info]) => info.lowStock > 0)
      .map(([category]) => category);
    
    return trending.slice(0, 3);
  } catch (error) {
    console.error('Error getting trending categories:', error);
    return [];
  }
}

/**
 * Clear the category cache (useful when products are updated)
 */
function clearCache() {
  categoryCache = {
    categories: [],
    summary: {},
    lastFetch: 0,
    TTL: 5 * 60 * 1000
  };
}

module.exports = {
  getProductCategories,
  getCategorySummary,
  formatCategoriesForPrompt,
  getTrendingCategories,
  clearCache
};
