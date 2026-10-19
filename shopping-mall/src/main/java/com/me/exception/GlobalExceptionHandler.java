package com.me.exception;

import com.me.exception.auth.InvalidRoleException;
import com.me.exception.auth.UUIDDuplicationKeyException;
import com.me.exception.auth.UserNotFoundException;
import com.me.exception.auth.UsernameAlreadyExistsException;
import com.me.response.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ResponseStatus(HttpStatus.CONFLICT)
    @ExceptionHandler(UsernameAlreadyExistsException.class)
    public Result handleUsernameAlreadyExists(UsernameAlreadyExistsException e) {
        return Result.error(HttpStatus.CONFLICT.value(), e.getMessage());
    }

    @ResponseStatus(HttpStatus.FORBIDDEN)
    @ExceptionHandler(InvalidRoleException.class)
    public Result handleInvalidRole(InvalidRoleException e) {
        return Result.error(HttpStatus.FORBIDDEN.value(), e.getMessage());
    }

    @ResponseStatus(HttpStatus.NOT_FOUND)
    @ExceptionHandler(UserNotFoundException.class)
    public Result handleUserNotFound(UserNotFoundException e) {
        return Result.error(HttpStatus.NOT_FOUND.value(), e.getMessage());
    }

    @ResponseStatus(HttpStatus.CONFLICT)
    @ExceptionHandler(UUIDDuplicationKeyException.class)
    public Result handleUUIDDuplicationKey(UUIDDuplicationKeyException e) {
        return Result.error(HttpStatus.CONFLICT.value(), e.getMessage());
    }

    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    @ExceptionHandler(BadCredentialsException.class)
    public Result handleBadCredentials(BadCredentialsException e) {
        return Result.error(HttpStatus.UNAUTHORIZED.value(), "Invalid username or password");
    }

    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return Result.error(HttpStatus.BAD_REQUEST.value(), message);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Result> handleResponseStatusException(ResponseStatusException e) {
        HttpStatusCode status = e.getStatusCode();
        String message = e.getReason() == null ? "Request failed" : e.getReason();

        return ResponseEntity.status(status).body(Result.error(status.value(), message));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Result> handleMaxUploadSizeExceeded(MaxUploadSizeExceededException e) {
        int status = HttpStatus.PAYLOAD_TOO_LARGE.value();

        return ResponseEntity.status(status).body(Result.error(status, "File size exceeds the maximum limit"));
    }

    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    @ExceptionHandler(Exception.class)
    public Result handleException(Exception e) {
        log.error("Unhandled exception", e);
        return Result.error(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Internal server error"
        );
    }
}
