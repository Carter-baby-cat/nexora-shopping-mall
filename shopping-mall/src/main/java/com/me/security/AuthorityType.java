package com.me.security;

public enum AuthorityType {
    ROLE_USER("ROLE_USER"),
    ROLE_MERCHANT("ROLE_MERCHANT");

    private final String authority;

    AuthorityType(String authority) {
        this.authority = authority;
    }

    public String getAuthority() {
        return authority;
    }
}