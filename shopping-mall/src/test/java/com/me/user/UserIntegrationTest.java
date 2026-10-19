package com.me.user;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class UserIntegrationTest {
//
//    @Autowired
//    private MockMvc mockMvc;
//
//    /**
//     * register success
//     */
//    @Test
//    void registerSuccess() throws Exception {
//        mockMvc.perform(
//                        post("/user/register")
//                                .contentType(MediaType.APPLICATION_JSON)
//                                .content("""
//                                        {
//                                            "username": "Jack",
//                                            "password": "Zh20031212",
//                                            "authority": "ROLE_USER"
//                                        }
//                                        """)
//                )
//                .andExpect(status().isOk())
//                .andExpect(jsonPath("$.code").value(200))
//                .andDo(print());
//    }
//
//    /**
//     * register failed by conflict
//     */
//    @Test
//    void registerConflict() throws Exception {
//        mockMvc.perform(
//                        post("/user/register")
//                                .contentType(MediaType.APPLICATION_JSON)
//                                .content("""
//                                        {
//                                            "username": "Carter",
//                                            "password": "Zh20031212",
//                                            "authority": "ROLE_USER"
//                                        }
//                                        """)
//                )
//                .andExpect(status().isConflict())
//                .andExpect(jsonPath("$.code").value(409))
//                .andDo(print());
//    }
//
//    /**
//     * register failed by invalid authority
//     */
//    @Test
//    void registerInvalidAuthority() throws Exception {
//        mockMvc.perform(
//                        post("/user/register")
//                                .contentType(MediaType.APPLICATION_JSON)
//                                .content("""
//                                        {
//                                            "username": "Admin",
//                                            "password": "Zh20031212",
//                                            "authority": "ROLE_ADMIN"
//                                        }
//                                        """)
//                )
//                .andExpect(status().isForbidden())
//                .andExpect(jsonPath("$.code").value(403))
//                .andDo(print());
//    }
//
//    /**
//     * register failed by missing fields
//     */
//    @Test
//    void registerMissingFields() throws Exception {
//        mockMvc.perform(
//                        post("/user/register")
//                                .contentType(MediaType.APPLICATION_JSON)
//                                .content("""
//                                        {
//                                            "username": "Prime",
//                                            "authority": "ROLE_USER"
//                                        }
//                                        """)
//                )
//                .andExpect(status().isBadRequest())
//                .andExpect(jsonPath("$.code").value(400))
//                .andDo(print());
//    }
//
//    /**
//     * login success
//     */
//    @Test
//    void loginSuccess() throws Exception {
//        mockMvc.perform(
//                        post("/user/login")
//                                .contentType(MediaType.APPLICATION_JSON)
//                                .content("""
//                                        {
//                                            "username": "concurrent_Jack",
//                                            "password": "carter_like_via",
//                                            "authority": "ROLE_USER"
//                                        }
//                                        """)
//                )
//                .andExpect(status().isOk())
//                .andExpect(jsonPath("$.code").value(200))
//                .andExpect(jsonPath("$.data.accessToken").exists())
//                .andDo(print());
//    }
//
//    /**
//     * login failed by wrong password
//     */
//    @Test
//    void loginWrongPassword() throws Exception {
//        mockMvc.perform(
//                        post("/user/login")
//                                .contentType(MediaType.APPLICATION_JSON)
//                                .content("""
//                                        {
//                                            "username": "Carter",
//                                            "password": "WrongPassword123",
//                                            "authority": "ROLE_USER"
//                                        }
//                                        """)
//                )
//                .andExpect(status().isUnauthorized())
//                .andExpect(jsonPath("$.code").value(401))
//                .andDo(print());
//    }
//
//    /**
//     * login failed by username not found
//     */
//    @Test
//    void loginUsernameNotFound() throws Exception {
//        mockMvc.perform(
//                        post("/user/login")
//                                .contentType(MediaType.APPLICATION_JSON)
//                                .content("""
//                                        {
//                                            "username": "Carter",
//                                            "password": "Zh20031212",
//                                            "authority": "ROLE_USER"
//                                        }
//                                        """)
//                )
//                .andExpect(status().isNotFound())
//                .andExpect(jsonPath("$.code").value(404))
//                .andDo(print());
//    }
//
//    /**
//     * login failed by wrong authority
//     */
//    @Test
//    void loginWrongAuthority() throws Exception {
//        mockMvc.perform(
//                        post("/user/login")
//                                .contentType(MediaType.APPLICATION_JSON)
//                                .content("""
//                                        {
//                                            "username": "Carter",
//                                            "password": "Zh20031212",
//                                            "authority": "ROLE_MERCHANT"
//                                        }
//                                        """)
//                )
//                .andExpect(status().isForbidden())
//                .andExpect(jsonPath("$.code").value(403))
//                .andDo(print());
//    }
//
//    /**
//     * logout success
//     */
//    @Test
//    void logoutSuccess() throws Exception {
//
//        String accessToken = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDYXJ0ZXIiLCJ0eXBlIjoiYWNjZXNzI" +
//                "iwiaWF0IjoxNzkwNDI5NjAyLCJleHAiOjE3OTA0MzE0MDJ9.gxjK5yQwczDcJYeVK1Ht9_zQR8x" +
//                "tEcWFdbUMzHWbum0abMXQjuiWTjQ0jc5W3e5QNb1hPo9a5va8-PSVbo_edw";
//
//        String refreshToken = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDYXJ0ZXIiLCJ0eXBlIjoicmVmcmVz" +
//                "aCIsImlhdCI6MTc5MDQyOTYwMiwiZXhwIjoxNzkxMDM0NDAyfQ.vmfLq6GxLppMyomr6HdubxXB" +
//                "NLie8yhltZhm95Lb95bRRepnymvLMPrawJ8ptc93R0PYFcmZ1yNQAuLaQsIClQ";
//
//        mockMvc.perform(
//                        post("/user/logout")
//                                .header("Authorization", "Bearer " + accessToken)
//                                .cookie(new Cookie("refreshToken", refreshToken))
//                )
//                .andExpect(status().isOk())
//                .andExpect(jsonPath("$.code").value(200))
//                .andDo(print());
//    }
//
//    /**
//     * recharge success
//     */
//    @Test
//    void rechargeSuccess() throws Exception {
//        String accessToken = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDYXJ0ZXIiLCJ0eXBlIjoiYWNjZXNzIiwia" +
//                "WF0IjoxNzkwNDMwNzg2LCJleHAiOjE3OTA0MzI1ODZ9.h1NWBR_aLzYAAG3oKMNg3MImGaDeVgZG7lR" +
//                "f_WJgivNiFkvQfBQqnEsCnVkuG0Ldomz58wS4ztvxk80v1cFJAg";
//
//        mockMvc.perform(
//                        post("/user/recharge")
//                                .header("Authorization", "Bearer " + accessToken)
//                                .contentType(MediaType.APPLICATION_JSON)
//                                .content("""
//                                        {
//                                            "account": 100,
//                                            "uuid": "recharge-test-001"
//                                        }
//                                        """)
//                )
//                .andExpect(status().isOk())
//                .andExpect(jsonPath("$.code").value(200))
//                .andDo(print());
//    }
//
//    /**
//     * a completed recharge replay succeeds without charging again
//     */
//    @Test
//    void rechargeDuplicate() throws Exception {
//        String accessToken = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDYXJ0ZXIiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0Ijo" +
//                "xNzkwNDMxMTA0LCJleHAiOjE3OTA0MzI5MDR9.zvixXO7uPwszUkNNpExNKbOsLVONZgOH6fvBSoXpbZarSS4" +
//                "7TcERhyqBhrE5GA_reLdzeTgjgDCJRgNo8GX_AQ";
//
//        mockMvc.perform(
//                        post("/user/recharge")
//                                .header("Authorization", "Bearer " + accessToken)
//                                .contentType(MediaType.APPLICATION_JSON)
//                                .content("""
//                                        {
//                                            "account": 100,
//                                            "uuid": "recharge-test-001"
//                                        }
//                                        """)
//                )
//                .andExpect(status().isOk())
//                .andExpect(jsonPath("$.code").value(200))
//                .andDo(print());
//    }
//
//    /**
//     * recharge failed by invalid amount
//     */
//    @Test
//    void rechargeInvalidAmount() throws Exception {
//        String accessToken = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDYXJ0ZXIiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0Ijo" +
//                "xNzkwNDMxMTA0LCJleHAiOjE3OTA0MzI5MDR9.zvixXO7uPwszUkNNpExNKbOsLVONZgOH6fvBSoXpbZarSS4" +
//                "7TcERhyqBhrE5GA_reLdzeTgjgDCJRgNo8GX_AQ";
//
//        mockMvc.perform(
//                        post("/user/recharge")
//                                .header("Authorization", "Bearer " + accessToken)
//                                .contentType(MediaType.APPLICATION_JSON)
//                                .content("""
//                                        {
//                                            "account": 0,
//                                            "uuid": "recharge-invalid-001"
//                                        }
//                                        """)
//                )
//                .andExpect(status().isBadRequest())
//                .andExpect(jsonPath("$.code").value(400))
//                .andDo(print());
//    }
//
//    /**
//     * recharge failed by missing token
//     */
//    @Test
//    void rechargeWithoutToken() throws Exception {
//        mockMvc.perform(
//                        post("/user/recharge")
//                                .contentType(MediaType.APPLICATION_JSON)
//                                .content("""
//                                        {
//                                            "account": 100,
//                                            "uuid": "recharge-no-token-001"
//                                        }
//                                        """)
//                )
//                .andExpect(status().isUnauthorized())
//                .andExpect(jsonPath("$.code").value(401))
//                .andDo(print());
//    }
//
//    /**
//     * merchant access user item endpoint
//     */
//    @Test
//    void merchantAccessUserItemEndpoint() throws Exception {
//        String accessToken = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJWaWEiLCJ0eXBlIjoiYWNjZXNzIiwiaWF0" +
//                "IjoxNzkwNDMxOTY1LCJleHAiOjE3OTA0MzM3NjV9.iLn7BDgHvgz4IvnkgL4dASPVirFViaA743dSM" +
//                "IQcHBhavwe6DNJIhqs3-f3qvzA2kkpTCid60Q6ChOiCCsXmsg";
//
//        mockMvc.perform(
//                        get("/item/get")
//                                .header("Authorization", "Bearer " + accessToken)
//                )
//                .andExpect(status().isForbidden())
//                .andExpect(jsonPath("$.code").value(403))
//                .andDo(print());
//    }
}
