package com.me.canal;

import com.alibaba.otter.canal.client.CanalConnector;
import com.alibaba.otter.canal.client.impl.SimpleCanalConnector;
import com.alibaba.otter.canal.protocol.Message;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.InetSocketAddress;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
public class CanalClient {

    @Value("${canal.host}")
    private String host;

    @Value("${canal.port}")
    private int port;

    @Value("${canal.destination}")
    private String destination;

    @Value("${canal.username}")
    private String username;

    @Value("${canal.password}")
    private String password;

    private CanalConnector connector;

    private final CanalMessageHandler messageHandler;

    private volatile boolean running = true;

    public CanalClient(CanalMessageHandler messageHandler) {
        this.messageHandler = messageHandler;
    }

    @PostConstruct
    public void start() {
        connector = new SimpleCanalConnector(
                new InetSocketAddress(host, port),
                username,
                password,
                destination
        );

        connector.connect();
        connector.subscribe("shopping_mall\\.item");

        Thread thread = new Thread(this::consume, "canal-consumer");
        thread.start();
    }

    private void consume() {
        while (running) {
            long batchId = -1;

            try {
                Message message = connector.getWithoutAck(100, 1L, TimeUnit.SECONDS);
                batchId = message.getId();

                if (batchId == -1) {
                    continue;
                }

                messageHandler.handle(message);
                connector.ack(batchId);
            } catch (Exception e) {
                log.error("Failed to process Canal batch {}", batchId, e);

                if (batchId != -1) {
                    try {
                        connector.rollback(batchId);
                    } catch (Exception rollbackException) {
                        log.error("Failed to rollback Canal batch {}", batchId, rollbackException);
                    }
                }

                try {
                    Thread.sleep(1000);
                } catch (InterruptedException interruptedException) {
                    Thread.currentThread().interrupt();
                    running = false;
                }
            }
        }
    }

    @PreDestroy
    public void stop() {
        running = false;

        if (connector != null) {
            connector.disconnect();
        }
    }
}