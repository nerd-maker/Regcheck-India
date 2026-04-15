"""
Regulatory Corpus Builder

Builds and maintains the regulatory knowledge base for RAG retrieval.
Ensures every chunk has full metadata for citation traceability.
"""

import os
import hashlib
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path
import re
from pypdf import PdfReader

from chromadb import Client
from chromadb.config import Settings


class RegulatoryCorpusBuilder:
    """
    Build and maintain regulatory corpus with full metadata
    
    Features:
    - Document ingestion with version tracking
    - Chunk-level metadata for citations
    - Multiple chunking strategies
    - Ingestion verification
    """
    
    def __init__(self, chroma_client: Client, collection_name: str = "regulatory_knowledge"):
        self.client = chroma_client
        self.collection = chroma_client.get_or_create_collection(
            name=collection_name,
            metadata={"description": "Indian regulatory requirements for clinical trials"}
        )
        
        # Source document registry
        self.source_registry = {
            "NDCTR_2019": {
                "name": "New Drugs and Clinical Trials Rules, 2019",
                "url": "https://cdsco.gov.in/opencms/opencms/en/Clinical-Trial/New-Drugs-and-Clinical-Trials-Rules-2019/",
                "version": "March 19, 2019 (with 2023 amendments)",
                "effective_date": "2019-03-19",
                "jurisdiction": "India",
                "chunking_strategy": "rule_by_rule"
            },
            "BABE_2018": {
                "name": "CDSCO BA/BE Guidelines",
                "url": "https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/biologicals/BABE_Guidelines_2018.pdf",
                "version": "2018 (Revised)",
                "effective_date": "2018-01-01",
                "jurisdiction": "India",
                "chunking_strategy": "section_by_section"
            },
            "ICH_E6_R3": {
                "name": "ICH E6(R3) Good Clinical Practice",
                "url": "https://database.ich.org/sites/default/files/ICH_E6-R3_GCP-Principles_Draft_2023.pdf",
                "version": "R3 (Draft adopted by CDSCO 2023)",
                "effective_date": "2023-01-01",
                "jurisdiction": "India",
                "chunking_strategy": "section_by_section"
            },
            "SCHEDULE_Y": {
                "name": "Schedule Y (Drugs and Cosmetics Rules)",
                "url": "https://cdsco.gov.in/opencms/opencms/en/Drugs/Schedule-Y/",
                "version": "2019 (Revised)",
                "effective_date": "2019-01-01",
                "jurisdiction": "India",
                "chunking_strategy": "appendix_by_appendix"
            },
            "CTRI_GUIDELINES": {
                "name": "CTRI Registration Guidelines",
                "url": "http://ctri.nic.in/Clinicaltrials/guidelines.php",
                "version": "2023",
                "effective_date": "2023-01-01",
                "jurisdiction": "India",
                "chunking_strategy": "field_by_field"
            },
            "ICMR_ETHICS_2017": {
                "name": "ICMR National Ethical Guidelines",
                "url": "https://ethics.ncdirindia.org/asset/pdf/ICMR_National_Ethical_Guidelines.pdf",
                "version": "2017",
                "effective_date": "2017-01-01",
                "jurisdiction": "India",
                "chunking_strategy": "section_by_section"
            }
        }
    
    def ingest_document(
        self,
        source_key: str,
        file_path: str,
        force_reingest: bool = False
    ) -> Dict:
        """
        Ingest a regulatory document into ChromaDB
        
        Args:
            source_key: Key from source_registry
            file_path: Path to PDF file
            force_reingest: If True, delete existing chunks and re-ingest
            
        Returns:
            Ingestion report with stats
        """
        
        if source_key not in self.source_registry:
            raise ValueError(f"Unknown source: {source_key}")
        
        source_info = self.source_registry[source_key]
        
        print(f"\n{'='*60}")
        print(f"Ingesting: {source_info['name']}")
        print(f"Version: {source_info['version']}")
        print(f"{'='*60}\n")
        
        # Check if already ingested
        if not force_reingest:
            existing = self._check_existing(source_key)
            if existing:
                print(f"⚠️  Document already ingested ({existing} chunks)")
                print(f"Use force_reingest=True to re-ingest")
                return {"status": "skipped", "reason": "already_ingested"}
        
        # Parse document
        print("📄 Parsing document...")
        sections = self._parse_pdf(file_path, source_info['chunking_strategy'])
        print(f"✓ Extracted {len(sections)} sections")
        
        # Chunk sections
        print("\n✂️  Chunking sections...")
        all_chunks = []
        for section in sections:
            chunks = self._chunk_section(section, source_info['chunking_strategy'])
            all_chunks.extend(chunks)
        print(f"✓ Created {len(all_chunks)} chunks")
        
        # Add to ChromaDB
        print("\n💾 Adding to ChromaDB...")
        added_count = 0
        
        for i, chunk in enumerate(all_chunks):
            metadata = {
                "chunk_id": f"{source_key}_{chunk['section_id']}_C{chunk['chunk_index']}",
                "source_doc": source_info['name'],
                "source_key": source_key,
                "source_url": source_info['url'],
                "version": source_info['version'],
                "effective_date": source_info['effective_date'],
                "jurisdiction": source_info['jurisdiction'],
                "section": chunk['section_number'],
                "subsection": chunk.get('subsection', ''),
                "chapter": chunk.get('chapter', ''),
                "title": chunk['title'],
                "chunk_index": chunk['chunk_index'],
                "total_chunks": chunk['total_chunks'],
                "last_verified": datetime.now().isoformat(),
                "citation_format": f"[SOURCE: {source_info['name']}, {chunk['section_number']}]"
            }
            
            chunk_id = metadata["chunk_id"]
            
            try:
                self.collection.add(
                    documents=[chunk['text']],
                    metadatas=[metadata],
                    ids=[chunk_id]
                )
                added_count += 1
                
                if (i + 1) % 10 == 0:
                    print(f"  Added {i + 1}/{len(all_chunks)} chunks...")
                    
            except Exception as e:
                print(f"❌ Error adding chunk {chunk_id}: {e}")
        
        print(f"\n✓ Successfully added {added_count}/{len(all_chunks)} chunks")
        
        # Verify ingestion
        print("\n🔍 Verifying ingestion...")
        verification = self._verify_ingestion(source_key)
        
        return {
            "status": "success",
            "source": source_info['name'],
            "sections_parsed": len(sections),
            "chunks_created": len(all_chunks),
            "chunks_added": added_count,
            "verification": verification
        }
    
    def _parse_pdf(self, file_path: str, strategy: str) -> List[Dict]:
        """Parse PDF and extract sections based on strategy"""
        
        with open(file_path, 'rb') as file:
            pdf_reader = PdfReader(file)
            full_text = ""
            
            for page in pdf_reader.pages:
                full_text += page.extract_text()
        
        # Extract sections based on strategy
        if strategy == "rule_by_rule":
            return self._extract_rules(full_text)
        elif strategy == "section_by_section":
            return self._extract_sections(full_text)
        elif strategy == "appendix_by_appendix":
            return self._extract_appendices(full_text)
        else:
            return self._extract_generic_sections(full_text)
    
    def _extract_rules(self, text: str) -> List[Dict]:
        """Extract individual rules from NDCTR 2019"""
        
        # Pattern: "Rule 22." or "22."
        rule_pattern = r'(?:Rule\s+)?(\d+)\.\s+([^\n]+)'
        
        sections = []
        matches = re.finditer(rule_pattern, text, re.MULTILINE)
        
        for match in matches:
            rule_num = match.group(1)
            title = match.group(2).strip()
            
            # Extract text until next rule (simplified)
            start_pos = match.end()
            next_match = re.search(r'(?:Rule\s+)?\d+\.', text[start_pos:])
            
            if next_match:
                end_pos = start_pos + next_match.start()
            else:
                end_pos = len(text)
            
            rule_text = text[start_pos:end_pos].strip()
            
            sections.append({
                "section_id": f"R{rule_num}",
                "section_number": f"Rule {rule_num}",
                "title": title,
                "text": rule_text,
                "chapter": self._get_chapter_for_rule(int(rule_num))
            })
        
        return sections
    
    def _extract_sections(self, text: str) -> List[Dict]:
        """Extract numbered sections (e.g., 4.1, 4.2)"""
        
        # Pattern: "4.1" or "4.1.2"
        section_pattern = r'(\d+(?:\.\d+)*)\s+([^\n]+)'
        
        sections = []
        matches = re.finditer(section_pattern, text, re.MULTILINE)
        
        for match in matches:
            section_num = match.group(1)
            title = match.group(2).strip()
            
            # Extract text until next section
            start_pos = match.end()
            next_match = re.search(r'\d+(?:\.\d+)*\s+', text[start_pos:])
            
            if next_match:
                end_pos = start_pos + next_match.start()
            else:
                end_pos = len(text)
            
            section_text = text[start_pos:end_pos].strip()
            
            sections.append({
                "section_id": f"S{section_num.replace('.', '_')}",
                "section_number": section_num,
                "title": title,
                "text": section_text
            })
        
        return sections
    
    def _extract_appendices(self, text: str) -> List[Dict]:
        """Extract appendices from Schedule Y"""
        
        # Pattern: "Appendix I" or "APPENDIX I"
        appendix_pattern = r'(?:APPENDIX|Appendix)\s+([IVX]+)\s*[:\-]?\s*([^\n]+)'
        
        sections = []
        matches = re.finditer(appendix_pattern, text, re.MULTILINE | re.IGNORECASE)
        
        for match in matches:
            appendix_num = match.group(1)
            title = match.group(2).strip()
            
            # Extract text until next appendix
            start_pos = match.end()
            next_match = re.search(r'(?:APPENDIX|Appendix)\s+[IVX]+', text[start_pos:], re.IGNORECASE)
            
            if next_match:
                end_pos = start_pos + next_match.start()
            else:
                end_pos = len(text)
            
            appendix_text = text[start_pos:end_pos].strip()
            
            sections.append({
                "section_id": f"APP{appendix_num}",
                "section_number": f"Appendix {appendix_num}",
                "title": title,
                "text": appendix_text
            })
        
        return sections
    
    def _extract_generic_sections(self, text: str) -> List[Dict]:
        """Generic section extraction for unstructured documents"""
        
        # Split by paragraphs or headings
        paragraphs = text.split('\n\n')
        
        sections = []
        for i, para in enumerate(paragraphs):
            if len(para.strip()) > 100:  # Only substantial paragraphs
                sections.append({
                    "section_id": f"P{i+1}",
                    "section_number": f"Section {i+1}",
                    "title": para[:50] + "...",
                    "text": para.strip()
                })
        
        return sections
    
    def _chunk_section(self, section: Dict, strategy: str) -> List[Dict]:
        """
        Chunk a section into smaller pieces if needed
        
        Max chunk size: 800 characters
        """
        
        text = section['text']
        max_chunk_size = 800
        
        if len(text) <= max_chunk_size:
            # Single chunk
            return [{
                "section_id": section['section_id'],
                "section_number": section['section_number'],
                "title": section['title'],
                "chapter": section.get('chapter', ''),
                "subsection": section.get('subsection', ''),
                "text": text,
                "chunk_index": 0,
                "total_chunks": 1
            }]
        
        # Split into multiple chunks
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        chunks = []
        current_chunk = ""
        chunk_index = 0
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) <= max_chunk_size:
                current_chunk += sentence + " "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + " "
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        # Create chunk objects
        result = []
        for i, chunk_text in enumerate(chunks):
            result.append({
                "section_id": section['section_id'],
                "section_number": section['section_number'],
                "title": section['title'],
                "chapter": section.get('chapter', ''),
                "subsection": section.get('subsection', ''),
                "text": chunk_text,
                "chunk_index": i,
                "total_chunks": len(chunks)
            })
        
        return result
    
    def _get_chapter_for_rule(self, rule_num: int) -> str:
        """Map rule number to chapter for NDCTR 2019"""
        
        if rule_num <= 2:
            return "Chapter I: Preliminary"
        elif rule_num <= 21:
            return "Chapter II: Clinical Trial Applications"
        elif rule_num <= 43:
            return "Chapter III: Conduct of Clinical Trials"
        elif rule_num <= 62:
            return "Chapter IV: Ethics Committee"
        elif rule_num <= 70:
            return "Chapter V: Serious Adverse Events"
        elif rule_num <= 78:
            return "Chapter VI: Compensation"
        else:
            return "Chapter VII: Miscellaneous"
    
    def _check_existing(self, source_key: str) -> int:
        """Check if document already ingested"""
        
        try:
            results = self.collection.get(
                where={"source_key": source_key},
                limit=1
            )
            
            if results and results['ids']:
                # Count total chunks
                all_results = self.collection.get(
                    where={"source_key": source_key}
                )
                return len(all_results['ids'])
            
            return 0
            
        except Exception as e:
            print(f"Error checking existing: {e}")
            return 0
    
    def _verify_ingestion(self, source_key: str) -> Dict:
        """Verify document was ingested correctly"""
        
        results = self.collection.get(
            where={"source_key": source_key}
        )
        
        total_chunks = len(results['ids'])
        
        # Sample retrieval test
        if total_chunks > 0:
            sample_query = "clinical trial protocol requirements"
            sample_results = self.collection.query(
                query_texts=[sample_query],
                where={"source_key": source_key},
                n_results=min(3, total_chunks)
            )
            
            sample_similarity = 1 - sample_results['distances'][0][0] if sample_results['distances'] else 0
        else:
            sample_similarity = 0
        
        return {
            "total_chunks": total_chunks,
            "sample_similarity": sample_similarity,
            "status": "verified" if total_chunks > 0 else "failed"
        }
    
    def get_corpus_stats(self) -> Dict:
        """Get statistics about the regulatory corpus"""
        
        stats = {
            "total_chunks": self.collection.count(),
            "sources": {}
        }
        
        for source_key, source_info in self.source_registry.items():
            results = self.collection.get(
                where={"source_key": source_key}
            )
            
            stats["sources"][source_key] = {
                "name": source_info['name'],
                "version": source_info['version'],
                "chunks": len(results['ids']) if results else 0,
                "last_verified": results['metadatas'][0]['last_verified'] if results and results['metadatas'] else None
            }
        
        return stats


# Example usage
if __name__ == "__main__":
    from chromadb import Client
    
    # Initialize ChromaDB client
    client = Client()
    
    # Create corpus builder
    builder = RegulatoryCorpusBuilder(client)
    
    # Example: Ingest NDCTR 2019
    # builder.ingest_document(
    #     source_key="NDCTR_2019",
    #     file_path="data/regulatory_corpus/NDCTR_2019.pdf"
    # )
    
    # Get corpus stats
    stats = builder.get_corpus_stats()
    print(f"\nCorpus Statistics:")
    print(f"Total chunks: {stats['total_chunks']}")
    print(f"\nSources:")
    for source_key, source_stats in stats['sources'].items():
        print(f"  {source_stats['name']}: {source_stats['chunks']} chunks")
