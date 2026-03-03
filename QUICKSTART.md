# RegCheck-India Quick Reference

## 🚀 Quick Start Commands

### Start the Application (Docker)
```bash
# 1. Set up environment
copy .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 2. Start all services
docker-compose up -d

# 3. Populate knowledge base
curl -X POST http://localhost:8000/api/kb/populate-sample

# 4. Access the app
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/docs
```

### Stop the Application
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f
```

## 📁 Project Structure

```
pharma project/
├── backend/          # FastAPI backend
│   ├── app/
│   │   ├── main.py              # API endpoints
│   │   ├── services/            # Core services
│   │   │   ├── document_parser.py
│   │   │   ├── knowledge_base.py
│   │   │   ├── rag_pipeline.py
│   │   │   └── evaluator.py
│   │   └── data/
│   │       └── sample_regulations.py
│   └── requirements.txt
│
├── frontend/         # Next.js frontend
│   ├── src/
│   │   ├── app/page.tsx         # Main UI
│   │   ├── components/          # UI components
│   │   └── services/api.ts      # API client
│   └── package.json
│
├── docker-compose.yml
├── README.md         # Full documentation
└── SETUP.md          # Setup instructions
```

## 🔑 Key Files to Configure

1. **`.env`** - Add your Anthropic API key
2. **`backend/app/data/sample_regulations.py`** - Add regulatory content
3. **`backend/app/services/evaluator.py`** - Customize Claude prompts

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/upload` | POST | Upload document |
| `/api/evaluate` | POST | Evaluate document |
| `/api/kb/stats` | GET | KB statistics |
| `/api/kb/populate-sample` | POST | Load sample data |

## 🎯 Usage Flow

1. **Upload** → Upload PDF/DOCX document
2. **Metadata** → Fill in document details
3. **Evaluate** → Click "Evaluate Document"
4. **Review** → Check findings and export JSON

## 🛠️ Troubleshooting

### Port Already in Use
Edit `.env`:
```
BACKEND_PORT=8001
FRONTEND_PORT=3001
```

### Claude API Errors
- Verify API key in `.env`
- Check Anthropic account credits
- Ensure model name is correct

### ChromaDB Errors
```bash
mkdir -p backend/data/chromadb
docker-compose down -v
docker-compose up -d
```

## 📝 Supported Document Types

- Clinical Study Protocol
- Informed Consent Form
- Clinical Study Report
- Investigator's Brochure
- CTRI Registration Form
- CT-04 Form

## 🔍 Compliance Status Codes

- **PASS** ✅ - Meets requirement
- **PARTIAL** ⚠️ - Partially meets requirement
- **FAIL** ❌ - Does not meet requirement
- **UNVERIFIED** ❓ - Cannot verify from context
- **NOT APPLICABLE** - Not applicable

## 📚 Regulatory Coverage (Sample Data)

- NDCTR 2019 (Rules 7, 16, 18, 22)
- CDSCO BA/BE Guidelines
- ICH E6(R3) GCP
- CTRI Registration Requirements
- Schedule Y Phase Definitions

## 🔐 Environment Variables

```bash
ANTHROPIC_API_KEY=your_key_here
BACKEND_PORT=8000
FRONTEND_PORT=3000
CHROMADB_PATH=./backend/data/chromadb
MAX_UPLOAD_SIZE_MB=50
```

## 📦 Dependencies

**Backend:**
- Python 3.11+
- FastAPI, Anthropic, ChromaDB
- PyPDF2, python-docx

**Frontend:**
- Node 20+
- Next.js 14, React 18
- TypeScript, Tailwind CSS

## 🚨 Important Notes

⚠️ This is a QA tool, not a regulatory authority
⚠️ All findings require human review
⚠️ No approval guarantee
⚠️ Always verify citations

---

**Need Help?** Check [README.md](file:///c:/Users/Utkarsh/Desktop/pharma%20project/README.md) or [SETUP.md](file:///c:/Users/Utkarsh/Desktop/pharma%20project/SETUP.md)
