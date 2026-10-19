package com.me.item.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("item")
public class Item {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private Long merchantId;

    private String name;

    private String category;

    private BigDecimal price;

    private Integer stock;

    private String description;

    private String imageUrls;

    private ItemStatus status;

    private Boolean isSeckill;

    private LocalDateTime endTime;

    private String brand;
}