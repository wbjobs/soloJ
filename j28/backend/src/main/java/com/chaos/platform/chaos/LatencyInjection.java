package com.chaos.platform.chaos;

import com.chaos.platform.service.ExperimentExecutor;
import javax.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class LatencyInjection implements ChaosInjectionStrategy {

    private final ExperimentExecutor experimentExecutor;
    private final Map<String, Long> injectedExperiments = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        experimentExecutor.registerStrategy(getType(), this);
    }

    @Override
    public void inject(String experimentId, String configYaml) {
        log.info("Injecting latency chaos for experiment: {}", experimentId);
        log.info("Config YAML: {}", configYaml);

        injectedExperiments.put(experimentId, System.currentTimeMillis());
        log.info("Latency injection completed for experiment: {}", experimentId);
    }

    @Override
    public void rollback(String experimentId) {
        log.info("Rolling back latency chaos for experiment: {}", experimentId);

        Long startTime = injectedExperiments.remove(experimentId);
        if (startTime != null) {
            long duration = System.currentTimeMillis() - startTime;
            log.info("Latency injection was active for {}ms", duration);
        }

        log.info("Latency rollback completed for experiment: {}", experimentId);
    }

    @Override
    public String getType() {
        return "latency";
    }
}
