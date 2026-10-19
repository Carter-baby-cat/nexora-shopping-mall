package com.me.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@SuppressWarnings("all")
public class ConcurrentUserCsvGenerator {

    private static final int USER_COUNT = 1000;
    private static final String PASSWORD = "ConcurrentTest123!";
    private static final String AUTHORITY = "ROLE_USER";

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public static void main(String[] args) throws Exception {
        String baseUrl = args.length > 0
                ? args[0].replaceAll("/+$", "")
                : "http://localhost:8086";

        Path outputPath = args.length > 1
                ? Path.of(args[1])
                : Path.of("jmeter_users.csv");

        List<String> csvRows = new ArrayList<>(USER_COUNT);

        for (int i = 1; i <= USER_COUNT; i++) {
            String username = "concurrent_user_" + i;

            registerOrUseExistingAccount(baseUrl, username);

            String accessToken = loginAndGetAccessToken(baseUrl, username);
            String uuid = UUID.randomUUID().toString();

            // CSV 无表头：第一列 accessToken，第二列 uuid
            csvRows.add(accessToken + "," + uuid);

            if (i % 50 == 0 || i == USER_COUNT) {
                System.out.println("Processed " + i + "/" + USER_COUNT + " users");
            }
        }

        Files.write(
                outputPath,
                csvRows,
                StandardCharsets.UTF_8,
                StandardOpenOption.CREATE,
                StandardOpenOption.TRUNCATE_EXISTING,
                StandardOpenOption.WRITE
        );

        System.out.println("CSV generated: " + outputPath.toAbsolutePath());
    }

    private static void registerOrUseExistingAccount(
            String baseUrl,
            String username
    ) throws Exception {
        Map<String, String> body = Map.of(
                "username", username,
                "password", PASSWORD,
                "authority", AUTHORITY
        );

        HttpResponse<String> response = postJson(
                baseUrl + "/user/register",
                body
        );

        JsonNode result = OBJECT_MAPPER.readTree(response.body());
        int resultCode = result.path("code").asInt(-1);

        if (response.statusCode() == 200 && resultCode == 200) {
            return;
        }

        // 已注册过则继续登录；若密码或角色不匹配，登录步骤会报错。
        if (response.statusCode() == 409 && resultCode == 409) {
            return;
        }

        throw new IllegalStateException(
                "Registration failed for " + username
                        + "; HTTP " + response.statusCode()
                        + "; response: " + response.body()
        );
    }

    private static String loginAndGetAccessToken(
            String baseUrl,
            String username
    ) throws Exception {
        Map<String, String> body = Map.of(
                "username", username,
                "password", PASSWORD,
                "authority", AUTHORITY
        );

        HttpResponse<String> response = postJson(
                baseUrl + "/user/login",
                body
        );

        JsonNode result = OBJECT_MAPPER.readTree(response.body());

        if (response.statusCode() != 200 || result.path("code").asInt(-1) != 200) {
            throw new IllegalStateException(
                    "Login failed for " + username
                            + "; HTTP " + response.statusCode()
                            + "; response: " + response.body()
            );
        }

        String accessToken = result.path("data")
                .path("accessToken")
                .asText(null);

        if (accessToken == null || accessToken.isBlank()) {
            throw new IllegalStateException(
                    "Login response has no accessToken for " + username
            );
        }

        return accessToken;
    }

    private static HttpResponse<String> postJson(
            String url,
            Object body
    ) throws Exception {
        String json = OBJECT_MAPPER.writeValueAsString(body);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        return HTTP_CLIENT.send(
                request,
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
        );
    }
}