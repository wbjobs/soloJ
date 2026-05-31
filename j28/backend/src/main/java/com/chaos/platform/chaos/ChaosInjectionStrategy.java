package com.chaos.platform.chaos;

public interface ChaosInjectionStrategy {

    void inject(String experimentId, String configYaml);

    void rollback(String experimentId);

    String getType();
}
