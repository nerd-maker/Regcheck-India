import os
import sys
import chromadb
from chromadb.utils import embedding_functions
import PyPDF2
from pathlib import Path

# Config
DOCUMENTS_DIR = Path(__file__).parent / "documents"
CHROMADB_PATH = os.getenv("CHROMADB_PATH", "./data/chromadb")
COLLECTION_NAME = "regulatory_documents"
CHUNK_SIZE = 500        # words per chunk
CHUNK_OVERLAP = 50      # overlapping words between chunks

# Document metadata mapping
DOCUMENT_METADATA = {
    "NEW DRUGS ANDctrS RULE, 2019.PDF": {
        "title": "New Drugs and Clinical Trials Rules 2019",
        "short_name": "NDCTR 2019",
        "category": "Indian Regulation",
        "authority": "CDSCO"
    },
    "Clinical (1).pdf": {
        "title": "CDSCO Good Clinical Practice Guidelines",
        "short_name": "CDSCO GCP",
        "category": "Indian Regulation",
        "authority": "CDSCO"
    },
    "ICMR_National_Ethical_Guidelines.pdf": {
        "title": "ICMR National Ethical Guidelines for Biomedical Research",
        "short_name": "ICMR Guidelines",
        "category": "Indian Regulation",
        "authority": "ICMR"
    },
    "E2A_Guideline.pdf": {
        "title": "ICH E2A Clinical Safety Data Management",
        "short_name": "ICH E2A",
        "category": "ICH Guideline",
        "authority": "ICH"
    },
    "ICH_E6(R3)_Step4_FinalGuideline_2025_0106.pdf": {
        "title": "ICH E6(R3) Good Clinical Practice",
        "short_name": "ICH E6(R3)",
        "category": "ICH Guideline",
        "authority": "ICH"
    },
    "Clinical.pdf": {
        "title": "Schedule Y - Drugs and Cosmetics Act",
        "short_name": "Schedule Y",
        "category": "Indian Regulation",
        "authority": "CDSCO"
    }
}

def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract full text from PDF."""
    text = ""
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            print(f"  Pages: {len(reader.pages)}")
            for i, page in enumerate(reader.pages):
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text += f"\n[Page {i+1}]\n{page_text}"
                except Exception as e:
                    print(f"  Warning: Could not extract page {i+1}: {e}")
    except Exception as e:
        print(f"  ERROR extracting PDF: {e}")
    return text

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split text into overlapping word chunks."""
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        start += chunk_size - overlap
    return chunks

def load_documents():
    """Main function to load all documents into ChromaDB."""
    print(f"\nChromaDB path: {CHROMADB_PATH}")
    print(f"Documents dir: {DOCUMENTS_DIR}\n")

    # Initialize ChromaDB
    client = chromadb.PersistentClient(path=CHROMADB_PATH)
    
    # Use default embedding function
    embedding_fn = embedding_functions.DefaultEmbeddingFunction()
    
    # Get or create collection
    try:
        client.delete_collection(COLLECTION_NAME)
        print(f"Deleted existing collection: {COLLECTION_NAME}")
    except:
        pass
    
    collection = client.create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
        metadata={"hnsw:space": "cosine"}
    )
    print(f"Created collection: {COLLECTION_NAME}\n")

    total_chunks = 0

    for filename, metadata in DOCUMENT_METADATA.items():
        pdf_path = DOCUMENTS_DIR / filename
        
        if not pdf_path.exists():
            print(f"SKIPPING (not found): {filename}")
            continue
        
        print(f"Loading: {metadata['title']}")
        
        # Extract text
        text = extract_text_from_pdf(pdf_path)
        if not text.strip():
            print(f"  WARNING: No text extracted from {filename}")
            continue
        
        print(f"  Extracted {len(text.split())} words")
        
        # Chunk text
        chunks = chunk_text(text)
        print(f"  Created {len(chunks)} chunks")
        
        # Load chunks into ChromaDB in batches of 50
        batch_size = 50
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            ids = [f"{filename}_{i+j}" for j in range(len(batch))]
            metadatas = [
                {
                    "source": filename,
                    "title": metadata["title"],
                    "short_name": metadata["short_name"],
                    "category": metadata["category"],
                    "authority": metadata["authority"],
                    "chunk_index": i + j
                }
                for j in range(len(batch))
            ]
            collection.add(
                documents=batch,
                ids=ids,
                metadatas=metadatas
            )
        
        total_chunks += len(chunks)
        print(f"  [SUCCESS] Loaded {len(chunks)} chunks into ChromaDB\n")

    print(f"\n{'='*50}")
    print(f"DONE. Total chunks loaded: {total_chunks}")
    print(f"Collection '{COLLECTION_NAME}' ready for querying.")
    print(f"{'='*50}\n")

if __name__ == "__main__":
    load_documents()
