// Collection Page - Load and display products
// Popular products appear first, then all other products sorted by most recent

// Wait for DOM and Firebase to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for Firebase to initialize
  setTimeout(() => {
    loadCollectionProducts();
  }, 500);
});

/**
 * Loads and displays all products in the collection
 * Popular products first, then all others sorted by most recent
 */
async function loadCollectionProducts() {
  try {
    // Get Firestore database instance
    const db = window.db || (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
    
    if (!db) {
      console.error('Firestore is not available');
      showError('Database connection failed. Please refresh the page.');
      return;
    }

    // Show loading state
    showLoading(true);

    // Fetch ALL active products first (this ensures we get everything)
    let allActiveProducts = [];
    try {
      // Try with orderBy first
      const allProductsSnapshot = await db
        .collection('products')
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .get();
      
      allProductsSnapshot.forEach((doc) => {
        allActiveProducts.push({ id: doc.id, ...doc.data() });
      });
      
      console.log(`Fetched ${allActiveProducts.length} active products`);
    } catch (error) {
      if (error.code === 'failed-precondition') {
        // Try without orderBy if index doesn't exist
        console.warn('Firestore index not found, fetching without orderBy');
        const allProductsSnapshot = await db
          .collection('products')
          .where('status', '==', 'active')
          .get();
        
        allProductsSnapshot.forEach((doc) => {
          allActiveProducts.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by createdAt manually if available
        allActiveProducts.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
          const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
          return bTime - aTime; // Most recent first
        });
        
        console.log(`Fetched ${allActiveProducts.length} active products (without orderBy)`);
      } else {
        // If status filter fails, try fetching all products and filter in memory
        console.warn('Status filter failed, fetching all products');
        try {
          const allProductsSnapshot = await db
            .collection('products')
            .get();
          
          allProductsSnapshot.forEach((doc) => {
            const product = { id: doc.id, ...doc.data() };
            // Filter for active products in memory (include products without status field)
            if (product.status === 'active' || !product.status) {
              allActiveProducts.push(product);
            }
          });
          
          // Sort by createdAt manually if available
          allActiveProducts.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
            const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
            return bTime - aTime; // Most recent first
          });
          
          console.log(`Fetched ${allActiveProducts.length} products (all products, filtered in memory)`);
        } catch (fetchError) {
          console.error('Error fetching all products:', fetchError);
          throw fetchError;
        }
      }
    }

    // Separate products into popular and non-popular
    const popularProducts = [];
    const regularProducts = [];

    allActiveProducts.forEach((product) => {
      // Check if product is popular (handle both boolean true and string "true")
      if (product.popular === true || product.popular === 'true') {
        popularProducts.push(product);
      } else {
        regularProducts.push(product);
      }
    });

    console.log(`Found ${popularProducts.length} popular products and ${regularProducts.length} regular products`);

    // Hide loading state
    showLoading(false);

    // Display popular products if we have any
    if (popularProducts.length > 0) {
      displayProducts('popularProductsGrid', popularProducts, true);
      document.getElementById('popularProductsSection').style.display = 'block';
    } else {
      document.getElementById('popularProductsSection').style.display = 'none';
    }

    // Display all other products
    if (regularProducts.length > 0) {
      displayProducts('allProductsGrid', regularProducts, false);
      document.getElementById('allProductsSection').style.display = 'block';
    } else {
      document.getElementById('allProductsSection').style.display = 'none';
    }

    // Show empty state if no products
    if (popularProducts.length === 0 && regularProducts.length === 0) {
      document.getElementById('collectionEmpty').style.display = 'block';
    } else {
      document.getElementById('collectionEmpty').style.display = 'none';
    }

    console.log('Collection products loaded successfully');
    console.log(`Total products displayed: ${popularProducts.length + regularProducts.length}`);
  } catch (error) {
    console.error('Error loading collection products:', error);
    showLoading(false);
    showError('Failed to load products. Please try again later.');
  }
}

/**
 * Displays products in a grid
 * @param {string} containerId - ID of the container element
 * @param {Array} products - Array of product objects
 * @param {boolean} isPopular - Whether these are popular products
 */
function displayProducts(containerId, products, isPopular) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  // Clear existing content
  container.innerHTML = '';

  // Create product cards
  products.forEach((product) => {
    const productCard = createCollectionProductCard(product, isPopular);
    container.appendChild(productCard);
  });
}

/**
 * Creates a product card element for the collection page
 * @param {Object} product - Product data from Firestore
 * @param {boolean} isPopular - Whether this is a popular product
 * @returns {HTMLElement} Product card element
 */
function createCollectionProductCard(product, isPopular) {
  const productName = product.title || product.name || 'Untitled Product';
  
  // Create product card container
  const productCard = document.createElement('div');
  productCard.className = 'product-card';
  productCard.setAttribute('data-product-id', product.id);

  // Add popular badge if applicable
  if (isPopular) {
    const badge = document.createElement('div');
    badge.className = 'product-badge-popular';
    badge.textContent = 'Popular';
    productCard.appendChild(badge);
  }

  // Create product image
  const productImage = document.createElement('img');
  productImage.src = product.imageUrl || 'https://via.placeholder.com/400?text=No+Image';
  productImage.alt = productName;
  productImage.onerror = function() {
    this.src = 'https://via.placeholder.com/400?text=Image+Not+Found';
  };

  // Create product info container
  const productInfo = document.createElement('div');
  productInfo.className = 'product-info';

  // Create product title
  const productTitle = document.createElement('div');
  productTitle.className = 'product-title';
  productTitle.textContent = productName;

  // Create product description
  const productDescription = document.createElement('div');
  productDescription.className = 'product-description';
  const description = product.description || product.desc || '';
  productDescription.textContent = description;

  // Create product bottom container
  const productBottom = document.createElement('div');
  productBottom.className = 'product-bottom';

  // Create product price
  const productPrice = document.createElement('span');
  productPrice.className = 'product-price';
  productPrice.textContent = `$${product.price || '0.00'}`;

  // Create add to cart button
  const addCartButton = document.createElement('button');
  addCartButton.className = 'add-cart';
  addCartButton.innerHTML = '<i class="fas fa-shopping-cart"></i>';
  addCartButton.setAttribute('data-product-id', product.id);
  addCartButton.setAttribute('aria-label', `Add ${productName} to cart`);
  
  // Add click event listener for add to cart
  addCartButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent card click
    // Use global cart function from cart.js
    if (window.addToCart) {
      window.addToCart(product);
    } else {
      console.error('Cart system not loaded');
    }
  });

  // Add click event to card (for future product detail page)
  productCard.addEventListener('click', () => {
    // Navigate to product detail page
    // window.location.href = `./product-detail.html?id=${product.id}`;
    console.log('Product clicked:', product.id);
  });

  // Assemble the product card
  productBottom.appendChild(productPrice);
  productBottom.appendChild(addCartButton);
  productInfo.appendChild(productTitle);
  if (description) {
    productInfo.appendChild(productDescription);
  }
  productInfo.appendChild(productBottom);
  productCard.appendChild(productImage);
  productCard.appendChild(productInfo);

  return productCard;
}

// Note: addToCart function is provided by cart.js via window.addToCart
// No local wrapper needed to avoid recursion issues

/**
 * Shows or hides the loading state
 * @param {boolean} show - Whether to show loading
 */
function showLoading(show) {
  const loadingElement = document.getElementById('collectionLoading');
  if (loadingElement) {
    loadingElement.style.display = show ? 'block' : 'none';
  }
}

/**
 * Shows an error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  const emptyElement = document.getElementById('collectionEmpty');
  if (emptyElement) {
    emptyElement.innerHTML = `
      <i class="fas fa-exclamation-triangle"></i>
      <h3>Error</h3>
      <p>${message}</p>
    `;
    emptyElement.style.display = 'block';
  }
}

