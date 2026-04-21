/**
 * Products Service
 * Handles all Firestore operations for products using Firebase Admin SDK
 */

const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Get products with optional filters
 * @param {Object} filters - Filter options
 * @param {boolean} filters.popular - Filter by popular flag
 * @param {string} filters.status - Filter by status (e.g., 'active')
 * @param {string} filters.category - Filter by category (e.g., 'perfume', 'clothes')
 * @param {number} limit - Maximum number of products to return
 * @param {number} offset - Number of products to skip
 * @returns {Promise<Array>} Array of products
 */
async function getProducts(filters = {}, limit = null, offset = 0) {
  try {
    // Simple query - avoid complex filters that require composite indexes
    let query = db.collection('products');
    
    // Only apply status filter at Firestore level (single field query is safe)
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    const snapshot = await query.get();
    let products = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      products.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      });
    });

    // Filter in memory to avoid composite index requirement
    if (filters.popular !== undefined) {
      products = products.filter(p => p.popular === filters.popular);
    }
    if (filters.category) {
      products = products.filter(p => p.category === filters.category);
    }

    // Sort in memory (default: createdAt desc)
    const orderBy = filters.orderBy || 'createdAt';
    const orderDirection = filters.orderDirection || 'desc';
    products.sort((a, b) => {
      let aVal = a[orderBy];
      let bVal = b[orderBy];
      
      // Handle date strings
      if (orderBy === 'createdAt' || orderBy === 'updatedAt') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      
      if (orderDirection === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      } else {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      }
    });

    // Apply offset
    if (offset > 0) {
      products = products.slice(offset);
    }

    // Apply limit
    if (limit) {
      products = products.slice(0, limit);
    }

    return products;
  } catch (error) {
    console.error('Error getting products:', error.message);
    console.error('Full error:', error);
    throw new Error(`Failed to fetch products: ${error.message}`);
  }
}

/**
 * Get popular products
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Array>} Array of popular products
 */
async function getPopularProducts(limit = 10) {
  return getProducts({ popular: true, status: 'active' }, limit);
}

/**
 * Get products by category
 * @param {string} category - Product category
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Array>} Array of products in category
 */
async function getProductsByCategory(category, limit = null) {
  return getProducts({ category, status: 'active' }, limit);
}

/**
 * Get all active products
 * @param {number} limit - Maximum number of products to return
 * @param {number} offset - Number of products to skip
 * @returns {Promise<Array>} Array of active products
 */
async function getAllActiveProducts(limit = null, offset = 0) {
  return getProducts({ status: 'active' }, limit, offset);
}

/**
 * Get product by ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Product object
 */
async function getProductById(productId) {
  try {
    const doc = await db.collection('products').doc(productId).get();

    if (!doc.exists) {
      throw new Error('Product not found');
    }

    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Convert Firestore timestamps to ISO strings
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
    };
  } catch (error) {
    if (error.message === 'Product not found') {
      throw error;
    }
    console.error('Error getting product by ID:', error);
    throw new Error('Failed to fetch product');
  }
}

/**
 * Get all products (no filters)
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Array>} Array of all products
 */
async function getAllProducts(limit = null) {
  try {
    // Simple query without ordering to avoid index issues
    const snapshot = await db.collection('products').get();
    let products = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      products.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamps to ISO strings
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      });
    });

    // Sort in memory by createdAt desc
    products.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    // Apply limit
    if (limit) {
      products = products.slice(0, limit);
    }

    return products;
  } catch (error) {
    console.error('Error getting all products:', error);
    throw new Error('Failed to fetch products');
  }
}

module.exports = {
  getProducts,
  getProductById,
  getPopularProducts,
  getProductsByCategory,
  getAllActiveProducts,
  getAllProducts,
};
