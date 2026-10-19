package com.me.user.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.me.constant.RedisConstant;
import com.me.exception.auth.InvalidRoleException;
import com.me.exception.auth.UUIDDuplicationKeyException;
import com.me.exception.auth.UserNotFoundException;
import com.me.security.AuthorityType;
import com.me.exception.auth.UsernameAlreadyExistsException;
import com.me.response.Result;
import com.me.security.JwtUtil;
import com.me.security.LoginUser;
import com.me.user.dto.LoginDTO;
import com.me.user.dto.RechargeDTO;
import com.me.user.dto.RegisterDTO;
import com.me.user.entity.Account;
import com.me.user.entity.Authority;
import com.me.user.entity.RechargeRecord;
import com.me.user.entity.User;
import com.me.user.mapper.AccountMapper;
import com.me.user.mapper.AuthorityMapper;
import com.me.user.mapper.RechargeRecordMapper;
import com.me.user.mapper.UserMapper;
import com.me.user.service.IAuthService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Objects;

import static com.me.constant.RedisConstant.IDEMPOTENT_VALUE;

@Service
public class AuthServiceImpl implements IAuthService {

    private final UserMapper userMapper;
    private final AuthorityMapper authorityMapper;
    private final AccountMapper accountMapper;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtil jwtUtil;
    private final StringRedisTemplate stringRedisTemplate;
    private final RechargeRecordMapper rechargeRecordMapper;

    public AuthServiceImpl(
            UserMapper userMapper,
            AuthorityMapper authorityMapper,
            AccountMapper accountMapper,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            AuthenticationManager authenticationManager,
            RechargeRecordMapper rechargeRecordMapper,
            StringRedisTemplate stringRedisTemplate) {
        this.userMapper = userMapper;
        this.authorityMapper = authorityMapper;
        this.accountMapper = accountMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.stringRedisTemplate = stringRedisTemplate;
        this.rechargeRecordMapper = rechargeRecordMapper;
        this.authenticationManager = authenticationManager;
    }

    @Override
    @Transactional
    public void register(RegisterDTO dto) {

        User exists = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getUsername, dto.username())
        );

        if (exists != null) {
            throw new UsernameAlreadyExistsException("User already exists");
        }

        String authorityValue = dto.authority();
        if (!AuthorityType.ROLE_USER.getAuthority().equals(authorityValue)
                && !AuthorityType.ROLE_MERCHANT.getAuthority().equals(authorityValue)) {
            throw new InvalidRoleException("Invalid user role");
        }

        String encodedPassword = passwordEncoder.encode(dto.password());

        User user = new User();
        user.setUsername(dto.username());
        user.setPassword(encodedPassword);

        try {
            userMapper.insert(user);
        } catch (DuplicateKeyException e) {
            throw new UsernameAlreadyExistsException("DuplicationKey -> User already exists");
        }

        Authority authority = new Authority();
        authority.setUsername(dto.username());
        authority.setAuthority(authorityValue);
        authorityMapper.insert(authority);

        Account account = new Account();
        account.setUserId(user.getId());
        account.setBalance(BigDecimal.ZERO);
        accountMapper.insert(account);
    }

    public Result login(LoginDTO dto, HttpServletResponse response) {

        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getUsername, dto.username())
        );

        if (user == null) {
            throw new UserNotFoundException("User not found");
        }

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        dto.username(),
                        dto.password()
                )
        );

        LoginUser loginUser = (LoginUser) authentication.getPrincipal();

        if (loginUser.getAuthorities().stream()
                .noneMatch(authority -> authority.getAuthority().equals(dto.authority()))) {
            throw new InvalidRoleException("Invalid user role");
        }

        String accessToken = jwtUtil.generateAccessToken(dto.username());
        String refreshToken = jwtUtil.generateRefreshToken(dto.username());

        ResponseCookie cookie = ResponseCookie.from("refreshToken", refreshToken)
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(Duration.ofDays(7))
                .sameSite("Lax")
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        return Result.success(Map.of("accessToken", accessToken));
    }

    @Override
    public Result logout(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(Duration.ZERO)
                .sameSite("Lax")
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        return Result.success();
    }

    @Override
    @Transactional
    public Result recharge(Long userId, RechargeDTO dto) {
        String key = RedisConstant.RECHARGE_IDEMPOTENT_PREFIX + userId + ":" + dto.uuid();

        Boolean success = stringRedisTemplate.opsForValue().setIfAbsent(key, IDEMPOTENT_VALUE,
                Duration.ofMinutes(RedisConstant.RECHARGE_IDEMPOTENT_EXPIRE_MINUTES));

        if (!Boolean.TRUE.equals(success)) {
            Result replayResult = getRechargeReplayResult(userId, dto);
            if (replayResult != null) {
                return replayResult;
            }
            return Result.error(HttpStatus.CONFLICT.value(), "Recharge request is still processing");
        }

        // in cast that another thread already recharged and release the Redis lock
        // so current thread gained the lock again
        Result replayResult = getRechargeReplayResult(userId, dto);
        if (replayResult != null) {
            return replayResult;
        }

        Account account = accountMapper.selectOne(
                new LambdaQueryWrapper<Account>().eq(Account::getUserId, userId)
        );

        if (account == null) {
            stringRedisTemplate.delete(key);
            return Result.error(HttpStatus.NOT_FOUND.value(), "Account not found");
        }

        int updated = accountMapper.increaseBalance(userId, dto.account());

        if (updated == 0) {
            stringRedisTemplate.delete(key);
            return Result.error(HttpStatus.NOT_FOUND.value(), "Account not found");
        }

        try {
            rechargeRecordMapper.insert(new RechargeRecord(
                    null,
                    userId,
                    dto.uuid(),
                    dto.account(),
                    LocalDateTime.now()
            ));
        } catch (DuplicateKeyException e) {
            throw new UUIDDuplicationKeyException("Recharge UUID duplicated");
        }

        return Result.success();
    }

    private Result getRechargeReplayResult(Long userId, RechargeDTO dto) {
        LambdaQueryWrapper<RechargeRecord> query = new LambdaQueryWrapper<RechargeRecord>()
                .eq(RechargeRecord::getUuid, dto.uuid());

        RechargeRecord existing = rechargeRecordMapper.selectOne(query);
        if (existing == null) {
            return null;
        }

        boolean sameRequest = Objects.equals(existing.getUserId(), userId)
                && existing.getAmount().compareTo(dto.account()) == 0;
        if (sameRequest) {
            return Result.success();
        }
        return Result.error(HttpStatus.CONFLICT.value(), "Recharge UUID was used for a different request");
    }

    @Override
    public BigDecimal getBalance(Long userId) {
        Account account = accountMapper.selectById(userId);

        if (account == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Account not found"
            );
        }

        return account.getBalance();
    }
}