package it.dls.application.dashboard;

import java.time.LocalDate;

public record SparklinePoint(LocalDate date, long replayed, long total) {
    public double replayRate() {
        return total == 0 ? 0.0 : (double) replayed / total * 100.0;
    }
}
