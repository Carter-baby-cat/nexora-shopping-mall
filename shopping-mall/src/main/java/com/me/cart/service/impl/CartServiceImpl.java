package com.me.cart.service.impl;

import com.me.cart.dto.CartCheckoutDTO;
import com.me.cart.dto.CartItemDTO;
import com.me.cart.dto.CartUpdateDTO;
import com.me.cart.service.ICartService;
import com.me.item.dto.ItemDTO;
import com.me.item.entity.Item;
import com.me.item.service.IItemService;
import com.me.response.Result;
import com.me.security.LoginUser;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static com.me.constant.RedisConstant.CART_PREFIX;

@Service
public class CartServiceImpl implements ICartService {

    private final StringRedisTemplate stringRedisTemplate;
    private final IItemService itemService;

    public CartServiceImpl(StringRedisTemplate stringRedisTemplate, IItemService iItemService) {
        this.stringRedisTemplate = stringRedisTemplate;
        this.itemService = iItemService;
    }

    @Override
    public List<CartItemDTO> list() {

        String key = CART_PREFIX + getUserId();

        Map<Object, Object> entries = stringRedisTemplate.opsForHash().entries(key);

        if (entries.isEmpty()) {
            return List.of();
        }

        List<Long> itemIds = entries.keySet()
                .stream()
                .map(keyObject -> Long.valueOf(keyObject.toString()))
                .toList();

        List<Item> items = itemService.listByIds(itemIds);

        return items.stream()
                .map(item -> {
                    Integer quantity = Integer.valueOf(entries.get(item.getId().toString()).toString());

                    ItemDTO itemDTO = from(item);

                    return new CartItemDTO(
                            itemDTO,
                            quantity
                    );
                })
                .toList();
    }

    @Override
    public void addOrUpdate(CartUpdateDTO dto) {

        String key = CART_PREFIX + getUserId();

        stringRedisTemplate.opsForHash().put(
                key,
                dto.itemId().toString(),
                dto.quantity().toString()
        );
    }

    @Override
    public void delete(Long itemId) {
        stringRedisTemplate.opsForHash().delete(
                CART_PREFIX + getUserId(),
                itemId.toString()
        );
    }

    @Override
    public Result checkout(List<CartCheckoutDTO> checkoutList) {

        List<CartCheckoutDTO> updatedItems = new ArrayList<>();

        BigDecimal totalPrice = BigDecimal.ZERO;

        for (CartCheckoutDTO dto : checkoutList) {

            Item item = itemService.getById(dto.itemId());

            if (item == null) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Item does not exist"
                );
            }

            if (item.getPrice().compareTo(dto.price()) != 0) {
                updatedItems.add(
                        new CartCheckoutDTO(
                                dto.itemId(),
                                dto.quantity(),
                                item.getPrice()
                        )
                );
                continue;
            }

            BigDecimal subtotal = dto.price().multiply(BigDecimal.valueOf(dto.quantity()));

            totalPrice = totalPrice.add(subtotal);
        }

        if (!updatedItems.isEmpty()) {

            return Result.success(
                    Map.of(
                            "attention",
                            "Price updated, please check again",
                            "updatedItems",
                            updatedItems
                    )
            );
        }

        return Result.success(
                Map.of(
                        "info",
                        "checked",
                        "totalPrice",
                        totalPrice
                )
        );
    }

    private Long getUserId() {
        return ((LoginUser) SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getPrincipal())
                .getUser()
                .getId();
    }

    private ItemDTO from(Item item) {
        return new ItemDTO(
                item.getId(),
                item.getName(),
                item.getBrand(),
                item.getCategory(),
                item.getPrice(),
                item.getStock(),
                item.getDescription(),
                item.getImageUrls(),
                item.getStatus(),
                item.getIsSeckill(),
                item.getEndTime()
        );
    }
}