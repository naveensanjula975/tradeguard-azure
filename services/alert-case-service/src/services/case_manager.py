"""Case Manager Service."""
from shared.observability import setup_logger

logger = setup_logger("case-manager")

class CaseManager:
    def add_note(self, alert_id: str, author_id: str, note: str):
        logger.info(f"Adding case note to alert {alert_id} by {author_id}")

case_manager = CaseManager()
