package com.me.order.service.impl;

import cn.hutool.core.lang.UUID;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.me.item.entity.Item;
import com.me.item.entity.ItemStatus;
import com.me.item.mapper.ItemMapper;
import com.me.order.dto.NormalOrderItemDTO;
import com.me.order.entity.Order;
import com.me.order.entity.OrderItem;
import com.me.order.entity.OrderStatus;
import com.me.order.mapper.OrderItemMapper;
import com.me.order.mapper.OrderMapper;
import com.me.order.service.IOrderService;
import com.me.order.vo.OrderItemVO;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.me.order.dto.SeckillOrderDTO;
import com.me.exception.mq.SeckillOrderRejectedException;
import com.me.config.OrderRabbitConfig;
import com.me.mq.message.SeckillOrderMessage;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.me.constant.MySQLConstant.ORDER_DURATION_HOURS;
import static com.me.constant.RedisConstant.*;

import com.me.order.dto.CancelOrderDTO;
import com.me.order.dto.CancelOrderResultDTO;
import com.me.order.dto.SeckillStockDTO;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class OrderServiceImpl extends ServiceImpl<OrderMapper, Order> implements IOrderService {

    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final ItemMapper itemMapper;
    private final StringRedisTemplate stringRedisTemplate;
    private final RabbitTemplate rabbitTemplate;
    private final TransactionTemplate transactionTemplate;

    private static final DefaultRedisScript<Long> RELEASE_CANCEL_LOCK_SCRIPT =
            new DefaultRedisScript<>("""
                    if redis.call('GET', KEYS[1]) == ARGV[1] then
                        return redis.call('DEL', KEYS[1])
                    end
                    return 0
                    """, Long.class);

    private static final DefaultRedisScript<String> DECREASE_REDIS_STOCK_SCRIPT =
            new DefaultRedisScript<>("""
                    redis.replicate_commands()

                    local saleEndTime = redis.call('GET', KEYS[2])
                    if not saleEndTime then
                        return 'NO_WINDOW'
                    end

                    local redisTime = redis.call('TIME')
                    local nowMillis = tonumber(redisTime[1]) * 1000 + math.floor(tonumber(redisTime[2]) / 1000)
                    local deadlineMillis = tonumber(saleEndTime)
                    if not deadlineMillis or nowMillis >= deadlineMillis then
                        return 'SALE_ENDED'
                    end

                    local stock = redis.call('GET', KEYS[1])
                    if not stock then
                        return 'NO_STOCK_KEY'
                    end
                    
                    local quantity = tonumber(ARGV[1])
                    if tonumber(stock) < quantity then
                        return 'SOLD_OUT'
                    end
                    
                    local remainingStock = redis.call('DECRBY', KEYS[1], quantity)
                    return 'RESERVED|' .. remainingStock .. '|' .. nowMillis .. '|' .. deadlineMillis
                    """, String.class);

    private static final DefaultRedisScript<Long> RESTORE_REDIS_STOCK_SCRIPT =
            new DefaultRedisScript<>("""
                    if redis.call('EXISTS', KEYS[1]) == 0 then
                        return 0
                    end
                    
                    return redis.call('INCRBY', KEYS[1], ARGV[1])
                    """, Long.class);

    public OrderServiceImpl(
            OrderMapper orderMapper,
            OrderItemMapper orderItemMapper,
            ItemMapper itemMapper,
            RabbitTemplate rabbitTemplate,
            StringRedisTemplate stringRedisTemplate,
            PlatformTransactionManager transactionManager
    ) {
        this.orderMapper = orderMapper;
        this.orderItemMapper = orderItemMapper;
        this.itemMapper = itemMapper;
        this.rabbitTemplate = rabbitTemplate;
        this.stringRedisTemplate = stringRedisTemplate;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Override
    public List<Order> listByUserId(Long userId) {
        return lambdaQuery()
                .eq(Order::getUserId, userId)
                .orderByDesc(Order::getCreatedAt)
                .list();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Order createNormalOrder(Long userId, String idempotencyKey, List<NormalOrderItemDTO> requests) {

        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Idempotency-Key is required"
            );
        }

        if (requests == null || requests.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Order must contain at least one item"
            );
        }

        String normalizedKey = idempotencyKey.trim();
        String redisKey = IDEMPOTENCY_PREFIX + userId + ":" + normalizedKey;
        String requestFingerprint = normalOrderFingerprint(requests);
        String orderNo = UUID.randomUUID().toString().replace("-", "");

        Boolean acquired = stringRedisTemplate.opsForValue().setIfAbsent(
                redisKey,
                orderNo + ":" + requestFingerprint,
                Duration.ofHours(ORDER_DURATION_HOURS)
        );

        if (!Boolean.TRUE.equals(acquired)) {
            String existingValue = stringRedisTemplate.opsForValue().get(redisKey);
            String[] idempotencyRecord = existingValue == null ? new String[0] : existingValue.split(":", 2);
            if (idempotencyRecord.length != 2 || !requestFingerprint.equals(idempotencyRecord[1])) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Idempotency key is already in use for a different or unresolved request"
                );
            }

            Order existingOrder = orderMapper.selectOne(Wrappers.<Order>lambdaQuery()
                    .eq(Order::getOrderNo, idempotencyRecord[0])
                    .eq(Order::getUserId, userId));
            if (existingOrder != null) {
                return existingOrder;
            }

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Order request is still processing"
            );
        }

        try {
            return persistNormalOrder(userId, orderNo, requests);
        } catch (RuntimeException e) {
            stringRedisTemplate.delete(redisKey);
            throw e;
        }
    }

    private String normalOrderFingerprint(List<NormalOrderItemDTO> requests) {
        String canonicalRequest = requests.stream()
                .sorted(Comparator.comparing(NormalOrderItemDTO::itemId)
                        .thenComparing(NormalOrderItemDTO::quantity))
                .map(item -> item.itemId() + ":" + item.quantity())
                .collect(java.util.stream.Collectors.joining(";"));
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(canonicalRequest.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private Order persistNormalOrder(Long userId, String orderNo, List<NormalOrderItemDTO> requests) {

        List<OrderItem> orderItems = new ArrayList<>();
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (NormalOrderItemDTO request : requests) {
            Long itemId = request.itemId();
            Integer quantity = request.quantity();

            Item item = itemMapper.selectById(itemId);

            if (item == null) {
                throw new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Item not found: " + itemId
                );
            }

            if (item.getStatus() != ItemStatus.ONLINE
                    || Boolean.TRUE.equals(item.getIsSeckill())) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Item is unavailable for a normal order: " + itemId
                );
            }

            if (item.getStock() == null || item.getStock() < quantity) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Insufficient stock for item: " + itemId
                );
            }

            int updated = itemMapper.decreaseStockForNormalOrder(itemId, quantity);
            if (updated != 1) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Insufficient stock for item: " + itemId
                );
            }

            BigDecimal subtotal = item.getPrice().multiply(BigDecimal.valueOf(quantity));

            totalAmount = totalAmount.add(subtotal);

            OrderItem orderItem = new OrderItem();
            orderItem.setItemId(item.getId());
            orderItem.setItemName(item.getName());
            orderItem.setPrice(item.getPrice());
            orderItem.setQuantity(quantity);
            orderItem.setSubtotal(subtotal);
            orderItems.add(orderItem);
        }

        LocalDateTime now = LocalDateTime.now();

        Order order = new Order();
        order.setOrderNo(orderNo);
        order.setUserId(userId);
        order.setTotalAmount(totalAmount);
        order.setStatus(OrderStatus.PENDING);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);

        if (orderMapper.insert(order) != 1) {
            throw new IllegalStateException("Failed to create order");
        }

        for (OrderItem orderItem : orderItems) {
            orderItem.setOrderId(order.getId());

            if (orderItemMapper.insert(orderItem) != 1) {
                throw new IllegalStateException("Failed to create order item");
            }
        }

        return order;
    }

    @Override
    public String createSeckillOrder(
            Long userId,
            String idempotencyKey,
            SeckillOrderDTO request
    ) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Idempotency-Key is required"
            );
        }

        String normalizedKey = idempotencyKey.trim();

        String idempotencyRedisKey = SECKILL_ORDER_IDEMPOTENCY_PREFIX + userId + ":" + normalizedKey;

        String consumerStatusKey = SECKILL_ORDER_CONSUMER_PREFIX + userId + ":" + normalizedKey;

        String orderNo = UUID.randomUUID().toString().replace("-", "");

        Boolean acquired = stringRedisTemplate.opsForValue().setIfAbsent(
                idempotencyRedisKey,
                orderNo,
                Duration.ofHours(ORDER_DURATION_HOURS)
        );

        if (!Boolean.TRUE.equals(acquired)) {
            String existingOrderNo = stringRedisTemplate.opsForValue().get(idempotencyRedisKey);

            String consumerStatus = stringRedisTemplate.opsForValue().get(consumerStatusKey);

            // If the consumer status is FAILED, it means the previous seckill order failed.
            // the same idempotency key represents the same request, so if the request with its
            // idempotency key already failed, we should not reuse it, but send a new request
            // with new idempotency key.

            if ("FAILED".equals(consumerStatus)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Previous seckill order failed, please use a new Idempotency-Key"
                );
            }

            // another request is still processing
            // or consumer status is success
            if (existingOrderNo != null) {
                return existingOrderNo;
            }

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Duplicate order request"
            );
        }

        String stockRedisKey = SECKILL_STOCK_PREFIX + request.itemId();
        boolean stockReserved = false;

        try {

            SeckillStockReservation reservation = reserveSeckillStock(
                    request.itemId(),
                    request.quantity()
            );

            stockReserved = true;

            // if the message is not received by the consumer, the stock will be restored,
            // and we believe the idempotencyRedisKey is still valid, and can be reused.

            rabbitTemplate.convertAndSend(
                    OrderRabbitConfig.SECKILL_ORDER_EXCHANGE,
                    OrderRabbitConfig.SECKILL_ORDER_ROUTING_KEY,
                    new SeckillOrderMessage(
                            orderNo,
                            userId,
                            request.itemId(),
                            request.quantity(),
                            normalizedKey,
                            reservation.acceptedAtEpochMillis(),
                            reservation.saleEndTimeEpochMillis()
                    )
            );
            return orderNo;
        } catch (RuntimeException e) {
            if (stockReserved) {
                stringRedisTemplate.execute(
                        RESTORE_REDIS_STOCK_SCRIPT,
                        List.of(stockRedisKey),
                        request.quantity().toString()
                );
            }

            stringRedisTemplate.delete(idempotencyRedisKey);
            throw e;
        }
    }

    private SeckillStockReservation reserveSeckillStock(Long itemId, Integer quantity) {
        String stockKey = SECKILL_STOCK_PREFIX + itemId;
        String windowKey = SECKILL_WINDOW_PREFIX + itemId;
        String result = executeSeckillReservation(stockKey, windowKey, quantity);

        if ("NO_WINDOW".equals(result)) {
            Item item = itemMapper.selectById(itemId);
            if (item == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found");
            }
            if (item.getStatus() != ItemStatus.ONLINE || !Boolean.TRUE.equals(item.getIsSeckill())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Seckill item is unavailable");
            }

            // Backfill the Redis deadline for active items created before this key was introduced.
            writeSeckillWindow(itemId, item.getEndTime());
            result = executeSeckillReservation(stockKey, windowKey, quantity);
        }

        if ("SALE_ENDED".equals(result)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Flash sale has ended");
        }
        if ("NO_STOCK_KEY".equals(result)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Seckill stock is unavailable");
        }
        if ("SOLD_OUT".equals(result)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Insufficient stock");
        }

        String[] parts = result == null ? new String[0] : result.split("\\|");
        if (parts.length != 4 || !"RESERVED".equals(parts[0])) {
            throw new IllegalStateException("Unexpected seckill reservation result: " + result);
        }

        return new SeckillStockReservation(Long.parseLong(parts[2]), Long.parseLong(parts[3]));
    }

    private String executeSeckillReservation(String stockKey, String windowKey, Integer quantity) {
        return stringRedisTemplate.execute(
                DECREASE_REDIS_STOCK_SCRIPT,
                List.of(stockKey, windowKey),
                quantity.toString()
        );
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

    private record SeckillStockReservation(
            Long acceptedAtEpochMillis,
            Long saleEndTimeEpochMillis
    ) {
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void persistSeckillOrder(SeckillOrderMessage message) {

        Order existingOrder = orderMapper.selectOne(Wrappers.<Order>lambdaQuery()
                .eq(Order::getOrderNo, message.orderNo()));

        // another repeated consumer has created the order
        // but failed to set the state to SUCCESS
        // so we just return directly, and set the state to SUCCESS
        if (existingOrder != null) {
            return;
        }

        Item item = itemMapper.selectById(message.itemId());

        if (message.acceptedAtEpochMillis() != null
                && message.saleEndTimeEpochMillis() != null
                && message.acceptedAtEpochMillis() >= message.saleEndTimeEpochMillis()) {
            throw new SeckillOrderRejectedException("Flash sale had ended when the request was accepted");
        }

        int updated = itemMapper.decreaseStockForSeckillOrder(
                message.itemId(),
                message.quantity()
        );

        // the only situation that needs to restore the stock
        if (updated != 1) {
            throw new SeckillOrderRejectedException(
                    "Seckill item is out of stock: " + message.itemId()
            );
        }

        BigDecimal subtotal = item.getPrice().multiply(BigDecimal.valueOf(message.quantity()));

        LocalDateTime now = LocalDateTime.now();

        Order order = new Order();
        order.setOrderNo(message.orderNo());
        order.setUserId(message.userId());
        order.setTotalAmount(subtotal);
        order.setStatus(OrderStatus.PENDING);
        order.setCreatedAt(now);
        order.setUpdatedAt(now);

        try {
            orderMapper.insert(order);
        } catch (DuplicateKeyException e) {
            log.error("multiple consumers triggered duplication key");
            throw e;
        }

        OrderItem orderItem = new OrderItem();
        orderItem.setOrderId(order.getId());
        orderItem.setItemId(item.getId());
        orderItem.setItemName(item.getName());
        orderItem.setPrice(item.getPrice());
        orderItem.setQuantity(message.quantity());
        orderItem.setSubtotal(subtotal);

        // unique-key in mysql will guarantee the order item is created by only one consumer
        if (orderItemMapper.insert(orderItem) != 1) {
            throw new IllegalStateException("Failed to create seckill order item");
        }
    }

    @Override
    public boolean cancelOrder(Long userId, String idempotencyKey, CancelOrderDTO dto) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Idempotency-Key is required"
            );
        }

        String idempotencyRedisKey =
                ORDER_CANCEL_IDEMPOTENCY_PREFIX
                        + userId
                        + ":"
                        + idempotencyKey.trim();

        Boolean idempotencyAcquired = stringRedisTemplate.opsForValue().setIfAbsent(
                idempotencyRedisKey,
                IDEMPOTENT_VALUE,
                Duration.ofHours(ORDER_DURATION_HOURS)
        );

        if (!Boolean.TRUE.equals(idempotencyAcquired)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Duplicate cancellation request"
            );
        }

        return cancelWithLock(
                userId,
                dto.orderId(),
                false,
                idempotencyRedisKey
        );
    }

    @Override
    public void cancelExpiredOrder(Long orderId) {
        cancelWithLock(null, orderId, true, null);
    }

    private boolean cancelWithLock(
            Long userId,
            Long orderId,
            boolean timeoutCancellation,
            String idempotencyRedisKey
    ) {
        String lockKey = ORDER_CANCEL_LOCK_PREFIX + orderId;
        String lockValue = UUID.randomUUID().toString();

        boolean lockAcquired = false;
        boolean mysqlCommitted = false;

        try {
            // get Redis lock
            Boolean acquired = stringRedisTemplate.opsForValue().setIfAbsent(
                    lockKey,
                    lockValue,
                    Duration.ofSeconds(ORDER_CANCEL_LOCK_EXPIRE_SECONDS)
            );

            if (!Boolean.TRUE.equals(acquired)) {
                if (idempotencyRedisKey != null) {
                    stringRedisTemplate.delete(idempotencyRedisKey);
                }
                return false;
            }

            lockAcquired = true;

            CancelOrderResultDTO result;

            // AOP and @Transactional doesn't work here, so we use TransactionTemplate
            try {
                result = transactionTemplate.execute(
                        transactionStatus ->
                                cancelOrderInMysql(
                                        userId,
                                        orderId,
                                        timeoutCancellation
                                )
                );
            } catch (RuntimeException e) {
                if (idempotencyRedisKey != null) {
                    stringRedisTemplate.delete(idempotencyRedisKey);
                }
                throw e;
            }

            assert result != null;
            if (!result.cancelled()) {
                if (idempotencyRedisKey != null) {
                    stringRedisTemplate.delete(idempotencyRedisKey);
                }
                return false;
            }

            mysqlCommitted = true;

            for (SeckillStockDTO stock : result.seckillStocks()) {
                stringRedisTemplate.execute(
                        RESTORE_REDIS_STOCK_SCRIPT,
                        List.of(SECKILL_STOCK_PREFIX + stock.itemId()),
                        stock.quantity().toString()
                );
            }

            return true;
        } catch (RuntimeException e) {
            if (!mysqlCommitted && idempotencyRedisKey != null) {
                stringRedisTemplate.delete(idempotencyRedisKey);
            }
            throw e;
        } finally {
            if (lockAcquired) {
                stringRedisTemplate.execute(
                        RELEASE_CANCEL_LOCK_SCRIPT,
                        List.of(lockKey),
                        lockValue
                );
            }
        }
    }

    private CancelOrderResultDTO cancelOrderInMysql(
            Long userId,
            Long orderId,
            boolean timeoutCancellation
    ) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiredBefore = now.minusHours(ORDER_DURATION_HOURS);

        LambdaQueryWrapper<Order> condition = Wrappers.<Order>lambdaQuery().eq(Order::getId, orderId);

        if (!timeoutCancellation) {
            condition.eq(Order::getUserId, userId);
        }
        Order order = orderMapper.selectOne(condition);

        if (order == null) {
            if (timeoutCancellation) {
                return new CancelOrderResultDTO(false, List.of());
            }

            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Order not found"
            );
        }

        if (!order.getStatus().equals(OrderStatus.PENDING)) {
            if (timeoutCancellation) {
                return new CancelOrderResultDTO(false, List.of());
            }

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Only pending orders can be cancelled"
            );
        }

        if (timeoutCancellation && !order.getCreatedAt().isBefore(expiredBefore)) {
            return new CancelOrderResultDTO(false, List.of());
        }

        var update = Wrappers.<Order>lambdaUpdate()
                .eq(Order::getId, orderId)
                .eq(Order::getStatus, OrderStatus.PENDING)
                .set(Order::getStatus, OrderStatus.CANCELLED)
                .set(Order::getUpdatedAt, now);

        if (timeoutCancellation) {
            update.lt(Order::getCreatedAt, expiredBefore);
        } else {
            update.eq(Order::getUserId, userId);
        }

        if (orderMapper.update(null, update) != 1) {
            if (timeoutCancellation) {
                return new CancelOrderResultDTO(false, List.of());
            }

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Order is no longer pending"
            );
        }

        List<OrderItem> orderItems = orderItemMapper.selectList(
                Wrappers.<OrderItem>lambdaQuery().eq(OrderItem::getOrderId, orderId)
        );

        List<SeckillStockDTO> seckillStocks = new ArrayList<>();

        for (OrderItem orderItem : orderItems) {
            Item item = itemMapper.selectById(orderItem.getItemId());

            if (item == null) {
                throw new IllegalStateException(
                        "Item not found: " + orderItem.getItemId()
                );
            }

            boolean isSeckill = Boolean.TRUE.equals(item.getIsSeckill());

            int updated = itemMapper.increaseStockAfterOrderCancellation(
                    item.getId(),
                    orderItem.getQuantity(),
                    isSeckill
            );

            if (updated != 1) {
                throw new IllegalStateException(
                        "Failed to restore item stock: " + item.getId()
                );
            }

            if (isSeckill) {
                seckillStocks.add(new SeckillStockDTO(item.getId(), orderItem.getQuantity()));
            }
        }

        return new CancelOrderResultDTO(true, seckillStocks);
    }

    @Override
    public List<OrderItemVO> listItemsByOrderId(Long userId, Long orderId) {
        Order order = orderMapper.selectOne(
                Wrappers.<Order>lambdaQuery()
                        .eq(Order::getId, orderId)
                        .eq(Order::getUserId, userId)
        );

        if (order == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Order not found"
            );
        }

        List<OrderItem> orderItems = orderItemMapper.selectList(
                Wrappers.<OrderItem>lambdaQuery()
                        .eq(OrderItem::getOrderId, orderId)
                        .orderByAsc(OrderItem::getId)
        );

        if (orderItems.isEmpty()) {
            return List.of();
        }

        List<Long> itemIds = orderItems.stream()
                .map(OrderItem::getItemId)
                .distinct()
                .toList();

        Map<Long, String> imageUrlsByItemId = new HashMap<>();

        itemMapper.selectBatchIds(itemIds).forEach(item ->
                imageUrlsByItemId.put(item.getId(), item.getImageUrls())
        );

        List<OrderItemVO> result = new ArrayList<>();

        for (OrderItem orderItem : orderItems) {
            String imageUrls = imageUrlsByItemId.get(orderItem.getItemId());
            String imageUrl = null;

            if (imageUrls != null && !imageUrls.isBlank()) {
                imageUrl = imageUrls.split(",")[0].trim();
            }

            result.add(new OrderItemVO(
                    imageUrl,
                    orderItem.getItemName(),
                    orderItem.getQuantity(),
                    orderItem.getSubtotal()
            ));
        }

        return result;
    }
}
