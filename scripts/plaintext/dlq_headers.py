"""Header encoding for the DLQ test producer.

Header names and encodings mirror HeaderPreset in the backend
(backend/src/main/java/it/dls/domain/dlqconfig/HeaderPreset.java). The CUSTOM preset has
no fixed names; it emits the x-failed-* names below, which you map by hand in the DLQ
config form (all STRING encoding).
"""
import random
import struct
from dataclasses import dataclass

PRESETS = ("legacy", "spring", "smallrye", "custom")

Headers = list[tuple[str, bytes]]


@dataclass(frozen=True)
class Failure:
    original_topic: str
    partition: int
    offset: int
    timestamp_ms: int
    exception_class: str
    message: str
    stacktrace: str
    cause_class: str | None = None
    cause_message: str | None = None


def _s(value) -> bytes:
    return str(value).encode("utf-8")


def encode_headers(preset: str, f: Failure) -> Headers:
    if preset == "legacy":
        return [
            ("x-original-topic", _s(f.original_topic)),
            ("x-exception-message", _s(f.message)),
            ("x-exception-class", _s(f.exception_class)),
        ]
    if preset == "spring":
        return [
            ("kafka_dlt-original-topic", _s(f.original_topic)),
            ("kafka_dlt-original-partition", struct.pack(">i", f.partition)),
            ("kafka_dlt-original-offset", struct.pack(">q", f.offset)),
            ("kafka_dlt-original-timestamp", struct.pack(">q", f.timestamp_ms)),
            ("kafka_dlt-exception-message", _s(f.message)),
            ("kafka_dlt-exception-stacktrace", _s(f.stacktrace)),
            ("kafka_dlt-exception-fqcn", _s(f.exception_class)),
        ]
    if preset == "smallrye":
        headers = [
            ("dead-letter-exception-class-name", _s(f.exception_class)),
            ("dead-letter-reason", _s(f.message)),
            ("dead-letter-topic", _s(f.original_topic)),
            ("dead-letter-partition", _s(f.partition)),
            ("dead-letter-offset", _s(f.offset)),
        ]
        # SmallRye only sets the cause headers when the failure carries a cause.
        if f.cause_class is not None:
            headers.append(("dead-letter-cause", _s(f.cause_message or "")))
            headers.append(("dead-letter-cause-class-name", _s(f.cause_class)))
        return headers
    if preset == "custom":
        return [
            ("x-failed-topic", _s(f.original_topic)),
            ("x-failed-partition", _s(f.partition)),
            ("x-failed-offset", _s(f.offset)),
            ("x-failed-error", _s(f.message)),
        ]
    raise ValueError(f"unknown preset: {preset!r}")


_TOPIC_HEADER = {
    "legacy": "x-original-topic",
    "spring": "kafka_dlt-original-topic",
    "smallrye": "dead-letter-topic",
    "custom": "x-failed-topic",
}
# Binary headers whose length can be corrupted (only SPRING has any).
_BINARY_HEADER = {"spring": "kafka_dlt-original-partition"}

MALFORM_KINDS = ("missing-topic", "bad-length")


def malform(preset: str, headers: Headers, rng: random.Random, kind: str | None = None
            ) -> tuple[Headers, str]:
    """Return a corrupted copy of `headers` and a short description of the damage."""
    kind = kind or rng.choice(MALFORM_KINDS)
    if kind == "bad-length" and preset not in _BINARY_HEADER:
        kind = "missing-topic"  # string-only presets have no length to get wrong
    if kind == "missing-topic":
        name = _TOPIC_HEADER[preset]
        return [(k, v) for k, v in headers if k != name], f"missing original-topic header ({name})"
    name = _BINARY_HEADER[preset]
    return ([(k, v + b"\x00" if k == name else v) for k, v in headers],
            f"original-partition header has wrong length ({name})")
