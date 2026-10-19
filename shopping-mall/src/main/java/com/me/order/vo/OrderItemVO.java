package com.me.order.vo;

import java.math.BigDecimal;

public record OrderItemVO(
        String imageUrl,
        String itemName,
        Integer quantity,
        BigDecimal totalPrice
) {
}