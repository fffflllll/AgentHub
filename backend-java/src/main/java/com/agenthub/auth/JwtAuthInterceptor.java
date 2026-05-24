package com.agenthub.auth;

import com.agenthub.common.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class JwtAuthInterceptor implements HandlerInterceptor {
  private static final Logger log = LoggerFactory.getLogger(JwtAuthInterceptor.class);
  private static final String BEARER_PREFIX = "Bearer ";

  private final JwtTokenProvider jwtTokenProvider;
  private final ObjectMapper objectMapper;

  public JwtAuthInterceptor(JwtTokenProvider jwtTokenProvider, ObjectMapper objectMapper) {
    this.jwtTokenProvider = jwtTokenProvider;
    this.objectMapper = objectMapper;
  }

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
    String header = request.getHeader(HttpHeaders.AUTHORIZATION);
    if (header == null || !header.startsWith(BEARER_PREFIX)) {
      log.info("Unauthorized request without bearer token path={} method={}", request.getRequestURI(), request.getMethod());
      writeUnauthorized(response);
      return false;
    }

    try {
      String token = header.substring(BEARER_PREFIX.length()).trim();
      CurrentUser.set(jwtTokenProvider.validateToken(token));
      return true;
    } catch (RuntimeException exception) {
      CurrentUser.clear();
      log.info("Unauthorized request with invalid token path={} method={}", request.getRequestURI(), request.getMethod());
      writeUnauthorized(response);
      return false;
    }
  }

  @Override
  public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception exception) {
    CurrentUser.clear();
  }

  private void writeUnauthorized(HttpServletResponse response) throws Exception {
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    objectMapper.writeValue(response.getWriter(), ApiResponse.error(401, "unauthorized"));
  }
}
