import random
import struct

import pytest

from dlq_headers import Failure, PRESETS, encode_headers, malform


def failure(**overrides):
    base = dict(
        original_topic="orders", partition=2, offset=12345, timestamp_ms=1_760_000_000_123,
        exception_class="it.dls.domain.order.InvalidOrderException",
        message="Required field shippingAddress is null",
        stacktrace="at it.dls.Foo.bar(Foo.java:1)",
        cause_class=None, cause_message=None,
    )
    base.update(overrides)
    return Failure(**base)


def as_dict(headers):
    return dict(headers)


def test_presets_are_the_four_dls_presets():
    assert PRESETS == ("legacy", "spring", "smallrye", "custom")


def test_legacy_headers_are_utf8_strings():
    h = as_dict(encode_headers("legacy", failure()))
    assert h["x-original-topic"] == b"orders"
    assert h["x-exception-message"] == b"Required field shippingAddress is null"


def test_spring_partition_is_int32_big_endian():
    h = as_dict(encode_headers("spring", failure(partition=2)))
    assert h["kafka_dlt-original-partition"] == struct.pack(">i", 2)
    assert len(h["kafka_dlt-original-partition"]) == 4


def test_spring_offset_and_timestamp_are_int64_big_endian():
    h = as_dict(encode_headers("spring", failure(offset=12345, timestamp_ms=1_760_000_000_123)))
    assert h["kafka_dlt-original-offset"] == struct.pack(">q", 12345)
    assert h["kafka_dlt-original-timestamp"] == struct.pack(">q", 1_760_000_000_123)
    assert len(h["kafka_dlt-original-offset"]) == 8


def test_spring_text_headers():
    h = as_dict(encode_headers("spring", failure()))
    assert h["kafka_dlt-original-topic"] == b"orders"
    assert h["kafka_dlt-exception-message"] == b"Required field shippingAddress is null"
    assert h["kafka_dlt-exception-stacktrace"] == b"at it.dls.Foo.bar(Foo.java:1)"


def test_smallrye_partition_and_offset_are_strings():
    h = as_dict(encode_headers("smallrye", failure(partition=2, offset=99)))
    assert h["dead-letter-partition"] == b"2"
    assert h["dead-letter-offset"] == b"99"
    assert h["dead-letter-topic"] == b"orders"
    assert h["dead-letter-reason"] == b"Required field shippingAddress is null"
    assert "dead-letter-timestamp" not in h


def test_smallrye_cause_only_present_when_failure_has_cause():
    without = as_dict(encode_headers("smallrye", failure()))
    assert "dead-letter-cause" not in without
    with_cause = as_dict(encode_headers(
        "smallrye", failure(cause_class="java.lang.NullPointerException", cause_message="boom")))
    assert with_cause["dead-letter-cause"] == b"boom"
    assert with_cause["dead-letter-cause-class-name"] == b"java.lang.NullPointerException"


def test_custom_uses_documented_x_failed_names():
    h = as_dict(encode_headers("custom", failure()))
    assert h["x-failed-topic"] == b"orders"
    assert h["x-failed-partition"] == b"2"
    assert h["x-failed-offset"] == b"12345"
    assert h["x-failed-error"] == b"Required field shippingAddress is null"


def test_unknown_preset_rejected():
    with pytest.raises(ValueError):
        encode_headers("nope", failure())


def test_malform_spring_wrong_length_binary_header():
    headers = encode_headers("spring", failure())
    broken, why = malform("spring", headers, random.Random(1), kind="bad-length")
    assert dict(broken)["kafka_dlt-original-partition"] != dict(headers)["kafka_dlt-original-partition"]
    assert len(dict(broken)["kafka_dlt-original-partition"]) != 4
    assert "partition" in why


def test_malform_missing_topic_removes_original_topic_header():
    headers = encode_headers("legacy", failure())
    broken, why = malform("legacy", headers, random.Random(1), kind="missing-topic")
    assert "x-original-topic" not in dict(broken)
    assert "topic" in why


def test_malform_does_not_mutate_input():
    headers = encode_headers("spring", failure())
    snapshot = list(headers)
    malform("spring", headers, random.Random(1), kind="missing-topic")
    assert headers == snapshot


def test_malform_bad_length_for_string_only_preset_falls_back_to_missing_topic():
    headers = encode_headers("smallrye", failure())
    broken, why = malform("smallrye", headers, random.Random(1), kind="bad-length")
    assert "dead-letter-topic" not in dict(broken)
    assert "topic" in why
