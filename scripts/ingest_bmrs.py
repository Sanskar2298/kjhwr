"""Ingestion script stub for fetching FUELHH actuals and WINDFOR forecasts.

Fetches data from Elexon BMRS Insights API without authentication.
Persists raw records to data/raw/ and aligned data to data/processed/.
"""

import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ingest")


def main() -> None:
    """Entrypoint for data ingestion process."""
    logger.info("Starting BMRS ingestion pipeline stub for January 2026 data...")
    # Pipeline implementation will be added in subsequent commit
    logger.info("Ingestion pipeline stub initialized.")


if __name__ == "__main__":
    main()
