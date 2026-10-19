package com.me.item.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.me.item.entity.Item;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

public interface ItemMapper extends BaseMapper<Item> {
    @Update("""
            UPDATE item
            SET status = 'SOLD_OUT'
            WHERE status = 'ONLINE'
              AND stock = 0
            """)
    int markOnlineZeroStockItemsSoldOut();

    @Select("""
            SELECT *
            FROM item
            WHERE id = #{itemId}
              AND merchant_id = #{merchantId}
            FOR UPDATE
            """)
    Item selectByIdForUpdate(
            @Param("itemId") Long itemId,
            @Param("merchantId") Long merchantId
    );

    @Update("""
            UPDATE item
            SET stock = stock - #{quantity}
            WHERE id = #{itemId}
              AND status = 'ONLINE'
              AND is_seckill = FALSE
              AND stock >= #{quantity}
            """)
    int decreaseStockForNormalOrder(
            @Param("itemId") Long itemId,
            @Param("quantity") Integer quantity
    );

    @Update("""
            UPDATE item
            SET stock = stock - #{quantity}
            WHERE id = #{itemId}
              AND status = 'ONLINE'
              AND is_seckill = TRUE
              AND stock >= #{quantity}
            """)
    int decreaseStockForSeckillOrder(
            @Param("itemId") Long itemId,
            @Param("quantity") Integer quantity
    );

    @Update("""
            UPDATE item
            SET status = CASE
                    WHEN status = 'SOLD_OUT'
                         AND stock + #{quantity} > 0
                        THEN 'ONLINE'
                    ELSE status
                END,
                stock = stock + #{quantity}
            WHERE id = #{itemId}
              AND is_seckill = #{isSeckill}
            """)
    int increaseStockAfterOrderCancellation(
            @Param("itemId") Long itemId,
            @Param("quantity") Integer quantity,
            @Param("isSeckill") Boolean isSeckill
    );

    @Update("""
            UPDATE item
            SET status = CASE
                    WHEN status = 'SOLD_OUT' AND stock + #{delta} > 0
                        THEN 'ONLINE'
                    ELSE status
                END,
                stock = stock + #{delta}
            WHERE id = #{itemId}
              AND merchant_id = #{merchantId}
              AND stock + #{delta} BETWEEN 0 AND 2147483647
            """)
    int adjustStockByDelta(
            @Param("itemId") Long itemId,
            @Param("merchantId") Long merchantId,
            @Param("delta") Integer delta
    );
}