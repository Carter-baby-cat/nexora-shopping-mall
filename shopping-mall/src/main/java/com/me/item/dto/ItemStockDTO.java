package com.me.item.dto;

import jakarta.validation.constraints.NotNull;

public record ItemStockDTO(
        @NotNull Long itemId,
        @NotNull Integer delta
) {
}