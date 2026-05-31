package com.chaos.platform.repository;

import com.chaos.platform.entity.ExperimentMetric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ExperimentMetricRepository extends JpaRepository<ExperimentMetric, Long> {

    List<ExperimentMetric> findByExperimentIdOrderByTimestampAsc(String experimentId);

    List<ExperimentMetric> findByExperimentIdAndMetricNameOrderByTimestampAsc(String experimentId, String metricName);

    List<ExperimentMetric> findByExperimentIdAndPhaseOrderByTimestampAsc(String experimentId, String phase);

    @Query("SELECT m FROM ExperimentMetric m WHERE m.experimentId = ?1 AND m.timestamp >= ?2 ORDER BY m.timestamp ASC")
    List<ExperimentMetric> findByExperimentIdAndTimestampAfter(String experimentId, LocalDateTime timestamp);

    @Query("SELECT m.metricName, AVG(m.value) FROM ExperimentMetric m WHERE m.experimentId = ?1 AND m.phase = ?2 GROUP BY m.metricName")
    List<Object[]> findAverageMetricsByPhase(String experimentId, String phase);

    void deleteByExperimentId(String experimentId);
}
