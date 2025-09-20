# LegalEase Deployment Guide

## Production Deployment Options

### Option 1: Traditional VPS/Server Deployment

#### Prerequisites
- Ubuntu 20.04+ or similar Linux distribution
- Node.js 16+ and npm
- MongoDB 4.4+
- Nginx (for reverse proxy)
- SSL certificate (Let's Encrypt recommended)

#### Step 1: Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/4.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Install Nginx
sudo apt install nginx -y

# Install PM2 for process management
sudo npm install -g pm2
```

#### Step 2: Application Deployment
```bash
# Clone repository
git clone <your-repo-url> /var/www/legalease
cd /var/www/legalease

# Install dependencies
npm run install-all

# Build frontend
cd frontend
npm run build
cd ..

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with production values

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### Step 3: PM2 Configuration
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'legalease-api',
    script: './backend/server.js',
    cwd: '/var/www/legalease',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    instances: 'max',
    exec_mode: 'cluster',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

Start the application:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Step 4: Nginx Configuration
Create `/etc/nginx/sites-available/legalease`:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    location / {
        root /var/www/legalease/frontend/build;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # File uploads
    client_max_body_size 10M;
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/legalease /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option 2: Docker Deployment

#### Docker Compose Setup
Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:4.4
    container_name: legalease-mongo
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    volumes:
      - mongodb_data:/data/db
    networks:
      - legalease-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: legalease-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      MONGODB_URI: mongodb://admin:${MONGO_PASSWORD}@mongodb:27017/legalease?authSource=admin
      JWT_SECRET: ${JWT_SECRET}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      AES_SECRET_KEY: ${AES_SECRET_KEY}
    depends_on:
      - mongodb
    networks:
      - legalease-network
    volumes:
      - ./backend/uploads:/app/uploads
      - ./backend/logs:/app/logs

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: legalease-frontend
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    networks:
      - legalease-network
    volumes:
      - ./ssl:/etc/nginx/ssl

volumes:
  mongodb_data:

networks:
  legalease-network:
    driver: bridge
```

Create `backend/Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p uploads logs

EXPOSE 5000

CMD ["npm", "start"]
```

Create `frontend/Dockerfile`:
```dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
```

Deploy with Docker:
```bash
# Create .env file with production values
cp .env.example .env

# Build and start services
docker-compose up -d --build

# View logs
docker-compose logs -f
```

### Option 3: Cloud Platform Deployment

#### Heroku Deployment
```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create legalease-app

# Add MongoDB addon
heroku addons:create mongolab:sandbox

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_jwt_secret
heroku config:set GEMINI_API_KEY=your_gemini_key
heroku config:set AES_SECRET_KEY=your_aes_key

# Deploy
git push heroku main
```

#### Vercel (Frontend) + Railway (Backend)
Frontend on Vercel:
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd frontend
vercel --prod
```

Backend on Railway:
1. Connect GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

## Environment Variables for Production

### Backend (.env)
```env
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb://username:password@host:port/database

# JWT
JWT_SECRET=super_secure_random_string_at_least_32_characters_long
JWT_EXPIRE=7d

# AI Service
GEMINI_API_KEY=your_production_gemini_api_key

# Encryption
AES_SECRET_KEY=base64_encoded_32_byte_key

# CORS
FRONTEND_URL=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

### Frontend (.env)
```env
REACT_APP_API_URL=https://api.yourdomain.com/api
REACT_APP_APP_NAME=LegalEase
REACT_APP_VERSION=1.0.0
```

## SSL Certificate Setup

### Using Let's Encrypt
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring and Logging

### PM2 Monitoring
```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs

# Restart application
pm2 restart legalease-api
```

### Log Rotation
Create `/etc/logrotate.d/legalease`:
```
/var/www/legalease/backend/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reload legalease-api
    endscript
}
```

## Security Checklist

- [ ] Use HTTPS with valid SSL certificate
- [ ] Set secure environment variables
- [ ] Enable firewall (UFW)
- [ ] Regular security updates
- [ ] MongoDB authentication enabled
- [ ] Rate limiting configured
- [ ] File upload restrictions in place
- [ ] CORS properly configured
- [ ] Security headers enabled (Helmet)
- [ ] Regular backups scheduled

## Performance Optimization

### Database Indexing
```javascript
// Add these indexes in MongoDB
db.users.createIndex({ email: 1 }, { unique: true })
db.documents.createIndex({ userId: 1, createdAt: -1 })
db.documents.createIndex({ status: 1 })
db.documents.createIndex({ documentType: 1 })
```

### Nginx Caching
Add to Nginx config:
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Backup Strategy

### Database Backup
```bash
#!/bin/bash
# backup-mongodb.sh
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="mongodb://username:password@localhost:27017/legalease" --out /backups/mongodb_$DATE
tar -czf /backups/mongodb_$DATE.tar.gz /backups/mongodb_$DATE
rm -rf /backups/mongodb_$DATE

# Keep only last 7 days
find /backups -name "mongodb_*.tar.gz" -mtime +7 -delete
```

### File Backup
```bash
#!/bin/bash
# backup-files.sh
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf /backups/uploads_$DATE.tar.gz /var/www/legalease/backend/uploads
find /backups -name "uploads_*.tar.gz" -mtime +30 -delete
```

## Troubleshooting

### Common Issues
1. **502 Bad Gateway**: Check if backend is running
2. **Database Connection**: Verify MongoDB is running and credentials
3. **File Upload Fails**: Check disk space and permissions
4. **High Memory Usage**: Monitor and restart PM2 processes
5. **SSL Issues**: Verify certificate paths and renewal

### Health Checks
```bash
# API health check
curl https://yourdomain.com/api/health

# Database connection
mongo --eval "db.adminCommand('ismaster')"

# Disk space
df -h

# Memory usage
free -m

# Process status
pm2 status
```

This completes the comprehensive deployment guide for the LegalEase application!
