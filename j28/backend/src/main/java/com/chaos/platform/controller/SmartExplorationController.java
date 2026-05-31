package com.chaos.platform.controller;

import com.chaos.platform.genetic.Chromosome;
import com.chaos.platform.service.SmartExplorationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.chaos.platform.entity.Experiment;

@RestController
@RequestMapping("/api/exploration")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class SmartExplorationController {

    private final SmartExplorationService explorationService;

    @PostMapping("/start")
    public ResponseEntity<SmartExplorationService.ExplorationResult> startExploration(
            @RequestBody Map<String, Object> request) {
        String serviceName = (String) request.getOrDefault("serviceName", "order-service");
        int experimentCount = request.get("experimentCount") != null ?
                ((Number) request.get("experimentCount")).intValue() : 5;

        SmartExplorationService.ExplorationResult result = explorationService.startExploration(serviceName, experimentCount);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/execute")
    public ResponseEntity<Map<String, String>> executeAutoExperiments(
            @RequestBody Map<String, Object> request) {
        String serviceName = (String) request.getOrDefault("serviceName", "order-service");
        List<Chromosome> combinations = (List<Chromosome>) request.get("combinations");

        if (combinations != null && !combinations.isEmpty()) {
            explorationService.executeAutoExperiments(serviceName, combinations);
        }

        Map<String, String> response = new HashMap<>();
        response.put("message", "自动实验执行已启动");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/replay/{experimentId}")
    public ResponseEntity<Map<String, Object>> replayExperiment(@PathVariable String experimentId) {
        Experiment replay = explorationService.replayExperiment(experimentId);
        Map<String, Object> response = new HashMap<>();
        response.put("message", "实验回放已启动");
        response.put("replayId", replay.getExperimentId());
        response.put("originalId", experimentId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/replay/comparison")
    public ResponseEntity<SmartExplorationService.ReplayComparison> getReplayComparison(
            @RequestParam String originalId,
            @RequestParam String replayId) {
        return ResponseEntity.ok(explorationService.getReplayComparison(originalId, replayId));
    }

    @GetMapping("/report/{explorationId}")
    public ResponseEntity<String> getExplorationReport(@PathVariable String explorationId) {
        return ResponseEntity.ok("探索报告功能待完善");
    }

    @PostMapping("/stop/{explorationId}")
    public ResponseEntity<Map<String, String>> stopExploration(@PathVariable String explorationId) {
        explorationService.stopExploration(explorationId);
        Map<String, String> response = new HashMap<>();
        response.put("message", "探索已停止");
        return ResponseEntity.ok(response);
    }
}
