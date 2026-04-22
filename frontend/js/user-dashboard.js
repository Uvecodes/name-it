// User Dashboard - Load and display products with filter, search, and sort functionality
// Order: 3 latest products (with "new" tag) first, then popular products, then all others

// ============================================
// STATE MANAGEMENT
// ============================================

// Pagination state
let allProductsForPagination = [];
let currentPage = 1;
const productsPerPage = 12;

// Filter state - stores original unfiltered products and current filter settings
let originalProducts = [];
let currentFilters = {
  categories: [],      // ['perfume', 'clothes']
  priceRanges: [],     // ['0-50', '50-100', '100+']
  sortBy: 'Newest First',
  searchQuery: ''
};

// Badge tracking
let originalLatestProductIds = [];
let originalPopularProductIds = [];

// ============================================
// INITIALIZATION
// ============================================

const FILTER_DRAWER_BREAKPOINT = 768;

/**
 * Mobile: filters open in a left drawer; desktop: sidebar stays in layout.
 */
function initFiltersDrawer() {
  const btn = document.getElementById('filtersMenuBtn');
  const panel = document.getElementById('dashboardFiltersPanel');
  const backdrop = document.getElementById('filtersBackdrop');
  const closeBtn = document.querySelector('.filters-drawer-close');
  if (!btn || !panel || !backdrop) return;

  const isDrawerMode = () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia(`(max-width: ${FILTER_DRAWER_BREAKPOINT}px)`).matches;

  const openDrawer = () => {
    panel.classList.add('is-open');
    backdrop.classList.add('is-open');
    btn.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    backdrop.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawer = () => {
    panel.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    btn.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  btn.addEventListener('click', () => {
    if (!isDrawerMode()) return;
    if (panel.classList.contains('is-open')) closeDrawer();
    else openDrawer();
  });

  backdrop.addEventListener('click', closeDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) closeDrawer();
  });

  window.addEventListener('resize', () => {
    if (!isDrawerMode()) closeDrawer();
  });
}

// Wait for DOM and API client to be ready
document.addEventListener('DOMContentLoaded', () => {
  initFiltersDrawer();
  // Wait a bit for API client to initialize
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
    if (!window.apiClient) {
      console.error('API client is not available');
      return;
    }

    // Fetch ALL active products from backend API
    let allActiveProducts = [];
    
    try {
      const response = await window.apiClient.getProducts({ status: 'active' });
      allActiveProducts = response.products || [];
      
      // Sort by createdAt (most recent first)
      allActiveProducts.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      
      console.log(`Fetched ${allActiveProducts.length} active products`);
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }

    // Store original products for filtering
    originalProducts = [...allActiveProducts];

    // Separate products into: latest 3, popular, and others
    const latestProducts = allActiveProducts.slice(0, 3);
    const remainingProducts = allActiveProducts.slice(3);
    
    const popularProducts = [];
    const regularProducts = [];

    remainingProducts.forEach((product) => {
      if (product.popular === true || product.popular === 'true') {
        popularProducts.push(product);
      } else {
        regularProducts.push(product);
      }
    });

    // Store IDs for badge checking (original order)
    originalLatestProductIds = latestProducts.map(p => p.id);
    originalPopularProductIds = [
      ...latestProducts.filter(p => p.popular === true || p.popular === 'true').map(p => p.id),
      ...popularProducts.map(p => p.id)
    ];

    // Combine in the correct order: latest → popular → regular
    const orderedProducts = [...latestProducts, ...popularProducts, ...regularProducts];

    // Store all products for pagination
    allProductsForPagination = orderedProducts;
    currentPage = 1;

    // Initialize filters AFTER products are loaded
    initializeFilters();

    // Initialize pagination
    initializePagination(orderedProducts.length);
    
    // Display products for current page
    displayDashboardProducts(orderedProducts, originalLatestProductIds, originalPopularProductIds);

    // Update product count
    updateProductCount(orderedProducts.length, originalProducts.length);

    console.log('Dashboard products loaded successfully');
  } catch (error) {
    console.error('Error loading dashboard products:', error);
  }
}

// ============================================
// FILTER INITIALIZATION
// ============================================

/**
 * Initializes all filter event listeners
 */
function initializeFilters() {
  // Search form submit
  const searchForm = document.querySelector('.search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', handleSearchSubmit);
  }

  // Search input for real-time search (debounced)
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentFilters.searchQuery = e.target.value.trim();
        applyFilters();
      }, 300);
    });
  }

  // Category checkboxes (first filter-section)
  const categorySection = document.querySelector('.filter-section:nth-of-type(1)');
  if (categorySection) {
    const categoryCheckboxes = categorySection.querySelectorAll('input[type="checkbox"]');
    categoryCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', handleCategoryChange);
    });
  }

  // Price range checkboxes (second filter-section)
  const priceSection = document.querySelector('.filter-section:nth-of-type(2)');
  if (priceSection) {
    const priceCheckboxes = priceSection.querySelectorAll('input[type="checkbox"]');
    priceCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', handlePriceRangeChange);
    });
  }

  // Sort dropdown
  const sortSelect = document.querySelector('.sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', handleSortChange);
  }

  console.log('Filter event listeners initialized');
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handles search form submission
 */
function handleSearchSubmit(event) {
  event.preventDefault();
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    currentFilters.searchQuery = searchInput.value.trim();
    applyFilters();
  }
}

/**
 * Handles category checkbox changes
 */
function handleCategoryChange() {
  const categorySection = document.querySelector('.filter-section:nth-of-type(1)');
  if (!categorySection) return;

  const checkedBoxes = categorySection.querySelectorAll('input[type="checkbox"]:checked');
  currentFilters.categories = Array.from(checkedBoxes).map(cb => cb.value);
  applyFilters();
}

/**
 * Handles price range checkbox changes
 */
function handlePriceRangeChange() {
  const priceSection = document.querySelector('.filter-section:nth-of-type(2)');
  if (!priceSection) return;

  const checkedBoxes = priceSection.querySelectorAll('input[type="checkbox"]:checked');
  currentFilters.priceRanges = Array.from(checkedBoxes).map(cb => cb.value);
  applyFilters();
}

/**
 * Handles sort dropdown changes
 */
function handleSortChange(event) {
  currentFilters.sortBy = event.target.value;
  applyFilters();
}

// ============================================
// FILTER LOGIC
// ============================================

/**
 * Applies all current filters and updates the display
 */
function applyFilters() {
  let filtered = [...originalProducts];

  // Apply category filter
  filtered = filterByCategory(filtered, currentFilters.categories);

  // Apply price range filter
  filtered = filterByPriceRange(filtered, currentFilters.priceRanges);

  // Apply search filter
  filtered = filterBySearch(filtered, currentFilters.searchQuery);

  // Apply sort
  filtered = sortProducts(filtered, currentFilters.sortBy);

  // Update pagination state
  allProductsForPagination = filtered;
  currentPage = 1;

  // Re-initialize pagination with new count
  initializePagination(filtered.length);

  // Display filtered products
  displayDashboardProducts(filtered, originalLatestProductIds, originalPopularProductIds);

  // Update product count display
  updateProductCount(filtered.length, originalProducts.length);

  console.log(`Filters applied: ${filtered.length} of ${originalProducts.length} products shown`);
}

/**
 * Filters products by category
 * @param {Array} products - Products to filter
 * @param {Array} categories - Selected categories
 * @returns {Array} Filtered products
 */
function filterByCategory(products, categories) {
  if (!categories || categories.length === 0) {
    return products;
  }
  return products.filter(product => {
    const productCategory = (product.category || '').toLowerCase();
    return categories.some(cat => cat.toLowerCase() === productCategory);
  });
}

/**
 * Filters products by price range
 * @param {Array} products - Products to filter
 * @param {Array} ranges - Selected price ranges ['0-50', '50-100', '100+']
 * @returns {Array} Filtered products
 */
function filterByPriceRange(products, ranges) {
  if (!ranges || ranges.length === 0) {
    return products;
  }
  
  return products.filter(product => {
    const price = parseFloat(product.price) || 0;
    
    // Check if price matches ANY of the selected ranges (OR logic)
    return ranges.some(range => {
      switch (range) {
        case '0-50':
          return price >= 0 && price <= 50;
        case '50-100':
          return price > 50 && price <= 100;
        case '100+':
          return price > 100;
        default:
          return true;
      }
    });
  });
}

/**
 * Filters products by search query
 * @param {Array} products - Products to filter
 * @param {string} query - Search query
 * @returns {Array} Filtered products
 */
function filterBySearch(products, query) {
  if (!query || query.trim() === '') {
    return products;
  }
  
  const searchLower = query.toLowerCase();
  
  return products.filter(product => {
    const title = (product.title || product.name || '').toLowerCase();
    const description = (product.description || product.desc || '').toLowerCase();
    const category = (product.category || '').toLowerCase();
    
    return title.includes(searchLower) || 
           description.includes(searchLower) || 
           category.includes(searchLower);
  });
}

/**
 * Sorts products by the specified criteria
 * @param {Array} products - Products to sort
 * @param {string} sortBy - Sort criteria
 * @returns {Array} Sorted products
 */
function sortProducts(products, sortBy) {
  const sorted = [...products];
  
  switch (sortBy) {
    case 'Newest First':
      sorted.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      break;
      
    case 'Price: Low to High':
      sorted.sort((a, b) => {
        const aPrice = parseFloat(a.price) || 0;
        const bPrice = parseFloat(b.price) || 0;
        return aPrice - bPrice;
      });
      break;
      
    case 'Price: High to Low':
      sorted.sort((a, b) => {
        const aPrice = parseFloat(a.price) || 0;
        const bPrice = parseFloat(b.price) || 0;
        return bPrice - aPrice;
      });
      break;
      
    case 'Most Popular':
      sorted.sort((a, b) => {
        const aPopular = a.popular === true || a.popular === 'true' ? 1 : 0;
        const bPopular = b.popular === true || b.popular === 'true' ? 1 : 0;
        if (bPopular !== aPopular) {
          return bPopular - aPopular;
        }
        // Secondary sort by date for same popularity
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      break;
      
    default:
      break;
  }
  
  return sorted;
}

/**
 * Clears all filters and resets to default state
 */
function clearAllFilters() {
  // Reset filter state
  currentFilters = {
    categories: [],
    priceRanges: [],
    sortBy: 'Newest First',
    searchQuery: ''
  };

  // Reset UI elements
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    searchInput.value = '';
  }

  // Uncheck all category checkboxes
  const categoryCheckboxes = document.querySelectorAll('.filter-section:nth-of-type(1) input[type="checkbox"]');
  categoryCheckboxes.forEach(cb => cb.checked = false);

  // Uncheck all price range checkboxes
  const priceCheckboxes = document.querySelectorAll('.filter-section:nth-of-type(2) input[type="checkbox"]');
  priceCheckboxes.forEach(cb => cb.checked = false);

  // Reset sort dropdown
  const sortSelect = document.querySelector('.sort-select');
  if (sortSelect) {
    sortSelect.value = 'Newest First';
  }

  // Re-apply (which will show all products)
  applyFilters();
}

// Expose clearAllFilters globally for potential use in HTML
window.clearAllFilters = clearAllFilters;

// ============================================
// DISPLAY FUNCTIONS
// ============================================

/**
 * Updates the product count display
 * @param {number} shown - Number of products currently shown
 * @param {number} total - Total number of products
 */
function updateProductCount(shown, total) {
  const productCountElement = document.getElementById('productCount');
  if (productCountElement) {
    if (shown === total) {
      productCountElement.textContent = total;
    } else {
      productCountElement.textContent = `${shown} of ${total}`;
    }
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

  // Clear existing content
  container.innerHTML = '';

  // Handle no results
  if (products.length === 0) {
    showNoResultsMessage(container);
    updatePaginationUI(0);
    return;
  }

  // Calculate pagination
  const totalPages = Math.ceil(products.length / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const productsToDisplay = products.slice(startIndex, endIndex);

  console.log(`Displaying page ${currentPage} of ${totalPages} (products ${startIndex + 1}-${Math.min(endIndex, products.length)} of ${products.length})`);

  // Create product cards for current page
  productsToDisplay.forEach((product) => {
    const isNew = latestProductIds.includes(product.id);
    const isPopular = popularProductIds.includes(product.id);
    const productCard = createDashboardProductCard(product, isNew, isPopular);
    if (productCard) {
      container.appendChild(productCard);
    }
  });
  
  // Update pagination UI
  updatePaginationUI(totalPages);
}

/**
 * Shows a "no results" message when filters return empty
 * @param {HTMLElement} container - The container to show the message in
 */
function showNoResultsMessage(container) {
  const noResultsDiv = document.createElement('div');
  noResultsDiv.className = 'no-results-message';
  noResultsDiv.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; grid-column: 1 / -1;">
      <i class="fas fa-search" style="font-size: 48px; color: #ccc; margin-bottom: 20px;"></i>
      <h3 style="color: #666; margin-bottom: 10px;">No products found</h3>
      <p style="color: #999; margin-bottom: 20px;">Try adjusting your filters or search terms</p>
      <button onclick="clearAllFilters()" style="padding: 10px 24px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Clear All Filters
      </button>
    </div>
  `;
  container.appendChild(noResultsDiv);
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

  // Add wishlist heart button
  const wishlistBtn = document.createElement('button');
  wishlistBtn.className = 'wishlist-btn';
  wishlistBtn.setAttribute('data-product-id', product.id);
  wishlistBtn.setAttribute('aria-label', `Add ${productName} to wishlist`);
  wishlistBtn.innerHTML = '<i class="far fa-heart"></i>';
  
  // Check if product is in wishlist and update icon
  checkAndUpdateWishlistIcon(wishlistBtn, product.id);
  
  // Add click event for wishlist toggle
  wishlistBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await toggleWishlist(wishlistBtn, product);
  });
  
  productImageContainer.appendChild(wishlistBtn);
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
  productPrice.textContent = `₦${product.price || '0.00'}`;

  // Create add to cart button
  const addToCartButton = document.createElement('button');
  addToCartButton.className = 'add-to-cart-btn';
  addToCartButton.innerHTML = '<i class="fas fa-shopping-cart"></i> Add to Cart';
  addToCartButton.setAttribute('data-product-id', product.id);
  addToCartButton.setAttribute('aria-label', `Add ${productName} to cart`);
  
  // Add click event listener for add to cart
  addToCartButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (window.addToCart) {
      window.addToCart(product);
    } else {
      console.error('Cart system not loaded');
    }
  });

  // Add click event to card (for future product detail page)
  productCard.addEventListener('click', () => {
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

// ============================================
// PAGINATION FUNCTIONS
// ============================================

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

  // Display products for the selected page
  displayDashboardProducts(allProductsForPagination, originalLatestProductIds, originalPopularProductIds);

  // Scroll to top of products section
  const productsSection = document.querySelector('.products-section');
  if (productsSection) {
    productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ============================================
// WISHLIST FUNCTIONS
// ============================================

/**
 * Check if product is in wishlist and update icon
 * @param {HTMLElement} btn - Wishlist button element
 * @param {string} productId - Product ID
 */
async function checkAndUpdateWishlistIcon(btn, productId) {
  if (!window.apiClient || !window.apiClient.isAuthenticated()) {
    return;
  }
  
  try {
    const response = await window.apiClient.isInWishlist(productId);
    if (response.inWishlist) {
      btn.innerHTML = '<i class="fas fa-heart"></i>';
      btn.classList.add('active');
    }
  } catch (error) {
    // Silently fail - don't break the UI
    console.log('Could not check wishlist status');
  }
}

/**
 * Toggle wishlist status for a product
 * @param {HTMLElement} btn - Wishlist button element
 * @param {Object} product - Product object
 */
async function toggleWishlist(btn, product) {
  if (!window.apiClient) {
    showWishlistNotification('Please log in to use wishlist', 'error');
    return;
  }
  
  if (!window.apiClient.isAuthenticated()) {
    showWishlistNotification('Please log in to use wishlist', 'error');
    return;
  }
  
  const isActive = btn.classList.contains('active');
  const productName = product.title || product.name || 'Product';
  
  try {
    if (isActive) {
      // Remove from wishlist
      await window.apiClient.removeFromWishlist(product.id);
      btn.innerHTML = '<i class="far fa-heart"></i>';
      btn.classList.remove('active');
      showWishlistNotification(`${productName} removed from wishlist`, 'info');
    } else {
      // Add to wishlist
      await window.apiClient.addToWishlist(product.id);
      btn.innerHTML = '<i class="fas fa-heart"></i>';
      btn.classList.add('active');
      showWishlistNotification(`${productName} added to wishlist`, 'success');
    }
  } catch (error) {
    console.error('Error toggling wishlist:', error);
    showWishlistNotification('Failed to update wishlist', 'error');
  }
}

/**
 * Show wishlist notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type
 */
function showWishlistNotification(message, type = 'success') {
  if (window.showCartNotification) {
    window.showCartNotification(message, type);
  } else {
    console.log(message);
  }
}
