package com.chaos.platform.controller;

import com.chaos.platform.entity.ServiceInstance;
import com.chaos.platform.service.ServiceDiscoveryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/services")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:5173")
public class ServiceDiscoveryController {

    private final ServiceDiscoveryService discoveryService;

    @GetMapping
    public ResponseEntity<List<ServiceInstance>> getAllServices() {
        return ResponseEntity.ok(discoveryService.getAllServices());
    }

    @GetMapping("/{serviceName}/instances")
    public ResponseEntity<List<ServiceInstance>> getServiceInstances(@PathVariable String serviceName) {
        return ResponseEntity.ok(discoveryService.getServiceInstances(serviceName));
    }

    @GetMapping("/{serviceName}/healthy")
    public ResponseEntity<List<ServiceInstance>> getHealthyInstances(@PathVariable String serviceName) {
        return ResponseEntity.ok(discoveryService.getHealthyInstances(serviceName));
    }

    @PostMapping("/refresh")
    public ResponseEntity<Void> refreshServices() {
        discoveryService.refreshServices();
        return ResponseEntity.ok().build();
    }

    @PostMapping
    public ResponseEntity<ServiceInstance> addServiceInstance(@RequestBody ServiceInstance instance) {
        return ResponseEntity.ok(discoveryService.addServiceInstance(instance));
    }
}
