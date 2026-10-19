package com.me.payment.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("payment")
public class Payment {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private Long orderId;

    private Long buyerId;

    private BigDecimal amount;

    private String status;

    private LocalDateTime paidAt;
}