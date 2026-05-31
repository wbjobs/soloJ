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
public class CpuLoadInjection implements ChaosInjectionStrategy {

    private final ExperimentExecutor experimentExecutor;
    private final Map<String, Thread> loadThreads = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        experimentExecutor.registerStrategy(getType(), this);
    }

    @Override
    public void inject(String experimentId, String configYaml) {
        log.info("Injecting CPU load chaos for experiment: {}", experimentId);

        Thread loadThread = new Thread(() -> {
            log.info("CPU load simulation started for experiment: {}", experimentId);
            while (!Thread.currentThread().isInterrupted()) {
                Math.pow(Math.random(), Math.random());
            }
            log.info("CPU load simulation stopped for experiment: {}", experimentId);
        });
        loadThread.start();
        loadThreads.put(experimentId, loadThread);

        log.info("CPU load injection completed for experiment: {}", experimentId);
    }

    @Override
    public void rollback(String experimentId) {
        log.info("Rolling back CPU load chaos for experiment: {}", experimentId);

        Thread loadThread = loadThreads.remove(experimentId);
        if (loadThread != null) {
            loadThread.interrupt();
            try {
                loadThread.join(1000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }

        log.info("CPU load rollback completed for experiment: {}", experimentId);
    }

    @Override
    public String getType() {
        return "cpuLoad";
    }
}
