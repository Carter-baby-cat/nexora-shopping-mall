package com.me.payment.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.me.payment.entity.Payment;

public interface IPaymentService extends IService<Payment> {
    void pay(Long buyerId, Long orderId);
}