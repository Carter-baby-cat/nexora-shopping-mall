package com.me.item.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.me.item.entity.ItemStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.groups.Default;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ItemDTO(

        @NotNull(
                message = "id must not be null",
                groups = Update.class
        )
        Long id,

        @NotBlank(message = "name must not be blank")
        String name,

        @NotBlank(message = "brand must not be blank")
        String brand,

        @NotBlank(message = "category must not be blank")
        String category,

        @NotNull(message = "price must not be null")
        @DecimalMin(
                value = "0.01",
                message = "price must be greater than 0"
        )
        BigDecimal price,

        @NotNull(message = "stock must not be null")
        @Min(
                value = 0,
                message = "stock must be greater than or equal to 0"
        )
        Integer stock,

        @NotBlank(message = "description must not be blank")
        String description,

        @NotBlank(message = "imageUrls must not be blank")
        String imageUrls,

        @NotNull(
                message = "status must not be null",
                groups = Update.class
        )
        ItemStatus status,

        @NotNull(message = "isSeckill must not be null")
        Boolean isSeckill,

        @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
        LocalDateTime endTime

) {

    public interface Create extends Default {
    }

    public interface Update extends Default {
    }
}