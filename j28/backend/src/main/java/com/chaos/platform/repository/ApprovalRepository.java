package com.chaos.platform.repository;

import com.chaos.platform.entity.Approval;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ApprovalRepository extends JpaRepository<Approval, Long> {

    Optional<Approval> findByExperimentId(String experimentId);

    Page<Approval> findByStatus(String status, Pageable pageable);

    Page<Approval> findByApplicantId(Long applicantId, Pageable pageable);

    Page<Approval> findByApproverId(Long approverId, Pageable pageable);

    boolean existsByExperimentIdAndStatus(String experimentId, String status);
}
