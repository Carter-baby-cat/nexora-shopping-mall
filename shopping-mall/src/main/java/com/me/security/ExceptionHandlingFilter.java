package com.me.security;

import com.me.response.ResultWriter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.NonNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ExceptionHandlingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ExceptionHandlingFilter.class);

    private final ResultWriter resultWriter;

    public ExceptionHandlingFilter(ResultWriter resultWriter) {
        this.resultWriter = resultWriter;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws IOException {

        try {
            filterChain.doFilter(request, response);
        } catch (Exception e) {
            handleException(response, unwrap(e));
        }
    }

    private Throwable unwrap(Throwable e) {
        while (e instanceof ServletException && e.getCause() != null) {
            e = e.getCause();
        }
        return e;
    }

    private void handleException(HttpServletResponse response, Throwable e) throws IOException {
        if (response.isCommitted()) {
            return;
        }

        if (e instanceof AuthenticationException) {
            resultWriter.write(response, HttpStatus.UNAUTHORIZED.value(), "Unauthorized");
        } else if (e instanceof MaxUploadSizeExceededException) {
            resultWriter.write(response, HttpStatus.BAD_REQUEST.value(), "File size exceeds the maximum limit");
        } else {
            log.error("Unhandled exception", e);
            resultWriter.write(response, HttpStatus.INTERNAL_SERVER_ERROR.value(), "Internal server error");
        }
    }
}
