from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])

@router.get("/summary")
def get_dashboard_summary():
    return {
        "events_processed_today": 12450,
        "total_open_alerts": 18,
        "critical_alerts": 3,
        "high_risk_traders": 4,
        "confirmed_incidents": 2,
        "average_processing_time_ms": 42.5
    }

@router.get("/alert-trends")
def get_alert_trends():
    return {
        "by_severity": {"CRITICAL": 3, "HIGH": 7, "MEDIUM": 6, "LOW": 2},
        "by_rule": {
            "NEW_DEVICE_HIGH_VALUE": 3,
            "LARGE_ORDER": 5,
            "RAPID_CANCELLATION": 4,
            "EXCESSIVE_FREQUENCY": 3,
            "UNUSUAL_VOLUME": 3
        }
    }

@router.get("/high-risk-traders")
def get_high_risk_traders():
    return [
        {"trader_id": "TRD-1001", "name": "Alice Smith", "risk_score": 92.5, "open_alerts": 4},
        {"trader_id": "TRD-1042", "name": "Bob Jones", "risk_score": 84.1, "open_alerts": 2}
    ]
