package com.me.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.me.user.entity.Account;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;

public interface AccountMapper extends BaseMapper<Account> {

    int increaseBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount);

    @Update("""
        UPDATE account
        SET balance = balance - #{amount}
        WHERE user_id = #{userId}
          AND balance >= #{amount}
        """)
    int decreaseBalance(
            @Param("userId") Long userId,
            @Param("amount") BigDecimal amount
    );
}