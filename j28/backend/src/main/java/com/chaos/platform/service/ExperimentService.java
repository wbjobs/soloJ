package com.chaos.platform.service;

import com.chaos.platform.dto.CreateExperimentRequest;
import com.chaos.platform.dto.ExperimentDTO;
import com.chaos.platform.entity.Approval;
import com.chaos.platform.entity.Experiment;
import com.chaos.platform.repository.ApprovalRepository;
import com.chaos.platform.repository.ExperimentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExperimentService {

    private final ExperimentRepository experimentRepository;
    private final ApprovalRepository approvalRepository;
    private final ExperimentExecutor experimentExecutor;

    public Page<ExperimentDTO> getExperiments(String status, Pageable pageable) {
        Page<Experiment> experiments;
        if (status != null && !status.isEmpty()) {
            experiments = experimentRepository.findByStatus(status, pageable);
        } else {
            experiments = experimentRepository.findAll(pageable);
        }
        return experiments.map(this::convertToDTO);
    }

    public ExperimentDTO getExperiment(String experimentId) {
        Experiment experiment = experimentRepository.findByExperimentId(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found: " + experimentId));
        return convertToDTO(experiment);
    }

    @Transactional
    public ExperimentDTO createExperiment(CreateExperimentRequest request) {
        String experimentId = generateExperimentId();

        Experiment experiment = new Experiment();
        experiment.setExperimentId(experimentId);
        experiment.setName(request.getName());
        experiment.setDescription(request.getDescription());
        experiment.setConfigYaml(request.getConfigYaml());
        experiment.setStatus(Experiment.Status.PENDING.name());
        experiment.setChaosType(request.getChaosType());
        experiment.setTargetService(request.getTargetService());
        experiment.setDurationSeconds(request.getDurationSeconds());
        experiment.setAutoRollback(request.getAutoRollback());
        experiment.setErrorRateThreshold(request.getErrorRateThreshold());
        experiment.setCreatorId(1L);
        experiment.setCreatorName("System");

        experiment = experimentRepository.save(experiment);

        Approval approval = new Approval();
        approval.setExperimentId(experimentId);
        approval.setApplicantId(1L);
        approval.setApplicantName("System");
        approval.setStatus(Approval.Status.PENDING.name());
        approvalRepository.save(approval);

        log.info("Created experiment: {}", experimentId);
        return convertToDTO(experiment);
    }

    @Transactional
    public ExperimentDTO startExperiment(String experimentId) {
        Experiment experiment = experimentRepository.findByExperimentId(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found: " + experimentId));

        if (!Experiment.Status.APPROVED.name().equals(experiment.getStatus())) {
            throw new RuntimeException("Experiment must be approved before starting");
        }

        experimentExecutor.executeExperiment(experimentId);

        return getExperiment(experimentId);
    }

    @Transactional
    public ExperimentDTO stopExperiment(String experimentId) {
        Experiment experiment = experimentRepository.findByExperimentId(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found: " + experimentId));

        if (!Experiment.Status.RUNNING.name().equals(experiment.getStatus())) {
            throw new RuntimeException("Experiment is not running");
        }

        experimentExecutor.rollbackExperiment(experimentId);

        experiment.setStatus(Experiment.Status.ROLLED_BACK.name());
        experiment.setEndTime(LocalDateTime.now());
        experimentRepository.save(experiment);

        log.info("Stopped experiment: {}", experimentId);
        return convertToDTO(experiment);
    }

    @Transactional
    public void deleteExperiment(String experimentId) {
        Experiment experiment = experimentRepository.findByExperimentId(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found: " + experimentId));

        if (Experiment.Status.RUNNING.name().equals(experiment.getStatus())) {
            throw new RuntimeException("Cannot delete running experiment");
        }

        experimentRepository.delete(experiment);
        log.info("Deleted experiment: {}", experimentId);
    }

    public Map<String, Long> getStatistics() {
        Map<String, Long> stats = new HashMap<>();
        stats.put("total", experimentRepository.count());
        stats.put("pending", experimentRepository.countByStatus(Experiment.Status.PENDING.name()));
        stats.put("running", experimentRepository.countByStatus(Experiment.Status.RUNNING.name()));
        stats.put("completed", experimentRepository.countByStatus(Experiment.Status.COMPLETED.name()));
        stats.put("failed", experimentRepository.countByStatus(Experiment.Status.FAILED.name()));
        return stats;
    }

    private String generateExperimentId() {
        String experimentId;
        do {
            experimentId = "EXP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        } while (experimentRepository.existsByExperimentId(experimentId));
        return experimentId;
    }

    private ExperimentDTO convertToDTO(Experiment experiment) {
        ExperimentDTO dto = new ExperimentDTO();
        dto.setExperimentId(experiment.getExperimentId());
        dto.setName(experiment.getName());
        dto.setDescription(experiment.getDescription());
        dto.setConfigYaml(experiment.getConfigYaml());
        dto.setStatus(experiment.getStatus());
        dto.setCreatorName(experiment.getCreatorName());
        dto.setChaosType(experiment.getChaosType());
        dto.setTargetService(experiment.getTargetService());
        dto.setStartTime(experiment.getStartTime());
        dto.setEndTime(experiment.getEndTime());
        dto.setDurationSeconds(experiment.getDurationSeconds());
        dto.setAutoRollback(experiment.getAutoRollback());
        dto.setErrorRateThreshold(experiment.getErrorRateThreshold());
        dto.setCreatedAt(experiment.getCreatedAt());
        return dto;
    }
}
