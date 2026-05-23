package it.dls.application.dashboard;

import java.time.Instant;

public record DashboardSummary(
    long newCount,
    long underReviewCount,
    long replayedCount,
    long discardedCount,
    long replayFailedCount,
    Instant computedAt
) {}
