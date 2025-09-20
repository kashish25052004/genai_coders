# LegalEase Setup Guide

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Google Gemini API key

## Installation Steps

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Environment Configuration

#### Backend Configuration
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your configuration:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/legalease

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# Encryption (generate a secure key)
AES_SECRET_KEY=your_generated_32_byte_base64_key_here

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

#### Frontend Configuration
```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

### 3. Generate Encryption Key

Run this Node.js script to generate a secure encryption key:

```javascript
const crypto = require('crypto');
const key = crypto.randomBytes(32).toString('base64');
console.log('AES_SECRET_KEY=' + key);
```

### 4. Database Setup

Make sure MongoDB is running:
```bash
# If using local MongoDB
mongod

# Or start MongoDB service
sudo systemctl start mongod  # Linux
brew services start mongodb  # macOS
```

### 5. Start the Application

#### Development Mode (both servers)
```bash
# From root directory
npm run dev
```

#### Or start individually

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm start
```

## API Keys Setup

### Google Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `backend/.env` file as `GEMINI_API_KEY`

## Default Ports

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/api/health

## Demo Account

For testing purposes, you can create a demo account:
- Email: demo@legalease.com
- Password: Demo123!

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in `.env`

2. **Gemini API Errors**
   - Verify API key is correct
   - Check API quotas and limits

3. **File Upload Issues**
   - Ensure `uploads` directory exists in backend
   - Check file size limits (default 10MB)

4. **CORS Errors**
   - Verify `FRONTEND_URL` in backend `.env`
   - Check proxy setting in frontend `package.json`

### Development Tips

1. **Hot Reload**: Both frontend and backend support hot reload
2. **API Testing**: Use the health check endpoint to verify backend
3. **Database Inspection**: Use MongoDB Compass or similar tools
4. **Logs**: Check console output for detailed error messages

## Production Deployment

### Environment Variables
- Set `NODE_ENV=production`
- Use secure, random values for secrets
- Configure proper MongoDB connection string
- Set up proper CORS origins

### Build Commands
```bash
# Build frontend
cd frontend
npm run build

# Start production server
cd ../backend
npm start
```

## Security Notes

- Never commit `.env` files
- Use strong, unique secrets in production
- Enable HTTPS in production
- Regularly rotate API keys and secrets
- Monitor for security vulnerabilities

## Support

For issues and questions:
1. Check this setup guide
2. Review error logs
3. Check the troubleshooting section
4. Create an issue in the repository
