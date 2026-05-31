package com.chaos.platform.controller;

import com.chaos.platform.dto.CreateExperimentRequest;
import com.chaos.platform.dto.ExperimentDTO;
import com.chaos.platform.service.ExperimentService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/experiments")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class ExperimentController {

    private final ExperimentService experimentService;

    @GetMapping
    public ResponseEntity<Page<ExperimentDTO>> getExperiments(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(experimentService.getExperiments(status, pageable));
    }

    @GetMapping("/{experimentId}")
    public ResponseEntity<ExperimentDTO> getExperiment(@PathVariable String experimentId) {
        return ResponseEntity.ok(experimentService.getExperiment(experimentId));
    }

    @PostMapping
    public ResponseEntity<ExperimentDTO> createExperiment(
            @Valid @RequestBody CreateExperimentRequest request) {
        return ResponseEntity.ok(experimentService.createExperiment(request));
    }

    @PostMapping("/{experimentId}/start")
    public ResponseEntity<ExperimentDTO> startExperiment(@PathVariable String experimentId) {
        return ResponseEntity.ok(experimentService.startExperiment(experimentId));
    }

    @PostMapping("/{experimentId}/stop")
    public ResponseEntity<ExperimentDTO> stopExperiment(@PathVariable String experimentId) {
        return ResponseEntity.ok(experimentService.stopExperiment(experimentId));
    }

    @DeleteMapping("/{experimentId}")
    public ResponseEntity<Void> deleteExperiment(@PathVariable String experimentId) {
        experimentService.deleteExperiment(experimentId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/statistics")
    public ResponseEntity<Map<String, Long>> getStatistics() {
        return ResponseEntity.ok(experimentService.getStatistics());
    }
}
