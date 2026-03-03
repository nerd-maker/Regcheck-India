"""
Corpus Freshness Monitor

Monitors regulatory corpus for stale documents and alerts when updates needed.
Ensures compliance checker operates on current regulations.
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional
import logging
import hashlib
import requests

logger = logging.getLogger(__name__)


class CorpusFreshnessMonitor:
    """
    Monitor regulatory corpus for staleness
    
    Features:
    - Track last verification date for each source
    - Alert when source > 90 days stale
    - Check for document updates on official websites
    - Generate freshness reports
    """
    
    def __init__(self, chroma_collection, alert_threshold_days: int = 90):
        self.collection = chroma_collection
        self.alert_threshold_days = alert_threshold_days
        
        # Source URLs for checking updates
        self.source_urls = {
            "NDCTR_2019": "https://cdsco.gov.in/opencms/opencms/en/Clinical-Trial/New-Drugs-and-Clinical-Trials-Rules-2019/",
            "BABE_2018": "https://cdsco.gov.in/opencms/export/sites/CDSCO_WEB/Pdf-documents/biologicals/BABE_Guidelines_2018.pdf",
            "ICH_E6_R3": "https://database.ich.org/sites/default/files/ICH_E6-R3_GCP-Principles_Draft_2023.pdf",
            "SCHEDULE_Y": "https://cdsco.gov.in/opencms/opencms/en/Drugs/Schedule-Y/",
            "CTRI_GUIDELINES": "http://ctri.nic.in/Clinicaltrials/guidelines.php",
            "ICMR_ETHICS_2017": "https://ethics.ncdirindia.org/asset/pdf/ICMR_National_Ethical_Guidelines.pdf"
        }
    
    def check_freshness(self) -> List[Dict]:
        """
        Check all sources for staleness
        
        Returns:
            List of alerts for stale sources
        """
        
        alerts = []
        
        for source_key, url in self.source_urls.items():
            # Get last verified date from ChromaDB
            last_verified = self._get_last_verified(source_key)
            
            if not last_verified:
                alerts.append({
                    "source_key": source_key,
                    "alert_type": "NEVER_VERIFIED",
                    "last_verified": None,
                    "days_stale": None,
                    "url": url,
                    "action": "INGEST_DOCUMENT",
                    "priority": "CRITICAL"
                })
                continue
            
            # Calculate days since last check
            days_since_check = (datetime.now() - last_verified).days
            
            if days_since_check > self.alert_threshold_days:
                alerts.append({
                    "source_key": source_key,
                    "alert_type": "STALE",
                    "last_verified": last_verified.isoformat(),
                    "days_stale": days_since_check,
                    "url": url,
                    "action": "CHECK_FOR_UPDATES",
                    "priority": "HIGH" if days_since_check > 180 else "MEDIUM"
                })
        
        return alerts
    
    def _get_last_verified(self, source_key: str) -> Optional[datetime]:
        """Get last verified date for a source from ChromaDB metadata"""
        
        try:
            results = self.collection.get(
                where={"source_key": source_key},
                limit=1
            )
            
            if results and results['metadatas'] and len(results['metadatas']) > 0:
                last_verified_str = results['metadatas'][0].get('last_verified')
                if last_verified_str:
                    return datetime.fromisoformat(last_verified_str)
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting last verified date for {source_key}: {e}")
            return None
    
    def verify_source_current(self, source_key: str, file_path: Optional[str] = None) -> Dict:
        """
        Check if source document has been updated on official website
        
        Args:
            source_key: Source identifier
            file_path: Optional local file path to compare against
            
        Returns:
            Verification result with update status
        """
        
        if source_key not in self.source_urls:
            return {
                "status": "error",
                "reason": f"Unknown source: {source_key}"
            }
        
        url = self.source_urls[source_key]
        
        try:
            # Fetch document from URL
            response = requests.head(url, timeout=10, allow_redirects=True)
            
            if response.status_code != 200:
                return {
                    "status": "error",
                    "reason": f"Failed to fetch URL: {response.status_code}"
                }
            
            # Check Last-Modified header
            last_modified_str = response.headers.get('Last-Modified')
            if last_modified_str:
                from email.utils import parsedate_to_datetime
                last_modified = parsedate_to_datetime(last_modified_str)
                
                # Get our last verified date
                our_last_verified = self._get_last_verified(source_key)
                
                if our_last_verified and last_modified > our_last_verified:
                    return {
                        "status": "update_available",
                        "last_modified": last_modified.isoformat(),
                        "our_last_verified": our_last_verified.isoformat(),
                        "action": "RE_INGEST_DOCUMENT"
                    }
                else:
                    return {
                        "status": "current",
                        "last_modified": last_modified.isoformat(),
                        "our_last_verified": our_last_verified.isoformat() if our_last_verified else None
                    }
            
            # If no Last-Modified header, compare content hash
            if file_path:
                return self._compare_content_hash(url, file_path)
            
            return {
                "status": "unknown",
                "reason": "No Last-Modified header and no local file to compare"
            }
            
        except requests.RequestException as e:
            logger.error(f"Error verifying source {source_key}: {e}")
            return {
                "status": "error",
                "reason": str(e)
            }
    
    def _compare_content_hash(self, url: str, file_path: str) -> Dict:
        """Compare hash of online document with local file"""
        
        try:
            # Download online document
            response = requests.get(url, timeout=30)
            online_hash = hashlib.sha256(response.content).hexdigest()
            
            # Hash local file
            with open(file_path, 'rb') as f:
                local_hash = hashlib.sha256(f.read()).hexdigest()
            
            if online_hash != local_hash:
                return {
                    "status": "update_available",
                    "online_hash": online_hash,
                    "local_hash": local_hash,
                    "action": "RE_INGEST_DOCUMENT"
                }
            else:
                return {
                    "status": "current",
                    "hash": online_hash
                }
                
        except Exception as e:
            logger.error(f"Error comparing content hash: {e}")
            return {
                "status": "error",
                "reason": str(e)
            }
    
    def generate_freshness_report(self) -> Dict:
        """
        Generate comprehensive freshness report
        
        Returns:
            Report with all sources and their freshness status
        """
        
        report = {
            "generated_at": datetime.now().isoformat(),
            "alert_threshold_days": self.alert_threshold_days,
            "sources": {},
            "alerts": []
        }
        
        for source_key in self.source_urls.keys():
            last_verified = self._get_last_verified(source_key)
            
            if last_verified:
                days_since_check = (datetime.now() - last_verified).days
                status = "FRESH" if days_since_check <= self.alert_threshold_days else "STALE"
            else:
                days_since_check = None
                status = "NEVER_VERIFIED"
            
            report["sources"][source_key] = {
                "last_verified": last_verified.isoformat() if last_verified else None,
                "days_since_check": days_since_check,
                "status": status,
                "url": self.source_urls[source_key]
            }
        
        # Get alerts
        report["alerts"] = self.check_freshness()
        
        return report
    
    def update_verification_timestamp(self, source_key: str):
        """
        Update last_verified timestamp for all chunks of a source
        
        Call this after verifying a source is current
        """
        
        try:
            # Get all chunks for this source
            results = self.collection.get(
                where={"source_key": source_key}
            )
            
            if not results or not results['ids']:
                logger.warning(f"No chunks found for source {source_key}")
                return
            
            # Update metadata for each chunk
            current_time = datetime.now().isoformat()
            
            for chunk_id, metadata in zip(results['ids'], results['metadatas']):
                metadata['last_verified'] = current_time
                
                # Update in ChromaDB
                self.collection.update(
                    ids=[chunk_id],
                    metadatas=[metadata]
                )
            
            logger.info(f"Updated verification timestamp for {len(results['ids'])} chunks of {source_key}")
            
        except Exception as e:
            logger.error(f"Error updating verification timestamp: {e}")


def send_freshness_alert_email(alerts: List[Dict]):
    """
    Send email alert for stale sources
    
    Args:
        alerts: List of freshness alerts
    """
    
    if not alerts:
        return
    
    # Format email
    subject = f"Regulatory Corpus Freshness Alert - {len(alerts)} sources need attention"
    
    body = "The following regulatory sources need verification:\n\n"
    
    for alert in alerts:
        body += f"Source: {alert['source_key']}\n"
        body += f"Alert Type: {alert['alert_type']}\n"
        body += f"Priority: {alert['priority']}\n"
        
        if alert['last_verified']:
            body += f"Last Verified: {alert['last_verified']}\n"
            body += f"Days Stale: {alert['days_stale']}\n"
        
        body += f"Action: {alert['action']}\n"
        body += f"URL: {alert['url']}\n"
        body += "\n" + "-"*60 + "\n\n"
    
    # TODO: Implement actual email sending
    logger.warning(f"FRESHNESS ALERT:\n{body}")
    print(f"\n{body}")


# Example usage
if __name__ == "__main__":
    from chromadb import Client
    
    # Initialize ChromaDB client
    client = Client()
    collection = client.get_or_create_collection("regulatory_knowledge")
    
    # Create monitor
    monitor = CorpusFreshnessMonitor(collection, alert_threshold_days=90)
    
    # Check freshness
    alerts = monitor.check_freshness()
    
    if alerts:
        print(f"\n⚠️  Found {len(alerts)} freshness alerts:")
        for alert in alerts:
            print(f"\n  {alert['source_key']}: {alert['alert_type']}")
            print(f"  Priority: {alert['priority']}")
            print(f"  Action: {alert['action']}")
    else:
        print("\n✓ All sources are fresh")
    
    # Generate full report
    report = monitor.generate_freshness_report()
    print(f"\nFreshness Report:")
    for source_key, source_info in report['sources'].items():
        print(f"  {source_key}: {source_info['status']} ({source_info['days_since_check']} days)")
