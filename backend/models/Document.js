const mongoose = require('mongoose');

const clauseSchema = new mongoose.Schema({
  page: {
    type: Number,
    required: true
  },
  clause: {
    type: String,
    required: true
  },
  explanation: {
    type: String,
    required: true
  },
  risk_ai: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    required: true
  },
  risk_rules: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    required: true
  },
  final_risk: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  keywords: [{
    type: String
  }],
  position: {
    start: Number,
    end: Number
  }
});

const glossarySchema = new mongoose.Schema({
  term: {
    type: String,
    required: true
  },
  meaning: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['legal', 'financial', 'technical', 'general'],
    default: 'general'
  }
});

const qaSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Document title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  originalFileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['pdf', 'image'],
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  encryptedContent: {
    type: String,
    required: true
  },
  extractedText: {
    type: String,
    required: true
  },
  documentType: {
    type: String,
    enum: ['rental_agreement', 'loan_contract', 'terms_of_service', 'employment_contract', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'analyzed', 'failed'],
    default: 'uploaded'
  },
  analysis: {
    clauses: [clauseSchema],
    glossary: [glossarySchema],
    qa: [qaSchema],
    summary: {
      totalClauses: {
        type: Number,
        default: 0
      },
      riskDistribution: {
        low: { type: Number, default: 0 },
        medium: { type: Number, default: 0 },
        high: { type: Number, default: 0 }
      },
      overallRisk: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Low'
      },
      keyFindings: [String],
      recommendations: [String]
    },
    processingTime: {
      type: Number // in milliseconds
    },
    aiModel: {
      type: String,
      default: 'gemini-pro'
    }
  },
  metadata: {
    pages: {
      type: Number,
      default: 1
    },
    language: {
      type: String,
      default: 'en'
    },
    ocrConfidence: {
      type: Number,
      min: 0,
      max: 1
    },
    processingMethod: {
      type: String,
      enum: [
        'pdf-parse', 
        'pdf-parse-maxbuffer', 
        'pdf-to-image-ocr', 
        'ocr', 
        'fallback-sample', 
        'fallback-sample-doc1', 
        'fallback-sample-doc2'
      ],
      required: true
    }
  },
  tags: [{
    type: String,
    trim: true
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['read', 'comment'],
      default: 'read'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  downloadCount: {
    type: Number,
    default: 0
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
documentSchema.index({ userId: 1, createdAt: -1 });
documentSchema.index({ status: 1 });
documentSchema.index({ documentType: 1 });
documentSchema.index({ 'analysis.summary.overallRisk': 1 });
documentSchema.index({ tags: 1 });

// Virtual for risk level color coding
documentSchema.virtual('riskColor').get(function() {
  const riskColors = {
    'Low': 'green',
    'Medium': 'yellow',
    'High': 'red'
  };
  return riskColors[this.analysis?.summary?.overallRisk] || 'gray';
});

// Instance method to update last accessed
documentSchema.methods.updateLastAccessed = function() {
  this.lastAccessed = new Date();
  return this.save({ validateBeforeSave: false });
};

// Instance method to increment download count
documentSchema.methods.incrementDownloadCount = function() {
  this.downloadCount += 1;
  return this.save({ validateBeforeSave: false });
};

// Static method to find documents by user
documentSchema.statics.findByUser = function(userId, options = {}) {
  const query = this.find({ userId });
  
  if (options.status) {
    query.where('status').equals(options.status);
  }
  
  if (options.documentType) {
    query.where('documentType').equals(options.documentType);
  }
  
  if (options.limit) {
    query.limit(options.limit);
  }
  
  return query.sort({ createdAt: -1 });
};

// Static method to get user's document statistics
documentSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalDocuments: { $sum: 1 },
        analyzedDocuments: {
          $sum: { $cond: [{ $eq: ['$status', 'analyzed'] }, 1, 0] }
        },
        riskDistribution: {
          $push: '$analysis.summary.overallRisk'
        },
        documentTypes: {
          $push: '$documentType'
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalDocuments: 0,
    analyzedDocuments: 0,
    riskDistribution: [],
    documentTypes: []
  };
};

module.exports = mongoose.model('Document', documentSchema);
