# LegalEase API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### Authentication

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "subscription": {
      "type": "free",
      "documentsLimit": 5
    }
  }
}
```

#### POST /auth/login
Login with existing credentials.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

#### POST /auth/logout
Logout current user (requires authentication).

#### GET /auth/me
Get current user information (requires authentication).

### Documents

#### POST /documents/upload
Upload a single document for analysis.

**Headers:**
- `Content-Type: multipart/form-data`
- `Authorization: Bearer <token>`

**Form Data:**
- `document`: File (PDF or image)
- `title`: String (optional)

**Response:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "document": {
    "id": "document_id",
    "title": "Contract.pdf",
    "fileType": "pdf",
    "documentType": "rental_agreement",
    "status": "uploaded"
  }
}
```

#### POST /documents/upload-compare
Upload two documents for comparison.

**Form Data:**
- `documents`: Array of 2 files

#### GET /documents
Get user's documents with pagination and filters.

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (default: 10)
- `status`: String (uploaded|processing|analyzed|failed)
- `documentType`: String
- `search`: String

#### GET /documents/:id
Get specific document details.

#### PUT /documents/:id
Update document metadata.

#### DELETE /documents/:id
Delete a document.

### Analysis

#### POST /analysis/analyze/:documentId
Start analysis of a document.

**Response:**
```json
{
  "success": true,
  "message": "Document analyzed successfully",
  "analysis": {
    "clauses": [
      {
        "page": 1,
        "clause": "Original clause text...",
        "explanation": "Plain English explanation...",
        "risk_ai": "Medium",
        "risk_rules": "High",
        "final_risk": "High",
        "reason": "Contains penalty clauses",
        "keywords": ["penalty", "late fee"]
      }
    ],
    "glossary": [
      {
        "term": "Collateral",
        "meaning": "Asset pledged as security for a loan",
        "category": "legal"
      }
    ],
    "summary": {
      "totalClauses": 15,
      "riskDistribution": {
        "low": 8,
        "medium": 5,
        "high": 2
      },
      "overallRisk": "Medium",
      "keyFindings": ["High penalty fees", "Short notice period"],
      "recommendations": ["Negotiate penalty terms", "Review notice requirements"]
    }
  }
}
```

#### POST /analysis/compare
Compare two analyzed documents.

**Request Body:**
```json
{
  "documentId1": "doc1_id",
  "documentId2": "doc2_id"
}
```

#### POST /analysis/qa/:documentId
Ask a question about a document.

**Request Body:**
```json
{
  "question": "What are the penalties for late payment?"
}
```

**Response:**
```json
{
  "success": true,
  "qa": {
    "question": "What are the penalties for late payment?",
    "answer": "According to the contract, late payments incur a 5% penalty fee...",
    "confidence": 0.85,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### GET /analysis/qa/:documentId
Get Q&A history for a document.

### Users

#### GET /users/dashboard
Get dashboard data including statistics and recent documents.

#### GET /users/activity
Get user activity history.

#### PUT /users/preferences
Update user preferences.

#### GET /users/subscription
Get subscription information.

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

## Rate Limits

- Authentication endpoints: 5 requests per 15 minutes
- File upload: 10 uploads per hour
- Analysis: 20 analyses per hour
- General API: 100 requests per 15 minutes

## File Upload Limits

- Maximum file size: 10MB
- Supported formats: PDF, PNG, JPG, JPEG, BMP, TIFF, WEBP
- Maximum 2 files for comparison

## Security Features

- JWT authentication with 7-day expiration
- AES-256 encryption for document storage
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS protection
- Helmet security headers

## WebSocket Events (Future Enhancement)

For real-time updates during document processing:

```javascript
// Connect to WebSocket
const socket = io('http://localhost:5000');

// Listen for analysis progress
socket.on('analysis_progress', (data) => {
  console.log(`Progress: ${data.progress}%`);
});

// Listen for analysis completion
socket.on('analysis_complete', (data) => {
  console.log('Analysis completed:', data.documentId);
});
```
