package com.me.order.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record NormalOrderItemDTO(
        @NotNull
        Long itemId,

        @NotNull
        @Positive
        Integer quantity
) {
}