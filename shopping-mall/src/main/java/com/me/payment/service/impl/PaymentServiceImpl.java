package com.me.payment.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.me.item.entity.Item;
import com.me.item.mapper.ItemMapper;
import com.me.order.entity.Order;
import com.me.order.entity.OrderItem;
import com.me.order.entity.OrderStatus;
import com.me.order.mapper.OrderItemMapper;
import com.me.order.mapper.OrderMapper;
import com.me.payment.entity.Payment;
import com.me.payment.entity.PaymentItem;
import com.me.payment.mapper.PaymentItemMapper;
import com.me.payment.mapper.PaymentMapper;
import com.me.payment.service.IPaymentService;
import com.me.user.entity.Account;
import com.me.user.mapper.AccountMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static com.me.constant.MySQLConstant.ORDER_DURATION_HOURS;
import static com.me.constant.RedisConstant.IDEMPOTENT_VALUE;
import static com.me.constant.RedisConstant.PAYMENT_IDEMPOTENT_PREFIX;

@Service
public class PaymentServiceImpl extends ServiceImpl<PaymentMapper, Payment> implements IPaymentService {

    private final PaymentMapper paymentMapper;
    private final PaymentItemMapper paymentItemMapper;
    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final ItemMapper itemMapper;
    private final AccountMapper accountMapper;
    private final StringRedisTemplate stringRedisTemplate;

    public PaymentServiceImpl(
            PaymentMapper paymentMapper,
            PaymentItemMapper paymentItemMapper,
            OrderMapper orderMapper,
            OrderItemMapper orderItemMapper,
            ItemMapper itemMapper,
            AccountMapper accountMapper,
            StringRedisTemplate stringRedisTemplate
    ) {
        this.paymentMapper = paymentMapper;
        this.paymentItemMapper = paymentItemMapper;
        this.orderMapper = orderMapper;
        this.orderItemMapper = orderItemMapper;
        this.itemMapper = itemMapper;
        this.accountMapper = accountMapper;
        this.stringRedisTemplate = stringRedisTemplate;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void pay(Long buyerId, Long orderId) {
        String redisKey = PAYMENT_IDEMPOTENT_PREFIX + orderId;

        Boolean acquired = stringRedisTemplate.opsForValue().setIfAbsent(
                redisKey,
                IDEMPOTENT_VALUE,
                Duration.ofHours(ORDER_DURATION_HOURS)
        );

        if (!Boolean.TRUE.equals(acquired)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Duplicate payment request"
            );
        }

        try {
            Order order = orderMapper.selectOne(
                    Wrappers.<Order>lambdaQuery()
                            .eq(Order::getId, orderId)
                            .eq(Order::getUserId, buyerId)
            );

            if (order == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
            }

            if (order.getStatus() != OrderStatus.PENDING) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Only pending orders can be paid"
                );
            }

            List<OrderItem> orderItems = orderItemMapper.selectList(
                    Wrappers.<OrderItem>lambdaQuery()
                            .eq(OrderItem::getOrderId, orderId)
            );

            if (orderItems.isEmpty()) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Order has no items"
                );
            }

            List<PaymentItem> paymentItems = new ArrayList<>();
            BigDecimal itemTotal = BigDecimal.ZERO;

            for (OrderItem orderItem : orderItems) {
                Item item = itemMapper.selectById(orderItem.getItemId());

                if (item == null) {
                    throw new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Item not found: " + orderItem.getItemId()
                    );
                }

                PaymentItem paymentItem = new PaymentItem();
                paymentItem.setOrderItemId(orderItem.getId());
                paymentItem.setItemId(orderItem.getItemId());
                paymentItem.setSellerId(item.getMerchantId());
                paymentItem.setQuantity(orderItem.getQuantity());
                paymentItem.setUnitPrice(orderItem.getPrice());
                paymentItem.setAmount(orderItem.getSubtotal());
                paymentItems.add(paymentItem);

                itemTotal = itemTotal.add(orderItem.getSubtotal());
            }

            if (itemTotal.compareTo(order.getTotalAmount()) != 0) {
                throw new IllegalStateException("Order amount does not match its items");
            }

            Account buyerAccount = accountMapper.selectById(buyerId);

            if (buyerAccount == null) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Buyer account not found"
                );
            }

            if (accountMapper.decreaseBalance(buyerId, order.getTotalAmount()) != 1) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Insufficient balance"
                );
            }

            for (PaymentItem paymentItem : paymentItems) {
                if (accountMapper.increaseBalance(
                        paymentItem.getSellerId(),
                        paymentItem.getAmount()
                ) != 1) {
                    throw new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Merchant account not found"
                    );
                }
            }

            LocalDateTime now = LocalDateTime.now();

            int updated = orderMapper.update(
                    null,
                    Wrappers.<Order>lambdaUpdate()
                            .eq(Order::getId, orderId)
                            .eq(Order::getUserId, buyerId)
                            .eq(Order::getStatus, OrderStatus.PENDING)
                            .set(Order::getStatus, OrderStatus.PAID)
                            .set(Order::getUpdatedAt, now)
            );

            if (updated != 1) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Order is no longer pending"
                );
            }

            Payment payment = new Payment();
            payment.setOrderId(orderId);
            payment.setBuyerId(buyerId);
            payment.setAmount(order.getTotalAmount());
            payment.setStatus("SUCCESS");
            payment.setPaidAt(now);

            if (paymentMapper.insert(payment) != 1) {
                throw new IllegalStateException("Failed to create payment");
            }

            for (PaymentItem paymentItem : paymentItems) {
                paymentItem.setPaymentId(payment.getId());

                if (paymentItemMapper.insert(paymentItem) != 1) {
                    throw new IllegalStateException("Failed to create payment item");
                }
            }
        } catch (RuntimeException e) {
            stringRedisTemplate.delete(redisKey);
            throw e;
        }
    }
}