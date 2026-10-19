package com.me.canal;

import com.alibaba.otter.canal.protocol.CanalEntry;
import com.alibaba.otter.canal.protocol.CanalEntry.RowChange;
import com.alibaba.otter.canal.protocol.CanalEntry.Column;
import com.alibaba.otter.canal.protocol.CanalEntry.Entry;
import com.me.item.entity.Item;
import com.me.item.entity.ItemStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Component
public class CanalEntryParser {

    public List<Item> parseItems(Entry entry) {
        RowChange rowChange;

        try {
            rowChange = CanalEntry.RowChange.parseFrom(entry.getStoreValue());
        } catch (Exception e) {
            throw new IllegalStateException("Failed to parse Canal entry", e);
        }

        return rowChange.getRowDatasList()
                .stream()
                .map(this::parseRowData)
                .toList();
    }

    private Item parseRowData(CanalEntry.RowData rowData) {
        Item item = new Item();

        for (Column column : rowData.getAfterColumnsList()) {
            switch (column.getName()) {
                case "id" -> item.setId(Long.valueOf(column.getValue()));
                case "merchant_id" -> item.setMerchantId(Long.valueOf(column.getValue()));
                case "name" -> item.setName(column.getValue());
                case "category" -> item.setCategory(column.getValue());
                case "price" -> item.setPrice(new BigDecimal(column.getValue()));
                case "stock" -> item.setStock(Integer.valueOf(column.getValue()));
                case "description" -> item.setDescription(column.getValue());
                case "image_urls" -> item.setImageUrls(column.getValue());
                case "status" -> item.setStatus(ItemStatus.valueOf(column.getValue()));
                case "is_seckill" -> item.setIsSeckill("1".equals(column.getValue()));
                case "end_time" -> {
                    if (!column.getValue().isBlank()) {
                        item.setEndTime(LocalDateTime.parse(
                                column.getValue(),
                                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
                        ));
                    }
                }
                case "brand" -> item.setBrand(column.getValue());
            }
        }

        return item;
    }
}