package com.me.cart.service;

import com.me.cart.dto.CartCheckoutDTO;
import com.me.cart.dto.CartItemDTO;
import com.me.cart.dto.CartUpdateDTO;
import com.me.response.Result;

import java.util.List;

public interface ICartService {

    List<CartItemDTO> list();

    void addOrUpdate(CartUpdateDTO dto);

    void delete(Long itemId);

    Result checkout(List<CartCheckoutDTO> checkoutList);
}