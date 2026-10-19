package com.me.es;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonProperty;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ItemDocument {

    private Long id;

    @JsonProperty("merchant_id")
    private Long merchantId;

    private String name;

    private String category;

    private BigDecimal price;

    private Integer stock;

    private String description;

    @JsonProperty("image_urls")
    private String imageUrls;

    private String status;

    @JsonProperty("is_seckill")
    private Boolean isSeckill;

    @JsonProperty("end_time")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime endTime;

    private String brand;
}