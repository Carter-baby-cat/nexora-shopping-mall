package com.me.user.controller;

import com.me.response.Result;
import com.me.security.LoginUser;
import com.me.user.dto.LoginDTO;
import com.me.user.dto.RechargeDTO;
import com.me.user.dto.RegisterDTO;
import com.me.user.service.IAuthService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/user")
public class AuthController {

    private final IAuthService authService;

    public AuthController(IAuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public Result register(@Valid @RequestBody RegisterDTO dto) {
        authService.register(dto);
        return Result.success();
    }

    @PostMapping("/login")
    public Result login(@Valid @RequestBody LoginDTO dto, HttpServletResponse response) {
        return authService.login(dto, response);
    }

    @PostMapping("/logout")
    public Result logout(HttpServletResponse response) {
        return authService.logout(response);
    }

    @PostMapping("/recharge")
    public ResponseEntity<Result> recharge(
            @AuthenticationPrincipal LoginUser loginUser,
            @Valid @RequestBody RechargeDTO dto) {

        Result result = authService.recharge(loginUser.getUser().getId(), dto);
        return ResponseEntity.status(result.code()).body(result);
    }

    @GetMapping("/balance")
    public Result getBalance(@AuthenticationPrincipal LoginUser loginUser) {
        BigDecimal balance = authService.getBalance(loginUser.getUser().getId());
        return Result.success(Map.of("balance", balance));
    }
}