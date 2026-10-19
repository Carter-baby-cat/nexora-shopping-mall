package com.me.canal;

import com.alibaba.otter.canal.protocol.CanalEntry.EventType.*;
import com.alibaba.otter.canal.protocol.CanalEntry.EventType;
import com.alibaba.otter.canal.protocol.CanalEntry.Entry;
import com.me.item.entity.Item;
import com.me.item.service.impl.ItemServiceImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import static com.alibaba.otter.canal.protocol.CanalEntry.EventType.INSERT;
import static com.alibaba.otter.canal.protocol.CanalEntry.EventType.UPDATE;

@Component
@Slf4j
public class ItemCanalHandler {

    private final CanalEntryParser canalEntryParser;
    private final ItemServiceImpl itemService;

    public ItemCanalHandler(
            CanalEntryParser canalEntryParser,
            ItemServiceImpl itemService) {

        this.canalEntryParser = canalEntryParser;
        this.itemService = itemService;
    }

    public void handle(Entry entry) {

        EventType eventType = entry.getHeader().getEventType();

        if (eventType != INSERT && eventType != UPDATE) {
            log.warn("Unsupported event type: {}", eventType.name());
            return;
        }

        for (Item item : canalEntryParser.parseItems(entry)) {
            itemService.updateElasticsearch(item);
        }
    }
}