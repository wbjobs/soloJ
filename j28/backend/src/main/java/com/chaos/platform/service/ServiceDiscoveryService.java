package com.chaos.platform.service;

import com.chaos.platform.entity.ServiceInstance;
import com.chaos.platform.repository.ServiceInstanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class ServiceDiscoveryService {

    private final ServiceInstanceRepository instanceRepository;
    private final Map<String, List<ServiceInstance>> cache = new ConcurrentHashMap<>();

    public List<ServiceInstance> getAllServices() {
        initializeDemoData();
        return instanceRepository.findAll();
    }

    public List<ServiceInstance> getServiceInstances(String serviceName) {
        return instanceRepository.findByServiceName(serviceName);
    }

    public List<ServiceInstance> getHealthyInstances(String serviceName) {
        return instanceRepository.findByServiceNameAndHealthStatus(
                serviceName, ServiceInstance.HealthStatus.HEALTHY.name());
    }

    public ServiceInstance addServiceInstance(ServiceInstance instance) {
        return instanceRepository.save(instance);
    }

    public void refreshServices() {
        log.info("Refreshing service instances from discovery...");
        refreshFromConsul();
        refreshFromEtcd();
    }

    private void refreshFromConsul() {
        log.debug("Refreshing from Consul...");
    }

    private void refreshFromEtcd() {
        log.debug("Refreshing from Etcd...");
    }

    private void initializeDemoData() {
        if (instanceRepository.count() > 0) {
            return;
        }

        String[] services = {"order-service", "payment-service", "user-service", "inventory-service", "gateway-service"};
        String[] sources = {ServiceInstance.Source.CONSUL.name(), ServiceInstance.Source.MANUAL.name()};

        for (String service : services) {
            for (int i = 0; i < 2 + (int) (Math.random() * 2); i++) {
                ServiceInstance instance = new ServiceInstance();
                instance.setServiceName(service);
                instance.setHost("192.168.1." + (100 + i));
                instance.setPort(8080 + i);
                instance.setSource(sources[i % sources.length]);
                instance.setHealthStatus(ServiceInstance.HealthStatus.HEALTHY.name());
                instance.setLastChecked(LocalDateTime.now());
                instanceRepository.save(instance);
            }
        }

        log.info("Initialized demo service data");
    }
}
