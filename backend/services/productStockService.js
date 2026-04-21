/**
 * Product Stock Service - Secure, Read-Only Access
 * 
 * SECURITY: This service ONLY exposes non-sensitive product information.
 * It is designed for the AI chatbot to answer stock-related questions
 * without exposing prices, costs, supplier info, or other sensitive data.
 */

const admin = require('firebase-admin');

/**
 * Get Firestore database instance
 */
function getDb() {
  return admin.firestore();
}

/**
 * SAFE FIELDS - Only these fields are exposed to the AI
 * All other fields are blocked for security
 */
const SAFE_FIELDS = ['name', 'title', 'stock', 'category', 'status', 'description'];

/**
 * BLOCKED FIELDS - These are explicitly never returned
 * Even if they exist in the document, they will be stripped
 */
const BLOCKED_FIELDS = [
  'price', 'cost', 'supplierPrice', 'supplier', 'supplierInfo',
  'margin', 'profit', 'adminNotes', 'internalNotes',
  'createdBy', 'updatedBy', 'userId', 'userEmail'
];

/**
 * Sanitize a product document to only include safe fields
 * @param {Object} product - Raw product document
 * @returns {Object} Sanitized product with only safe fields
 */
function sanitizeProduct(product) {
  if (!product) return null;
  
  const sanitized = {};
  
  for (const field of SAFE_FIELDS) {
    if (product[field] !== undefined) {
      // Limit description length to prevent context bloat
      if (field === 'description') {
        sanitized[field] = String(product[field]).substring(0, 100);
      } else {
        sanitized[field] = product[field];
      }
    }
  }
  
  return sanitized;
}

/**
 * Convert stock number to human-readable status
 * This hides exact stock numbers from the AI
 * @param {number} stockCount - Actual stock number
 * @returns {string} Status string
 */
function getStockStatus(stockCount) {
  const stock = parseInt(stockCount) || 0;
  
  if (stock <= 0) return 'out of stock';
  if (stock <= 5) return 'low stock';
  if (stock <= 20) return 'in stock';
  return 'in stock'; // Don't reveal exact high numbers
}

/**
 * Get all products with sanitized stock information
 * @param {number} limit - Maximum products to return (default 50)
 * @returns {Promise<Array>} Array of sanitized products with stock status
 */
async function getProductStockSummary(limit = 50) {
  try {
    const db = getDb();
    const productsRef = db.collection('products');
    
    const snapshot = await productsRef
      .where('status', '==', 'active')
      .limit(limit)
      .get();
    
    const products = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const sanitized = sanitizeProduct(data);
      
      if (sanitized) {
        products.push({
          id: doc.id,
          name: sanitized.title || sanitized.name || 'Unknown Product',
          category: sanitized.category || 'Uncategorized',
          stockStatus: getStockStatus(data.stock),
          description: sanitized.description || ''
        });
      }
    });
    
    return products;
  } catch (error) {
    console.error('Error fetching product stock:', error);
    return [];
  }
}

/**
 * Check stock for a specific product by name (fuzzy search)
 * @param {string} productName - Product name to search for
 * @returns {Promise<Object|null>} Product stock info or null
 */
async function checkProductStock(productName) {
  try {
    const db = getDb();
    const productsRef = db.collection('products');
    
    // Get all active products and search by name
    const snapshot = await productsRef
      .where('status', '==', 'active')
      .get();
    
    const searchTerm = productName.toLowerCase();
    
    let bestMatch = null;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const title = (data.title || data.name || '').toLowerCase();
      
      // Check if product name contains the search term
      if (title.includes(searchTerm) || searchTerm.includes(title)) {
        bestMatch = {
          id: doc.id,
          name: data.title || data.name,
          category: data.category || 'Uncategorized',
          stockStatus: getStockStatus(data.stock),
          description: String(data.description || '').substring(0, 100)
        };
      }
    });
    
    return bestMatch;
  } catch (error) {
    console.error('Error checking product stock:', error);
    return null;
  }
}

/**
 * Get stock summary by category
 * @returns {Promise<Object>} Category-wise stock summary
 */
async function getStockByCategory() {
  try {
    const db = getDb();
    const productsRef = db.collection('products');
    
    const snapshot = await productsRef
      .where('status', '==', 'active')
      .get();
    
    const categories = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const category = data.category || 'Uncategorized';
      const stock = parseInt(data.stock) || 0;
      
      if (!categories[category]) {
        categories[category] = {
          total: 0,
          inStock: 0,
          lowStock: 0,
          outOfStock: 0
        };
      }
      
      categories[category].total++;
      
      if (stock <= 0) {
        categories[category].outOfStock++;
      } else if (stock <= 5) {
        categories[category].lowStock++;
      } else {
        categories[category].inStock++;
      }
    });
    
    return categories;
  } catch (error) {
    console.error('Error fetching stock by category:', error);
    return {};
  }
}

/**
 * Format stock summary for AI context
 * This creates a sanitized, human-readable summary
 * @returns {Promise<string>} Formatted stock summary
 */
async function formatStockForAI() {
  try {
    const products = await getProductStockSummary(30);
    
    if (products.length === 0) {
      return 'Product stock information is currently unavailable.';
    }
    
    const lines = products.map(p => 
      `- ${p.name} (${p.category}): ${p.stockStatus}`
    );
    
    // Group by stock status for summary
    const inStock = products.filter(p => p.stockStatus === 'in stock').length;
    const lowStock = products.filter(p => p.stockStatus === 'low stock').length;
    const outOfStock = products.filter(p => p.stockStatus === 'out of stock').length;
    
    return `## Current Product Stock Status
Summary: ${inStock} in stock, ${lowStock} low stock, ${outOfStock} out of stock

${lines.join('\n')}`;
    
  } catch (error) {
    console.error('Error formatting stock for AI:', error);
    return 'Product stock information is currently unavailable.';
  }
}

module.exports = {
  getProductStockSummary,
  checkProductStock,
  getStockByCategory,
  formatStockForAI,
  sanitizeProduct,
  getStockStatus
};
