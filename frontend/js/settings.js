/**
 * Settings Page - Account Management
 * Handles profile updates, password changes, and account deletion
 */

(function () {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================

  const RETRY_LIMIT = 20;
  const RETRY_DELAY_MS = 300;

  // ============================================
  // DOM ELEMENTS
  // ============================================

  const elements = {
    // Profile
    avatar: document.getElementById('settingsAvatar'),
    avatarInput: document.getElementById('avatarInput'),
    name: document.getElementById('settingsName'),
    email: document.getElementById('settingsEmail'),
    phone: document.getElementById('settingsPhone'),
    saveProfileBtn: document.getElementById('saveProfileBtn'),

    // Address
    address: document.getElementById('settingsAddress'),
    city: document.getElementById('settingsCity'),
    state: document.getElementById('settingsState'),
    zipCode: document.getElementById('settingsZipCode'),
    country: document.getElementById('settingsCountry'),
    saveAddressBtn: document.getElementById('saveAddressBtn'),

    // Password
    currentPassword: document.getElementById('currentPassword'),
    newPassword: document.getElementById('newPassword'),
    confirmPassword: document.getElementById('confirmPassword'),
    changePasswordBtn: document.getElementById('changePasswordBtn'),

    // Delete Account
    deleteAccountBtn: document.getElementById('deleteAccountBtn'),
    deleteModal: document.getElementById('deleteModal'),
    closeDeleteModal: document.getElementById('closeDeleteModal'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    deletePassword: document.getElementById('deletePassword'),
    deleteConfirm: document.getElementById('deleteConfirm'),

    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.querySelector('.toast-message'),
    toastIcon: document.querySelector('.toast-icon i'),
    toastClose: document.querySelector('.toast-close'),
  };

  // ============================================
  // INITIALIZATION
  // ============================================

  document.addEventListener('DOMContentLoaded', () => {
    attemptInit();
  });

  /**
   * Attempt to initialize with API client, retrying if not ready
   */
  function attemptInit(attempt = 0) {
    if (isAPIReady()) {
      init();
      return;
    }

    if (attempt >= RETRY_LIMIT) {
      console.error('API client did not initialize. Settings page may not function properly.');
      showToast('Error loading settings. Please refresh the page.', 'error');
      return;
    }

    setTimeout(() => attemptInit(attempt + 1), RETRY_DELAY_MS);
  }

  /**
   * Check if API client is available
   */
  function isAPIReady() {
    return window.apiClient && typeof window.apiClient.getCurrentUser === 'function';
  }

  /**
   * Initialize the settings page
   */
  async function init() {
    // Check authentication
    if (!window.apiClient.isAuthenticated()) {
      window.location.href = '../login.html';
      return;
    }

    // Load user data
    await loadUserData();

    // Setup event listeners
    setupEventListeners();
  }

  // ============================================
  // LOAD USER DATA
  // ============================================

  /**
   * Load current user data and populate forms
   */
  async function loadUserData() {
    try {
      const response = await window.apiClient.getCurrentUser();
      const user = response.user || {};

      // Populate profile fields
      if (elements.avatar && user.avatarUrl) {
        elements.avatar.src = user.avatarUrl;
      }
      if (elements.name) {
        elements.name.value = user.name || '';
      }
      if (elements.email) {
        elements.email.value = user.email || '';
      }
      if (elements.phone) {
        elements.phone.value = user.phoneNumber || '';
      }

      // Populate address fields
      if (elements.address) {
        elements.address.value = user.address || '';
      }
      if (elements.city) {
        elements.city.value = user.city || '';
      }
      if (elements.state) {
        elements.state.value = user.state || '';
      }
      if (elements.zipCode) {
        elements.zipCode.value = user.zipCode || '';
      }
      if (elements.country) {
        elements.country.value = user.country || '';
      }

      console.log('User data loaded successfully');
    } catch (error) {
      console.error('Error loading user data:', error);
      if (error.status === 401) {
        window.location.href = '../login.html';
        return;
      }
      showToast('Failed to load user data', 'error');
    }
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  /**
   * Setup all event listeners
   */
  function setupEventListeners() {
    // Avatar upload
    if (elements.avatarInput) {
      elements.avatarInput.addEventListener('change', handleAvatarUpload);
    }

    // Save profile
    if (elements.saveProfileBtn) {
      elements.saveProfileBtn.addEventListener('click', handleSaveProfile);
    }

    // Save address
    if (elements.saveAddressBtn) {
      elements.saveAddressBtn.addEventListener('click', handleSaveAddress);
    }

    // Change password
    if (elements.changePasswordBtn) {
      elements.changePasswordBtn.addEventListener('click', handleChangePassword);
    }

    // Password visibility toggles
    document.querySelectorAll('.toggle-password').forEach(btn => {
      btn.addEventListener('click', handleTogglePassword);
    });

    // Delete account modal
    if (elements.deleteAccountBtn) {
      elements.deleteAccountBtn.addEventListener('click', openDeleteModal);
    }
    if (elements.closeDeleteModal) {
      elements.closeDeleteModal.addEventListener('click', closeDeleteModal);
    }
    if (elements.cancelDeleteBtn) {
      elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    }
    if (elements.confirmDeleteBtn) {
      elements.confirmDeleteBtn.addEventListener('click', handleDeleteAccount);
    }

    // Close modal on overlay click
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', closeDeleteModal);
    }

    // Toast close
    if (elements.toastClose) {
      elements.toastClose.addEventListener('click', hideToast);
    }
  }

  // ============================================
  // AVATAR UPLOAD
  // ============================================

  /**
   * Handle avatar file upload
   */
  async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be less than 5MB', 'error');
      return;
    }

    try {
      // Convert to base64 for simple upload
      const base64 = await fileToBase64(file);
      
      // Show preview immediately
      if (elements.avatar) {
        elements.avatar.src = base64;
      }

      // Upload to server (using updateAvatar which accepts base64 URL)
      const response = await window.apiClient.updateAvatar(base64);
      
      showToast('Avatar updated successfully!', 'success');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      showToast('Failed to upload avatar', 'error');
      // Reload original avatar
      loadUserData();
    }
  }

  /**
   * Convert file to base64 string
   */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ============================================
  // PROFILE UPDATE
  // ============================================

  /**
   * Handle save profile button click
   */
  async function handleSaveProfile() {
    const name = elements.name?.value.trim();
    const phoneNumber = elements.phone?.value.trim();

    if (!name) {
      showToast('Name is required', 'error');
      return;
    }

    setButtonLoading(elements.saveProfileBtn, true);

    try {
      await window.apiClient.updateProfile({ name, phoneNumber });
      showToast('Profile updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast(error.message || 'Failed to update profile', 'error');
    } finally {
      setButtonLoading(elements.saveProfileBtn, false);
    }
  }

  // ============================================
  // ADDRESS UPDATE
  // ============================================

  /**
   * Handle save address button click
   */
  async function handleSaveAddress() {
    const address = elements.address?.value.trim();
    const city = elements.city?.value.trim();
    const state = elements.state?.value.trim();
    const zipCode = elements.zipCode?.value.trim();
    const country = elements.country?.value.trim();

    setButtonLoading(elements.saveAddressBtn, true);

    try {
      await window.apiClient.updateProfile({ 
        address, 
        city, 
        state, 
        zipCode, 
        country 
      });
      showToast('Address updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating address:', error);
      showToast(error.message || 'Failed to update address', 'error');
    } finally {
      setButtonLoading(elements.saveAddressBtn, false);
    }
  }

  // ============================================
  // PASSWORD CHANGE
  // ============================================

  /**
   * Handle change password button click
   */
  async function handleChangePassword() {
    const currentPassword = elements.currentPassword?.value;
    const newPassword = elements.newPassword?.value;
    const confirmPassword = elements.confirmPassword?.value;

    // Validation
    if (!currentPassword) {
      showToast('Current password is required', 'error');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    setButtonLoading(elements.changePasswordBtn, true);

    try {
      await window.apiClient.changePassword(currentPassword, newPassword, confirmPassword);
      
      // Clear password fields
      elements.currentPassword.value = '';
      elements.newPassword.value = '';
      elements.confirmPassword.value = '';
      
      showToast('Password changed successfully!', 'success');
    } catch (error) {
      console.error('Error changing password:', error);
      showToast(error.message || 'Failed to change password', 'error');
    } finally {
      setButtonLoading(elements.changePasswordBtn, false);
    }
  }

  /**
   * Handle password visibility toggle
   */
  function handleTogglePassword(event) {
    const btn = event.currentTarget;
    const targetId = btn.getAttribute('data-target');
    const input = document.getElementById(targetId);
    const icon = btn.querySelector('i');

    if (input && icon) {
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    }
  }

  // ============================================
  // ACCOUNT DELETION
  // ============================================

  /**
   * Open delete account modal
   */
  function openDeleteModal() {
    if (elements.deleteModal) {
      elements.deleteModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Close delete account modal
   */
  function closeDeleteModal() {
    if (elements.deleteModal) {
      elements.deleteModal.classList.remove('active');
      document.body.style.overflow = '';
      
      // Clear inputs
      if (elements.deletePassword) elements.deletePassword.value = '';
      if (elements.deleteConfirm) elements.deleteConfirm.value = '';
    }
  }

  /**
   * Handle account deletion
   */
  async function handleDeleteAccount() {
    const password = elements.deletePassword?.value;
    const confirmText = elements.deleteConfirm?.value;

    // Validation
    if (!password) {
      showToast('Password is required', 'error');
      return;
    }

    if (confirmText !== 'DELETE') {
      showToast('Please type DELETE to confirm', 'error');
      return;
    }

    setButtonLoading(elements.confirmDeleteBtn, true);

    try {
      await window.apiClient.deleteAccount(password, confirmText);
      
      showToast('Account deleted successfully', 'success');
      
      // Clear local storage and redirect
      localStorage.removeItem('authToken');
      localStorage.removeItem('userData');
      
      setTimeout(() => {
        window.location.href = '../index.html';
      }, 1500);
    } catch (error) {
      console.error('Error deleting account:', error);
      showToast(error.message || 'Failed to delete account', 'error');
      setButtonLoading(elements.confirmDeleteBtn, false);
    }
  }

  // ============================================
  // UI HELPERS
  // ============================================

  /**
   * Set button loading state
   */
  function setButtonLoading(button, loading) {
    if (!button) return;
    
    if (loading) {
      button.classList.add('loading');
      button.disabled = true;
    } else {
      button.classList.remove('loading');
      button.disabled = false;
    }
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'success') {
    if (!elements.toast || !elements.toastMessage) return;

    elements.toastMessage.textContent = message;
    elements.toast.classList.remove('error');
    
    if (type === 'error') {
      elements.toast.classList.add('error');
      elements.toastIcon.className = 'fas fa-exclamation-circle';
    } else {
      elements.toastIcon.className = 'fas fa-check-circle';
    }

    elements.toast.classList.add('active');

    // Auto-hide after 4 seconds
    setTimeout(hideToast, 4000);
  }

  /**
   * Hide toast notification
   */
  function hideToast() {
    if (elements.toast) {
      elements.toast.classList.remove('active');
    }
  }

})();
