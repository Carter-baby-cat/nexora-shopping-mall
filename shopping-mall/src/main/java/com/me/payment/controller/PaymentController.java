package com.me.payment.controller;

import com.me.payment.service.IPaymentService;
import com.me.response.Result;
import com.me.security.LoginUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class PaymentController {
    private final IPaymentService paymentService;

    public PaymentController(IPaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/pay")
    public Result pay(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestParam("orderId") Long orderId
    ) {
        paymentService.pay(loginUser.getUser().getId(), orderId);
        return Result.success("order paid successfully");
    }
}