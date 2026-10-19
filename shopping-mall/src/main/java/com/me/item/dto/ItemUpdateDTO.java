package com.me.item.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.me.item.entity.ItemStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ItemUpdateDTO(
        @NotNull
        Long id,

        @NotBlank
        String name,

        @NotBlank
        String brand,

        @NotBlank
        String category,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal price,

        @NotBlank
        String description,

        @NotBlank
        String imageUrls,

        @NotNull
        ItemStatus status,

        @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
        LocalDateTime endTime
) {
}