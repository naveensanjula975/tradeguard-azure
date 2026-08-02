from abc import ABC, abstractmethod
from typing import Optional, Tuple
from shared.event_contracts import TradeEvent
from shared.schemas import AlertSeverity

class BaseRiskRule(ABC):
    code: str
    name: str
    description: str
    default_severity: AlertSeverity
    default_score: float

    @abstractmethod
    def evaluate(self, event: TradeEvent, context: Optional[dict] = None) -> Tuple[bool, float, Optional[str]]:
        """Evaluates a trade event.
        Returns: (is_triggered, rule_score, explanation_str)
        """
        pass
