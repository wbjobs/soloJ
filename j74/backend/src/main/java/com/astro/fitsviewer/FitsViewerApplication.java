package com.astro.fitsviewer;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class FitsViewerApplication {
    public static void main(String[] args) {
        SpringApplication.run(FitsViewerApplication.class, args);
    }
}
