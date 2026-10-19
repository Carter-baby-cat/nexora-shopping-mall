package com.me.task;

import com.me.item.mapper.ItemMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class ItemScheduledTask {

    private final ItemMapper itemMapper;

    /**
     * Check sold-out items periodically.
     */
    @Scheduled(fixedDelay = 60000)
    public void checkSoldOutItems() {
        int updatedCount = itemMapper.markOnlineZeroStockItemsSoldOut();

        if (updatedCount > 0) {
            log.info("Marked {} items as SOLD_OUT", updatedCount);
        }
    }
}