
package com.me.cart.controller;

import com.me.cart.dto.CartCheckoutDTO;
import com.me.cart.dto.CartItemDTO;
import com.me.cart.dto.CartUpdateDTO;
import com.me.cart.service.ICartService;
import com.me.response.Result;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/cart")
public class CartController {

    private final ICartService cartService;

    public CartController(ICartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping("/list")
    public Result list() {
        List<CartItemDTO> list = cartService.list();
        return Result.success(list);
    }

    @PostMapping("/add")
    public Result add(@Valid @RequestBody CartUpdateDTO dto) {
        cartService.addOrUpdate(dto);
        return Result.success();
    }

    @PutMapping("/update")
    public Result update(@Valid @RequestBody CartUpdateDTO dto) {
        cartService.addOrUpdate(dto);
        return Result.success();
    }

    @DeleteMapping("/delete")
    public Result delete(@RequestParam Long itemId) {
        cartService.delete(itemId);
        return Result.success();
    }

    @PostMapping("/checkout")
    public Result checkout(@Valid @RequestBody List<CartCheckoutDTO> items) {
        return cartService.checkout(items);
    }
}