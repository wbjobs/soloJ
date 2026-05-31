package com.chaos.platform.entity;

import javax.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "service_instances")
public class ServiceInstance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "service_name", nullable = false, length = 128)
    private String serviceName;

    @Column(nullable = false, length = 128)
    private String host;

    @Column(nullable = false)
    private Integer port;

    @Column(length = 32)
    private String source;

    @Column(name = "health_status", length = 32)
    private String healthStatus;

    @Column(name = "last_checked")
    private LocalDateTime lastChecked;

    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum Source {
        CONSUL,
        ETCD,
        MANUAL
    }

    public enum HealthStatus {
        HEALTHY,
        UNHEALTHY,
        UNKNOWN
    }
}
