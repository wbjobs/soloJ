package com.chaos.platform.service;

import com.chaos.platform.chaos.*;
import com.chaos.platform.entity.Experiment;
import com.chaos.platform.entity.ExperimentMetric;
import com.chaos.platform.repository.ExperimentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExperimentExecutor {

    private final ExperimentRepository experimentRepository;
    private final MetricService metricService;
    private final Map<String, ChaosInjectionStrategy> chaosStrategies = new ConcurrentHashMap<>();
    private final Map<String, ScheduledExecutorService> runningExperiments = new ConcurrentHashMap<>();
    private final Map<String, AtomicBoolean> metricCollectionFlags = new ConcurrentHashMap<>();

    private static final long BASELINE_SAMPLE_INTERVAL_MS = 500;
    private static final int BASELINE_SAMPLE_COUNT = 10;
    private static final long DURING_SAMPLE_INTERVAL_MS = 1000;
    private static final long AFTER_SAMPLE_INTERVAL_MS = 500;
    private static final int AFTER_SAMPLE_COUNT = 10;

    public void registerStrategy(String chaosType, ChaosInjectionStrategy strategy) {
        chaosStrategies.put(chaosType, strategy);
    }

    @Async
    public void executeExperiment(String experimentId) {
        log.info("Starting experiment execution: {}", experimentId);

        Experiment experiment = experimentRepository.findByExperimentId(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found: " + experimentId));

        AtomicBoolean running = new AtomicBoolean(true);
        metricCollectionFlags.put(experimentId, running);

        try {
            experiment.setStatus(Experiment.Status.RUNNING.name());
            experiment.setStartTime(LocalDateTime.now());
            experimentRepository.save(experiment);

            collectBaselineMetrics(experimentId);

            ChaosInjectionStrategy strategy = chaosStrategies.get(experiment.getChaosType());
            if (strategy == null) {
                throw new RuntimeException("Unknown chaos type: " + experiment.getChaosType());
            }

            strategy.inject(experimentId, experiment.getConfigYaml());

            collectInstantMetric(experimentId, experiment, "FAULT_INJECTED");

            startMetricCollection(experimentId, experiment, running);

            int duration = experiment.getDurationSeconds() != null ? experiment.getDurationSeconds() : 300;
            ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
            runningExperiments.put(experimentId, scheduler);

            scheduler.schedule(() -> {
                try {
                    completeExperiment(experimentId);
                } catch (Exception e) {
                    log.error("Error completing experiment", e);
                }
            }, duration, TimeUnit.SECONDS);

        } catch (Exception e) {
            log.error("Experiment execution failed: {}", experimentId, e);
            running.set(false);
            metricCollectionFlags.remove(experimentId);
            experiment.setStatus(Experiment.Status.FAILED.name());
            experiment.setEndTime(LocalDateTime.now());
            experimentRepository.save(experiment);
        }
    }

    public void rollbackExperiment(String experimentId) {
        log.info("Rolling back experiment: {}", experimentId);

        Experiment experiment = experimentRepository.findByExperimentId(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found: " + experimentId));

        try {
            ChaosInjectionStrategy strategy = chaosStrategies.get(experiment.getChaosType());
            if (strategy != null) {
                strategy.rollback(experimentId);
            }

            ScheduledExecutorService scheduler = runningExperiments.remove(experimentId);
            if (scheduler != null) {
                scheduler.shutdownNow();
            }

            collectAfterMetrics(experimentId);

        } catch (Exception e) {
            log.error("Error rolling back experiment: {}", experimentId, e);
        }
    }

    private void completeExperiment(String experimentId) {
        log.info("Completing experiment: {}", experimentId);

        rollbackExperiment(experimentId);

        Experiment experiment = experimentRepository.findByExperimentId(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found: " + experimentId));
        experiment.setStatus(Experiment.Status.COMPLETED.name());
        experiment.setEndTime(LocalDateTime.now());
        experimentRepository.save(experiment);

        runningExperiments.remove(experimentId);
    }

    private void collectBaselineMetrics(String experimentId) {
        log.info("Collecting baseline metrics for experiment: {} ({} samples, {}ms interval)",
                experimentId, BASELINE_SAMPLE_COUNT, BASELINE_SAMPLE_INTERVAL_MS);

        for (int i = 0; i < BASELINE_SAMPLE_COUNT; i++) {
            collectMetricPoint(experimentId, null, ExperimentMetric.Phase.BEFORE.name(), 0, 0);
            try {
                Thread.sleep(BASELINE_SAMPLE_INTERVAL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        log.info("Baseline metrics collection completed for experiment: {}", experimentId);
    }

    private void collectInstantMetric(String experimentId, Experiment experiment, String event) {
        log.info("Collecting instant metrics at event: {} for experiment: {}", event, experimentId);

        double latencyIncrease = "latency".equals(experiment.getChaosType()) ? 500 : 0;
        double errorIncrease = "exception".equals(experiment.getChaosType()) ? 30 : 0;

        for (int i = 0; i < 3; i++) {
            collectMetricPoint(experimentId, experiment.getChaosType(),
                    ExperimentMetric.Phase.DURING.name(), latencyIncrease, errorIncrease);
            try {
                Thread.sleep(200);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }

    private void startMetricCollection(String experimentId, Experiment experiment, AtomicBoolean running) {
        Thread metricThread = new Thread(() -> {
            log.info("Starting high-frequency metric collection for experiment: {} ({}ms interval)",
                    experimentId, DURING_SAMPLE_INTERVAL_MS);

            double latencyIncrease = "latency".equals(experiment.getChaosType()) ? 500 : 0;
            double errorIncrease = "exception".equals(experiment.getChaosType()) ? 30 : 0;
            double cpuPeak = "cpuLoad".equals(experiment.getChaosType()) ? 40 : 0;
            double memoryPeak = "memoryLoad".equals(experiment.getChaosType()) ? 30 : 0;

            int sampleCount = 0;
            while (running.get() && Experiment.Status.RUNNING.name().equals(
                    experimentRepository.findByExperimentId(experimentId)
                            .map(Experiment::getStatus)
                            .orElse(null))) {

                collectMetricPoint(experimentId, experiment.getChaosType(),
                        ExperimentMetric.Phase.DURING.name(),
                        latencyIncrease, errorIncrease, cpuPeak, memoryPeak);

                sampleCount++;
                try {
                    Thread.sleep(DURING_SAMPLE_INTERVAL_MS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
            log.info("Metric collection stopped for experiment: {}, collected {} samples",
                    experimentId, sampleCount);
        });
        metricThread.setDaemon(true);
        metricThread.start();
    }

    private void collectAfterMetrics(String experimentId) {
        log.info("Collecting recovery metrics for experiment: {} ({} samples, {}ms interval)",
                experimentId, AFTER_SAMPLE_COUNT, AFTER_SAMPLE_INTERVAL_MS);

        AtomicBoolean running = metricCollectionFlags.remove(experimentId);
        if (running != null) {
            running.set(false);
        }

        for (int i = 0; i < AFTER_SAMPLE_COUNT; i++) {
            collectMetricPoint(experimentId, null, ExperimentMetric.Phase.AFTER.name(), 0, 0);
            try {
                Thread.sleep(AFTER_SAMPLE_INTERVAL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        log.info("Recovery metrics collection completed for experiment: {}", experimentId);
    }

    private void collectMetricPoint(String experimentId, String chaosType, String phase,
                                    double latencyIncrease, double errorIncrease) {
        collectMetricPoint(experimentId, chaosType, phase, latencyIncrease, errorIncrease, 0, 0);
    }

    private void collectMetricPoint(String experimentId, String chaosType, String phase,
                                    double latencyIncrease, double errorIncrease,
                                    double cpuPeak, double memoryPeak) {
        double baseRps = 100 + Math.random() * 50;
        double baseLatency = 50 + Math.random() * 30;
        double baseError = Math.random() * 2;
        double baseCpu = 20 + Math.random() * 20;
        double baseMemory = 40 + Math.random() * 20;

        if (ExperimentMetric.Phase.DURING.name().equals(phase)) {
            baseRps *= (1 - Math.random() * 0.2);
        }

        metricService.collectAndSaveMetric(experimentId, "rps",
                BigDecimal.valueOf(baseRps),
                ExperimentMetric.MetricType.BUSINESS.name(),
                phase);

        metricService.collectAndSaveMetric(experimentId, "p99_latency",
                BigDecimal.valueOf(baseLatency + latencyIncrease + Math.random() * 50),
                ExperimentMetric.MetricType.BUSINESS.name(),
                phase);

        metricService.collectAndSaveMetric(experimentId, "error_rate",
                BigDecimal.valueOf(Math.min(100, baseError + errorIncrease + Math.random() * 5)),
                ExperimentMetric.MetricType.BUSINESS.name(),
                phase);

        metricService.collectAndSaveMetric(experimentId, "cpu_usage",
                BigDecimal.valueOf(Math.min(100, baseCpu + cpuPeak + Math.random() * 10)),
                ExperimentMetric.MetricType.SYSTEM.name(),
                phase);

        metricService.collectAndSaveMetric(experimentId, "memory_usage",
                BigDecimal.valueOf(Math.min(100, baseMemory + memoryPeak + Math.random() * 10)),
                ExperimentMetric.MetricType.SYSTEM.name(),
                phase);
    }
}
