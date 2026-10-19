package com.me.item.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.me.item.entity.ItemStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ItemDetailVO(
        Long id,
        String name,
        String brand,
        String category,
        BigDecimal price,
        Integer stock,
        String description,
        String imageUrls,
        ItemStatus status,
        Boolean isSeckill,

        @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
        LocalDateTime endTime,
        boolean seckillEnded
) {
}
