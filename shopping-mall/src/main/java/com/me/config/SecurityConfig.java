package com.me.config;

import com.me.response.ResultWriter;
import com.me.security.AuthorityType;
import com.me.security.JwtAuthenticationFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@SuppressWarnings("all")
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationProvider authenticationProvider(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder) {

        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();

        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);

        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration configuration)
            throws Exception {

        return configuration.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, ResultWriter resultWriter) throws Exception {
        http
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )
                .csrf(AbstractHttpConfigurer::disable)
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, e) ->
                                resultWriter.write(response, HttpStatus.UNAUTHORIZED.value(), "Unauthorized"))
                        .accessDeniedHandler((request, response, e) ->
                                resultWriter.write(response, HttpStatus.FORBIDDEN.value(), "Access denied"))
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers("/user/register").permitAll()
                        .requestMatchers("/user/login").permitAll()
                        .requestMatchers("/user/logout").authenticated()

                        .requestMatchers("/user/recharge")
                        .hasAuthority(AuthorityType.ROLE_USER.getAuthority())

                        .requestMatchers(HttpMethod.PATCH, "/item/**")
                        .hasAuthority(AuthorityType.ROLE_MERCHANT.getAuthority())

                        .requestMatchers(HttpMethod.GET, "/item/merchant/list")
                        .hasAuthority(AuthorityType.ROLE_MERCHANT.getAuthority())

                        .requestMatchers(HttpMethod.GET, "/item/**")
                        .hasAuthority(AuthorityType.ROLE_USER.getAuthority())

                        .requestMatchers(HttpMethod.POST, "/item/**")
                        .hasAuthority(AuthorityType.ROLE_MERCHANT.getAuthority())

                        .requestMatchers(HttpMethod.PUT, "/item/**")
                        .hasAuthority(AuthorityType.ROLE_MERCHANT.getAuthority())

                        .requestMatchers(HttpMethod.DELETE, "/item/**")
                        .hasAuthority(AuthorityType.ROLE_MERCHANT.getAuthority())

                        .requestMatchers("/cart/**")
                        .hasAuthority(AuthorityType.ROLE_USER.getAuthority())

                        .requestMatchers("/order/**")
                        .hasAuthority(AuthorityType.ROLE_USER.getAuthority())

                        .requestMatchers("/pay/**")
                        .hasAuthority(AuthorityType.ROLE_USER.getAuthority())

                        .anyRequest().authenticated()
                )
                .addFilterBefore(
                        jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }

    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtAuthenticationFilterRegistration(
            JwtAuthenticationFilter filter) {

        FilterRegistrationBean<JwtAuthenticationFilter> registration =
                new FilterRegistrationBean<>(filter);

        registration.setEnabled(false);
        return registration;
    }
}