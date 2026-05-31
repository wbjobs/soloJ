package com.chaos.platform.service;

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

@Slf4j
@Service
@RequiredArgsConstructor
public class ApprovalService {

    private final ApprovalRepository approvalRepository;
    private final ExperimentRepository experimentRepository;

    public Page<Approval> getPendingApprovals(Pageable pageable) {
        return approvalRepository.findByStatus(Approval.Status.PENDING.name(), pageable);
    }

    public Page<Approval> getAllApprovals(Pageable pageable) {
        return approvalRepository.findAll(pageable);
    }

    public Approval getApproval(String experimentId) {
        return approvalRepository.findByExperimentId(experimentId)
                .orElseThrow(() -> new RuntimeException("Approval not found for experiment: " + experimentId));
    }

    @Transactional
    public Approval approve(String experimentId, String reason) {
        Approval approval = approvalRepository.findByExperimentId(experimentId)
                .orElseThrow(() -> new RuntimeException("Approval not found for experiment: " + experimentId));

        if (!Approval.Status.PENDING.name().equals(approval.getStatus())) {
            throw new RuntimeException("Approval is not in PENDING status");
        }

        approval.setStatus(Approval.Status.APPROVED.name());
        approval.setApproverId(2L);
        approval.setApproverName("Admin");
        approval.setReason(reason);
        approval.setApprovedAt(LocalDateTime.now());
        approvalRepository.save(approval);

        Experiment experiment = experimentRepository.findByExperimentId(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found: " + experimentId));
        experiment.setStatus(Experiment.Status.APPROVED.name());
        experimentRepository.save(experiment);

        log.info("Approved experiment: {}", experimentId);
        return approval;
    }

    @Transactional
    public Approval reject(String experimentId, String reason) {
        Approval approval = approvalRepository.findByExperimentId(experimentId)
                .orElseThrow(() -> new RuntimeException("Approval not found for experiment: " + experimentId));

        if (!Approval.Status.PENDING.name().equals(approval.getStatus())) {
            throw new RuntimeException("Approval is not in PENDING status");
        }

        approval.setStatus(Approval.Status.REJECTED.name());
        approval.setApproverId(2L);
        approval.setApproverName("Admin");
        approval.setReason(reason);
        approval.setApprovedAt(LocalDateTime.now());
        approvalRepository.save(approval);

        Experiment experiment = experimentRepository.findByExperimentId(experimentId)
                .orElseThrow(() -> new RuntimeException("Experiment not found: " + experimentId));
        experiment.setStatus(Experiment.Status.REJECTED.name());
        experimentRepository.save(experiment);

        log.info("Rejected experiment: {}", experimentId);
        return approval;
    }
}
