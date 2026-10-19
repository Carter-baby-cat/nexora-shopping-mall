package com.me.order.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.me.order.entity.OrderItem;
import com.me.order.mapper.OrderItemMapper;
import com.me.order.service.IOrderItemService;
import org.springframework.stereotype.Service;

@Service
public class OrderItemServiceImpl extends ServiceImpl<OrderItemMapper, OrderItem> implements IOrderItemService {
}