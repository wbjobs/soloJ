package com.chaos.platform.controller;

import com.chaos.platform.entity.Approval;
import com.chaos.platform.service.ApprovalService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/approvals")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class ApprovalController {

    private final ApprovalService approvalService;

    @GetMapping("/pending")
    public ResponseEntity<Page<Approval>> getPendingApprovals(
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(approvalService.getPendingApprovals(pageable));
    }

    @GetMapping
    public ResponseEntity<Page<Approval>> getAllApprovals(
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(approvalService.getAllApprovals(pageable));
    }

    @GetMapping("/experiment/{experimentId}")
    public ResponseEntity<Approval> getApproval(@PathVariable String experimentId) {
        return ResponseEntity.ok(approvalService.getApproval(experimentId));
    }

    @PostMapping("/{experimentId}/approve")
    public ResponseEntity<Approval> approve(
            @PathVariable String experimentId,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(approvalService.approve(experimentId, reason));
    }

    @PostMapping("/{experimentId}/reject")
    public ResponseEntity<Approval> reject(
            @PathVariable String experimentId,
            @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : "实验不符合要求";
        return ResponseEntity.ok(approvalService.reject(experimentId, reason));
    }
}
