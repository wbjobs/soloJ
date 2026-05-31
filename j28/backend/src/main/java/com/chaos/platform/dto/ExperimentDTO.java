package com.chaos.platform.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ExperimentDTO {

    private String experimentId;

    private String name;

    private String description;

    private String configYaml;

    private String status;

    private String creatorName;

    private String chaosType;

    private String targetService;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Integer durationSeconds;

    private Boolean autoRollback;

    private Double errorRateThreshold;

    private LocalDateTime createdAt;
}
