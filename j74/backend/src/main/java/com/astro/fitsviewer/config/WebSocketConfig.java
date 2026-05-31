package com.astro.fitsviewer.config;

import com.astro.fitsviewer.websocket.PsnrWebSocketHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(psnrWebSocketHandler(), "/ws/psnr")
                .setAllowedOrigins("*");
    }

    @Bean
    public PsnrWebSocketHandler psnrWebSocketHandler() {
        return new PsnrWebSocketHandler();
    }
}
