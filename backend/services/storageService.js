/**
 * Storage Service
 * Handles file operations using Firebase Admin Storage
 */

const admin = require('firebase-admin');

/**
 * Get storage bucket (lazy initialization)
 * @returns {Bucket} Storage bucket
 */
function getBucket() {
  try {
    return admin.storage().bucket('name-it-e674c.firebasestorage.app');
  } catch (error) {
    console.error('Error getting storage bucket:', error);
    throw new Error('Storage bucket not available');
  }
}

/**
 * Upload file to Firebase Storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name/path in storage
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<string>} Download URL
 */
async function uploadFile(fileBuffer, fileName, contentType) {
  try {
    const bucket = getBucket();
    const file = bucket.file(fileName);

    await file.save(fileBuffer, {
      metadata: {
        contentType,
      },
    });

    // Return short-lived signed URL (private by default)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
    return url;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
  }
}

/**
 * Get download URL for file
 * @param {string} fileName - File name/path in storage
 * @returns {Promise<string>} Download URL
 */
async function getDownloadURL(fileName) {
  try {
    const bucket = getBucket();
    const file = bucket.file(fileName);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
    });
    return url;
  } catch (error) {
    console.error('Error getting download URL:', error);
    throw new Error('Failed to get file URL');
  }
}

/**
 * Delete file from Storage
 * @param {string} fileName - File name/path in storage
 * @returns {Promise<void>}
 */
async function deleteFile(fileName) {
  try {
    const bucket = getBucket();
    const file = bucket.file(fileName);
    await file.delete();
  } catch (error) {
    if (error.code === 404) {
      throw new Error('File not found');
    }
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
}

module.exports = {
  uploadFile,
  getDownloadURL,
  deleteFile,
};
