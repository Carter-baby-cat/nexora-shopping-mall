package com.me.item.service.impl;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import co.elastic.clients.elasticsearch._types.aggregations.StringTermsAggregate;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.CompletionSuggestOption;
import co.elastic.clients.elasticsearch.core.search.Hit;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.me.es.ItemDocument;
import com.me.item.dto.ItemDTO;
import com.me.item.dto.ItemStockDTO;
import com.me.item.dto.ItemUpdateDTO;
import com.me.item.entity.Item;
import com.me.item.entity.ItemStatus;
import com.me.item.mapper.ItemMapper;
import com.me.item.service.IItemService;
import com.me.item.vo.ItemDetailVO;
import com.me.item.vo.SearchResultVO;
import com.me.security.LoginUser;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static com.me.constant.RedisConstant.SECKILL_STOCK_PREFIX;
import static com.me.constant.RedisConstant.SECKILL_WINDOW_PREFIX;

@Service
public class ItemServiceImpl extends ServiceImpl<ItemMapper, Item> implements IItemService {

    private final ItemMapper itemMapper;
    private final ElasticsearchOperations elasticsearchOperations;
    private final ElasticsearchClient elasticsearchClient;
    private final StringRedisTemplate stringRedisTemplate;

    public ItemServiceImpl(
            ItemMapper itemMapper,
            StringRedisTemplate stringRedisTemplate,
            ElasticsearchClient elasticsearchClient,
            ElasticsearchOperations elasticsearchOperations) {
        this.itemMapper = itemMapper;
        this.stringRedisTemplate = stringRedisTemplate;
        this.elasticsearchClient = elasticsearchClient;
        this.elasticsearchOperations = elasticsearchOperations;
    }

    @Override
    @Transactional
    public void addCommonItem(ItemDTO dto) {

        Item item = fillItemInfo(dto);

        item.setIsSeckill(false);
        item.setEndTime(null);

        itemMapper.insert(item);
    }

    @Override
    @Transactional
    public void addSeckillItem(ItemDTO dto) {

        Item item = fillItemInfo(dto);

        item.setIsSeckill(true);
        item.setEndTime(dto.endTime());

        itemMapper.insert(item);

        createStock(item);
    }

    public void createStock(Item item) {
        String key = SECKILL_STOCK_PREFIX + item.getId();
        stringRedisTemplate.opsForValue().set(key, String.valueOf(item.getStock()));
        writeSeckillWindow(item.getId(), item.getEndTime());
    }

    public void deleteStock(Long itemId) {
        stringRedisTemplate.delete(List.of(
                SECKILL_STOCK_PREFIX + itemId,
                SECKILL_WINDOW_PREFIX + itemId
        ));
    }

    private void writeSeckillWindow(Long itemId, LocalDateTime endTime) {
        long endTimeEpochMillis = endTime == null
                ? 0L
                : endTime.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        stringRedisTemplate.opsForValue().set(
                SECKILL_WINDOW_PREFIX + itemId,
                String.valueOf(endTimeEpochMillis)
        );
    }

    @Override
    public void updateElasticsearch(Item item) {
        Document document = Document.create();

        document.put("id", item.getId());
        document.put("merchant_id", item.getMerchantId());
        document.put("name", item.getName());
        document.put("category", item.getCategory());
        document.put("brand", item.getBrand());
        document.put("price", item.getPrice());
        document.put("stock", item.getStock());
        document.put("description", item.getDescription());
        document.put("image_urls", item.getImageUrls());
        document.put("status", item.getStatus().getValue());
        document.put("is_seckill", item.getIsSeckill());

        if (item.getEndTime() != null) {
            document.put(
                    "end_time",
                    item.getEndTime().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
            );
        } else {
            document.put("end_time", null);
        }

        document.put(
                "suggest",
                List.of(
                        item.getName(),
                        item.getBrand(),
                        item.getCategory()
                )
        );

        IndexQuery query = new IndexQuery();
        query.setId(String.valueOf(item.getId()));
        query.setSource(document.toJson());

        elasticsearchOperations.index(
                query, IndexCoordinates.of("shopping_index")
        );
    }

    @Override
    public List<String> suggest(String prefix) {

        if (prefix == null || prefix.isBlank()) {
            return List.of();
        }

        try {
            SearchResponse<Void> response = elasticsearchClient.search(
                    s -> s.index("shopping_index")
                            .suggest(sg -> sg.suggesters(
                                    "item-suggest",
                                    i -> i.prefix(prefix)
                                            .completion(c -> c
                                                    .field("suggest")
                                                    .size(10))
                            )),
                    Void.class
            );

            return response.suggest()
                    .get("item-suggest")
                    .get(0)
                    .completion()
                    .options()
                    .stream()
                    .map(CompletionSuggestOption::text)
                    .distinct()
                    .toList();

        } catch (Exception e) {
            throw new RuntimeException("ES suggest query failed", e);
        }
    }

    @Override
    public SearchResultVO search(String name, List<String> categories, List<String> brands, Integer page, Integer size) {
        try {

            int from = (page - 1) * size;

            SearchResponse<ItemDocument> response =
                    elasticsearchClient.search(
                            s -> s
                                    .index("shopping_index")
                                    .query(q -> q.bool(b -> {

                                        if (name != null && !name.isBlank()) {
                                            b.must(
                                                    m -> m.match(
                                                            mm -> mm
                                                                    .field("name")
                                                                    .query(name)
                                                    )
                                            );
                                        }

                                        if (categories != null && !categories.isEmpty()) {
                                            b.filter(
                                                    f -> f.terms(
                                                            t -> t
                                                                    .field("category")
                                                                    .terms(v -> v.value(
                                                                            categories.stream()
                                                                                    .map(FieldValue::of)
                                                                                    .toList()
                                                                    ))
                                                    )
                                            );
                                        }

                                        if (brands != null && !brands.isEmpty()) {
                                            b.filter(
                                                    f -> f.terms(
                                                            t -> t
                                                                    .field("brand")
                                                                    .terms(v -> v.value(
                                                                            brands.stream()
                                                                                    .map(FieldValue::of)
                                                                                    .toList()
                                                                    ))
                                                    )
                                            );
                                        }

                                        return b;
                                    }))

                                    .from(from)
                                    .size(size)

                                    .aggregations(
                                            "categories",
                                            a -> a.terms(
                                                    t -> t.field("category")
                                            )
                                    )

                                    .aggregations(
                                            "brands",
                                            a -> a.terms(
                                                    t -> t.field("brand")
                                            )
                                    ),

                            ItemDocument.class
                    );


            List<ItemDocument> items =
                    response.hits()
                            .hits()
                            .stream()
                            .map(Hit::source)
                            .toList();


            List<String> categoryAggregations = parseAggregation(response.aggregations().get("categories"));

            List<String> brandAggregations = parseAggregation(response.aggregations().get("brands"));

            SearchResultVO result = new SearchResultVO();

            result.setItems(items);

            result.setCategories(categoryAggregations);

            result.setBrands(brandAggregations);

            assert response.hits().total() != null;
            result.setTotal(response.hits().total().value());

            result.setPage(page);

            result.setSize(size);

            return result;

        } catch (Exception e) {
            throw new RuntimeException("ES search failed", e);
        }
    }


    private List<String> parseAggregation(Aggregate aggregate) {

        if (aggregate == null) {
            return List.of();
        }

        StringTermsAggregate terms = aggregate.sterms();

        return terms.buckets()
                .array()
                .stream()
                .map(bucket -> bucket.key().stringValue())
                .toList();
    }

    private Item fillItemInfo(ItemDTO dto) {

        Item item = new Item();

        Long merchantId = getMerchantId();

        item.setMerchantId(merchantId);
        item.setName(dto.name());
        item.setBrand(dto.brand());
        item.setCategory(dto.category());
        item.setPrice(dto.price());
        item.setStock(dto.stock());
        item.setDescription(dto.description());
        item.setImageUrls(dto.imageUrls());
        item.setStatus(ItemStatus.ONLINE);

        return item;
    }

    /**
     * update common item
     * update seckill item
     */
    @Override
    @Transactional
    public void updateItem(ItemUpdateDTO dto) {
        Long merchantId = getMerchantId();

        boolean updated = lambdaUpdate()
                .eq(Item::getId, dto.id())
                .eq(Item::getMerchantId, merchantId)
                .set(Item::getName, dto.name())
                .set(Item::getBrand, dto.brand())
                .set(Item::getCategory, dto.category())
                .set(Item::getPrice, dto.price())
                .set(Item::getDescription, dto.description())
                .set(Item::getImageUrls, dto.imageUrls())
                .set(Item::getStatus, dto.status())
                .set(Item::getEndTime, dto.endTime())
                .update();

        if (!updated) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Item not found or not owned by current merchant"
            );
        }

        Item updatedItem = itemMapper.selectById(dto.id());
        if (updatedItem != null && Boolean.TRUE.equals(updatedItem.getIsSeckill())) {
            if (updatedItem.getStatus() == ItemStatus.OFFLINE) {
                deleteStock(updatedItem.getId());
            } else {
                writeSeckillWindow(updatedItem.getId(), updatedItem.getEndTime());
            }
        }
    }

    @Override
    @Transactional
    public void adjustStock(ItemStockDTO dto) {
        Long merchantId = getMerchantId();

        Item item = itemMapper.selectByIdForUpdate(dto.itemId(), merchantId);

        if (item == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Item not found or not owned by current merchant"
            );
        }

        if (dto.delta() == 0) {
            return;
        }

        int updated = itemMapper.adjustStockByDelta(
                dto.itemId(),
                merchantId,
                dto.delta()
        );

        if (updated != 1) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Stock adjustment would make stock invalid"
            );
        }

        if (Boolean.TRUE.equals(item.getIsSeckill())) {
            stringRedisTemplate.opsForValue().increment(
                    SECKILL_STOCK_PREFIX + dto.itemId(),
                    dto.delta().longValue()
            );
        }
    }

    @Override
    public void offlineItem(Long itemId) {

        Long merchantId = getMerchantId();

        boolean update = lambdaUpdate()
                .eq(Item::getId, itemId)
                .eq(Item::getMerchantId, merchantId)
                .in(Item::getStatus, ItemStatus.ONLINE, ItemStatus.SOLD_OUT)
                .set(Item::getStatus, ItemStatus.OFFLINE)
                .update();

        if (!update) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Item not found or not owned by current merchant"
            );
        }

        Item item = query().eq("id", itemId).one();
        if (item.getIsSeckill()) {
            deleteStock(itemId);
        }
    }

    private Long getMerchantId() {
        LoginUser loginUser = (LoginUser) SecurityContextHolder
                .getContext()
                .getAuthentication()
                .getPrincipal();
        return loginUser.getUser().getId();
    }

    @Override
    public List<ItemDTO> listMerchantItems() {
        Long merchantId = getMerchantId();

        return lambdaQuery()
                .eq(Item::getMerchantId, merchantId)
                .ne(Item::getStatus, ItemStatus.OFFLINE)
                .orderByDesc(Item::getId)
                .list()
                .stream()
                .map(item -> new ItemDTO(
                        item.getId(),
                        item.getName(),
                        item.getBrand(),
                        item.getCategory(),
                        item.getPrice(),
                        item.getStock(),
                        item.getDescription(),
                        item.getImageUrls(),
                        item.getStatus(),
                        item.getIsSeckill(),
                        item.getEndTime()
                ))
                .toList();
    }

    @Override
    public ItemDetailVO getBuyerItemDetail(Long itemId) {
        Item item = getById(itemId);

        if (item == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Item not found"
            );
        }

        return new ItemDetailVO(
                item.getId(),
                item.getName(),
                item.getBrand(),
                item.getCategory(),
                item.getPrice(),
                item.getStock(),
                item.getDescription(),
                item.getImageUrls(),
                item.getStatus(),
                item.getIsSeckill(),
                item.getEndTime(),
                Boolean.TRUE.equals(item.getIsSeckill())
                        && (item.getEndTime() == null || !item.getEndTime().isAfter(LocalDateTime.now()))
        );
    }
}
