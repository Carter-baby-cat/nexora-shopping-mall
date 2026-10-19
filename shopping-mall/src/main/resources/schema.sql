-- ============================================
-- Shopping Mall Database Schema
-- ============================================

-- 每次启动重新初始化，先删除旧表
# DROP TABLE IF EXISTS payment;
# DROP TABLE IF EXISTS order_item;
# DROP TABLE IF EXISTS orders;
# DROP TABLE IF EXISTS item;
# DROP TABLE IF EXISTS account;
# DROP TABLE IF EXISTS authorities;
# DROP TABLE IF EXISTS users;
# DROP TABLE IF EXISTS recharge_record;

-- ============================================
-- 1. users 用户信息表
-- ============================================
CREATE TABLE IF NOT EXISTS users
(
    id       BIGINT       NOT NULL AUTO_INCREMENT,
    username VARCHAR(50)  NOT NULL,
    password VARCHAR(255) NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uk_users_username (username)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;


-- ============================================
-- 2. authorities 角色权限表
-- ============================================
CREATE TABLE IF NOT EXISTS authorities
(
    id        BIGINT      NOT NULL AUTO_INCREMENT,
    username  VARCHAR(50) NOT NULL,
    authority VARCHAR(50) NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uk_authorities_user_role (username, authority),
    KEY idx_authorities_username (username)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;


-- ============================================
-- 3. account 账户余额表
-- ============================================
CREATE TABLE IF NOT EXISTS account
(
    user_id BIGINT         NOT NULL,
    balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,

    PRIMARY KEY (user_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;


-- ============================================
-- 4. item 商品表
-- ============================================
CREATE TABLE IF NOT EXISTS item
(
    id          BIGINT         NOT NULL AUTO_INCREMENT,
    merchant_id BIGINT         NOT NULL,
    name        VARCHAR(200)   NOT NULL,
    category    VARCHAR(100)   NOT NULL,
    price       DECIMAL(12, 2) NOT NULL,
    stock       INT            NOT NULL DEFAULT 0,
    description TEXT,
    image_urls  TEXT,
    status      VARCHAR(20)    NOT NULL,
    is_seckill  BOOLEAN        NOT NULL DEFAULT FALSE,
    end_time    DATETIME       NULL,
    brand       VARCHAR(200),

    PRIMARY KEY (id),

    -- 商家查询自己的商品
    KEY idx_item_merchant_id (merchant_id),

    -- 定时任务寻找 ONLINE 且库存为 0 的商品
    KEY idx_item_status_stock (status, stock)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;


-- ============================================
-- 5. orders 订单表
-- ============================================
CREATE TABLE IF NOT EXISTS orders
(
    id           BIGINT         NOT NULL AUTO_INCREMENT,
    order_no     VARCHAR(32)    NOT NULL,
    user_id      BIGINT         NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    status       VARCHAR(20)    NOT NULL,
    created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    -- 对外订单编号唯一
    UNIQUE KEY uk_orders_order_no (order_no),

    -- 查询用户订单，并按创建时间排序
    KEY idx_orders_user_created (user_id, created_at),

    -- 定时扫描超时 PENDING 订单
    KEY idx_orders_status_created (status, created_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;


-- ============================================
-- 6. order_item 订单明细表
-- ============================================
CREATE TABLE IF NOT EXISTS order_item
(
    id        BIGINT         NOT NULL AUTO_INCREMENT,
    order_id  BIGINT         NOT NULL,
    item_id   BIGINT         NOT NULL,
    item_name VARCHAR(200)   NOT NULL,
    price     DECIMAL(12, 2) NOT NULL,
    quantity  INT            NOT NULL,
    subtotal  DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (id),

    -- 根据订单查询订单明细
    KEY idx_order_item_order_id (order_id),

    -- 根据商品查询订单明细
    KEY idx_order_item_item_id (item_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;


-- ============================================
-- 7. payment 支付记录表
-- ============================================
CREATE TABLE IF NOT EXISTS payment
(
    id        BIGINT         NOT NULL AUTO_INCREMENT,
    order_id  BIGINT         NOT NULL,
    buyer_id  BIGINT         NOT NULL,
    amount    DECIMAL(12, 2) NOT NULL,
    status    VARCHAR(20)    NOT NULL,
    paid_at   DATETIME       NULL,

    PRIMARY KEY (id),

    -- 一个订单对应一条支付记录
    UNIQUE KEY uk_payment_order_id (order_id),

    -- 查询买家的支付记录
    KEY idx_payment_buyer_id (buyer_id)

) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

-- ============================================
-- 8. recharge_record 充值记录表
-- ============================================
CREATE TABLE IF NOT EXISTS recharge_record
(
    id         BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id    BIGINT         NOT NULL,
    uuid       VARCHAR(36)    NOT NULL,
    amount     DECIMAL(12, 2) NOT NULL,
    created_at DATETIME       NOT NULL,
    UNIQUE KEY uk_uuid (uuid)
);

CREATE TABLE IF NOT EXISTS payment_item
(
    id            BIGINT         NOT NULL AUTO_INCREMENT,
    payment_id    BIGINT         NOT NULL,
    order_item_id BIGINT         NOT NULL,
    item_id       BIGINT         NOT NULL,
    seller_id     BIGINT         NOT NULL,
    quantity      INT            NOT NULL,
    unit_price    DECIMAL(12, 2) NOT NULL,
    amount        DECIMAL(12, 2) NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uk_payment_item_order_item_id (order_item_id),
    KEY idx_payment_item_payment_id (payment_id),
    KEY idx_payment_item_seller_id (seller_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;