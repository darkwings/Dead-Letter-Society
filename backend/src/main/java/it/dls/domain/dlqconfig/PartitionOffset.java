package it.dls.domain.dlqconfig;

public record PartitionOffset(int partition, long lastOffset) {}
