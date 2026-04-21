// Authentication Service
import { 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { auth, db } from './config2.js';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.userRole = null;
  }

  /**
   * Login user with role verification
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} interfaceType - 'admin' or 'user'
   * @returns {Promise<Object>} - Login result with user data and role
   */
  async login(email, password, interfaceType) {
    try {
      // Step 1: Authenticate user with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Step 2: Check if document exists in the correct Firestore collection
      const collectionName = interfaceType === 'admin' ? 'admins' : 'users';
      const userDocRef = doc(db, collectionName, user.uid);
      const userDoc = await getDoc(userDocRef);
      
      // Step 3: Verify document exists and has correct role
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Verify the role matches the interface
        if (userData.role === interfaceType) {
          this.currentUser = user;
          this.userRole = userData.role;
          
          return {
            success: true,
            user: {
              uid: user.uid,
              email: user.email,
              role: userData.role,
              ...userData
            },
            message: 'Login successful'
          };
        } else {
          // Role mismatch - sign out and show error
          await this.logout();
          throw new Error('Invalid login source. Please use the correct portal.');
        }
      } else {
        // Document doesn't exist - sign out and show error
        await this.logout();
        throw new Error('Invalid login source. Please use the correct portal.');
      }
      
    } catch (error) {
      // Handle Firebase Auth errors
      if (error.code === 'auth/user-not-found') {
        throw new Error('User not found. Please check your email and password.');
      } else if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password. Please try again.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email format.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      } else if (error.message === 'Invalid login source. Please use the correct portal.') {
        throw error; // Re-throw our custom error
      } else {
        throw new Error('Login failed. Please try again.');
      }
    }
  }

  /**
   * Logout user
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      await signOut(auth);
      this.currentUser = null;
      this.userRole = null;
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Logout failed. Please try again.');
    }
  }

  /**
   * Get current user
   * @returns {Object|null} - Current user object or null
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Get current user role
   * @returns {string|null} - Current user role or null
   */
  getUserRole() {
    return this.userRole;
  }

  /**
   * Check if user is authenticated
   * @returns {boolean} - True if user is authenticated
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }

  /**
   * Check if user is admin
   * @returns {boolean} - True if user is admin
   */
  isAdmin() {
    return this.userRole === 'admin';
  }

  /**
   * Check if user is regular user
   * @returns {boolean} - True if user is regular user
   */
  isUser() {
    return this.userRole === 'user';
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService; 