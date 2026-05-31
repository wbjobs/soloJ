package com.chaos.platform.service;

import com.chaos.platform.genetic.Chromosome;
import com.chaos.platform.genetic.GeneticAlgorithmService;
import com.chaos.platform.entity.*;
import com.chaos.platform.repository.ExperimentRepository;
import com.chaos.platform.repository.ExperimentMetricRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
@RequiredArgsConstructor
public class SmartExplorationService {

    private final GeneticAlgorithmService geneticAlgorithmService;
    private final ExperimentRepository experimentRepository;
    private final ExperimentMetricRepository metricRepository;
    private final ExperimentExecutor experimentExecutor;

    private final Map<String, AtomicBoolean> explorationFlags = new HashMap<>();

    public ExplorationResult startExploration(String serviceName, int experimentCount) {
        log.info("Starting smart exploration for service: {}, count: {}", serviceName, experimentCount);

        AtomicBoolean running = new AtomicBoolean(true);
        String explorationId = "EXPLORE-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        explorationFlags.put(explorationId, running);

        List<Chromosome> optimalCombinations = geneticAlgorithmService.generateOptimalFaultCombinations(serviceName);

        ExplorationResult result = new ExplorationResult();
        result.setExplorationId(explorationId);
        result.setServiceName(serviceName);
        result.setStartTime(LocalDateTime.now());
        result.setOptimalCombinations(optimalCombinations);
        result.setReport(geneticAlgorithmService.generateReport(serviceName, optimalCombinations));

        return result;
    }

    @Async
    public void executeAutoExperiments(String serviceName, List<Chromosome> combinations) {
        log.info("Executing auto-experiments for service: {}, count: {}", serviceName, combinations.size());

        List<ExperimentResult> results = new ArrayList<>();

        for (int i = 0; i < Math.min(combinations.size(), 5); i++) {
            Chromosome combo = combinations.get(i);
            String experimentId = null;

            try {
                log.info("Executing auto-experiment {}: {}", i + 1, combo);

                experimentId = createAndExecuteAutoExperiment(serviceName, combo);
                Thread.sleep(5000);

                ExperimentResult expResult = evaluateExperiment(experimentId, combo);
                results.add(expResult);

                log.info("Experiment {} completed: {}", i + 1, expResult);

            } catch (Exception e) {
                log.error("Auto-experiment {} failed: {}", i + 1, combo, e);
            }
        }

        log.info("All auto-experiments completed for service: {}", serviceName);
    }

    private String createAndExecuteAutoExperiment(String serviceName, Chromosome combo) {
        String experimentId = "AUTO-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Experiment experiment = new Experiment();
        experiment.setExperimentId(experimentId);
        experiment.setName("自动探索实验-" + combo.getId());
        experiment.setDescription("遗传算法自动生成并执行的实验");
        experiment.setConfigYaml(combo.toYamlConfig(serviceName));
        experiment.setStatus(Experiment.Status.APPROVED.name());
        experiment.setChaosType("combination");
        experiment.setTargetService(serviceName);
        experiment.setDurationSeconds(combo.getGenes().values().stream()
                .filter(Chromosome.FaultGene::isEnabled)
                .mapToInt(Chromosome.FaultGene::getDuration)
                .max().orElse(60));
        experiment.setAutoRollback(true);
        experiment.setCreatorId(1L);
        experiment.setCreatorName("AI Explorer");
        experimentRepository.save(experiment);

        experimentExecutor.executeExperiment(experimentId);

        return experimentId;
    }

    private ExperimentResult evaluateExperiment(String experimentId, Chromosome combo) {
        ExperimentResult result = new ExperimentResult();
        result.setExperimentId(experimentId);
        result.setChromosomeId(combo.getId());
        result.setActiveFaultCount(combo.getActiveFaultCount());

        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        List<ExperimentMetric> beforeMetrics = metricRepository
                .findByExperimentIdAndPhaseOrderByTimestampAsc(experimentId, ExperimentMetric.Phase.BEFORE.name());
        List<ExperimentMetric> duringMetrics = metricRepository
                .findByExperimentIdAndPhaseOrderByTimestampAsc(experimentId, ExperimentMetric.Phase.DURING.name());

        double beforeError = beforeMetrics.stream()
                .filter(m -> "error_rate".equals(m.getMetricName()))
                .mapToDouble(m -> m.getValue().doubleValue())
                .average().orElse(0);
        double duringError = duringMetrics.stream()
                .filter(m -> "error_rate".equals(m.getMetricName()))
                .mapToDouble(m -> m.getValue().doubleValue())
                .average().orElse(0);
        result.setErrorRateIncrease(duringError - beforeError);

        double beforeLatency = beforeMetrics.stream()
                .filter(m -> "p99_latency".equals(m.getMetricName()))
                .mapToDouble(m -> m.getValue().doubleValue())
                .average().orElse(0);
        double duringLatency = duringMetrics.stream()
                .filter(m -> "p99_latency".equals(m.getMetricName()))
                .mapToDouble(m -> m.getValue().doubleValue())
                .average().orElse(0);
        result.setLatencyIncrease(duringLatency - beforeLatency);

        double beforeRps = beforeMetrics.stream()
                .filter(m -> "rps".equals(m.getMetricName()))
                .mapToDouble(m -> m.getValue().doubleValue())
                .average().orElse(0);
        double duringRps = duringMetrics.stream()
                .filter(m -> "rps".equals(m.getMetricName()))
                .mapToDouble(m -> m.getValue().doubleValue())
                .average().orElse(0);
        result.setRpsDecrease(beforeRps - duringRps);

        return result;
    }

    public Experiment replayExperiment(String sourceExperimentId) {
        log.info("Replaying experiment: {}", sourceExperimentId);

        Experiment source = experimentRepository.findByExperimentId(sourceExperimentId)
                .orElseThrow(() -> new RuntimeException("Source experiment not found: " + sourceExperimentId));

        String newExperimentId = "REPLAY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Experiment replay = new Experiment();
        replay.setExperimentId(newExperimentId);
        replay.setName("回放: " + source.getName());
        replay.setDescription("从实验 " + sourceExperimentId + " 回放, 原始ID: " + source.getExperimentId());
        replay.setConfigYaml(source.getConfigYaml());
        replay.setStatus(Experiment.Status.APPROVED.name());
        replay.setChaosType(source.getChaosType());
        replay.setTargetService(source.getTargetService());
        replay.setDurationSeconds(source.getDurationSeconds());
        replay.setAutoRollback(source.getAutoRollback());
        replay.setCreatorId(1L);
        replay.setCreatorName("Replay System");
        experimentRepository.save(replay);

        experimentExecutor.executeExperiment(newExperimentId);

        log.info("Replay experiment created: {} (source: {})", newExperimentId, sourceExperimentId);
        return replay;
    }

    public ReplayComparison getReplayComparison(String originalId, String replayId) {
        ReplayComparison comparison = new ReplayComparison();
        comparison.setOriginalExperimentId(originalId);
        comparison.setReplayExperimentId(replayId);

        comparison.setOriginalMetrics(getMetricSummary(originalId));
        comparison.setReplayMetrics(getMetricSummary(replayId));

        return comparison;
    }

    private Map<String, MetricSummary> getMetricSummary(String experimentId) {
        Map<String, MetricSummary> summary = new HashMap<>();

        for (String metricName : Arrays.asList("rps", "p99_latency", "error_rate", "cpu_usage", "memory_usage")) {
            List<ExperimentMetric> beforeMetrics = metricRepository
                    .findByExperimentIdAndPhaseOrderByTimestampAsc(experimentId, ExperimentMetric.Phase.BEFORE.name());
            List<ExperimentMetric> duringMetrics = metricRepository
                    .findByExperimentIdAndPhaseOrderByTimestampAsc(experimentId, ExperimentMetric.Phase.DURING.name());
            List<ExperimentMetric> afterMetrics = metricRepository
                    .findByExperimentIdAndPhaseOrderByTimestampAsc(experimentId, ExperimentMetric.Phase.AFTER.name());

            MetricSummary metricSummary = new MetricSummary();
            metricSummary.setMetricName(metricName);
            metricSummary.setBeforeAvg(beforeMetrics.stream()
                    .filter(m -> metricName.equals(m.getMetricName()))
                    .mapToDouble(m -> m.getValue().doubleValue())
                    .average().orElse(0));
            metricSummary.setDuringAvg(duringMetrics.stream()
                    .filter(m -> metricName.equals(m.getMetricName()))
                    .mapToDouble(m -> m.getValue().doubleValue())
                    .average().orElse(0));
            metricSummary.setAfterAvg(afterMetrics.stream()
                    .filter(m -> metricName.equals(m.getMetricName()))
                    .mapToDouble(m -> m.getValue().doubleValue())
                    .average().orElse(0));
            summary.put(metricName, metricSummary);
        }

        return summary;
    }

    public String generateExplorationReport(ExplorationResult result) {
        StringBuilder report = new StringBuilder();
        String separator = "============================================================";
        report.append(separator).append("\n");
        report.append("智能实验探索报告\n");
        report.append("探索ID: ").append(result.getExplorationId()).append("\n");
        report.append("目标服务: ").append(result.getServiceName()).append("\n");
        report.append("开始时间: ").append(result.getStartTime()).append("\n");
        report.append(separator).append("\n\n");

        report.append("## 探索结果概要\n\n");
        report.append("发现最优组合数: ").append(result.getOptimalCombinations().size()).append("\n\n");

        report.append("## Top 5 组合详情\n\n");
        List<Chromosome> combinations = result.getOptimalCombinations();
        for (int i = 0; i < combinations.size(); i++) {
            Chromosome combo = combinations.get(i);
            report.append("### 组合 ").append(i + 1).append("\n");
            report.append("- 适应度: ").append(String.format("%.3f", combo.getFitness())).append("\n");
            report.append("- 活跃故障: ").append(combo.getActiveFaultCount()).append(" 个\n");
            report.append("- 故障详情:\n");

            for (String rec : geneticAlgorithmService.getRecommendations(combo)) {
                report.append("  * ").append(rec).append("\n");
            }
            report.append("\n");
        }

        report.append("## 系统脆弱点分析\n\n");
        if (!combinations.isEmpty()) {
            Chromosome best = combinations.get(0);
            report.append(analyzeVulnerabilities(best));
        }

        report.append("## 建议执行顺序\n\n");
        report.append("建议按以下顺序执行自动实验以验证发现的脆弱点:\n\n");
        for (int i = 0; i < Math.min(3, combinations.size()); i++) {
            report.append(i + 1).append(". 组合 ").append(i + 1).append(" (适应度: ")
                    .append(String.format("%.3f", combinations.get(i).getFitness())).append(")\n");
        }

        report.append("\n## 完整YAML配置\n\n");
        for (int i = 0; i < combinations.size(); i++) {
            report.append("### 组合 ").append(i + 1).append(" YAML\n");
            report.append("```yaml\n");
            report.append(combinations.get(i).toYamlConfig(result.getServiceName())).append("\n");
            report.append("```\n\n");
        }

        return report.toString();
    }

    private String analyzeVulnerabilities(Chromosome best) {
        StringBuilder analysis = new StringBuilder();

        Map<String, String> vulns = new LinkedHashMap<>();
        vulns.put("latency", "延迟敏感性高 - 网络/数据库调用对延迟敏感");
        vulns.put("exception", "异常处理脆弱 - 异常发生时系统恢复能力弱");
        vulns.put("cpuLoad", "CPU资源瓶颈 - CPU耗尽时服务降级严重");
        vulns.put("memoryLoad", "内存压力敏感 - 内存不足时OOM风险高");

        for (Map.Entry<String, Chromosome.FaultGene> entry : best.getGenes().entrySet()) {
            if (entry.getValue().isEnabled()) {
                analysis.append("⚠️ ").append(vulns.getOrDefault(entry.getKey(), entry.getKey())).append("\n");
            }
        }

        return analysis.toString();
    }

    public void stopExploration(String explorationId) {
        AtomicBoolean flag = explorationFlags.remove(explorationId);
        if (flag != null) {
            flag.set(false);
            log.info("Exploration stopped: {}", explorationId);
        }
    }

    public static class ExplorationResult {
        private String explorationId;
        private String serviceName;
        private LocalDateTime startTime;
        private List<Chromosome> optimalCombinations;
        private String report;

        public String getExplorationId() { return explorationId; }
        public void setExplorationId(String explorationId) { this.explorationId = explorationId; }
        public String getServiceName() { return serviceName; }
        public void setServiceName(String serviceName) { this.serviceName = serviceName; }
        public LocalDateTime getStartTime() { return startTime; }
        public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
        public List<Chromosome> getOptimalCombinations() { return optimalCombinations; }
        public void setOptimalCombinations(List<Chromosome> optimalCombinations) { this.optimalCombinations = optimalCombinations; }
        public String getReport() { return report; }
        public void setReport(String report) { this.report = report; }
    }

    public static class ExperimentResult {
        private String experimentId;
        private String chromosomeId;
        private int activeFaultCount;
        private double errorRateIncrease;
        private double latencyIncrease;
        private double rpsDecrease;

        public String getExperimentId() { return experimentId; }
        public void setExperimentId(String experimentId) { this.experimentId = experimentId; }
        public String getChromosomeId() { return chromosomeId; }
        public void setChromosomeId(String chromosomeId) { this.chromosomeId = chromosomeId; }
        public int getActiveFaultCount() { return activeFaultCount; }
        public void setActiveFaultCount(int activeFaultCount) { this.activeFaultCount = activeFaultCount; }
        public double getErrorRateIncrease() { return errorRateIncrease; }
        public void setErrorRateIncrease(double errorRateIncrease) { this.errorRateIncrease = errorRateIncrease; }
        public double getLatencyIncrease() { return latencyIncrease; }
        public void setLatencyIncrease(double latencyIncrease) { this.latencyIncrease = latencyIncrease; }
        public double getRpsDecrease() { return rpsDecrease; }
        public void setRpsDecrease(double rpsDecrease) { this.rpsDecrease = rpsDecrease; }

        @Override
        public String toString() {
            return String.format("ExperimentResult{id='%s', faults=%d, error+%.1f%%, latency+%.0fms, rps-%.0f}",
                    experimentId, activeFaultCount, errorRateIncrease, latencyIncrease, rpsDecrease);
        }
    }

    public static class ReplayComparison {
        private String originalExperimentId;
        private String replayExperimentId;
        private Map<String, MetricSummary> originalMetrics;
        private Map<String, MetricSummary> replayMetrics;

        public String getOriginalExperimentId() { return originalExperimentId; }
        public void setOriginalExperimentId(String originalExperimentId) { this.originalExperimentId = originalExperimentId; }
        public String getReplayExperimentId() { return replayExperimentId; }
        public void setReplayExperimentId(String replayExperimentId) { this.replayExperimentId = replayExperimentId; }
        public Map<String, MetricSummary> getOriginalMetrics() { return originalMetrics; }
        public void setOriginalMetrics(Map<String, MetricSummary> originalMetrics) { this.originalMetrics = originalMetrics; }
        public Map<String, MetricSummary> getReplayMetrics() { return replayMetrics; }
        public void setReplayMetrics(Map<String, MetricSummary> replayMetrics) { this.replayMetrics = replayMetrics; }
    }

    public static class MetricSummary {
        private String metricName;
        private double beforeAvg;
        private double duringAvg;
        private double afterAvg;

        public String getMetricName() { return metricName; }
        public void setMetricName(String metricName) { this.metricName = metricName; }
        public double getBeforeAvg() { return beforeAvg; }
        public void setBeforeAvg(double beforeAvg) { this.beforeAvg = beforeAvg; }
        public double getDuringAvg() { return duringAvg; }
        public void setDuringAvg(double duringAvg) { this.duringAvg = duringAvg; }
        public double getAfterAvg() { return afterAvg; }
        public void setAfterAvg(double afterAvg) { this.afterAvg = afterAvg; }
    }
}
