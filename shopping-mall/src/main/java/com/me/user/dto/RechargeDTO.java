package com.me.user.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record RechargeDTO(
        @NotNull(message = "Recharge amount cannot be null")
        @DecimalMin(value = "0.01", message = "Recharge amount must be greater than 0")
        BigDecimal account,

        @NotBlank(message = "UUID cannot be blank")
        String uuid
) {
}