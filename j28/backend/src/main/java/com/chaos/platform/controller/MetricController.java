package com.chaos.platform.controller;

import com.chaos.platform.entity.ExperimentMetric;
import com.chaos.platform.service.MetricService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/metrics")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class MetricController {

    private final MetricService metricService;

    @GetMapping("/experiment/{experimentId}")
    public ResponseEntity<List<ExperimentMetric>> getExperimentMetrics(
            @PathVariable String experimentId,
            @RequestParam(required = false) String metricName) {
        if (metricName != null && !metricName.isEmpty()) {
            return ResponseEntity.ok(metricService.getExperimentMetricsByName(experimentId, metricName));
        }
        return ResponseEntity.ok(metricService.getExperimentMetrics(experimentId));
    }

    @GetMapping("/experiment/{experimentId}/realtime")
    public ResponseEntity<List<ExperimentMetric>> getRealtimeMetrics(@PathVariable String experimentId) {
        return ResponseEntity.ok(metricService.getRealtimeMetrics(experimentId));
    }

    @GetMapping("/experiment/{experimentId}/comparison")
    public ResponseEntity<Map<String, Object>> getMetricComparison(@PathVariable String experimentId) {
        return ResponseEntity.ok(metricService.getMetricComparison(experimentId));
    }
}
