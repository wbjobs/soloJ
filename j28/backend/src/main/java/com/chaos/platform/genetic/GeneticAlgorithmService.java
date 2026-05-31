package com.chaos.platform.genetic;

import com.chaos.platform.entity.Experiment;
import com.chaos.platform.entity.ExperimentMetric;
import com.chaos.platform.repository.ExperimentMetricRepository;
import com.chaos.platform.repository.ExperimentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GeneticAlgorithmService {

    private final ExperimentRepository experimentRepository;
    private final ExperimentMetricRepository metricRepository;

    private static final int POPULATION_SIZE = 20;
    private static final int MAX_GENERATIONS = 10;
    private static final double MUTATION_RATE = 0.1;
    private static final double CROSSOVER_RATE = 0.8;
    private static final int TOURNAMENT_SIZE = 3;

    public List<Chromosome> generateOptimalFaultCombinations(String serviceName) {
        log.info("Starting genetic algorithm for service: {}", serviceName);

        List<Chromosome> population = initializePopulation();
        List<Chromosome> bestChromosomes = new ArrayList<>();

        for (int generation = 0; generation < MAX_GENERATIONS; generation++) {
            log.info("Generation {}: evaluating {} chromosomes", generation + 1, population.size());

            evaluatePopulation(population, serviceName);

            Chromosome best = population.stream()
                    .max(Comparator.comparingDouble(Chromosome::getFitness))
                    .orElse(null);
            if (best != null) {
                bestChromosomes.add(best);
                log.info("Generation {} best: fitness={}, faults={}",
                        generation + 1,
                        String.format("%.3f", best.getFitness()),
                        best.getActiveFaultCount());
            }

            if (generation < MAX_GENERATIONS - 1) {
                population = evolve(population);
            }
        }

        return bestChromosomes.stream()
                .sorted(Comparator.comparingDouble(Chromosome::getFitness).reversed())
                .limit(5)
                .collect(Collectors.toList());
    }

    private List<Chromosome> initializePopulation() {
        List<Chromosome> population = new ArrayList<>();
        for (int i = 0; i < POPULATION_SIZE; i++) {
            population.add(new Chromosome());
        }
        return population;
    }

    private void evaluatePopulation(List<Chromosome> population, String serviceName) {
        for (Chromosome chromosome : population) {
            double fitness = calculateFitness(chromosome, serviceName);
            chromosome.setFitness(fitness);
        }
    }

    private double calculateFitness(Chromosome chromosome, String serviceName) {
        double fitness = 0.0;

        int activeFaults = chromosome.getActiveFaultCount();
        if (activeFaults == 0) {
            return 0.0;
        }

        fitness += activeFaults * 0.3;

        double avgIntensity = chromosome.getGenes().values().stream()
                .filter(Chromosome.FaultGene::isEnabled)
                .mapToDouble(Chromosome.FaultGene::getIntensity)
                .average()
                .orElse(0);
        fitness += (avgIntensity / 100) * 0.2;

        double severityScore = estimateImpact(chromosome, serviceName);
        fitness += severityScore * 0.5;

        return Math.min(1.0, fitness);
    }

    private double estimateImpact(Chromosome chromosome, String serviceName) {
        List<Experiment> relatedExperiments = experimentRepository.findAll().stream()
                .filter(e -> serviceName.equals(e.getTargetService()))
                .filter(e -> !Experiment.Status.PENDING.name().equals(e.getStatus()))
                .limit(10)
                .collect(Collectors.toList());

        if (relatedExperiments.isEmpty()) {
            return 0.5;
        }

        double avgErrorRate = 0;
        double avgLatencyIncrease = 0;
        int count = 0;

        for (Experiment exp : relatedExperiments) {
            List<ExperimentMetric> beforeMetrics = metricRepository
                    .findByExperimentIdAndPhaseOrderByTimestampAsc(
                            exp.getExperimentId(), ExperimentMetric.Phase.BEFORE.name());
            List<ExperimentMetric> duringMetrics = metricRepository
                    .findByExperimentIdAndPhaseOrderByTimestampAsc(
                            exp.getExperimentId(), ExperimentMetric.Phase.DURING.name());

            if (!beforeMetrics.isEmpty() && !duringMetrics.isEmpty()) {
                double beforeError = beforeMetrics.stream()
                        .filter(m -> "error_rate".equals(m.getMetricName()))
                        .mapToDouble(m -> m.getValue().doubleValue())
                        .average().orElse(0);
                double duringError = duringMetrics.stream()
                        .filter(m -> "error_rate".equals(m.getMetricName()))
                        .mapToDouble(m -> m.getValue().doubleValue())
                        .average().orElse(0);
                avgErrorRate += duringError - beforeError;

                double beforeLatency = beforeMetrics.stream()
                        .filter(m -> "p99_latency".equals(m.getMetricName()))
                        .mapToDouble(m -> m.getValue().doubleValue())
                        .average().orElse(0);
                double duringLatency = duringMetrics.stream()
                        .filter(m -> "p99_latency".equals(m.getMetricName()))
                        .mapToDouble(m -> m.getValue().doubleValue())
                        .average().orElse(0);
                avgLatencyIncrease += duringLatency - beforeLatency;
                count++;
            }
        }

        if (count == 0) {
            return 0.5;
        }

        avgErrorRate /= count;
        avgLatencyIncrease /= count;

        double normalizedError = Math.min(1.0, Math.abs(avgErrorRate) / 30);
        double normalizedLatency = Math.min(1.0, Math.abs(avgLatencyIncrease) / 1000);

        return (normalizedError + normalizedLatency) / 2;
    }

    private List<Chromosome> evolve(List<Chromosome> population) {
        List<Chromosome> newPopulation = new ArrayList<>();

        List<Chromosome> sorted = population.stream()
                .sorted(Comparator.comparingDouble(Chromosome::getFitness).reversed())
                .collect(Collectors.toList());

        newPopulation.add(sorted.get(0));
        newPopulation.add(sorted.get(1));

        while (newPopulation.size() < POPULATION_SIZE) {
            Chromosome parent1 = tournamentSelect(population);
            Chromosome parent2 = tournamentSelect(population);

            if (Math.random() < CROSSOVER_RATE) {
                Chromosome child = parent1.crossover(parent2);
                child.mutate(MUTATION_RATE);
                newPopulation.add(child);
            } else {
                newPopulation.add(Math.random() < 0.5 ? parent1 : parent2);
            }
        }

        return newPopulation;
    }

    private Chromosome tournamentSelect(List<Chromosome> population) {
        List<Chromosome> tournament = new ArrayList<>();
        Random random = new Random();

        for (int i = 0; i < TOURNAMENT_SIZE; i++) {
            tournament.add(population.get(random.nextInt(population.size())));
        }

        return tournament.stream()
                .max(Comparator.comparingDouble(Chromosome::getFitness))
                .orElse(population.get(0));
    }

    public List<String> getRecommendations(Chromosome chromosome) {
        List<String> recommendations = new ArrayList<>();

        for (Chromosome.FaultGene gene : chromosome.getGenes().values()) {
            if (gene.isEnabled()) {
                StringBuilder rec = new StringBuilder();
                rec.append(getFaultTypeName(gene.getType()));
                rec.append(" - 强度: ").append(String.format("%.0f%%", gene.getIntensity()));
                rec.append(", 持续: ").append(gene.getDuration()).append("秒");
                rec.append(", 概率: ").append(String.format("%.0f%%", gene.getProbability() * 100));
                recommendations.add(rec.toString());
            }
        }

        return recommendations;
    }

    private String getFaultTypeName(String type) {
        Map<String, String> typeNames = new HashMap<>();
        typeNames.put("latency", "延迟注入");
        typeNames.put("exception", "异常注入");
        typeNames.put("cpuLoad", "CPU资源耗尽");
        typeNames.put("memoryLoad", "内存资源耗尽");
        return typeNames.getOrDefault(type, type);
    }

    public String generateReport(String serviceName, List<Chromosome> results) {
        StringBuilder report = new StringBuilder();
        String separator = "============================================================";
        report.append(separator).append("\n");
        report.append("混沌工程 - 智能实验探索报告\n");
        report.append("目标服务: ").append(serviceName).append("\n");
        report.append("生成时间: ").append(LocalDateTime.now()).append("\n");
        report.append(separator).append("\n\n");

        report.append("## 遗传算法配置\n");
        report.append("- 种群大小: ").append(POPULATION_SIZE).append("\n");
        report.append("- 迭代次数: ").append(MAX_GENERATIONS).append("\n");
        report.append("- 变异率: ").append(String.format("%.0f%%", MUTATION_RATE * 100)).append("\n");
        report.append("- 交叉率: ").append(String.format("%.0f%%", CROSSOVER_RATE * 100)).append("\n\n");

        report.append("## Top 5 最优故障组合\n\n");

        for (int i = 0; i < results.size(); i++) {
            Chromosome chrom = results.get(i);
            report.append("### 组合 ").append(i + 1).append("\n");
            report.append("适应度: ").append(String.format("%.3f", chrom.getFitness())).append("\n");
            report.append("活跃故障数: ").append(chrom.getActiveFaultCount()).append("\n");
            report.append("故障详情:\n");

            for (String rec : getRecommendations(chrom)) {
                report.append("  - ").append(rec).append("\n");
            }
            report.append("\n");
        }

        report.append("## 系统脆弱点分析\n\n");
        Chromosome best = results.get(0);
        report.append("基于最优组合分析，系统在以下方面存在脆弱点:\n\n");

        if (best.getGenes().get("latency").isEnabled()) {
            report.append("⚠️ **延迟敏感**: 系统对延迟较为敏感，建议优化网络调用和数据库查询\n");
        }
        if (best.getGenes().get("exception").isEnabled()) {
            report.append("⚠️ **异常处理不足**: 异常处理机制需要加强，增加重试和降级策略\n");
        }
        if (best.getGenes().get("cpuLoad").isEnabled()) {
            report.append("⚠️ **CPU资源瓶颈**: CPU资源不足时系统性能下降明显，建议扩容或优化计算逻辑\n");
        }
        if (best.getGenes().get("memoryLoad").isEnabled()) {
            report.append("⚠️ **内存资源敏感**: 内存压力对系统影响较大，建议优化内存使用或扩容\n");
        }

        report.append("\n## 建议措施\n\n");
        report.append("1. 优先针对识别出的脆弱点进行优化\n");
        report.append("2. 定期执行自动生成的实验以持续验证系统稳定性\n");
        report.append("3. 建立监控告警机制，及时发现性能下降\n");
        report.append("4. 考虑引入熔断、限流、降级等服务保护机制\n");

        report.append("\n").append(separator).append("\n");
        report.append("报告由混沌工程平台自动生成\n");
        report.append(separator);

        return report.toString();
    }
}
