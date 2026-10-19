package com.me.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OrderRabbitConfig {

    public static final String SECKILL_ORDER_QUEUE = "order.seckill.create.queue";
    public static final String SECKILL_ORDER_EXCHANGE = "order.seckill.exchange";
    public static final String SECKILL_ORDER_ROUTING_KEY = "order.seckill.create";

    @Bean
    public Queue seckillOrderQueue() {
        return new Queue(SECKILL_ORDER_QUEUE, true);
    }

    @Bean
    public DirectExchange seckillOrderExchange() {
        return new DirectExchange(SECKILL_ORDER_EXCHANGE, true, false);
    }

    @Bean
    public Binding seckillOrderBinding(
            Queue seckillOrderQueue,
            DirectExchange seckillOrderExchange
    ) {
        return BindingBuilder
                .bind(seckillOrderQueue)
                .to(seckillOrderExchange)
                .with(SECKILL_ORDER_ROUTING_KEY);
    }

    @Bean
    public MessageConverter rabbitMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }
}