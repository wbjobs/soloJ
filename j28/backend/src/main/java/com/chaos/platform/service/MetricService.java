package com.chaos.platform.service;

import com.chaos.platform.entity.ExperimentMetric;
import com.chaos.platform.repository.ExperimentMetricRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MetricService {

    private final ExperimentMetricRepository metricRepository;

    @Transactional
    public void collectAndSaveMetric(String experimentId, String metricName, BigDecimal value,
                                     String metricType, String phase) {
        ExperimentMetric metric = new ExperimentMetric();
        metric.setExperimentId(experimentId);
        metric.setMetricName(metricName);
        metric.setValue(value);
        metric.setMetricType(metricType);
        metric.setPhase(phase);
        metric.setTimestamp(LocalDateTime.now());
        metricRepository.save(metric);
    }

    public List<ExperimentMetric> getExperimentMetrics(String experimentId) {
        return metricRepository.findByExperimentIdOrderByTimestampAsc(experimentId);
    }

    public List<ExperimentMetric> getExperimentMetricsByName(String experimentId, String metricName) {
        return metricRepository.findByExperimentIdAndMetricNameOrderByTimestampAsc(experimentId, metricName);
    }

    public Map<String, Object> getMetricComparison(String experimentId) {
        Map<String, Object> comparison = new HashMap<>();

        List<Object[]> beforeAvg = metricRepository.findAverageMetricsByPhase(
                experimentId, ExperimentMetric.Phase.BEFORE.name());
        List<Object[]> duringAvg = metricRepository.findAverageMetricsByPhase(
                experimentId, ExperimentMetric.Phase.DURING.name());
        List<Object[]> afterAvg = metricRepository.findAverageMetricsByPhase(
                experimentId, ExperimentMetric.Phase.AFTER.name());

        comparison.put("before", convertToMap(beforeAvg));
        comparison.put("during", convertToMap(duringAvg));
        comparison.put("after", convertToMap(afterAvg));

        return comparison;
    }

    public List<ExperimentMetric> getRealtimeMetrics(String experimentId) {
        LocalDateTime fiveMinutesAgo = LocalDateTime.now().minusMinutes(5);
        return metricRepository.findByExperimentIdAndTimestampAfter(experimentId, fiveMinutesAgo);
    }

    private Map<String, BigDecimal> convertToMap(List<Object[]> data) {
        Map<String, BigDecimal> result = new HashMap<>();
        for (Object[] row : data) {
            String name = (String) row[0];
            BigDecimal avg = (BigDecimal) row[1];
            result.put(name, avg);
        }
        return result;
    }
}
