package com.me.order.entity;

import com.baomidou.mybatisplus.annotation.EnumValue;
import lombok.Getter;

@Getter
public enum OrderStatus {

    PENDING("PENDING"),
    PAID("PAID"),
    CANCELLED("CANCELLED");

    @EnumValue
    private final String value;

    OrderStatus(String value) {
        this.value = value;
    }
}
