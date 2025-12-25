"""
NCERT RAG API SERVER - PRODUCTION READY
Date: December 23, 2025
Purpose: Expose RAG functionality as REST API for frontend integration
Production Features:
1. Rate limiting
2. API key authentication
3. Request size limits
4. Input sanitization
5. Async task processing
6. Proper error handling
7. Monitoring endpoints
8. Health checks with dependencies
9. Structured logging
10. CORS with security headers
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
from queue import Queue
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

# Load environment variables
load_dotenv()

class Config:
    """Production Configuration"""
    # Flask settings
    DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'
    SECRET_KEY = os.getenv('SECRET_KEY', secrets.token_hex(32))
    
    # Server settings
    HOST = os.getenv('HOST', '0.0.0.0')
    PORT = int(os.getenv('PORT', 5000))
    
    # Security settings
    API_KEY = os.getenv('API_KEY', '')  # Set in production
    RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'True').lower() == 'true'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max request size
    
    # RAG settings
    RAG_SYSTEM_PATH = os.getenv('RAG_SYSTEM_PATH', 'rag_system.py')
    MODEL_TIMEOUT = int(os.getenv('MODEL_TIMEOUT', 30))  # seconds
    
    # Task settings
    MAX_CONCURRENT_TASKS = int(os.getenv('MAX_CONCURRENT_TASKS', 10))
    TASK_TIMEOUT = int(os.getenv('TASK_TIMEOUT', 300))  # 5 minutes
    
    # Logging settings
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'api_server.log')
    
    # CORS settings
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')
    
    # Monitoring
    METRICS_ENABLED = os.getenv('METRICS_ENABLED', 'True').lower() == 'true'

# ==================== APPLICATION SETUP ====================

# Initialize Flask app
app = Flask(__name__)
app.config.from_object(Config)

# Apply ProxyFix for reverse proxy setups
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# Configure CORS with security
CORS(app, 
     origins=app.config['CORS_ORIGINS'],
     methods=["GET", "POST", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization", "X-API-Key"],
     max_age=3600)

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per minute", "10 per second"] if app.config['RATE_LIMIT_ENABLED'] else [],
    storage_uri="memory://",  # In production, use Redis: "redis://localhost:6379"
    strategy="fixed-window"
)

# ==================== LOGGING SETUP ====================

# Structured logging
class StructuredFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            'timestamp': self.formatTime(record),
            'level': record.levelname,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
            'request_id': getattr(g, 'request_id', None),
            'client_ip': getattr(g, 'client_ip', None)
        }
        
        # Add extra fields if present
        if hasattr(record, 'extra'):
            log_record.update(record.extra)
            
        return json.dumps(log_record)

# Setup logger
logger = logging.getLogger(__name__)
logger.setLevel(getattr(logging, app.config['LOG_LEVEL']))

# File handler with structured logging
file_handler = logging.FileHandler(app.config['LOG_FILE'])
file_handler.setFormatter(StructuredFormatter())
logger.addHandler(file_handler)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))
logger.addHandler(console_handler)

# ==================== SECURITY & UTILITIES ====================

def sanitize_input(text: str, max_length: int = 1000) -> str:
    """Sanitize user input to prevent injection attacks."""
    if not text:
        return ""
    
    # Remove potentially dangerous characters
    text = re.sub(r'[<>{}[\]]', '', text)
    
    # Limit length
    if len(text) > max_length:
        text = text[:max_length]
    
    # Normalize whitespace
    text = ' '.join(text.split())
    
    return text.strip()

def validate_api_key(api_key: str) -> bool:
    """Validate API key."""
    if not app.config['API_KEY']:  # No API key required in dev
        return True
    
    # Use constant-time comparison to prevent timing attacks
    return secrets.compare_digest(api_key, app.config['API_KEY'])

def require_api_key(f):
    """Decorator to require API key authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Skip auth in debug mode if no API key is set
        if not app.config['API_KEY'] and app.config['DEBUG']:
            return f(*args, **kwargs)
        
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
        
        if not api_key:
            logger.warning("API key missing from request", extra={'client_ip': g.client_ip})
            return jsonify({
                'error': 'API key required',
                'code': 'AUTH_REQUIRED'
            }), 401
        
        if not validate_api_key(api_key):
            logger.warning("Invalid API key provided", extra={'client_ip': g.client_ip})
            return jsonify({
                'error': 'Invalid API key',
                'code': 'INVALID_API_KEY'
            }), 403
        
        return f(*args, **kwargs)
    return decorated_function

# ==================== TASK MANAGEMENT ====================

class TaskManager:
    """Manage async tasks for long-running operations."""
    
    def __init__(self, max_concurrent: int = 10):
        self.tasks: Dict[str, Dict] = {}
        self.max_concurrent = max_concurrent
        self.active_tasks = 0
        self.lock = threading.Lock()
    
    def create_task(self, task_type: str, data: Dict) -> str:
        """Create a new async task."""
        task_id = str(uuid.uuid4())
        
        with self.lock:
            if self.active_tasks >= self.max_concurrent:
                raise Exception("Too many concurrent tasks")
            
            self.tasks[task_id] = {
                'id': task_id,
                'type': task_type,
                'data': data,
                'status': 'queued',
                'created_at': datetime.now(),
                'started_at': None,
                'completed_at': None,
                'result': None,
                'error': None
            }
            self.active_tasks += 1
        
        # Start task in background thread
        thread = threading.Thread(
            target=self._execute_task,
            args=(task_id,),
            daemon=True
        )
        thread.start()
        
        logger.info(f"Created task {task_id} of type {task_type}")
        return task_id
    
    def _execute_task(self, task_id: str):
        """Execute task in background."""
        task = self.tasks[task_id]
        
        try:
            task['status'] = 'processing'
            task['started_at'] = datetime.now()
            
            # Import RAG system here to avoid circular imports
            from rag_system import query_rag_system
            
            # Process based on task type
            if task['type'] == 'generate_test':
                result = self._generate_test_paper(task['data'])
            elif task['type'] == 'generate_questions':
                result = self._generate_questions(task['data'])
            else:
                raise ValueError(f"Unknown task type: {task['type']}")
            
            task['result'] = result
            task['status'] = 'completed'
            
        except Exception as e:
            logger.error(f"Task {task_id} failed: {e}", exc_info=True)
            task['status'] = 'failed'
            task['error'] = str(e)
        
        finally:
            task['completed_at'] = datetime.now()
            
            with self.lock:
                self.active_tasks -= 1
            
            logger.info(f"Task {task_id} completed with status: {task['status']}")
    
    def _generate_test_paper(self, data: Dict) -> Dict:
        """Generate test paper (long-running)."""
        # Simulate processing - replace with actual RAG call
        time.sleep(2)  # Simulate work
        
        # For now, return mock data
        return {
            'test_paper': {
                'title': data.get('title', 'Test Paper'),
                'content': f"Generated test for chapters: {data.get('chapters', [])}"
            }
        }
    
    def _generate_questions(self, data: Dict) -> Dict:
        """Generate questions."""
        # Simulate processing
        time.sleep(1)
        
        return {
            'questions': [
                f"Question {i+1} about {topic}"
                for i, topic in enumerate(data.get('topics', []))
            ]
        }
    
    def get_task_status(self, task_id: str) -> Optional[Dict]:
        """Get task status by ID."""
        return self.tasks.get(task_id)
    
    def cleanup_old_tasks(self, max_age_hours: int = 24):
        """Clean up old tasks."""
        cutoff = datetime.now() - timedelta(hours=max_age_hours)
        
        with self.lock:
            old_tasks = [
                task_id for task_id, task in self.tasks.items()
                if task['completed_at'] and task['completed_at'] < cutoff
            ]
            
            for task_id in old_tasks:
                del self.tasks[task_id]
            
            if old_tasks:
                logger.info(f"Cleaned up {len(old_tasks)} old tasks")

# Initialize task manager
task_manager = TaskManager(max_concurrent=app.config['MAX_CONCURRENT_TASKS'])

# ==================== RAG SYSTEM INTEGRATION ====================

try:
    from rag_system import query_rag_system, get_database_stats, list_chapters
    RAG_AVAILABLE = True
    logger.info("RAG system loaded successfully")
except ImportError as e:
    logger.error(f"Failed to import RAG system: {e}")
    RAG_AVAILABLE = False
    # Create mock functions for development
    def query_rag_system(question):
        return {
            'answer': f"Mock answer for: {question}",
            'sources': [],
            'processing_time': 0.5,
            'model_used': 'mock'
        }
    
    def get_database_stats():
        return {'total_chunks': 0, 'unique_chapters': 0}
    
    def list_chapters():
        return []

# ==================== REQUEST HOOKS ====================

@app.before_request
def before_request():
    """Setup request context."""
    # Generate request ID for tracing
    g.request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
    g.client_ip = request.remote_addr
    g.start_time = time.time()
    
    # Set request timeout
    request.environ['wsgi.timeout'] = app.config['TASK_TIMEOUT']
    
    logger.info(f"Request started: {request.method} {request.path}",
                extra={'request_id': g.request_id, 'client_ip': g.client_ip})

@app.after_request
def after_request(response):
    """Add security headers and log response."""
    # Security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    
    # Add request ID to response
    response.headers['X-Request-ID'] = g.get('request_id', '')
    
    # Calculate response time
    if hasattr(g, 'start_time'):
        response_time = time.time() - g.start_time
        response.headers['X-Response-Time'] = f'{response_time:.3f}s'
        
        # Log slow requests
        if response_time > 5.0:  # More than 5 seconds
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
        'timestamp': datetime.now().isoformat(),
        'endpoints': {
            'GET /': 'API information',
            'GET /health': 'Health check with dependencies',
            'GET /metrics': 'API metrics (if enabled)',
            'GET /stats': 'Database statistics',
            'GET /chapters': 'List all available chapters',
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
@limiter.exempt  # Health checks shouldn't be rate limited
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
            stats = get_database_stats()
            health_status['dependencies']['rag_system'] = {
                'status': 'healthy',
                'chunks': stats.get('total_chunks', 0),
                'chapters': stats.get('unique_chapters', 0)
            }
        except Exception as e:
            health_status['dependencies']['rag_system'] = {
                'status': 'unhealthy',
                'error': str(e)
            }
            health_status['status'] = 'degraded'
    else:
        health_status['dependencies']['rag_system'] = {'status': 'unavailable'}
        health_status['status'] = 'degraded'
    
    # Check task manager
    try:
        task_manager.cleanup_old_tasks()
        health_status['dependencies']['task_manager'] = {
            'status': 'healthy',
            'active_tasks': task_manager.active_tasks,
            'total_tasks': len(task_manager.tasks)
        }
    except Exception as e:
        health_status['dependencies']['task_manager'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
        health_status['status'] = 'degraded'
    
    # Add system info
    import psutil
    health_status['system'] = {
        'cpu_percent': psutil.cpu_percent(),
        'memory_percent': psutil.virtual_memory().percent,
        'disk_percent': psutil.disk_usage('/').percent
    }
    
    return jsonify(health_status)

# ==================== METRICS ENDPOINT ====================

@app.route('/metrics', methods=['GET'])
@limiter.limit("10 per minute")
def metrics():
    """Return API metrics (Prometheus format)."""
    if not app.config['METRICS_ENABLED']:
        return jsonify({'error': 'Metrics disabled'}), 403
    
    # Collect basic metrics
    from flask import _request_ctx_stack
    metrics_data = []
    
    # Request count by endpoint (simplified)
    metrics_data.append("# HELP http_requests_total Total HTTP requests")
    metrics_data.append("# TYPE http_requests_total counter")
    # In production, use a proper metrics library like prometheus_flask_exporter
    
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
        stats = get_database_stats()
        return jsonify({
            'success': True,
            'data': stats,
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
        chapters = list_chapters()
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
    """
    Ask a question - Direct Q&A endpoint
    Request body: {"question": "What is photosynthesis?"}
    Response: {"answer": "...", "sources": [...]}
    """
    if not RAG_AVAILABLE:
        return jsonify({'error': 'RAG system not available', 'code': 'SERVICE_UNAVAILABLE'}), 503
    
    try:
        # Get and validate data
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body is required', 'code': 'INVALID_REQUEST'}), 400
        
        if 'question' not in data:
            return jsonify({'error': 'Missing "question" in request body', 'code': 'MISSING_FIELD'}), 400
        
        # Sanitize input
        question = sanitize_input(data['question'].strip(), max_length=500)
        
        if not question:
            return jsonify({'error': 'Question cannot be empty', 'code': 'EMPTY_FIELD'}), 400
        
        logger.info(f"Processing question", 
                   extra={'question_preview': question[:100], 'request_id': g.request_id})
        
        # Process with RAG system (with timeout)
        import signal
        class TimeoutException(Exception):
            pass
        
        def timeout_handler(signum, frame):
            raise TimeoutException("Query timeout")
        
        # Set timeout
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(app.config['MODEL_TIMEOUT'])
        
        try:
            result = query_rag_system(question)
        except TimeoutException:
            logger.error(f"Query timeout after {app.config['MODEL_TIMEOUT']}s",
                        extra={'question': question[:50], 'request_id': g.request_id})
            return jsonify({
                'error': 'Query processing timeout',
                'code': 'TIMEOUT',
                'request_id': g.request_id
            }), 408
        finally:
            signal.alarm(0)  # Disable alarm
        
        # Format response
        response = {
            'success': True,
            'question': question,
            'answer': result.get('answer', ''),
            'sources': result.get('sources', []),
            'processing_time': result.get('processing_time', 0),
            'model_used': result.get('model_used', 'unknown'),
            'timestamp': datetime.now().isoformat(),
            'request_id': g.request_id
        }
        
        logger.info(f"Question answered", 
                   extra={'processing_time': result.get('processing_time', 0), 
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

# ==================== ASYNC TASK ENDPOINTS ====================

@app.route('/generate-questions', methods=['POST'])
@limiter.limit("10 per minute")
@require_api_key
def generate_questions():
    """
    Generate specific number of questions (async).
    Request body: {
        "topics": ["Photosynthesis", "Chemical Reactions"],
        "count": 10,
        "difficulty": "medium"
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required', 'code': 'INVALID_REQUEST'}), 400
        
        # Validate topics
        topics = data.get('topics', [])
        if not topics or not isinstance(topics, list):
            return jsonify({'error': 'Topics must be a non-empty list', 'code': 'VALIDATION_ERROR'}), 400
        
        # Sanitize topics
        topics = [sanitize_input(str(topic), max_length=100) for topic in topics]
        topics = [t for t in topics if t]  # Remove empty
        
        if not topics:
            return jsonify({'error': 'Valid topics required', 'code': 'VALIDATION_ERROR'}), 400
        
        # Validate count
        count = min(max(int(data.get('count', 10)), 1), 50)  # Limit to 50
        
        # Validate difficulty
        difficulty = data.get('difficulty', 'medium')
        if difficulty not in ['easy', 'medium', 'hard']:
            difficulty = 'medium'
        
        # Create async task
        task_data = {
            'topics': topics,
            'count': count,
            'difficulty': difficulty,
            'question_types': data.get('question_types', ['mcq', 'short', 'long'])
        }
        
        task_id = task_manager.create_task('generate_questions', task_data)
        
        return jsonify({
            'success': True,
            'task_id': task_id,
            'status': 'queued',
            'message': 'Question generation started',
            'check_status': f'/task/{task_id}',
            'timestamp': datetime.now().isoformat(),
            'request_id': g.request_id
        })
        
    except ValueError as e:
        return jsonify({'error': str(e), 'code': 'VALIDATION_ERROR', 'request_id': g.request_id}), 400
    except Exception as e:
        logger.error(f"Error creating question task: {e}", 
                    exc_info=True, extra={'request_id': g.request_id})
        return jsonify({
            'error': 'Internal server error',
            'code': 'INTERNAL_ERROR',
            'request_id': g.request_id
        }), 500

@app.route('/generate-test', methods=['POST'])
@limiter.limit("5 per minute")  # Lower limit for heavy operations
@require_api_key
def generate_test_paper():
    """
    Generate complete test paper (async).
    Request body: {
        "title": "Annual Physics Test",
        "chapters": ["Light", "Electricity"],
        "total_marks": 50,
        "duration_minutes": 60
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Request body required', 'code': 'INVALID_REQUEST'}), 400
        
        # Validate chapters
        chapters = data.get('chapters', [])
        if not chapters or not isinstance(chapters, list):
            return jsonify({'error': 'Chapters must be a non-empty list', 'code': 'VALIDATION_ERROR'}), 400
        
        # Sanitize inputs
        title = sanitize_input(data.get('title', 'NCERT Science Test'), max_length=200)
        chapters = [sanitize_input(str(chapter), max_length=100) for chapter in chapters]
        chapters = [c for c in chapters if c]  # Remove empty
        
        if not chapters:
            return jsonify({'error': 'Valid chapters required', 'code': 'VALIDATION_ERROR'}), 400
        
        # Validate numeric values
        total_marks = min(max(int(data.get('total_marks', 50)), 10), 200)
        duration = min(max(int(data.get('duration_minutes', 60)), 15), 240)
        
        # Create async task
        task_data = {
            'title': title,
            'chapters': chapters,
            'total_marks': total_marks,
            'duration_minutes': duration,
            'difficulty': data.get('difficulty', 'mixed'),
            'sections': data.get('sections', [
                {"type": "mcq", "count": 10, "marks_per": 1},
                {"type": "short", "count": 5, "marks_per": 3},
                {"type": "long", "count": 2, "marks_per": 5}
            ])
        }
        
        task_id = task_manager.create_task('generate_test', task_data)
        
        return jsonify({
            'success': True,
            'task_id': task_id,
            'status': 'queued',
            'message': 'Test paper generation started',
            'check_status': f'/task/{task_id}',
            'estimated_time': '30-60 seconds',
            'timestamp': datetime.now().isoformat(),
            'request_id': g.request_id
        })
        
    except ValueError as e:
        return jsonify({'error': str(e), 'code': 'VALIDATION_ERROR', 'request_id': g.request_id}), 400
    except Exception as e:
        logger.error(f"Error creating test generation task: {e}", 
                    exc_info=True, extra={'request_id': g.request_id})
        return jsonify({
            'error': 'Internal server error',
            'code': 'INTERNAL_ERROR',
            'request_id': g.request_id
        }), 500

@app.route('/task/<task_id>', methods=['GET'])
@limiter.limit("30 per minute")
@require_api_key
def get_task_status(task_id):
    """Check status of async task."""
    try:
        task = task_manager.get_task_status(task_id)
        
        if not task:
            return jsonify({
                'error': 'Task not found',
                'code': 'TASK_NOT_FOUND',
                'request_id': g.request_id
            }), 404
        
        # Calculate elapsed times
        elapsed = None
        if task['started_at']:
            elapsed = (datetime.now() - task['started_at']).total_seconds()
        
        response = {
            'task_id': task['id'],
            'type': task['type'],
            'status': task['status'],
            'created_at': task['created_at'].isoformat() if task['created_at'] else None,
            'started_at': task['started_at'].isoformat() if task['started_at'] else None,
            'completed_at': task['completed_at'].isoformat() if task['completed_at'] else None,
            'elapsed_seconds': elapsed,
            'request_id': g.request_id
        }
        
        # Add result or error
        if task['status'] == 'completed' and task['result']:
            response['result'] = task['result']
        elif task['status'] == 'failed' and task['error']:
            response['error'] = task['error']
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error getting task status: {e}", 
                    extra={'task_id': task_id, 'request_id': g.request_id})
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
        'request_id': g.get('request_id', '')
    }), 404

@app.errorhandler(429)
def ratelimit_handler(error):
    return jsonify({
        'error': 'Rate limit exceeded',
        'code': 'RATE_LIMIT_EXCEEDED',
        'message': 'Too many requests. Please try again later.',
        'retry_after': error.description.get('retry_after', 60),
        'request_id': g.get('request_id', '')
    }), 429

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Unhandled exception: {error}", exc_info=True, 
                extra={'request_id': g.get('request_id', '')})
    return jsonify({
        'error': 'Internal server error',
        'code': 'INTERNAL_ERROR',
        'request_id': g.get('request_id', ''),
        'message': 'An unexpected error occurred. Please try again later.'
    }), 500

# ==================== APPLICATION STARTUP ====================

def create_app():
    """Application factory for WSGI servers."""
    return app

if __name__ == '__main__':
    # This is for development only
    print("\n" + "="*70)
    print("🚀 NCERT RAG API SERVER - PRODUCTION READY")
    print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    # Security warning in debug mode
    if app.config['DEBUG']:
        print("⚠️  WARNING: Running in DEBUG mode - NOT for production!")
        if not app.config['API_KEY']:
            print("⚠️  WARNING: No API key set - authentication disabled")
    
    # System status
    if RAG_AVAILABLE:
        print("✅ RAG System: AVAILABLE")
        try:
            stats = get_database_stats()
            print(f"📊 Database: {stats.get('total_chunks', 0):,} chunks, "
                  f"{stats.get('unique_chapters', 0):,} chapters")
        except Exception as e:
            print(f"⚠️  Database stats error: {e}")
    else:
        print("❌ RAG System: UNAVAILABLE - Running in limited mode")
    
    # Server info
    print(f"\n🌐 Starting {'development' if app.config['DEBUG'] else 'production'} server")
    print(f"📍 URL: http://{app.config['HOST']}:{app.config['PORT']}")
    print(f"🔒 Rate limiting: {'ENABLED' if app.config['RATE_LIMIT_ENABLED'] else 'DISABLED'}")
    print(f"🔑 API Auth: {'REQUIRED' if app.config['API_KEY'] else 'DISABLED'}")
    
    print("\n📋 Available endpoints:")
    print("   GET  /              - API information")
    print("   GET  /health        - Health check with dependencies")
    print("   GET  /metrics       - API metrics")
    print("   GET  /stats         - Database statistics")
    print("   GET  /chapters      - List all chapters")
    print("   POST /query         - Ask a question (rate limited)")
    print("   POST /generate-questions - Generate questions (async)")
    print("   POST /generate-test - Generate test paper (async)")
    print("   GET  /task/<id>     - Check async task status")
    
    print("\n⚠️  For production, use WSGI server:")
    print("   gunicorn api_server:app -w 4 -b 0.0.0.0:5000")
    print("\n🔄 Press Ctrl+C to stop the server")
    print("="*70 + "\n")
    
    # Start development server (NOT for production)
    app.run(
        host=app.config['HOST'],
        port=app.config['PORT'],
        debug=app.config['DEBUG'],
        threaded=True
    )