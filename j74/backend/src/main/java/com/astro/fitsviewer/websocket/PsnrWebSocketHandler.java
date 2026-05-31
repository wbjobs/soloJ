package com.astro.fitsviewer.websocket;

import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

public class PsnrWebSocketHandler extends TextWebSocketHandler {

    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<String, WebSocketSession>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.put(session.getId(), session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
    }

    public void broadcastProgress(String taskId, double progress, String status) {
        String payload = "{\"taskId\":\"" + taskId + "\",\"progress\":" + progress + ",\"status\":\"" + status + "\"}";
        TextMessage msg = new TextMessage(payload);
        for (WebSocketSession session : sessions.values()) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(msg);
                } catch (IOException e) {
                    sessions.remove(session.getId());
                }
            }
        }
    }

    public void broadcastResult(String taskId, double psnr, double mse, String status) {
        String payload = "{\"taskId\":\"" + taskId + "\",\"psnr\":" + String.format("%.4f", psnr)
                + ",\"mse\":" + String.format("%.6f", mse)
                + ",\"progress\":100.0,\"status\":\"" + status + "\"}";
        TextMessage msg = new TextMessage(payload);
        for (WebSocketSession session : sessions.values()) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(msg);
                } catch (IOException e) {
                    sessions.remove(session.getId());
                }
            }
        }
    }
}
