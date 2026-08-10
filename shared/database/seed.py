"""Seed script to populate initial sample data for TradeGuard Azure local development."""
import sys
import os
from datetime import datetime, timezone, timedelta
import random

# Ensure repository root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from shared.database.connection import engine, SessionLocal
from shared.database.models import Base, AlertRecord, CaseNoteModel, RiskRuleModel, Trader, TradingAccount
from shared.schemas.common import AlertSeverity, AlertStatus

def seed_database():
    print("Creating database schema if missing...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Risk Rules if empty
        if db.query(RiskRuleModel).count() == 0:
            print("Seeding risk rules...")
            default_rules = [
                RiskRuleModel(code="LARGE_ORDER", name="Large Order", description="Order value (qty×price) ≥ threshold", threshold=100000.0, severity="HIGH", enabled=True),
                RiskRuleModel(code="RAPID_CANCELLATION", name="Rapid Cancellation", description="≥10 order cancellations within 5 minutes", threshold=10.0, severity="HIGH", enabled=True),
                RiskRuleModel(code="EXCESSIVE_FREQUENCY", name="Excessive Frequency", description=">30 orders submitted within 1 minute", threshold=30.0, severity="MEDIUM", enabled=True),
                RiskRuleModel(code="UNUSUAL_VOLUME", name="Unusual Volume", description="Volume exceeds 3× historical average", threshold=3.0, severity="MEDIUM", enabled=True),
                RiskRuleModel(code="NEW_DEVICE_HIGH_VALUE", name="New Device & High Value", description="New device flag with order value ≥ threshold", threshold=50000.0, severity="CRITICAL", enabled=True),
                RiskRuleModel(code="WASH_TRADING", name="Wash Trading", description="Offsetting buy/sell on same instrument within 30s", threshold=3.0, severity="CRITICAL", enabled=True),
                RiskRuleModel(code="SPOOFING_LAYERING", name="Spoofing / Layering", description="Rapid submission and cancellation of non-executable orders", threshold=3.0, severity="HIGH", enabled=True),
                RiskRuleModel(code="OFF_HOURS_TRADING", name="Off-Hours Trading", description="High-value trade outside market hours or on weekends", threshold=25000.0, severity="MEDIUM", enabled=True),
                RiskRuleModel(code="PRICE_SPIKE", name="Price Spike", description="Order price deviates ≥ threshold% from benchmark", threshold=15.0, severity="HIGH", enabled=True),
            ]
            db.add_all(default_rules)
            db.commit()

        # 2. Seed Traders & Accounts if empty
        if db.query(Trader).count() == 0:
            print("Seeding traders and trading accounts...")
            traders = [
                Trader(external_reference="TRD-1001", name="Sarah Connor", risk_level="HIGH"),
                Trader(external_reference="TRD-1042", name="Alex Vance", risk_level="CRITICAL"),
                Trader(external_reference="TRD-1010", name="Gordon Freeman", risk_level="MEDIUM"),
                Trader(external_reference="TRD-1088", name="Ellen Ripley", risk_level="LOW"),
            ]
            db.add_all(traders)
            db.commit()

            accounts = [
                TradingAccount(trader_id=traders[0].id, account_number="ACC-2001", status="ACTIVE"),
                TradingAccount(trader_id=traders[1].id, account_number="ACC-2042", status="UNDER_AUDIT"),
                TradingAccount(trader_id=traders[2].id, account_number="ACC-2010", status="ACTIVE"),
                TradingAccount(trader_id=traders[3].id, account_number="ACC-2088", status="ACTIVE"),
            ]
            db.add_all(accounts)
            db.commit()

        # 3. Seed Sample Alerts if empty
        if db.query(AlertRecord).count() == 0:
            print("Seeding initial compliance alerts...")
            now = datetime.now(timezone.utc)
            sample_alerts = [
                AlertRecord(
                    alert_id="ALT-7001",
                    event_id="EVT-9001",
                    trader_id="TRD-1042",
                    rule_code="NEW_DEVICE_HIGH_VALUE",
                    title="High-value order from new unrecognized device",
                    description="Order value $120,000 executed from device ID DEVICE-NEW-77A0 on IP 198.51.100.42",
                    rule_score=90.0,
                    anomaly_score=94.5,
                    final_risk_score=91.45,
                    severity=AlertSeverity.CRITICAL,
                    status=AlertStatus.NEW,
                    assigned_to="ANALYST-001",
                    detected_at=now - timedelta(minutes=15),
                ),
                AlertRecord(
                    alert_id="ALT-7002",
                    event_id="EVT-9002",
                    trader_id="TRD-1001",
                    rule_code="LARGE_ORDER",
                    title="Large order size threshold exceeded",
                    description="Order value $350,000 on NVDA exceeds default single-order threshold $100,000",
                    rule_score=75.0,
                    anomaly_score=82.0,
                    final_risk_score=77.10,
                    severity=AlertSeverity.HIGH,
                    status=AlertStatus.UNDER_REVIEW,
                    assigned_to="ANALYST-002",
                    detected_at=now - timedelta(hours=1, minutes=20),
                ),
                AlertRecord(
                    alert_id="ALT-7003",
                    event_id="EVT-9003",
                    trader_id="TRD-1010",
                    rule_code="RAPID_CANCELLATION",
                    title="Rapid order cancellations in short window",
                    description="Trader cancelled 14 limit orders within a 3-minute window on AAPL",
                    rule_score=75.0,
                    anomaly_score=45.0,
                    final_risk_score=66.00,
                    severity=AlertSeverity.HIGH,
                    status=AlertStatus.NEW,
                    detected_at=now - timedelta(hours=3),
                ),
                AlertRecord(
                    alert_id="ALT-7004",
                    event_id="EVT-9004",
                    trader_id="TRD-1088",
                    rule_code="OFF_HOURS_TRADING",
                    title="High-value trade placed during off-market hours",
                    description="Order value $45,000 submitted on Sunday at 02:14 UTC",
                    rule_score=50.0,
                    anomaly_score=30.0,
                    final_risk_score=44.00,
                    severity=AlertSeverity.MEDIUM,
                    status=AlertStatus.FALSE_POSITIVE,
                    assigned_to="ANALYST-001",
                    detected_at=now - timedelta(days=1),
                ),
            ]
            db.add_all(sample_alerts)
            db.commit()

            # Seed sample case note
            note = CaseNoteModel(
                alert_id="ALT-7001",
                author_id="ANALYST-001",
                note="Initial triage started. Contacting compliance officer regarding trader device authorization.",
                created_at=now - timedelta(minutes=5),
            )
            db.add(note)
            db.commit()

        print("Database seed completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
