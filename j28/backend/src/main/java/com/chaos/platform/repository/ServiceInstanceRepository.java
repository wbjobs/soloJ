package com.chaos.platform.repository;

import com.chaos.platform.entity.ServiceInstance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ServiceInstanceRepository extends JpaRepository<ServiceInstance, Long> {

    List<ServiceInstance> findByServiceName(String serviceName);

    List<ServiceInstance> findBySource(String source);

    List<ServiceInstance> findByServiceNameAndHealthStatus(String serviceName, String healthStatus);

    Optional<ServiceInstance> findByServiceNameAndHostAndPort(String serviceName, String host, Integer port);

    void deleteByServiceNameAndSource(String serviceName, String source);
}
