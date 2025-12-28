"""
NCERT RAG API SERVER - PRODUCTION READY
Date: December 27, 2025
Purpose: Expose RAG functionality as REST API for frontend integration
"""

import os
import json
import logging
import uuid
import threading
import time
import re
from datetime import datetime, timedelta
from functools import wraps
from typing import Dict, List, Optional, Any

# Flask imports
from flask import Flask, request, jsonify, g
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
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')
    METRICS_ENABLED = os.getenv('METRICS_ENABLED', 'True').lower() == 'true'

# ==================== APPLICATION SETUP ====================

app = Flask(__name__)
app.config.from_object(Config)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

CORS(app, 
     origins=app.config['CORS_ORIGINS'],
     methods=["GET", "POST", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-API-Key"],
     max_age=3600)

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per minute", "10 per second"] if app.config['RATE_LIMIT_ENABLED'] else [],
    storage_uri="memory://",
    strategy="fixed-window"
)

# ==================== LOGGING SETUP ====================

class StructuredFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
            'request_id': getattr(g, 'request_id', None) if hasattr(g, 'request_id') else None,
            'client_ip': getattr(g, 'client_ip', None) if hasattr(g, 'client_ip') else None
        }
        
        if hasattr(record, 'extra'):
            log_record.update(record.extra)
            
        return json.dumps(log_record)

logger = logging.getLogger(__name__)
logger.setLevel(getattr(logging, app.config['LOG_LEVEL']))

file_handler = logging.FileHandler(app.config['LOG_FILE'])
file_handler.setFormatter(StructuredFormatter())
logger.addHandler(file_handler)

console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(console_handler)

# ==================== RAG SYSTEM INTEGRATION ====================

try:
    from rag_system import RAGSystem, VectorDatabase
    
    # Initialize RAG system
    logger.info("🚀 Initializing RAG System...")
    rag_system = RAGSystem()
    
    # Create database wrapper for backward compatibility
    rag_system.db = VectorDatabase(rag_system)
    
    RAG_AVAILABLE = True
    logger.info("✅ RAG System initialized successfully!")
    
    # Check database
    chunks_count = rag_system.db.count_chunks()
    logger.info(f"📊 Database has {chunks_count} chunks")
    
except Exception as e:
    logger.error(f"❌ Failed to initialize RAG system: {e}", exc_info=True)
    RAG_AVAILABLE = False
    rag_system = None

# ==================== UTILITY FUNCTIONS ====================

def sanitize_input(text: str, max_length: int = 1000) -> str:
    """Sanitize user input to prevent injection attacks."""
    if not text:
        return ""
    
    text = re.sub(r'[<>{}[\]]', '', text)
    
    if len(text) > max_length:
        text = text[:max_length]
    
    text = ' '.join(text.split())
    return text.strip()

def validate_api_key(api_key: str) -> bool:
    """Validate API key with constant-time comparison."""
    if not app.config['API_KEY']:
        return True
    
    return secrets.compare_digest(api_key, app.config['API_KEY'])

def require_api_key(f):
    """Decorator to require API key authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not app.config['API_KEY'] and app.config['DEBUG']:
            return f(*args, **kwargs)
        
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
        
        if not api_key:
            logger.warning("API key missing from request")
            return jsonify({
                'error': 'API key required',
                'code': 'AUTH_REQUIRED'
            }), 401
        
        if not validate_api_key(api_key):
            logger.warning("Invalid API key provided")
            return jsonify({
                'error': 'Invalid API key',
                'code': 'INVALID_API_KEY'
            }), 403
        
        return f(*args, **kwargs)
    return decorated_function

# ==================== REQUEST HOOKS ====================

@app.before_request
def before_request():
    """Setup request context."""
    g.request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
    g.client_ip = request.remote_addr
    g.start_time = time.time()
    
    logger.info(f"Request started: {request.method} {request.path}",
                extra={'request_id': g.request_id, 'client_ip': g.client_ip})

@app.after_request
def after_request(response):
    """Add security headers and log response."""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    if hasattr(g, 'request_id'):
        response.headers['X-Request-ID'] = g.request_id
    
    if hasattr(g, 'start_time'):
        response_time = time.time() - g.start_time
        response.headers['X-Response-Time'] = f'{response_time:.3f}s'
        
        if response_time > 5.0:
            logger.warning(f"Slow request: {response_time:.2f}s for {request.path}",
                          extra={'response_time': response_time, 'request_id': g.request_id})
    
    logger.info(f"Request completed: {response.status_code}",
                extra={'status': response.status_code, 'request_id': g.request_id})
    
    return response

# ==================== HEALTH CHECK ENDPOINTS ====================

@app.route('/', methods=['GET'])
@limiter.limit("30 per minute")
def home():
    """Root endpoint - API information."""
    return jsonify({
        'status': 'online',
        'service': 'NCERT RAG API Server',
        'version': '2.0.0',
        'production': not app.config['DEBUG'],
        'rag_available': RAG_AVAILABLE,
        'timestamp': datetime.now().isoformat(),
        'endpoints': {
            'GET /': 'API information',
            'GET /health': 'Health check with dependencies',
            'GET /metrics': 'API metrics (if enabled)',
            'GET /stats': 'Database statistics',
            'POST /query': 'Ask a question (Q&A)',
            'POST /generate-questions': 'Generate test questions',
            'POST /generate-test': 'Generate complete test paper',
            'GET /task/<task_id>': 'Check async task status'
        },
        'limits': {
            'rate_limiting': app.config['RATE_LIMIT_ENABLED'],
            'max_request_size': f"{app.config['MAX_CONTENT_LENGTH'] / (1024*1024):.0f}MB"
        }
    })

@app.route('/health', methods=['GET'])
@limiter.exempt
def health_check():
    """Comprehensive health check with dependency monitoring."""
    health_status = {
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'version': '2.0.0',
        'dependencies': {}
    }
    
    # Check RAG system
    if RAG_AVAILABLE:
        try:
            chunks_count = rag_system.db.count_chunks()
            health_status['dependencies']['rag_system'] = {
                'status': 'healthy',
                'chunks': chunks_count,
                'available': True
            }
        except Exception as e:
            health_status['dependencies']['rag_system'] = {
                'status': 'unhealthy',
                'error': str(e),
                'available': True
            }
            health_status['status'] = 'degraded'
    else:
        health_status['dependencies']['rag_system'] = {
            'status': 'unavailable',
            'available': False
        }
        health_status['status'] = 'degraded'
    
    # Add system info if psutil available
    try:
        import psutil
        health_status['system'] = {
            'cpu_percent': psutil.cpu_percent(),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_percent': psutil.disk_usage('/').percent
        }
    except ImportError:
        health_status['system'] = {'info': 'System metrics unavailable (install psutil)'}
    
    return jsonify(health_status)

@app.route('/metrics', methods=['GET'])
@limiter.limit("10 per minute")
def metrics():
    """Return API metrics."""
    if not app.config['METRICS_ENABLED']:
        return jsonify({'error': 'Metrics disabled'}), 403
    
    metrics_data = [
        "# HELP http_requests_total Total HTTP requests",
        "# TYPE http_requests_total counter",
        f'http_requests_total{{endpoint="/"}} 0'
    ]
    
    return "\n".join(metrics_data), 200, {'Content-Type': 'text/plain'}

# ==================== DATA ENDPOINTS ====================

@app.route('/stats', methods=['GET'])
@limiter.limit("30 per minute")
@require_api_key
def get_stats():
    """Get database statistics."""
    if not RAG_AVAILABLE:
        return jsonify({'error': 'RAG system not available', 'code': 'SERVICE_UNAVAILABLE'}), 503
    
    try:
        chunks_count = rag_system.db.count_chunks()
        
        # Get stats from RAG system
        stats = rag_system.get_stats_sync()
        
        return jsonify({
            'success': True,
            'data': {
                'total_chunks': stats.get('total_chunks', chunks_count),
                'unique_chapters': stats.get('unique_chapters', 0),
                'unique_subjects': stats.get('unique_subjects', 0),
                'current_model': stats.get('current_model', 'none')
            },
            'timestamp': datetime.now().isoformat(),
            'request_id': g.request_id
        })
    except Exception as e:
        logger.error(f"Error getting stats: {e}", 
                    extra={'error': str(e), 'request_id': g.request_id})
        return jsonify({
            'error': 'Internal server error',
            'code': 'INTERNAL_ERROR',
            'request_id': g.request_id
        }), 500

@app.route('/chapters', methods=['GET'])
@limiter.limit("30 per minute")
@require_api_key
def get_chapters():
    """Get list of all available chapters."""
    if not RAG_AVAILABLE:
        return jsonify({'error': 'RAG system not available', 'code': 'SERVICE_UNAVAILABLE'}), 503
    
    try:
        chapters = rag_system.list_chapters_sync()
        return jsonify({
            'success': True,
            'count': len(chapters),
            'chapters': chapters,
            'timestamp': datetime.now().isoformat(),
            'request_id': g.request_id
        })
    except Exception as e:
        logger.error(f"Error getting chapters: {e}",
                    extra={'error': str(e), 'request_id': g.request_id})
        return jsonify({
            'error': 'Internal server error',
            'code': 'INTERNAL_ERROR',
            'request_id': g.request_id
        }), 500

# ==================== CORE RAG ENDPOINTS ====================

@app.route('/query', methods=['POST'])
@limiter.limit("20 per minute")
@require_api_key
def query_endpoint():
    """Ask a question - Direct Q&A endpoint."""
    if not RAG_AVAILABLE:
        return jsonify({'error': 'RAG system not available', 'code': 'SERVICE_UNAVAILABLE'}), 503
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body is required', 'code': 'INVALID_REQUEST'}), 400
        
        if 'question' not in data:
            return jsonify({'error': 'Missing "question" in request body', 'code': 'MISSING_FIELD'}), 400
        
        question = sanitize_input(data['question'].strip(), max_length=500)
        
        if not question:
            return jsonify({'error': 'Question cannot be empty', 'code': 'EMPTY_FIELD'}), 400
        
        logger.info(f"Processing question", 
                   extra={'question_preview': question[:100], 'request_id': g.request_id})
        
        # Use sync query method (FIXED: No async event loop issues)
        try:
            answer, chunks_retrieved = rag_system.query_sync(question)
        except TimeoutError as e:
            logger.error(f"Query timeout after {app.config['MODEL_TIMEOUT']}s",
                        extra={'question': question[:50], 'request_id': g.request_id})
            return jsonify({
                'error': 'Query processing timeout',
                'code': 'TIMEOUT',
                'request_id': g.request_id
            }), 408
        except Exception as e:
            logger.error(f"RAG query failed: {e}",
                        extra={'question': question[:50], 'request_id': g.request_id})
            return jsonify({
                'error': 'Failed to process question',
                'details': str(e),
                'code': 'RAG_ERROR',
                'request_id': g.request_id
            }), 500
        
        processing_time = time.time() - g.start_time
        
        response = {
            'success': True,
            'question': question,
            'answer': answer,
            'chunks_retrieved': chunks_retrieved,
            'processing_time': round(processing_time, 2),
            'timestamp': datetime.now().isoformat(),
            'request_id': g.request_id
        }
        
        logger.info(f"Question answered", 
                   extra={'processing_time': processing_time, 
                          'chunks_retrieved': chunks_retrieved,
                          'request_id': g.request_id})
        
        return jsonify(response)
        
    except ValueError as e:
        logger.warning(f"Invalid request: {e}", extra={'request_id': g.request_id})
        return jsonify({'error': str(e), 'code': 'VALIDATION_ERROR', 'request_id': g.request_id}), 400
    except Exception as e:
        logger.error(f"Error processing query: {e}", 
                    exc_info=True, extra={'request_id': g.request_id})
        return jsonify({
            'error': 'Internal server error',
            'code': 'INTERNAL_ERROR',
            'request_id': g.request_id
        }), 500

# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Endpoint not found',
        'code': 'NOT_FOUND',
        'path': request.path,
        'request_id': getattr(g, 'request_id', '')
    }), 404

@app.errorhandler(429)
def ratelimit_handler(error):
    return jsonify({
        'error': 'Rate limit exceeded',
        'code': 'RATE_LIMIT_EXCEEDED',
        'message': 'Too many requests. Please try again later.',
        'retry_after': error.description.get('retry_after', 60) if hasattr(error, 'description') else 60,
        'request_id': getattr(g, 'request_id', '')
    }), 429

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Unhandled exception: {error}", exc_info=True, 
                extra={'request_id': getattr(g, 'request_id', '')})
    return jsonify({
        'error': 'Internal server error',
        'code': 'INTERNAL_ERROR',
        'request_id': getattr(g, 'request_id', ''),
        'message': 'An unexpected error occurred. Please try again later.'
    }), 500

# ==================== APPLICATION STARTUP ====================

def create_app():
    """Application factory for WSGI servers."""
    return app

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🚀 NCERT RAG API SERVER - PRODUCTION READY")
    print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    if app.config['DEBUG']:
        print("⚠️  WARNING: Running in DEBUG mode - NOT for production!")
        if not app.config['API_KEY']:
            print("⚠️  WARNING: No API key set - authentication disabled")
    
    if RAG_AVAILABLE:
        print("✅ RAG System: AVAILABLE")
        try:
            chunks_count = rag_system.db.count_chunks()
            print(f"📊 Database: {chunks_count:,} chunks")
        except Exception as e:
            print(f"⚠️  Database stats error: {e}")
    else:
        print("❌ RAG System: UNAVAILABLE - Running in limited mode")
    
    print(f"\n🌐 Starting {'development' if app.config['DEBUG'] else 'production'} server")
    print(f"📍 URL: http://{app.config['HOST']}:{app.config['PORT']}")
    print(f"🔒 Rate limiting: {'ENABLED' if app.config['RATE_LIMIT_ENABLED'] else 'DISABLED'}")
    print(f"🔑 API Auth: {'REQUIRED' if app.config['API_KEY'] else 'DISABLED'}")
    
    print("\n📋 Available endpoints:")
    print("   GET  /              - API information")
    print("   GET  /health        - Health check with dependencies")
    print("   GET  /stats         - Database statistics")
    print("   GET  /chapters      - List all chapters")
    print("   POST /query         - Ask a question (rate limited)")
    print("\n⚠️  For production, use WSGI server:")
    print("   gunicorn api_server:app -w 4 -b 0.0.0.0:5000")
    print("\n🔄 Press Ctrl+C to stop the server")
    print("="*70 + "\n")
    
    app.run(
        host=app.config['HOST'],
        port=app.config['PORT'],
        debug=app.config['DEBUG'],
        threaded=True
    )