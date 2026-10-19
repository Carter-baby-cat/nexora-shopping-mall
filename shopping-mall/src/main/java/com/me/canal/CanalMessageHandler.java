package com.me.canal;

import com.alibaba.otter.canal.protocol.CanalEntry;
import com.alibaba.otter.canal.protocol.CanalEntry.Entry;
import com.alibaba.otter.canal.protocol.Message;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class CanalMessageHandler {

    private final ItemCanalHandler itemCanalHandler;

    public CanalMessageHandler(ItemCanalHandler itemCanalHandler) {
        this.itemCanalHandler = itemCanalHandler;
    }

    public void handle(Message message) {
        if (message.getEntries().isEmpty()) {
            return;
        }

        for (Entry entry : message.getEntries()) {
            if (entry.getEntryType() != CanalEntry.EntryType.ROWDATA) {
                continue;
            }

            if (!"shopping_mall".equals(entry.getHeader().getSchemaName())) {
                continue;
            }

            if (!"item".equals(entry.getHeader().getTableName())) {
                continue;
            }

            itemCanalHandler.handle(entry);
        }
    }
}