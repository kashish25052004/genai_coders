const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For GCM, this is always 16
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Get encryption key from environment variable
const getEncryptionKey = () => {
  const secretKey = process.env.AES_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('AES_SECRET_KEY environment variable is not set');
  }
  
  // If the key is base64 encoded, decode it
  try {
    const key = Buffer.from(secretKey, 'base64');
    if (key.length === KEY_LENGTH) {
      return key;
    }
  } catch (error) {
    // If not base64, treat as string and hash it
  }
  
  // Hash the secret key to get a consistent 32-byte key
  return crypto.createHash('sha256').update(secretKey).digest();
};

// Generate a random salt
const generateSalt = () => {
  return crypto.randomBytes(SALT_LENGTH);
};

// Derive key from password and salt using PBKDF2
const deriveKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha512');
};

// Encrypt text data
const encrypt = (text) => {
  try {
    if (!text) {
      throw new Error('Text to encrypt cannot be empty');
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine iv, tag, and encrypted data
    const result = {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      encrypted: encrypted
    };
    
    return JSON.stringify(result);
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

// Decrypt text data
const decrypt = (encryptedData) => {
  try {
    if (!encryptedData) {
      throw new Error('Encrypted data cannot be empty');
    }

    const key = getEncryptionKey();
    const data = JSON.parse(encryptedData);
    
    const iv = Buffer.from(data.iv, 'hex');
    const tag = Buffer.from(data.tag, 'hex');
    const encrypted = data.encrypted;
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

// Encrypt file buffer
const encryptFile = (fileBuffer) => {
  try {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('File buffer cannot be empty');
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(fileBuffer),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    // Combine iv, tag, and encrypted data
    const result = Buffer.concat([
      iv,
      tag,
      encrypted
    ]);
    
    return result;
  } catch (error) {
    console.error('File encryption error:', error);
    throw new Error('Failed to encrypt file');
  }
};

// Decrypt file buffer
const decryptFile = (encryptedBuffer) => {
  try {
    if (!encryptedBuffer || encryptedBuffer.length === 0) {
      throw new Error('Encrypted buffer cannot be empty');
    }

    const key = getEncryptionKey();
    
    // Extract iv, tag, and encrypted data
    const iv = encryptedBuffer.slice(0, IV_LENGTH);
    const tag = encryptedBuffer.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = encryptedBuffer.slice(IV_LENGTH + TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted;
  } catch (error) {
    console.error('File decryption error:', error);
    throw new Error('Failed to decrypt file');
  }
};

// Hash password with salt
const hashPassword = (password, salt = null) => {
  try {
    if (!salt) {
      salt = generateSalt();
    }
    
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    
    return {
      hash: hash.toString('hex'),
      salt: salt.toString('hex')
    };
  } catch (error) {
    console.error('Password hashing error:', error);
    throw new Error('Failed to hash password');
  }
};

// Verify password
const verifyPassword = (password, hashedPassword, salt) => {
  try {
    const saltBuffer = Buffer.from(salt, 'hex');
    const { hash } = hashPassword(password, saltBuffer);
    
    return hash === hashedPassword;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
};

// Generate secure random token
const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

// Generate API key
const generateApiKey = () => {
  const timestamp = Date.now().toString();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const combined = timestamp + randomBytes;
  
  return crypto.createHash('sha256').update(combined).digest('hex');
};

// Secure compare (timing attack resistant)
const secureCompare = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

// Generate encryption key for new installations
const generateEncryptionKey = () => {
  const key = crypto.randomBytes(KEY_LENGTH);
  return key.toString('base64');
};

module.exports = {
  encrypt,
  decrypt,
  encryptFile,
  decryptFile,
  hashPassword,
  verifyPassword,
  generateToken,
  generateApiKey,
  secureCompare,
  generateEncryptionKey,
  generateSalt
};
