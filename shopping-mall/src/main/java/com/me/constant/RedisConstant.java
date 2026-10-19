package com.me.constant;

public final class RedisConstant {

    public static final String RECHARGE_IDEMPOTENT_PREFIX = "recharge:idempotent:";

    public static final long RECHARGE_IDEMPOTENT_EXPIRE_MINUTES = 5L;

    public static final String IDEMPOTENT_VALUE = "1";

    public static final String SECKILL_STOCK_PREFIX = "seckill:stock:";

    public static final String SECKILL_WINDOW_PREFIX = "seckill:window:";

    public static final String CART_PREFIX = "cart:";

    public static final String IDEMPOTENCY_PREFIX = "order:create:idempotent:";

    public static final String SECKILL_ORDER_IDEMPOTENCY_PREFIX = "order:create:seckill:idempotent:";

    public static final String SECKILL_ORDER_CONSUMER_PREFIX = "order:seckill:consumer:";

    public static final String SUCCESS = "SUCCESS";

    public static final String FAILED = "FAILED";

    public static final String ORDER_CANCEL_IDEMPOTENCY_PREFIX = "order:cancel:idempotent:";

    public static final String ORDER_CANCEL_LOCK_PREFIX = "order:cancel:lock:";

    public static final long ORDER_CANCEL_LOCK_EXPIRE_SECONDS = 30L;

    public static final String PAYMENT_IDEMPOTENT_PREFIX = "payment:idempotent:";
}
