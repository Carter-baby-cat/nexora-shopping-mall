package com.me.item.service.impl;

import com.me.item.dto.SoldOutNotification;
import com.me.item.service.INotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements INotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    public void notifyMerchant(
            Long merchantId,
            SoldOutNotification notification) {

        messagingTemplate.convertAndSendToUser(
                String.valueOf(merchantId),
                "/queue/notifications",
                notification
        );
    }
}