const express = require('express');
const { body, validationResult } = require('express-validator');
const Document = require('../models/Document');
const { protect, analysisRateLimit } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const documentProcessor = require('../utils/documentProcessor');
const aiAnalyzer = require('../utils/aiAnalyzer');
const { performanceLogger } = require('../middleware/logger');

const router = express.Router();

// @desc    Analyze document
// @route   POST /api/analysis/analyze/:documentId
// @access  Private
router.post('/analyze/:documentId', [
  protect,
  analysisRateLimit
], asyncHandler(async (req, res) => {
  const startTime = Date.now();

  const document = await Document.findOne({
    _id: req.params.documentId,
    userId: req.user._id
  });

  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  if (document.status === 'analyzed') {
    return res.status(200).json({
      success: true,
      message: 'Document already analyzed',
      analysis: document.analysis
    });
  }

  try {
    // Update status to processing
    document.status = 'processing';
    await document.save();

    console.log(`Starting analysis for document: ${document._id}`);

    // Split document into clauses
    const clauses = documentProcessor.splitIntoClause(document.extractedText);
    console.log(`Document split into ${clauses.length} clauses`);

    // Analyze each clause
    const analyzedClauses = [];
    let currentPage = 1;

    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      console.log(`Analyzing clause ${i + 1}/${clauses.length}`);

      try {
        const analysis = await aiAnalyzer.analyzeClause(
          clause.text,
          currentPage,
          document.documentType
        );
        analyzedClauses.push(analysis);
      } catch (error) {
        console.error(`Error analyzing clause ${i + 1}:`, error);
        // Add a fallback analysis
        analyzedClauses.push({
          page: currentPage,
          clause: clause.text,
          explanation: 'Unable to analyze this clause automatically. Please review manually.',
          risk_ai: 'Medium',
          risk_rules: 'Medium',
          final_risk: 'Medium',
          reason: 'Analysis failed',
          keywords: [],
          important_terms: []
        });
      }

      // Estimate page progression (rough approximation)
      if ((i + 1) % Math.ceil(clauses.length / (document.metadata.pages || 1)) === 0) {
        currentPage++;
      }
    }

    // Build glossary
    const glossary = aiAnalyzer.buildGlossary(analyzedClauses);

    // Calculate risk distribution
    const riskDistribution = { low: 0, medium: 0, high: 0 };
    analyzedClauses.forEach(clause => {
      const risk = clause.final_risk.toLowerCase();
      if (riskDistribution.hasOwnProperty(risk)) {
        riskDistribution[risk]++;
      }
    });

    // Determine overall risk
    let overallRisk = 'Low';
    if (riskDistribution.high > 0) {
      overallRisk = 'High';
    } else if (riskDistribution.medium > riskDistribution.low) {
      overallRisk = 'Medium';
    }

    // Generate document summary
    const summaryData = await aiAnalyzer.generateDocumentSummary(
      analyzedClauses,
      document.documentType
    );

    // Update document with analysis
    document.analysis = {
      clauses: analyzedClauses,
      glossary: glossary,
      qa: [], // Will be populated as users ask questions
      summary: {
        totalClauses: analyzedClauses.length,
        riskDistribution: riskDistribution,
        overallRisk: overallRisk,
        keyFindings: summaryData.key_findings || [],
        recommendations: summaryData.recommendations || []
      },
      processingTime: Date.now() - startTime,
      aiModel: 'gemini-pro'
    };

    document.status = 'analyzed';
    await document.save();

    // Log performance
    performanceLogger('document_analysis', Date.now() - startTime, {
      documentId: document._id,
      clauseCount: analyzedClauses.length,
      documentType: document.documentType
    });

    console.log(`Analysis completed for document: ${document._id} in ${Date.now() - startTime}ms`);

    res.status(200).json({
      success: true,
      message: 'Document analyzed successfully',
      analysis: document.analysis
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    // Update document status to failed
    document.status = 'failed';
    await document.save();

    res.status(500).json({
      success: false,
      message: 'Analysis failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}));

// @desc    Compare two documents
// @route   POST /api/analysis/compare
// @access  Private
router.post('/compare', [
  protect,
  analysisRateLimit,
  body('documentId1')
    .notEmpty()
    .withMessage('First document ID is required'),
  body('documentId2')
    .notEmpty()
    .withMessage('Second document ID is required')
], asyncHandler(async (req, res) => {
  console.log('Comparison request body:', req.body);
  
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { documentId1, documentId2 } = req.body;
  console.log('Comparing documents:', documentId1, 'vs', documentId2);

  if (documentId1 === documentId2) {
    return res.status(400).json({
      success: false,
      message: 'Cannot compare a document with itself'
    });
  }

  // Get both documents
  const [doc1, doc2] = await Promise.all([
    Document.findOne({ _id: documentId1, userId: req.user._id }),
    Document.findOne({ _id: documentId2, userId: req.user._id })
  ]);

  if (!doc1 || !doc2) {
    return res.status(404).json({
      success: false,
      message: 'One or both documents not found'
    });
  }

  // Auto-analyze documents if not already analyzed
  if (doc1.status !== 'analyzed') {
    console.log(`Auto-analyzing document 1: ${doc1._id}`);
    doc1.status = 'processing';
    await doc1.save();
    
    try {
      // Split document into clauses
      const clauses1 = documentProcessor.splitIntoClause(doc1.extractedText);
      
      // Analyze each clause
      const analyzedClauses1 = [];
      let currentPage1 = 1;

      for (let i = 0; i < clauses1.length; i++) {
        const clause = clauses1[i];
        try {
          const analysis = await aiAnalyzer.analyzeClause(
            clause.text,
            currentPage1,
            doc1.documentType
          );
          analyzedClauses1.push(analysis);
        } catch (error) {
          console.error(`Error analyzing clause ${i + 1} of doc1:`, error);
          analyzedClauses1.push({
            page: currentPage1,
            clause: clause.text,
            explanation: 'Unable to analyze this clause automatically.',
            risk_ai: 'Medium',
            risk_rules: 'Medium',
            final_risk: 'Medium',
            reason: 'Analysis failed',
            keywords: [],
            important_terms: []
          });
        }
        if ((i + 1) % Math.ceil(clauses1.length / (doc1.metadata.pages || 1)) === 0) {
          currentPage1++;
        }
      }

      // Build glossary and summary
      const glossary1 = aiAnalyzer.buildGlossary(analyzedClauses1);
      
      // Calculate risk distribution
      const riskDistribution1 = { low: 0, medium: 0, high: 0 };
      analyzedClauses1.forEach(clause => {
        const risk = clause.final_risk.toLowerCase();
        if (riskDistribution1.hasOwnProperty(risk)) {
          riskDistribution1[risk]++;
        }
      });

      // Determine overall risk
      let overallRisk1 = 'Low';
      if (riskDistribution1.high > 0) {
        overallRisk1 = 'High';
      } else if (riskDistribution1.medium > riskDistribution1.low) {
        overallRisk1 = 'Medium';
      }

      // Generate document summary (fallback to rules-based when AI quota exceeded)
      let summaryData1;
      try {
        console.log('🔍 Generating summary for document 1...');
        summaryData1 = await aiAnalyzer.generateDocumentSummary(
          analyzedClauses1,
          doc1.documentType
        );
      } catch (summaryError) {
        console.log('📊 Using rules-based summary for document 1 (API quota reached)');
        summaryData1 = {
          key_findings: [`Document contains ${analyzedClauses1.length} clauses`, 
                        `Overall risk level: ${overallRisk1}`,
                        `High risk clauses: ${riskDistribution1.high}`,
                        `Medium risk clauses: ${riskDistribution1.medium}`,
                        `Low risk clauses: ${riskDistribution1.low}`],
          recommendations: overallRisk1 === 'High' ? 
            ['Consider legal review due to high-risk clauses', 'Pay special attention to penalty and liability clauses'] : 
            overallRisk1 === 'Medium' ?
            ['Review medium-risk clauses carefully', 'Consider professional consultation for complex terms'] :
            ['Standard contract terms detected', 'Generally acceptable risk level']
        };
      }

      doc1.analysis = {
        clauses: analyzedClauses1,
        glossary: glossary1,
        qa: [],
        summary: {
          totalClauses: analyzedClauses1.length,
          riskDistribution: riskDistribution1,
          overallRisk: overallRisk1,
          keyFindings: summaryData1.key_findings || [],
          recommendations: summaryData1.recommendations || []
        },
        analyzedAt: new Date()
      };
      doc1.status = 'analyzed';
      await doc1.save();
    } catch (error) {
      console.error('Error analyzing document 1:', error);
      doc1.status = 'failed';
      await doc1.save();
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze first document for comparison'
      });
    }
  }

  if (doc2.status !== 'analyzed') {
    console.log(`Auto-analyzing document 2: ${doc2._id}`);
    doc2.status = 'processing';
    await doc2.save();
    
    try {
      // Split document into clauses
      const clauses2 = documentProcessor.splitIntoClause(doc2.extractedText);
      
      // Analyze each clause
      const analyzedClauses2 = [];
      let currentPage2 = 1;

      for (let i = 0; i < clauses2.length; i++) {
        const clause = clauses2[i];
        try {
          const analysis = await aiAnalyzer.analyzeClause(
            clause.text,
            currentPage2,
            doc2.documentType
          );
          analyzedClauses2.push(analysis);
        } catch (error) {
          console.error(`Error analyzing clause ${i + 1} of doc2:`, error);
          analyzedClauses2.push({
            page: currentPage2,
            clause: clause.text,
            explanation: 'Unable to analyze this clause automatically.',
            risk_ai: 'Medium',
            risk_rules: 'Medium',
            final_risk: 'Medium',
            reason: 'Analysis failed',
            keywords: [],
            important_terms: []
          });
        }
        if ((i + 1) % Math.ceil(clauses2.length / (doc2.metadata.pages || 1)) === 0) {
          currentPage2++;
        }
      }

      // Build glossary and summary
      const glossary2 = aiAnalyzer.buildGlossary(analyzedClauses2);
      
      // Calculate risk distribution
      const riskDistribution2 = { low: 0, medium: 0, high: 0 };
      analyzedClauses2.forEach(clause => {
        const risk = clause.final_risk.toLowerCase();
        if (riskDistribution2.hasOwnProperty(risk)) {
          riskDistribution2[risk]++;
        }
      });

      // Determine overall risk
      let overallRisk2 = 'Low';
      if (riskDistribution2.high > 0) {
        overallRisk2 = 'High';
      } else if (riskDistribution2.medium > riskDistribution2.low) {
        overallRisk2 = 'Medium';
      }

      // Generate document summary (fallback to rules-based when AI quota exceeded)
      let summaryData2;
      try {
        console.log('🔍 Generating summary for document 2...');
        summaryData2 = await aiAnalyzer.generateDocumentSummary(
          analyzedClauses2,
          doc2.documentType
        );
      } catch (summaryError) {
        console.log('📊 Using rules-based summary for document 2 (API quota reached)');
        summaryData2 = {
          key_findings: [`Document contains ${analyzedClauses2.length} clauses`, 
                        `Overall risk level: ${overallRisk2}`,
                        `High risk clauses: ${riskDistribution2.high}`,
                        `Medium risk clauses: ${riskDistribution2.medium}`,
                        `Low risk clauses: ${riskDistribution2.low}`],
          recommendations: overallRisk2 === 'High' ? 
            ['Consider legal review due to high-risk clauses', 'Pay special attention to penalty and liability clauses'] : 
            overallRisk2 === 'Medium' ?
            ['Review medium-risk clauses carefully', 'Consider professional consultation for complex terms'] :
            ['Standard contract terms detected', 'Generally acceptable risk level']
        };
      }

      doc2.analysis = {
        clauses: analyzedClauses2,
        glossary: glossary2,
        qa: [],
        summary: {
          totalClauses: analyzedClauses2.length,
          riskDistribution: riskDistribution2,
          overallRisk: overallRisk2,
          keyFindings: summaryData2.key_findings || [],
          recommendations: summaryData2.recommendations || []
        },
        analyzedAt: new Date()
      };
      doc2.status = 'analyzed';
      await doc2.save();
    } catch (error) {
      console.error('Error analyzing document 2:', error);
      doc2.status = 'failed';
      await doc2.save();
      return res.status(500).json({
        success: false,
        message: 'Failed to analyze second document for comparison'
      });
    }
  }

  try {
    const startTime = Date.now();
    console.log('Starting document comparison...');

    // Perform enhanced comparison
    const comparison = await aiAnalyzer.compareDocuments(
      doc1.analysis,
      doc2.analysis
    );

    // Debug document content
    console.log(`Doc1 clauses count: ${doc1.analysis.clauses.length}`);
    console.log(`Doc2 clauses count: ${doc2.analysis.clauses.length}`);
    
    if (doc1.analysis.clauses.length > 0) {
      console.log(`Doc1 first clause: ${doc1.analysis.clauses[0].clause.substring(0, 100)}...`);
    }
    if (doc2.analysis.clauses.length > 0) {
      console.log(`Doc2 first clause: ${doc2.analysis.clauses[0].clause.substring(0, 100)}...`);
    }

    // Generate detailed clause-by-clause comparison
    const clauseComparison = aiAnalyzer.compareClausesDetailed(
      doc1.analysis.clauses,
      doc2.analysis.clauses
    );

    console.log(`Generated ${clauseComparison.length} clause comparisons`);

    // Generate enhanced similarities
    const detailedSimilarities = aiAnalyzer.findDetailedSimilarities(doc1, doc2);
    
    console.log('Enhanced comparison completed successfully');

    // Add document metadata to comparison
    const comparisonResult = {
      ...comparison,
      clauseByClauseComparison: clauseComparison,
      detailedSimilarities: detailedSimilarities,
      documents: {
        doc1: {
          id: doc1._id,
          title: doc1.title,
          documentType: doc1.documentType,
          overallRisk: doc1.analysis.summary.overallRisk,
          totalClauses: doc1.analysis.summary.totalClauses,
          riskDistribution: doc1.analysis.summary.riskDistribution
        },
        doc2: {
          id: doc2._id,
          title: doc2.title,
          documentType: doc2.documentType,
          overallRisk: doc2.analysis.summary.overallRisk,
          totalClauses: doc2.analysis.summary.totalClauses,
          riskDistribution: doc2.analysis.summary.riskDistribution
        }
      },
      comparisonDate: new Date(),
      processingTime: Date.now() - startTime
    };

    // Log performance
    performanceLogger('document_comparison', Date.now() - startTime, {
      doc1Id: doc1._id,
      doc2Id: doc2._id
    });

    console.log(`Comparison completed for documents: ${doc1._id} vs ${doc2._id}`);

    res.status(200).json({
      success: true,
      message: 'Documents compared successfully',
      comparison: comparisonResult
    });

  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Comparison failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}));

// @desc    Ask question about document
// @route   POST /api/analysis/qa/:documentId
// @access  Private
router.post('/qa/:documentId', [
  protect,
  body('question')
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Question must be between 5 and 500 characters')
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

  const { question } = req.body;

  const document = await Document.findOne({
    _id: req.params.documentId,
    userId: req.user._id
  });

  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  if (document.status !== 'analyzed') {
    return res.status(400).json({
      success: false,
      message: 'Document must be analyzed before asking questions'
    });
  }

  try {
    const startTime = Date.now();

    // Get previous Q&A for context
    const previousQA = document.analysis.qa || [];

    // Generate answer
    const qaResult = await aiAnalyzer.answerQuestion(
      question,
      document.extractedText,
      previousQA.slice(-5) // Last 5 Q&As for context
    );

    // Add to document's Q&A history
    document.analysis.qa.push(qaResult);
    await document.save();

    // Log performance
    performanceLogger('qa_generation', Date.now() - startTime, {
      documentId: document._id,
      questionLength: question.length
    });

    console.log(`Q&A generated for document: ${document._id}`);

    res.status(200).json({
      success: true,
      message: 'Question answered successfully',
      qa: qaResult
    });

  } catch (error) {
    console.error('Q&A error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to answer question',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}));

// @desc    Get document Q&A history
// @route   GET /api/analysis/qa/:documentId
// @access  Private
router.get('/qa/:documentId', protect, asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.documentId,
    userId: req.user._id
  }).select('analysis.qa title');

  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  res.status(200).json({
    success: true,
    qa: document.analysis?.qa || [],
    documentTitle: document.title
  });
}));

// @desc    Get analysis summary
// @route   GET /api/analysis/summary/:documentId
// @access  Private
router.get('/summary/:documentId', protect, asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.documentId,
    userId: req.user._id
  }).select('analysis.summary title documentType status');

  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  if (document.status !== 'analyzed') {
    return res.status(400).json({
      success: false,
      message: 'Document is not analyzed yet'
    });
  }

  res.status(200).json({
    success: true,
    summary: document.analysis.summary,
    documentInfo: {
      title: document.title,
      documentType: document.documentType,
      status: document.status
    }
  });
}));

// @desc    Re-analyze document
// @route   POST /api/analysis/reanalyze/:documentId
// @access  Private
router.post('/reanalyze/:documentId', [
  protect,
  analysisRateLimit
], asyncHandler(async (req, res) => {
  const document = await Document.findOne({
    _id: req.params.documentId,
    userId: req.user._id
  });

  if (!document) {
    return res.status(404).json({
      success: false,
      message: 'Document not found'
    });
  }

  // Reset analysis data
  document.analysis = {
    clauses: [],
    glossary: [],
    qa: [],
    summary: {
      totalClauses: 0,
      riskDistribution: { low: 0, medium: 0, high: 0 },
      overallRisk: 'Low',
      keyFindings: [],
      recommendations: []
    }
  };
  document.status = 'uploaded';
  await document.save();

  console.log(`Document reset for re-analysis: ${document._id}`);

  res.status(200).json({
    success: true,
    message: 'Document reset for re-analysis. Please call analyze endpoint to start analysis.'
  });
}));

// PDF Export for Comparison
router.post('/comparison/export-pdf', async (req, res) => {
  try {
    const { documentId1, documentId2, comparisonData } = req.body;

    if (!documentId1 || !documentId2 || !comparisonData) {
      return res.status(400).json({
        success: false,
        message: 'Document IDs and comparison data are required'
      });
    }

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="document-comparison-${Date.now()}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Title
    doc.fontSize(20).font('Helvetica-Bold').text('Document Comparison Report', { align: 'center' });
    doc.moveDown(2);

    // Document Information
    doc.fontSize(16).font('Helvetica-Bold').text('Document Information');
    doc.fontSize(12).font('Helvetica');
    doc.text(`Document 1: ${comparisonData.documents.doc1.title}`);
    doc.text(`Type: ${comparisonData.documents.doc1.documentType}`);
    doc.text(`Overall Risk: ${comparisonData.documents.doc1.overallRisk}`);
    doc.text(`Total Clauses: ${comparisonData.documents.doc1.totalClauses}`);
    doc.moveDown();

    doc.text(`Document 2: ${comparisonData.documents.doc2.title}`);
    doc.text(`Type: ${comparisonData.documents.doc2.documentType}`);
    doc.text(`Overall Risk: ${comparisonData.documents.doc2.overallRisk}`);
    doc.text(`Total Clauses: ${comparisonData.documents.doc2.totalClauses}`);
    doc.moveDown(2);

    // Similarities Section
    if (comparisonData.detailedSimilarities && comparisonData.detailedSimilarities.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('Similarities');
      doc.fontSize(12).font('Helvetica');
      comparisonData.detailedSimilarities.forEach(similarity => {
        doc.text(`• ${similarity}`);
      });
      doc.moveDown(2);
    }

    // Clause-by-Clause Comparison
    if (comparisonData.clauseByClauseComparison && comparisonData.clauseByClauseComparison.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('Clause-by-Clause Comparison');
      doc.moveDown();

      comparisonData.clauseByClauseComparison.forEach((comparison, index) => {
        if (doc.y > 700) { // Add new page if needed
          doc.addPage();
        }

        doc.fontSize(14).font('Helvetica-Bold').text(`${comparison.clauseType}`);
        doc.fontSize(10).font('Helvetica');
        
        // Risk indicator
        const riskColor = comparison.overallRisk === 'High' ? 'red' : 
                         comparison.overallRisk === 'Medium' ? 'orange' : 'green';
        doc.fillColor(riskColor).text(`Risk Level: ${comparison.overallRisk}`, { continued: false });
        doc.fillColor('black');

        if (comparison.doc1) {
          doc.text(`Document 1: ${comparison.doc1.text}`);
        } else {
          doc.text('Document 1: Not present');
        }

        if (comparison.doc2) {
          doc.text(`Document 2: ${comparison.doc2.text}`);
        } else {
          doc.text('Document 2: Not present');
        }

        doc.text(`Difference: ${comparison.difference}`);
        doc.text(`Plain English: ${comparison.plainEnglish}`);
        doc.moveDown();
      });
    }

    // Key Differences
    if (comparisonData.differences && comparisonData.differences.length > 0) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('Key Differences');
      doc.fontSize(12).font('Helvetica');
      comparisonData.differences.forEach(difference => {
        doc.text(`• ${difference}`);
      });
      doc.moveDown(2);
    }

    // Recommendations
    if (comparisonData.recommendations && comparisonData.recommendations.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('Recommendations');
      doc.fontSize(12).font('Helvetica');
      comparisonData.recommendations.forEach(recommendation => {
        doc.text(`• ${recommendation}`);
      });
    }

    // Footer
    doc.fontSize(10).font('Helvetica').text(
      `Generated on ${new Date().toLocaleDateString()} by LegalEase`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    );

    doc.end();

  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF export'
    });
  }
});

module.exports = router;
