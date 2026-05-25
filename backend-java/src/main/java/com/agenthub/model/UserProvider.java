package com.agenthub.model;

import java.time.LocalDateTime;

public class UserProvider {
  private String id;
  private String userId;
  private String providerType;
  private String apiKeyEnc;
  private String baseUrl;
  private String defaultModel;
  private boolean defaultProvider;
  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getUserId() {
    return userId;
  }

  public void setUserId(String userId) {
    this.userId = userId;
  }

  public String getProviderType() {
    return providerType;
  }

  public void setProviderType(String providerType) {
    this.providerType = providerType;
  }

  public String getApiKeyEnc() {
    return apiKeyEnc;
  }

  public void setApiKeyEnc(String apiKeyEnc) {
    this.apiKeyEnc = apiKeyEnc;
  }

  public String getBaseUrl() {
    return baseUrl;
  }

  public void setBaseUrl(String baseUrl) {
    this.baseUrl = baseUrl;
  }

  public String getDefaultModel() {
    return defaultModel;
  }

  public void setDefaultModel(String defaultModel) {
    this.defaultModel = defaultModel;
  }

  public boolean isDefaultProvider() {
    return defaultProvider;
  }

  public void setDefaultProvider(boolean defaultProvider) {
    this.defaultProvider = defaultProvider;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  public LocalDateTime getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(LocalDateTime updatedAt) {
    this.updatedAt = updatedAt;
  }
}
