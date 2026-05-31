package com.chaos.platform.genetic;

import lombok.Data;

import java.util.*;

@Data
public class Chromosome implements Comparable<Chromosome> {

    private String id;
    private Map<String, FaultGene> genes;
    private double fitness;
    private Map<String, Double> metrics;

    public Chromosome() {
        this.id = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        this.genes = new HashMap<>();
        this.metrics = new HashMap<>();
        initializeGenes();
    }

    private void initializeGenes() {
        genes.put("latency", new FaultGene("latency"));
        genes.put("exception", new FaultGene("exception"));
        genes.put("cpuLoad", new FaultGene("cpuLoad"));
        genes.put("memoryLoad", new FaultGene("memoryLoad"));
    }

    public static class FaultGene {
        private String type;
        private boolean enabled;
        private double intensity;
        private int duration;
        private double probability;

        public FaultGene() {
            this.type = "latency";
            this.enabled = false;
            this.intensity = 0;
            this.duration = 30;
            this.probability = 0.5;
        }

        public FaultGene(String type) {
            this.type = type;
            this.enabled = Math.random() > 0.7;
            this.intensity = Math.random() * 100;
            this.duration = (int) (30 + Math.random() * 120);
            this.probability = Math.random();
        }

        public FaultGene copy() {
            FaultGene copy = new FaultGene();
            copy.type = this.type;
            copy.enabled = this.enabled;
            copy.intensity = this.intensity;
            copy.duration = this.duration;
            copy.probability = this.probability;
            return copy;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public double getIntensity() {
            return intensity;
        }

        public void setIntensity(double intensity) {
            this.intensity = intensity;
        }

        public int getDuration() {
            return duration;
        }

        public void setDuration(int duration) {
            this.duration = duration;
        }

        public double getProbability() {
            return probability;
        }

        public void setProbability(double probability) {
            this.probability = probability;
        }
    }

    public void mutate(double mutationRate) {
        for (Map.Entry<String, FaultGene> entry : genes.entrySet()) {
            FaultGene gene = entry.getValue();
            if (Math.random() < mutationRate) {
                gene.setEnabled(!gene.isEnabled());
            }
            if (Math.random() < mutationRate && gene.isEnabled()) {
                gene.setIntensity(Math.max(0, Math.min(100, gene.getIntensity() + (Math.random() - 0.5) * 30)));
            }
            if (Math.random() < mutationRate && gene.isEnabled()) {
                gene.setDuration(Math.max(10, Math.min(300, gene.getDuration() + (int) ((Math.random() - 0.5) * 60))));
            }
            if (Math.random() < mutationRate && gene.isEnabled()) {
                gene.setProbability(Math.max(0.1, Math.min(1.0, gene.getProbability() + (Math.random() - 0.5) * 0.3)));
            }
        }
    }

    public Chromosome crossover(Chromosome other) {
        Chromosome child = new Chromosome();
        for (Map.Entry<String, FaultGene> entry : genes.entrySet()) {
            String type = entry.getKey();
            if (Math.random() < 0.5) {
                child.getGenes().put(type, this.genes.get(type).copy());
            } else {
                child.getGenes().put(type, other.getGenes().get(type).copy());
            }
        }
        return child;
    }

    public int getActiveFaultCount() {
        return (int) genes.values().stream().filter(FaultGene::isEnabled).count();
    }

    public String toYamlConfig(String serviceName) {
        StringBuilder yaml = new StringBuilder();
        yaml.append("apiVersion: chaos.platform/v1\n");
        yaml.append("kind: ChaosExperiment\n");
        yaml.append("metadata:\n");
        yaml.append("  name: auto-experiment-").append(id.toLowerCase()).append("\n");
        yaml.append("  description: Genetic algorithm generated experiment\n");
        yaml.append("spec:\n");
        yaml.append("  target:\n");
        yaml.append("    serviceDiscovery: consul\n");
        yaml.append("    serviceName: ").append(serviceName).append("\n");
        yaml.append("    instances: all\n");
        yaml.append("  chaosType: combination\n");
        yaml.append("  duration: ").append(getMaxDuration()).append("s\n");
        yaml.append("  autoRollback: true\n");
        yaml.append("  combinationConfig:\n");

        for (FaultGene gene : genes.values()) {
            if (gene.isEnabled()) {
                yaml.append("    - type: ").append(gene.getType()).append("\n");
                yaml.append("      intensity: ").append(String.format("%.1f", gene.getIntensity())).append("\n");
                yaml.append("      duration: ").append(gene.getDuration()).append("s\n");
                yaml.append("      probability: ").append(String.format("%.2f", gene.getProbability())).append("\n");
            }
        }

        return yaml.toString();
    }

    private int getMaxDuration() {
        return genes.values().stream()
                .filter(FaultGene::isEnabled)
                .mapToInt(FaultGene::getDuration)
                .max()
                .orElse(60);
    }

    @Override
    public int compareTo(Chromosome other) {
        return Double.compare(this.fitness, other.fitness);
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append("Chromosome{id='").append(id).append('\'');
        sb.append(", fitness=").append(String.format("%.3f", fitness));
        sb.append(", activeFaults=[");
        genes.values().stream()
                .filter(FaultGene::isEnabled)
                .forEach(g -> sb.append(g.getType()).append("(int=").append(String.format("%.0f", g.getIntensity())).append("%) "));
        sb.append("]}");
        return sb.toString();
    }
}
