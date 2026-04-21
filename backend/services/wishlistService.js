/**
 * Wishlist Service
 * Handles wishlist CRUD operations with Firestore
 */

const admin = require('firebase-admin');

function getDb() {
  return admin.firestore();
}

/**
 * Get user's wishlist
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Wishlist items with product details
 */
async function getWishlist(userId) {
  try {
    const db = getDb();
    const wishlistRef = db.collection('wishlists').doc(userId);
    const doc = await wishlistRef.get();

    if (!doc.exists) {
      return [];
    }

    const wishlistData = doc.data();
    const productIds = wishlistData.products || [];

    if (productIds.length === 0) {
      return [];
    }

    // Fetch product details for each wishlist item
    const productsRef = db.collection('products');
    const productPromises = productIds.map(async (item) => {
      try {
        const productDoc = await productsRef.doc(item.productId).get();
        if (productDoc.exists) {
          return {
            ...item,
            product: {
              id: productDoc.id,
              ...productDoc.data(),
            },
          };
        }
        return null;
      } catch (error) {
        console.error(`Error fetching product ${item.productId}:`, error);
        return null;
      }
    });

    const products = await Promise.all(productPromises);
    return products.filter((p) => p !== null);
  } catch (error) {
    console.error('Error getting wishlist:', error);
    throw new Error('Failed to fetch wishlist');
  }
}

/**
 * Add product to wishlist
 * @param {string} userId - User ID
 * @param {string} productId - Product ID to add
 * @returns {Promise<Object>} Result
 */
async function addToWishlist(userId, productId) {
  try {
    const db = getDb();
    const wishlistRef = db.collection('wishlists').doc(userId);
    const doc = await wishlistRef.get();

    // Use regular Date for array items (serverTimestamp not allowed in arrayUnion)
    const newItem = {
      productId,
      addedAt: new Date().toISOString(),
    };

    if (!doc.exists) {
      // Create new wishlist
      await wishlistRef.set({
        userId,
        products: [newItem],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const data = doc.data();
      const products = data.products || [];

      // Check if product already in wishlist
      const exists = products.some((p) => p.productId === productId);
      if (exists) {
        return { success: true, message: 'Product already in wishlist' };
      }

      // Add product to wishlist - use spread to add new item
      products.push(newItem);
      await wishlistRef.update({
        products: products,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return { success: true, message: 'Product added to wishlist' };
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    throw new Error('Failed to add product to wishlist');
  }
}

/**
 * Remove product from wishlist
 * @param {string} userId - User ID
 * @param {string} productId - Product ID to remove
 * @returns {Promise<Object>} Result
 */
async function removeFromWishlist(userId, productId) {
  try {
    const db = getDb();
    const wishlistRef = db.collection('wishlists').doc(userId);
    const doc = await wishlistRef.get();

    if (!doc.exists) {
      return { success: true, message: 'Wishlist not found' };
    }

    const data = doc.data();
    const products = data.products || [];

    // Filter out the product
    const updatedProducts = products.filter((p) => p.productId !== productId);

    await wishlistRef.update({
      products: updatedProducts,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, message: 'Product removed from wishlist' };
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    throw new Error('Failed to remove product from wishlist');
  }
}

/**
 * Get wishlist item count
 * @param {string} userId - User ID
 * @returns {Promise<number>} Count of items in wishlist
 */
async function getWishlistCount(userId) {
  try {
    const db = getDb();
    const wishlistRef = db.collection('wishlists').doc(userId);
    const doc = await wishlistRef.get();

    if (!doc.exists) {
      return 0;
    }

    const data = doc.data();
    return (data.products || []).length;
  } catch (error) {
    console.error('Error getting wishlist count:', error);
    throw new Error('Failed to get wishlist count');
  }
}

/**
 * Check if product is in wishlist
 * @param {string} userId - User ID
 * @param {string} productId - Product ID to check
 * @returns {Promise<boolean>} True if product is in wishlist
 */
async function isInWishlist(userId, productId) {
  try {
    const db = getDb();
    const wishlistRef = db.collection('wishlists').doc(userId);
    const doc = await wishlistRef.get();

    if (!doc.exists) {
      return false;
    }

    const data = doc.data();
    const products = data.products || [];
    return products.some((p) => p.productId === productId);
  } catch (error) {
    console.error('Error checking wishlist:', error);
    throw new Error('Failed to check wishlist');
  }
}

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getWishlistCount,
  isInWishlist,
};
