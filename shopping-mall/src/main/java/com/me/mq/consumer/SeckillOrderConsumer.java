package com.me.mq.consumer;

import com.me.config.OrderRabbitConfig;
import com.me.constant.RedisConstant;
import com.me.mq.message.SeckillOrderMessage;
import com.me.exception.mq.SeckillOrderRejectedException;
import com.me.order.service.IOrderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

import static com.me.constant.MySQLConstant.ORDER_DURATION_HOURS;
import static com.me.constant.RedisConstant.SECKILL_ORDER_CONSUMER_PREFIX;
import static com.me.constant.RedisConstant.SUCCESS;
import static com.me.constant.RedisConstant.FAILED;

@Slf4j
@Component
public class SeckillOrderConsumer {

    private static final DefaultRedisScript<Long> COMPENSATE_STOCK_SCRIPT =
            new DefaultRedisScript<>("""
                    local status = redis.call('GET', KEYS[2])
                    if status == 'SUCCESS' or status == 'FAILED' then
                        return 0
                    end
                    
                    if redis.call('EXISTS', KEYS[1]) == 1 then
                        redis.call('INCRBY', KEYS[1], ARGV[1])
                    end
                    
                    redis.call('SET', KEYS[2], 'FAILED', 'EX', ARGV[2])
                    return 1
                    """, Long.class);

    private final IOrderService orderService;
    private final StringRedisTemplate stringRedisTemplate;

    public SeckillOrderConsumer(
            IOrderService orderService,
            StringRedisTemplate stringRedisTemplate
    ) {
        this.orderService = orderService;
        this.stringRedisTemplate = stringRedisTemplate;
    }

    @RabbitListener(queues = OrderRabbitConfig.SECKILL_ORDER_QUEUE)
    public void consume(SeckillOrderMessage message) {
        String statusKey = SECKILL_ORDER_CONSUMER_PREFIX
                + message.userId()
                + ":"
                + message.idempotencyKey();

        String status = stringRedisTemplate.opsForValue().get(statusKey);

        // if another repeated consumer has already processed the same message
        // but without ack, then return immediately with ack
        if (SUCCESS.equals(status) || FAILED.equals(status)) {
            return;
        }

        try {
            orderService.persistSeckillOrder(message);

            // for mq to fail to ack, and resend the message to set the state to success
            // Runtime.getRuntime().halt(1); // stop JVM

            stringRedisTemplate.opsForValue().set(
                    statusKey,
                    SUCCESS,
                    Duration.ofHours(ORDER_DURATION_HOURS)
            );
        } catch (SeckillOrderRejectedException e) {

            // mysql is out of stock
            // so, no order is created, and current consumer should compensate for the stock in Redis
            // and set the state to failed
            stringRedisTemplate.execute(
                    COMPENSATE_STOCK_SCRIPT,
                    List.of(
                            RedisConstant.SECKILL_STOCK_PREFIX + message.itemId(),
                            statusKey
                    ),
                    String.valueOf(message.quantity()),
                    String.valueOf(Duration.ofHours(ORDER_DURATION_HOURS).getSeconds())
            );
        } catch (DuplicateKeyException e)  {
            // actually, one consumer has successfully created the order, so we can
            // directly ack with no Redis stock backtracking
            log.info(e.getMessage());
        } catch (IllegalStateException e) {
            log.info("Illegal state detected for order: {}", message.orderNo());
            // for mq to resend the same message
            throw e;
        }
    }
}