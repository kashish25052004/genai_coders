const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Logger middleware
const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
  
  // Log request
  const logEntry = {
    timestamp,
    method,
    url,
    ip,
    userAgent,
    body: method === 'POST' || method === 'PUT' ? 
      JSON.stringify(req.body).substring(0, 500) : undefined
  };

  // Console log in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`${timestamp} - ${method} ${url} - ${ip}`);
  }

  // File log in production
  if (process.env.NODE_ENV === 'production') {
    const logFile = path.join(logsDir, `access-${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }

  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - req.startTime;
    
    // Log response
    const responseLog = {
      ...logEntry,
      statusCode: res.statusCode,
      responseTime,
      responseSize: data ? data.length : 0
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`${timestamp} - ${method} ${url} - ${res.statusCode} - ${responseTime}ms`);
    }

    if (process.env.NODE_ENV === 'production') {
      const logFile = path.join(logsDir, `access-${new Date().toISOString().split('T')[0]}.log`);
      fs.appendFileSync(logFile, JSON.stringify(responseLog) + '\n');
    }

    originalSend.call(this, data);
  };

  req.startTime = Date.now();
  next();
};

// Error logger
const errorLogger = (error, req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.connection.remoteAddress;
  
  const errorLog = {
    timestamp,
    method,
    url,
    ip,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    body: method === 'POST' || method === 'PUT' ? 
      JSON.stringify(req.body).substring(0, 500) : undefined
  };

  // Console log error
  console.error(`ERROR ${timestamp} - ${method} ${url}:`, error.message);

  // File log error
  const errorFile = path.join(logsDir, `error-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(errorFile, JSON.stringify(errorLog) + '\n');

  next(error);
};

// Security logger for suspicious activities
const securityLogger = (event, req, details = {}) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || '';
  
  const securityLog = {
    timestamp,
    event,
    ip,
    userAgent,
    url: req.originalUrl,
    method: req.method,
    userId: req.user ? req.user._id : null,
    details
  };

  console.warn(`SECURITY ${timestamp} - ${event} from ${ip}`);

  const securityFile = path.join(logsDir, `security-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(securityFile, JSON.stringify(securityLog) + '\n');
};

// Performance logger
const performanceLogger = (operation, duration, details = {}) => {
  const timestamp = new Date().toISOString();
  
  const perfLog = {
    timestamp,
    operation,
    duration,
    details
  };

  if (duration > 5000) { // Log slow operations (>5s)
    console.warn(`SLOW OPERATION ${timestamp} - ${operation}: ${duration}ms`);
    
    const perfFile = path.join(logsDir, `performance-${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(perfFile, JSON.stringify(perfLog) + '\n');
  }
};

// Clean old log files (keep last 30 days)
const cleanOldLogs = () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  try {
    const files = fs.readdirSync(logsDir);
    
    files.forEach(file => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < thirtyDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old log file: ${file}`);
      }
    });
  } catch (error) {
    console.error('Error cleaning old logs:', error);
  }
};

// Run log cleanup daily
setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);

module.exports = {
  logger,
  errorLogger,
  securityLogger,
  performanceLogger,
  cleanOldLogs
};
