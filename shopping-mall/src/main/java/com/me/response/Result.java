package com.me.response;

public record Result(
        Integer code,
        String message,
        Object data
) {

    public static Result success(Object data) {
        return new Result(200, "success", data);
    }

    public static Result success() {
        return new Result(200, "success", null);
    }

    public static Result error(Integer code, String message) {
        return new Result(code, message, null);
    }
}