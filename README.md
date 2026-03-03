# RegCheck-India

**AI-Powered Pharmaceutical Regulatory Compliance Evaluation for Indian Regulations**

RegCheck-India is a specialized regulatory compliance system that evaluates pharmaceutical and clinical trial documents against Indian regulatory requirements using Claude AI, RAG (Retrieval-Augmented Generation), and a comprehensive regulatory knowledge base.

## 🎯 Features

- **Document Upload & Parsing**: Support for PDF and DOCX files with intelligent section extraction
- **RAG-Powered Evaluation**: Semantic search through regulatory knowledge base for relevant requirements
- **Claude AI Analysis**: Structured compliance evaluation with mandatory citations
- **Comprehensive Coverage**: NDCTR 2019, CDSCO Guidelines, ICH E6(R3), Schedule Y, CTRI Requirements
- **Structured JSON Output**: Detailed findings with status, gaps, recommendations, and human review flags
- **Modern Web Interface**: Next.js frontend with real-time evaluation and results visualization

## 📋 Supported Document Types

- Clinical Study Protocols
- Informed Consent Forms (ICF)
- Clinical Study Reports (CSR)
- Investigator's Brochures (IB)
- CTRI Registration Forms
- CT-04 Forms

## 🏗️ Architecture

```
RegCheck-India/
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── main.py            # FastAPI application
│   │   ├── core/
│   │   │   └── config.py      # Configuration management
│   │   ├── models/
│   │   │   └── schemas.py     # Pydantic models
│   │   ├── services/
│   │   │   ├── document_parser.py    # PDF/DOCX parsing
│   │   │   ├── knowledge_base.py     # ChromaDB management
│   │   │   ├── rag_pipeline.py       # RAG retrieval
│   │   │   └── evaluator.py          # Claude AI evaluator
│   │   └── data/
│   │       └── sample_regulations.py # Sample regulatory data
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                   # Next.js Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx       # Main application page
│   │   │   └── layout.tsx     # Root layout
│   │   ├── components/
│   │   │   ├── DocumentUpload.tsx    # File upload component
│   │   │   ├── MetadataForm.tsx      # Metadata input form
│   │   │   └── ResultsViewer.tsx     # Results display
│   │   └── services/
│   │       └── api.ts         # API client
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Anthropic API Key (for Claude)

### Setup

1. **Clone the repository** (or navigate to the project directory):
   ```bash
   cd "c:\Users\Utkarsh\Desktop\pharma project"
   ```

2. **Create environment file**:
   ```bash
   copy .env.example .env
   ```

3. **Add your Anthropic API key** to `.env`:
   ```
   ANTHROPIC_API_KEY=your_claude_api_key_here
   ```

4. **Start the application**:
   ```bash
   docker-compose up -d
   ```

5. **Populate the knowledge base** with sample regulatory data:
   ```bash
   curl -X POST http://localhost:8000/api/kb/populate-sample
   ```

6. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## 💻 Local Development (Without Docker)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
set ANTHROPIC_API_KEY=your_key_here

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set environment variable
set NEXT_PUBLIC_API_URL=http://localhost:8000

# Run development server
npm run dev
```

## 📚 API Endpoints

### Health Check
```
GET /
```

### Upload Document
```
POST /api/upload
Content-Type: multipart/form-data
Body: file (PDF or DOCX)
```

### Evaluate Document
```
POST /api/evaluate
Content-Type: multipart/form-data
Body: 
  - file_id: string
  - metadata: JSON string
```

### Knowledge Base Stats
```
GET /api/kb/stats
```

### Populate Sample KB
```
POST /api/kb/populate-sample
```

## 🗄️ Populating the Regulatory Knowledge Base

The system includes sample regulatory data for testing. For production use:

1. **Prepare regulatory documents** in text format with proper citations
2. **Create document chunks** with metadata:
   ```python
   {
       "id": "unique_id",
       "text": "Regulatory text content",
       "source": "NDCTR 2019",
       "citation": "Rule 18",
       "document_type": "informed_consent",
       "metadata": {"additional": "info"}
   }
   ```
3. **Add to knowledge base** via API or directly in code

## 🎨 Frontend Usage

1. **Upload Document**: Drag and drop or click to select PDF/DOCX file
2. **Enter Metadata**: Fill in document type, sponsor, drug name, phase, etc.
3. **Evaluate**: Click "Evaluate Document" to start compliance check
4. **Review Results**: 
   - Overall status and risk level
   - Detailed findings with citations
   - Critical blockers and missing sections
   - Export results as JSON

## ⚠️ Important Disclaimers

- **Quality Assurance Tool**: This system is designed to assist with regulatory compliance review, NOT to replace qualified regulatory professionals
- **No Approval Guarantee**: Passing all checks does not guarantee CDSCO approval
- **Human Review Required**: All findings should be reviewed by regulatory experts
- **Citation Accuracy**: Always verify citations against original regulatory documents

## 🔧 Configuration

Key configuration options in `.env`:

```bash
# Claude AI
ANTHROPIC_API_KEY=your_key_here
CLAUDE_MODEL=claude-3-5-sonnet-20241022

# Server
BACKEND_PORT=8000
FRONTEND_PORT=3000

# Database
CHROMADB_PATH=./backend/data/chromadb

# File Upload
MAX_UPLOAD_SIZE_MB=50

# RAG
RAG_TOP_K=10
RAG_SIMILARITY_THRESHOLD=0.7
```

## 📖 Regulatory Coverage

### Current Sample Data Includes:

- **NDCTR 2019**: Informed Consent (Rule 18), Protocol Requirements (Rule 22), SAE Reporting (Rule 16), Ethics Committee (Rule 7)
- **CDSCO BA/BE Guidelines**: Study design, subject selection, sample collection
- **ICH E6(R3)**: Investigator responsibilities, medical care of subjects
- **CTRI**: Registration requirements and timeline
- **Schedule Y**: Clinical trial phase definitions

### To Add More Regulations:

Edit `backend/app/data/sample_regulations.py` or create a new data ingestion script.

## 🛠️ Technology Stack

**Backend:**
- FastAPI (Python web framework)
- Anthropic Claude 3.5 Sonnet (LLM)
- ChromaDB (Vector database)
- PyPDF2 & python-docx (Document parsing)
- Pydantic (Data validation)

**Frontend:**
- Next.js 14 (React framework)
- TypeScript (Type safety)
- Tailwind CSS (Styling)
- Axios (HTTP client)
- React Dropzone (File upload)

## 📝 License

This project is provided as-is for regulatory compliance assistance purposes.

## 🤝 Contributing

To add new regulatory requirements:
1. Add regulatory text to knowledge base with proper citations
2. Update document type mappings if needed
3. Test evaluation with sample documents

## 📧 Support

For issues or questions, please review the API documentation at http://localhost:8000/docs

---

**Built with ❤️ for Indian Pharmaceutical Regulatory Compliance**
