package com.me.order.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record SeckillOrderDTO(
        @NotNull(message = "Item ID cannot be null")
        Long itemId,

        @NotNull(message = "Seckill quantity cannot be null")
        @Min(value = 1, message = "Seckill quantity must be at least 1")
        @Max(value = 1, message = "Seckill quantity must be at most 1")
        Integer quantity
) {
}