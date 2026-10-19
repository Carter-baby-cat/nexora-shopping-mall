package com.me.user.service;

import com.me.response.Result;
import com.me.user.dto.LoginDTO;
import com.me.user.dto.RechargeDTO;
import com.me.user.dto.RegisterDTO;
import jakarta.servlet.http.HttpServletResponse;

import java.math.BigDecimal;

public interface IAuthService {

    void register(RegisterDTO dto);

    Result login(LoginDTO dto, HttpServletResponse response);

    Result logout(HttpServletResponse response);

    Result recharge(Long userId, RechargeDTO dto);

    BigDecimal getBalance(Long userId);
}