package com.me.item.service;

import com.me.item.dto.SoldOutNotification;

public interface INotificationService {
    void notifyMerchant(Long merchantId, SoldOutNotification notification);
}
