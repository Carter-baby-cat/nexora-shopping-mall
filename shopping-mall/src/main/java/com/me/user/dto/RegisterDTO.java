package com.me.user.dto;

import jakarta.validation.constraints.NotBlank;

public record RegisterDTO(
        @NotBlank(message = "Username cannot be blank")
        String username,

        @NotBlank(message = "Password cannot be blank")
        String password,

        @NotBlank(message = "Authority cannot be blank")
        String authority
) {
}