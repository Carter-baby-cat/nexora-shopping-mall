package com.me.order.dto;

import java.util.List;

public record CancelOrderResultDTO(
        boolean cancelled,
        List<SeckillStockDTO> seckillStocks
) {
}