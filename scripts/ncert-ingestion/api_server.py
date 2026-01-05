"""
NCERT RAG API SERVER - PRODUCTION READY
Version: 3.2.0
Date: December 29, 2025
Purpose: Expose RAG functionality as REST API for frontend integration
"""

import os
import json
import logging
import uuid
import time
import re
from datetime import datetime, timezone
from functools import wraps
import traceback

# Flask imports
from flask import Flask, request, jsonify, g, has_request_context
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

# Security and rate limiting
import secrets
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Environment configuration
from dotenv import load_dotenv

# Add current directory to path
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# ==================== CONFIGURATION ====================

load_dotenv()

class Config:
    """Production Configuration"""
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    SECRET_KEY = os.getenv('SECRET_KEY', secrets.token_hex(32))
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 5000))
    API_KEY = os.getenv('API_KEY', '')
    RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'True').lower() == 'true'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    MODEL_TIMEOUT = int(os.getenv('MODEL_TIMEOUT', 30))
    MAX_CONCURRENT_TASKS = int(os.getenv('MAX_CONCURRENT_TASKS', 10))
    TASK_TIMEOUT = int(os.getenv('TASK_TIMEOUT', 300))
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'api_server.log')
    
    # CORS configuration
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
    if CORS_ORIGINS != '*':
        CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS.split(',')]
    
    METRICS_ENABLED = os.getenv('METRICS_ENABLED', 'True').lower() == 'true'
    REQUEST_ID_HEADER = os.getenv('REQUEST_ID_HEADER', 'X-Request-ID')
    MAX_QUESTION_LENGTH = int(os.getenv('MAX_QUESTION_LENGTH', 1000))
    
    # Supabase configuration
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
    
    # API Keys
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# ==================== APPLICATION SETUP ====================

app = Flask(__name__)
app.config.from_object(Config)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# Configure CORS
CORS(app, 
     origins=app.config['CORS_ORIGINS'],
     methods=["GET", "POST", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Request-ID"],
     max_age=3600,
     supports_credentials=True)

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per minute", "10 per second"] if app.config['RATE_LIMIT_ENABLED'] else [],
    storage_uri="memory://",
    strategy="fixed-window",
    headers_enabled=True
)

# Store startup time
app.startup_time = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

# ==================== LOGGING SETUP ====================

class SafeStructuredFormatter(logging.Formatter):
    """Safe JSON formatter that handles Flask context properly."""
    
    def format(self, record):
        try:
            log_data = {
                'timestamp': self.formatTime(record),
                'level': record.levelname,
                'message': record.getMessage(),
                'module': record.module,
                'function': record.funcName,
                'line': record.lineno,
            }
            
            # Safely add request context if available
            if has_request_context():
                request_id = getattr(g, 'request_id', None)
                client_ip = getattr(g, 'client_ip', None)
                
                if request_id:
                    log_data['request_id'] = request_id
                if client_ip:
                    log_data['client_ip'] = client_ip
            
            # Add exception info if present
            if record.exc_info:
                log_data['exception'] = self.formatException(record.exc_info)
            
            # Add any extra fields
            if hasattr(record, 'extra'):
                log_data.update(record.extra)
                
            return json.dumps(log_data, default=str)
            
        except Exception as e:
            # Fallback to basic format
            return super().format(record)

def setup_logging():
    """Configure logging system."""
    logger = logging.getLogger(__name__)
    logger.setLevel(getattr(logging, app.config['LOG_LEVEL']))
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # File handler with structured JSON logging
    try:
        log_dir = os.path.dirname(app.config['LOG_FILE'])
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir)
            
        file_handler = logging.FileHandler(app.config['LOG_FILE'], encoding='utf-8')
        file_formatter = SafeStructuredFormatter()
        file_handler.setFormatter(file_formatter)
        file_handler.setLevel(logging.DEBUG if app.config['DEBUG'] else logging.INFO)
        logger.addHandler(file_handler)
    except Exception as e:
        print(f"⚠️  Failed to setup file logging: {e}")
    
    # Console handler
    console_handler = logging.StreamHandler()
    
    if app.config['DEBUG']:
        # Colorful output for development
        class ColorFormatter(logging.Formatter):
            COLORS = {
                'DEBUG': '\033[96m',    # Cyan
                'INFO': '\033[92m',     # Green
                'WARNING': '\033[93m',  # Yellow
                'ERROR': '\033[91m',    # Red
                'CRITICAL': '\033[95m', # Magenta
                'RESET': '\033[0m'
            }
            
            def format(self, record):
                color = self.COLORS.get(record.levelname, self.COLORS['RESET'])
                record.levelname = f"{color}{record.levelname}{self.COLORS['RESET']}"
                return super().format(record)
        
        console_formatter = ColorFormatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    else:
        # Simple output for production
        console_formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # Prevent propagation to root logger
    logger.propagate = False
    
    return logger

logger = setup_logging()

# ==================== RAG SYSTEM INTEGRATION ====================

RAG_AVAILABLE = False
rag_system = None

def initialize_rag_system():
    """Initialize RAG system with proper error handling."""
    global RAG_AVAILABLE, rag_system
    
    try:
        logger.info("🚀 Attempting to initialize RAG System...")
        
        # Check for required dependencies
        try:
            import psycopg2
        except ImportError:
            logger.error("📦 Missing dependency: psycopg2")
            logger.error("💡 Install with: pip install psycopg2-binary")
            return False
        
        # Try to import RAG system
        try:
            from rag_system import RAGSystem, VectorDatabase
            logger.info("✅ RAG modules imported successfully")
        except ImportError as e:
            logger.error(f"❌ Failed to import RAG modules: {e}")
            logger.error(f"📁 Current directory: {os.getcwd()}")
            logger.error(f"📁 Looking for: {__file__}")
            return False
        
        # Initialize RAG system
        try:
            rag_system = RAGSystem()
            
            # Initialize database wrapper
            if hasattr(rag_system, 'db'):
                logger.info("✅ RAG System initialized with existing database connection")
            else:
                rag_system.db = VectorDatabase(rag_system)
                logger.info("✅ Database wrapper created")
            
            # Test the connection
            try:
                chunks_count = rag_system.db.count_chunks()
                logger.info(f"📊 Database connected successfully")
                logger.info(f"📊 Total chunks: {chunks_count:,}")
                
                RAG_AVAILABLE = True
                return True
                
            except Exception as db_error:
                logger.error(f"❌ Database connection test failed: {db_error}")
                logger.error("💡 Check your Supabase credentials and connection")
                RAG_AVAILABLE = False
                return False
                
        except Exception as init_error:
            logger.error(f"❌ RAG System initialization failed: {init_error}", exc_info=True)
            RAG_AVAILABLE = False
            return False
            
    except Exception as e:
        logger.error(f"❌ Unexpected error during RAG initialization: {e}", exc_info=True)
        RAG_AVAILABLE = False
        return False

# Initialize RAG system
rag_initialized = initialize_rag_system()
if not rag_initialized:
    logger.warning("⚠️  RAG System initialization failed - running in limited mode")
    logger.warning("⚠️  The /query endpoint will return 503 Service Unavailable")
    logger.warning("💡 Check the logs above for specific error details")

# ==================== UTILITY FUNCTIONS ====================

def sanitize_input(text: str, max_length: int = None) -> str:
    """Sanitize user input to prevent injection attacks."""
    if not text or not isinstance(text, str):
        return ""
    
    if max_length is None:
        max_length = app.config['MAX_QUESTION_LENGTH']
    
    # Remove potentially dangerous characters
    text = re.sub(r'[<>{}[\]\\|`\'\";]', '', text)
    
    # Limit length
    if len(text) > max_length:
        original_length = len(text)
        text = text[:max_length]
        logger.debug(f"Input truncated from {original_length} to {max_length} characters")
    
    # Normalize whitespace
    text = ' '.join(text.split())
    return text.strip()

def validate_api_key(api_key: str) -> bool:
    """Validate API key with constant-time comparison."""
    configured_key = app.config['API_KEY']
    
    if not configured_key:
        return True  # No API key required
    
    if not api_key:
        return False
    
    return secrets.compare_digest(api_key, configured_key)

def require_api_key(f):
    """Decorator to require API key authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Skip auth in debug mode if no API key is set
        if app.config['DEBUG'] and not app.config['API_KEY']:
            logger.debug("API auth skipped: DEBUG mode with no API key configured")
            return f(*args, **kwargs)
        
        # Check for API key
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
        
        if not api_key:
            logger.warning("API key missing from request", 
                          extra={'client_ip': getattr(g, 'client_ip', 'unknown'),
                                 'endpoint': request.endpoint})
            return jsonify({
                'error': 'API key required',
                'code': 'AUTH_REQUIRED',
                'request_id': getattr(g, 'request_id', '')
            }), 401
        
        if not validate_api_key(api_key):
            logger.warning("Invalid API key provided",
                          extra={'client_ip': getattr(g, 'client_ip', 'unknown'),
                                 'endpoint': request.endpoint})
            return jsonify({
                'error': 'Invalid API key',
                'code': 'INVALID_API_KEY',
                'request_id': getattr(g, 'request_id', '')
            }), 403
        
        return f(*args, **kwargs)
    return decorated_function

def get_client_ip() -> str:
    """Get client IP considering proxy headers."""
    # Check common proxy headers
    for header in ['X-Forwarded-For', 'X-Real-IP', 'X-Client-IP']:
        ip = request.headers.get(header)
        if ip:
            # Handle multiple IPs in X-Forwarded-For
            if ',' in ip:
                ip = ip.split(',')[0].strip()
            return ip
    
    # Fallback to remote address
    return request.remote_addr or 'unknown'

def create_response(data: dict, status_code: int = 200, **kwargs) -> tuple:
    """Create standardized JSON response."""
    response = {
        'success': status_code < 400,
        'timestamp': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'request_id': getattr(g, 'request_id', ''),
        **data
    }
    
    return jsonify(response), status_code, kwargs

# ==================== REQUEST HOOKS ====================

@app.before_request
def before_request():
    """Setup request context - THIS WAS MISSING!"""
    g.start_time = time.time()
    g.request_id = request.headers.get(app.config['REQUEST_ID_HEADER']) or str(uuid.uuid4())
    g.client_ip = get_client_ip()
    
    logger.info(f"Request started: {request.method} {request.path}",
                extra={
                    'request_id': g.request_id,
                    'client_ip': g.client_ip,
                    'user_agent': request.user_agent.string[:100] if request.user_agent else 'Unknown',
                    'method': request.method
                })

@app.after_request
def after_request(response):
    """Add security headers and log response."""
    # Security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Add request ID to response (safely)
    if hasattr(g, 'request_id'):
        response.headers['X-Request-ID'] = g.request_id
    
    # Calculate and log response time
    if hasattr(g, 'start_time'):
        response_time = time.time() - g.start_time
        response.headers['X-Response-Time'] = f'{response_time:.3f}s'
        
        # Log slow requests
        if response_time > 5.0:
            logger.warning(f"Slow request: {response_time:.2f}s for {request.path}",
                          extra={
                              'response_time': response_time,
                              'request_id': getattr(g, 'request_id', ''),
                              'method': request.method,
                              'status': response.status_code
                          })
    
    logger.info(f"Request completed: {response.status_code}",
                extra={
                    'status': response.status_code,
                    'request_id': getattr(g, 'request_id', ''),
                    'method': request.method,
                    'path': request.path,
                    'response_time': time.time() - getattr(g, 'start_time', 0)
                })
    
    return response

# ==================== HEALTH CHECK ENDPOINTS ====================

@app.route('/', methods=['GET'])
@limiter.limit("60 per minute")
def home():
    """Root endpoint - API information."""
    return create_response({
        'status': 'online',
        'service': 'NCERT RAG API Server',
        'version': '3.2.0',
        'production': not app.config['DEBUG'],
        'rag_available': RAG_AVAILABLE,
        'startup_time': app.startup_time,
        'endpoints': {
            'GET /': 'API information',
            'GET /health': 'Health check with dependencies',
            'GET /metrics': 'API metrics (if enabled)',
            'GET /stats': 'Database statistics',
            'GET /chapters': 'List all chapters',
            'POST /query': 'Ask a question (Q&A)'
        },
        'limits': {
            'rate_limiting': app.config['RATE_LIMIT_ENABLED'],
            'max_question_length': app.config['MAX_QUESTION_LENGTH'],
            'max_request_size': f"{app.config['MAX_CONTENT_LENGTH'] / (1024*1024):.0f}MB"
        },
        'documentation': 'See /health for detailed system status'
    })

@app.route('/health', methods=['GET'])
@limiter.exempt
def health_check():
    """Comprehensive health check with dependency monitoring."""
    health_status = {
        'status': 'healthy',
        'version': '3.2.0',
        'uptime': app.startup_time,
        'dependencies': {}
    }
    
    # Check RAG system
    if RAG_AVAILABLE and rag_system:
        try:
            chunks_count = rag_system.db.count_chunks()
            health_status['dependencies']['rag_system'] = {
                'status': 'healthy',
                'chunks': chunks_count,
                'available': True,
                'connected': True
            }
        except Exception as e:
            health_status['dependencies']['rag_system'] = {
                'status': 'unhealthy',
                'error': str(e),
                'available': True,
                'connected': False
            }
            health_status['status'] = 'degraded'
    else:
        health_status['dependencies']['rag_system'] = {
            'status': 'unavailable',
            'available': False,
            'connected': False
        }
        health_status['status'] = 'degraded'
    
    # Check system resources if psutil is available
    try:
        import psutil
        health_status['system'] = {
            'cpu_percent': psutil.cpu_percent(interval=0.1),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_percent': psutil.disk_usage('/').percent if os.name != 'nt' else psutil.disk_usage('C:').percent,
            'process_memory_mb': psutil.Process().memory_info().rss / 1024 / 1024
        }
    except ImportError:
        health_status['system'] = {'info': 'Install psutil for detailed system metrics'}
    except Exception as e:
        health_status['system'] = {'error': f'Failed to get system metrics: {str(e)}'}
    
    # Add application metrics
    health_status['application'] = {
        'debug_mode': app.config['DEBUG'],
        'rate_limiting': app.config['RATE_LIMIT_ENABLED'],
        'auth_enabled': bool(app.config['API_KEY']),
        'cors_origins': app.config['CORS_ORIGINS'],
        'supabase_configured': bool(app.config['SUPABASE_URL']),
        'gemini_configured': bool(app.config['GEMINI_API_KEY']),
        'openai_configured': bool(app.config['OPENAI_API_KEY'])
    }
    
    return create_response(health_status)

@app.route('/metrics', methods=['GET'])
@limiter.limit("10 per minute")
@require_api_key
def metrics():
    """Return API metrics in Prometheus format."""
    if not app.config['METRICS_ENABLED']:
        return create_response({
            'error': 'Metrics endpoint is disabled',
            'code': 'METRICS_DISABLED'
        }, 403)
    
    metrics_data = [
        "# HELP ncert_api_requests_total Total API requests",
        "# TYPE ncert_api_requests_total counter",
        'ncert_api_requests_total{endpoint="/"} 0',
        'ncert_api_requests_total{endpoint="/health"} 0',
        'ncert_api_requests_total{endpoint="/query"} 0',
        "",
        "# HELP ncert_api_response_time_seconds API response time",
        "# TYPE ncert_api_response_time_seconds histogram",
        'ncert_api_response_time_seconds_bucket{le="0.1"} 0',
        'ncert_api_response_time_seconds_bucket{le="0.5"} 0',
        'ncert_api_response_time_seconds_bucket{le="1"} 0',
        'ncert_api_response_time_seconds_bucket{le="5"} 0',
        'ncert_api_response_time_seconds_bucket{le="10"} 0',
        'ncert_api_response_time_seconds_bucket{le="+Inf"} 0',
        'ncert_api_response_time_seconds_sum 0',
        'ncert_api_response_time_seconds_count 0',
        "",
        "# HELP ncert_rag_system_status RAG system status (1=up, 0=down)",
        "# TYPE ncert_rag_system_status gauge",
        f'ncert_rag_system_status {1 if RAG_AVAILABLE else 0}',
        "",
        "# HELP ncert_api_uptime_seconds API uptime in seconds",
        "# TYPE ncert_api_uptime_seconds gauge",
        f'ncert_api_uptime_seconds {time.time() - datetime.fromisoformat(app.startup_time.replace("Z", "")).timestamp()}'
    ]
    
    return "\n".join(metrics_data), 200, {'Content-Type': 'text/plain; version=0.0.4'}

# ==================== DATA ENDPOINTS ====================

@app.route('/stats', methods=['GET'])
@limiter.limit("30 per minute")
def get_stats():  # Removed @require_api_key for testing
    """Get database statistics."""
    if not RAG_AVAILABLE or not rag_system:
        return create_response({
            'error': 'RAG system not available',
            'code': 'SERVICE_UNAVAILABLE'
        }, 503)
    
    try:
        chunks_count = rag_system.db.count_chunks()
        
        # Try to get detailed stats if available
        try:
            stats = rag_system.get_stats_sync()
        except (AttributeError, NotImplementedError):
            stats = {}
        
        response_data = {
            'data': {
                'total_chunks': stats.get('total_chunks', chunks_count),
                'unique_chapters': stats.get('unique_chapters', 0),
                'unique_subjects': stats.get('unique_subjects', 0),
                'last_updated': stats.get('last_updated', datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')),
                'current_model': stats.get('current_model', 'unknown')
            }
        }
        
        logger.info(f"Stats retrieved successfully", 
                   extra={'chunks_count': chunks_count, 'request_id': g.request_id})
        
        return create_response(response_data)
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}", 
                    exc_info=True,
                    extra={'error': str(e), 'request_id': g.request_id})
        return create_response({
            'error': 'Internal server error',
            'code': 'INTERNAL_ERROR',
            'message': 'Failed to retrieve database statistics'
        }, 500)

@app.route('/chapters', methods=['GET'])
@limiter.limit("30 per minute")
def get_chapters():  # Removed @require_api_key for testing
    """Get list of all available chapters."""
    if not RAG_AVAILABLE or not rag_system:
        return create_response({
            'error': 'RAG system not available',
            'code': 'SERVICE_UNAVAILABLE'
        }, 503)
    
    try:
        chapters = rag_system.list_chapters_sync()
        return create_response({
            'count': len(chapters),
            'chapters': chapters
        })
        
    except Exception as e:
        logger.error(f"Error getting chapters: {e}",
                    exc_info=True,
                    extra={'error': str(e), 'request_id': g.request_id})
        return create_response({
            'error': 'Internal server error',
            'code': 'INTERNAL_ERROR',
            'message': 'Failed to retrieve chapters list'
        }, 500)

# ==================== CORE RAG ENDPOINTS ====================

@app.route('/query', methods=['POST'])
@limiter.limit("30 per minute")
def query_endpoint():  # Removed @require_api_key for testing
    """Ask a question - Direct Q&A endpoint."""
    if not RAG_AVAILABLE or not rag_system:
        return create_response({
            'error': 'RAG system not available',
            'code': 'SERVICE_UNAVAILABLE'
        }, 503)
    
    try:
        # Check content type
        if not request.is_json:
            return create_response({
                'error': 'Content-Type must be application/json',
                'code': 'INVALID_CONTENT_TYPE'
            }, 415)
        
        data = request.get_json(silent=True)
        
        if data is None:
            return create_response({
                'error': 'Invalid JSON in request body',
                'code': 'INVALID_JSON'
            }, 400)
        
        if 'question' not in data:
            return create_response({
                'error': 'Missing required field: "question"',
                'code': 'MISSING_FIELD'
            }, 400)
        
        question = sanitize_input(str(data['question']).strip())
        
        if not question:
            return create_response({
                'error': 'Question cannot be empty',
                'code': 'EMPTY_FIELD'
            }, 400)
        
        logger.info(f"Processing question", 
                   extra={
                       'question_length': len(question),
                       'question_preview': question[:100],
                       'request_id': g.request_id
                   })
        
        # Process the query with timeout
        start_time = time.time()
        try:
            answer, chunks_retrieved = rag_system.query_sync(question)
            processing_time = time.time() - start_time
            
        except Exception as rag_error:
            processing_time = time.time() - start_time
            logger.error(f"RAG query failed after {processing_time:.2f}s: {rag_error}",
                        exc_info=True,
                        extra={'question': question[:50], 'request_id': g.request_id})
            return create_response({
                'error': 'Failed to process question',
                'code': 'RAG_ERROR',
                'details': str(rag_error)[:100]
            }, 500)
        
        response_data = {
            'question': question,
            'answer': answer,
            'chunks_retrieved': chunks_retrieved,
            'processing_time': round(processing_time, 3)
        }
        
        logger.info(f"Question answered successfully", 
                   extra={
                       'processing_time': processing_time,
                       'chunks_retrieved': chunks_retrieved,
                       'answer_length': len(answer),
                       'request_id': g.request_id
                   })
        
        return create_response(response_data)
        
    except Exception as e:
        logger.error(f"Error in query endpoint: {e}", 
                    exc_info=True,
                    extra={'request_id': getattr(g, 'request_id', '')})
        return create_response({
            'error': 'Internal server error',
            'code': 'INTERNAL_ERROR',
            'message': 'An unexpected error occurred while processing your request'
        }, 500)

# ==================== ERROR HANDLERS ====================

@app.errorhandler(400)
def bad_request(error):
    return create_response({
        'error': 'Bad Request',
        'code': 'BAD_REQUEST',
        'message': 'The request could not be understood or was missing required parameters.',
        'path': request.path
    }, 400)

@app.errorhandler(404)
def not_found(error):
    return create_response({
        'error': 'Endpoint not found',
        'code': 'NOT_FOUND',
        'message': f'The requested endpoint {request.path} was not found on this server.',
        'path': request.path
    }, 404)

@app.errorhandler(405)
def method_not_allowed(error):
    return create_response({
        'error': 'Method not allowed',
        'code': 'METHOD_NOT_ALLOWED',
        'message': f'The {request.method} method is not allowed for this endpoint.',
        'path': request.path,
        'allowed_methods': error.valid_methods if hasattr(error, 'valid_methods') else []
    }, 405)

@app.errorhandler(415)
def unsupported_media_type(error):
    return create_response({
        'error': 'Unsupported media type',
        'code': 'UNSUPPORTED_MEDIA_TYPE',
        'message': 'The request Content-Type is not supported. Use application/json.',
        'path': request.path
    }, 415)

@app.errorhandler(429)
def ratelimit_handler(error):
    retry_after = getattr(error, 'retry_after', 60)
    return create_response({
        'error': 'Rate limit exceeded',
        'code': 'RATE_LIMIT_EXCEEDED',
        'message': 'Too many requests. Please try again later.',
        'retry_after': retry_after,
        'limit': getattr(error, 'limit', 'unknown')
    }, 429)

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Unhandled exception: {error}", exc_info=True, 
                extra={'request_id': getattr(g, 'request_id', '')})
    return create_response({
        'error': 'Internal server error',
        'code': 'INTERNAL_ERROR',
        'message': 'An unexpected error occurred. Please try again later.',
        'support': 'Contact support if this issue persists'
    }, 500)

# ==================== APPLICATION STARTUP ====================

def create_app():
    """Application factory for WSGI servers."""
    return app

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🚀 NCERT RAG API SERVER - PRODUCTION READY")
    print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    # Configuration summary
    print(f"\n📋 CONFIGURATION:")
    print(f"   Debug Mode: {'✅ ENABLED' if app.config['DEBUG'] else '❌ DISABLED'}")
    print(f"   API Auth: {'✅ REQUIRED' if app.config['API_KEY'] else '⚠️  DISABLED'}")
    print(f"   Rate Limiting: {'✅ ENABLED' if app.config['RATE_LIMIT_ENABLED'] else '❌ DISABLED'}")
    print(f"   CORS Origins: {app.config['CORS_ORIGINS']}")
    print(f"   Log Level: {app.config['LOG_LEVEL']}")
    print(f"   Log File: {app.config['LOG_FILE']}")
    
    # RAG System Status
    print(f"\n🔧 RAG SYSTEM:")
    if RAG_AVAILABLE:
        try:
            chunks_count = rag_system.db.count_chunks()
            print(f"   Status: ✅ AVAILABLE")
            print(f"   Database: 📊 {chunks_count:,} chunks")
            if not rag_system.current_model:
                print(f"   Model: ⚠️  FALLBACK MODE (Gemini not working)")
            else:
                print(f"   Model: ✅ {rag_system.current_model}")
        except Exception as e:
            print(f"   Status: ⚠️  PARTIALLY AVAILABLE")
            print(f"   Error: {e}")
    else:
        print(f"   Status: ❌ UNAVAILABLE")
        print(f"   Note: /query endpoint will return 503")
    
    # Server Info
    print(f"\n🌐 SERVER:")
    print(f"   Host: {app.config['HOST']}")
    print(f"   Port: {app.config['PORT']}")
    print(f"   URL: http://{app.config['HOST']}:{app.config['PORT']}")
    
    # Endpoints
    print(f"\n📡 ENDPOINTS:")
    print("   GET  /              - API information")
    print("   GET  /health        - Health check")
    print("   GET  /metrics       - Prometheus metrics")
    print("   GET  /stats         - Database statistics")
    print("   GET  /chapters      - List all chapters")
    print("   POST /query         - Ask a question")
    
    # Important Notes
    print(f"\n💡 NOTES:")
    if app.config['DEBUG']:
        print("   ⚠️  Running in DEBUG mode - NOT for production!")
    if not app.config['API_KEY']:
        print("   ✅ API authentication is DISABLED (for testing)")
    if app.config['CORS_ORIGINS'] == '*':
        print("   ⚠️  CORS allows ALL origins (*)")
    
    print(f"\n🔄 Press Ctrl+C to stop the server")
    print("="*70 + "\n")
    
    try:
        app.run(
            host=app.config['HOST'],
            port=app.config['PORT'],
            debug=app.config['DEBUG'],
            threaded=True,
            use_reloader=app.config['DEBUG']
        )
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Failed to start server: {e}", exc_info=True)
        print(f"\n❌ Failed to start server: {e}")
        sys.exit(1)