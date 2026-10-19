package com.me.order.dto;

import jakarta.validation.constraints.NotNull;

public record CancelOrderDTO(
        @NotNull Long orderId
) {
}