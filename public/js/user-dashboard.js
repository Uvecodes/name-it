// User Dashboard - Load and display products
// Order: 3 latest products (with "new" tag) first, then popular products, then all others

// Pagination state
let allProductsForPagination = [];
let currentPage = 1;
const productsPerPage = 12;

// Wait for DOM and Firebase to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for Firebase to initialize
  setTimeout(() => {
    loadDashboardProducts();
  }, 500);
});

/**
 * Loads and displays all products in the dashboard
 * Order: 3 latest products (with "new" tag) → Popular products → All other products
 */
async function loadDashboardProducts() {
  try {
    // Get Firestore database instance
    const db = window.db || (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
    
    if (!db) {
      console.error('Firestore is not available');
      return;
    }

    // Fetch ALL products first (then filter in memory to ensure we get everything)
    let allProducts = [];
    let allActiveProducts = [];
    
    try {
      // Fetch all products first to ensure we don't miss any
      const allProductsSnapshot = await db
        .collection('products')
        .get();
      
      allProductsSnapshot.forEach((doc) => {
        const product = { id: doc.id, ...doc.data() };
        allProducts.push(product);
        // Include products with status 'active' or no status field (treat as active)
        // Also include products with null status
        if (product.status === 'active' || !product.status || product.status === undefined || product.status === null) {
          allActiveProducts.push(product);
        } else {
          console.log(`Product filtered out due to status: ${product.id} - status: "${product.status}"`);
        }
      });
      
      console.log(`Total products in database: ${allProducts.length}`);
      console.log(`Active products (or no status): ${allActiveProducts.length}`);
      
      // Sort by createdAt manually if available
      allActiveProducts.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
        return bTime - aTime; // Most recent first
      });
      
      // Log products that were filtered out
      const filteredOut = allProducts.filter(p => p.status && p.status !== 'active');
      if (filteredOut.length > 0) {
        console.log(`Products filtered out (not active): ${filteredOut.length}`, filteredOut.map(p => ({ id: p.id, status: p.status })));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }

    // Separate products into: latest 3, popular, and others
    const latestProducts = allActiveProducts.slice(0, 3); // First 3 are the latest
    const remainingProducts = allActiveProducts.slice(3); // Rest of the products
    
    console.log(`Latest 3 products: ${latestProducts.length}`);
    console.log(`Remaining products: ${remainingProducts.length}`);
    
    const popularProducts = [];
    const regularProducts = [];

    remainingProducts.forEach((product) => {
      // Check if product is popular (handle both boolean true and string "true")
      if (product.popular === true || product.popular === 'true') {
        popularProducts.push(product);
      } else {
        regularProducts.push(product);
      }
    });

    console.log(`Popular products (from remaining): ${popularProducts.length}`);
    console.log(`Regular products: ${regularProducts.length}`);

    // Get IDs for badge checking
    const latestProductIds = latestProducts.map(p => p.id);
    // Include popular products from both latest and remaining products
    const allPopularProductIds = [
      ...latestProducts.filter(p => p.popular === true || p.popular === 'true').map(p => p.id),
      ...popularProducts.map(p => p.id)
    ];

    // Combine in the correct order: latest → popular → regular
    const orderedProducts = [...latestProducts, ...popularProducts, ...regularProducts];
    
    // Verify we have all products
    console.log('Latest products IDs:', latestProductIds);
    console.log('Popular products IDs:', popularProducts.map(p => p.id));
    console.log('Regular products IDs:', regularProducts.map(p => p.id));
    console.log('All active product IDs:', allActiveProducts.map(p => p.id));
    console.log('Ordered products IDs:', orderedProducts.map(p => p.id));

    console.log(`Found ${latestProducts.length} latest products, ${popularProducts.length} popular products, and ${regularProducts.length} regular products`);
    console.log(`Total products to display: ${orderedProducts.length}`);
    console.log(`Expected: ${allActiveProducts.length} active products`);
    
    // Debug: Check if we're missing any products
    if (orderedProducts.length !== allActiveProducts.length) {
      console.warn(`Mismatch detected! Expected ${allActiveProducts.length} products but only ${orderedProducts.length} will be displayed.`);
      const orderedIds = orderedProducts.map(p => p.id);
      const missing = allActiveProducts.filter(p => !orderedIds.includes(p.id));
      if (missing.length > 0) {
        console.warn('Missing products:', missing.map(p => ({ id: p.id, title: p.title || p.name })));
      }
    }

    // Store all products for pagination
    allProductsForPagination = orderedProducts;
    currentPage = 1;

    // Initialize pagination
    initializePagination(orderedProducts.length);
    
    // Display products for current page
    displayDashboardProducts(orderedProducts, latestProductIds, allPopularProductIds);

    // Update product count
    const productCountElement = document.getElementById('productCount');
    if (productCountElement) {
      productCountElement.textContent = orderedProducts.length;
    }

    console.log('Dashboard products loaded successfully');
  } catch (error) {
    console.error('Error loading dashboard products:', error);
  }
}

/**
 * Displays products in the dashboard grid (with pagination)
 * @param {Array} products - Array of all products in order
 * @param {Array} latestProductIds - Array of IDs of the 3 latest products (for "new" badge)
 * @param {Array} popularProductIds - Array of IDs of popular products (for "popular" badge)
 */
function displayDashboardProducts(products, latestProductIds, popularProductIds) {
  const container = document.getElementById('productsGrid');
  if (!container) {
    console.error('Products grid container not found');
    return;
  }

  // Calculate pagination
  const totalPages = Math.ceil(products.length / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const productsToDisplay = products.slice(startIndex, endIndex);

  // Clear existing content (remove sample cards)
  container.innerHTML = '';

  console.log(`Displaying page ${currentPage} of ${totalPages} (products ${startIndex + 1}-${Math.min(endIndex, products.length)} of ${products.length})`);

  // Create product cards for current page
  let cardsCreated = 0;
  productsToDisplay.forEach((product, index) => {
    try {
      // Check if this product is in the latest 3
      const isNew = latestProductIds.includes(product.id);
      // Check if this product is popular
      const isPopular = popularProductIds.includes(product.id);
      const productCard = createDashboardProductCard(product, isNew, isPopular);
      if (productCard) {
        container.appendChild(productCard);
        cardsCreated++;
      } else {
        console.error(`Failed to create card for product ${index}:`, product.id, product.title || product.name);
      }
    } catch (error) {
      console.error(`Error creating card for product ${index}:`, product.id, error);
    }
  });

  console.log(`Successfully created ${cardsCreated} product cards for current page`);
  
  // Update pagination UI
  updatePaginationUI(totalPages);
}

/**
 * Creates a product card element for the dashboard
 * @param {Object} product - Product data from Firestore
 * @param {boolean} isNew - Whether this is one of the 3 latest products
 * @param {boolean} isPopular - Whether this is a popular product
 * @returns {HTMLElement} Product card element
 */
function createDashboardProductCard(product, isNew, isPopular) {
  const productName = product.title || product.name || 'Untitled Product';
  const description = product.description || product.desc || '';
  
  // Create product card container
  const productCard = document.createElement('div');
  productCard.className = 'product-card';
  productCard.setAttribute('data-product-id', product.id);

  // Create product image container
  const productImageContainer = document.createElement('div');
  productImageContainer.className = 'product-image';

  // Create product image
  const productImage = document.createElement('img');
  productImage.src = product.imageUrl || 'https://via.placeholder.com/400?text=No+Image';
  productImage.alt = productName;
  productImage.onerror = function() {
    this.src = 'https://via.placeholder.com/400?text=Image+Not+Found';
  };

  // Add "New" badge if this is one of the 3 latest products (top left)
  // Priority: New badge takes precedence over Popular badge
  if (isNew) {
    const newBadge = document.createElement('div');
    newBadge.className = 'product-badge';
    newBadge.textContent = 'New';
    productImageContainer.appendChild(newBadge);
  } else if (isPopular) {
    // Only show "Popular" badge if product is not new
    const popularBadge = document.createElement('div');
    popularBadge.className = 'product-badge';
    popularBadge.textContent = 'Popular';
    productImageContainer.appendChild(popularBadge);
  }

  productImageContainer.appendChild(productImage);

  // Create product info container
  const productInfo = document.createElement('div');
  productInfo.className = 'product-info';

  // Create product title
  const productTitle = document.createElement('h3');
  productTitle.className = 'product-title';
  productTitle.textContent = productName;

  // Create product description
  if (description) {
    const productDescription = document.createElement('p');
    productDescription.className = 'product-description';
    productDescription.textContent = description;
    productInfo.appendChild(productDescription);
  }

  // Create product price
  const productPrice = document.createElement('p');
  productPrice.className = 'product-price';
  productPrice.textContent = `$${product.price || '0.00'}`;

  // Create add to cart button
  const addToCartButton = document.createElement('button');
  addToCartButton.className = 'add-to-cart-btn';
  addToCartButton.innerHTML = '<i class="fas fa-shopping-cart"></i> Add to Cart';
  addToCartButton.setAttribute('data-product-id', product.id);
  addToCartButton.setAttribute('aria-label', `Add ${productName} to cart`);
  
  // Add click event listener for add to cart
  addToCartButton.addEventListener('click', (e) => {
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
  productInfo.appendChild(productTitle);
  productInfo.appendChild(productPrice);
  productInfo.appendChild(addToCartButton);
  productCard.appendChild(productImageContainer);
  productCard.appendChild(productInfo);

  return productCard;
}

// Note: addToCart function is provided by cart.js via window.addToCart
// No local wrapper needed to avoid recursion issues

/**
 * Initializes pagination controls
 * @param {number} totalProducts - Total number of products
 */
function initializePagination(totalProducts) {
  const totalPages = Math.ceil(totalProducts / productsPerPage);
  
  // Get pagination elements
  const prevBtn = document.querySelector('.pagination .page-btn:first-child');
  const nextBtn = document.querySelector('.pagination .page-btn:last-child');
  const pageNumbersContainer = document.querySelector('.pagination .page-numbers');
  
  if (!prevBtn || !nextBtn || !pageNumbersContainer) {
    console.error('Pagination elements not found');
    return;
  }

  // Update page numbers
  updatePageNumbers(pageNumbersContainer, totalPages);

  // Remove existing event listeners by cloning and replacing
  const newPrevBtn = prevBtn.cloneNode(true);
  const newNextBtn = nextBtn.cloneNode(true);
  prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
  nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);

  // Add event listeners
  newPrevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      goToPage(currentPage);
    }
  });

  newNextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      goToPage(currentPage);
    }
  });

  // Initial pagination update
  updatePaginationUI(totalPages);
}

/**
 * Updates page number indicators
 * @param {HTMLElement} container - Container for page numbers
 * @param {number} totalPages - Total number of pages
 */
function updatePageNumbers(container, totalPages) {
  container.innerHTML = '';
  
  if (totalPages === 0) {
    return;
  }
  
  // Show max 5 page numbers at a time
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  
  // Adjust if we're near the end
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageNumber = document.createElement('span');
    pageNumber.className = 'page-number';
    if (i === currentPage) {
      pageNumber.classList.add('active');
    }
    pageNumber.textContent = i;
    pageNumber.addEventListener('click', () => {
      goToPage(i);
    });
    container.appendChild(pageNumber);
  }
}

/**
 * Updates pagination UI state
 * @param {number} totalPages - Total number of pages
 */
function updatePaginationUI(totalPages) {
  const prevBtn = document.querySelector('.pagination .page-btn:first-child');
  const nextBtn = document.querySelector('.pagination .page-btn:last-child');
  const pageNumbersContainer = document.querySelector('.pagination .page-numbers');

  if (!prevBtn || !nextBtn || !pageNumbersContainer) {
    return;
  }

  // Update button states
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = currentPage >= totalPages || totalPages === 0;

  // Update page numbers
  updatePageNumbers(pageNumbersContainer, totalPages);
}

/**
 * Navigates to a specific page
 * @param {number} page - Page number to navigate to
 */
function goToPage(page) {
  const totalPages = Math.ceil(allProductsForPagination.length / productsPerPage);
  
  if (page < 1 || page > totalPages) {
    return;
  }

  currentPage = page;

  // Get IDs for badge checking (need to recalculate from all products)
  const latestProductIds = allProductsForPagination.slice(0, 3).map(p => p.id);
  const allPopularProductIds = [
    ...allProductsForPagination.slice(0, 3).filter(p => p.popular === true || p.popular === 'true').map(p => p.id),
    ...allProductsForPagination.slice(3).filter(p => p.popular === true || p.popular === 'true').map(p => p.id)
  ];

  // Display products for the selected page
  displayDashboardProducts(allProductsForPagination, latestProductIds, allPopularProductIds);

  // Scroll to top of products section
  const productsSection = document.querySelector('.products-section');
  if (productsSection) {
    productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

