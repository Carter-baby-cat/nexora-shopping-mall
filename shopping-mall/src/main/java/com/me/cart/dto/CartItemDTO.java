package com.me.cart.dto;

import com.me.item.dto.ItemDTO;
import jakarta.validation.constraints.Min;

public record CartItemDTO(
        ItemDTO itemDTO,

        @Min(value = 1, message = "Quantity must be at least 1")
        Integer quantity
) {
}