package com.me.payment.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;

@Data
@TableName("payment_item")
public class PaymentItem {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private Long paymentId;
    private Long orderItemId;
    private Long itemId;
    private Long sellerId;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal amount;
}