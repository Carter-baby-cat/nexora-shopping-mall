package com.me.item.controller;

import com.me.item.dto.ItemDTO;
import com.me.item.dto.ItemStockDTO;
import com.me.item.dto.ItemUpdateDTO;
import com.me.item.service.IItemService;
import com.me.item.service.IS3Service;
import com.me.item.vo.ItemDetailVO;
import com.me.response.Result;
import jakarta.validation.Valid;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/item")
public class ItemController {

    private final IS3Service s3Service;
    private final IItemService itemService;

    public ItemController(IS3Service s3Service, IItemService itemService) {
        this.s3Service = s3Service;
        this.itemService = itemService;
    }

    @PostMapping("/upload/image")
    public Result uploadImage(@RequestParam("file") MultipartFile file) {
        String url = s3Service.upload(file);
        return Result.success(url);
    }

    @PostMapping("/add")
    public Result add(@Validated(ItemDTO.Create.class) @RequestBody ItemDTO dto) {
        if (dto.isSeckill()) {
            itemService.addSeckillItem(dto);
        } else {
            itemService.addCommonItem(dto);
        }
        return Result.success();
    }

    @GetMapping("/suggest")
    public Result suggest(@RequestParam String prefix) {
        List<String> names = itemService.suggest(prefix);
        return Result.success(names);
    }

    @GetMapping("/search/list")
    public Result search(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) List<String> categories,
            @RequestParam(required = false) List<String> brands,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "12") Integer size) {
        return Result.success(
                itemService.search(
                        name,
                        categories,
                        brands,
                        page,
                        size
                )
        );
    }

    @PutMapping("/update")
    public Result update(@Validated @RequestBody ItemUpdateDTO dto) {
        itemService.updateItem(dto);
        return Result.success();
    }

    @PatchMapping("/stock")
    public Result adjustStock(@Validated @RequestBody ItemStockDTO dto) {
        itemService.adjustStock(dto);
        return Result.success();
    }

    @DeleteMapping("/offline")
    public Result offline(@RequestParam Long itemId) {
        itemService.offlineItem(itemId);
        return Result.success();
    }

    @GetMapping("/merchant/list")
    public Result listMerchantItems() {
        List<ItemDTO> items = itemService.listMerchantItems();
        return Result.success(items);
    }

    @GetMapping("/{itemId}")
    public Result getDetail(@PathVariable Long itemId) {
        ItemDetailVO item = itemService.getBuyerItemDetail(itemId);
        return Result.success(item);
    }
}