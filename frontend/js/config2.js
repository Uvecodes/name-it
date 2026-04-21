// Firebase Configuration - DEPRECATED
// All Firebase operations (Auth, Firestore, Storage, Analytics) are now handled by the backend API
// This file is kept for backward compatibility but no longer initializes any Firebase services
// Frontend should use window.apiClient to communicate with the backend

console.warn('config2.js is deprecated. All Firebase operations are now handled by the backend API.');

// Export empty objects for backward compatibility
export const db = null;
export const storage = null;
export const analytics = null;

export default null; 