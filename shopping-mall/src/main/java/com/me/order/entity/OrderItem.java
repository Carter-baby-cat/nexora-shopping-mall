package com.me.order.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;

@Data
@TableName("order_item")
public class OrderItem {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private Long orderId;

    private Long itemId;

    private String itemName;

    private BigDecimal price;

    private Integer quantity;

    private BigDecimal subtotal;
}