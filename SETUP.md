# RegCheck-India Setup Guide

## Quick Setup Instructions

### Step 1: Configure Environment

1. Copy the example environment file:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and add your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=your_actual_claude_api_key_here
   ```

### Step 2: Start with Docker (Recommended)

```bash
# Build and start all services
docker-compose up -d

# Wait for services to start (about 30 seconds)

# Populate the knowledge base with sample regulatory data
curl -X POST http://localhost:8000/api/kb/populate-sample

# Or using PowerShell:
Invoke-WebRequest -Uri http://localhost:8000/api/kb/populate-sample -Method POST
```

### Step 3: Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### Step 4: Test the System

1. Open http://localhost:3000
2. Upload a sample pharmaceutical document (PDF or DOCX)
3. Fill in the metadata form
4. Click "Evaluate Document"
5. Review the compliance findings

## Alternative: Local Development Setup

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file in backend directory
echo ANTHROPIC_API_KEY=your_key_here > .env

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup (in a new terminal)

```bash
cd frontend

# Install dependencies
npm install

# Set environment variable
# Windows:
set NEXT_PUBLIC_API_URL=http://localhost:8000
# Linux/Mac:
export NEXT_PUBLIC_API_URL=http://localhost:8000

# Run development server
npm run dev
```

### Populate Knowledge Base

```bash
# In a new terminal, run:
curl -X POST http://localhost:8000/api/kb/populate-sample

# Or visit http://localhost:8000/docs and use the interactive API
```

## Troubleshooting

### Docker Issues

If Docker services fail to start:
```bash
# Stop all services
docker-compose down

# Remove volumes
docker-compose down -v

# Rebuild and restart
docker-compose up -d --build
```

### Port Already in Use

If ports 3000 or 8000 are already in use, edit `docker-compose.yml` or `.env`:
```
BACKEND_PORT=8001
FRONTEND_PORT=3001
```

### ChromaDB Errors

If you see ChromaDB errors, ensure the data directory exists:
```bash
mkdir -p backend/data/chromadb
```

### Claude API Errors

- Verify your API key is correct in `.env`
- Check your Anthropic account has credits
- Ensure you're using a valid Claude model (claude-3-5-sonnet-20241022)

## Next Steps

1. **Add Real Regulatory Documents**: Replace sample data with actual NDCTR 2019, CDSCO guidelines, etc.
2. **Test with Real Documents**: Upload actual protocols, ICFs, CSRs to validate accuracy
3. **Customize Prompts**: Adjust Claude prompts in `backend/app/services/evaluator.py` if needed
4. **Deploy to Production**: Use Railway, Render, or AWS for production deployment

## Production Deployment Checklist

- [ ] Replace sample regulatory data with complete regulations
- [ ] Set strong API keys and secrets
- [ ] Configure proper CORS origins
- [ ] Set up database backups (ChromaDB data)
- [ ] Enable HTTPS
- [ ] Set up monitoring and logging
- [ ] Add rate limiting
- [ ] Configure file size limits appropriately
- [ ] Add user authentication if needed
- [ ] Review and test all compliance findings manually

## Support

For issues:
1. Check the logs: `docker-compose logs -f`
2. Review API documentation: http://localhost:8000/docs
3. Verify environment variables are set correctly
4. Ensure all dependencies are installed

---

**Ready to evaluate pharmaceutical documents for Indian regulatory compliance!**
