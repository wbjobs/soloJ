package com.chaos.platform.chaos;

import com.chaos.platform.service.ExperimentExecutor;
import javax.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class MemoryLoadInjection implements ChaosInjectionStrategy {

    private final ExperimentExecutor experimentExecutor;
    private final Map<String, List<byte[]>> memoryLoads = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        experimentExecutor.registerStrategy(getType(), this);
    }

    @Override
    public void inject(String experimentId, String configYaml) {
        log.info("Injecting memory load chaos for experiment: {}", experimentId);

        List<byte[]> memoryBlocks = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            memoryBlocks.add(new byte[1024 * 1024]);
        }
        memoryLoads.put(experimentId, memoryBlocks);

        log.info("Allocated {} MB memory for experiment: {}", memoryBlocks.size(), experimentId);
        log.info("Memory load injection completed for experiment: {}", experimentId);
    }

    @Override
    public void rollback(String experimentId) {
        log.info("Rolling back memory load chaos for experiment: {}", experimentId);

        List<byte[]> blocks = memoryLoads.remove(experimentId);
        if (blocks != null) {
            blocks.clear();
            System.gc();
            log.info("Memory released for experiment: {}", experimentId);
        }

        log.info("Memory load rollback completed for experiment: {}", experimentId);
    }

    @Override
    public String getType() {
        return "memoryLoad";
    }
}
