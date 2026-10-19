package com.me.user.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;

@Data
@TableName("account")
public class Account {

    @TableId(value = "user_id")
    private Long userId;

    private BigDecimal balance;
}