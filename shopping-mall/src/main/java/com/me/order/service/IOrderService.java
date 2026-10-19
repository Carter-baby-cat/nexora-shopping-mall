package com.me.order.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.me.mq.message.SeckillOrderMessage;
import com.me.order.dto.CancelOrderDTO;
import com.me.order.dto.NormalOrderItemDTO;
import com.me.order.dto.SeckillOrderDTO;
import com.me.order.entity.Order;
import com.me.order.vo.OrderItemVO;

import java.util.List;

public interface IOrderService extends IService<Order> {
    List<Order> listByUserId(Long userId);

    Order createNormalOrder(
            Long userId,
            String idempotencyKey,
            List<NormalOrderItemDTO> items
    );

    String createSeckillOrder(
            Long userId,
            String idempotencyKey,
            SeckillOrderDTO request
    );

    void persistSeckillOrder(SeckillOrderMessage message);

    boolean cancelOrder(
            Long userId,
            String idempotencyKey,
            CancelOrderDTO dto
    );

    void cancelExpiredOrder(Long orderId);

    List<OrderItemVO> listItemsByOrderId(Long userId, Long orderId);
}