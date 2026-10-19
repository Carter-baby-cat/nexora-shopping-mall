package com.me.cart.dto;

import jakarta.validation.constraints.Min;

public record CartUpdateDTO(
        Long itemId,
        @Min(value = 1, message = "Quantity must be greater than or equal to 1")
        Integer quantity
) {
}