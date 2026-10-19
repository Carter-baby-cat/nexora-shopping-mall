package com.me.order.controller;

import com.me.order.dto.CancelOrderDTO;
import com.me.order.dto.NormalOrderItemDTO;
import com.me.order.dto.SeckillOrderDTO;
import com.me.order.entity.Order;
import com.me.order.service.IOrderService;
import com.me.response.Result;
import com.me.security.LoginUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/order")
public class OrderController {
    private final IOrderService orderService;

    public OrderController(IOrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping("/list")
    public Result list(@AuthenticationPrincipal LoginUser loginUser) {
        Long userId = loginUser.getUser().getId();
        List<Order> orders = orderService.listByUserId(userId);
        return Result.success(orders);
    }

    @PostMapping("/create")
    public Result createNormalOrder(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestHeader(value = "Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody @NotEmpty List<@Valid NormalOrderItemDTO> items
    ) {
        Order order = orderService.createNormalOrder(
                loginUser.getUser().getId(),
                idempotencyKey,
                items
        );
        return Result.success(Map.of(
                "info", "order created",
                "order", order
        ));
    }

    @PostMapping("/create/seckill")
    public Result createSeckillOrder(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody SeckillOrderDTO request
    ) {
        String orderNo = orderService.createSeckillOrder(
                loginUser.getUser().getId(),
                idempotencyKey,
                request
        );

        return Result.success(Map.of(
                "info", "order creating, please go to payment page later",
                "orderNo", orderNo
        ));
    }

    @PostMapping("/cancel")
    public Result cancelOrder(
            @AuthenticationPrincipal LoginUser loginUser,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestParam Long orderId
    ) {
        boolean cancelled = orderService.cancelOrder(
                loginUser.getUser().getId(),
                idempotencyKey,
                new CancelOrderDTO(orderId)
        );

        return Result.success(Map.of("cancelled", cancelled));
    }

    @GetMapping("/{orderId}/items")
    public Result listOrderItems(
            @AuthenticationPrincipal LoginUser loginUser,
            @PathVariable Long orderId
    ) {
        return Result.success(
                orderService.listItemsByOrderId(
                        loginUser.getUser().getId(),
                        orderId
                )
        );
    }
}