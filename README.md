# LegalEase - Legal Document Analysis Platform

LegalEase is a full-stack MERN web application that simplifies and analyzes multi-page legal documents (rental agreements, loan contracts, terms of service) for everyday citizens and small business owners.

##  Problem & Objective

Legal contracts are long, filled with jargon, and boring to read. Most users skip them, which creates legal and financial risks.

**Objective:**
- Make contracts engaging, easy-to-read, and attractive
- Provide clause-by-clause explanations with AI + rule-based risk checks
- Enable comparison, glossary, chatbot, history, and PDF download
- Ensure security, privacy, login + logout flow

##  Features

- **Authentication**: User registration/login with MongoDB + JWT
- **Document Upload & Processing**: Accept multi-page PDFs or scanned images with OCR
- **AI Analysis**: Gemini API + rules engine for risk assessment
- **Comparison Mode**: Side-by-side contract comparison
- **Interactive Features**: Glossary, Q&A chatbot, history tracking
- **Security**: AES-256 encryption for document storage

##  Tech Stack

- **Frontend**: React.js + Tailwind CSS
- **Backend**: Node.js + Express.js
- **Database**: MongoDB
- **Authentication**: JWT
- **AI**: Google Gemini API
- **OCR**: Tesseract.js + pdf-parse
- **Security**: AES-256 encryption

##  Project Structure

```
LegalEase/
├── backend/          # Node.js + Express API
├── frontend/         # React.js application
├── README.md
└── package.json      # Root package.json for scripts
```

##  Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB
- Google Gemini API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` in the backend directory
   - Add your MongoDB URI and Gemini API key

4. Start the development servers:
   ```bash
   npm run dev
   ```

##  Disclaimer

This is not legal advice, only a simplified explanation. Consult a lawyer for binding advice.

##  License

MIT License


