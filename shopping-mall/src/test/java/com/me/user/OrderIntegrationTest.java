package com.me.user;

import cn.hutool.core.lang.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@AutoConfigureMockMvc
public class OrderIntegrationTest {

    @Test
    void generateIdempotencyKey() {
        String idempotencyKey = UUID.randomUUID().toString();
        System.out.println("Idempotency-Key: " + idempotencyKey);
    }
}
