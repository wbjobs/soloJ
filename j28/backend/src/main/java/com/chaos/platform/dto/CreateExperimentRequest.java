package com.chaos.platform.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateExperimentRequest {

    @NotBlank(message = "实验名称不能为空")
    @Size(max = 128, message = "实验名称不能超过128个字符")
    private String name;

    private String description;

    @NotBlank(message = "YAML配置不能为空")
    private String configYaml;

    @NotBlank(message = "故障类型不能为空")
    private String chaosType;

    private String targetService;

    private Integer durationSeconds;

    private Boolean autoRollback = true;

    private Double errorRateThreshold = 50.0;
}
