package com.me.item.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.me.item.dto.ItemDTO;
import com.me.item.dto.ItemStockDTO;
import com.me.item.dto.ItemUpdateDTO;
import com.me.item.entity.Item;
import com.me.item.vo.ItemDetailVO;
import com.me.item.vo.SearchResultVO;

import java.util.List;

public interface IItemService extends IService<Item> {
    void addCommonItem(ItemDTO dto);

    void addSeckillItem(ItemDTO dto);

    void updateElasticsearch(Item item);

    List<String> suggest(String prefix);

    SearchResultVO search(String name, List<String> categories, List<String> brands, Integer page, Integer size);

    void updateItem(ItemUpdateDTO dto);

    void adjustStock(ItemStockDTO dto);

    void offlineItem(Long itemId);

    List<ItemDTO> listMerchantItems();

    ItemDetailVO getBuyerItemDetail(Long itemId);
}