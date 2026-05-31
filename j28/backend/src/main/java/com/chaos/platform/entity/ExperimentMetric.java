package com.chaos.platform.entity;

import javax.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "experiment_metrics")
public class ExperimentMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "experiment_id", nullable = false, length = 64)
    private String experimentId;

    @Column(name = "metric_type", length = 32)
    private String metricType;

    @Column(name = "metric_name", nullable = false, length = 64)
    private String metricName;

    @Column(precision = 20, scale = 4)
    private BigDecimal value;

    @CreationTimestamp
    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(length = 32)
    private String phase;

    @Column(name = "service_instance", length = 128)
    private String serviceInstance;

    public enum MetricType {
        BUSINESS,
        SYSTEM
    }

    public enum Phase {
        BEFORE,
        DURING,
        AFTER
    }
}
