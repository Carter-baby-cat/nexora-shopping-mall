package com.me.security;

import com.me.user.entity.Authority;
import com.me.user.entity.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Collections;
import java.util.List;

public class LoginUser implements UserDetails {

    @Getter
    private final User user;
    private final Authority authority;

    public LoginUser(User user, Authority authority) {
        this.user = user;
        this.authority = authority;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        if (authority == null || authority.getAuthority() == null) {
            return Collections.emptyList();
        }
        return List.of(new SimpleGrantedAuthority(authority.getAuthority()));
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getUsername();
    }
}