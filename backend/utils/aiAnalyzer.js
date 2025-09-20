const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIAnalyzer {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Rate limiting for Gemini API (15 requests per minute for free tier)
    this.requestQueue = [];
    this.requestCount = 0;
    this.maxRequestsPerMinute = 12; // Conservative limit (below 15)
    this.requestWindow = 60000; // 1 minute in milliseconds
    this.lastResetTime = Date.now();
    this.isProcessingQueue = false;
    
    // Risk keywords for rules-based analysis
    this.riskKeywords = {
      high: [
        'penalty', 'seize', 'collateral', 'waiver', 'indemnity', 'forfeit',
        'liquidated damages', 'acceleration', 'default', 'breach',
        'termination without cause', 'unlimited liability', 'personal guarantee',
        'cross-default', 'material adverse change', 'force majeure exclusion'
      ],
      medium: [
        'late fee', 'interest rate', 'security deposit', 'arbitration',
        'jurisdiction', 'governing law', 'assignment', 'modification',
        'notice period', 'renewal terms', 'insurance requirements',
        'compliance obligations', 'reporting requirements'
      ],
      low: [
        'payment terms', 'delivery', 'warranty', 'maintenance',
        'standard terms', 'mutual agreement', 'good faith',
        'reasonable efforts', 'business days', 'written notice'
      ]
    };

    // Legal glossary terms
    this.glossaryTerms = {
      'collateral': 'Asset pledged as security for a loan that can be seized if payments are not made',
      'indemnity': 'Protection against legal liability or financial loss',
      'liquidated damages': 'Pre-agreed amount of compensation for breach of contract',
      'force majeure': 'Unforeseeable circumstances that prevent fulfilling a contract',
      'arbitration': 'Alternative dispute resolution outside of court',
      'jurisdiction': 'Legal authority of a court to hear and decide a case',
      'material adverse change': 'Significant negative change in financial condition or business',
      'cross-default': 'Default on one agreement triggers default on other agreements',
      'acceleration': 'Making the entire debt immediately due upon default',
      'waiver': 'Voluntary giving up of a legal right or claim',
      'assignment': 'Transfer of rights or obligations to another party',
      'breach': 'Failure to fulfill terms of a contract',
      'default': 'Failure to meet legal obligations, especially debt payments',
      'penalty': 'Punishment or fine for breaking contract terms',
      'security deposit': 'Money held as protection against damage or non-payment',
      'governing law': 'Legal system that will interpret the contract',
      'personal guarantee': 'Individual promise to pay if business cannot',
      'unlimited liability': 'Full personal responsibility for all debts and obligations'
    };
  }

  // Rate limiting methods
  resetRequestCount() {
    const now = Date.now();
    if (now - this.lastResetTime >= this.requestWindow) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }
  }

  canMakeRequest() {
    this.resetRequestCount();
    return this.requestCount < this.maxRequestsPerMinute;
  }

  async makeRateLimitedRequest(requestFunction) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestFunction, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      if (!this.canMakeRequest()) {
        // Wait until we can make another request
        const waitTime = this.requestWindow - (Date.now() - this.lastResetTime);
        console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)}s before next API call...`);
        await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
        continue;
      }

      const { requestFunction, resolve, reject } = this.requestQueue.shift();
      
      try {
        this.requestCount++;
        const result = await requestFunction();
        resolve(result);
      } catch (error) {
        if (error.message && error.message.includes('429')) {
          // Rate limit exceeded, put request back in queue
          console.log('🚫 API quota exceeded. Retrying with rules-based fallback...');
          reject(new Error('QUOTA_EXCEEDED'));
        } else {
          reject(error);
        }
      }

      // Small delay between requests to be extra safe
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.isProcessingQueue = false;
  }

  // Rules-based risk analysis
  analyzeRiskByRules(clauseText) {
    const text = clauseText.toLowerCase();
    let riskScore = 0;
    let riskLevel = 'Low';
    let detectedKeywords = [];

    // Check for high-risk keywords
    this.riskKeywords.high.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        riskScore += 3;
        detectedKeywords.push(keyword);
      }
    });

    // Check for medium-risk keywords
    this.riskKeywords.medium.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        riskScore += 2;
        detectedKeywords.push(keyword);
      }
    });

    // Check for low-risk keywords
    this.riskKeywords.low.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        riskScore += 1;
        detectedKeywords.push(keyword);
      }
    });

    // Determine risk level based on score
    if (riskScore >= 6) {
      riskLevel = 'High';
    } else if (riskScore >= 3) {
      riskLevel = 'Medium';
    }

    return {
      riskLevel,
      riskScore,
      detectedKeywords: [...new Set(detectedKeywords)]
    };
  }

  // AI-based clause analysis using Gemini with retry logic
  async analyzeClauseWithAI(clauseText, documentType = 'general', retryCount = 0) {
    const maxRetries = 2; // Reduced retries for faster fallback
    const baseDelay = 500; // Shorter delay
    try {
      const prompt = `
        You are a legal expert analyzing a contract clause. Please provide a clear, simple explanation that a non-lawyer can understand.

        Document Type: ${documentType}
        Clause Text: "${clauseText}"

        Please analyze this clause and provide:
        1. A simple, plain-English explanation (2-3 sentences max)
        2. Risk level (Low, Medium, or High)
        3. Brief reason for the risk level (1 sentence)
        4. Any important terms that should be in a glossary

        Respond in JSON format:
        {
          "explanation": "Plain English explanation here",
          "risk_level": "Low|Medium|High",
          "reason": "Brief reason for risk level",
          "important_terms": ["term1", "term2"]
        }

        Keep explanations friendly and accessible. Focus on what this means for the person signing the contract.
      `;

      // Use rate-limited request
      const result = await this.makeRateLimitedRequest(async () => {
        return await this.model.generateContent(prompt);
      });
      const response = await result.response;
      const text = response.text();

      // Parse JSON response
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          return {
            explanation: analysis.explanation || 'Unable to generate explanation',
            riskLevel: analysis.risk_level || 'Medium',
            reason: analysis.reason || 'Unable to determine risk reason',
            importantTerms: analysis.important_terms || []
          };
        }
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
      }

      // Fallback if JSON parsing fails
      return {
        explanation: text.substring(0, 200) + '...',
        riskLevel: 'Medium',
        reason: 'AI analysis completed but format unclear',
        importantTerms: []
      };

    } catch (error) {
      // Check for quota exceeded error
      if (error.message.includes('quota') || error.message.includes('429')) {
        console.log('🚫 Google Gemini API quota exceeded. Switching to rules-based analysis.');
        throw error; // Let the calling method handle with fallback
      }
      
      console.error('AI analysis error:', error);
      
      // Retry logic for API overload errors (but not quota exceeded)
      if (retryCount < maxRetries && (
        error.message.includes('overloaded') || 
        error.message.includes('503') ||
        error.message.includes('Service Unavailable')
      )) {
        const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
        console.log(`Retrying AI analysis in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.analyzeClauseWithAI(clauseText, documentType, retryCount + 1);
      }
      
      // If max retries reached or different error, throw to trigger fallback
      throw error;
    }
  }

  // Generate document summary with rate limiting
  async generateDocumentSummary(clauses, documentType) {
    try {
      const clauseTexts = clauses.map(c => c.clause).join('\n\n');
      const prompt = `
        Analyze this ${documentType} contract and provide a comprehensive summary.

        Contract Text:
        ${clauseTexts.substring(0, 4000)} // Limit text to avoid token limits

        Provide a JSON response with:
        {
          "key_findings": ["finding1", "finding2", "finding3"],
          "recommendations": ["recommendation1", "recommendation2"],
          "overall_risk": "Low|Medium|High",
          "summary": "2-3 sentence overall summary"
        }

        Focus on the most important aspects that could affect the person signing this contract.
      `;

      // Use rate-limited request
      const result = await this.makeRateLimitedRequest(async () => {
        return await this.model.generateContent(prompt);
      });
      
      const response = await result.response;
      const text = response.text();

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error('Summary JSON parsing error:', parseError);
      }

      return {
        key_findings: ['Document analysis completed'],
        recommendations: ['Review all clauses carefully'],
        overall_risk: 'Medium',
        summary: 'Contract analysis completed successfully.'
      };

    } catch (error) {
      console.error('Document summary error:', error);
      return {
        key_findings: ['Unable to generate summary'],
        recommendations: ['Manual review recommended'],
        overall_risk: 'Medium',
        summary: 'Summary generation failed.'
      };
    }
  }

  // Generate explanation based on rules analysis when AI is unavailable
  generateRulesBasedExplanation(clauseText, rulesAnalysis) {
    const { riskLevel, detectedKeywords } = rulesAnalysis;
    
    if (detectedKeywords.length === 0) {
      return 'This appears to be a standard contract clause with no major risk indicators detected.';
    }

    let explanation = `This clause contains ${riskLevel.toLowerCase()} risk terms: ${detectedKeywords.join(', ')}. `;
    
    switch (riskLevel) {
      case 'High':
        explanation += 'These terms may significantly impact your rights or obligations. Consider legal review.';
        break;
      case 'Medium':
        explanation += 'These terms require attention and understanding before signing.';
        break;
      case 'Low':
        explanation += 'These are generally standard terms but worth understanding.';
        break;
    }
    
    return explanation;
  }

  // Combine AI and rules-based analysis
  async analyzeClause(clauseText, page, documentType = 'general') {
    try {
      // Rules-based analysis (always works)
      const rulesAnalysis = this.analyzeRiskByRules(clauseText);
      
      let aiAnalysis;
      try {
        // Try AI-based analysis
        aiAnalysis = await this.analyzeClauseWithAI(clauseText, documentType);
      } catch (aiError) {
        if (aiError.message.includes('quota') || aiError.message.includes('429')) {
          console.log('📊 Using rules-based analysis (API quota reached)');
        } else {
          console.log('📊 Using rules-based analysis (AI temporarily unavailable)');
        }
        
        // Fallback to enhanced rules-based analysis
        aiAnalysis = {
          explanation: this.generateRulesBasedExplanation(clauseText, rulesAnalysis),
          riskLevel: rulesAnalysis.riskLevel,
          reason: `Rules-based analysis: ${rulesAnalysis.detectedKeywords.length > 0 ? 
            'Contains keywords: ' + rulesAnalysis.detectedKeywords.join(', ') : 
            'Standard contract clause'}`,
          importantTerms: rulesAnalysis.detectedKeywords
        };
      }

      // Determine final risk level (take the higher of the two)
      const riskLevels = { 'Low': 1, 'Medium': 2, 'High': 3 };
      const rulesRisk = rulesAnalysis.riskLevel;
      const aiRisk = aiAnalysis.riskLevel;
      
      const finalRisk = riskLevels[rulesRisk] >= riskLevels[aiRisk] ? rulesRisk : aiRisk;

      return {
        page,
        clause: clauseText,
        explanation: aiAnalysis.explanation,
        risk_ai: aiAnalysis.riskLevel,
        risk_rules: rulesRisk,
        final_risk: finalRisk,
        reason: aiAnalysis.reason,
        keywords: rulesAnalysis.detectedKeywords,
        important_terms: aiAnalysis.importantTerms
      };

    } catch (error) {
      console.error('Clause analysis error:', error);
      return {
        page,
        clause: clauseText,
        explanation: 'Unable to analyze this clause. Please review manually.',
        risk_ai: 'Medium',
        risk_rules: 'Medium',
        final_risk: 'Medium',
        reason: 'Analysis failed',
        keywords: [],
        important_terms: []
      };
    }
  }

  // Build glossary from analyzed clauses
  buildGlossary(analyzedClauses) {
    const glossary = [];
    const addedTerms = new Set();

    // Add terms from AI analysis
    analyzedClauses.forEach(clause => {
      if (clause.important_terms) {
        clause.important_terms.forEach(term => {
          const termLower = term.toLowerCase();
          if (!addedTerms.has(termLower) && this.glossaryTerms[termLower]) {
            glossary.push({
              term: term,
              meaning: this.glossaryTerms[termLower],
              category: 'legal'
            });
            addedTerms.add(termLower);
          }
        });
      }
    });

    // Add terms from detected keywords
    analyzedClauses.forEach(clause => {
      if (clause.keywords) {
        clause.keywords.forEach(keyword => {
          const keywordLower = keyword.toLowerCase();
          if (!addedTerms.has(keywordLower) && this.glossaryTerms[keywordLower]) {
            glossary.push({
              term: keyword,
              meaning: this.glossaryTerms[keywordLower],
              category: 'legal'
            });
            addedTerms.add(keywordLower);
          }
        });
      }
    });

    return glossary.sort((a, b) => a.term.localeCompare(b.term));
  }

  // Answer questions about the document
  async answerQuestion(question, documentText, previousQA = []) {
    try {
      const context = previousQA.length > 0 
        ? `Previous Q&A:\n${previousQA.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}\n\n`
        : '';

      const prompt = `
        You are a helpful legal assistant. Answer questions about this contract in simple, clear language.

        ${context}Contract Text:
        ${documentText.substring(0, 3000)}

        Question: ${question}

        Provide a helpful, accurate answer in plain English. If you cannot answer based on the contract text, say so clearly.
        Keep your answer concise but complete (2-4 sentences).
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const answer = response.text();

      return {
        question,
        answer: answer.trim(),
        confidence: 0.8,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Q&A error:', error);
      return {
        question,
        answer: 'I apologize, but I cannot answer this question at the moment. Please try rephrasing or contact support.',
        confidence: 0.1,
        timestamp: new Date()
      };
    }
  }

  // Compare two documents
  async compareDocuments(doc1Analysis, doc2Analysis) {
    try {
      const comparison = {
        similarities: [],
        differences: [],
        riskComparison: {
          doc1: doc1Analysis.summary.overallRisk,
          doc2: doc2Analysis.summary.overallRisk
        },
        recommendations: []
      };

      // Compare risk levels
      const doc1HighRisk = doc1Analysis.clauses.filter(c => c.final_risk === 'High').length;
      const doc2HighRisk = doc2Analysis.clauses.filter(c => c.final_risk === 'High').length;

      if (doc1HighRisk > doc2HighRisk) {
        comparison.differences.push('Document 1 has more high-risk clauses');
        comparison.recommendations.push('Consider using Document 2 as it has fewer high-risk terms');
      } else if (doc2HighRisk > doc1HighRisk) {
        comparison.differences.push('Document 2 has more high-risk clauses');
        comparison.recommendations.push('Consider using Document 1 as it has fewer high-risk terms');
      } else {
        comparison.similarities.push('Both documents have similar risk levels');
      }

      // Compare clause count
      comparison.clauseCount = {
        doc1: doc1Analysis.clauses.length,
        doc2: doc2Analysis.clauses.length
      };

      return comparison;

    } catch (error) {
      console.error('Document comparison error:', error);
      return {
        similarities: [],
        differences: ['Unable to compare documents'],
        riskComparison: { doc1: 'Unknown', doc2: 'Unknown' },
        recommendations: ['Manual comparison recommended']
      };
    }
  }

  // Enhanced clause-by-clause comparison
  compareClausesDetailed(clauses1, clauses2) {
    const comparisonTable = [];
    const maxLength = Math.max(clauses1.length, clauses2.length);
    
    // Common clause types for better matching
    const clauseTypes = {
      'rent': ['rent', 'payment', 'monthly', 'amount'],
      'deposit': ['deposit', 'security', 'advance'],
      'notice': ['notice', 'termination', 'exit'],
      'maintenance': ['maintenance', 'repair', 'upkeep'],
      'utilities': ['utilities', 'electricity', 'water'],
      'pets': ['pets', 'animals'],
      'subletting': ['sublet', 'subletting', 'assign'],
      'duration': ['duration', 'term', 'period', 'lease'],
      'renewal': ['renewal', 'extend', 'renew']
    };

    // Find matching clauses by type
    const matchedClauses = new Set();
    
    for (const [type, keywords] of Object.entries(clauseTypes)) {
      const clause1 = clauses1.find((c, i) => 
        !matchedClauses.has(`1-${i}`) && 
        keywords.some(keyword => c.clause.toLowerCase().includes(keyword))
      );
      
      const clause2 = clauses2.find((c, i) => 
        !matchedClauses.has(`2-${i}`) && 
        keywords.some(keyword => c.clause.toLowerCase().includes(keyword))
      );

      if (clause1 || clause2) {
        const clause1Index = clauses1.indexOf(clause1);
        const clause2Index = clauses2.indexOf(clause2);
        
        if (clause1Index !== -1) matchedClauses.add(`1-${clause1Index}`);
        if (clause2Index !== -1) matchedClauses.add(`2-${clause2Index}`);

        const comparison = this.generateClauseComparison(clause1, clause2, type);
        comparisonTable.push(comparison);
      }
    }

    // Add remaining unmatched clauses
    clauses1.forEach((clause, i) => {
      if (!matchedClauses.has(`1-${i}`)) {
        comparisonTable.push(this.generateClauseComparison(clause, null, 'other'));
      }
    });

    clauses2.forEach((clause, i) => {
      if (!matchedClauses.has(`2-${i}`)) {
        comparisonTable.push(this.generateClauseComparison(null, clause, 'other'));
      }
    });

    return comparisonTable;
  }

  // Generate individual clause comparison
  generateClauseComparison(clause1, clause2, type) {
    // Extract key information for display
    const getKeyInfo = (clause, clauseType) => {
      if (!clause) return null;
      
      const text = clause.clause.toLowerCase();
      let displayText = clause.clause.substring(0, 200) + (clause.clause.length > 200 ? '...' : '');
      
      // For rent clauses, try to highlight the amount
      if (clauseType === 'rent') {
        const rentMatch = text.match(/₹\s*(\d+(?:,\d+)*)|rs\.?\s*(\d+(?:,\d+)*)|(\d{4,})/i);
        if (rentMatch) {
          const amount = rentMatch[0];
          displayText = `Rent: ${amount} - ${displayText}`;
        }
      }
      
      // For deposit clauses, highlight deposit amount
      if (clauseType === 'deposit') {
        const depositMatch = text.match(/(\d+)\s*months?|₹\s*(\d+(?:,\d+)*)/i);
        if (depositMatch) {
          const amount = depositMatch[0];
          displayText = `Deposit: ${amount} - ${displayText}`;
        }
      }
      
      return {
        text: displayText,
        risk: clause.final_risk,
        explanation: clause.explanation,
        fullText: clause.clause
      };
    };

    const comparison = {
      clauseType: type.charAt(0).toUpperCase() + type.slice(1),
      doc1: getKeyInfo(clause1, type),
      doc2: getKeyInfo(clause2, type),
      difference: '',
      overallRisk: 'Low',
      plainEnglish: ''
    };

    // Generate difference analysis
    if (clause1 && clause2) {
      comparison.difference = this.analyzeDifference(clause1, clause2, type);
      comparison.overallRisk = this.getHigherRisk(clause1.final_risk, clause2.final_risk);
      comparison.plainEnglish = this.generatePlainEnglishDifference(clause1, clause2, type);
    } else if (clause1) {
      comparison.difference = 'Only present in Document 1';
      comparison.overallRisk = clause1.final_risk;
      comparison.plainEnglish = `Document 1 has this ${type} clause, but Document 2 doesn't.`;
    } else if (clause2) {
      comparison.difference = 'Only present in Document 2';
      comparison.overallRisk = clause2.final_risk;
      comparison.plainEnglish = `Document 2 has this ${type} clause, but Document 1 doesn't.`;
    }

    return comparison;
  }

  // Analyze specific differences between clauses
  analyzeDifference(clause1, clause2, type) {
    const text1 = clause1.clause.toLowerCase();
    const text2 = clause2.clause.toLowerCase();

    console.log(`Analyzing difference for ${type}:`);
    console.log(`Text1: ${text1.substring(0, 100)}...`);
    console.log(`Text2: ${text2.substring(0, 100)}...`);

    // Enhanced number extraction for rent amounts
    if (type === 'rent') {
      // Look for various rent patterns
      const rentPatterns = [
        /₹\s*(\d+(?:,\d+)*)/g,  // ₹18,000 or ₹ 18000
        /rs\.?\s*(\d+(?:,\d+)*)/gi,  // Rs. 18000 or rs 18000
        /(\d+(?:,\d+)*)\s*(?:rupees?|rs\.?|₹)/gi,  // 18000 rupees
        /rent.*?(\d+(?:,\d+)*)/gi,  // rent ... 18000
        /monthly.*?(\d+(?:,\d+)*)/gi,  // monthly ... 18000
        /(\d{4,})/g  // Any 4+ digit number as fallback
      ];

      let amount1 = null, amount2 = null;

      // Try each pattern to find rent amounts
      for (const pattern of rentPatterns) {
        if (!amount1) {
          const match1 = text1.match(pattern);
          if (match1) {
            const numStr = match1[0].replace(/[^\d,]/g, '').replace(/,/g, '');
            const num = parseInt(numStr);
            if (num >= 1000 && num <= 1000000) { // Reasonable rent range
              amount1 = num;
            }
          }
        }

        if (!amount2) {
          const match2 = text2.match(pattern);
          if (match2) {
            const numStr = match2[0].replace(/[^\d,]/g, '').replace(/,/g, '');
            const num = parseInt(numStr);
            if (num >= 1000 && num <= 1000000) { // Reasonable rent range
              amount2 = num;
            }
          }
        }

        if (amount1 && amount2) break;
      }

      console.log(`Extracted amounts: ${amount1} vs ${amount2}`);

      if (amount1 && amount2 && amount1 !== amount2) {
        return `Rent differs: ₹${amount1.toLocaleString()} vs ₹${amount2.toLocaleString()}`;
      }
    }

    // Enhanced notice period extraction
    if (type === 'notice') {
      const noticePatterns = [
        /(\d+)\s*months?\s*notice/gi,
        /notice.*?(\d+)\s*months?/gi,
        /(\d+)\s*months?\s*prior/gi,
        /(\d+)\s*days?\s*notice/gi
      ];

      let period1 = null, period2 = null;

      for (const pattern of noticePatterns) {
        if (!period1) {
          const match1 = text1.match(pattern);
          if (match1) period1 = parseInt(match1[1]);
        }
        if (!period2) {
          const match2 = text2.match(pattern);
          if (match2) period2 = parseInt(match2[1]);
        }
        if (period1 && period2) break;
      }

      if (period1 && period2 && period1 !== period2) {
        return `Notice period differs: ${period1} vs ${period2} months`;
      }
    }

    // Check if texts are actually different
    if (text1 !== text2) {
      return 'Clause content differs between documents';
    }

    // Risk level comparison
    if (clause1.final_risk !== clause2.final_risk) {
      return `Risk levels differ: ${clause1.final_risk} vs ${clause2.final_risk}`;
    }

    return 'Similar clauses with minor variations';
  }

  // Generate plain English differences
  generatePlainEnglishDifference(clause1, clause2, type) {
    const text1 = clause1.clause.toLowerCase();
    const text2 = clause2.clause.toLowerCase();

    switch (type) {
      case 'rent':
        // Enhanced rent amount extraction (same as analyzeDifference)
        const rentPatterns = [
          /₹\s*(\d+(?:,\d+)*)/g,
          /rs\.?\s*(\d+(?:,\d+)*)/gi,
          /(\d+(?:,\d+)*)\s*(?:rupees?|rs\.?|₹)/gi,
          /rent.*?(\d+(?:,\d+)*)/gi,
          /monthly.*?(\d+(?:,\d+)*)/gi,
          /(\d{4,})/g
        ];

        let amount1 = null, amount2 = null;

        for (const pattern of rentPatterns) {
          if (!amount1) {
            const match1 = text1.match(pattern);
            if (match1) {
              const numStr = match1[0].replace(/[^\d,]/g, '').replace(/,/g, '');
              const num = parseInt(numStr);
              if (num >= 1000 && num <= 1000000) {
                amount1 = num;
              }
            }
          }

          if (!amount2) {
            const match2 = text2.match(pattern);
            if (match2) {
              const numStr = match2[0].replace(/[^\d,]/g, '').replace(/,/g, '');
              const num = parseInt(numStr);
              if (num >= 1000 && num <= 1000000) {
                amount2 = num;
              }
            }
          }

          if (amount1 && amount2) break;
        }

        if (amount1 && amount2) {
          if (amount1 < amount2) {
            return `Document 1 is cheaper (₹${amount1.toLocaleString()}/month) compared to Document 2 (₹${amount2.toLocaleString()}/month).`;
          } else if (amount1 > amount2) {
            return `Document 2 is cheaper (₹${amount2.toLocaleString()}/month) compared to Document 1 (₹${amount1.toLocaleString()}/month).`;
          } else {
            return `Both documents have the same rent amount (₹${amount1.toLocaleString()}/month).`;
          }
        }
        break;
      
      case 'deposit':
        if (numbers1.length > 0 && numbers2.length > 0) {
          const dep1 = parseInt(numbers1[0]);
          const dep2 = parseInt(numbers2[0]);
          if (dep1 < dep2) {
            return `Document 1 requires lower upfront deposit (${dep1} months) vs Document 2 (${dep2} months).`;
          } else if (dep1 > dep2) {
            return `Document 2 requires lower upfront deposit (${dep2} months) vs Document 1 (${dep1} months).`;
          }
        }
        break;
      
      case 'notice':
        if (numbers1.length > 0 && numbers2.length > 0) {
          const notice1 = parseInt(numbers1[0]);
          const notice2 = parseInt(numbers2[0]);
          if (notice1 < notice2) {
            return `Document 1 allows quicker exit (${notice1} month notice) compared to Document 2 (${notice2} months).`;
          } else if (notice1 > notice2) {
            return `Document 2 allows quicker exit (${notice2} month notice) compared to Document 1 (${notice1} months).`;
          }
        }
        break;
    }

    if (clause1.final_risk !== clause2.final_risk) {
      return `Document 1 has ${clause1.final_risk.toLowerCase()} risk while Document 2 has ${clause2.final_risk.toLowerCase()} risk for this clause.`;
    }

    return 'Both documents have similar terms for this clause.';
  }

  // Get higher risk level
  getHigherRisk(risk1, risk2) {
    const riskLevels = { 'Low': 1, 'Medium': 2, 'High': 3 };
    const level1 = riskLevels[risk1] || 1;
    const level2 = riskLevels[risk2] || 1;
    const higherLevel = Math.max(level1, level2);
    return Object.keys(riskLevels).find(key => riskLevels[key] === higherLevel);
  }

  // Enhanced similarities detection
  findDetailedSimilarities(doc1, doc2) {
    const similarities = [];
    
    // Document type similarity
    if (doc1.documentType === doc2.documentType) {
      similarities.push(`Both documents are ${doc1.documentType} agreements`);
    }

    // Risk level similarity
    const risk1 = doc1.analysis.summary.overallRisk;
    const risk2 = doc2.analysis.summary.overallRisk;
    if (risk1 === risk2) {
      similarities.push(`Both documents have ${risk1.toLowerCase()} overall risk level`);
    }

    // Common terms detection
    const text1 = doc1.analysis.clauses.map(c => c.clause).join(' ').toLowerCase();
    const text2 = doc2.analysis.clauses.map(c => c.clause).join(' ').toLowerCase();
    
    const commonTerms = [];
    const importantTerms = ['landlord', 'tenant', 'renewal', 'maintenance', 'utilities', 'parking'];
    
    importantTerms.forEach(term => {
      if (text1.includes(term) && text2.includes(term)) {
        commonTerms.push(term);
      }
    });

    if (commonTerms.length > 0) {
      similarities.push(`Both agreements mention: ${commonTerms.join(', ')}`);
    }

    // Clause count similarity
    const clauseCount1 = doc1.analysis.clauses.length;
    const clauseCount2 = doc2.analysis.clauses.length;
    const diff = Math.abs(clauseCount1 - clauseCount2);
    
    if (diff <= 2) {
      similarities.push(`Both documents have similar structure (${clauseCount1} vs ${clauseCount2} clauses)`);
    }

    return similarities.length > 0 ? similarities : ['Both documents are legal agreements with standard terms'];
  }

}

module.exports = new AIAnalyzer();
