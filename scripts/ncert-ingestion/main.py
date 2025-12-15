# product/scripts/ncert-ingestion/main.py

"""
NCERT RAG API - Main FastAPI Application
Entry point for the Retrieval Augmented Generation system
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.openapi.utils import get_openapi
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
import uvicorn
import os
import logging
import time
import json
from contextlib import asynccontextmanager
from typing import Dict, Any
from datetime import datetime
import asyncio

# Load environment variables first
from dotenv import load_dotenv
load_dotenv()

# Import routes
from routes import chat, test_gen, upload
from app_dependencies import API_PREFIX

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('ncert_rag_api.log')
    ]
)
logger = logging.getLogger(__name__)

# ============== LIFECYCLE MANAGEMENT ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle management
    Handles startup and shutdown events
    """
    # Startup
    startup_time = datetime.utcnow()
    logger.info(f"🚀 NCERT RAG API Starting Up - {startup_time}")
    
    # Initialize services
    try:
        # Health checks for external services
        from app_dependencies import get_rag_system
        rag = get_rag_system()
        
        # Test database connection
        test_result = await rag.supabase.table("document_chunks").select("count", count="exact").limit(1).execute()
        logger.info(f"✅ Database connection established")
        
        # Log startup configuration
        config_summary = {
            "environment": os.getenv("ENVIRONMENT", "development"),
            "port": os.getenv("PORT", 8000),
            "api_prefix": API_PREFIX,
            "supabase_connected": True,
            "startup_time": startup_time.isoformat()
        }
        logger.info(f"📊 Startup Configuration: {json.dumps(config_summary, indent=2)}")
        
    except Exception as e:
        logger.error(f"❌ Startup failed: {str(e)}", exc_info=True)
        # Don't raise - let app start but log error
    
    yield
    
    # Shutdown
    shutdown_time = datetime.utcnow()
    logger.info(f"🛑 NCERT RAG API Shutting Down - {shutdown_time}")
    
    # Cleanup resources
    # Close database connections, etc.
    logger.info("✅ Cleanup completed")

# ============== APPLICATION CONFIGURATION ==============

def custom_openapi():
    """Custom OpenAPI schema configuration"""
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    
    # Customize OpenAPI schema
    openapi_schema["info"]["contact"] = {
        "name": "NCERT RAG API Support",
        "email": "support@ncertrag.com",
        "url": "https://ncertrag.com"
    }
    
    openapi_schema["info"]["license"] = {
        "name": "Proprietary",
        "url": "https://ncertrag.com/license"
    }
    
    # Add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "APIKeyHeader": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key",
            "description": "API Key for authentication"
        },
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "JWT token for authentication"
        }
    }
    
    # Global security requirement
    openapi_schema["security"] = [{"APIKeyHeader": []}]
    
    # Add server information
    openapi_schema["servers"] = [
        {
            "url": "http://localhost:8000",
            "description": "Development server"
        },
        {
            "url": "https://api.ncertschool.com/v1",
            "description": "Production server"
        }
    ]
    
    # Add tags metadata
    openapi_schema["tags"] = [
        {
            "name": "Chat",
            "description": "NCERT Q&A and conversational endpoints"
        },
        {
            "name": "Test Generation",
            "description": "Generate NCERT-aligned test papers and questions"
        },
        {
            "name": "Upload",
            "description": "Document ingestion and management endpoints"
        },
        {
            "name": "System",
            "description": "System health and monitoring endpoints"
        }
    ]
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

# ============== FASTAPI APP INITIALIZATION ==============

app = FastAPI(
    title="NCERT RAG API",
    description="""
    # NCERT Retrieval Augmented Generation API
    
    ## Overview
    Advanced RAG system for NCERT-aligned educational content.
    
    ### Key Features:
    - 📚 NCERT textbook content retrieval via vector similarity
    - 🧠 Intelligent test generation aligned with curriculum
    - 🔍 Semantic search across educational materials
    - 📄 Multi-format document ingestion (PDF, DOCX, TXT)
    - 🎯 Context-aware question answering
    
    ### Authentication:
    - API Key: Add `X-API-Key: your-api-key` header
    - JWT Token: Add `Authorization: Bearer your-jwt-token` header
    
    ### Rate Limits:
    - Free Tier: 100 requests/day
    - Pro Tier: 10,000 requests/day
    - Enterprise: Custom limits
    
    ### Support:
    - Email: support@ncertrag.com
    - Documentation: https://docs.ncertschool.com
    - Status: https://status.ncertschool.com
    
    ---
    
    *Built for educational institutions, teachers, and edtech platforms.*
    """,
    version="2.0.0",
    docs_url=None,  # We'll customize these
    redoc_url=None,
    openapi_url="/openapi.json",
    lifespan=lifespan,
    contact={
        "name": "NCERT RAG API Team",
        "email": "api@ncertrag.com",
        "url": "https://ncertrag.com/contact"
    },
    license_info={
        "name": "Proprietary",
        "url": "https://ncertrag.com/terms"
    },
    terms_of_service="https://ncertrag.com/terms",
)

# Custom OpenAPI schema
app.openapi = custom_openapi

# ============== MIDDLEWARE CONFIGURATION ==============

# CORS Configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
if "*" not in allowed_origins:
    allowed_origins = [origin.strip() for origin in allowed_origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-API-Key",
        "X-Request-ID",
        "X-Client-Version",
        "Accept",
        "Accept-Language"
    ],
    expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    max_age=3600,  # 1 hour
)

# Security middleware
if os.getenv("ENVIRONMENT") == "production":
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["api.ncertschool.com", "localhost", "127.0.0.1"]
    )

# Compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time to response headers"""
    start_time = time.time()
    
    # Generate request ID if not present
    request_id = request.headers.get("X-Request-ID") or f"req_{int(time.time())}_{hash(request.url.path) % 10000}"
    
    # Log request
    logger.info(
        f"📥 {request.method} {request.url.path} - "
        f"ID: {request_id} - "
        f"Client: {request.client.host if request.client else 'unknown'}"
    )
    
    response = await call_next(request)
    
    # Add headers
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    response.headers["X-Request-ID"] = request_id
    response.headers["X-API-Version"] = app.version
    
    # Log response
    logger.info(
        f"📤 {request.method} {request.url.path} - "
        f"ID: {request_id} - "
        f"Status: {response.status_code} - "
        f"Time: {process_time:.3f}s"
    )
    
    return response

# ============== EXCEPTION HANDLERS ==============

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors"""
    logger.warning(f"Validation error: {exc.errors()}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "VALIDATION_ERROR",
            "message": "Request validation failed",
            "details": exc.errors(),
            "path": request.url.path,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions"""
    error_id = f"err_{int(time.time())}_{hash(str(exc)) % 10000}"
    
    logger.error(
        f"Unhandled exception - ID: {error_id}, "
        f"Path: {request.url.path}, "
        f"Error: {str(exc)}",
        exc_info=True
    )
    
    # In production, you might want to notify monitoring service
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred",
            "error_id": error_id,
            "path": request.url.path,
            "timestamp": datetime.utcnow().isoformat(),
            "support": "support@ncertrag.com"
        }
    )

# ============== ROUTE INCLUSION ==============

# Include routers with tags
app.include_router(chat.router, prefix=f"{API_PREFIX}", tags=["Chat"])
app.include_router(test_gen.router, prefix=f"{API_PREFIX}", tags=["Test Generation"])
app.include_router(upload.router, prefix=f"{API_PREFIX}", tags=["Upload"])

# ============== SYSTEM ENDPOINTS ==============

@app.get("/", include_in_schema=False)
async def root():
    """Root endpoint - API information"""
    return {
        "message": "NCERT RAG API",
        "version": app.version,
        "description": "Retrieval Augmented Generation for NCERT Education",
        "documentation": "/docs",
        "openapi": "/openapi.json",
        "health": "/health",
        "endpoints": {
            "chat": f"{API_PREFIX}/chat",
            "test_generation": f"{API_PREFIX}/generate-test",
            "upload": f"{API_PREFIX}/upload",
            "system": "/system"
        },
        "timestamp": datetime.utcnow().isoformat(),
        "uptime": f"{(datetime.utcnow() - app.extra.get('startup_time', datetime.utcnow())).total_seconds():.0f}s"
    }

@app.get("/health", tags=["System"])
async def health_check():
    """Comprehensive health check endpoint"""
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "ncert-rag-api",
        "version": app.version,
        "environment": os.getenv("ENVIRONMENT", "development"),
        "checks": {}
    }
    
    # Database health check
    try:
        from app_dependencies import get_rag_system
        rag = get_rag_system()
        test_result = await rag.supabase.table("document_chunks").select("count", count="exact").limit(1).execute()
        health_status["checks"]["database"] = {
            "status": "healthy",
            "details": f"Connected to Supabase. Chunks: {test_result.count if hasattr(test_result, 'count') else 'N/A'}"
        }
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["checks"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # OpenAI health check
    try:
        import openai
        openai.api_key = os.getenv("OPENAI_API_KEY")
        models = openai.Model.list()
        health_status["checks"]["openai"] = {
            "status": "healthy",
            "details": f"Connected. Available models: {len(models.data)}"
        }
    except Exception as e:
        health_status["status"] = "degraded"
        health_status["checks"]["openai"] = {
            "status": "unhealthy",
            "error": str(e)
        }
    
    # Memory health check
    import psutil
    memory = psutil.virtual_memory()
    health_status["checks"]["memory"] = {
        "status": "healthy" if memory.percent < 90 else "warning",
        "details": f"{memory.percent}% used ({memory.used // (1024**3)}GB/{memory.total // (1024**3)}GB)"
    }
    
    # Disk health check
    disk = psutil.disk_usage('/')
    health_status["checks"]["disk"] = {
        "status": "healthy" if disk.percent < 90 else "warning",
        "details": f"{disk.percent}% used ({disk.used // (1024**3)}GB/{disk.total // (1024**3)}GB)"
    }
    
    return health_status

@app.get("/metrics", tags=["System"])
async def metrics():
    """Basic metrics endpoint (Prometheus format)"""
    
    import psutil
    
    metrics_lines = [
        "# HELP ncert_api_info API information",
        "# TYPE ncert_api_info gauge",
        f'ncert_api_info{{version="{app.version}",env="{os.getenv("ENVIRONMENT", "development")}"}} 1',
        "",
        "# HELP ncert_api_requests_total Total requests processed",
        "# TYPE ncert_api_requests_total counter",
        f'ncert_api_requests_total{{endpoint="/health"}} 0',  # Placeholder
        "",
        "# HELP ncert_api_memory_usage Memory usage in bytes",
        "# TYPE ncert_api_memory_usage gauge",
        f'ncert_api_memory_usage {psutil.Process().memory_info().rss}',
        "",
        "# HELP ncert_api_cpu_usage CPU usage percentage",
        "# TYPE ncert_api_cpu_usage gauge",
        f'ncert_api_cpu_usage {psutil.cpu_percent()}',
    ]
    
    return "\n".join(metrics_lines)

@app.get("/system", tags=["System"])
async def system_info():
    """System information and configuration"""
    
    from app_dependencies import get_rag_system
    
    rag = get_rag_system()
    
    # Get database stats
    try:
        chunks_result = await rag.supabase.table("document_chunks").select("count", count="exact").execute()
        chunks_count = chunks_result.count if hasattr(chunks_result, 'count') else "N/A"
    except:
        chunks_count = "Error fetching"
    
    return {
        "system": {
            "name": "NCERT RAG API",
            "version": app.version,
            "environment": os.getenv("ENVIRONMENT", "development"),
            "startup_time": app.extra.get("startup_time", "unknown"),
            "python_version": os.sys.version,
            "hostname": os.uname().nodename if hasattr(os, 'uname') else "unknown"
        },
        "configuration": {
            "api_prefix": API_PREFIX,
            "allowed_origins": allowed_origins,
            "port": os.getenv("PORT", 8000),
            "max_file_size": os.getenv("MAX_FILE_SIZE", "50MB"),
            "rate_limit_enabled": os.getenv("RATE_LIMIT_ENABLED", "false")
        },
        "database": {
            "vector_chunks_count": chunks_count,
            "embedding_model": rag.embedding_model,
            "completion_model": rag.completion_model,
            "top_k": rag.top_k
        },
        "performance": {
            "concurrent_requests": len(asyncio.all_tasks()) - 1,
            "memory_usage_mb": psutil.Process().memory_info().rss // (1024 * 1024)
        },
        "endpoints": {
            "total_routes": len(app.routes),
            "chat_endpoints": len([r for r in app.routes if "chat" in r.path]),
            "test_gen_endpoints": len([r for r in app.routes if "generate-test" in r.path]),
            "upload_endpoints": len([r for r in app.routes if "upload" in r.path])
        }
    }

# ============== CUSTOM DOCS ENDPOINTS ==============

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    """Custom Swagger UI"""
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - Swagger UI",
        swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
        swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css",
        swagger_favicon_url="https://fastapi.tiangolo.com/img/favicon.png",
        oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
        init_oauth=app.swagger_ui_init_oauth,
    )

@app.get("/redoc", include_in_schema=False)
async def custom_redoc_html():
    """Custom ReDoc UI"""
    return get_redoc_html(
        openapi_url=app.openapi_url,
        title=f"{app.title} - ReDoc",
        redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js",
        with_google_fonts=False
    )

# ============== APPLICATION STARTUP ==============

def start_server():
    """Start the FastAPI server"""
    
    # Configuration
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    reload_enabled = os.getenv("ENVIRONMENT") == "development"
    
    # Startup banner
    banner = f"""
    ╔══════════════════════════════════════════════════════════╗
    ║                 NCERT RAG API v{app.version:<10}                 ║
    ╠══════════════════════════════════════════════════════════╣
    ║  Environment: {os.getenv("ENVIRONMENT", "development"):<43} ║
    ║  Server:      {host}:{port:<38} ║
    ║  API Prefix:  {API_PREFIX:<43} ║
    ║  Auto-reload: {str(reload_enabled):<43} ║
    ╠══════════════════════════════════════════════════════════╣
    ║  📚 Documentation: http://{host}:{port}/docs             ║
    ║  📖 API Schema:    http://{host}:{port}/openapi.json     ║
    ║  🩺 Health Check:  http://{host}:{port}/health           ║
    ║  📊 Metrics:       http://{host}:{port}/metrics          ║
    ╚══════════════════════════════════════════════════════════╝
    
    🚀 Server starting... Press Ctrl+C to stop
    """
    
    print(banner)
    
    # Start server
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload_enabled,
        log_level="info",
        access_log=True,
        timeout_keep_alive=30,
        limit_concurrency=100,
        limit_max_requests=1000
    )

if __name__ == "__main__":
    start_server()