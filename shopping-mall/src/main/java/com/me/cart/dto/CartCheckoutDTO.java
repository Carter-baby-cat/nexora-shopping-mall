package com.me.cart.dto;

import java.math.BigDecimal;

public record CartCheckoutDTO(
        Long itemId,
        Integer quantity,
        BigDecimal price
) {
}