const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { body, validationResult } = require('express-validator');
const Document = require('../models/Document');
const { protect, uploadRateLimit, checkSubscriptionLimits } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { encrypt, decrypt } = require('../utils/encryption');
const documentProcessor = require('../utils/documentProcessor');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = /jpeg|jpg|png|pdf|bmp|tiff|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF and image files are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 2 // Allow up to 2 files for comparison
  },
  fileFilter: fileFilter
});

// @desc    Upload and process document
// @route   POST /api/documents/upload
// @access  Private
router.post('/upload', [
  protect,
  uploadRateLimit,
  checkSubscriptionLimits,
  upload.single('document'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  try {
    const { title } = req.body;
    const file = req.file;

    // Determine file type
    const fileType = documentProcessor.getFileType(file.originalname);

    // Read and encrypt file content
    const fileBuffer = await fs.readFile(file.path);
    const encryptedContent = encrypt(fileBuffer.toString('base64'));

    // Extract text from document
    console.log('Extracting text from document...');
    const extractionResult = await documentProcessor.extractText(file.path, fileType);

    // Detect document type
    const documentType = documentProcessor.detectDocumentType(extractionResult.text);

    // Create document record
    const document = await Document.create({
      userId: req.user._id,
      title: title || file.originalname,
      originalFileName: file.originalname,
      fileType: fileType,
      fileSize: file.size,
      filePath: file.path,
      encryptedContent: encryptedContent,
      extractedText: extractionResult.text,
      documentType: documentType,
      status: 'uploaded',
      metadata: {
        pages: extractionResult.pages || 1,
        language: 'en',
        ocrConfidence: extractionResult.confidence,
        processingMethod: extractionResult.processingMethod
      }
    });

    // Clean up uploaded file (we have encrypted content stored)
    try {
      await fs.unlink(file.path);
    } catch (cleanupError) {
      console.warn('Failed to cleanup uploaded file:', cleanupError);
    }

    // Increment user's document count
    await req.user.incrementDocumentsAnalyzed();

    console.log(`Document uploaded successfully: ${document._id}`);

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      document: {
        id: document._id,
        title: document.title,
        originalFileName: document.originalFileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        documentType: document.documentType,
        status: document.status,
        metadata: document.metadata,
        createdAt: document.createdAt
      }
    });

  } catch (error) {
    // Clean up file if processing failed
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup file after error:', cleanupError);
      }
    }
    throw error;
  }
}));

// @desc    Upload multiple documents for comparison
// @route   POST /api/documents/upload-compare
// @access  Private
router.post('/upload-compare', [
  protect,
  uploadRateLimit,
  checkSubscriptionLimits,
  upload.array('documents', 2)
], asyncHandler(async (req, res) => {
  if (!req.files || req.files.length !== 2) {
    return res.status(400).json({
      success: false,
      message: 'Please upload exactly 2 documents for comparison'
    });
  }

  try {
    const uploadedDocs = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      
      // Determine file type
      const fileType = documentProcessor.getFileType(file.originalname);

      // Read and encrypt file content
      const fileBuffer = await fs.readFile(file.path);
      const encryptedContent = encrypt(fileBuffer.toString('base64'));

      // Extract text from document
      console.log(`Extracting text from document ${i + 1}...`);
      let extractionResult;
      try {
        extractionResult = await documentProcessor.extractText(file.path, fileType, i + 1);
        console.log(`✅ Text extraction successful for document ${i + 1}: ${extractionResult.text.length} characters`);
      } catch (extractionError) {
        console.error(`❌ Text extraction failed for document ${i + 1}:`, extractionError.message);
        // Continue with fallback - the documentProcessor should handle this
        extractionResult = await documentProcessor.extractText(file.path, fileType, i + 1);
      }

      // Detect document type
      const documentType = documentProcessor.detectDocumentType(extractionResult.text);

      // Create document record
      const document = await Document.create({
        userId: req.user._id,
        title: `Comparison Document ${i + 1} - ${file.originalname}`,
        originalFileName: file.originalname,
        fileType: fileType,
        fileSize: file.size,
        filePath: file.path,
        encryptedContent: encryptedContent,
        extractedText: extractionResult.text,
        documentType: documentType,
        status: 'uploaded',
        metadata: {
          pages: extractionResult.pages || 1,
          language: 'en',
          ocrConfidence: extractionResult.confidence,
          processingMethod: extractionResult.processingMethod
        }
      });

      uploadedDocs.push({
        id: document._id,
        title: document.title,
        originalFileName: document.originalFileName,
        fileType: document.fileType,
        documentType: document.documentType,
        status: document.status
      });

      // Clean up uploaded file
      try {
        await fs.unlink(file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup uploaded file:', cleanupError);
      }
    }

    // Increment user's document count
    await req.user.incrementDocumentsAnalyzed();

    console.log(`Documents uploaded for comparison: ${uploadedDocs.map(d => d.id).join(', ')}`);

    res.status(201).json({
      success: true,
      message: 'Documents uploaded successfully for comparison',
      documents: uploadedDocs
    });

  } catch (error) {
    // Clean up files if processing failed
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (cleanupError) {
          console.warn('Failed to cleanup file after error:', cleanupError);
        }
      }
    }
    throw error;
  }
}));

// @desc    Get user's documents
// @route   GET /api/documents
// @access  Private
router.get('/', protect, asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, documentType, search } = req.query;

  const query = { userId: req.user._id };

  // Add filters
  if (status) query.status = status;
  if (documentType) query.documentType = documentType;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { originalFileName: { $regex: search, $options: 'i' } }
    ];
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
    select: '-encryptedContent -extractedText' // Exclude large fields
  };

  const documents = await Document.find(query)
    .select(options.select)
    .sort(options.sort)
    .limit(options.limit * 1)
    .skip((options.page - 1) * options.limit);

  const total = await Document.countDocuments(query);

  res.status(200).json({
    success: true,
    count: documents.length,
    total,
    page: options.page,
    pages: Math.ceil(total / options.limit),
    documents
  });
}));

// @desc    Get single document
// @route   GET /api/documents/:id
// @access  Private
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  // Update last accessed
  await document.updateLastAccessed();

  // Don't send encrypted content in response
  const documentResponse = document.toObject();
  delete documentResponse.encryptedContent;

  res.status(200).json({
    success: true,
    document: documentResponse
  });
}));

// @desc    Update document
// @route   PUT /api/documents/:id
// @access  Private
router.put('/:id', [
  protect,
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { title, tags } = req.body;

  const document = await Document.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  // Update fields
  if (title) document.title = title;
  if (tags) document.tags = tags;

  await document.save();

  // Don't send encrypted content in response
  const documentResponse = document.toObject();
  delete documentResponse.encryptedContent;

  res.status(200).json({
    success: true,
    message: 'Document updated successfully',
    document: documentResponse
  });
}));

// @desc    Delete document
// @route   DELETE /api/documents/:id
// @access  Private
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  // Delete the document
  await document.deleteOne();

  console.log(`Document deleted: ${document._id}`);

  res.status(200).json({
    success: true,
    message: 'Document deleted successfully'
  });
}));

// @desc    Get document statistics
// @route   GET /api/documents/stats
// @access  Private
router.get('/stats', protect, asyncHandler(async (req, res) => {
  const stats = await Document.getUserStats(req.user._id);

  // Calculate risk distribution
  const riskCounts = { Low: 0, Medium: 0, High: 0 };
  stats.riskDistribution.forEach(risk => {
    if (riskCounts.hasOwnProperty(risk)) {
      riskCounts[risk]++;
    }
  });

  // Calculate document type distribution
  const typeCounts = {};
  stats.documentTypes.forEach(type => {
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  res.status(200).json({
    success: true,
    stats: {
      totalDocuments: stats.totalDocuments,
      analyzedDocuments: stats.analyzedDocuments,
      pendingDocuments: stats.totalDocuments - stats.analyzedDocuments,
      riskDistribution: riskCounts,
      documentTypes: typeCounts,
      subscriptionUsage: {
        used: req.user.documentsAnalyzed,
        limit: req.user.subscription.documentsLimit,
        remaining: Math.max(0, req.user.subscription.documentsLimit - req.user.documentsAnalyzed)
      }
    }
  });
}));

module.exports = router;
