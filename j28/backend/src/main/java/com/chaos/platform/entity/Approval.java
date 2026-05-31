package com.chaos.platform.entity;

import javax.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "approvals")
public class Approval {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "experiment_id", nullable = false, length = 64)
    private String experimentId;

    @Column(name = "applicant_id", nullable = false)
    private Long applicantId;

    @Column(name = "applicant_name", length = 64)
    private String applicantName;

    @Column(name = "approver_id")
    private Long approverId;

    @Column(name = "approver_name", length = 64)
    private String approverName;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    public enum Status {
        PENDING,
        APPROVED,
        REJECTED
    }
}
