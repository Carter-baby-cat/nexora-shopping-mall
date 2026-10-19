package com.me.task;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.me.order.entity.Order;
import com.me.order.entity.OrderStatus;
import com.me.order.service.IOrderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

import static com.me.constant.MySQLConstant.ORDER_DURATION_HOURS;

@Slf4j
@Component
public class OrderScheduledTask {

    private final IOrderService orderService;

    public OrderScheduledTask(IOrderService orderService) {
        this.orderService = orderService;
    }

    @Scheduled(fixedDelay = 60000)
    public void cancelExpiredOrders() {
        LocalDateTime expiredBefore =
                LocalDateTime.now().minusHours(ORDER_DURATION_HOURS);

        List<Order> expiredOrders = orderService.list(
                Wrappers.<Order>lambdaQuery()
                        .eq(Order::getStatus, OrderStatus.PENDING)
                        .lt(Order::getCreatedAt, expiredBefore)
        );

        for (Order order : expiredOrders) {
            try {
                orderService.cancelExpiredOrder(order.getId());
            } catch (RuntimeException e) {
                log.warn(
                        "Failed to cancel expired order: {}",
                        order.getOrderNo(),
                        e
                );
            }
        }
    }
}