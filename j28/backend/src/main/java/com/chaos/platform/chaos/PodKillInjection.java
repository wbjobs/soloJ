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
public class PodKillInjection implements ChaosInjectionStrategy {

    private final ExperimentExecutor experimentExecutor;
    private final Map<String, Integer> killedPods = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        experimentExecutor.registerStrategy(getType(), this);
    }

    @Override
    public void inject(String experimentId, String configYaml) {
        log.info("Injecting pod kill chaos for experiment: {}", experimentId);

        int podCount = 1 + (int) (Math.random() * 2);
        killedPods.put(experimentId, podCount);

        log.info("Simulated killing {} pods for experiment: {}", podCount, experimentId);
        log.info("Pod kill injection completed for experiment: {}", experimentId);
    }

    @Override
    public void rollback(String experimentId) {
        log.info("Rolling back pod kill chaos for experiment: {}", experimentId);

        Integer count = killedPods.remove(experimentId);
        if (count != null) {
            log.info("Pods would be restored (simulation) for experiment: {}", experimentId);
        }

        log.info("Pod kill rollback completed for experiment: {}", experimentId);
    }

    @Override
    public String getType() {
        return "podKill";
    }
}
