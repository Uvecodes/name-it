/**
 * User Profile Page Logic
 * Fetches and displays user profile, orders, activity, wishlist count, and rewards
 */

(function () {
  // ============================================
  // CONFIGURATION
  // ============================================

  const RETRY_LIMIT = 20;
  const RETRY_DELAY_MS = 300;
  const DEFAULT_AVATAR = '../assets/Stoofperen.jpg';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================
  // DOM ELEMENTS
  // ============================================

  const PROFILE_NAV_MOBILE_MAX = 900;

  const elements = {
    // Navigation
    navUserName: document.getElementById('navUserName'),
    navAvatar: document.getElementById('navAvatar'),

    // Stats Cards
    totalOrders: document.getElementById('totalOrders'),
    wishlistCount: document.getElementById('wishlistCount'),
    rewardPoints: document.getElementById('rewardPoints'),
    totalOrdersDrawer: document.getElementById('totalOrdersDrawer'),
    wishlistCountDrawer: document.getElementById('wishlistCountDrawer'),
    rewardPointsDrawer: document.getElementById('rewardPointsDrawer'),

    // Profile
    profileName: document.getElementById('profileName'),
    profileEmail: document.getElementById('profileEmail'),
    profilePhone: document.getElementById('profilePhone'),
    profileLocation: document.getElementById('profileLocation'),
    profileAvatar: document.getElementById('profileAvatar'),
    avatarUpload: document.getElementById('avatarUpload'),

    // Lists
    ordersList: document.getElementById('ordersList'),
    activityList: document.getElementById('activityList'),

    // Actions
    viewAllOrders: document.getElementById('viewAllOrders'),
    viewWishlistBtn: document.getElementById('viewWishlistBtn'),
    viewAllActivity: document.getElementById('viewAllActivity'),
  };

  // ============================================
  // INITIALIZATION
  // ============================================

  document.addEventListener('DOMContentLoaded', () => {
    attemptInit();
  });

  /**
   * Attempt to initialize API client-dependent logic
   */
  function attemptInit(attempt = 0) {
    if (isAPIReady()) {
      initUserProfile();
      return;
    }

    if (attempt >= RETRY_LIMIT) {
      console.error('API client did not initialize in time.');
      showError('Failed to connect to server');
      return;
    }

    setTimeout(() => attemptInit(attempt + 1), RETRY_DELAY_MS);
  }

  /**
   * Check whether API client is available
   */
  function isAPIReady() {
    return window.apiClient && typeof window.apiClient.getCurrentUser === 'function';
  }

  /**
   * Initialize the user profile page
   */
  async function initUserProfile() {
    if (!window.apiClient) {
      console.error('API client is unavailable.');
      return;
    }

    // Check authentication
    if (!window.apiClient.isAuthenticated()) {
      console.log('User not authenticated');
      return;
    }

    // Setup event listeners
    setupEventListeners();

    // Load all data in parallel
    await Promise.all([
      loadUserProfile(),
      loadStats(),
      loadRecentOrders(),
      loadRecentActivity(),
    ]);
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Avatar upload
    if (elements.avatarUpload) {
      elements.avatarUpload.addEventListener('change', handleAvatarUpload);
    }

    // View wishlist - redirect to wishlist page
    if (elements.viewWishlistBtn) {
      elements.viewWishlistBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = './wishlist.html';
      });
    }

    // Make wishlist stat card clickable
    const wishlistStatCard = elements.wishlistCount?.closest('.stat-card');
    if (wishlistStatCard) {
      wishlistStatCard.style.cursor = 'pointer';
      wishlistStatCard.addEventListener('click', () => {
        window.location.href = './wishlist.html';
      });
    }

    const wishlistDrawerCard = document.querySelector('.profile-drawer-stat-wishlist');
    if (wishlistDrawerCard) {
      const goWishlist = () => {
        window.location.href = './wishlist.html';
      };
      wishlistDrawerCard.addEventListener('click', goWishlist);
      wishlistDrawerCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goWishlist();
        }
      });
    }

    initProfileMobileNav();

    // View all activity - redirect to activities page
    if (elements.viewAllActivity) {
      elements.viewAllActivity.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = './activities.html';
      });
    }
  }

  // ============================================
  // DATA LOADING FUNCTIONS
  // ============================================

  /**
   * Load user profile data
   */
  async function loadUserProfile() {
    try {
      const response = await window.apiClient.getCurrentUser();
      const user = response.user || {};

      renderProfile(user);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      renderProfile({});
    }
  }

  /**
   * Mobile drawer: right-side panel with back link, stats, account links.
   */
  function initProfileMobileNav() {
    const toggle = document.getElementById('profileNavToggle');
    const drawer = document.getElementById('profileNavDrawer');
    const backdrop = document.getElementById('profileNavBackdrop');
    const closeBtn = document.getElementById('profileNavDrawerClose');
    if (!toggle || !drawer || !backdrop) {
      return;
    }

    const mq = window.matchMedia(`(max-width: ${PROFILE_NAV_MOBILE_MAX}px)`);

    const openNav = () => {
      drawer.classList.add('is-open');
      backdrop.classList.add('is-open');
      toggle.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };

    const closeNav = () => {
      drawer.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      toggle.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    const isMobileNav = () => mq.matches;

    toggle.addEventListener('click', () => {
      if (!isMobileNav()) {
        return;
      }
      if (drawer.classList.contains('is-open')) {
        closeNav();
      } else {
        openNav();
      }
    });

    backdrop.addEventListener('click', closeNav);
    if (closeBtn) {
      closeBtn.addEventListener('click', closeNav);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        closeNav();
      }
    });

    window.addEventListener('resize', () => {
      if (!isMobileNav()) {
        closeNav();
      }
    });

    drawer.querySelectorAll('a.profile-drawer-link').forEach((link) => {
      link.addEventListener('click', () => closeNav());
    });
  }

  /**
   * Load stats (orders count, wishlist count, reward points)
   */
  async function loadStats() {
    // Load in parallel
    const [ordersData, wishlistData, rewardsData] = await Promise.allSettled([
      window.apiClient.getOrders(),
      window.apiClient.getWishlistCount(),
      window.apiClient.getRewards(),
    ]);

    // Orders count
    if (ordersData.status === 'fulfilled') {
      const count = ordersData.value.count || ordersData.value.orders?.length || 0;
      const text = count.toString();
      updateElement(elements.totalOrders, text);
      updateElement(elements.totalOrdersDrawer, text);
    } else {
      updateElement(elements.totalOrders, '0');
      updateElement(elements.totalOrdersDrawer, '0');
    }

    // Wishlist count
    if (wishlistData.status === 'fulfilled') {
      const count = wishlistData.value.count || 0;
      const text = count.toString();
      updateElement(elements.wishlistCount, text);
      updateElement(elements.wishlistCountDrawer, text);
    } else {
      updateElement(elements.wishlistCount, '0');
      updateElement(elements.wishlistCountDrawer, '0');
    }

    // Reward points
    if (rewardsData.status === 'fulfilled') {
      const balance = rewardsData.value.balance || 0;
      const text = balance.toString();
      updateElement(elements.rewardPoints, text);
      updateElement(elements.rewardPointsDrawer, text);
    } else {
      updateElement(elements.rewardPoints, '0');
      updateElement(elements.rewardPointsDrawer, '0');
    }
  }

  /**
   * Load recent orders (last 2 only for profile page)
   */
  async function loadRecentOrders() {
    try {
      const response = await window.apiClient.getOrders(2);
      const orders = response.orders || [];

      renderOrders(orders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      renderOrdersError();
    }
  }

  /**
   * Load recent activity (last 2 only for profile page)
   */
  async function loadRecentActivity() {
    try {
      const response = await window.apiClient.getActivity(2);
      const activities = response.activities || [];

      renderActivity(activities);
    } catch (error) {
      console.error('Failed to fetch activity:', error);
      renderActivityError();
    }
  }

  // ============================================
  // RENDERING FUNCTIONS
  // ============================================

  /**
   * Render user profile
   */
  function renderProfile(user) {
    const name = user.name || 'User';
    const email = user.email || 'Not provided';
    const phone = user.phoneNumber || user.phone || 'Not provided';
    const location = user.location || 'Not provided';
    const avatarUrl = user.avatarUrl || DEFAULT_AVATAR;

    updateElement(elements.navUserName, name);
    updateElement(elements.profileName, name);
    updateElement(elements.profileEmail, email);
    updateElement(elements.profilePhone, phone);
    updateElement(elements.profileLocation, location);

    // Update avatars
    if (elements.navAvatar) {
      elements.navAvatar.src = avatarUrl;
      elements.navAvatar.onerror = () => { elements.navAvatar.src = DEFAULT_AVATAR; };
    }
    if (elements.profileAvatar) {
      elements.profileAvatar.src = avatarUrl;
      elements.profileAvatar.onerror = () => { elements.profileAvatar.src = DEFAULT_AVATAR; };
    }
  }

  /**
   * Render orders list
   */
  function renderOrders(orders) {
    if (!elements.ordersList) return;

    if (orders.length === 0) {
      elements.ordersList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-shopping-bag"></i>
          <h4>No orders yet</h4>
          <p>Start shopping to see your orders here</p>
          <a href="./user-dashboard.html">Browse Products</a>
        </div>
      `;
      return;
    }

    elements.ordersList.innerHTML = orders.map(order => createOrderCard(order)).join('');
  }

  /**
   * Create order card HTML
   */
  function createOrderCard(order) {
    const orderId = order.orderId || order.id || 'Unknown';
    const displayId = orderId.startsWith('ORD-') ? orderId : `#${orderId.slice(-8).toUpperCase()}`;
    const status = order.status || 'pending';
    const statusClass = getStatusClass(status);
    const statusLabel = getStatusLabel(status);
    const statusIcon = getStatusIcon(status);
    const date = formatDate(order.createdAt);
    const total = formatCurrency(order.totalAmount);

    // Get first item for display
    const items = order.items || [];
    const firstItem = items[0] || {};
    const productName = firstItem.name || firstItem.title || 'Product';
    const productImage = firstItem.imageUrl || 'https://via.placeholder.com/60?text=Product';
    const quantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const itemCount = items.length;
    const moreItems = itemCount > 1 ? ` +${itemCount - 1} more` : '';

    return `
      <div class="order-item" data-order-id="${escapeHtml(orderId)}">
        <div class="order-info">
          <div class="order-number">${escapeHtml(displayId)}</div>
          <div class="order-date">${escapeHtml(date)}</div>
          <div class="order-status ${statusClass}">
            <i class="fas ${statusIcon}"></i>
            ${escapeHtml(statusLabel)}
          </div>
        </div>
        <div class="order-products">
          <img src="${escapeHtml(productImage)}" alt="${escapeHtml(productName)}" onerror="this.src='https://via.placeholder.com/60?text=Product'">
          <div class="product-details">
            <h4>${escapeHtml(productName)}${escapeHtml(moreItems)}</h4>
            <p>Total items: ${Number(quantity || 0)}</p>
          </div>
        </div>
        <div class="order-total">${escapeHtml(total)}</div>
      </div>
    `;
  }

  /**
   * Render orders error
   */
  function renderOrdersError() {
    if (!elements.ordersList) return;

    elements.ordersList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h4>Could not load orders</h4>
        <p>Please try refreshing the page</p>
      </div>
    `;
  }

  /**
   * Render activity list
   */
  function renderActivity(activities) {
    if (!elements.activityList) return;

    if (activities.length === 0) {
      elements.activityList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-clock"></i>
          <h4>No recent activity</h4>
          <p>Your activity will appear here</p>
        </div>
      `;
      return;
    }

    elements.activityList.innerHTML = activities.map(activity => createActivityCard(activity)).join('');
  }

  /**
   * Create activity card HTML
   */
  function createActivityCard(activity) {
    const title = activity.title || 'Activity';
    const description = activity.description || '';
    const icon = activity.icon || 'fa-circle';
    const timeAgo = formatRelativeTime(activity.createdAt);

    return `
      <div class="activity-item">
        <div class="activity-icon">
          <i class="fas ${icon}"></i>
        </div>
        <div class="activity-content">
          <h4>${escapeHtml(title)}</h4>
          <p>${escapeHtml(description)}</p>
          <span class="activity-time">${escapeHtml(timeAgo)}</span>
        </div>
      </div>
    `;
  }

  /**
   * Render activity error
   */
  function renderActivityError() {
    if (!elements.activityList) return;

    elements.activityList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h4>Could not load activity</h4>
        <p>Please try refreshing the page</p>
      </div>
    `;
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  /**
   * Handle avatar upload
   */
  async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    try {
      // Show loading state
      if (elements.profileAvatar) {
        elements.profileAvatar.style.opacity = '0.5';
      }

      // Convert to base64 for simple storage
      const base64 = await fileToBase64(file);
      
      // Update avatar via API
      await window.apiClient.updateAvatar(base64);

      // Update UI
      if (elements.profileAvatar) {
        elements.profileAvatar.src = base64;
        elements.profileAvatar.style.opacity = '1';
      }
      if (elements.navAvatar) {
        elements.navAvatar.src = base64;
      }

      console.log('Avatar updated successfully');
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      alert('Failed to upload avatar. Please try again.');
      
      if (elements.profileAvatar) {
        elements.profileAvatar.style.opacity = '1';
      }
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * Update element text content
   */
  function updateElement(element, value) {
    if (element) {
      element.textContent = value;
    }
  }

  /**
   * Show error message
   */
  function showError(message) {
    console.error(message);
  }

  /**
   * Get CSS class for order status
   */
  function getStatusClass(status) {
    const statusMap = {
      pending: 'status-pending',
      received: 'status-received',
      dispatched: 'status-dispatched',
      delivered: 'status-delivered',
      processing: 'status-received',
      shipped: 'status-dispatched',
      cancelled: 'status-cancelled',
    };
    return statusMap[status?.toLowerCase()] || 'status-pending';
  }

  /**
   * Get display label for order status
   */
  function getStatusLabel(status) {
    const labelMap = {
      pending: 'Pending',
      received: 'Received',
      dispatched: 'Dispatched',
      delivered: 'Delivered',
      processing: 'Processing',
      shipped: 'Shipped',
      cancelled: 'Cancelled',
    };
    return labelMap[status?.toLowerCase()] || 'Pending';
  }

  /**
   * Get icon for order status
   */
  function getStatusIcon(status) {
    const iconMap = {
      pending: 'fa-clock',
      received: 'fa-check',
      dispatched: 'fa-truck',
      delivered: 'fa-check-circle',
      processing: 'fa-spinner',
      shipped: 'fa-truck',
      cancelled: 'fa-times-circle',
    };
    return iconMap[status?.toLowerCase()] || 'fa-clock';
  }

  /**
   * Capitalize first letter
   */
  function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Format date
   */
  function formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return 'Unknown date';
    }
  }

  /**
   * Format currency
   */
  function formatCurrency(amount) {
    if (amount === undefined || amount === null) return '₦0.00';
    
    const num = parseFloat(amount);
    if (isNaN(num)) return '₦0.00';
    
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(num);
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  function formatRelativeTime(dateString) {
    if (!dateString) return 'Just now';

    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);
      const diffWeeks = Math.floor(diffDays / 7);
      const diffMonths = Math.floor(diffDays / 30);

      if (diffSeconds < 60) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
      if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
      
      return formatDate(dateString);
    } catch (error) {
      return 'Recently';
    }
  }

  /**
   * Convert file to base64
   */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

})();
