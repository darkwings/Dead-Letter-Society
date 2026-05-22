package it.dls.domain.shared;

public record PartitionOffsetRequest(int partition, long fromOffset) {}
