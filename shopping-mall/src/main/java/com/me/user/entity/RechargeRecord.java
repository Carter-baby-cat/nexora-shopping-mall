package com.me.user.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@TableName("recharge_record")
public class RechargeRecord {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String uuid;

    private BigDecimal amount;

    private LocalDateTime createdAt;
}