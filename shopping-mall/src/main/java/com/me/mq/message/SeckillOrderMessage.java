package com.me.mq.message;

public record SeckillOrderMessage(
        String orderNo,
        Long userId,
        Long itemId,
        Integer quantity,
        String idempotencyKey,
        Long acceptedAtEpochMillis,
        Long saleEndTimeEpochMillis
) {
}
