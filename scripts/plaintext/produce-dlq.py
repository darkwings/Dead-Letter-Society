#!/usr/bin/env python3
"""Produces realistic DLQ messages (Avro or JSON) with real Kafka headers.

Unlike seed-dlq.sh this can send Avro *and* headers, including the binary int32/int64
headers Spring Kafka writes. About 10% of messages are deliberately malformed (wrong
header length, missing original-topic header, undecodable Avro payload) to exercise the
error paths; disable with --no-malformed.

Setup (once):
    python3 -m venv scripts/.venv
    scripts/.venv/bin/pip install -r scripts/requirements.txt

Usage:
    scripts/.venv/bin/python scripts/plaintext/produce-dlq.py --preset spring --count 50
    scripts/.venv/bin/python scripts/plaintext/produce-dlq.py --preset smallrye --format json

Requires the dev stack: docker compose -f docker/docker-compose.dev.yml up -d
"""
import argparse
import json
import os
import random
import struct
import sys
import time
from collections import Counter
from datetime import datetime, timezone

from confluent_kafka import Producer
from confluent_kafka.admin import AdminClient, NewTopic
from confluent_kafka.schema_registry import Schema, SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
from confluent_kafka.serialization import MessageField, SerializationContext

from dlq_headers import PRESETS, Failure, encode_headers, malform

# Keep in sync with register-schema.sh (same Order record).
ORDER_SCHEMA = json.dumps({
    "type": "record", "name": "Order", "namespace": "it.dls.domain.order",
    "fields": [
        {"name": "orderId", "type": "string"},
        {"name": "customerId", "type": "string"},
        {"name": "item", "type": {
            "type": "record", "name": "OrderItem",
            "fields": [
                {"name": "sku", "type": "string"},
                {"name": "qty", "type": "int"},
                {"name": "unitPrice", "type": "double"},
                {"name": "currency", "type": "string"},
            ]}},
        {"name": "total", "type": "double"},
        {"name": "timestamp", "type": "string"},
        {"name": "correlationId", "type": "string"},
    ],
})

EXCEPTIONS = [
    ("it.dls.domain.order.InvalidOrderException", "Required field shippingAddress is null"),
    ("it.dls.domain.payment.PaymentDeclinedException", "Payment declined: insufficient funds"),
    ("it.dls.domain.inventory.InventoryUnavailableException", "SKU not available in requested quantity"),
    ("it.dls.domain.customer.CustomerNotFoundException", "Customer not found in CRM system"),
    ("it.dls.domain.order.PriceValidationException", "Price mismatch: catalog price differs from order"),
    ("it.dls.domain.order.DuplicateOrderException", "Order with this idempotency key already processed"),
]
CAUSES = [
    ("java.lang.NullPointerException", "Cannot invoke getShippingAddress() on null"),
    ("java.sql.SQLTransientConnectionException", "Connection to orders-db timed out"),
    ("java.util.concurrent.TimeoutException", "Upstream call exceeded 5000 ms"),
]
SKUS = ["LAPTOP-PRO-15", "MOUSE-WL-001", "KB-MECH-TKL", "MONITOR-4K-27", "HEADSET-USB-C", "DOCK-TB4"]
CUSTOMERS = ["cust-1001", "cust-2045", "cust-3312", "cust-4879", "cust-5001", "cust-6234"]
ORIGINAL_TOPICS = ["orders", "orders-v2", "orders-eu", "orders-us"]
MALFORMED_RATE = 0.10


def build_order(rng: random.Random) -> dict:
    qty = rng.randint(1, 10)
    price = round(rng.uniform(5, 1000), 2)
    return {
        "orderId": f"ORD-{rng.randint(100000, 999999)}",
        "customerId": rng.choice(CUSTOMERS),
        "item": {"sku": rng.choice(SKUS), "qty": qty, "unitPrice": price,
                 "currency": rng.choice(["EUR", "USD", "GBP"])},
        "total": round(qty * price, 2),
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "correlationId": f"corr-{rng.getrandbits(64):016x}",
    }


def build_failure(rng: random.Random) -> Failure:
    exc_class, message = rng.choice(EXCEPTIONS)
    cause_class, cause_message = rng.choice(CAUSES) if rng.random() < 0.5 else (None, None)
    return Failure(
        original_topic=rng.choice(ORIGINAL_TOPICS),
        partition=rng.randint(0, 2),
        offset=rng.randint(0, 100_000),
        timestamp_ms=int(time.time() * 1000) - rng.randint(0, 3_600_000),
        exception_class=exc_class, message=message,
        stacktrace=f"{exc_class}: {message}\n\tat it.dls.OrderHandler.handle(OrderHandler.java:42)",
        cause_class=cause_class, cause_message=cause_message,
    )


def ensure_topic(bootstrap: str, topic: str) -> None:
    admin = AdminClient({"bootstrap.servers": bootstrap})
    if topic in admin.list_topics(timeout=10).topics:
        return
    for _, fut in admin.create_topics([NewTopic(topic, num_partitions=3, replication_factor=1)]).items():
        fut.result()
    print(f"Created topic '{topic}' (3 partitions).")


def avro_serializer(sr: SchemaRegistryClient, topic: str) -> tuple[AvroSerializer, int]:
    subject = f"{topic}-value"
    try:
        schema_id = sr.get_latest_version(subject).schema_id
        print(f"Using existing schema for '{subject}' (id={schema_id}).")
    except Exception:
        schema_id = sr.register_schema(subject, Schema(ORDER_SCHEMA, "AVRO"))
        print(f"Registered schema for '{subject}' (id={schema_id}).")
    serializer = AvroSerializer(sr, ORDER_SCHEMA, conf={
        "auto.register.schemas": False, "use.latest.version": True})
    return serializer, schema_id


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--preset", choices=PRESETS, required=True, help="header naming/encoding to emit")
    ap.add_argument("--topic", default="orders.dlq")
    ap.add_argument("--count", type=int, default=20)
    ap.add_argument("--format", choices=["avro", "json"], default="avro")
    ap.add_argument("--bootstrap", default="localhost:9092")
    ap.add_argument("--sr-url", default="http://localhost:8081")
    ap.add_argument("--seed", type=int, help="make the generated data reproducible")
    ap.add_argument("--no-malformed", action="store_true", help="do not send deliberately broken messages")
    args = ap.parse_args()
    if args.count < 1:
        ap.error("--count must be positive")

    rng = random.Random(args.seed)
    ensure_topic(args.bootstrap, args.topic)
    serializer, schema_id = (None, None)
    if args.format == "avro":
        serializer, schema_id = avro_serializer(SchemaRegistryClient({"url": args.sr_url}), args.topic)

    producer = Producer({"bootstrap.servers": args.bootstrap})
    partitions: Counter = Counter()
    errors: list[str] = []

    def delivered(err, msg):
        if err:
            errors.append(str(err))
        else:
            partitions[msg.partition()] += 1

    malformed: list[str] = []
    for i in range(1, args.count + 1):
        order = build_order(rng)
        headers = encode_headers(args.preset, build_failure(rng))
        ctx = SerializationContext(args.topic, MessageField.VALUE)
        value = serializer(order, ctx) if serializer else json.dumps(order).encode()
        note = ""
        if not args.no_malformed and rng.random() < MALFORMED_RATE:
            if rng.random() < 0.34:
                if serializer:  # valid wire-format prefix, undecodable body
                    value = b"\x00" + struct.pack(">I", schema_id) + bytes(rng.getrandbits(8) for _ in range(12))
                else:
                    value = b'{"orderId": '
                note = "undecodable payload"
            else:
                headers, note = malform(args.preset, headers, rng)
            malformed.append(f"{order['orderId']}: {note}")
        producer.produce(args.topic, key=order["orderId"].encode(), value=value,
                         headers=headers, on_delivery=delivered)
        print(f"  [{i}/{args.count}] {order['orderId']}  {order['customerId']}"
              + (f"  MALFORMED: {note}" if note else ""))
        producer.poll(0)
    producer.flush(30)

    print(f"\nDone. topic={args.topic} format={args.format} preset={args.preset}"
          f" delivered={sum(partitions.values())}/{args.count}")
    print("  per partition:", dict(sorted(partitions.items())))
    if schema_id is not None:
        print(f"  schema id: {schema_id}")
    if malformed:
        print(f"  malformed ({len(malformed)}):")
        for line in malformed:
            print(f"    {line}")
    if errors:
        print(f"  delivery errors ({len(errors)}): {errors[0]}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
