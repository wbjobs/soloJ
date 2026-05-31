package com.chaos.platform.entity;

import javax.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "experiments")
public class Experiment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "experiment_id", unique = true, nullable = false, length = 64)
    private String experimentId;

    @Column(nullable = false, length = 128)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "config_yaml", columnDefinition = "TEXT")
    private String configYaml;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "creator_id")
    private Long creatorId;

    @Column(name = "creator_name", length = 64)
    private String creatorName;

    @Column(name = "chaos_type", length = 32)
    private String chaosType;

    @Column(name = "target_service", length = 128)
    private String targetService;

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "auto_rollback")
    private Boolean autoRollback = true;

    @Column(name = "error_rate_threshold")
    private Double errorRateThreshold = 50.0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum Status {
        PENDING,
        APPROVED,
        RUNNING,
        COMPLETED,
        FAILED,
        ROLLED_BACK,
        REJECTED
    }
}
