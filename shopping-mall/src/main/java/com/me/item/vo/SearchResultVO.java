package com.me.item.vo;

import com.me.es.ItemDocument;
import lombok.Data;

import java.util.List;

@Data
public class SearchResultVO {

    private List<ItemDocument> items;

    private List<String> categories;

    private List<String> brands;

    private Long total;

    private Integer page;

    private Integer size;

}