package com.me.item.entity;

import com.baomidou.mybatisplus.annotation.EnumValue;
import lombok.Getter;

@Getter
public enum ItemStatus {

    ONLINE("ONLINE"),
    SOLD_OUT("SOLD_OUT"),
    OFFLINE("OFFLINE");

    @EnumValue
    private final String value;

    ItemStatus(String value) {
        this.value = value;
    }

}